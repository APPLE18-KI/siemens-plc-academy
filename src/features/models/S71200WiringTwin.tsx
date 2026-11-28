import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Power, Radio, ShieldAlert, Zap } from 'lucide-react';
import type { PlcRuntime } from '../../types/plc';
import {
  TwinShell,
  type FaultSwitchItem,
  type IoSignalItem,
  type ParamSliderItem,
  type TwinControlMode,
} from './components/TwinShell';
import { InteractiveWiringLab } from './components/InteractiveWiringLab';

export interface TwinModelProps {
  runtime?: PlcRuntime;
  embedded?: boolean;
}

type SensorType = 'PNP' | 'NPN';
type CommonWiring = 'M' | 'L+';

export const S71200WiringTwin: React.FC<TwinModelProps> = ({ runtime, embedded = false }) => {
  const [workbenchView, setWorkbenchView] = useState<'twin' | 'wiring-lab'>('twin');
  const [mode, setMode] = useState<TwinControlMode>('auto');
  const [cpuRun, setCpuRun] = useState(true);
  const [paused, setPaused] = useState(false);

  // Electrical hardware state
  const [qfPowerOn, setQfPowerOn] = useState(true); // 24V breaker QF1
  const [sensorType, setSensorType] = useState<SensorType>('PNP');
  const [common1M, setCommon1M] = useState<CommonWiring>('M'); // 1M connected to M(0V) or L+(+24V)
  const [buttonRail, setButtonRail] = useState<CommonWiring>('L+'); // Dry-contact button supply rail

  // Field inputs (physical button / target state)
  const [sb1Pressed, setSb1Pressed] = useState(false); // Start NO
  const [sb2Pressed, setSb2Pressed] = useState(false); // Stop NC (true = pressed = contact open)
  const [eStopLatched, setEStopLatched] = useState(false); // E-Stop mushroom NC (true = pressed = open)
  const [targetPresent, setTargetPresent] = useState(false); // Object in front of photoelectric BG1
  const [frOverload, setFrOverload] = useState(false); // Thermal overload relay FR1 tripped

  // Physical tuning parameters
  const [supplyVoltage, setSupplyVoltage] = useState(24.0);
  const [motorFreqHz, setMotorFreqHz] = useState(50);

  // PLC internal latched state & manual force overrides
  const [motorLatched, setMotorLatched] = useState(false);
  const [faultLatched, setFaultLatched] = useState(false);
  const [manualQ, setManualQ] = useState({ q00: false, q01: false, q02: false });

  // Motor fan animation angle & RPM (useRef avoids tearing down 30fps interval every tick)
  const [fanAngle, setFanAngle] = useState(0);
  const [motorRpm, setMotorRpm] = useState(0);
  const motorRpmRef = useRef(0);
  const [lanBlink, setLanBlink] = useState(false);

  // Electrical optocoupler conductivity physics
  const powerHealthy = qfPowerOn && supplyVoltage >= 19.2;

  // Sensor circuit conductivity:
  // PNP outputs +24V when triggered -> requires 1M = M (0V) to form potential difference
  // NPN outputs 0V (sinks) when triggered -> requires 1M = L+ (+24V)
  const sensorWiringValid =
    (sensorType === 'PNP' && common1M === 'M') || (sensorType === 'NPN' && common1M === 'L+');
  const buttonWiringValid = buttonRail !== common1M;

  // Effective PLC input image (%I0.0 ~ %I0.4)
  const i00 = powerHealthy && buttonWiringValid && sb1Pressed; // Start_PB (NO)
  const i01 = powerHealthy && buttonWiringValid && !sb2Pressed; // Stop_PB (NC)
  const i02 = powerHealthy && buttonWiringValid && !eStopLatched; // EStop_OK (NC)
  const i03 = powerHealthy && sensorWiringValid && targetPresent; // Photo_BG1
  const i04 = powerHealthy && buttonWiringValid && !frOverload; // FR1_OK (NC)

  // PLC Output image (%Q0.0 ~ %Q0.2)
  const q00 = powerHealthy && (mode === 'manual' ? manualQ.q00 : cpuRun && motorLatched); // KA1 -> KM1 -> Motor
  const q01 = powerHealthy && (mode === 'manual' ? manualQ.q01 : cpuRun && motorLatched); // HL_RUN
  const q02 = powerHealthy && (mode === 'manual' ? manualQ.q02 : cpuRun && faultLatched); // HL_FAULT

  // Sync with external PlcRuntime if supplied
  const prevExternalRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!runtime) return;
    const unsub = runtime.subscribe((tags) => {
      const extRun = Boolean(tags['Motor_Run'] ?? tags['KM_Motor'] ?? tags['Q0.0']);
      if (prevExternalRef.current !== extRun) {
        prevExternalRef.current = extRun;
        setMotorLatched(extRun);
      }
    });
    return unsub;
  }, [runtime]);

  // Built-in PLC OB1 scan logic (runs every 60ms)
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setLanBlink((b) => !b);

      if (!powerHealthy) {
        setMotorLatched(false);
        return;
      }

      if (mode === 'auto' && cpuRun) {
        // 1. Evaluate Safety & Faults FIRST (Siemens best practice)
        const safetyOk = i02 && i04;
        if (!safetyOk) {
          setFaultLatched(true);
          setMotorLatched(false);
        } else {
          // 2. Seal-in Start/Stop logic (also allows Photoelectric BG1 auto-trigger test when pressed)
          setMotorLatched((prev) => {
            if (!i01) return false; // NC Stop button opened -> Stop
            if (faultLatched) return false;
            if (i00) return true; // Start PB pressed -> Seal-in
            return prev;
          });
        }
      }
    }, 60);

    return () => window.clearInterval(timer);
  }, [paused, powerHealthy, mode, cpuRun, i00, i01, i02, i04, faultLatched]);

  // Motor mechanical inertia & fan rotation loop (30fps without interval thrashing)
  useEffect(() => {
    if (paused) return;
    const targetRpm = q00 ? Math.round((motorFreqHz / 50) * 1450) : 0;
    const timer = window.setInterval(() => {
      const prev = motorRpmRef.current;
      const diff = targetRpm - prev;
      const nextRpm = Math.abs(diff) < 12 ? targetRpm : Math.round(prev + diff * 0.14);
      if (nextRpm !== prev) {
        motorRpmRef.current = nextRpm;
        setMotorRpm(nextRpm);
      }
      const stepDeg = q00 ? (motorFreqHz / 50) * 18 : nextRpm > 40 ? 4 : 0;
      if (stepDeg > 0) {
        setFanAngle((ang) => (ang + stepDeg) % 360);
      }
    }, 33);
    return () => window.clearInterval(timer);
  }, [paused, q00, motorFreqHz]);

  // Momentary pushbutton click helper
  const pulseStart = () => {
    setSb1Pressed(true);
    if (runtime) runtime.setTag('Start_PB', true);
    window.setTimeout(() => {
      setSb1Pressed(false);
      if (runtime) runtime.setTag('Start_PB', false);
    }, 450);
  };

  const pulseStop = () => {
    setSb2Pressed(true);
    if (runtime) runtime.setTag('Stop_PB', false);
    window.setTimeout(() => {
      setSb2Pressed(false);
      if (runtime) runtime.setTag('Stop_PB', true);
    }, 450);
  };

  const applyPreset = (preset: 'pnp-ok' | 'npn-ok' | 'npn-wrong') => {
    if (preset === 'pnp-ok') {
      setSensorType('PNP');
      setCommon1M('M');
      setButtonRail('L+');
    } else if (preset === 'npn-ok') {
      setSensorType('NPN');
      setCommon1M('L+');
      setButtonRail('M');
    } else {
      setSensorType('NPN');
      setCommon1M('M');
      setButtonRail('L+');
      setTargetPresent(true);
    }
  };

  const handleReset = () => {
    setQfPowerOn(true);
    setEStopLatched(false);
    setFrOverload(false);
    setFaultLatched(false);
    setMotorLatched(false);
    setTargetPresent(false);
    setSensorType('PNP');
    setCommon1M('M');
    setButtonRail('L+');
    setManualQ({ q00: false, q01: false, q02: false });
    setSupplyVoltage(24.0);
    setMotorFreqHz(50);
    setCpuRun(true);
    setMode('auto');
  };

  // Determine diagnostic banner
  const banner = useMemo(() => {
    if (!qfPowerOn) {
      return {
        tone: 'danger' as const,
        text: '主断路器 QF1 已断开：SITOP 24V 开关电源失电，CPU 1214C 与外围 I/O 全部断电，请合闸 QF1！',
        actionLabel: '合闸 QF1',
        onAction: () => setQfPowerOn(true),
      };
    }
    if (supplyVoltage < 19.2) {
      return {
        tone: 'danger' as const,
        text: `24V 直流电源欠压 (${supplyVoltage.toFixed(1)}V < 19.2V 下限)：S7-1200 CPU 触发掉电保护，请将直流电压调回 24.0V。`,
      };
    }
    if (!sensorWiringValid) {
      const detail =
        sensorType === 'NPN'
          ? '接线诊断错误：当前为 NPN 漏型传感器（导通时输出 0V/M），而 CPU 公共端 1M 也接在 M (0V)，输入光耦两端电位差为 0V，回路无法导通，%I0.3 恒为 0！'
          : '接线诊断错误：当前为 PNP 源型传感器（导通时输出 +24V/L+），而 CPU 公共端 1M 也接在 L+ (+24V)，输入光耦两端电位差为 0V，回路无法导通，%I0.3 恒为 0！';
      return {
        tone: 'danger' as const,
        text: detail,
        actionLabel: sensorType === 'NPN' ? '一键纠正：1M 改接 L+' : '一键纠正：1M 改接 M',
        onAction: () => {
          if (sensorType === 'NPN') {
            setCommon1M('L+');
            setButtonRail('M');
          } else {
            setCommon1M('M');
            setButtonRail('L+');
          }
        },
      };
    }
    if (!buttonWiringValid) {
      return {
        tone: 'warn' as const,
        text: `输入公共端冲突：按钮公共线接在 ${buttonRail}，与 1M (${common1M}) 同电位，导致 SB1/SB2/急停无法形成电流回路。西门子 S7-1200 同一 1M 组的传感器与按钮必须统一为源型或漏型！`,
        actionLabel: '统一按钮极性',
        onAction: () => setButtonRail(common1M === 'M' ? 'L+' : 'M'),
      };
    }
    if (eStopLatched || frOverload || faultLatched) {
      const reason = eStopLatched
        ? '急停蘑菇头 SB_EMG (%I0.2) 已拍下'
        : frOverload
          ? '热继电器 FR1 (%I0.4) 过载跳闸'
          : '安全故障自锁中，需人工确认复位';
      return {
        tone: 'danger' as const,
        text: `安全联锁触发：${reason}，PLC 已强制切断 %Q0.0 (KA1/KM1) 并点亮红色故障灯 %Q0.2。`,
        actionLabel: !eStopLatched && !frOverload ? '复位故障锁存' : '解除现场故障并复位',
        onAction: () => {
          setEStopLatched(false);
          setFrOverload(false);
          setFaultLatched(false);
        },
      };
    }
    return {
      tone: 'ok' as const,
      text:
        sensorType === 'PNP'
          ? '接线校验通过 [欧标源型 PNP]：1M → M (0V)，电流流向 L+ → 传感器/按钮 → %I0.x → CPU 双向光耦 → 1M → M。点击 SB1 启动电机，或切换 NPN 对比回路电流方向！'
          : '接线校验通过 [漏型 NPN]：1M → L+ (+24V)，电流反向流向 L+ → 1M → CPU 双向光耦 → %I0.x → NPN 传感器集电极 → M (0V)。',
    };
  }, [qfPowerOn, supplyVoltage, sensorWiringValid, sensorType, buttonWiringValid, buttonRail, common1M, eStopLatched, frOverload, faultLatched]);

  const cpuStatus: 'run' | 'stop' | 'fault' = !powerHealthy
    ? 'stop'
    : !sensorWiringValid || eStopLatched || frOverload || faultLatched
      ? 'fault'
      : cpuRun
        ? 'run'
        : 'stop';

  const statusText = !powerHealthy
    ? 'POWER OFF'
    : cpuStatus === 'fault'
      ? 'CPU FAULT / 接线告警'
      : cpuRun
        ? 'CPU 1214C · RUN'
        : 'CPU 1214C · STOP';

  const ioSignals: IoSignalItem[] = [
    { address: '%I0.0', symbol: 'Start_PB', label: '启动按钮 SB1 (NO)', kind: 'I', value: i00 },
    { address: '%I0.1', symbol: 'Stop_PB', label: '停止按钮 SB2 (NC)', kind: 'I', value: i01 },
    {
      address: '%I0.2',
      symbol: 'EStop_OK',
      label: '急停蘑菇头 (NC)',
      kind: 'I',
      value: i02,
      fault: eStopLatched,
    },
    {
      address: '%I0.3',
      symbol: 'Photo_BG1',
      label: `光电开关 (${sensorType})`,
      kind: 'I',
      value: i03,
      fault: targetPresent && !sensorWiringValid,
    },
    {
      address: '%I0.4',
      symbol: 'FR1_OK',
      label: '热继电器常闭 (NC)',
      kind: 'I',
      value: i04,
      fault: frOverload,
    },
    {
      address: '%Q0.0',
      symbol: 'KM1_Motor',
      label: '继电器 KA1 → KM1',
      kind: 'Q',
      value: q00,
      onToggle: () => setManualQ((s) => ({ ...s, q00: !s.q00 })),
    },
    {
      address: '%Q0.1',
      symbol: 'HL_Run',
      label: '绿色运行指示灯',
      kind: 'Q',
      value: q01,
      onToggle: () => setManualQ((s) => ({ ...s, q01: !s.q01 })),
    },
    {
      address: '%Q0.2',
      symbol: 'HL_Fault',
      label: '红色故障报警灯',
      kind: 'Q',
      value: q02,
      fault: q02,
      onToggle: () => setManualQ((s) => ({ ...s, q02: !s.q02 })),
    },
  ];

  const sliders: ParamSliderItem[] = [
    {
      id: 'vdc',
      label: 'SITOP 直流电源输出电压',
      value: supplyVoltage,
      min: 16,
      max: 28,
      step: 0.4,
      unit: 'V DC',
      onChange: setSupplyVoltage,
    },
    {
      id: 'freq',
      label: '三相电机供电频率（观察转速与电流）',
      value: motorFreqHz,
      min: 20,
      max: 60,
      step: 5,
      unit: 'Hz',
      onChange: setMotorFreqHz,
    },
  ];

  const faults: FaultSwitchItem[] = [
    {
      id: 'npn-mismatch',
      label: '注入误接：NPN 传感器配 1M 接 M(0V)',
      active: sensorType === 'NPN' && common1M === 'M',
      onToggle: () => {
        if (sensorType === 'NPN' && common1M === 'M') {
          applyPreset('pnp-ok');
        } else {
          applyPreset('npn-wrong');
        }
      },
    },
    {
      id: 'estop',
      label: '拍下急停蘑菇头 (%I0.2 断开)',
      active: eStopLatched,
      onToggle: () => setEStopLatched((v) => !v),
    },
    {
      id: 'fr1',
      label: '热继电器 FR1 过载动作 (%I0.4 断开)',
      active: frOverload,
      onToggle: () => setFrOverload((v) => !v),
    },
    {
      id: 'qf1',
      label: '断路器 QF1 跳闸断电',
      active: !qfPowerOn,
      onToggle: () => setQfPowerOn((v) => !v),
    },
  ];

  const motorCurrent = q00 ? (2.4 + (motorFreqHz / 50) * 5.8).toFixed(1) : '0.0';
  const sensorFlowClass =
    i03 && sensorType === 'PNP'
      ? 'dt-wire-flow'
      : i03 && sensorType === 'NPN'
        ? 'dt-wire-flow-rev'
        : '';

  return (
    <div className="v32-wiring-switcher-shell">
      <div className="v32-wiring-mode-bar" role="tablist" aria-label="接线实训模式切换">
        <button
          type="button"
          role="tab"
          aria-selected={workbenchView === 'twin'}
          className={`v32-wiring-mode-tab${workbenchView === 'twin' ? ' active' : ''}`}
          onClick={() => setWorkbenchView('twin')}
        >
          原理演示台：一键对比 NPN / PNP 电流与硬件拆解
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={workbenchView === 'wiring-lab'}
          className={`v32-wiring-mode-tab${workbenchView === 'wiring-lab' ? ' active' : ''}`}
          onClick={() => setWorkbenchView('wiring-lab')}
        >
          ⚡ 亲手点端子拉线闯关（3 关 · 含 24V 短路跳闸保护）
        </button>
      </div>

      {workbenchView === 'wiring-lab' ? (
        <InteractiveWiringLab />
      ) : (
        <TwinShell
      title="S7-1200 CPU 1214C DC/DC/DC 硬件拆解与外围接线实训台"
      subtitle="实景还原顶/底端子排、双向光耦 PNP/NPN 源漏型极性校验、KA 中间继电器与 KM 接触器主回路"
      status={cpuStatus}
      statusText={statusText}
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
            <span className="dt-action-label">现场操作</span>
            <button type="button" className="dt-btn dt-btn--success" onClick={pulseStart}>
              <Power size={13} />
              按启动 SB1 (NO)
            </button>
            <button type="button" className="dt-btn dt-btn--danger" onClick={pulseStop}>
              按停止 SB2 (NC)
            </button>
            <button
              type="button"
              className={`dt-btn ${targetPresent ? 'dt-btn--active' : ''}`}
              onClick={() => setTargetPresent((v) => !v)}
            >
              <Radio size={13} />
              {targetPresent ? '移开光电工件' : '放入工件触发 BG1'}
            </button>
            <button
              type="button"
              className={`dt-btn ${!cpuRun ? 'dt-btn--danger' : ''}`}
              onClick={() => setCpuRun((r) => !r)}
            >
              CPU 拨码：{cpuRun ? 'RUN' : 'STOP'}
            </button>
          </div>

          <div className="dt-action-group">
            <span className="dt-action-label">NPN/PNP 对比接线</span>
            <button
              type="button"
              className={`dt-btn ${sensorType === 'PNP' && common1M === 'M' ? 'dt-btn--active' : ''}`}
              onClick={() => applyPreset('pnp-ok')}
            >
              PNP + 1M接M (推荐)
            </button>
            <button
              type="button"
              className={`dt-btn ${sensorType === 'NPN' && common1M === 'L+' ? 'dt-btn--active' : ''}`}
              onClick={() => applyPreset('npn-ok')}
            >
              NPN + 1M接L+
            </button>
            <button
              type="button"
              className="dt-btn"
              onClick={() => setCommon1M((c) => (c === 'M' ? 'L+' : 'M'))}
            >
              <Zap size={12} />
              单独翻转 1M ({common1M})
            </button>
            <button
              type="button"
              className="dt-btn"
              onClick={() => setSensorType((t) => (t === 'PNP' ? 'NPN' : 'PNP'))}
            >
              <ShieldAlert size={12} />
              传感器类型：{sensorType}
            </button>
          </div>
        </>
      }
    >
      <svg
        viewBox="0 0 1040 560"
        className="dt-svg"
        role="img"
        aria-label="西门子 S7-1200 CPU 1214C 硬件接线与电机驱动交互图"
      >
        <defs>
          {/* Siemens Industrial Metallic Gradients */}
          <linearGradient id="s7Body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="12%" stopColor="#334155" />
            <stop offset="88%" stopColor="#263244" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="dinRail" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="50%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <linearGradient id="motorShell" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="45%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
          <linearGradient id="psuMetal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="50%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <filter id="glowGreen" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowRed" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background DIN Rail */}
        <rect x="20" y="252" width="1000" height="24" rx="2" fill="url(#dinRail)" opacity="0.45" />
        <rect x="20" y="259" width="1000" height="10" fill="#0f172a" opacity="0.45" />

        {/* ==================== POWER RAILS (+24V L+ & 0V M) ==================== */}
        {/* +24V L+ Busbar (Red) */}
        <line
          x1="158"
          y1="50"
          x2="995"
          y2="50"
          stroke={powerHealthy ? '#ef4444' : '#475569'}
          strokeWidth="3.5"
        />
        <text x="165" y="42" fill={powerHealthy ? '#fca5a5' : '#64748b'} fontSize="11" fontWeight="700">
          L+ (+{supplyVoltage.toFixed(1)}V DC 电源母线)
        </text>

        {/* 0V M Busbar (Blue) */}
        <line
          x1="158"
          y1="526"
          x2="995"
          y2="526"
          stroke={powerHealthy ? '#38bdf8' : '#475569'}
          strokeWidth="3.5"
        />
        <text x="165" y="544" fill={powerHealthy ? '#7dd3fc' : '#64748b'} fontSize="11" fontWeight="700">
          M (0V DC 公共参考地母线)
        </text>

        {/* ==================== LEFT: SITOP 24V PSU + QF1 BREAKER ==================== */}
        <g transform="translate(24, 72)">
          {/* SITOP 24V Power Supply */}
          <rect x="0" y="0" width="112" height="150" rx="8" fill="url(#psuMetal)" stroke="#64748b" strokeWidth="1.5" />
          <rect x="8" y="8" width="96" height="22" rx="3" fill="#0f172a" />
          <text x="56" y="23" textAnchor="middle" fill="#00c4c4" fontSize="11.2" fontWeight="800">
            SITOP PSU100C
          </text>
          <text x="56" y="48" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">
            24V DC / 5A
          </text>
          <rect x="14" y="58" width="84" height="28" rx="4" fill="#020617" stroke="#334155" />
          <text
            x="56"
            y="77"
            textAnchor="middle"
            fill={powerHealthy ? '#10b981' : '#ef4444'}
            fontSize="13"
            fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
            fontWeight="700"
          >
            {qfPowerOn ? `${supplyVoltage.toFixed(1)} V` : '0.0 V'}
          </text>
          {/* DC OK LED */}
          <circle
            cx="24"
            cy="104"
            r="4.5"
            fill={powerHealthy ? '#10b981' : '#334155'}
            filter={powerHealthy ? 'url(#glowGreen)' : undefined}
          />
          <text x="35" y="108" fill="#cbd5e1" fontSize="11.2">
            DC O.K.
          </text>
          {/* Output Terminals */}
          <rect x="16" y="122" width="34" height="18" rx="3" fill="#7f1d1d" stroke="#ef4444" />
          <text x="33" y="135" textAnchor="middle" fill="#fecaca" fontSize="11.2" fontWeight="700">
            L+
          </text>
          <rect x="62" y="122" width="34" height="18" rx="3" fill="#0c4a6e" stroke="#38bdf8" />
          <text x="79" y="135" textAnchor="middle" fill="#bae6fd" fontSize="11.2" fontWeight="700">
            M
          </text>

          {/* Circuit Breaker QF1 (Interactive!) */}
          <g
            transform="translate(0, 174)"
            style={{ cursor: 'pointer' }}
            onClick={() => setQfPowerOn((v) => !v)}
          >
            <rect
              x="0"
              y="0"
              width="112"
              height="92"
              rx="8"
              fill="#1e293b"
              stroke={qfPowerOn ? '#00c4c4' : '#ef4444'}
              strokeWidth="1.8"
            />
            <text x="56" y="18" textAnchor="middle" fill="#f1f5f9" fontSize="11" fontWeight="700">
              断路器 QF1 (点击分合)
            </text>
            <rect x="34" y="28" width="44" height="40" rx="5" fill="#0f172a" stroke="#475569" />
            {/* Breaker Toggle Lever */}
            <rect
              x="40"
              y={qfPowerOn ? 32 : 48}
              width="32"
              height="16"
              rx="3"
              fill={qfPowerOn ? '#10b981' : '#ef4444'}
            />
            <text x="56" y="83" textAnchor="middle" fill={qfPowerOn ? '#34d399' : '#f87171'} fontSize="11.2" fontWeight="700">
              {qfPowerOn ? '合闸 ON (I)' : '分闸 OFF (O)'}
            </text>
          </g>
        </g>

        {/* PSU -> QF1 -> Busbar wires */}
        <path
          d="M 57 222 L 57 238 L 158 238 L 158 50"
          fill="none"
          stroke={powerHealthy ? '#ef4444' : '#475569'}
          strokeWidth="2.5"
          className={powerHealthy ? 'dt-wire-flow' : ''}
        />
        <path
          d="M 103 222 L 103 242 L 146 242 L 146 526 L 158 526"
          fill="none"
          stroke={powerHealthy ? '#38bdf8' : '#475569'}
          strokeWidth="2.5"
        />

        {/* ==================== INPUT DEVICES (SB1, SB2, E-STOP, BG1 SENSOR) ==================== */}
        {/* Pushbutton Panel Box */}
        <g transform="translate(168, 74)">
          <rect x="0" y="0" width="166" height="232" rx="10" fill="#131c31" stroke="#334155" strokeWidth="1.4" />
          <text x="12" y="20" fill="#94a3b8" fontSize="11" fontWeight="700">
            现场按钮盒（点击直接操作）
          </text>

          {/* SB1 Start Green NO */}
          <g
            transform="translate(14, 34)"
            style={{ cursor: 'pointer' }}
            onMouseDown={() => setSb1Pressed(true)}
            onMouseUp={() => setSb1Pressed(false)}
            onMouseLeave={() => setSb1Pressed(false)}
            onClick={pulseStart}
          >
            <rect
              x="0"
              y="0"
              width="138"
              height="48"
              rx="7"
              fill={sb1Pressed ? 'rgba(16,185,129,0.22)' : '#1e293b'}
              stroke={sb1Pressed ? '#10b981' : '#334155'}
            />
            <circle cx="24" cy="24" r="14" fill="#064e3b" stroke="#10b981" strokeWidth="2.5" />
            <circle cx="24" cy="24" r={sb1Pressed ? 9 : 11} fill="#10b981" />
            <text x="48" y="20" fill="#f1f5f9" fontSize="11" fontWeight="700">
              SB1 启动 (NO)
            </text>
            <text x="48" y="36" fill="#38bdf8" fontSize="11.2" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
              → %I0.0 [{i00 ? '1' : '0'}]
            </text>
          </g>

          {/* SB2 Stop Red NC */}
          <g
            transform="translate(14, 92)"
            style={{ cursor: 'pointer' }}
            onClick={pulseStop}
          >
            <rect
              x="0"
              y="0"
              width="138"
              height="48"
              rx="7"
              fill={sb2Pressed ? 'rgba(239,68,68,0.2)' : '#1e293b'}
              stroke={sb2Pressed ? '#ef4444' : '#334155'}
            />
            <circle cx="24" cy="24" r="14" fill="#7f1d1d" stroke="#ef4444" strokeWidth="2.5" />
            <circle cx="24" cy="24" r={sb2Pressed ? 9 : 11} fill="#ef4444" />
            <text x="48" y="20" fill="#f1f5f9" fontSize="11" fontWeight="700">
              SB2 停止 (NC)
            </text>
            <text x="48" y="36" fill="#38bdf8" fontSize="11.2" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
              → %I0.1 [{i01 ? '1' : '0'}]
            </text>
          </g>

          {/* E-Stop Mushroom NC */}
          <g
            transform="translate(14, 150)"
            style={{ cursor: 'pointer' }}
            onClick={() => setEStopLatched((v) => !v)}
          >
            <rect
              x="0"
              y="0"
              width="138"
              height="68"
              rx="7"
              fill={eStopLatched ? 'rgba(239,68,68,0.26)' : '#1e293b'}
              stroke={eStopLatched ? '#ef4444' : '#f59e0b'}
              strokeWidth="1.5"
            />
            {/* Yellow E-stop safety collar */}
            <circle cx="26" cy="34" r="18" fill="#facc15" stroke="#ca8a04" strokeWidth="2" />
            <circle
              cx="26"
              cy="34"
              r={eStopLatched ? 11 : 13}
              fill="#dc2626"
              stroke="#991b1b"
              strokeWidth="2"
            />
            <text x="26" y="37" textAnchor="middle" fill="#fff" fontSize="9.8" fontWeight="800">
              STOP
            </text>
            <text x="52" y="24" fill="#fde047" fontSize="11" fontWeight="700">
              急停蘑菇头 (NC)
            </text>
            <text x="52" y="40" fill={eStopLatched ? '#f87171' : '#34d399'} fontSize="11.2" fontWeight="700">
              {eStopLatched ? '已拍下锁止!' : '正常闭合 OK'}
            </text>
            <text x="52" y="55" fill="#38bdf8" fontSize="11.2" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
              → %I0.2 [{i02 ? '1' : '0'}]
            </text>
          </g>
        </g>

        {/* 3-Wire Diffuse Photoelectric Sensor BG1 (PNP vs NPN Interactive Lab!) */}
        <g transform="translate(164, 322)">
          <rect
            x="0"
            y="0"
            width="174"
            height="184"
            rx="10"
            fill="#131c31"
            stroke={sensorWiringValid ? '#009999' : '#ef4444'}
            strokeWidth="1.8"
          />
          <text x="11" y="21" fill="#5eead4" fontSize="11.5" fontWeight="700">
            漫反射光电 BG1
          </text>
          <rect
            x="120"
            y="7"
            width="44"
            height="19"
            rx="4"
            fill={sensorType === 'PNP' ? '#0f766e' : '#b45309'}
          />
          <text x="142" y="20" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="800">
            {sensorType}
          </text>

          {/* Sensor Body */}
          <rect x="12" y="34" width="72" height="42" rx="5" fill="#334155" stroke="#94a3b8" strokeWidth="1.4" />
          <rect x="78" y="43" width="10" height="24" rx="2" fill="#0ea5e9" />
          {/* Sensor indicator LED */}
          <circle
            cx="26"
            cy="46"
            r="4.2"
            fill={powerHealthy && targetPresent ? '#f59e0b' : '#475569'}
          />
          <text x="36" y="50" fill="#f8fafc" fontSize="10.5" fontWeight="700">
            BG1
          </text>
          <text x="17" y="68" fill="#cbd5e1" fontSize="11" fontWeight="600">
            BN+ BU- BK
          </text>

          {/* Infrared Beam & Interactive Target Box */}
          <line
            x1="88"
            y1="55"
            x2={targetPresent ? 118 : 160}
            y2="55"
            stroke={powerHealthy ? '#f43f5e' : '#475569'}
            strokeWidth="2.5"
            strokeDasharray="4 3"
          />
          <g
            style={{ cursor: 'pointer' }}
            onClick={() => setTargetPresent((v) => !v)}
          >
            <rect
              x="118"
              y="36"
              width="44"
              height="38"
              rx="5"
              fill={targetPresent ? '#38bdf8' : 'rgba(148,163,184,0.14)'}
              stroke={targetPresent ? '#bae6fd' : '#94a3b8'}
              strokeDasharray={targetPresent ? undefined : '3 3'}
            />
            <text
              x="140"
              y="59"
              textAnchor="middle"
              fill={targetPresent ? '#0f172a' : '#e2e8f0'}
              fontSize="10.5"
              fontWeight="700"
            >
              {targetPresent ? '有工件' : '点放件'}
            </text>
          </g>

          {/* Internal Output Polarity Explanation */}
          <rect x="10" y="84" width="154" height="56" rx="6" fill="#0b1222" stroke="#26354d" />
          <text x="16" y="101" fill="#e2e8f0" fontSize="10.5" fontWeight="700">
            黑线输出：
            <tspan fill={sensorType === 'PNP' ? '#fca5a5' : '#7dd3fc'}>
              {sensorType === 'PNP' ? '+24V (源型)' : '0V (漏型)'}
            </tspan>
          </text>
          <text x="16" y="118" fill="#cbd5e1" fontSize="10.5">
            1M 公共端：
            <tspan fill={common1M === 'M' ? '#7dd3fc' : '#fca5a5'} fontWeight="700">
              {common1M === 'M' ? '接 M (0V)' : '接 L+ (24V)'}
            </tspan>
          </text>
          <text
            x="16"
            y="134"
            fill={sensorWiringValid ? '#34d399' : '#f87171'}
            fontSize="10.5"
            fontWeight="700"
          >
            {sensorWiringValid ? '✓ 压差 24V，光耦导通' : '✗ 压差 0V，回路不通!'}
          </text>

          {/* 3-Wire color tags */}
          <text x="12" y="157" fill="#fca5a5" fontSize="11.2" fontWeight="700">
            棕→L+
          </text>
          <text x="65" y="157" fill="#7dd3fc" fontSize="11.2" fontWeight="700">
            蓝→M
          </text>
          <text x="112" y="157" fill="#fde047" fontSize="11.2" fontWeight="700">
            黑→I0.3
          </text>
          <text x="12" y="175" fill="#94a3b8" fontSize="11.2">
            点击右上框放入/移开检测工件
          </text>
        </g>

        {/* ==================== WIRING LINES FROM FIELD INPUTS TO S7-1200 ==================== */}
        {/* Button Supply Rail Feed */}
        <path
          d={
            buttonRail === 'L+'
              ? 'M 250 50 L 250 74'
              : 'M 162 526 L 162 190 L 168 190'
          }
          fill="none"
          stroke={powerHealthy ? (buttonRail === 'L+' ? '#ef4444' : '#38bdf8') : '#475569'}
          strokeWidth="2"
        />

        {/* %I0.0 wire (SB1 -> CPU DIa.0) */}
        <path
          d="M 334 132 L 424 132 L 424 98 L 490 98 L 490 124"
          fill="none"
          stroke={i00 ? '#10b981' : '#475569'}
          strokeWidth={i00 ? 2.8 : 1.8}
          className={i00 ? 'dt-wire-flow' : ''}
        />
        {/* %I0.1 wire (SB2 -> CPU DIa.1) */}
        <path
          d="M 334 190 L 434 190 L 434 106 L 516 106 L 516 124"
          fill="none"
          stroke={i01 ? '#38bdf8' : '#475569'}
          strokeWidth={i01 ? 2.5 : 1.8}
          className={i01 ? 'dt-wire-flow' : ''}
        />
        {/* %I0.2 wire (E-Stop -> CPU DIa.2) */}
        <path
          d="M 334 258 L 444 258 L 444 114 L 542 114 L 542 124"
          fill="none"
          stroke={i02 ? '#38bdf8' : '#ef4444'}
          strokeWidth={i02 ? 2.5 : 2}
          strokeDasharray={i02 ? undefined : '4 4'}
          className={i02 ? 'dt-wire-flow' : ''}
        />
        {/* %I0.3 wire (Photo BG1 BK -> CPU DIa.3) */}
        <path
          d="M 334 405 L 368 405 L 368 88 L 568 88 L 568 124"
          fill="none"
          stroke={
            !targetPresent
              ? '#64748b'
              : sensorWiringValid
                ? '#f59e0b'
                : '#ef4444'
          }
          strokeWidth={targetPresent ? 3 : 1.8}
          strokeDasharray={targetPresent && !sensorWiringValid ? '5 4' : undefined}
          className={sensorFlowClass}
        />
        {targetPresent && !sensorWiringValid && (
          <g transform="translate(342, 300)">
            <rect x="0" y="0" width="96" height="24" rx="4" fill="#991b1b" stroke="#f87171" />
            <text x="48" y="15" textAnchor="middle" fill="#fecaca" fontSize="11.2" fontWeight="800">
              ✗ 0V 无压差!
            </text>
          </g>
        )}

        {/* 1M Common Terminal Jumper Wire (Clickable!) */}
        <path
          d={
            common1M === 'M'
              ? 'M 464 124 L 464 68 L 385 68 L 385 526'
              : 'M 464 124 L 464 50'
          }
          fill="none"
          stroke={common1M === 'M' ? '#38bdf8' : '#ef4444'}
          strokeWidth="3"
          className={i03 || i00 || i01 ? (common1M === 'M' ? 'dt-wire-flow' : 'dt-wire-flow-rev') : ''}
        />

        {/* CPU Power L+ / M feed */}
        <path
          d="M 412 124 L 412 50"
          fill="none"
          stroke={powerHealthy ? '#ef4444' : '#475569'}
          strokeWidth="2.4"
        />
        <path
          d="M 438 124 L 438 78 L 395 78 L 395 526"
          fill="none"
          stroke={powerHealthy ? '#38bdf8' : '#475569'}
          strokeWidth="2.4"
        />

        {/* ==================== CENTERPIECE: SIEMENS S7-1200 CPU 1214C DC/DC/DC ==================== */}
        <g transform="translate(396, 124)">
          {/* Main Industrial Housing */}
          <rect
            x="0"
            y="0"
            width="284"
            height="302"
            rx="8"
            fill="url(#s7Body)"
            stroke="#64748b"
            strokeWidth="2"
          />

          {/* Top Removable Terminal Block (L+, M, 1M, DI a.0~a.7) */}
          <rect x="6" y="4" width="272" height="44" rx="4" fill="#1e293b" stroke="#475569" />
          {[
            { lbl: 'L+', x: 16, active: powerHealthy, color: '#ef4444' },
            { lbl: 'M', x: 42, active: powerHealthy, color: '#38bdf8' },
            { lbl: '1M', x: 68, active: true, color: common1M === 'M' ? '#38bdf8' : '#ef4444' },
            { lbl: '.0', x: 94, active: i00, color: '#10b981' },
            { lbl: '.1', x: 120, active: i01, color: '#10b981' },
            { lbl: '.2', x: 146, active: i02, color: '#10b981' },
            { lbl: '.3', x: 172, active: i03, color: '#10b981' },
            { lbl: '.4', x: 198, active: i04, color: '#10b981' },
            { lbl: '.5', x: 224, active: false, color: '#10b981' },
            { lbl: '.6', x: 250, active: false, color: '#10b981' },
          ].map((term) => (
            <g
              key={term.lbl}
              transform={`translate(${term.x}, 8)`}
              style={term.lbl === '1M' ? { cursor: 'pointer' } : undefined}
              onClick={
                term.lbl === '1M' ? () => setCommon1M((c) => (c === 'M' ? 'L+' : 'M')) : undefined
              }
            >
              <circle
                cx="0"
                cy="9"
                r="6.5"
                fill="#0f172a"
                stroke={term.active ? term.color : '#64748b'}
                strokeWidth="1.8"
              />
              <line x1="-3.5" y1="9" x2="3.5" y2="9" stroke="#94a3b8" strokeWidth="1.2" />
              <text
                x="0"
                y="30"
                textAnchor="middle"
                fill={term.lbl === '1M' ? '#fde047' : '#cbd5e1'}
                fontSize="10.4"
                fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                fontWeight="700"
              >
                {term.lbl}
              </text>
            </g>
          ))}

          {/* Siemens Brand Header & Model Name */}
          <text x="14" y="68" fill="#14d4d4" fontSize="13.5" fontWeight="900" letterSpacing="1">
            SIEMENS
          </text>
          <text x="14" y="84" fill="#f8fafc" fontSize="11.5" fontWeight="700">
            SIMATIC S7-1200
          </text>
          <text x="14" y="99" fill="#cbd5e1" fontSize="11.2" fontWeight="600">
            1214C DC/DC/DC
          </text>

          {/* Front Panel 3-Color Status LEDs: RUN/STOP, ERROR, MAINT */}
          <g transform="translate(14, 108)">
            <rect x="0" y="0" width="100" height="60" rx="5" fill="#0f172a" stroke="#334155" />
            {/* RUN/STOP LED */}
            <circle
              cx="15"
              cy="15"
              r="4.5"
              fill={!powerHealthy ? '#334155' : cpuRun ? '#10b981' : '#f59e0b'}
              filter={powerHealthy && cpuRun ? 'url(#glowGreen)' : undefined}
            />
            <text x="26" y="19" fill="#e2e8f0" fontSize="11.2" fontWeight="700">
              RUN/STOP
            </text>
            {/* ERROR LED */}
            <circle
              cx="15"
              cy="32"
              r="4.5"
              fill={cpuStatus === 'fault' ? '#ef4444' : '#334155'}
              className={cpuStatus === 'fault' ? 'dt-blink' : ''}
              filter={cpuStatus === 'fault' ? 'url(#glowRed)' : undefined}
            />
            <text x="26" y="36" fill="#e2e8f0" fontSize="11.2" fontWeight="700">
              ERROR
            </text>
            {/* MAINT LED */}
            <circle
              cx="15"
              cy="48"
              r="4.5"
              fill={mode === 'manual' && powerHealthy ? '#f59e0b' : '#334155'}
            />
            <text x="26" y="52" fill="#e2e8f0" fontSize="11.2" fontWeight="700">
              MAINT
            </text>
          </g>

          {/* Internal Bidirectional Optocoupler Live Cutaway Box! */}
          <g transform="translate(120, 58)">
            <rect
              x="0"
              y="0"
              width="154"
              height="110"
              rx="6"
              fill="#0b1324"
              stroke={sensorWiringValid ? '#009999' : '#ef4444'}
              strokeWidth="1.4"
            />
            <text x="77" y="17" textAnchor="middle" fill="#5eead4" fontSize="10.5" fontWeight="700">
              DI a.3 双向光耦解剖
            </text>
            {/* Bidirectional LED pair symbol */}
            <line x1="16" y1="45" x2="48" y2="45" stroke="#94a3b8" strokeWidth="1.6" />
            <line x1="104" y1="45" x2="138" y2="45" stroke="#94a3b8" strokeWidth="1.6" />
            <line x1="48" y1="31" x2="48" y2="59" stroke="#94a3b8" strokeWidth="1.6" />
            <line x1="104" y1="31" x2="104" y2="59" stroke="#94a3b8" strokeWidth="1.6" />
            {/* PNP LED (left -> right) */}
            <polygon
              points="66,26 66,38 84,32"
              fill={i03 && sensorType === 'PNP' ? '#10b981' : '#334155'}
              stroke="#cbd5e1"
              strokeWidth="1"
            />
            {/* NPN LED (right -> left) */}
            <polygon
              points="84,52 84,64 66,58"
              fill={i03 && sensorType === 'NPN' ? '#10b981' : '#334155'}
              stroke="#cbd5e1"
              strokeWidth="1"
            />
            <text x="12" y="39" fill="#fde047" fontSize="11.2" fontWeight="700">
              I0.3
            </text>
            <text x="116" y="39" fill="#fde047" fontSize="11.2" fontWeight="700">
              1M
            </text>
            <text x="77" y="82" textAnchor="middle" fill={i03 ? '#34d399' : '#cbd5e1'} fontSize="11.2" fontWeight="700">
              {i03
                ? sensorType === 'PNP'
                  ? '导通: I0.3 ──▶ 1M(0V)'
                  : '导通: 1M(24V) ──▶ I0.3'
                : targetPresent && !sensorWiringValid
                  ? '同电位截止 (0V 压差)'
                  : '等待触发信号...'}
            </text>
            <text x="77" y="100" textAnchor="middle" fill="#94a3b8" fontSize="11">
              兼容源型与漏型输入
            </text>
          </g>

          {/* Channel LED Arrays (DI a .0~.7 and DQ a .0~.7) */}
          <g transform="translate(14, 178)">
            <rect x="0" y="0" width="164" height="64" rx="5" fill="#0f172a" stroke="#334155" />
            <text x="8" y="15" fill="#cbd5e1" fontSize="11.2" fontWeight="700">
              DI a (.0 - .7)
            </text>
            {[i00, i01, i02, i03, i04, false, false, false].map((on, idx) => (
              <g key={`di-${idx}`} transform={`translate(${14 + idx * 19}, 24)`}>
                <circle
                  cx="0"
                  cy="0"
                  r="4.2"
                  fill={on ? '#10b981' : '#1e293b'}
                  stroke="#64748b"
                  filter={on ? 'url(#glowGreen)' : undefined}
                />
                <text x="0" y="14" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="600">
                  .{idx}
                </text>
              </g>
            ))}

            <text x="8" y="48" fill="#cbd5e1" fontSize="11.2" fontWeight="700">
              DQ a (.0 - .7)
            </text>
            {[q00, q01, q02, false, false, false, false, false].map((on, idx) => (
              <g key={`dq-${idx}`} transform={`translate(${14 + idx * 19}, 56)`}>
                <circle
                  cx="0"
                  cy="0"
                  r="4.2"
                  fill={on ? '#10b981' : '#1e293b'}
                  stroke="#64748b"
                  filter={on ? 'url(#glowGreen)' : undefined}
                />
              </g>
            ))}
          </g>

          {/* PROFINET RJ45 Port */}
          <g transform="translate(186, 178)">
            <rect x="0" y="0" width="88" height="64" rx="5" fill="#0f172a" stroke="#475569" />
            <text x="44" y="14" textAnchor="middle" fill="#14d4d4" fontSize="11" fontWeight="800">
              PROFINET X1
            </text>
            <rect x="26" y="20" width="36" height="26" rx="3" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
            <rect x="33" y="25" width="22" height="15" fill="#020617" />
            {/* Link / RxTx LEDs */}
            <circle cx="15" cy="32" r="3.2" fill={powerHealthy ? '#10b981' : '#334155'} />
            <circle cx="73" cy="32" r="3.2" fill={powerHealthy && lanBlink ? '#f59e0b' : '#334155'} />
            <text x="44" y="59" textAnchor="middle" fill="#cbd5e1" fontSize="11" fontWeight="600">
              192.168.0.1
            </text>
          </g>

          {/* Bottom Removable Terminal Block (3L+, 3M, DQ a.0~a.7) */}
          <rect x="6" y="254" width="272" height="44" rx="4" fill="#1e293b" stroke="#475569" />
          {[
            { lbl: '3L+', x: 18, active: powerHealthy, color: '#ef4444' },
            { lbl: '3M', x: 46, active: powerHealthy, color: '#38bdf8' },
            { lbl: '.0', x: 80, active: q00, color: '#10b981' },
            { lbl: '.1', x: 108, active: q01, color: '#10b981' },
            { lbl: '.2', x: 136, active: q02, color: '#ef4444' },
            { lbl: '.3', x: 164, active: false, color: '#10b981' },
            { lbl: '.4', x: 192, active: false, color: '#10b981' },
            { lbl: '.5', x: 220, active: false, color: '#10b981' },
            { lbl: '.6', x: 248, active: false, color: '#10b981' },
          ].map((term) => (
            <g key={`dq-t-${term.lbl}`} transform={`translate(${term.x}, 258)`}>
              <text
                x="0"
                y="11"
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize="10.4"
                fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                fontWeight="700"
              >
                {term.lbl}
              </text>
              <circle
                cx="0"
                cy="25"
                r="6.5"
                fill="#0f172a"
                stroke={term.active ? term.color : '#64748b'}
                strokeWidth="1.8"
              />
              <line x1="-3.5" y1="25" x2="3.5" y2="25" stroke="#94a3b8" strokeWidth="1.2" />
            </g>
          ))}
        </g>

        {/* Bottom 3L+ / 3M feeds to CPU DQ Bank */}
        <path
          d="M 414 426 L 414 494 L 694 494 L 694 50"
          fill="none"
          stroke={powerHealthy ? '#ef4444' : '#475569'}
          strokeWidth="2"
          opacity="0.7"
        />
        <path
          d="M 442 426 L 442 526"
          fill="none"
          stroke={powerHealthy ? '#38bdf8' : '#475569'}
          strokeWidth="2"
        />

        {/* ==================== OUTPUT LOAD CHAIN (KA1 -> KM1 -> 3-PHASE MOTOR M1) ==================== */}
        {/* %Q0.0 wire -> KA1 Coil -> M */}
        <path
          d="M 476 426 L 476 474 L 748 474 L 748 250"
          fill="none"
          stroke={q00 ? '#10b981' : '#475569'}
          strokeWidth={q00 ? 3 : 1.8}
          className={q00 ? 'dt-wire-flow' : ''}
        />
        {/* %Q0.1 wire -> Green Run Lamp -> M */}
        <path
          d="M 504 426 L 504 462 L 774 462 L 774 424"
          fill="none"
          stroke={q01 ? '#10b981' : '#475569'}
          strokeWidth={q01 ? 2.5 : 1.5}
          className={q01 ? 'dt-wire-flow' : ''}
        />
        {/* %Q0.2 wire -> Red Fault Lamp -> M */}
        <path
          d="M 532 426 L 532 450 L 856 450 L 856 424"
          fill="none"
          stroke={q02 ? '#ef4444' : '#475569'}
          strokeWidth={q02 ? 2.5 : 1.5}
          className={q02 ? 'dt-wire-flow' : ''}
        />

        {/* Right Side Output Panel */}
        <g transform="translate(716, 74)">
          {/* 24V Intermediate Relay KA1 */}
          <rect
            x="0"
            y="0"
            width="130"
            height="176"
            rx="9"
            fill="#131c31"
            stroke={q00 ? '#10b981' : '#334155'}
            strokeWidth="1.6"
          />
          <text x="65" y="20" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">
            中间继电器 KA1
          </text>
          <text x="65" y="34" textAnchor="middle" fill="#94a3b8" fontSize="11">
            DC24V 线圈 (带续流二极管)
          </text>
          {/* Relay Coil */}
          <rect
            x="18"
            y="48"
            width="42"
            height="58"
            rx="4"
            fill={q00 ? 'rgba(16,185,129,0.22)' : '#0f172a'}
            stroke={q00 ? '#10b981' : '#64748b'}
            strokeWidth="2"
          />
          <text x="39" y="81" textAnchor="middle" fill={q00 ? '#34d399' : '#94a3b8'} fontSize="11.2" fontWeight="700">
            A1/A2
          </text>
          {/* Flyback diode symbol */}
          <polygon points="78,70 90,70 84,58" fill="#38bdf8" opacity="0.85" />
          <line x1="77" y1="58" x2="91" y2="58" stroke="#38bdf8" strokeWidth="1.8" />
          <text x="84" y="88" textAnchor="middle" fill="#7dd3fc" fontSize="10.4">
            续流保护
          </text>
          {/* Relay NO contact moving blade */}
          <line x1="20" y1="138" x2="54" y2="138" stroke="#f59e0b" strokeWidth="2.2" />
          <line
            x1="54"
            y1="138"
            x2={q00 ? 86 : 82}
            y2={q00 ? 138 : 122}
            stroke={q00 ? '#10b981' : '#f59e0b'}
            strokeWidth="2.6"
          />
          <line x1="86" y1="138" x2="112" y2="138" stroke="#f59e0b" strokeWidth="2.2" />
          <text x="65" y="162" textAnchor="middle" fill={q00 ? '#34d399' : '#94a3b8'} fontSize="11.2" fontWeight="700">
            {q00 ? 'KA1 吸合 → 驱动 KM1' : 'KA1 释放 (断弧隔离)'}
          </text>

          {/* AC Contactor KM1 + 3-Phase Induction Motor M1 */}
          <g transform="translate(142, 0)">
            <rect
              x="0"
              y="0"
              width="162"
              height="350"
              rx="10"
              fill="#131c31"
              stroke={q00 ? '#10b981' : frOverload ? '#ef4444' : '#334155'}
              strokeWidth="1.6"
            />
            <text x="81" y="20" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">
              接触器 KM1 + 三相电机 M1
            </text>
            <text x="81" y="35" textAnchor="middle" fill="#fbbf24" fontSize="11" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
              3~ AC380V L1 / L2 / L3
            </text>

            {/* 3-Phase Contactor Contacts */}
            {[42, 81, 120].map((cx, idx) => (
              <g key={`phase-${idx}`}>
                <line x1={cx} y1="42" x2={cx} y2="66" stroke="#f59e0b" strokeWidth="2.5" />
                <line
                  x1={cx}
                  y1="66"
                  x2={q00 ? cx : cx - 10}
                  y2={q00 ? 94 : 90}
                  stroke={q00 ? '#10b981' : '#f59e0b'}
                  strokeWidth="2.8"
                />
                <line
                  x1={cx}
                  y1="94"
                  x2={cx}
                  y2="132"
                  stroke={q00 ? '#10b981' : '#475569'}
                  strokeWidth="2.5"
                  className={q00 ? 'dt-wire-flow' : ''}
                />
              </g>
            ))}
            {/* Mechanical linkage dashed bar */}
            <line x1="34" y1="80" x2="128" y2="80" stroke="#94a3b8" strokeDasharray="3 3" strokeWidth="1.4" />
            <text x="81" y="114" textAnchor="middle" fill={q00 ? '#34d399' : '#94a3b8'} fontSize="11" fontWeight="700">
              {q00 ? 'KM1 主触点闭合' : 'KM1 主触点断开'}
            </text>

            {/* Thermal Overload Relay FR1 Badge */}
            <g
              transform="translate(18, 124)"
              style={{ cursor: 'pointer' }}
              onClick={() => setFrOverload((v) => !v)}
            >
              <rect
                x="0"
                y="0"
                width="126"
                height="30"
                rx="5"
                fill={frOverload ? 'rgba(239,68,68,0.28)' : '#0f172a'}
                stroke={frOverload ? '#ef4444' : '#475569'}
              />
              <text
                x="63"
                y="19"
                textAnchor="middle"
                fill={frOverload ? '#fca5a5' : '#cbd5e1'}
                fontSize="11"
                fontWeight="700"
              >
                热继电器 FR1：{frOverload ? '过载跳闸!' : '正常 (%I0.4=1)'}
              </text>
            </g>

            {/* 3-Phase Induction Motor Body + Spinning Cooling Fan */}
            <g transform="translate(81, 232)">
              <circle cx="0" cy="0" r="56" fill="url(#motorShell)" stroke="#60a5fa" strokeWidth="2.5" />
              <circle cx="0" cy="0" r="44" fill="#0f172a" stroke="#334155" strokeWidth="2" />
              {/* Rotating Cooling Fan Blades */}
              <g transform={`rotate(${fanAngle})`}>
                {[0, 60, 120, 180, 240, 300].map((deg) => (
                  <path
                    key={deg}
                    d="M 0 -6 L 10 -36 A 36 36 0 0 1 22 -30 L 6 -2 Z"
                    fill={q00 ? '#38bdf8' : '#64748b'}
                    transform={`rotate(${deg})`}
                  />
                ))}
                <circle cx="0" cy="0" r="10" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
              </g>
              <text x="0" y="75" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">
                3~ 异步电机 M1
              </text>
              <text x="0" y="92" textAnchor="middle" fill="#34d399" fontSize="11" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif" fontWeight="700">
                {motorRpm} RPM · {motorCurrent} A
              </text>
            </g>
          </g>

          {/* Pilot Lamps HL1 (Run Green) & HL2 (Fault Red) */}
          <g transform="translate(0, 266)">
            <rect x="0" y="0" width="132" height="86" rx="9" fill="#131c31" stroke="#334155" />
            <text x="66" y="18" textAnchor="middle" fill="#cbd5e1" fontSize="10.8" fontWeight="700">
              电控柜门指示灯
            </text>
            {/* HL1 Run */}
            <circle
              cx="34"
              cy="44"
              r="13"
              fill={q01 ? '#10b981' : '#064e3b'}
              stroke="#34d399"
              strokeWidth="2"
              filter={q01 ? 'url(#glowGreen)' : undefined}
            />
            <text x="34" y="71" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="600">
              运行 Q0.1
            </text>
            {/* HL2 Fault */}
            <circle
              cx="98"
              cy="44"
              r="13"
              fill={q02 ? '#ef4444' : '#450a0a'}
              stroke="#f87171"
              strokeWidth="2"
              className={q02 ? 'dt-blink' : ''}
              filter={q02 ? 'url(#glowRed)' : undefined}
            />
            <text x="98" y="71" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="600">
              故障 Q0.2
            </text>
          </g>
        </g>

        {/* Return wires from KA1 & Pilot Lamps to 0V M Busbar */}
        <line x1="782" y1="424" x2="782" y2="526" stroke={powerHealthy ? '#38bdf8' : '#475569'} strokeWidth="1.8" />
        <line x1="810" y1="424" x2="810" y2="526" stroke={powerHealthy ? '#38bdf8' : '#475569'} strokeWidth="1.8" />
      </svg>
    </TwinShell>
      )}
    </div>
  );
};
