import type { TagDef, TagValue } from '../../types/plc';
import { createLadderInternalState, evaluateLadderProgram } from './ladderEvaluator';
import type { LadderProgram } from './types';

export interface MicroTagDiff {
  tag: string;
  address: string;
  before: string;
  after: string;
  changedToTrue?: boolean;
}

export interface MicroStepFrame {
  stepIndex: number;
  kind: 'PII' | 'NETWORK' | 'PIQ';
  title: string;
  narration: string;
  networkNumber: number | null;
  diffs: MicroTagDiff[];
}

function fmtVal(v: TagValue | undefined): string {
  if (typeof v === 'boolean') return v ? '1 (TRUE)' : '0 (FALSE)';
  if (typeof v === 'number') return String(Number.isInteger(v) ? v : Number(v.toFixed(2)));
  return String(v ?? '0');
}

function diffMaps(
  before: Record<string, TagValue>,
  after: Record<string, TagValue>,
  tagDefs: TagDef[],
): MicroTagDiff[] {
  const out: MicroTagDiff[] = [];
  for (const def of tagDefs) {
    const b = before[def.name];
    const a = after[def.name];
    if (b !== a) {
      out.push({
        tag: def.name,
        address: def.address,
        before: fmtVal(b),
        after: fmtVal(a),
        changedToTrue: a === true,
      });
    }
  }
  return out;
}

/**
 * Python Tutor 风格“单个扫描周期逐段微步 X 光拆解器”：
 * 不影响正在运行的 CPU，基于当前输入/标签快照生成从 ① PII 采样 → ② 程序段 1..N 逐段求值 → ③ PIQ 写回端子的完整微步轨迹与变量跳变 Diff。
 */
export function buildCycleMicroTrace(
  program: LadderProgram,
  tagDefs: TagDef[],
  currentTags: Record<string, TagValue>,
  fieldInputs: Record<string, TagValue>,
  fieldOutputs: Record<string, TagValue>,
  forces: Record<string, TagValue>,
  dtMs: number,
  nextCycleNumber: number,
): MicroStepFrame[] {
  const frames: MicroStepFrame[] = [];
  const simTags: Record<string, TagValue> = { ...currentTags };
  const internal = createLadderInternalState();

  const inputDefs = tagDefs.filter((d) => d.area === 'I' || d.address.startsWith('%I'));
  const outputDefs = tagDefs.filter((d) => d.area === 'Q' || d.address.startsWith('%Q'));

  // Step 0: PII 锁存输入映像
  const beforePii = { ...simTags };
  for (const def of inputDefs) {
    const nextVal = def.name in forces ? forces[def.name] : fieldInputs[def.name];
    if (nextVal !== undefined) simTags[def.name] = nextVal;
  }
  const piiDiffs = diffMaps(beforePii, simTags, inputDefs);
  frames.push({
    stepIndex: 0,
    kind: 'PII',
    title: `① 锁存输入映像 PII（周期 #${nextCycleNumber}）`,
    narration:
      piiDiffs.length > 0
        ? `CPU 一次性读取外部端子状态并冻结到输入映像区 PII，捕捉到 ${piiDiffs.length} 个输入跳变。本周期后面所有程序段都读这份快照。`
        : 'CPU 一次性读取所有外部按钮与传感器并锁存到 PII 输入映像区（本周期输入状态与上一周期一致）。',
    networkNumber: null,
    diffs: piiDiffs,
  });

  // Step 1..N: 逐个程序段从上到下顺序求值
  program.networks.forEach((nw, idx) => {
    const beforeNw = { ...simTags };
    evaluateLadderProgram(
      { ...program, networks: [nw] },
      simTags,
      tagDefs,
      internal,
      dtMs,
      {
        cycle: nextCycleNumber,
        phase: 'OB1_EXEC',
        piiCaptured: { ...simTags },
        piqFlushed: {},
        durationMs: 0.1,
      },
    );
    const nwDiffs = diffMaps(beforeNw, simTags, tagDefs);
    frames.push({
      stepIndex: idx + 1,
      kind: 'NETWORK',
      title: `② 执行程序段 ${nw.number}：${nw.title}`,
      narration:
        nwDiffs.length > 0
          ? `CPU 从左到右算完程序段 ${nw.number}，改写了 ${nwDiffs.map((d) => d.address).join('、')} 的映像区数值（注意：此刻外部物理端子还没刷新，要等全部程序段跑完！）。`
          : `CPU 算完程序段 ${nw.number}，输出与中间标志保持原值不变，继续向下扫描下一段。`,
      networkNumber: nw.number,
      diffs: nwDiffs,
    });
  });

  // Final Step: PIQ 统一刷写外部物理输出端子
  const beforeOut: Record<string, TagValue> = {};
  const afterOut: Record<string, TagValue> = {};
  for (const def of outputDefs) {
    beforeOut[def.name] = fieldOutputs[def.name];
    afterOut[def.name] = def.name in forces ? forces[def.name] : simTags[def.name];
  }
  const piqDiffs = diffMaps(beforeOut, afterOut, outputDefs);
  frames.push({
    stepIndex: frames.length,
    kind: 'PIQ',
    title: '③ 统一刷写输出映像 PIQ → 现场端子',
    narration:
      piqDiffs.length > 0
        ? `全部程序段执行完毕！CPU 把最终 PIQ 结果一次性输出给外部硬件端子，共有 ${piqDiffs.length} 个输出发生亮灭变化（这就是双线圈只生效最后一行的根本原因！）。`
        : '全部程序段执行完毕，CPU 将最终 PIQ 映像刷写到外部输出端子（外部指示灯与执行器状态保持不变）。',
    networkNumber: null,
    diffs: piqDiffs,
  });

  return frames;
}
