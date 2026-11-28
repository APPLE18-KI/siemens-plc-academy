import type { TagDef, TagValue } from '../../types/plc';
import {
  analyzeProgramCrossRef,
  createLadderInternalState,
  evaluateLadderProgram,
  type LadderProgram,
} from '../../core/plc';
import type { SandboxNetworkDraft } from './sandboxCodec';

export interface ChallengePhase {
  label: string;
  durationMs: number;
  inputs: Record<string, boolean>;
  /** 期望在该阶段结束时满足的输出值 */
  expectAtEnd: Record<string, boolean>;
  /** 可选：该阶段所有周期都不能同时为 1 的两个输出（用于互锁验收） */
  mustNotBothBeOn?: [string, string];
  /** 可选：整个阶段期间都不能提前为 1 的输出（用于 TON 延时防早启） */
  mustStayFalse?: string[];
}

export interface LadderChallenge {
  id: string;
  order: number;
  level: '入门' | '基础' | '进阶' | '排错';
  title: string;
  goal: string;
  targetOutputTag: string;
  targetOutputLabel: string;
  forbidDoubleCoil?: boolean;
  hints: [string, string];
  starterDrafts: SandboxNetworkDraft[];
  referenceDrafts: SandboxNetworkDraft[];
  phases: ChallengePhase[];
}

export interface PhaseVerifyResult {
  label: string;
  passed: boolean;
  expectedSummary: string;
  actualSummary: string;
  reason?: string;
}

export interface WaveformPoint {
  timeMs: number;
  phaseIndex: number;
  expected: boolean;
  actual: boolean;
}

export interface ChallengeVerifyReport {
  challengeId: string;
  passed: boolean;
  doubleCoilBlocked: boolean;
  passedPhases: number;
  totalPhases: number;
  summary: string;
  phases: PhaseVerifyResult[];
  waveform: WaveformPoint[];
  targetOutputLabel: string;
}

const PASSED_STORAGE_KEY = 'plc_lad_sandbox_challenges_v1';

export function loadPassedLadChallenges(): string[] {
  try {
    const raw = window.localStorage.getItem(PASSED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function savePassedLadChallenge(id: string): string[] {
  const prev = loadPassedLadChallenges();
  if (prev.includes(id)) return prev;
  const next = [...prev, id];
  try {
    window.localStorage.setItem(PASSED_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
  return next;
}

export const LADDER_CHALLENGES: LadderChallenge[] = [
  {
    id: 'lad-01-jog',
    order: 1,
    level: '入门',
    title: '第 1 关 · 点动控制电机',
    goal: '用启动按钮 I_Btn1 (%I0.0) 直接驱动电机 Q_Motor (%Q0.0)，且串联常闭停止按钮 I_Stop_NC (%I0.2)：按住启动电机转，松开或按停止立刻停。',
    targetOutputTag: 'Q_Motor',
    targetOutputLabel: 'Q_Motor (%Q0.0)',
    forbidDoubleCoil: true,
    hints: [
      '把 I_Btn1 的常开触点 -| |- 和 I_Stop_NC 的常开触点 -| |- 串联在一起，再接到 Q_Motor 普通线圈 -( )-。',
      '记住：I_Stop_NC 外部接的是物理常闭按钮，正常未按下时输入为 1，所以程序里要放常开触点 -| |-！',
    ],
    starterDrafts: [
      {
        id: 'ch1-nw1',
        title: '点动控制电机（待完成）',
        topBranch: [{ id: 'ch1-c1', kind: 'NO', tag: 'I_Btn1' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_LampG',
      },
    ],
    referenceDrafts: [
      {
        id: 'ch1-ref1',
        title: '点动控制电机（参考方案）',
        topBranch: [
          { id: 'ch1-r1', kind: 'NO', tag: 'I_Btn1' },
          { id: 'ch1-r2', kind: 'NO', tag: 'I_Stop_NC' },
        ],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_Motor',
      },
    ],
    phases: [
      {
        label: '1. 初始静止（未按按钮）',
        durationMs: 250,
        inputs: { I_Btn1: false, I_Stop_NC: true },
        expectAtEnd: { Q_Motor: false },
      },
      {
        label: '2. 按住启动按钮 I_Btn1',
        durationMs: 350,
        inputs: { I_Btn1: true, I_Stop_NC: true },
        expectAtEnd: { Q_Motor: true },
      },
      {
        label: '3. 松开启动按钮（应立即停止）',
        durationMs: 300,
        inputs: { I_Btn1: false, I_Stop_NC: true },
        expectAtEnd: { Q_Motor: false },
      },
      {
        label: '4. 启动与常闭停止同时按下（停止优先）',
        durationMs: 300,
        inputs: { I_Btn1: true, I_Stop_NC: false },
        expectAtEnd: { Q_Motor: false },
      },
    ],
  },
  {
    id: 'lad-02-seal-in',
    order: 2,
    level: '入门',
    title: '第 2 关 · 手搭经典起保停自锁',
    goal: '用 I_Btn1 启动电机 Q_Motor，松手后依靠自锁保持运转；按常闭停止 I_Stop_NC 停机；即使 I_Btn1 卡死为 1，拍下停止也必须立刻停机（停止优先）。',
    targetOutputTag: 'Q_Motor',
    targetOutputLabel: 'Q_Motor (%Q0.0)',
    forbidDoubleCoil: true,
    hints: [
      '点网段右上角的「+ 添加并联自锁支路」，在并联支路（下）放入 Q_Motor 的常开触点 -| |-。',
      '要满足“停止优先”，把 I_Stop_NC 的常开触点 -| |- 放在「汇合后串联」的主干道上！',
    ],
    starterDrafts: [
      {
        id: 'ch2-nw1',
        title: '电机起保停回路（待加自锁与停止）',
        topBranch: [{ id: 'ch2-c1', kind: 'NO', tag: 'I_Btn1' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_Motor',
      },
    ],
    referenceDrafts: [
      {
        id: 'ch2-ref1',
        title: '经典起保停自锁（停止优先）',
        topBranch: [{ id: 'ch2-r1', kind: 'NO', tag: 'I_Btn1' }],
        hasParallelBranch: true,
        parallelBranch: [{ id: 'ch2-r2', kind: 'NO', tag: 'Q_Motor' }],
        seriesAfter: [{ id: 'ch2-r3', kind: 'NO', tag: 'I_Stop_NC' }],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_Motor',
      },
    ],
    phases: [
      {
        label: '1. 初始静止',
        durationMs: 200,
        inputs: { I_Btn1: false, I_Stop_NC: true },
        expectAtEnd: { Q_Motor: false },
      },
      {
        label: '2. 点按启动按钮 I_Btn1',
        durationMs: 300,
        inputs: { I_Btn1: true, I_Stop_NC: true },
        expectAtEnd: { Q_Motor: true },
      },
      {
        label: '3. 松开启动按钮（验证自锁保持）',
        durationMs: 450,
        inputs: { I_Btn1: false, I_Stop_NC: true },
        expectAtEnd: { Q_Motor: true },
      },
      {
        label: '4. 按下常闭停止 I_Stop_NC（应停机）',
        durationMs: 300,
        inputs: { I_Btn1: false, I_Stop_NC: false },
        expectAtEnd: { Q_Motor: false },
      },
      {
        label: '5. 松开停止按钮（不得自动重启）',
        durationMs: 250,
        inputs: { I_Btn1: false, I_Stop_NC: true },
        expectAtEnd: { Q_Motor: false },
      },
      {
        label: '6. 启动卡死 + 拍停止（验证停止优先）',
        durationMs: 300,
        inputs: { I_Btn1: true, I_Stop_NC: false },
        expectAtEnd: { Q_Motor: false },
      },
    ],
  },
  {
    id: 'lad-03-interlock',
    order: 3,
    level: '基础',
    title: '第 3 关 · 双输出软件互锁防冲突',
    goal: 'NW1 用 I_Btn1 驱动 Q_Motor，NW2 用 I_Btn2 驱动 Q_Valve；但两者像正反转一样绝对不能同时为 1！请给两个网段加上软件互锁。',
    targetOutputTag: 'Q_Motor',
    targetOutputLabel: 'Q_Motor (%Q0.0)',
    forbidDoubleCoil: true,
    hints: [
      '在 NW1 里串联对方线圈 Q_Valve（或按钮 I_Btn2）的常闭触点 -|/|-。',
      '同样在 NW2 里串联 Q_Motor（或 I_Btn1）的常闭触点 -|/|-，这样两个输出永不同时吸合。',
    ],
    starterDrafts: [
      {
        id: 'ch3-nw1',
        title: 'NW1 通道 A 驱动 Q_Motor（缺少互锁）',
        topBranch: [{ id: 'ch3-c1', kind: 'NO', tag: 'I_Btn1' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_Motor',
      },
      {
        id: 'ch3-nw2',
        title: 'NW2 通道 B 驱动 Q_Valve（缺少互锁）',
        topBranch: [{ id: 'ch3-c2', kind: 'NO', tag: 'I_Btn2' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_Valve',
      },
    ],
    referenceDrafts: [
      {
        id: 'ch3-ref1',
        title: 'NW1 通道 A 驱动 Q_Motor（带 Q_Valve 常闭互锁）',
        topBranch: [
          { id: 'ch3-r1', kind: 'NO', tag: 'I_Btn1' },
          { id: 'ch3-r2', kind: 'NC', tag: 'Q_Valve' },
        ],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_Motor',
      },
      {
        id: 'ch3-ref2',
        title: 'NW2 通道 B 驱动 Q_Valve（带 Q_Motor 常闭互锁）',
        topBranch: [
          { id: 'ch3-r3', kind: 'NO', tag: 'I_Btn2' },
          { id: 'ch3-r4', kind: 'NC', tag: 'Q_Motor' },
        ],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_Valve',
      },
    ],
    phases: [
      {
        label: '1. 初始静止',
        durationMs: 200,
        inputs: { I_Btn1: false, I_Btn2: false, I_Stop_NC: true },
        expectAtEnd: { Q_Motor: false, Q_Valve: false },
      },
      {
        label: '2. 仅按 I_Btn1（Q_Motor=1, Q_Valve=0）',
        durationMs: 300,
        inputs: { I_Btn1: true, I_Btn2: false, I_Stop_NC: true },
        expectAtEnd: { Q_Motor: true, Q_Valve: false },
      },
      {
        label: '3. 误操作同时按 I_Btn1+I_Btn2（绝不能同时=1）',
        durationMs: 350,
        inputs: { I_Btn1: true, I_Btn2: true, I_Stop_NC: true },
        expectAtEnd: {},
        mustNotBothBeOn: ['Q_Motor', 'Q_Valve'],
      },
      {
        label: '4. 全部松开归零',
        durationMs: 250,
        inputs: { I_Btn1: false, I_Btn2: false, I_Stop_NC: true },
        expectAtEnd: { Q_Motor: false, Q_Valve: false },
      },
      {
        label: '5. 仅按 I_Btn2（Q_Motor=0, Q_Valve=1）',
        durationMs: 300,
        inputs: { I_Btn1: false, I_Btn2: true, I_Stop_NC: true },
        expectAtEnd: { Q_Motor: false, Q_Valve: true },
      },
    ],
  },
  {
    id: 'lad-04-ton-delay',
    order: 4,
    level: '基础',
    title: '第 4 关 · TON 延时 2 秒开启电磁阀',
    goal: '按住 I_Btn1 持续满 2 秒（2000ms）后，电磁阀 Q_Valve (%Q0.1) 才动作；按住不足 2 秒或中途松手不能误动作，松手后电磁阀关闭。',
    targetOutputTag: 'Q_Valve',
    targetOutputLabel: 'Q_Valve (%Q0.1)',
    forbidDoubleCoil: true,
    hints: [
      '把网段底部的「IEC 定时器」改为 TON（接通延时），设定时间 PT = 2000 ms。',
      '输出线圈改成普通线圈 OTE ( ) 指向 Q_Valve (%Q0.1)，这样松开 I_Btn1 时 TON 自动清零、阀门随之关闭。',
    ],
    starterDrafts: [
      {
        id: 'ch4-nw1',
        title: '延时 2s 开启电磁阀（待加 TON）',
        topBranch: [{ id: 'ch4-c1', kind: 'NO', tag: 'I_Btn1' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_Valve',
      },
    ],
    referenceDrafts: [
      {
        id: 'ch4-ref1',
        title: 'TON 2000ms 接通延时驱动 Q_Valve',
        topBranch: [{ id: 'ch4-r1', kind: 'NO', tag: 'I_Btn1' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'TON',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_Valve',
      },
    ],
    phases: [
      {
        label: '1. 初始未按下',
        durationMs: 200,
        inputs: { I_Btn1: false, I_Stop_NC: true },
        expectAtEnd: { Q_Valve: false },
      },
      {
        label: '2. 按住 1.0 秒（未满 2 秒，不得提前动作）',
        durationMs: 1000,
        inputs: { I_Btn1: true, I_Stop_NC: true },
        expectAtEnd: { Q_Valve: false },
        mustStayFalse: ['Q_Valve'],
      },
      {
        label: '3. 继续按住至累计 2.3 秒（计时满，Q_Valve=1）',
        durationMs: 1300,
        inputs: { I_Btn1: true, I_Stop_NC: true },
        expectAtEnd: { Q_Valve: true },
      },
      {
        label: '4. 松开按钮（TON 复位，Q_Valve=0）',
        durationMs: 300,
        inputs: { I_Btn1: false, I_Stop_NC: true },
        expectAtEnd: { Q_Valve: false },
      },
    ],
  },
  {
    id: 'lad-05-set-reset',
    order: 5,
    level: '进阶',
    title: '第 5 关 · 置位 / 复位控制（S / R）',
    goal: '用两个网段配合 SET (S) 和 RESET (R)：点按 I_Btn1 后电磁阀 Q_Valve 保持吸合；点按 I_Btn2 后电磁阀断开复位。',
    targetOutputTag: 'Q_Valve',
    targetOutputLabel: 'Q_Valve (%Q0.1)',
    hints: [
      'NW1：用 I_Btn1 驱动 Q_Valve 的 SET 置位线圈 (S)——不需要并联支路也能自己保持！',
      '点「新增网段」加 NW2：用 I_Btn2 驱动同一个 Q_Valve 的 RESET 复位线圈 (R)。注意 SET + RESET 成对控制同一个地址不算双线圈错误。',
    ],
    starterDrafts: [
      {
        id: 'ch5-nw1',
        title: 'NW1 置位电磁阀（待改线圈类型并新增复位段）',
        topBranch: [{ id: 'ch5-c1', kind: 'NO', tag: 'I_Btn1' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_Valve',
      },
    ],
    referenceDrafts: [
      {
        id: 'ch5-ref1',
        title: 'NW1 点按 I_Btn1 置位 Q_Valve (S)',
        topBranch: [{ id: 'ch5-r1', kind: 'P_TRIG', tag: 'I_Btn1' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'SET',
        coilTag: 'Q_Valve',
      },
      {
        id: 'ch5-ref2',
        title: 'NW2 点按 I_Btn2 复位 Q_Valve (R)',
        topBranch: [{ id: 'ch5-r2', kind: 'P_TRIG', tag: 'I_Btn2' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'RESET',
        coilTag: 'Q_Valve',
      },
    ],
    phases: [
      {
        label: '1. 初始断开',
        durationMs: 200,
        inputs: { I_Btn1: false, I_Btn2: false, I_Stop_NC: true },
        expectAtEnd: { Q_Valve: false },
      },
      {
        label: '2. 点按 I_Btn1 置位',
        durationMs: 250,
        inputs: { I_Btn1: true, I_Btn2: false, I_Stop_NC: true },
        expectAtEnd: { Q_Valve: true },
      },
      {
        label: '3. 松开 I_Btn1（验证置位保持）',
        durationMs: 350,
        inputs: { I_Btn1: false, I_Btn2: false, I_Stop_NC: true },
        expectAtEnd: { Q_Valve: true },
      },
      {
        label: '4. 点按 I_Btn2 复位',
        durationMs: 250,
        inputs: { I_Btn1: false, I_Btn2: true, I_Stop_NC: true },
        expectAtEnd: { Q_Valve: false },
      },
      {
        label: '5. 松开 I_Btn2（保持断开）',
        durationMs: 250,
        inputs: { I_Btn1: false, I_Btn2: false, I_Stop_NC: true },
        expectAtEnd: { Q_Valve: false },
      },
    ],
  },
  {
    id: 'lad-06-fix-double-coil',
    order: 6,
    level: '排错',
    title: '第 6 关 · 现场排错：修复双线圈覆盖事故',
    goal: '下面这段程序原本想实现“按 I_Btn1 或 I_Btn2 任意一个按钮都能启动电机 Q_Motor”，但新手写成了两个网段各自驱动 Q_Motor，导致按 I_Btn1 完全无效！请消除双线圈并让两个按钮都能独立启动电机。',
    targetOutputTag: 'Q_Motor',
    targetOutputLabel: 'Q_Motor (%Q0.0)',
    forbidDoubleCoil: true,
    hints: [
      '先删除 NW2（同一个输出 Q_Motor 的普通线圈 -( )- 在整个程序里只能出现一次！）。',
      '在 NW1 里点击「+ 添加并联自锁支路」，把 I_Btn2 的常开触点 -| |- 并联到 I_Btn1 下面，合并成逻辑“或（OR）”。',
    ],
    starterDrafts: [
      {
        id: 'ch6-nw1',
        title: '故障段 1：I_Btn1 驱动 Q_Motor（会被 NW2 覆盖！）',
        topBranch: [{ id: 'ch6-c1', kind: 'NO', tag: 'I_Btn1' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_Motor',
      },
      {
        id: 'ch6-nw2',
        title: '故障段 2：重复使用 OTE 写 Q_Motor！',
        topBranch: [{ id: 'ch6-c2', kind: 'NO', tag: 'I_Btn2' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_Motor',
      },
    ],
    referenceDrafts: [
      {
        id: 'ch6-ref1',
        title: '合并双条件为并联 OR（无双线圈冲突）',
        topBranch: [{ id: 'ch6-r1', kind: 'NO', tag: 'I_Btn1' }],
        hasParallelBranch: true,
        parallelBranch: [{ id: 'ch6-r2', kind: 'NO', tag: 'I_Btn2' }],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_Motor',
      },
    ],
    phases: [
      {
        label: '1. 两按钮均未按',
        durationMs: 200,
        inputs: { I_Btn1: false, I_Btn2: false, I_Stop_NC: true },
        expectAtEnd: { Q_Motor: false },
      },
      {
        label: '2. 仅按 I_Btn1（若存在双线圈此处必败）',
        durationMs: 350,
        inputs: { I_Btn1: true, I_Btn2: false, I_Stop_NC: true },
        expectAtEnd: { Q_Motor: true },
      },
      {
        label: '3. 仅按 I_Btn2',
        durationMs: 350,
        inputs: { I_Btn1: false, I_Btn2: true, I_Stop_NC: true },
        expectAtEnd: { Q_Motor: true },
      },
      {
        label: '4. 全部松开（应熄灭）',
        durationMs: 250,
        inputs: { I_Btn1: false, I_Btn2: false, I_Stop_NC: true },
        expectAtEnd: { Q_Motor: false },
      },
    ],
  },
  {
    id: 'lad-07-two-hand-safety',
    order: 7,
    level: '基础',
    title: '第 7 关 · 冲压机双手安全联锁（串联 AND）',
    goal: '为了防止压伤手指，只有当双手同时按住 I_Btn1 (%I0.0) 和 I_Btn2 (%I0.1)，且急停 I_Stop_NC (%I0.2) 未拍下时，电磁阀 Q_Valve (%Q0.1) 才允许动作；单手按无效！',
    targetOutputTag: 'Q_Valve',
    targetOutputLabel: 'Q_Valve (%Q0.1)',
    forbidDoubleCoil: true,
    hints: [
      '把 I_Btn1、I_Btn2 和 I_Stop_NC 三个常开触点 -| |- 依次串联在同一条主路上，再驱动 Q_Valve 普通线圈 -( )-。',
      '不要使用并联支路——串联表示“全部同时满足 (AND)”才能输出！',
    ],
    starterDrafts: [
      {
        id: 'ch7-nw1',
        title: '冲压机双手安全联锁（当前单手就能触发，危险！）',
        topBranch: [{ id: 'ch7-c1', kind: 'NO', tag: 'I_Btn1' }],
        hasParallelBranch: true,
        parallelBranch: [{ id: 'ch7-c2', kind: 'NO', tag: 'I_Btn2' }],
        seriesAfter: [{ id: 'ch7-c3', kind: 'NO', tag: 'I_Stop_NC' }],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_Valve',
      },
    ],
    referenceDrafts: [
      {
        id: 'ch7-ref1',
        title: '双手同时按住 + 急停保护驱动 Q_Valve',
        topBranch: [
          { id: 'ch7-r1', kind: 'NO', tag: 'I_Btn1' },
          { id: 'ch7-r2', kind: 'NO', tag: 'I_Btn2' },
        ],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [{ id: 'ch7-r3', kind: 'NO', tag: 'I_Stop_NC' }],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_Valve',
      },
    ],
    phases: [
      {
        label: '1. 仅左手按 I_Btn1（单手严禁动作）',
        durationMs: 250,
        inputs: { I_Btn1: true, I_Btn2: false, I_Stop_NC: true },
        expectAtEnd: { Q_Valve: false },
        mustStayFalse: ['Q_Valve'],
      },
      {
        label: '2. 仅右手按 I_Btn2（单手严禁动作）',
        durationMs: 250,
        inputs: { I_Btn1: false, I_Btn2: true, I_Stop_NC: true },
        expectAtEnd: { Q_Valve: false },
        mustStayFalse: ['Q_Valve'],
      },
      {
        label: '3. 双手同时按下（安全压下动作）',
        durationMs: 300,
        inputs: { I_Btn1: true, I_Btn2: true, I_Stop_NC: true },
        expectAtEnd: { Q_Valve: true },
      },
      {
        label: '4. 双手按住时拍下急停 I_Stop_NC=0（必须立即停）',
        durationMs: 250,
        inputs: { I_Btn1: true, I_Btn2: true, I_Stop_NC: false },
        expectAtEnd: { Q_Valve: false },
      },
    ],
  },
  {
    id: 'lad-08-alarm-latch-reset',
    order: 8,
    level: '进阶',
    title: '第 8 关 · 传感器报警锁存与复位优先',
    goal: '光电传感器 I_Sensor (%I0.3) 一旦瞬间触发，报警红灯 Q_AlarmR (%Q0.3) 必须用置位 (S) 锁存保持常亮；按下复位按钮 I_Btn2 (%I0.1) 后用复位 (R) 熄灭；两者同时为 1 时必须“复位优先”熄灭！',
    targetOutputTag: 'Q_AlarmR',
    targetOutputLabel: 'Q_AlarmR (%Q0.3)',
    forbidDoubleCoil: true,
    hints: [
      '建两个程序段：NW1 用 I_Sensor 常开驱动 Q_AlarmR 置位线圈 -(S)-；NW2 用 I_Btn2 常开驱动 Q_AlarmR 复位线圈 -(R)-。',
      '为什么 NW2 放复位就是“复位优先”？因为 OB1 从上到下扫描，后执行的复位段会覆盖前面置位段！',
    ],
    starterDrafts: [
      {
        id: 'ch8-nw1',
        title: 'NW1 传感器触发报警（目前未锁存，且缺复位段）',
        topBranch: [{ id: 'ch8-c1', kind: 'NO', tag: 'I_Sensor' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_AlarmR',
      },
    ],
    referenceDrafts: [
      {
        id: 'ch8-ref1',
        title: 'NW1 传感器触发置位锁存 Q_AlarmR (S)',
        topBranch: [{ id: 'ch8-r1', kind: 'NO', tag: 'I_Sensor' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'SET',
        coilTag: 'Q_AlarmR',
      },
      {
        id: 'ch8-ref2',
        title: 'NW2 按 I_Btn2 复位优先熄灭 Q_AlarmR (R)',
        topBranch: [{ id: 'ch8-r2', kind: 'NO', tag: 'I_Btn2' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'RESET',
        coilTag: 'Q_AlarmR',
      },
    ],
    phases: [
      {
        label: '1. 正常待机（无报警）',
        durationMs: 200,
        inputs: { I_Sensor: false, I_Btn2: false, I_Stop_NC: true },
        expectAtEnd: { Q_AlarmR: false },
      },
      {
        label: '2. 光电 I_Sensor 触发一次报警',
        durationMs: 250,
        inputs: { I_Sensor: true, I_Btn2: false, I_Stop_NC: true },
        expectAtEnd: { Q_AlarmR: true },
      },
      {
        label: '3. 异物移开 I_Sensor=0（报警灯仍须锁存常亮）',
        durationMs: 300,
        inputs: { I_Sensor: false, I_Btn2: false, I_Stop_NC: true },
        expectAtEnd: { Q_AlarmR: true },
      },
      {
        label: '4. 传感器未恢复且按住复位 I_Btn2=1（复位优先须熄灭）',
        durationMs: 250,
        inputs: { I_Sensor: true, I_Btn2: true, I_Stop_NC: true },
        expectAtEnd: { Q_AlarmR: false },
      },
    ],
  },
];

const TICK_MS = 50;

/**
 * 确定性无头梯形图验收引擎：
 * 用 50ms 步进同步跑完所有工况阶段，输出每个阶段的通过状态 + 期望/实际对比波形。
 */
export function runLadderChallengeTestBench(
  challenge: LadderChallenge,
  program: LadderProgram,
  tagDefs: TagDef[],
): ChallengeVerifyReport {
  const tags: Record<string, TagValue> = {};
  for (const d of tagDefs) {
    tags[d.name] = d.init !== undefined ? d.init : d.type === 'Bool' ? false : 0;
  }
  const internal = createLadderInternalState();

  const xref = analyzeProgramCrossRef(program, tagDefs);
  const hasDoubleCoil = xref.errorCount > 0;
  const doubleCoilBlocked = Boolean(challenge.forbidDoubleCoil && hasDoubleCoil);

  const phaseResults: PhaseVerifyResult[] = [];
  const waveform: WaveformPoint[] = [];
  let elapsedMs = 0;
  let cycle = 0;

  challenge.phases.forEach((phase, phaseIdx) => {
    const ticks = Math.max(1, Math.round(phase.durationMs / TICK_MS));
    let bothOnViolated = false;
    let earlyOnTag: string | null = null;

    for (let t = 0; t < ticks; t += 1) {
      cycle += 1;
      elapsedMs += TICK_MS;

      // 1. 注入本阶段物理输入
      for (const [k, v] of Object.entries(phase.inputs)) {
        tags[k] = v;
      }

      // 2. 执行完整 OB1 扫描
      evaluateLadderProgram(program, tags, tagDefs, internal, TICK_MS, {
        cycle,
        phase: 'PIQ_FLUSH',
        piiCaptured: {},
        piqFlushed: {},
        durationMs: 0.1,
      });

      if (phase.mustNotBothBeOn) {
        const [a, b] = phase.mustNotBothBeOn;
        if (Boolean(tags[a]) && Boolean(tags[b])) {
          bothOnViolated = true;
        }
      }
      if (phase.mustStayFalse) {
        for (const tag of phase.mustStayFalse) {
          if (Boolean(tags[tag])) {
            earlyOnTag = tag;
          }
        }
      }

      const expectedTarget =
        challenge.targetOutputTag in phase.expectAtEnd
          ? Boolean(phase.expectAtEnd[challenge.targetOutputTag])
          : Boolean(tags[challenge.targetOutputTag]);

      waveform.push({
        timeMs: elapsedMs,
        phaseIndex: phaseIdx,
        expected: expectedTarget,
        actual: Boolean(tags[challenge.targetOutputTag]),
      });
    }

    // 校验本阶段终态期望
    const mismatches: string[] = [];
    const expectedParts: string[] = [];
    const actualParts: string[] = [];

    for (const [outTag, expVal] of Object.entries(phase.expectAtEnd)) {
      const actVal = Boolean(tags[outTag]);
      expectedParts.push(`${outTag}=${expVal ? '1' : '0'}`);
      actualParts.push(`${outTag}=${actVal ? '1' : '0'}`);
      if (actVal !== expVal) {
        mismatches.push(`期望 ${outTag}=${expVal ? '1' : '0'}，实际为 ${actVal ? '1' : '0'}`);
      }
    }

    if (phase.mustNotBothBeOn) {
      const [a, b] = phase.mustNotBothBeOn;
      expectedParts.push(`${a} 与 ${b} 不同时为 1`);
      actualParts.push(`${a}=${tags[a] ? '1' : '0'}, ${b}=${tags[b] ? '1' : '0'}`);
      if (bothOnViolated) {
        mismatches.push(`严重冲突：${a} 与 ${b} 同时为 1（缺少互锁！）`);
      }
    }

    if (earlyOnTag) {
      mismatches.push(`${earlyOnTag} 在延时未满前就提前变成了 1`);
    }

    phaseResults.push({
      label: phase.label,
      passed: mismatches.length === 0,
      expectedSummary: expectedParts.join(' · ') || '满足安全约束',
      actualSummary: actualParts.join(' · ') || `${challenge.targetOutputTag}=${tags[challenge.targetOutputTag] ? '1' : '0'}`,
      reason: mismatches.join('；') || undefined,
    });
  });

  const passedPhases = phaseResults.filter((p) => p.passed).length;
  const passed = !doubleCoilBlocked && passedPhases === phaseResults.length;

  let summary = '';
  if (passed) {
    summary = `全部 ${phaseResults.length} 组工况时序验收通过！逻辑完全符合工业要求。`;
  } else if (doubleCoilBlocked) {
    summary = `检测到双线圈冲突（同一输出被多个普通线圈重复写入），请先合并或删除重复网段再验收。`;
  } else {
    const firstFail = phaseResults.find((p) => !p.passed);
    summary = `通过 ${passedPhases}/${phaseResults.length} 组工况。首个未通过：${firstFail?.label}（${firstFail?.reason}）`;
  }

  return {
    challengeId: challenge.id,
    passed,
    doubleCoilBlocked,
    passedPhases,
    totalPhases: phaseResults.length,
    summary,
    phases: phaseResults,
    waveform,
    targetOutputLabel: challenge.targetOutputLabel,
  };
}
