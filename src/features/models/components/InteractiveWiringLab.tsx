import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Lightbulb,
  Power,
  RotateCcw,
  Trash2,
  Zap,
} from 'lucide-react';
import { haptic } from '../../../app/native/platform';

interface TerminalDef {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  group: 'psu' | 'field' | 'di' | 'dq';
  colorHint: string;
}

interface WireEdge {
  id: string;
  from: string;
  to: string;
  color: string;
}

interface WiringLevel {
  id: string;
  order: number;
  title: string;
  badge: string;
  goal: string;
  hint: string;
  terminals: TerminalDef[];
  solutionWires: Array<[string, string]>;
  testPrompt: string;
}

const STORAGE_KEY = 'plc_wiring_lab_v32';

function loadPassed(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function savePassed(id: string): string[] {
  const prev = loadPassed();
  if (prev.includes(id)) return prev;
  const next = [...prev, id];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

const WIRING_LEVELS: WiringLevel[] = [
  {
    id: 'wire-1-pnp-di',
    order: 1,
    title: '第 1 关：接通漏型输入回路（按 SB1 点亮 %I0.0）',
    badge: '必会入门',
    goal: '把 24V 电源正极 (L+) 接到按钮 SB1 一端，按钮另一端接到 PLC 的 %I0.0；别忘了把公共端 1M 接到 0V (M) 形成闭合回路！',
    hint: '共 3 根线：① L+ → SB1-左；② SB1-右 → %I0.0；③ 1M → M (0V)。漏接 1M 时光耦不导通！',
    testPrompt: '连好线后，点击下方【按住测试 SB1】，看到 CPU 面板 %I0.0 绿灯亮起即通关！',
    terminals: [
      { id: 'PSU_L+', label: 'L+ (+24V)', sub: '电源正极', x: 74, y: 74, group: 'psu', colorHint: '#ef4444' },
      { id: 'PSU_M', label: 'M (0V)', sub: '电源负极', x: 74, y: 158, group: 'psu', colorHint: '#3b82f6' },
      { id: 'SB1_A', label: 'SB1 进线', sub: '常开按钮左端', x: 242, y: 74, group: 'field', colorHint: '#f59e0b' },
      { id: 'SB1_B', label: 'SB1 出线', sub: '常开按钮右端', x: 320, y: 74, group: 'field', colorHint: '#10b981' },
      { id: 'CPU_1M', label: '1M 公共端', sub: 'DI 组参考地', x: 472, y: 74, group: 'di', colorHint: '#38bdf8' },
      { id: 'CPU_I00', label: '%I0.0', sub: '数字量输入 0', x: 556, y: 74, group: 'di', colorHint: '#10b981' },
    ],
    solutionWires: [
      ['PSU_L+', 'SB1_A'],
      ['SB1_B', 'CPU_I00'],
      ['CPU_1M', 'PSU_M'],
    ],
  },
  {
    id: 'wire-2-full-io',
    order: 2,
    title: '第 2 关：完整输入 + 输出回路（按 SB1 点亮灯 HL1）',
    badge: '电柜完整回路',
    goal: '先接通输入回路（L+ → SB1 → %I0.0 且 1M → M），再给 PLC 底部输出区 3L+ 供 +24V，并从 %Q0.0 经指示灯 HL1 回到 0V (M)！',
    hint: '共 6 根线：输入 3 根（L+→SB1进，SB1出→%I0.0，1M→M）+ 输出 3 根（L+→3L+，%Q0.0→HL1进，HL1出→M）。',
    testPrompt: '连好后按住【按住测试 SB1】：必须同时点亮 %I0.0 输入灯和现场指示灯 HL1 即通关！',
    terminals: [
      { id: 'PSU_L+', label: 'L+ (+24V)', sub: '电源正极', x: 72, y: 66, group: 'psu', colorHint: '#ef4444' },
      { id: 'PSU_M', label: 'M (0V)', sub: '电源负极', x: 72, y: 196, group: 'psu', colorHint: '#3b82f6' },
      { id: 'SB1_A', label: 'SB1 进', sub: '启动按钮', x: 218, y: 66, group: 'field', colorHint: '#f59e0b' },
      { id: 'SB1_B', label: 'SB1 出', sub: '启动按钮', x: 294, y: 66, group: 'field', colorHint: '#10b981' },
      { id: 'CPU_1M', label: '1M', sub: 'DI 公共端', x: 468, y: 66, group: 'di', colorHint: '#38bdf8' },
      { id: 'CPU_I00', label: '%I0.0', sub: 'PLC 输入', x: 556, y: 66, group: 'di', colorHint: '#10b981' },
      { id: 'CPU_3L+', label: '3L+', sub: 'DQ 输出电源', x: 468, y: 196, group: 'dq', colorHint: '#ef4444' },
      { id: 'CPU_Q00', label: '%Q0.0', sub: 'PLC 输出', x: 556, y: 196, group: 'dq', colorHint: '#f59e0b' },
      { id: 'HL1_A', label: 'HL1 正', sub: '指示灯 X1', x: 294, y: 196, group: 'field', colorHint: '#f59e0b' },
      { id: 'HL1_B', label: 'HL1 负', sub: '指示灯 X2', x: 218, y: 196, group: 'field', colorHint: '#3b82f6' },
    ],
    solutionWires: [
      ['PSU_L+', 'SB1_A'],
      ['SB1_B', 'CPU_I00'],
      ['CPU_1M', 'PSU_M'],
      ['PSU_L+', 'CPU_3L+'],
      ['CPU_Q00', 'HL1_A'],
      ['HL1_B', 'PSU_M'],
    ],
  },
  {
    id: 'wire-3-npn-sensor',
    order: 3,
    title: '第 3 关：日系 NPN 三线光电传感器源型接线',
    badge: '易错进阶',
    goal: '现场买回一只 NPN 光电传感器（棕=电源+，蓝=电源-，黑=触发时输出 0V 低电平）。请正确接好三根线，并把 1M 公共端接到正确的极性！',
    hint: '棕→L+，蓝→M，黑→%I0.1；关键：因为 NPN 触发输出 0V，所以 1M 必须反过来接到 L+ (+24V) 才有 24V 压差！',
    testPrompt: '连好后点【放入工件触发 BG1】，看到 %I0.1 绿灯亮起且无短路跳闸即通关！',
    terminals: [
      { id: 'PSU_L+', label: 'L+ (+24V)', sub: '电源正极', x: 74, y: 68, group: 'psu', colorHint: '#ef4444' },
      { id: 'PSU_M', label: 'M (0V)', sub: '电源负极', x: 74, y: 192, group: 'psu', colorHint: '#3b82f6' },
      { id: 'BG1_BN', label: '棕线 BN', sub: '传感器 +24V', x: 248, y: 74, group: 'field', colorHint: '#b45309' },
      { id: 'BG1_BK', label: '黑线 BK', sub: 'NPN 输出 0V', x: 248, y: 132, group: 'field', colorHint: '#94a3b8' },
      { id: 'BG1_BU', label: '蓝线 BU', sub: '传感器 0V', x: 248, y: 190, group: 'field', colorHint: '#3b82f6' },
      { id: 'CPU_1M', label: '1M 公共端', sub: '源型要接哪?', x: 472, y: 74, group: 'di', colorHint: '#38bdf8' },
      { id: 'CPU_I01', label: '%I0.1', sub: '光电输入点', x: 556, y: 132, group: 'di', colorHint: '#10b981' },
    ],
    solutionWires: [
      ['PSU_L+', 'BG1_BN'],
      ['PSU_M', 'BG1_BU'],
      ['BG1_BK', 'CPU_I01'],
      ['CPU_1M', 'PSU_L+'],
    ],
  },
];

function wireKey(a: string, b: string): string {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

function pickWireColor(a: string, b: string): string {
  const pair = `${a} ${b}`;
  if (pair.includes('PSU_L+') || pair.includes('3L+') || pair.includes('BG1_BN')) return '#ef4444';
  if (pair.includes('PSU_M') || pair.includes('BG1_BU')) return '#38bdf8';
  if (pair.includes('BG1_BK')) return '#a78bfa';
  return '#10b981';
}

function buildAdjacency(wires: WireEdge[], extraLinks: Array<[string, string]>): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const add = (u: string, v: string) => {
    if (!adj.has(u)) adj.set(u, new Set());
    if (!adj.has(v)) adj.set(v, new Set());
    adj.get(u)!.add(v);
    adj.get(v)!.add(u);
  };
  for (const w of wires) add(w.from, w.to);
  for (const [u, v] of extraLinks) add(u, v);
  return adj;
}

function getReachable(adj: Map<string, Set<string>>, start: string): Set<string> {
  const seen = new Set<string>([start]);
  const stack = [start];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const nxt of adj.get(cur) ?? []) {
      if (!seen.has(nxt)) {
        seen.add(nxt);
        stack.push(nxt);
      }
    }
  }
  return seen;
}

export const InteractiveWiringLab: React.FC = () => {
  const [levelIdx, setLevelIdx] = useState(0);
  const [wires, setWires] = useState<WireEdge[]>([]);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [breakerClosed, setBreakerClosed] = useState(true);
  const [sb1Held, setSb1Held] = useState(false);
  const [sensorOn, setSensorOn] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [passedIds, setPassedIds] = useState<string[]>(() => loadPassed());

  const level = WIRING_LEVELS[levelIdx];
  const termMap = useMemo(() => new Map(level.terminals.map((t) => [t.id, t])), [level.terminals]);

  // 真实电路拓扑求值（含短路保护 + 光耦双端压差 + 传感器供电 + 3L+ 供电校验）
  const circuit = useMemo(() => {
    const extra: Array<[string, string]> = [];
    if (sb1Held && termMap.has('SB1_A') && termMap.has('SB1_B')) {
      extra.push(['SB1_A', 'SB1_B']);
    }

    // 第一遍拓扑：判断纯导线/开关是否把 L+ 直接短接到 M
    const baseAdj = buildAdjacency(wires, extra);
    const plusNodes = getReachable(baseAdj, 'PSU_L+');
    const minusNodes = getReachable(baseAdj, 'PSU_M');

    const directShort = plusNodes.has('PSU_M');

    // 检查 NPN 传感器是否供电并触发（NPN 触发时黑线拉到 0V，注意若黑线直接短接 L+ 也会触发短路！）
    const bgPowered = plusNodes.has('BG1_BN') && minusNodes.has('BG1_BU');
    const bgActive = bgPowered && sensorOn;
    if (bgActive) {
      extra.push(['BG1_BK', 'PSU_M']);
    }

    const adjWithSensor = buildAdjacency(wires, extra);
    const plus2 = getReachable(adjWithSensor, 'PSU_L+');
    const minus2 = getReachable(adjWithSensor, 'PSU_M');
    const shorted = directShort || plus2.has('PSU_M');

    const energized = breakerClosed && !shorted;

    // 某节点电位：'+' | '-' | null
    const potential = (id: string): '+' | '-' | null => {
      if (!energized) return null;
      if (plus2.has(id)) return '+';
      if (minus2.has(id)) return '-';
      return null;
    };

    const p1M = potential('CPU_1M');
    const pI00 = potential('CPU_I00');
    const pI01 = potential('CPU_I01');

    const i00On = Boolean(p1M && pI00 && p1M !== pI00);
    const i01On = Boolean(p1M && pI01 && p1M !== pI01);

    // Level 2：PLC 内部程序把 %I0.0 映射到 %Q0.0；若 3L+ 接通 +24V，则 %Q0.0 输出 +24V
    const p3L = potential('CPU_3L+');
    const q00Has24V = i00On && p3L === '+';
    let hl1On = false;
    let q00Shorted = false;
    if (q00Has24V && termMap.has('CPU_Q00')) {
      const qReach = getReachable(adjWithSensor, 'CPU_Q00');
      if (qReach.has('PSU_M')) {
        q00Shorted = true;
      } else {
        const hlA = qReach.has('HL1_A') ? '+' : potential('HL1_A');
        const hlB = qReach.has('HL1_B') ? '+' : potential('HL1_B');
        hl1On = Boolean(hlA && hlB && hlA !== hlB);
      }
    }

    const totalShorted = shorted || q00Shorted;

    // 智能电工诊断提示
    let diagnosis = '点击任意两个接线端子即可拉出一根导线；点击已有导线可拆除。';
    let diagTone: 'info' | 'ok' | 'warn' | 'err' = 'info';

    if (totalShorted) {
      diagnosis =
        '⚡ 检测到 24V 正负极直接短路（无负载直连）！空开 QF1 已瞬时跳闸断电保护。请点击拆除短路导线后再点「合闸复位」！';
      diagTone = 'err';
    } else if (!breakerClosed) {
      diagnosis = '断路器 QF1 当前处于分闸断电状态（接线最安全！），连好线后点上方「合闸通电」测试。';
      diagTone = 'warn';
    } else if (level.id === 'wire-1-pnp-di') {
      if (i00On) {
        diagnosis = '🎉 接线完全正确！+24V 经 SB1 进入 %I0.0，再从 1M 流回 0V (M)，双向光耦导通，%I0.0 输入绿灯已点亮！';
        diagTone = 'ok';
      } else if (sb1Held && pI00 === '+' && !p1M) {
        diagnosis = '⚠️ 差一步！按钮已经把 +24V 送到 %I0.0 了，但公共端 1M 还悬空没接到 0V (M)，电流形不成闭合回路！';
        diagTone = 'warn';
      } else if (sb1Held && pI00 === '+' && p1M === '+') {
        diagnosis = '⚠️ 极性错了！%I0.0 和 1M 两端现在都是 +24V（没有压差），请把 1M 改接到 0V (M)！';
        diagTone = 'warn';
      } else if (wires.length >= 3 && !sb1Held) {
        diagnosis = '线路已就绪，现在点击下方「按住测试 SB1」验收输入灯是否点亮！';
        diagTone = 'info';
      }
    } else if (level.id === 'wire-2-full-io') {
      if (i00On && hl1On) {
        diagnosis = '🎉 完美通关！输入回路点亮 %I0.0，CPU 通过 3L+ 驱动 %Q0.0，电流经指示灯 HL1 回到 M，全回路导通！';
        diagTone = 'ok';
      } else if (i00On && !p3L) {
        diagnosis = '⚠️ 输入 %I0.0 已经亮了，但现场灯 HL1 没亮：检查底部输出电源端 3L+ 是否已经接到 +24V (L+)！';
        diagTone = 'warn';
      } else if (i00On && p3L === '+' && !hl1On) {
        diagnosis = '⚠️ %Q0.0 已有 +24V 输出，请把 %Q0.0 接到 HL1 一端，另一端回 0V (M)！';
        diagTone = 'warn';
      } else if (sb1Held && pI00 === '+' && !p1M) {
        diagnosis = '⚠️ 输入回路还没闭合：请把 1M 公共端接到 0V (M)！';
        diagTone = 'warn';
      }
    } else if (level.id === 'wire-3-npn-sensor') {
      if (i01On) {
        diagnosis = '🎉 源型接线通关！1M 接 +24V，NPN 传感器触发时黑线拉低至 0V，电流从 1M 流向 %I0.1 再回传感器负极，%I0.1 成功点亮！';
        diagTone = 'ok';
      } else if (sensorOn && !bgPowered) {
        diagnosis = '⚠️ 光电传感器还没通电：请确保棕线 (BN) 接 +24V (L+)、蓝线 (BU) 接 0V (M)！';
        diagTone = 'warn';
      } else if (sensorOn && bgPowered && pI01 === '-' && p1M === '-') {
        diagnosis = '⚠️ 极性接反了！NPN 黑线触发时输出 0V，现在 1M 也接在 0V (M)（两边都是 0V 没压差），请把 1M 改接到 +24V (L+)！';
        diagTone = 'warn';
      } else if (sensorOn && bgPowered && pI01 === '-' && !p1M) {
        diagnosis = '⚠️ 黑线已把 0V 送到 %I0.1，但 1M 公共端还悬空！NPN 传感器请把 1M 接到 +24V (L+)。';
        diagTone = 'warn';
      }
    }

    const levelPassed =
      !totalShorted &&
      ((level.id === 'wire-1-pnp-di' && i00On) ||
        (level.id === 'wire-2-full-io' && i00On && hl1On) ||
        (level.id === 'wire-3-npn-sensor' && i01On));

    return {
      shorted: totalShorted,
      energized: breakerClosed && !totalShorted,
      i00On,
      i01On,
      q00Has24V: q00Has24V && !totalShorted,
      hl1On: hl1On && !totalShorted,
      bgPowered: bgPowered && breakerClosed && !totalShorted,
      diagnosis,
      diagTone,
      levelPassed,
    };
  }, [wires, sb1Held, sensorOn, breakerClosed, level.id, termMap]);

  // 通关自动记入本机勋章
  React.useEffect(() => {
    if (circuit.levelPassed && !passedIds.includes(level.id)) {
      haptic('success');
      setPassedIds(savePassed(level.id));
    }
  }, [circuit.levelPassed, level.id, passedIds]);

  const handleTerminalClick = (termId: string) => {
    haptic('tap');
    if (!pendingFrom) {
      setPendingFrom(termId);
      return;
    }
    if (pendingFrom === termId) {
      setPendingFrom(null);
      return;
    }
    const key = wireKey(pendingFrom, termId);
    setWires((prev) => {
      if (prev.some((w) => w.id === key)) {
        return prev.filter((w) => w.id !== key);
      }
      return [...prev, { id: key, from: pendingFrom, to: termId, color: pickWireColor(pendingFrom, termId) }];
    });
    setPendingFrom(null);
  };

  const switchLevel = (idx: number) => {
    haptic('tap');
    setLevelIdx(idx);
    setWires([]);
    setPendingFrom(null);
    setBreakerClosed(true);
    setSb1Held(false);
    setSensorOn(false);
    setShowHint(false);
  };

  const applySolution = () => {
    haptic('success');
    setBreakerClosed(true);
    setPendingFrom(null);
    setWires(
      level.solutionWires.map(([a, b]) => ({
        id: wireKey(a, b),
        from: a,
        to: b,
        color: pickWireColor(a, b),
      })),
    );
  };

  return (
    <div className="v32-wlab-root" aria-label="S7-1200 点对点端子拉线闯关盘">
      <div className="v32-wlab-top">
        <div>
          <div className="v32-wlab-kicker">
            <Zap size={13} /> 亲手点端子拉线实训 · 支持真实 24V 短路跳闸与 1M 回路诊断
          </div>
          <h3 className="v32-wlab-title">{level.title}</h3>
          <p className="v32-wlab-goal">{level.goal}</p>
        </div>
        <div className="v32-wlab-badge">
          <Award size={15} />
          接线通关：{passedIds.length} / {WIRING_LEVELS.length}
        </div>
      </div>

      {/* 关卡切换胶囊 */}
      <div className="v32-wlab-levels" role="tablist" aria-label="接线关卡选择">
        {WIRING_LEVELS.map((lv, idx) => {
          const done = passedIds.includes(lv.id);
          return (
            <button
              key={lv.id}
              type="button"
              role="tab"
              aria-selected={idx === levelIdx}
              className={`v32-wlab-lvbtn${idx === levelIdx ? ' active' : ''}${done ? ' is-done' : ''}`}
              onClick={() => switchLevel(idx)}
            >
              <span>第 {lv.order} 关</span>
              <strong>{lv.badge}</strong>
              {done && <CheckCircle2 size={14} />}
            </button>
          );
        })}
      </div>

      {/* 交互式接线画布 SVG */}
      <div className="v32-wlab-stage-wrap">
        <svg
          viewBox="0 0 640 262"
          width="100%"
          style={{ height: 'auto', display: 'block', minWidth: 520 }}
          role="img"
          aria-label="S7-1200 端子排互动接线画布"
        >
          {/* 三个设备区域背板 */}
          <rect x="16" y="18" width="124" height="224" rx="12" fill="#131c27" stroke={circuit.shorted ? '#ef4444' : '#2a3d52'} strokeWidth={circuit.shorted ? 2.2 : 1.2} />
          <text x="78" y="39" textAnchor="middle" fill="#cbd5e1" fontSize="11.5" fontWeight="700">
            DC 24V 电源 & QF1
          </text>
          <rect
            x="38"
            y="102"
            width="80"
            height="28"
            rx="6"
            fill={circuit.shorted ? 'rgba(239,68,68,0.28)' : breakerClosed ? 'rgba(16,185,129,0.22)' : 'rgba(148,163,184,0.16)'}
            stroke={circuit.shorted ? '#ef4444' : breakerClosed ? '#10b981' : '#64748b'}
          />
          <text x="78" y="120" textAnchor="middle" fill="#f8fafc" fontSize="11" fontWeight="700">
            {circuit.shorted ? '⚡ QF1 跳闸' : breakerClosed ? 'QF1 已合闸' : 'QF1 已断电'}
          </text>

          {/* 中间现场元件区 */}
          <rect x="164" y="18" width="212" height="224" rx="12" fill="#101823" stroke="#25364a" strokeWidth="1.2" />
          <text x="270" y="39" textAnchor="middle" fill="#9fb3c8" fontSize="11.5" fontWeight="700">
            {level.id === 'wire-3-npn-sensor' ? '现场 NPN 三线光电传感器 BG1' : '现场控制柜元件（按钮 / 指示灯）'}
          </text>

          {/* SB1 按钮图形 */}
          {termMap.has('SB1_A') && (
            <g>
              <line
                x1="242"
                y1="74"
                x2="320"
                y2={sb1Held ? 74 : 58}
                stroke={sb1Held ? '#10b981' : '#f59e0b'}
                strokeWidth="3"
                strokeLinecap="round"
              />
              <text x="281" y="108" textAnchor="middle" fill={sb1Held ? '#34d399' : '#94a3b8'} fontSize="10.5" fontWeight="600">
                {sb1Held ? 'SB1 已按下（导通）' : 'SB1 常开（未按下）'}
              </text>
            </g>
          )}

          {/* HL1 指示灯图形 */}
          {termMap.has('HL1_A') && (
            <g>
              <circle
                cx="256"
                cy="196"
                r="17"
                fill={circuit.hl1On ? 'rgba(16,185,129,0.35)' : '#1a2533'}
                stroke={circuit.hl1On ? '#34d399' : '#475569'}
                strokeWidth="2.2"
              />
              <text x="256" y="200" textAnchor="middle" fill={circuit.hl1On ? '#6ee7b7' : '#94a3b8'} fontSize="10.5" fontWeight="800">
                HL1
              </text>
              <text x="256" y="230" textAnchor="middle" fill={circuit.hl1On ? '#34d399' : '#94a3b8'} fontSize="10.5" fontWeight="600">
                {circuit.hl1On ? '指示灯已点亮！' : '指示灯未亮'}
              </text>
            </g>
          )}

          {/* BG1 传感器本体 */}
          {termMap.has('BG1_BN') && (
            <g>
              <rect x="278" y="66" width="84" height="132" rx="10" fill="#182331" stroke={circuit.bgPowered ? '#14b8a6' : '#334155'} strokeWidth="1.6" />
              <text x="320" y="96" textAnchor="middle" fill="#e2e8f0" fontSize="11.5" fontWeight="700">
                NPN 光电
              </text>
              <circle cx="320" cy="124" r="10" fill={circuit.bgPowered ? (sensorOn ? '#f59e0b' : '#10b981') : '#334155'} />
              <text x="320" y="152" textAnchor="middle" fill="#94a3b8" fontSize="10">
                {circuit.bgPowered ? (sensorOn ? '感应到工件!' : '已通电待机') : '未通 24V 电'}
              </text>
              <text x="320" y="170" textAnchor="middle" fill="#a78bfa" fontSize="9.5">
                触发→黑线=0V
              </text>
            </g>
          )}

          {/* 右侧 S7-1200 CPU 本体 */}
          <rect x="404" y="18" width="220" height="224" rx="12" fill="#131e2a" stroke="#008585" strokeWidth="1.6" />
          <rect x="404" y="18" width="220" height="28" rx="10" fill="#007a7a" />
          <text x="514" y="37" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="700">
            SIEMENS CPU 1214C 端子排
          </text>

          {/* CPU 状态 LED 灯珠 */}
          <g transform="translate(422, 114)">
            <rect width="184" height="46" rx="8" fill="#0b1118" stroke="#223244" />
            <circle cx="24" cy="23" r="6" fill={circuit.i00On ? '#10b981' : '#263547'} />
            <text x="37" y="27" fill={circuit.i00On ? '#34d399' : '#8da2b8'} fontSize="11" fontWeight="700">
              %I0.0
            </text>
            <circle cx="88" cy="23" r="6" fill={circuit.i01On ? '#10b981' : '#263547'} />
            <text x="101" y="27" fill={circuit.i01On ? '#34d399' : '#8da2b8'} fontSize="11" fontWeight="700">
              %I0.1
            </text>
            <circle cx="148" cy="23" r="6" fill={circuit.q00Has24V ? '#f59e0b' : '#263547'} />
            <text x="160" y="27" fill={circuit.q00Has24V ? '#fbbf24' : '#8da2b8'} fontSize="11" fontWeight="700">
              Q0
            </text>
          </g>

          {/* 已拉好的导线（可点击拆除） */}
          {wires.map((w, idx) => {
            const a = termMap.get(w.from);
            const b = termMap.get(w.to);
            if (!a || !b) return null;
            const midX = (a.x + b.x) / 2;
            const arch = (idx % 2 === 0 ? -24 : 24) - (Math.abs(a.y - b.y) < 12 ? 18 : 0);
            const midY = (a.y + b.y) / 2 + arch;
            const pathD = `M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`;
            return (
              <g
                key={w.id}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  haptic('tap');
                  setWires((prev) => prev.filter((item) => item.id !== w.id));
                }}
              >
                <title>点击拆除导线：{a.label} ↔ {b.label}</title>
                <path d={pathD} fill="none" stroke="transparent" strokeWidth="14" />
                <path
                  d={pathD}
                  fill="none"
                  stroke={circuit.shorted ? '#ef4444' : w.color}
                  strokeWidth={circuit.shorted ? '3.5' : '3'}
                  strokeDasharray={circuit.shorted ? '6 4' : undefined}
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {/* 可点击接线端子圆点 */}
          {level.terminals.map((t) => {
            const isPicked = pendingFrom === t.id;
            const connected = wires.some((w) => w.from === t.id || w.to === t.id);
            return (
              <g
                key={t.id}
                style={{ cursor: 'pointer' }}
                onClick={() => handleTerminalClick(t.id)}
              >
                <circle
                  cx={t.x}
                  cy={t.y}
                  r={isPicked ? 14 : 11}
                  fill={isPicked ? 'rgba(20,184,166,0.32)' : connected ? 'rgba(16,185,129,0.18)' : '#1e293b'}
                  stroke={isPicked ? '#2dd4bf' : t.colorHint}
                  strokeWidth={isPicked ? '2.6' : '2'}
                />
                <circle cx={t.x} cy={t.y} r="4" fill={isPicked ? '#5eead4' : '#e2e8f0'} />
                <text x={t.x} y={t.y - 16} textAnchor="middle" fill="#f1f5f9" fontSize="10.5" fontWeight="700">
                  {t.label}
                </text>
                <text x={t.x} y={t.y + 23} textAnchor="middle" fill="#8ca3ba" fontSize="9">
                  {t.sub}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 底部操作与测试条 */}
      <div className="v32-wlab-controls">
        <div className="v32-wlab-actions">
          {level.id !== 'wire-3-npn-sensor' ? (
            <button
              type="button"
              className={`dt-btn ${sb1Held ? 'dt-btn--success' : 'dt-btn--primary'}`}
              onClick={() => {
                haptic('press');
                setSb1Held((v) => !v);
              }}
            >
              <Power size={14} />
              {sb1Held ? '松开 SB1（当前已按下）' : '按下测试 SB1 按钮'}
            </button>
          ) : (
            <button
              type="button"
              className={`dt-btn ${sensorOn ? 'dt-btn--success' : 'dt-btn--primary'}`}
              onClick={() => {
                haptic('press');
                setSensorOn((v) => !v);
              }}
            >
              <Zap size={14} />
              {sensorOn ? '移开工件（当前触发中）' : '放入工件触发 BG1'}
            </button>
          )}

          <button
            type="button"
            className={`dt-btn ${!breakerClosed || circuit.shorted ? 'dt-btn--danger' : ''}`}
            onClick={() => {
              haptic('tap');
              setBreakerClosed((v) => !v);
            }}
          >
            {breakerClosed ? '拉下空开 QF1（断电接线）' : '合上空开 QF1（上电试车）'}
          </button>

          <button type="button" className="dt-btn" onClick={() => setShowHint((v) => !v)}>
            <Lightbulb size={14} />
            {showHint ? '隐藏接线提示' : '看接线提示'}
          </button>

          <button type="button" className="dt-btn" onClick={applySolution}>
            一键演示正确接法
          </button>

          <button
            type="button"
            className="dt-btn"
            onClick={() => {
              setWires([]);
              setPendingFrom(null);
              setSb1Held(false);
              setSensorOn(false);
            }}
          >
            <Trash2 size={14} />
            清空导线 ({wires.length})
          </button>
        </div>

        <div className={`v32-wlab-diag tone-${circuit.diagTone}`} role="status" aria-live="polite">
          {circuit.diagTone === 'err' && <AlertTriangle size={16} />}
          {circuit.diagTone === 'ok' && <CheckCircle2 size={16} />}
          <span>
            {pendingFrom
              ? `已选中起点【${termMap.get(pendingFrom)?.label}】，请再点目标端子完成拉线（再点自己取消）。`
              : circuit.diagnosis}
          </span>
        </div>

        {showHint && (
          <div className="v32-wlab-hint">
            <strong>电工师傅接线口诀：</strong>
            {level.hint}
            <div style={{ marginTop: 4, opacity: 0.9 }}>验收步骤：{level.testPrompt}</div>
          </div>
        )}

        {circuit.levelPassed && levelIdx < WIRING_LEVELS.length - 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="dt-btn dt-btn--primary" onClick={() => switchLevel(levelIdx + 1)}>
              <RotateCcw size={14} style={{ display: 'none' }} />
              挑战下一关：{WIRING_LEVELS[levelIdx + 1].badge} →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
