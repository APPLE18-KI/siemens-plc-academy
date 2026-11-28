import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Eye,
  RotateCcw,
  Sparkles,
  Tag,
  XCircle,
  Zap,
} from 'lucide-react';
import { decodePlcToken } from '../../app/layout/plcAddressDecoder';
import { haptic } from '../../app/native/platform';
import { noteActivity, today } from './studyStore';

export type DrillCategory = 'all' | 'lad-read' | 'spot-fault' | 'addr-decode';

interface LadReadDrill {
  id: string;
  kind: 'lad-read';
  title: string;
  inputs: Array<{ addr: string; label: string; value: boolean }>;
  /** 简明梯形图图形描述 */
  rungType: 'series-no-nc' | 'parallel-or' | 'double-coil' | 'stop-priority';
  rungText: string[];
  question: string;
  answer: 0 | 1; // 0 = Q=0(断开), 1 = Q=1(导通)
  explain: string;
}

interface SpotFaultDrill {
  id: string;
  kind: 'spot-fault';
  title: string;
  scenario: string;
  zones: Array<{ id: string; tag: string; label: string; detail: string }>;
  faultZoneIndex: number;
  explain: string;
}

interface AddrDecodeDrill {
  id: string;
  kind: 'addr-decode';
  token: string;
  question: string;
  options: string[];
  answer: number;
}

type ActiveDrill = LadReadDrill | SpotFaultDrill | AddrDecodeDrill;

const DRILLS: ActiveDrill[] = [
  {
    id: 'lad-1',
    kind: 'lad-read',
    title: '读图速判 · 常开串联常闭',
    inputs: [
      { addr: '%I0.0', label: '启动按钮', value: true },
      { addr: '%I0.1', label: '互锁信号', value: true },
    ],
    rungType: 'series-no-nc',
    rungText: ['|----[ %I0.0 ]----[/ %I0.1 ]--------( %Q0.0 )----|'],
    question: '当前 %I0.0 = 1 且 %I0.1 = 1，请问输出线圈 %Q0.0 的状态是？',
    answer: 0,
    explain: '[/ %I0.1] 是常闭触点：当 %I0.1 = 1 时它反而“断开”拦截能流，所以 %Q0.0 = 0（熄灭）！',
  },
  {
    id: 'lad-2',
    kind: 'lad-read',
    title: '读图速判 · 停止优先自锁回路',
    inputs: [
      { addr: '%I0.0', label: '启动(卡死)', value: true },
      { addr: '%I0.1', label: '常闭停止(已拍下)', value: false },
      { addr: '%Q0.0', label: '原状态', value: true },
    ],
    rungType: 'stop-priority',
    rungText: [
      '|---+--[ %I0.0 ]--+---[ %I0.1 ]-----( %Q0.0 )----|',
      '    +--[ %Q0.0 ]--+',
    ],
    question: '启动按钮卡死为 1，此时拍下常闭停止按钮（%I0.1 变 0），%Q0.0 最终为？',
    answer: 0,
    explain: '%I0.1 串联在并联支路汇合后的主干道上，它为 0 时整条路彻底切断，所以 %Q0.0 = 0（停止优先）。',
  },
  {
    id: 'lad-3',
    kind: 'lad-read',
    title: '读图速判 · 双线圈覆盖陷阱',
    inputs: [
      { addr: '%I0.0', label: '手动按钮', value: true },
      { addr: '%I0.1', label: '自动允许', value: false },
    ],
    rungType: 'double-coil',
    rungText: [
      'NW1: |----[ %I0.0 ]-----------------( %Q0.0 )----|',
      'NW2: |----[ %I0.1 ]-----------------( %Q0.0 )----|',
    ],
    question: 'NW1 满足导通、NW2 不满足，PLC 本轮扫描结束后 %Q0.0 物理端子输出？',
    answer: 0,
    explain: '遵循“后写覆盖先写”：NW2 把 PIQ 里的 %Q0.0 覆写回了 0，最终统一刷新到端子时输出为 0！',
  },
  {
    id: 'lad-4',
    kind: 'lad-read',
    title: '读图速判 · 并联或（OR）逻辑',
    inputs: [
      { addr: '%I0.0', label: '本地启动', value: false },
      { addr: '%I0.1', label: '远程启动', value: true },
      { addr: '%I0.2', label: '安全门(NC正常)', value: true },
    ],
    rungType: 'parallel-or',
    rungText: [
      '|---+--[ %I0.0 ]--+---[ %I0.2 ]-----( %Q0.0 )----|',
      '    +--[ %I0.1 ]--+',
    ],
    question: '只有远程启动 %I0.1 = 1 且安全门闭合 %I0.2 = 1，请问 %Q0.0 输出？',
    answer: 1,
    explain: '并联支路只要有一条通（%I0.1 = 1），再经串联闭合的 %I0.2 = 1，能流直达线圈，%Q0.0 = 1！',
  },
  {
    id: 'fault-1',
    kind: 'spot-fault',
    title: '看图挑刺 · NPN 传感器接上没反应',
    scenario: '现场新装了一只 NPN 型光电传感器，传感器尾巴灯已经亮了，但 PLC 上 %I0.3 指示灯一直不亮。请点出下面接线里出错的部位！',
    zones: [
      { id: 'z1', tag: '传感器类型', label: 'NPN 输出（动作时信号线输出 0V）', detail: '型号核对无误' },
      { id: 'z2', tag: '输入公共端 1M', label: '1M 接在 0V (M 端子)', detail: '电势 = 0V' },
      { id: 'z3', tag: 'PLC 电源', label: 'CPU 供电 DC 24V 正常', detail: 'RUN 绿灯常亮' },
    ],
    faultZoneIndex: 1,
    explain: 'NPN 传感器触发时拉低到 0V，若公共端 1M 也接 0V，光耦两端电位差为 0V 无法导通！必须把 1M 改接 +24V (L+)。',
  },
  {
    id: 'fault-2',
    kind: 'spot-fault',
    title: '看图挑刺 · 为什么点动按钮一松手电机停不下来？',
    scenario: '新手给起保停加了一个“点动调试按钮 Jog_PB”，结果一按点动松手后电机居然自己长转不停了！点击出错的设计环节：',
    zones: [
      { id: 'z1', tag: '停止支路', label: '常闭停止按钮串在主干道', detail: '正常未按下 = 1' },
      { id: 'z2', tag: '点动位置', label: 'Jog_PB 直接并联在 Motor_KM1 自锁回路内部', detail: '与 Start_PB 并排' },
      { id: 'z3', tag: '热继电器', label: '过载常闭触点 FR 串联保护', detail: '未过载时 = 1' },
    ],
    faultZoneIndex: 1,
    explain: '把 Jog_PB 并进 Motor_KM1 的自锁支路里后，按 Jog_PB 会让 Motor_KM1 吸合，紧接着 Motor_KM1 自己的常开触点闭合自锁，松开点动就停不下来了！应先用中间位 M0.0 做长动自锁，再与 Jog_PB 汇合输出。',
  },
  {
    id: 'fault-3',
    kind: 'spot-fault',
    title: '看图挑刺 · 急停断线安全隐患',
    scenario: '验收安全回路时，安全工程师一眼指出急停电路不合格（万一老鼠咬断按钮线机器会停不下来）。点出哪一处设计踩了红线：',
    zones: [
      { id: 'z1', tag: '急停按钮接线', label: '现场急停接了物理常开触点 (NO)', detail: '平时 0V，拍下才送 24V' },
      { id: 'z2', tag: '接触器电源', label: '安全继电器串联主接触器线圈', detail: '合规设计' },
      { id: 'z3', tag: '程序报警灯', label: '急停触发后点亮红色指示灯', detail: '合规设计' },
    ],
    faultZoneIndex: 0,
    explain: '急停和停止按钮严禁接物理常开！因为断线后信号依然是 0V，拍急停毫无反应。必须接物理常闭 (NC)，平时 24V=1，拍下或断线变 0 立即停机。',
  },
  {
    id: 'fault-4',
    kind: 'spot-fault',
    title: '看图挑刺 · 为什么温度数值突然乱跳？',
    scenario: '程序里定义了两个 M 区整数，结果每次修改“设定速度”时，“当前温度”数值就莫名其妙跟着乱跳！点出地址分配冲突处：',
    zones: [
      { id: 'z1', tag: '温度变量', label: 'Temp_Val 使用地址 %MW10', detail: '占用 %MB10 和 %MB11' },
      { id: 'z2', tag: '速度变量', label: 'Speed_Set 使用地址 %MW11', detail: '占用 %MB11 和 %MB12' },
      { id: 'z3', tag: '报警标志位', label: 'Alarm_Flag 使用地址 %M20.0', detail: '位于第 20 字节' },
    ],
    faultZoneIndex: 1,
    explain: '一个字 (Word/Int) 占 2 个字节！%MW10 已经占用了 %MB10 和 %MB11，下一个字必须从 %MW12 开始，建 %MW11 会导致第 11 字节重叠串扰！',
  },
  {
    id: 'addr-1',
    kind: 'addr-decode',
    token: '%IW64',
    question: '在 S7-1200 里看到地址 `%IW64`，它通常代表什么？',
    options: [
      '第 64 号数字量指示灯输出',
      '默认第 1 路模拟量输入通道（16 位整数 0~27648）',
      '内部定时器的预设时间',
      '第 64 个以太网 IP 地址',
    ],
    answer: 1,
  },
  {
    id: 'addr-2',
    kind: 'addr-decode',
    token: '%MW10',
    question: '关于内部存储区地址 `%MW10`，下面哪句话是对的？',
    options: [
      '只占 1 个开关位（0 或 1）',
      '占用 %MB10 和 %MB11 两个字节，下一个字应从 %MW12 起建',
      '直接连着外部 24V 按钮端子',
      '占用 4 个字节，可以存 32 位浮点数',
    ],
    answer: 1,
  },
  {
    id: 'addr-3',
    kind: 'addr-decode',
    token: '16#047F',
    question: '在西门子变频器 1 号报文里发送控制字 `16#047F` 的含义是？',
    options: [
      '急停断电命令',
      '相对于 16#047E 将 Bit0 置 1，发出上升沿启动运行命令',
      '设定转速为 47.9 Hz',
      '清除 PLC 全部程序存储器',
    ],
    answer: 1,
  },
  {
    id: 'addr-4',
    kind: 'addr-decode',
    token: 'T#3s',
    question: '在博途 TON 定时器的 PT 管脚看到 `T#3s`，它的意思是？',
    options: [
      '重复执行 3 次循环',
      'IEC 时间常数：延时 3 秒（内部存为 3000 毫秒）',
      '调用第 3 号定时器数据块',
      '把扫描周期改成 3 秒',
    ],
    answer: 1,
  },
];

const DRILL_DAILY_KEY = 'plc_daily_drills_v1';

interface DailyDrillRecord {
  date: string;
  doneIds: string[];
  correctCount: number;
}

export function loadTodayDrillProgress(): DailyDrillRecord {
  const d = today();
  try {
    const raw = window.localStorage.getItem(DRILL_DAILY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DailyDrillRecord>;
      if (parsed.date === d && Array.isArray(parsed.doneIds)) {
        return {
          date: d,
          doneIds: parsed.doneIds.filter((x): x is string => typeof x === 'string'),
          correctCount: typeof parsed.correctCount === 'number' ? parsed.correctCount : 0,
        };
      }
    }
  } catch {
    /* ignore */
  }
  return { date: d, doneIds: [], correctCount: 0 };
}

function recordDrillDone(id: string, correct: boolean): DailyDrillRecord {
  const prev = loadTodayDrillProgress();
  const already = prev.doneIds.includes(id);
  const next: DailyDrillRecord = {
    date: today(),
    doneIds: already ? prev.doneIds : [...prev.doneIds, id],
    correctCount: already ? prev.correctCount : prev.correctCount + (correct ? 1 : 0),
  };
  try {
    window.localStorage.setItem(DRILL_DAILY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  noteActivity();
  return next;
}

export const InteractiveDrills: React.FC<{ onProgressChange?: (doneCount: number) => void }> = ({
  onProgressChange,
}) => {
  const [category, setCategory] = useState<DrillCategory>('all');
  const [idx, setIdx] = useState<number>(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [daily, setDaily] = useState<DailyDrillRecord>(() => loadTodayDrillProgress());

  const list = useMemo(
    () => (category === 'all' ? DRILLS : DRILLS.filter((d) => d.kind === category)),
    [category],
  );
  const safeIdx = idx % Math.max(1, list.length);
  const current = list[safeIdx];

  const handleCategory = (cat: DrillCategory) => {
    setCategory(cat);
    setIdx(0);
    setPicked(null);
  };

  const handlePick = (choice: number) => {
    if (!current || picked !== null) return;
    const isCorrect =
      current.kind === 'lad-read'
        ? choice === current.answer
        : current.kind === 'spot-fault'
          ? choice === current.faultZoneIndex
          : choice === current.answer;
    haptic(isCorrect ? 'success' : 'error');
    setPicked(choice);
    const updated = recordDrillDone(current.id, isCorrect);
    setDaily(updated);
    onProgressChange?.(updated.doneIds.length);
  };

  const handleNext = () => {
    haptic('tap');
    setPicked(null);
    setIdx((i) => (i + 1) % list.length);
  };

  if (!current) return null;

  const isCorrect =
    picked !== null &&
    (current.kind === 'lad-read'
      ? picked === current.answer
      : current.kind === 'spot-fault'
        ? picked === current.faultZoneIndex
        : picked === current.answer);

  const decodedInfo = current.kind === 'addr-decode' ? decodePlcToken(current.token) : null;

  return (
    <section className="v32-drills-wrap" aria-label="15 秒互动微练">
      <div className="v32-drills-top">
        <div className="v32-drills-cats" role="tablist" aria-label="题型筛选">
          {([
            { id: 'all', label: '混合速练', icon: Zap },
            { id: 'lad-read', label: '读图速判', icon: Cpu },
            { id: 'spot-fault', label: '看图挑刺', icon: Eye },
            { id: 'addr-decode', label: '地址速译', icon: Tag },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={category === id}
              className={`v32-drill-cat${category === id ? ' is-on' : ''}`}
              onClick={() => handleCategory(id)}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <div className="v32-drill-stats">
          <span>
            今日已刷 <b>{daily.doneIds.length}</b> 题（正确 {daily.correctCount}）
          </span>
          <span className="v32-drill-counter">
            第 {safeIdx + 1} / {list.length} 题
          </span>
        </div>
      </div>

      <article className="v32-drill-card">
        <div className="v32-drill-badge-row">
          <span className={`v32-drill-type-pill kind-${current.kind}`}>
            {current.kind === 'lad-read'
              ? '读图速判 · 15 秒'
              : current.kind === 'spot-fault'
                ? '看图挑刺 · 找隐患'
                : '地址速译 · 大白话'}
          </span>
          <span className="v32-drill-title">{current.kind === 'addr-decode' ? `秒懂符号 ${current.token}` : current.title}</span>
        </div>

        {/* Mode 1: LAD Read */}
        {current.kind === 'lad-read' && (
          <>
            <div className="v32-drill-inputs">
              <span className="v32-drill-inputs-lbl">当前输入信号：</span>
              {current.inputs.map((inp) => (
                <span key={inp.addr} className={`v32-sig-pill ${inp.value ? 'is-1' : 'is-0'}`}>
                  <code>{inp.addr}</code> {inp.label} = <b>{inp.value ? '1' : '0'}</b>
                </span>
              ))}
            </div>
            <pre className="v32-drill-lad">
              <code>{current.rungText.join('\n')}</code>
            </pre>
            <p className="v32-drill-q">{current.question}</p>
            <div className="v32-drill-binary">
              <button
                type="button"
                className={`v32-bin-btn${picked === 1 ? ' is-picked' : ''}${picked !== null && current.answer === 1 ? ' is-correct' : ''}${picked === 1 && current.answer !== 1 ? ' is-wrong' : ''}`}
                disabled={picked !== null}
                onClick={() => handlePick(1)}
              >
                <span className="v32-bin-dot on" />
                <div>
                  <strong>Q = 1（导通亮灯）</strong>
                  <small>能流到达输出线圈</small>
                </div>
              </button>
              <button
                type="button"
                className={`v32-bin-btn${picked === 0 ? ' is-picked' : ''}${picked !== null && current.answer === 0 ? ' is-correct' : ''}${picked === 0 && current.answer !== 0 ? ' is-wrong' : ''}`}
                disabled={picked !== null}
                onClick={() => handlePick(0)}
              >
                <span className="v32-bin-dot off" />
                <div>
                  <strong>Q = 0（断开熄灭）</strong>
                  <small>能流被拦截或被覆盖</small>
                </div>
              </button>
            </div>
          </>
        )}

        {/* Mode 2: Spot Fault */}
        {current.kind === 'spot-fault' && (
          <>
            <p className="v32-drill-q">{current.scenario}</p>
            <div className="v32-spot-grid" role="group" aria-label="点击出错的环节">
              {current.zones.map((z, zIdx) => {
                const isTarget = picked !== null && zIdx === current.faultZoneIndex;
                const isWrong = picked === zIdx && zIdx !== current.faultZoneIndex;
                return (
                  <button
                    key={z.id}
                    type="button"
                    className={`v32-spot-zone${isTarget ? ' is-correct' : ''}${isWrong ? ' is-wrong' : ''}`}
                    disabled={picked !== null}
                    onClick={() => handlePick(zIdx)}
                  >
                    <span className="v32-spot-tag">{z.tag}</span>
                    <strong>{z.label}</strong>
                    <small>{z.detail}</small>
                    {isTarget && (
                      <span className="v32-spot-flag">
                        <AlertTriangle size={12} /> 隐患根因在此！
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Mode 3: Address Speed-Decode */}
        {current.kind === 'addr-decode' && (
          <>
            <div className="v32-addr-hero">
              <code>{current.token}</code>
              <span>大白话速译</span>
            </div>
            <p className="v32-drill-q">{current.question}</p>
            <div className="v32-addr-opts">
              {current.options.map((opt, oIdx) => {
                const correct = picked !== null && oIdx === current.answer;
                const wrong = picked === oIdx && oIdx !== current.answer;
                return (
                  <button
                    key={oIdx}
                    type="button"
                    className={`v32-predict-opt${correct ? ' is-correct' : ''}${wrong ? ' is-wrong' : ''}`}
                    disabled={picked !== null}
                    onClick={() => handlePick(oIdx)}
                  >
                    <span className="v32-predict-letter">{String.fromCharCode(65 + oIdx)}</span>
                    <span className="v32-predict-opt-text">{opt}</span>
                    {correct && <CheckCircle2 size={16} className="v32-predict-mark ok" />}
                    {wrong && <XCircle size={16} className="v32-predict-mark bad" />}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Immediate Feedback & Explanation */}
        {picked !== null && (
          <div className={`v32-drill-feedback ${isCorrect ? 'is-ok' : 'is-bad'}`} role="status">
            <div className="v32-drill-fb-head">
              {isCorrect ? (
                <>
                  <Sparkles size={16} /> <strong>答对了！直觉越来越像现场工程师了</strong>
                </>
              ) : (
                <>
                  <XCircle size={16} /> <strong>差一点！趁热看一眼核心原因</strong>
                </>
              )}
            </div>
            <p>
              {current.kind === 'addr-decode'
                ? decodedInfo?.plainExplain ?? ''
                : current.explain}
            </p>
            {decodedInfo?.pitfall && (
              <p className="v32-drill-pitfall">⚠️ {decodedInfo.pitfall}</p>
            )}
            <div className="v32-drill-fb-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={handleNext}>
                下一题 <ArrowRight size={14} />
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setPicked(null)}
              >
                <RotateCcw size={13} /> 重试本题
              </button>
            </div>
          </div>
        )}
      </article>
    </section>
  );
};
