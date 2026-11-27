import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flame, Gauge, Waves } from 'lucide-react';
import type { PlcRuntime } from '../../types/plc';
import {
  TwinShell,
  type FaultSwitchItem,
  type IoSignalItem,
  type ParamSliderItem,
  type TwinControlMode,
} from './components/TwinShell';

export interface TankPressurePidProps {
  runtime?: PlcRuntime;
  embedded?: boolean;
}

interface TrendPoint {
  sp: number;
  pv: number;
  out: number;
}

const MAX_TREND = 72;

export const TankPressurePidTwin: React.FC<TankPressurePidProps> = ({ embedded = false }) => {
  const [mode, setMode] = useState<TwinControlMode>('auto');
  const [paused, setPaused] = useState(false);

  // Process setpoints & physical parameters
  const [setpointPct, setSetpointPct] = useState(65); // Target level 65% (equiv ~0.45 MPa)
  const [loadValvePct, setLoadValvePct] = useState(42); // Outlet demand disturbance 5~95%
  const [pidKp, setPidKp] = useState(2.6);
  const [heaterEnabled, setHeaterEnabled] = useState(true);

  // Field faults
  const [faultWireBreak, setFaultWireBreak] = useState(false); // 4-20mA sensor wire break (%IW64 < 0)
  const [faultHighHigh, setFaultHighHigh] = useState(false); // HH overflow switch triggered
  const [faultPump1Trip, setFaultPump1Trip] = useState(false); // Main pump P1 overload

  // Manual force overrides
  const [manualOut, setManualOut] = useState({ p1Pct: 55, p2On: false, heaterOn: false });

  // Live rendered physical state
  const [levelPct, setLevelPct] = useState(52);
  const [tempC, setTempC] = useState(48.5);
  const [pidOutputPct, setPidOutputPct] = useState(45);
  const [pump2Running, setPump2Running] = useState(false);
  const [heaterActive, setHeaterActive] = useState(false);
  const [impeller1Deg, setImpeller1Deg] = useState(0);
  const [impeller2Deg, setImpeller2Deg] = useState(0);
  const [wavePhase, setWavePhase] = useState(0);
  const [trend, setTrend] = useState<TrendPoint[]>(() =>
    Array.from({ length: 30 }, () => ({ sp: 65, pv: 52, out: 45 }))
  );

  // ODE & PID internal accumulator ref
  const physRef = useRef({
    level: 52,
    temp: 48.5,
    integral: 18,
    prevErr: 0,
    p2HighTimer: 0,
    p2LowTimer: 0,
    p2Active: false,
    heaterActive: false,
    tickCounter: 0,
  });

  // Real-time ODE integration (50ms step)
  useEffect(() => {
    if (paused) return;
    const dt = 0.05; // 50ms in seconds

    const timer = window.setInterval(() => {
      const s = physRef.current;
      s.tickCounter += 1;

      // 1. Check safety interlocks
      const hhTripped = faultHighHigh || s.level >= 90;
      const safetyTrip = faultWireBreak || hhTripped;

      // 2. PID Control Law (Auto) vs Manual Force
      let p1OutPct = 0;
      let p2On = false;
      let heatOn = false;

      if (safetyTrip) {
        p1OutPct = 0;
        p2On = false;
        heatOn = false;
        s.p2Active = false;
      } else if (mode === 'manual') {
        p1OutPct = faultPump1Trip ? 0 : manualOut.p1Pct;
        p2On = manualOut.p2On;
        heatOn = manualOut.heaterOn && s.level > 20;
      } else {
        // Discrete PI+D controller with anti-windup clamping
        const err = setpointPct - s.level;
        const ki = pidKp * 0.24;
        const kd = pidKp * 0.12;
        const deriv = (err - s.prevErr) / dt;
        s.prevErr = err;

        const tentativeI = Math.max(-20, Math.min(85, s.integral + err * dt));
        const rawOut = pidKp * err + ki * tentativeI + kd * Math.max(-15, Math.min(15, deriv));
        const clampedOut = Math.max(0, Math.min(100, rawOut));

        // Conditional integration anti-windup
        if ((clampedOut > 0 && clampedOut < 100) || (clampedOut >= 100 && err < 0) || (clampedOut <= 0 && err > 0)) {
          s.integral = tentativeI;
        }

        if (faultPump1Trip) {
          p1OutPct = 0;
          // Automatic failover to Auxiliary Pump P2 when P1 trips and level < SP
          s.p2Active = s.level < setpointPct + 2;
        } else {
          p1OutPct = clampedOut;
          // Dual-pump staging logic: bring P2 online if P1 > 86% for 2s, drop off if P1 < 35% for 2s
          if (p1OutPct > 86) {
            s.p2HighTimer += dt;
            s.p2LowTimer = 0;
            if (s.p2HighTimer >= 2.0) s.p2Active = true;
          } else if (p1OutPct < 35) {
            s.p2LowTimer += dt;
            s.p2HighTimer = 0;
            if (s.p2LowTimer >= 1.8) s.p2Active = false;
          } else {
            s.p2HighTimer = Math.max(0, s.p2HighTimer - dt);
            s.p2LowTimer = Math.max(0, s.p2LowTimer - dt);
          }
        }
        p2On = s.p2Active;

        // Thermal hysteresis controller (Target 55.0 °C, deadband ±1.5 °C, dry-burn protect Level > 20%)
        if (heaterEnabled && s.level > 20) {
          if (s.temp < 53.5) heatOn = true;
          else if (s.temp > 56.5) heatOn = false;
          else heatOn = s.heaterActive;
        }
        s.heaterActive = heatOn;
      }

      // 3. First-Order Fluid Inertia ODE: dLevel/dt = (Q_in - Q_out) / Area
      // Max P1 inflow = 16 %/s, P2 boost inflow = 11 %/s, Load valve outflow scaled by sqrt(head)
      const qInPump1 = (p1OutPct / 100) * 16.0;
      const qInPump2 = p2On ? 11.0 : 0;
      const qInFaultSurge = faultHighHigh && s.level < 94 ? 22.0 : 0;
      const qIn = qInPump1 + qInPump2 + qInFaultSurge;

      const headFactor = Math.sqrt(Math.max(8, s.level + 12) / 72);
      const qOut = (loadValvePct / 100) * 20.5 * headFactor;

      const areaCoeff = 1.65; // Tank capacitance
      const dLevel = ((qIn - qOut) / areaCoeff) * dt;
      s.level = Math.max(4, Math.min(97, s.level + dLevel));

      // 4. First-Order Thermal ODE: dT/dt = heating - ambient loss - cold makeup mixing
      const heatGain = heatOn ? 2.4 : 0;
      const ambientLoss = (s.temp - 22.0) * 0.018;
      const coldMakeupLoss = (qIn / 45) * (s.temp - 20.0) * 0.08;
      s.temp = Math.max(18, Math.min(85, s.temp + (heatGain - ambientLoss - coldMakeupLoss) * dt));

      // 5. Commit UI visual state
      setLevelPct(Number(s.level.toFixed(1)));
      setTempC(Number(s.temp.toFixed(1)));
      setPidOutputPct(Number(p1OutPct.toFixed(1)));
      setPump2Running(p2On);
      setHeaterActive(heatOn);
      setWavePhase((w) => (w + 0.22) % (Math.PI * 2));
      setImpeller1Deg((d) => (d + (p1OutPct / 100) * 28) % 360);
      setImpeller2Deg((d) => (d + (p2On ? 24 : 0)) % 360);

      // Push trend point every 250ms (5 ticks)
      if (s.tickCounter % 5 === 0) {
        setTrend((prev) => {
          const next = [
            ...prev,
            {
              sp: setpointPct,
              pv: faultWireBreak ? 0 : Number(s.level.toFixed(1)),
              out: Number(p1OutPct.toFixed(1)),
            },
          ];
          return next.length > MAX_TREND ? next.slice(next.length - MAX_TREND) : next;
        });
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, [
    paused,
    mode,
    setpointPct,
    loadValvePct,
    pidKp,
    heaterEnabled,
    faultWireBreak,
    faultHighHigh,
    faultPump1Trip,
    manualOut,
  ]);

  const handleReset = () => {
    setFaultWireBreak(false);
    setFaultHighHigh(false);
    setFaultPump1Trip(false);
    setMode('auto');
    setSetpointPct(65);
    setLoadValvePct(42);
    setPidKp(2.6);
    setHeaterEnabled(true);
    physRef.current = {
      level: 52,
      temp: 48.5,
      integral: 18,
      prevErr: 0,
      p2HighTimer: 0,
      p2LowTimer: 0,
      p2Active: false,
      heaterActive: false,
      tickCounter: 0,
    };
    setLevelPct(52);
    setTempC(48.5);
    setPidOutputPct(45);
    setPump2Running(false);
    setTrend(Array.from({ length: 30 }, () => ({ sp: 65, pv: 52, out: 45 })));
  };

  // Siemens S7-1200 analog scaling (4-20mA -> 0..27648, wire-break < -1728)
  const iw64Level = faultWireBreak ? -3456 : Math.round((levelPct / 100) * 27648);
  const transmitterMa = faultWireBreak ? 0.0 : 4.0 + (levelPct / 100) * 16.0;
  const pressureMpa = Number(
    Math.max(0.02, (levelPct / 100) * 0.42 + (pidOutputPct / 100) * 0.16 + (pump2Running ? 0.12 : 0)).toFixed(2)
  );
  const targetPressureMpa = Number(((setpointPct / 100) * 0.42 + 0.17).toFixed(2));
  const iw66Pressure = Math.round((pressureMpa / 1.0) * 27648);
  const qw80Vfd = Math.round((pidOutputPct / 100) * 27648);
  const vfdHz = (pidOutputPct / 100) * 50;
  const hhAlarm = faultHighHigh || levelPct >= 90;

  const banner = useMemo(() => {
    if (faultWireBreak) {
      return {
        tone: 'danger' as const,
        text: '🚨 模拟量断线诊断报警 (%IW64 = -3456 < 0，电流 0.0 mA)：4-20mA 液位变送器断线！PLC 已立即冻结 PID 并切断双泵与加热管，防止盲目全速抽水导致储罐溢流！',
        actionLabel: '修复 4-20mA 信号线',
        onAction: () => setFaultWireBreak(false),
      };
    }
    if (hhAlarm) {
      return {
        tone: 'danger' as const,
        text: `🚨 高高液位溢流联锁触发 (HH ≥ 90%，当前 ${levelPct.toFixed(1)}%)：硬件浮球开关 %I0.2 动作，PLC 已强制停泵 %Q0.0/%Q0.1 保护储罐！`,
        actionLabel: '解除溢流故障并排液',
        onAction: () => {
          setFaultHighHigh(false);
          physRef.current.level = 72;
        },
      };
    }
    if (faultPump1Trip) {
      return {
        tone: 'warn' as const,
        text: '⚠️ 1# 主变频水泵过载跳闸：系统已自动投入 2# 副增压泵 (%Q0.1) 维持应急供水，请尽快检修 1# 变频泵。',
        actionLabel: '复位 1# 主泵故障',
        onAction: () => setFaultPump1Trip(false),
      };
    }
    return undefined;
  }, [faultWireBreak, hhAlarm, levelPct, faultPump1Trip]);

  const ioSignals: IoSignalItem[] = [
    {
      address: '%IW64',
      symbol: 'AI_TankLevel',
      label: `液位变送 (${transmitterMa.toFixed(1)}mA)`,
      kind: 'IW',
      value: iw64Level,
      fault: faultWireBreak,
    },
    {
      address: '%IW66',
      symbol: 'AI_Pressure',
      label: `管网压力 (${pressureMpa.toFixed(2)}MPa)`,
      kind: 'IW',
      value: iw66Pressure,
    },
    {
      address: '%I0.2',
      symbol: 'LS_HighHigh',
      label: '高高液位浮球 (NC)',
      kind: 'I',
      value: !hhAlarm,
      fault: hhAlarm,
    },
    {
      address: '%Q0.0',
      symbol: 'Pump1_VFD_Run',
      label: '1# 主变频泵启停',
      kind: 'Q',
      value: pidOutputPct > 1,
      fault: faultPump1Trip,
      onToggle: () => setManualOut((m) => ({ ...m, p1Pct: m.p1Pct > 0 ? 0 : 65 })),
    },
    {
      address: '%Q0.1',
      symbol: 'Pump2_Aux_Run',
      label: '2# 副增压泵投入',
      kind: 'Q',
      value: pump2Running,
      onToggle: () => setManualOut((m) => ({ ...m, p2On: !m.p2On })),
    },
    {
      address: '%Q0.2',
      symbol: 'Heater_SSR',
      label: '热工电加热棒 SSR',
      kind: 'Q',
      value: heaterActive,
      onToggle: () => setManualOut((m) => ({ ...m, heaterOn: !m.heaterOn })),
    },
    {
      address: '%QW80',
      symbol: 'AQ_VFD_Out',
      label: `变频输出 (${vfdHz.toFixed(1)}Hz)`,
      kind: 'QW',
      value: qw80Vfd,
    },
  ];

  const sliders: ParamSliderItem[] = [
    {
      id: 'sp',
      label: `PID 目标液位设定值 SP (对应恒压 ${targetPressureMpa} MPa)`,
      value: setpointPct,
      min: 20,
      max: 82,
      step: 1,
      unit: '%',
      onChange: setSetpointPct,
    },
    {
      id: 'valve',
      label: '出水负载阀门开度（模拟管网用水高峰扰动）',
      value: loadValvePct,
      min: 8,
      max: 95,
      step: 1,
      unit: '%',
      onChange: setLoadValvePct,
    },
    {
      id: 'kp',
      label: 'PID 比例增益 Kp（调节响应速度与超调量）',
      value: pidKp,
      min: 0.6,
      max: 6.0,
      step: 0.2,
      unit: '',
      onChange: setPidKp,
    },
  ];

  const faults: FaultSwitchItem[] = [
    {
      id: 'wire-break',
      label: '液位变送器 4-20mA 断线 (%IW64 < 0)',
      active: faultWireBreak,
      onToggle: () => setFaultWireBreak((v) => !v),
    },
    {
      id: 'hh-overflow',
      label: '高高液位溢流联锁 (HH ≥ 90%)',
      active: faultHighHigh,
      onToggle: () => setFaultHighHigh((v) => !v),
    },
    {
      id: 'p1-trip',
      label: '1# 主变频水泵过载跳闸',
      active: faultPump1Trip,
      onToggle: () => setFaultPump1Trip((v) => !v),
    },
  ];

  // Build dynamic liquid wave path inside tank (tank inner y: 120..390 => height 270)
  const tankBottomY = 390;
  const tankHeight = 266;
  const liquidTopY = tankBottomY - (levelPct / 100) * tankHeight;
  const wavePath = useMemo(() => {
    const x0 = 374;
    const w = 224;
    const amp = pidOutputPct > 5 || loadValvePct > 20 ? 4.5 : 1.5;
    let d = `M ${x0} ${liquidTopY}`;
    for (let i = 0; i <= 16; i++) {
      const px = x0 + (w * i) / 16;
      const py = liquidTopY + Math.sin(wavePhase + i * 0.7) * amp;
      d += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
    }
    d += ` L ${x0 + w} ${tankBottomY} L ${x0} ${tankBottomY} Z`;
    return d;
  }, [liquidTopY, wavePhase, pidOutputPct, loadValvePct]);

  // Build SVG polylines for embedded 3-curve PID Trend Chart (box: 696, 260, w=314, h=190)
  const chartPoints = useMemo(() => {
    const xStart = 724;
    const chartW = 272;
    const yBottom = 428;
    const chartH = 132;
    const toPoly = (extractor: (pt: TrendPoint) => number) =>
      trend
        .map((pt, idx) => {
          const x = xStart + (idx / Math.max(1, MAX_TREND - 1)) * chartW;
          const val = Math.max(0, Math.min(100, extractor(pt)));
          const y = yBottom - (val / 100) * chartH;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    return {
      sp: toPoly((p) => p.sp),
      pv: toPoly((p) => p.pv),
      out: toPoly((p) => p.out),
    };
  }, [trend]);

  const shellStatus: 'run' | 'stop' | 'fault' =
    faultWireBreak || hhAlarm ? 'fault' : pidOutputPct > 0 || pump2Running ? 'run' : 'stop';

  // Pressure gauge needle angle (-125 deg at 0 MPa .. +125 deg at 0.80 MPa)
  const pressureAngle = -125 + Math.min(1, pressureMpa / 0.8) * 250;

  return (
    <TwinShell
      title="双泵恒压供水与储液罐热工 PID 闭环过程模型"
      subtitle="一阶惯性微分方程实时积分 · 4-20mA 模拟量标定 + 断线保护 + 双泵加减泵 + 三曲线 PID 示波器"
      status={shellStatus}
      statusText={
        faultWireBreak
          ? 'FAULT · 4-20mA 断线'
          : hhAlarm
            ? 'FAULT · HH 高高液位'
            : `PID 闭环 · 液位 ${levelPct.toFixed(1)}%`
      }
      mode={mode}
      onModeChange={setMode}
      paused={paused}
      onTogglePause={() => setPaused((p) => !p)}
      onReset={handleReset}
      embedded={embedded}
      banner={banner}
      ioSignals={ioSignals}
      sliders={sliders}
      faults={faults}
      actionBar={
        <>
          <div className="dt-action-group">
            <span className="dt-action-label">工况扰动一键测试</span>
            <button type="button" className="dt-btn" onClick={() => setLoadValvePct(88)}>
              <Waves size={13} color="#38bdf8" />
              模拟用水高峰 (阀门 88%)
            </button>
            <button type="button" className="dt-btn" onClick={() => setLoadValvePct(22)}>
              <Gauge size={13} color="#34d399" />
              模拟夜间低谷 (阀门 22%)
            </button>
            <button type="button" className="dt-btn" onClick={() => setSetpointPct(78)}>
              阶跃提压 (SP → 78%)
            </button>
          </div>
          <div className="dt-action-group">
            <button
              type="button"
              className={`dt-btn ${heaterEnabled ? 'dt-btn--active' : ''}`}
              onClick={() => setHeaterEnabled((h) => !h)}
            >
              <Flame size={13} color={heaterEnabled ? '#fb923c' : '#94a3b8'} />
              恒温加热控制 (55°C)：{heaterEnabled ? '投入' : '切除'}
            </button>
          </div>
        </>
      }
    >
      <svg
        viewBox="0 0 1040 500"
        className="dt-svg"
        role="img"
        aria-label="双泵恒压供水与储液罐热工 PID 过程模型"
      >
        <defs>
          <linearGradient id="tankSteel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="18%" stopColor="#64748b" />
            <stop offset="50%" stopColor="#1e293b" />
            <stop offset="85%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.88" />
            <stop offset="55%" stopColor="#0284c7" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0.96" />
          </linearGradient>
          <linearGradient id="hotWaterGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
          <clipPath id="tankInnerClip">
            <rect x="374" y="122" width="224" height="268" rx="10" />
          </clipPath>
        </defs>

        {/* ==================== LEFT: DUAL CENTRIFUGAL BOOSTER PUMPS (P1 VFD + P2 AUX) ==================== */}
        {/* Supply Reservoir Header Pipe */}
        <path d="M 38 164 L 116 164 M 38 332 L 116 332 M 66 164 L 66 332" stroke="#1e3a8a" strokeWidth="14" strokeLinecap="round" fill="none" />
        <path
          d="M 38 164 L 116 164"
          stroke="#38bdf8"
          strokeWidth="3.5"
          fill="none"
          className={pidOutputPct > 1 ? 'dt-water-flow' : ''}
        />
        <path
          d="M 38 332 L 116 332"
          stroke="#38bdf8"
          strokeWidth="3.5"
          fill="none"
          className={pump2Running ? 'dt-water-flow' : ''}
        />

        {/* Discharge Header Manifold -> Tank Top Inlet */}
        <path
          d="M 186 164 L 296 164 L 296 146 L 372 146 M 186 332 L 296 332 L 296 164"
          stroke="#1e3a8a"
          strokeWidth="14"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M 186 164 L 296 164 L 296 146 L 372 146"
          stroke="#38bdf8"
          strokeWidth="4"
          strokeLinejoin="round"
          fill="none"
          className={pidOutputPct > 1 || pump2Running ? 'dt-water-flow' : ''}
        />
        {pump2Running && (
          <path
            d="M 186 332 L 296 332 L 296 164"
            stroke="#38bdf8"
            strokeWidth="4"
            strokeLinejoin="round"
            fill="none"
            className="dt-water-flow"
          />
        )}

        {/* 1# Main VFD Pump P1 */}
        <g transform="translate(150, 164)">
          <circle
            cx="0"
            cy="0"
            r="38"
            fill="#1e293b"
            stroke={faultPump1Trip ? '#ef4444' : pidOutputPct > 1 ? '#10b981' : '#64748b'}
            strokeWidth="3"
          />
          <circle cx="0" cy="0" r="27" fill="#0f172a" stroke="#334155" strokeWidth="2" />
          <g transform={`rotate(${impeller1Deg})`}>
            {[0, 72, 144, 216, 288].map((deg) => (
              <path
                key={deg}
                d="M 0 -4 Q 14 -14 22 -4 L 18 5 Q 10 -4 0 4 Z"
                fill={faultPump1Trip ? '#ef4444' : pidOutputPct > 1 ? '#38bdf8' : '#64748b'}
                transform={`rotate(${deg})`}
              />
            ))}
            <circle cx="0" cy="0" r="6" fill="#e2e8f0" />
          </g>
          {/* VFD Box above P1 */}
          <rect x="-56" y="-114" width="118" height="62" rx="7" fill="#0f172a" stroke="#009999" strokeWidth="1.5" />
          <text x="3" y="-96" textAnchor="middle" fill="#5eead4" fontSize="11" fontWeight="700">
            1# 主变频泵 P1 (%Q0.0)
          </text>
          <text
            x="3"
            y="-75"
            textAnchor="middle"
            fill={faultPump1Trip ? '#f87171' : '#34d399'}
            fontSize="15"
            fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
            fontWeight="800"
          >
            {faultPump1Trip ? 'TRIP 过载' : `${vfdHz.toFixed(1)} Hz`}
          </text>
          <text x="3" y="-59" textAnchor="middle" fill="#a78bfa" fontSize="11" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
            PID={pidOutputPct.toFixed(0)}% · QW80={qw80Vfd}
          </text>
        </g>

        {/* 2# Auxiliary Booster Pump P2 */}
        <g transform="translate(150, 332)">
          <circle
            cx="0"
            cy="0"
            r="38"
            fill="#1e293b"
            stroke={pump2Running ? '#10b981' : '#64748b'}
            strokeWidth="3"
          />
          <circle cx="0" cy="0" r="27" fill="#0f172a" stroke="#334155" strokeWidth="2" />
          <g transform={`rotate(${impeller2Deg})`}>
            {[0, 72, 144, 216, 288].map((deg) => (
              <path
                key={deg}
                d="M 0 -4 Q 14 -14 22 -4 L 18 5 Q 10 -4 0 4 Z"
                fill={pump2Running ? '#34d399' : '#64748b'}
                transform={`rotate(${deg})`}
              />
            ))}
            <circle cx="0" cy="0" r="6" fill="#e2e8f0" />
          </g>
          <rect x="-56" y="50" width="118" height="48" rx="7" fill="#0f172a" stroke="#334155" />
          <text x="3" y="68" textAnchor="middle" fill="#cbd5e1" fontSize="11" fontWeight="700">
            2# 副增压泵 P2 (%Q0.1)
          </text>
          <text
            x="3"
            y="87"
            textAnchor="middle"
            fill={pump2Running ? '#34d399' : '#94a3b8'}
            fontSize="11.5"
            fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
            fontWeight="700"
          >
            {pump2Running ? '工频 50Hz 投入' : '休眠待命 (自动加泵)'}
          </text>
        </g>

        {/* Pressure Gauge PT-101 on Manifold */}
        <g transform="translate(296, 248)">
          <circle cx="0" cy="0" r="34" fill="#0f172a" stroke="#94a3b8" strokeWidth="2.5" />
          <circle cx="0" cy="0" r="27" fill="#020617" stroke="#334155" />
          <g transform={`rotate(${pressureAngle})`}>
            <line x1="0" y1="6" x2="0" y2="-22" stroke="#f59e0b" strokeWidth="2.4" strokeLinecap="round" />
          </g>
          <circle cx="0" cy="0" r="4" fill="#e2e8f0" />
          <text x="0" y="18" textAnchor="middle" fill="#fbbf24" fontSize="11" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif" fontWeight="800">
            {pressureMpa.toFixed(2)}
          </text>
          <text x="0" y="47" textAnchor="middle" fill="#cbd5e1" fontSize="11" fontWeight="700">
            PT-101 (MPa)
          </text>
        </g>

        {/* ==================== CENTER: CUTAWAY STAINLESS STORAGE TANK + HEATER + LT-101 ==================== */}
        <g>
          {/* Top Transmitter LT-101 (4-20mA) */}
          <g transform="translate(486, 44)">
            <rect
              x="-72"
              y="-22"
              width="144"
              height="52"
              rx="8"
              fill="#0f172a"
              stroke={faultWireBreak ? '#ef4444' : '#00c4c4'}
              strokeWidth="1.8"
            />
            <text x="0" y="-5" textAnchor="middle" fill="#5eead4" fontSize="11" fontWeight="700">
              LT-101 液位变送器 (%IW64)
            </text>
            <text
              x="0"
              y="14"
              textAnchor="middle"
              fill={faultWireBreak ? '#f87171' : '#38bdf8'}
              fontSize="12"
              fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
              fontWeight="800"
            >
              {faultWireBreak ? '0.0 mA · 断线!' : `${transmitterMa.toFixed(1)} mA · ${levelPct.toFixed(1)}%`}
            </text>
            <line x1="0" y1="30" x2="0" y2="74" stroke="#94a3b8" strokeWidth="4" />
          </g>

          {/* Outer Stainless Tank Shell */}
          <rect x="364" y="112" width="244" height="288" rx="16" fill="url(#tankSteel)" stroke="#94a3b8" strokeWidth="2" />
          {/* Inner Cutaway Chamber */}
          <rect x="374" y="122" width="224" height="268" rx="10" fill="#091224" stroke="#334155" />

          {/* Animated Wave Fluid inside Clip */}
          <g clipPath="url(#tankInnerClip)">
            <path d={wavePath} fill="url(#waterGrad)" />
            {/* Thermal heat shimmer when heater active */}
            {heaterActive && (
              <rect x="374" y="315" width="224" height="75" fill="url(#hotWaterGlow)" />
            )}
          </g>

          {/* Setpoint SP Dashed Reference Line across tank */}
          {(() => {
            const spY = tankBottomY - (setpointPct / 100) * tankHeight;
            return (
              <g>
                <line
                  x1="374"
                  y1={spY}
                  x2="598"
                  y2={spY}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
                <rect x="536" y={spY - 19} width="58" height="17" rx="4" fill="#78350f" stroke="#fbbf24" />
                <text x="565" y={spY - 7} textAnchor="middle" fill="#fde68a" fontSize="11" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif" fontWeight="700">
                  SP {setpointPct}%
                </text>
              </g>
            );
          })()}

          {/* HH / H / L Alarm Level Ticks on left side of tank */}
          {[
            { lbl: 'HH 90%', pct: 90, col: '#ef4444' },
            { lbl: 'H 80%', pct: 80, col: '#f59e0b' },
            { lbl: 'L 20%', pct: 20, col: '#38bdf8' },
          ].map((tk) => {
            const ty = tankBottomY - (tk.pct / 100) * tankHeight;
            return (
              <g key={tk.lbl}>
                <line x1="364" y1={ty} x2="386" y2={ty} stroke={tk.col} strokeWidth="2" />
                <text x="390" y={ty + 3} fill={tk.col} fontSize="10.4" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif" fontWeight="700">
                  {tk.lbl}
                </text>
              </g>
            );
          })}

          {/* Immersed Thermal Heater Coil (%Q0.2) */}
          <path
            d="M 412 368 Q 426 346 440 368 T 468 368 T 496 368 T 524 368 T 552 368"
            fill="none"
            stroke={heaterActive ? '#fb923c' : '#64748b'}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <text x="486" y="384" textAnchor="middle" fill={heaterActive ? '#fdba74' : '#94a3b8'} fontSize="11" fontWeight="700">
            电加热管 %Q0.2 · 水温 {tempC.toFixed(1)} °C
          </text>

          {/* Tank Legs & Base Plate */}
          <rect x="386" y="400" width="16" height="36" fill="#475569" />
          <rect x="570" y="400" width="16" height="36" fill="#475569" />
          <rect x="352" y="434" width="268" height="10" rx="3" fill="#334155" />

          {/* Big Center Telemetry Readout */}
          <rect x="424" y="218" width="124" height="58" rx="9" fill="rgba(2,6,23,0.78)" stroke="#38bdf8" />
          <text x="486" y="246" textAnchor="middle" fill="#f8fafc" fontSize="22" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif" fontWeight="800">
            {levelPct.toFixed(1)}%
          </text>
          <text x="486" y="266" textAnchor="middle" fill="#7dd3fc" fontSize="11.2" fontWeight="600">
            误差 e = {(setpointPct - levelPct).toFixed(1)}%
          </text>
        </g>

        {/* ==================== OUTLET PIPE & MOTORIZED LOAD VALVE FV-101 ==================== */}
        <path d="M 608 358 L 672 358 L 672 132 L 998 132" stroke="#1e3a8a" strokeWidth="14" strokeLinejoin="round" fill="none" />
        <path
          d="M 608 358 L 672 358 L 672 132 L 998 132"
          stroke="#38bdf8"
          strokeWidth={Math.max(2, (loadValvePct / 100) * 5.5)}
          strokeLinejoin="round"
          fill="none"
          className={loadValvePct > 5 ? 'dt-water-flow' : ''}
        />

        {/* Motorized Valve FV-101 */}
        <g transform="translate(830, 132)">
          <polygon points="-24,-14 0,0 -24,14" fill="#0f766e" stroke="#5eead4" strokeWidth="1.5" />
          <polygon points="24,-14 0,0 24,14" fill="#0f766e" stroke="#5eead4" strokeWidth="1.5" />
          <line x1="0" y1="0" x2="0" y2="-28" stroke="#cbd5e1" strokeWidth="3" />
          <rect x="-30" y="-58" width="60" height="32" rx="6" fill="#0f172a" stroke="#00c4c4" />
          <text x="0" y="-44" textAnchor="middle" fill="#94a3b8" fontSize="10.4" fontWeight="700">
            FV-101 负载阀
          </text>
          <text x="0" y="-31" textAnchor="middle" fill="#5eead4" fontSize="11" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif" fontWeight="800">
            开度 {loadValvePct}%
          </text>
          <text x="115" y="-16" textAnchor="middle" fill="#7dd3fc" fontSize="11.2" fontWeight="700">
            供水管网出水 →
          </text>
        </g>

        {/* ==================== RIGHT BOTTOM: REAL-TIME 3-CURVE PID TREND OSCILLOSCOPE ==================== */}
        <g>
          <rect x="698" y="220" width="320" height="248" rx="12" fill="#09101f" stroke="#334155" strokeWidth="1.6" />
          <text x="716" y="242" fill="#e2e8f0" fontSize="11.5" fontWeight="700">
            实时 PID 闭环趋势示波器（SP / PV / Output）
          </text>

          {/* Legend */}
          <g transform="translate(716, 254)">
            <line x1="0" y1="6" x2="18" y2="6" stroke="#fbbf24" strokeWidth="2.5" strokeDasharray="4 3" />
            <text x="23" y="10" fill="#fde68a" fontSize="11" fontWeight="700">
              SP 设定({setpointPct}%)
            </text>
            <line x1="102" y1="6" x2="120" y2="6" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="125" y="10" fill="#7dd3fc" fontSize="11" fontWeight="700">
              PV 反馈({levelPct.toFixed(0)}%)
            </text>
            <line x1="205" y1="6" x2="223" y2="6" stroke="#a78bfa" strokeWidth="2.2" />
            <text x="228" y="10" fill="#c4b5fd" fontSize="11" fontWeight="700">
              OUT({pidOutputPct.toFixed(0)}%)
            </text>
          </g>

          {/* Chart Grid (x: 724..996, y: 296..428) */}
          <rect x="724" y="292" width="272" height="136" rx="4" fill="#020617" stroke="#1e293b" />
          {[0, 25, 50, 75, 100].map((v) => {
            const gy = 428 - (v / 100) * 132;
            return (
              <g key={`gy-${v}`}>
                <line x1="724" y1={gy} x2="996" y2={gy} stroke="#1e293b" strokeWidth="1" />
                <text x="719" y={gy + 3} textAnchor="end" fill="#94a3b8" fontSize="10.4" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                  {v}
                </text>
              </g>
            );
          })}

          {/* 3 Live Polylines */}
          <polyline fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="5 3" points={chartPoints.sp} />
          <polyline fill="none" stroke="#a78bfa" strokeWidth="2" opacity="0.85" points={chartPoints.out} />
          <polyline fill="none" stroke="#38bdf8" strokeWidth="2.6" points={chartPoints.pv} />

          <text x="860" y="452" textAnchor="middle" fill="#94a3b8" fontSize="11">
            ← 历史滚动时间轴（约 18 秒窗口）→ 拖动“负载阀门”观察抗扰恢复过程
          </text>
        </g>
      </svg>
    </TwinShell>
  );
};
