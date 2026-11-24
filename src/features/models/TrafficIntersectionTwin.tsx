import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Footprints, Moon, ShieldAlert, Siren, Sun } from 'lucide-react';
import type { PlcRuntime } from '../../types/plc';
import {
  TwinShell,
  type FaultSwitchItem,
  type IoSignalItem,
  type ParamSliderItem,
  type TwinControlMode,
} from './components/TwinShell';

export interface TrafficIntersectionProps {
  runtime?: PlcRuntime;
  embedded?: boolean;
}

type TrafficOpMode = 'day' | 'night' | 'emergency';
type PhaseKey =
  | 'EW_GREEN'
  | 'EW_GREEN_BLINK'
  | 'EW_YELLOW'
  | 'ALL_RED_TO_NS'
  | 'NS_GREEN'
  | 'NS_GREEN_BLINK'
  | 'NS_YELLOW'
  | 'ALL_RED_TO_EW'
  | 'PED_CROSS';

interface Vehicle {
  id: number;
  dir: 'E' | 'W' | 'N' | 'S';
  pos: number; // 0..1040 for E/W, 0..560 for N/S
  speed: number;
  maxSpeed: number;
  color: string;
  isFireTruck?: boolean;
}

const CX = 520;
const CY = 280;

export const TrafficIntersectionTwin: React.FC<TrafficIntersectionProps> = ({ embedded = false }) => {
  const [controlMode, setControlMode] = useState<TwinControlMode>('auto');
  const [paused, setPaused] = useState(false);

  // Intersection operating mode & requests
  const [opMode, setOpMode] = useState<TrafficOpMode>('day');
  const [pedRequest, setPedRequest] = useState(false);

  // Timing parameters
  const [ewGreenSec, setEwGreenSec] = useState(10);
  const [nsGreenSec, setNsGreenSec] = useState(7);
  const [trafficDensity, setTrafficDensity] = useState(65); // %

  // Field faults / Safety interlock test
  const [faultGreenConflict, setFaultGreenConflict] = useState(false);
  const [conflictTripped, setConflictTripped] = useState(false);

  // Manual force signals (%Q0.0..%Q0.5)
  const [manualQ, setManualQ] = useState({
    ewR: false,
    ewY: false,
    ewG: true,
    nsR: true,
    nsY: false,
    nsG: false,
  });

  // Live signal state
  const [phase, setPhase] = useState<PhaseKey>('EW_GREEN');
  const [countdown, setCountdown] = useState(10);
  const [blinkOn, setBlinkOn] = useState(true);
  const [pedProgress, setPedProgress] = useState(0);

  const [vehicles, setVehicles] = useState<Vehicle[]>([
    { id: 1, dir: 'E', pos: 180, speed: 120, maxSpeed: 135, color: '#38bdf8' },
    { id: 2, dir: 'W', pos: 840, speed: 110, maxSpeed: 130, color: '#f59e0b' },
    { id: 3, dir: 'S', pos: 90, speed: 0, maxSpeed: 125, color: '#a78bfa' },
    { id: 4, dir: 'N', pos: 470, speed: 0, maxSpeed: 125, color: '#34d399' },
  ]);

  const simRef = useRef({
    phase: 'EW_GREEN' as PhaseKey,
    phaseRemainingMs: 10000,
    blinkAccumMs: 0,
    blinkOn: true,
    spawnAccumMs: 0,
    nextVehId: 5,
    pedRequest: false,
    vehicles: [
      { id: 1, dir: 'E' as const, pos: 180, speed: 120, maxSpeed: 135, color: '#38bdf8' },
      { id: 2, dir: 'W' as const, pos: 840, speed: 110, maxSpeed: 130, color: '#f59e0b' },
      { id: 3, dir: 'S' as const, pos: 90, speed: 0, maxSpeed: 125, color: '#a78bfa' },
      { id: 4, dir: 'N' as const, pos: 470, speed: 0, maxSpeed: 125, color: '#34d399' },
    ] as Vehicle[],
  });

  useEffect(() => {
    simRef.current.pedRequest = pedRequest;
  }, [pedRequest]);

  // Spawn emergency fire truck when entering Emergency Green Wave
  const triggerEmergencyMode = () => {
    setOpMode((prev) => {
      const next = prev === 'emergency' ? 'day' : 'emergency';
      if (next === 'emergency') {
        const s = simRef.current;
        s.vehicles = [
          ...s.vehicles.filter((v) => !v.isFireTruck),
          {
            id: s.nextVehId++,
            dir: 'E',
            pos: 20,
            speed: 175,
            maxSpeed: 195,
            color: '#ef4444',
            isFireTruck: true,
          },
        ];
      }
      return next;
    });
  };

  // Compute raw PLC Lamp Outputs BEFORE Hardware Green-Conflict Interlock
  const rawOutputs = useMemo(() => {
    if (controlMode === 'manual') {
      return {
        ewR: manualQ.ewR,
        ewY: manualQ.ewY,
        ewG: manualQ.ewG || faultGreenConflict,
        nsR: manualQ.nsR,
        nsY: manualQ.nsY,
        nsG: manualQ.nsG || faultGreenConflict,
        pedWalk: false,
      };
    }

    if (opMode === 'night') {
      return {
        ewR: false,
        ewY: blinkOn,
        ewG: faultGreenConflict,
        nsR: false,
        nsY: blinkOn,
        nsG: faultGreenConflict,
        pedWalk: false,
      };
    }

    if (opMode === 'emergency') {
      return {
        ewR: false,
        ewY: false,
        ewG: true,
        nsR: !faultGreenConflict,
        nsY: false,
        nsG: faultGreenConflict,
        pedWalk: false,
      };
    }

    // Standard Day Sequence + Pedestrian Priority
    let ewR = false;
    let ewY = false;
    let ewG = false;
    let nsR = false;
    let nsY = false;
    let nsG = false;
    let pedWalk = false;

    switch (phase) {
      case 'EW_GREEN':
        ewG = true;
        nsR = true;
        break;
      case 'EW_GREEN_BLINK':
        ewG = blinkOn;
        nsR = true;
        break;
      case 'EW_YELLOW':
        ewY = true;
        nsR = true;
        break;
      case 'ALL_RED_TO_NS':
      case 'ALL_RED_TO_EW':
        ewR = true;
        nsR = true;
        break;
      case 'NS_GREEN':
        ewR = true;
        nsG = true;
        break;
      case 'NS_GREEN_BLINK':
        ewR = true;
        nsG = blinkOn;
        break;
      case 'NS_YELLOW':
        ewR = true;
        nsY = true;
        break;
      case 'PED_CROSS':
        ewR = true;
        nsR = true;
        pedWalk = true;
        break;
    }

    if (faultGreenConflict) {
      ewG = true;
      nsG = true;
    }
    return { ewR, ewY, ewG, nsR, nsY, nsG, pedWalk };
  }, [controlMode, manualQ, opMode, phase, blinkOn, faultGreenConflict]);

  // Independent Hardware Green-Conflict Interlock Detector: (EW_G AND NS_G) -> Fail-Safe All-Yellow Blink!
  const hasActiveConflict = rawOutputs.ewG && rawOutputs.nsG;
  useEffect(() => {
    if (hasActiveConflict) {
      setConflictTripped(true);
    }
  }, [hasActiveConflict]);

  const effectiveLamps = useMemo(() => {
    if (conflictTripped) {
      // Fail-Safe degraded mode: Hardware safety relay kills all greens & flashes yellows!
      return {
        ewR: false,
        ewY: blinkOn,
        ewG: false,
        nsR: false,
        nsY: blinkOn,
        nsG: false,
        pedWalk: false,
      };
    }
    return rawOutputs;
  }, [conflictTripped, blinkOn, rawOutputs]);

  // Keep effectiveLamps accessible to 40ms vehicle physics loop without restarting interval
  const lampsRef = useRef(effectiveLamps);
  useEffect(() => {
    lampsRef.current = effectiveLamps;
  }, [effectiveLamps]);

  // Main 40ms Sequencer + Vehicle Kinematics Loop
  useEffect(() => {
    if (paused) return;
    const dtMs = 40;
    const dt = dtMs / 1000;

    const timer = window.setInterval(() => {
      const s = simRef.current;

      // 1Hz flasher clock
      s.blinkAccumMs += dtMs;
      if (s.blinkAccumMs >= 500) {
        s.blinkAccumMs = 0;
        s.blinkOn = !s.blinkOn;
        setBlinkOn(s.blinkOn);
      }

      // Auto sequence state machine (runs in day mode when no conflict lock)
      if (controlMode === 'auto' && opMode === 'day' && !conflictTripped) {
        // If pedestrian requested while main green has plenty of time, shorten green to max 3s
        if (s.pedRequest && (s.phase === 'EW_GREEN' || s.phase === 'NS_GREEN') && s.phaseRemainingMs > 3000) {
          s.phaseRemainingMs = 3000;
        }

        s.phaseRemainingMs -= dtMs;
        if (s.phaseRemainingMs <= 0) {
          switch (s.phase) {
            case 'EW_GREEN':
              s.phase = 'EW_GREEN_BLINK';
              s.phaseRemainingMs = 3000;
              break;
            case 'EW_GREEN_BLINK':
              s.phase = 'EW_YELLOW';
              s.phaseRemainingMs = 2000;
              break;
            case 'EW_YELLOW':
              s.phase = 'ALL_RED_TO_NS';
              s.phaseRemainingMs = 1500;
              break;
            case 'ALL_RED_TO_NS':
              if (s.pedRequest) {
                s.phase = 'PED_CROSS';
                s.phaseRemainingMs = 6500;
                s.pedRequest = false;
                setPedRequest(false);
              } else {
                s.phase = 'NS_GREEN';
                s.phaseRemainingMs = nsGreenSec * 1000;
              }
              break;
            case 'PED_CROSS':
              s.phase = 'NS_GREEN';
              s.phaseRemainingMs = nsGreenSec * 1000;
              break;
            case 'NS_GREEN':
              s.phase = 'NS_GREEN_BLINK';
              s.phaseRemainingMs = 3000;
              break;
            case 'NS_GREEN_BLINK':
              s.phase = 'NS_YELLOW';
              s.phaseRemainingMs = 2000;
              break;
            case 'NS_YELLOW':
              s.phase = 'ALL_RED_TO_EW';
              s.phaseRemainingMs = 1500;
              break;
            case 'ALL_RED_TO_EW':
              s.phase = 'EW_GREEN';
              s.phaseRemainingMs = ewGreenSec * 1000;
              break;
          }
          setPhase(s.phase);
        }
        setCountdown(Math.max(0, Math.ceil(s.phaseRemainingMs / 1000)));
        if (s.phase === 'PED_CROSS') {
          setPedProgress(1 - Math.max(0, s.phaseRemainingMs) / 6500);
        } else {
          setPedProgress(0);
        }
      }

      // Vehicle Physics (Red-light stopping & car-following queue)
      const lamps = lampsRef.current;
      const ewCanGo = lamps.ewG || (opMode === 'night' && !conflictTripped);
      const nsCanGo = lamps.nsG || (opMode === 'night' && !conflictTripped);

      const palette = ['#38bdf8', '#f59e0b', '#a78bfa', '#34d399', '#e2e8f0', '#fb7185'];
      s.spawnAccumMs += dtMs;
      const spawnPeriod = Math.max(550, 2200 - trafficDensity * 16);
      if (s.spawnAccumMs >= spawnPeriod && s.vehicles.length < 18) {
        s.spawnAccumMs = 0;
        const dirs: Array<'E' | 'W' | 'N' | 'S'> = ['E', 'W', 'E', 'W', 'N', 'S'];
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        const startPos = dir === 'E' ? -30 : dir === 'W' ? 1070 : dir === 'S' ? -30 : 590;
        const blocked = s.vehicles.some((v) => v.dir === dir && Math.abs(v.pos - startPos) < 95);
        if (!blocked) {
          s.vehicles.push({
            id: s.nextVehId++,
            dir,
            pos: startPos,
            speed: 110,
            maxSpeed: 120 + Math.random() * 28,
            color: palette[Math.floor(Math.random() * palette.length)],
          });
        }
      }

      const nextVehicles: Vehicle[] = [];
      for (const v of s.vehicles) {
        const nv = { ...v };
        const dirSign = nv.dir === 'E' || nv.dir === 'S' ? 1 : -1;
        // Stop line coordinates just before crosswalk
        const stopLine =
          nv.dir === 'E' ? CX - 118 : nv.dir === 'W' ? CX + 118 : nv.dir === 'S' ? CY - 110 : CY + 110;
        const distToStop = (stopLine - nv.pos) * dirSign;

        const axisCanGo = nv.dir === 'E' || nv.dir === 'W' ? ewCanGo : nsCanGo;
        let mustStop = false;

        // Brake before stop line if light is NOT green (and car hasn't already crossed into box)
        if (!axisCanGo && distToStop > 0 && distToStop < 90) {
          mustStop = true;
        }
        // Check lead vehicle in same lane to form realistic queue without collisions
        for (const other of s.vehicles) {
          if (other.id === nv.id || other.dir !== nv.dir) continue;
          const gap = (other.pos - nv.pos) * dirSign;
          if (gap > 0 && gap < 68) {
            mustStop = true;
            break;
          }
        }

        const targetSpd = mustStop
          ? 0
          : opMode === 'night' && !nv.isFireTruck
            ? nv.maxSpeed * 0.6
            : nv.maxSpeed;

        if (nv.speed < targetSpd) {
          nv.speed = Math.min(targetSpd, nv.speed + 180 * dt);
        } else {
          nv.speed = Math.max(targetSpd, nv.speed - 290 * dt);
        }

        nv.pos += nv.speed * dirSign * dt;

        // Cull cars leaving screen
        const outOfBounds =
          (nv.dir === 'E' && nv.pos > 1090) ||
          (nv.dir === 'W' && nv.pos < -50) ||
          (nv.dir === 'S' && nv.pos > 610) ||
          (nv.dir === 'N' && nv.pos < -50);
        if (!outOfBounds) nextVehicles.push(nv);
      }

      s.vehicles = nextVehicles;
      setVehicles([...nextVehicles]);
    }, dtMs);

    return () => window.clearInterval(timer);
  }, [paused, controlMode, opMode, conflictTripped, ewGreenSec, nsGreenSec, trafficDensity]);

  const handleResetConflict = () => {
    setFaultGreenConflict(false);
    setManualQ({ ewR: false, ewY: false, ewG: true, nsR: true, nsY: false, nsG: false });
    setConflictTripped(false);
  };

  const handleFullReset = () => {
    setFaultGreenConflict(false);
    setConflictTripped(false);
    setControlMode('auto');
    setOpMode('day');
    setPedRequest(false);
    setEwGreenSec(10);
    setNsGreenSec(7);
    setTrafficDensity(65);
    simRef.current.phase = 'EW_GREEN';
    simRef.current.phaseRemainingMs = 10000;
    setPhase('EW_GREEN');
    setCountdown(10);
  };

  const banner = useMemo(() => {
    if (conflictTripped) {
      return {
        tone: 'danger' as const,
        text: '🚨 硬件绿灯冲突安全联锁动作！(EW_Green & NS_Green 同时为 1)：独立冲突监控继电器已立即切断所有绿灯主回路，并强制降级为全向黄灯闪烁故障安全模式！',
        actionLabel: '清除冲突源并复位安全继电器',
        onAction: handleResetConflict,
      };
    }
    if (opMode === 'emergency') {
      return {
        tone: 'warn' as const,
        text: '🚒 紧急消防绿波通道 (%I0.3 = 1) 已激活：东西主干道强制锁定绿灯放行，南北向强制全红拦截，保障应急车辆零延误通过！',
        actionLabel: '退出应急绿波',
        onAction: () => setOpMode('day'),
      };
    }
    if (pedRequest) {
      return {
        tone: 'ok' as const,
        text: '🚶 行人过街优先请求 (%I0.2) 已锁存：当前相位安全倒计时结束后将自动切入全红 + 斑马线行人专用放行相位！',
      };
    }
    return undefined;
  }, [conflictTripped, opMode, pedRequest]);

  const ioSignals: IoSignalItem[] = [
    { address: '%I0.1', symbol: 'Night_Mode', label: '夜间黄闪模式开关', kind: 'I', value: opMode === 'night' },
    { address: '%I0.2', symbol: 'Ped_Request', label: '行人过街请求按钮', kind: 'I', value: pedRequest },
    { address: '%I0.3', symbol: 'Emerg_Green', label: '消防应急绿波通道', kind: 'I', value: opMode === 'emergency' },
    {
      address: '%Q0.0',
      symbol: 'EW_Red',
      label: '东西向红灯',
      kind: 'Q',
      value: effectiveLamps.ewR,
      onToggle: () => setManualQ((m) => ({ ...m, ewR: !m.ewR })),
    },
    {
      address: '%Q0.1',
      symbol: 'EW_Yellow',
      label: '东西向黄灯',
      kind: 'Q',
      value: effectiveLamps.ewY,
      onToggle: () => setManualQ((m) => ({ ...m, ewY: !m.ewY })),
    },
    {
      address: '%Q0.2',
      symbol: 'EW_Green',
      label: '东西向绿灯',
      kind: 'Q',
      value: effectiveLamps.ewG,
      fault: conflictTripped,
      onToggle: () => setManualQ((m) => ({ ...m, ewG: !m.ewG })),
    },
    {
      address: '%Q0.3',
      symbol: 'NS_Red',
      label: '南北向红灯',
      kind: 'Q',
      value: effectiveLamps.nsR,
      onToggle: () => setManualQ((m) => ({ ...m, nsR: !m.nsR })),
    },
    {
      address: '%Q0.4',
      symbol: 'NS_Yellow',
      label: '南北向黄灯',
      kind: 'Q',
      value: effectiveLamps.nsY,
      onToggle: () => setManualQ((m) => ({ ...m, nsY: !m.nsY })),
    },
    {
      address: '%Q0.5',
      symbol: 'NS_Green',
      label: '南北向绿灯',
      kind: 'Q',
      value: effectiveLamps.nsG,
      fault: conflictTripped,
      onToggle: () => setManualQ((m) => ({ ...m, nsG: !m.nsG })),
    },
    { address: '%Q0.6', symbol: 'Ped_Walk', label: '斑马线行人绿灯', kind: 'Q', value: effectiveLamps.pedWalk },
  ];

  const sliders: ParamSliderItem[] = [
    {
      id: 'ew-time',
      label: '东西主干道绿灯配时',
      value: ewGreenSec,
      min: 5,
      max: 20,
      step: 1,
      unit: 's',
      onChange: setEwGreenSec,
    },
    {
      id: 'ns-time',
      label: '南北次干道绿灯配时',
      value: nsGreenSec,
      min: 4,
      max: 16,
      step: 1,
      unit: 's',
      onChange: setNsGreenSec,
    },
    {
      id: 'density',
      label: '路口车流到达密度',
      value: trafficDensity,
      min: 20,
      max: 100,
      step: 5,
      unit: '%',
      onChange: setTrafficDensity,
    },
  ];

  const faults: FaultSwitchItem[] = [
    {
      id: 'green-conflict',
      label: '注入致命冲突：强制东西+南北同时绿灯',
      active: faultGreenConflict || conflictTripped,
      onToggle: () => {
        if (faultGreenConflict || conflictTripped) {
          handleResetConflict();
        } else {
          setFaultGreenConflict(true);
        }
      },
    },
  ];

  const ewTimerText =
    conflictTripped || opMode === 'night'
      ? '--'
      : opMode === 'emergency'
        ? 'GO'
        : String(countdown).padStart(2, '0');

  const shellStatus: 'run' | 'stop' | 'fault' = conflictTripped
    ? 'fault'
    : opMode === 'night'
      ? 'stop'
      : 'run';

  // Helper to render signal head box
  const renderSignalHead = (
    x: number,
    y: number,
    r: boolean,
    ye: boolean,
    g: boolean,
    label: string,
    timerVal: string
  ) => (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="0" y="0" width="96" height="40" rx="7" fill="#090d16" stroke="#475569" strokeWidth="1.6" />
      <circle cx="16" cy="20" r="8" fill={r ? '#ef4444' : '#3f1215'} stroke="#7f1d1d" />
      <circle cx="38" cy="20" r="8" fill={ye ? '#f59e0b' : '#422808'} stroke="#78350f" />
      <circle cx="60" cy="20" r="8" fill={g ? '#10b981' : '#083325'} stroke="#065f46" />
      <rect x="72" y="8" width="20" height="24" rx="3" fill="#020617" stroke="#334155" />
      <text
        x="82"
        y="24"
        textAnchor="middle"
        fill={g ? '#34d399' : ye ? '#fbbf24' : '#f87171'}
        fontSize="10.5"
        fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
        fontWeight="900"
      >
        {timerVal}
      </text>
      <text x="48" y="-6" textAnchor="middle" fill="#cbd5e1" fontSize="11" fontWeight="700">
        {label}
      </text>
    </g>
  );

  return (
    <TwinShell
      title="智能十字路口四向车流与人行请求安全联锁模型"
      subtitle="2.5D 俯视十字路口 · 车辆队列刹车仿真 + 行人过街优先 + 消防绿波 + 绿灯冲突硬件安全联锁检测"
      status={shellStatus}
      statusText={
        conflictTripped
          ? 'FAIL-SAFE · 冲突保护黄闪'
          : opMode === 'emergency'
            ? 'EMERGENCY GREEN WAVE'
            : opMode === 'night'
              ? 'NIGHT FLASH 1Hz'
              : `PHASE · ${phase}`
      }
      mode={controlMode}
      onModeChange={setControlMode}
      paused={paused}
      onTogglePause={() => setPaused((p) => !p)}
      onReset={handleFullReset}
      embedded={embedded}
      banner={banner}
      ioSignals={ioSignals}
      sliders={sliders}
      faults={faults}
      actionBar={
        <>
          <div className="dt-action-group">
            <span className="dt-action-label">路口交通模式</span>
            <button
              type="button"
              className={`dt-btn ${opMode === 'day' ? 'dt-btn--active' : ''}`}
              onClick={() => setOpMode('day')}
            >
              <Sun size={13} />
              日间标准时序
            </button>
            <button
              type="button"
              className={`dt-btn ${opMode === 'night' ? 'dt-btn--active' : ''}`}
              onClick={() => setOpMode('night')}
            >
              <Moon size={13} />
              夜间黄灯闪烁
            </button>
            <button
              type="button"
              className={`dt-btn ${pedRequest || phase === 'PED_CROSS' ? 'dt-btn--success' : ''}`}
              onClick={() => {
                setOpMode('day');
                setPedRequest(true);
              }}
            >
              <Footprints size={13} />
              {phase === 'PED_CROSS' ? '行人放行中...' : pedRequest ? '已按下行人请求' : '行人过街优先请求'}
            </button>
            <button
              type="button"
              className={`dt-btn ${opMode === 'emergency' ? 'dt-btn--danger' : ''}`}
              onClick={triggerEmergencyMode}
            >
              <Siren size={13} />
              紧急消防绿波通道
            </button>
          </div>
          <div className="dt-action-group">
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                color: conflictTripped ? '#f87171' : '#34d399',
              }}
            >
              <ShieldAlert size={14} />
              绿灯冲突联锁检测器：{conflictTripped ? '已切断保护!' : '正常 (EW_G & NS_G = 0)'}
            </span>
          </div>
        </>
      }
    >
      <svg
        viewBox="0 0 1040 560"
        className="dt-svg"
        role="img"
        aria-label="智能十字路口四向车流与绿灯冲突联锁仿真图"
      >
        {/* Urban Corner Plazas & Sidewalks */}
        <rect x="0" y="0" width="1040" height="560" fill="#0c1524" />
        {/* 4 Corner Landscaped Blocks */}
        <rect x="16" y="16" width="408" height="172" rx="16" fill="#132234" stroke="#1e3a5f" />
        <rect x="616" y="16" width="408" height="172" rx="16" fill="#132234" stroke="#1e3a5f" />
        <rect x="16" y="372" width="408" height="172" rx="16" fill="#132234" stroke="#1e3a5f" />
        <rect x="616" y="372" width="408" height="172" rx="16" fill="#132234" stroke="#1e3a5f" />

        {/* Asphalt Roads */}
        <rect x="0" y="200" width="1040" height="160" fill="#1e2532" />
        <rect x="436" y="0" width="168" height="560" fill="#1e2532" />
        {/* Intersection Core Box */}
        <rect x="436" y="200" width="168" height="160" fill="#232b3a" />

        {/* Double Yellow Center Dividers */}
        <line x1="0" y1="278" x2="404" y2="278" stroke="#eab308" strokeWidth="2.5" />
        <line x1="0" y1="283" x2="404" y2="283" stroke="#eab308" strokeWidth="2.5" />
        <line x1="636" y1="278" x2="1040" y2="278" stroke="#eab308" strokeWidth="2.5" />
        <line x1="636" y1="283" x2="1040" y2="283" stroke="#eab308" strokeWidth="2.5" />

        <line x1="518" y1="0" x2="518" y2="170" stroke="#eab308" strokeWidth="2.5" />
        <line x1="523" y1="0" x2="523" y2="170" stroke="#eab308" strokeWidth="2.5" />
        <line x1="518" y1="390" x2="518" y2="560" stroke="#eab308" strokeWidth="2.5" />
        <line x1="523" y1="390" x2="523" y2="560" stroke="#eab308" strokeWidth="2.5" />

        {/* Dashed Lane Lines */}
        <line x1="0" y1="240" x2="400" y2="240" stroke="#64748b" strokeWidth="1.5" strokeDasharray="14 12" />
        <line x1="0" y1="320" x2="400" y2="320" stroke="#64748b" strokeWidth="1.5" strokeDasharray="14 12" />
        <line x1="640" y1="240" x2="1040" y2="240" stroke="#64748b" strokeWidth="1.5" strokeDasharray="14 12" />
        <line x1="640" y1="320" x2="1040" y2="320" stroke="#64748b" strokeWidth="1.5" strokeDasharray="14 12" />

        {/* White Stop Lines */}
        <line x1="402" y1="284" x2="402" y2="358" stroke="#f8fafc" strokeWidth="4" />
        <line x1="638" y1="202" x2="638" y2="276" stroke="#f8fafc" strokeWidth="4" />
        <line x1="438" y1="168" x2="516" y2="168" stroke="#f8fafc" strokeWidth="4" />
        <line x1="524" y1="392" x2="602" y2="392" stroke="#f8fafc" strokeWidth="4" />

        {/* 4 Zebra Crosswalks */}
        {[208, 228, 248, 268, 288, 308, 328, 348].map((zy) => (
          <g key={`zw-ew-${zy}`}>
            <rect x="410" y={zy} width="22" height="9" fill={effectiveLamps.pedWalk ? '#34d399' : '#cbd5e1'} opacity="0.75" />
            <rect x="608" y={zy} width="22" height="9" fill={effectiveLamps.pedWalk ? '#34d399' : '#cbd5e1'} opacity="0.75" />
          </g>
        ))}
        {[446, 466, 486, 506, 526, 546, 566, 586].map((zx) => (
          <g key={`zw-ns-${zx}`}>
            <rect x={zx} y="175" width="9" height="22" fill={effectiveLamps.pedWalk ? '#34d399' : '#cbd5e1'} opacity="0.75" />
            <rect x={zx} y="363" width="9" height="22" fill={effectiveLamps.pedWalk ? '#34d399' : '#cbd5e1'} opacity="0.75" />
          </g>
        ))}

        {/* Animated Pedestrians crossing zebra stripes when PED_CROSS active */}
        {effectiveLamps.pedWalk && (
          <g>
            {[0, 0.22].map((offset, idx) => {
              const t = Math.min(1, Math.max(0, pedProgress * 1.15 - offset));
              const py = 205 + t * 145;
              const px = 445 + t * 145;
              return (
                <g key={`ped-${idx}`}>
                  <circle cx="421" cy={py} r="7" fill="#34d399" stroke="#ecfdf5" strokeWidth="2" />
                  <circle cx={px} cy="374" r="7" fill="#38bdf8" stroke="#f0f9ff" strokeWidth="2" />
                </g>
              );
            })}
          </g>
        )}

        {/* ==================== DYNAMIC VEHICLES ==================== */}
        {vehicles.map((v) => {
          const isHoriz = v.dir === 'E' || v.dir === 'W';
          const vx = v.dir === 'E' || v.dir === 'W' ? v.pos : v.dir === 'S' ? 476 : 562;
          const vy = v.dir === 'N' || v.dir === 'S' ? v.pos : v.dir === 'E' ? 320 : 240;
          const rot = v.dir === 'E' ? 0 : v.dir === 'W' ? 180 : v.dir === 'S' ? 90 : 270;
          const braking = v.speed < 15;
          return (
            <g key={v.id} transform={`translate(${vx}, ${vy}) rotate(${rot})`}>
              {/* Car Drop Shadow */}
              <rect x="-22" y="-11" width="46" height="26" rx="6" fill="rgba(0,0,0,0.42)" />
              {/* Car Body */}
              <rect
                x="-24"
                y="-13"
                width={v.isFireTruck ? 56 : 44}
                height="26"
                rx="6"
                fill={v.color}
                stroke={v.isFireTruck ? '#fef08a' : '#0f172a'}
                strokeWidth="1.5"
              />
              {/* Windshield */}
              <rect x={v.isFireTruck ? 14 : 6} y="-9" width="9" height="18" rx="2" fill="#0f172a" opacity="0.75" />
              {/* Headlights */}
              <circle cx={v.isFireTruck ? 31 : 19} cy="-8" r="2.2" fill="#fef08a" />
              <circle cx={v.isFireTruck ? 31 : 19} cy="8" r="2.2" fill="#fef08a" />
              {/* Red Brake Lights when queued */}
              {braking && (
                <>
                  <circle cx="-23" cy="-8" r="2.5" fill="#ef4444" />
                  <circle cx="-23" cy="8" r="2.5" fill="#ef4444" />
                </>
              )}
              {/* Flashing Siren Bar for Fire Truck */}
              {v.isFireTruck && (
                <>
                  <rect x="-4" y="-8" width="7" height="8" fill={blinkOn ? '#ef4444' : '#38bdf8'} />
                  <rect x="-4" y="0" width="7" height="8" fill={blinkOn ? '#38bdf8' : '#ef4444'} />
                  <text x="-14" y="3" fill="#fff" fontSize="9.8" fontWeight="900">
                    119
                  </text>
                </>
              )}
              {!isHoriz && null}
            </g>
          );
        })}

        {/* ==================== 4-CORNER SIGNAL HEADS & COUNTDOWNS ==================== */}
        {renderSignalHead(
          312,
          132,
          effectiveLamps.nsR,
          effectiveLamps.nsY,
          effectiveLamps.nsG,
          '南北向主信号 (NS)',
          ewTimerText
        )}
        {renderSignalHead(
          632,
          132,
          effectiveLamps.ewR,
          effectiveLamps.ewY,
          effectiveLamps.ewG,
          '东西向主信号 (EW)',
          ewTimerText
        )}
        {renderSignalHead(
          312,
          404,
          effectiveLamps.ewR,
          effectiveLamps.ewY,
          effectiveLamps.ewG,
          '东西向主信号 (EW)',
          ewTimerText
        )}
        {renderSignalHead(
          632,
          404,
          effectiveLamps.nsR,
          effectiveLamps.nsY,
          effectiveLamps.nsG,
          '南北向主信号 (NS)',
          ewTimerText
        )}

        {/* ==================== CORNER SCADA STATUS PANELS ==================== */}
        {/* Top-Left: Road Legend & Interactive Pedestrian Button */}
        <g transform="translate(34, 34)">
          <rect x="0" y="0" width="248" height="134" rx="10" fill="#0b1324" stroke="#334155" />
          <text x="14" y="24" fill="#5eead4" fontSize="11.5" fontWeight="700">
            路口控制柜 · S7-1214C 交通控制器
          </text>
          <text x="14" y="46" fill="#cbd5e1" fontSize="10.5">
            东西主干道 (EW) / 南北次干道 (NS)
          </text>
          <text x="14" y="66" fill="#94a3b8" fontSize="11.2">
            全红清空保护时间：1.5 秒（防止闯黄灯碰撞）
          </text>
          {/* Interactive Crosswalk Button */}
          <g
            transform="translate(14, 82)"
            style={{ cursor: 'pointer' }}
            onClick={() => {
              setOpMode('day');
              setPedRequest(true);
            }}
          >
            <rect
              x="0"
              y="0"
              width="220"
              height="36"
              rx="7"
              fill={pedRequest ? 'rgba(16,185,129,0.22)' : '#1e293b'}
              stroke={pedRequest ? '#10b981' : '#f59e0b'}
              strokeWidth="1.5"
            />
            <text
              x="110"
              y="22"
              textAnchor="middle"
              fill={pedRequest ? '#34d399' : '#fde047'}
              fontSize="11"
              fontWeight="700"
            >
              {effectiveLamps.pedWalk
                ? '🟢 斑马线行人正在通行 (%Q0.6=1)'
                : pedRequest
                  ? '✓ 行人过街请求已锁存 (%I0.2=1)'
                  : '👆 点击模拟按下路边行人过街按钮'}
            </text>
          </g>
        </g>

        {/* Bottom-Right: Hardware Green-Conflict Safety Interlock Monitor Card */}
        <g transform="translate(744, 396)">
          <rect
            x="0"
            y="0"
            width="262"
            height="130"
            rx="10"
            fill={conflictTripped ? '#2a0f14' : '#0b1324'}
            stroke={conflictTripped ? '#ef4444' : '#10b981'}
            strokeWidth="2"
          />
          <text
            x="16"
            y="24"
            fill={conflictTripped ? '#fca5a5' : '#34d399'}
            fontSize="11.5"
            fontWeight="800"
          >
            🛡 绿灯冲突硬件安全联锁监控器
          </text>
          <text x="16" y="48" fill="#cbd5e1" fontSize="11.2" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
            检测逻辑: Conflict := EW_G AND NS_G;
          </text>
          <text x="16" y="68" fill="#94a3b8" fontSize="11.2">
            EW_G = {rawOutputs.ewG ? '1' : '0'} · NS_G = {rawOutputs.nsG ? '1' : '0'} → 联锁继电器:{' '}
            <tspan fill={conflictTripped ? '#f87171' : '#34d399'} fontWeight="800">
              {conflictTripped ? '已脱扣!' : '闭合正常'}
            </tspan>
          </text>
          <rect
            x="16"
            y="84"
            width="230"
            height="32"
            rx="6"
            fill={conflictTripped ? 'rgba(239,68,68,0.28)' : 'rgba(16,185,129,0.12)'}
          />
          <text
            x="131"
            y="104"
            textAnchor="middle"
            fill={conflictTripped ? '#fecaca' : '#a7f3d0'}
            fontSize="11.2"
            fontWeight="700"
          >
            {conflictTripped
              ? '已切断绿灯接触器，强制降级全向黄闪！'
              : '提示：可在下方注入冲突或手动同时强置双绿灯'}
          </text>
        </g>
      </svg>
    </TwinShell>
  );
};
