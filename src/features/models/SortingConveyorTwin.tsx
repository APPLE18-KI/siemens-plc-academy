import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Camera, CheckCircle, PlayCircle, StopCircle } from 'lucide-react';
import type { PlcRuntime } from '../../types/plc';
import {
  TwinShell,
  type FaultSwitchItem,
  type IoSignalItem,
  type ParamSliderItem,
  type TwinControlMode,
} from './components/TwinShell';

export interface SortingConveyorProps {
  runtime?: PlcRuntime;
  embedded?: boolean;
}

type PartKind = 'plastic' | 'metal' | 'defect';

interface Workpiece {
  id: number;
  kind: PartKind;
  x: number; // Belt coordinate 55 .. 940
  y: number; // 264 on belt; increases when pushed down chute
  ejectedBy: null | 'cyl1' | 'cyl2';
  inspected: boolean;
  counted: boolean;
}

const STATION_INFEED_X = 148;
const STATION_METAL_X = 305;
const STATION_VISION_X = 468;
const STATION_CYL1_X = 638;
const STATION_CYL2_X = 796;
const STATION_END_X = 930;

export const SortingConveyorTwin: React.FC<SortingConveyorProps> = ({ embedded = false }) => {
  const [mode, setMode] = useState<TwinControlMode>('auto');
  const [paused, setPaused] = useState(false);
  const [lineRunning, setLineRunning] = useState(true);
  const [autoFeed, setAutoFeed] = useState(true);

  // Tunable process parameters
  const [beltHz, setBeltHz] = useState(35); // 10 ~ 50 Hz -> %QW80
  const [feedIntervalSec, setFeedIntervalSec] = useState(2.8);

  // Field faults
  const [faultCyl1Jam, setFaultCyl1Jam] = useState(false);
  const [faultEStop, setFaultEStop] = useState(false);
  const [faultPhotoStuck, setFaultPhotoStuck] = useState(false);

  // Active PLC latched alarm
  const [alarmCode, setAlarmCode] = useState<null | 'ESTOP' | 'CYL1_TIMEOUT' | 'INFEED_JAM'>(null);

  // Manual force outputs
  const [manualQ, setManualQ] = useState({ belt: false, cyl1: false, cyl2: false });

  // Live animation & physics state rendered to SVG
  const [parts, setParts] = useState<Workpiece[]>([
    { id: 1, kind: 'metal', x: 110, y: 264, ejectedBy: null, inspected: false, counted: false },
  ]);
  const [beltOffset, setBeltOffset] = useState(0);
  const [cyl1Stroke, setCyl1Stroke] = useState(0); // 0 = retracted, 1 = extended
  const [cyl2Stroke, setCyl2Stroke] = useState(0);
  const [visionFlash, setVisionFlash] = useState<null | { kind: PartKind; label: string }>(null);
  const [counts, setCounts] = useState({ total: 0, qualified: 0, metal: 0, defect: 0 });

  // Live sensor/output snapshot
  const [ioState, setIoState] = useState({
    i02Infeed: false,
    i03Metal: false,
    i04Vision: false,
    i05Cyl1Ret: true,
    i06Cyl1Ext: false,
    i07EndCount: false,
    q00Belt: true,
    q01Cyl1: false,
    q02Cyl2: false,
  });

  // Refs for smooth 25Hz deterministic physics loop without stale closures
  const stateRef = useRef({
    nextId: 2,
    feedAccumMs: 0,
    cyl1CmdTimerMs: 0,
    cyl2CmdTimerMs: 0,
    cyl1WatchdogMs: 0,
    photoStuckMs: 0,
    visionFlashMs: 0,
    cyl1Stroke: 0,
    cyl2Stroke: 0,
    parts: [{ id: 1, kind: 'metal' as PartKind, x: 110, y: 264, ejectedBy: null, inspected: false, counted: false }] as Workpiece[],
    alarmCode: null as null | 'ESTOP' | 'CYL1_TIMEOUT' | 'INFEED_JAM',
  });

  const spawnPart = (kind: PartKind) => {
    const s = stateRef.current;
    // Prevent overlapping spawns at infeed
    const tooClose = s.parts.some((p) => p.ejectedBy === null && p.x < 125);
    if (tooClose) return;
    s.parts = [
      ...s.parts,
      {
        id: s.nextId++,
        kind,
        x: 68,
        y: 264,
        ejectedBy: null,
        inspected: false,
        counted: false,
      },
    ];
    setParts([...s.parts]);
  };

  useEffect(() => {
    stateRef.current.alarmCode = alarmCode;
  }, [alarmCode]);

  // Main 40ms Industrial Simulation + PLC Scan Loop
  useEffect(() => {
    if (paused) return;
    const dtMs = 40;
    const dtSec = dtMs / 1000;

    const timer = window.setInterval(() => {
      const s = stateRef.current;

      // 1. Check immediate E-Stop safety interlock
      if (faultEStop) {
        if (s.alarmCode !== 'ESTOP') {
          s.alarmCode = 'ESTOP';
          setAlarmCode('ESTOP');
        }
      }

      // 2. Read current field sensors from physical workpiece positions
      const partAtInfeed = s.parts.some((p) => !p.ejectedBy && Math.abs(p.x - STATION_INFEED_X) < 26);
      const i02Infeed = faultPhotoStuck || partAtInfeed;
      const i03Metal = s.parts.some(
        (p) => !p.ejectedBy && p.kind === 'metal' && Math.abs(p.x - STATION_METAL_X) < 26
      );
      const visionPart = s.parts.find(
        (p) => !p.ejectedBy && Math.abs(p.x - STATION_VISION_X) < 24
      );
      const i04Vision = Boolean(visionPart);
      const i07EndCount = s.parts.some((p) => !p.ejectedBy && Math.abs(p.x - STATION_END_X) < 22);

      // Photoelectric stuck / jam watchdog (3.0s)
      if (i02Infeed && mode === 'auto' && lineRunning && !s.alarmCode) {
        s.photoStuckMs += dtMs;
        if (s.photoStuckMs >= 3000) {
          s.alarmCode = 'INFEED_JAM';
          setAlarmCode('INFEED_JAM');
        }
      } else {
        s.photoStuckMs = 0;
      }

      // Vision strobe flash & inspection marking
      if (visionPart && !visionPart.inspected) {
        visionPart.inspected = true;
        s.visionFlashMs = 520;
        const label =
          visionPart.kind === 'defect'
            ? 'NG · 尺寸超差'
            : visionPart.kind === 'metal'
              ? 'METAL · 金属件'
              : 'OK · 塑料合格';
        setVisionFlash({ kind: visionPart.kind, label });
      }
      if (s.visionFlashMs > 0) {
        s.visionFlashMs -= dtMs;
        if (s.visionFlashMs <= 0) setVisionFlash(null);
      }

      // 3. Determine PLC Outputs (%Q0.0 Belt, %Q0.1 Cyl1, %Q0.2 Cyl2)
      let q00Belt = false;
      let q01Cyl1 = false;
      let q02Cyl2 = false;

      if (mode === 'manual') {
        q00Belt = !faultEStop && manualQ.belt;
        q01Cyl1 = !faultEStop && manualQ.cyl1;
        q02Cyl2 = !faultEStop && manualQ.cyl2;
      } else {
        const canRun = lineRunning && !faultEStop && s.alarmCode === null;
        q00Belt = canRun;

        if (canRun) {
          // Trigger Cylinder 1 when metal part arrives at Station 1
          const metalAtCyl1 = s.parts.find(
            (p) => !p.ejectedBy && p.kind === 'metal' && Math.abs(p.x - STATION_CYL1_X) < 18
          );
          if (metalAtCyl1 && s.cyl1CmdTimerMs <= 0) {
            s.cyl1CmdTimerMs = 680;
          }

          // Trigger Cylinder 2 when defect part arrives at Station 2
          const defectAtCyl2 = s.parts.find(
            (p) => !p.ejectedBy && p.kind === 'defect' && Math.abs(p.x - STATION_CYL2_X) < 18
          );
          if (defectAtCyl2 && s.cyl2CmdTimerMs <= 0) {
            s.cyl2CmdTimerMs = 680;
          }
        }

        if (s.cyl1CmdTimerMs > 0 && canRun) {
          q01Cyl1 = true;
          s.cyl1CmdTimerMs -= dtMs;
        }
        if (s.cyl2CmdTimerMs > 0 && canRun) {
          q02Cyl2 = true;
          s.cyl2CmdTimerMs -= dtMs;
        }
      }

      // 4. Pneumatic Cylinder Kinematics & Watchdog Fault (%I0.5 / %I0.6)
      if (q01Cyl1) {
        // If jammed fault active, cylinder sticks at 45% stroke and never triggers %I0.6
        const maxStroke = faultCyl1Jam ? 0.45 : 1.0;
        s.cyl1Stroke = Math.min(maxStroke, s.cyl1Stroke + dtSec * 3.8);
      } else {
        s.cyl1Stroke = Math.max(0, s.cyl1Stroke - dtSec * 3.4);
      }

      if (q02Cyl2) {
        s.cyl2Stroke = Math.min(1.0, s.cyl2Stroke + dtSec * 3.8);
      } else {
        s.cyl2Stroke = Math.max(0, s.cyl2Stroke - dtSec * 3.4);
      }

      const i05Cyl1Ret = s.cyl1Stroke <= 0.05;
      const i06Cyl1Ext = s.cyl1Stroke >= 0.95;

      // Cylinder 1 Extend Timeout Watchdog (1.2s in Auto when jammed!)
      if (q01Cyl1 && !i06Cyl1Ext && mode === 'auto' && !s.alarmCode) {
        // Keep solenoid commanded while jammed so watchdog clearly hits timeout
        if (faultCyl1Jam) {
          s.cyl1CmdTimerMs = Math.max(s.cyl1CmdTimerMs, 200);
        }
        s.cyl1WatchdogMs += dtMs;
        if (s.cyl1WatchdogMs >= 1300) {
          s.alarmCode = 'CYL1_TIMEOUT';
          setAlarmCode('CYL1_TIMEOUT');
        }
      } else if (!q01Cyl1 || i06Cyl1Ext) {
        s.cyl1WatchdogMs = 0;
      }

      // 5. Move conveyor belt & workpieces
      const pxPerSec = q00Belt ? (beltHz / 50) * 185 : 0;
      if (pxPerSec > 0) {
        setBeltOffset((o) => (o + pxPerSec * dtSec) % 36);
      }

      let deltaQualified = 0;
      let deltaMetal = 0;
      let deltaDefect = 0;

      const updatedParts: Workpiece[] = [];
      for (const p of s.parts) {
        const next = { ...p };

        if (next.ejectedBy === null) {
          next.x += pxPerSec * dtSec;

          // Check physical push by Cylinder 1
          if (s.cyl1Stroke > 0.72 && Math.abs(next.x - STATION_CYL1_X) < 26) {
            next.ejectedBy = 'cyl1';
            next.x = STATION_CYL1_X;
          }
          // Check physical push by Cylinder 2
          else if (s.cyl2Stroke > 0.72 && Math.abs(next.x - STATION_CYL2_X) < 26) {
            next.ejectedBy = 'cyl2';
            next.x = STATION_CYL2_X;
          }
          // Reached end-of-line qualified bin
          else if (next.x >= STATION_END_X && !next.counted) {
            next.counted = true;
            deltaQualified += 1;
          }
        } else {
          // Slide down chute along +Y
          next.y += 170 * dtSec;
          if (next.y >= 425 && !next.counted) {
            next.counted = true;
            if (next.ejectedBy === 'cyl1') deltaMetal += 1;
            if (next.ejectedBy === 'cyl2') deltaDefect += 1;
          }
        }

        // Keep visible parts within bounds
        if (next.x < 972 && next.y < 462) {
          updatedParts.push(next);
        }
      }
      s.parts = updatedParts;

      if (deltaQualified || deltaMetal || deltaDefect) {
        setCounts((c) => ({
          total: c.total + deltaQualified + deltaMetal + deltaDefect,
          qualified: c.qualified + deltaQualified,
          metal: c.metal + deltaMetal,
          defect: c.defect + deltaDefect,
        }));
      }

      // 6. Auto-feeder timer
      if (autoFeed && q00Belt && mode === 'auto') {
        s.feedAccumMs += dtMs;
        if (s.feedAccumMs >= feedIntervalSec * 1000) {
          s.feedAccumMs = 0;
          const r = Math.random();
          const kind: PartKind = r < 0.48 ? 'plastic' : r < 0.78 ? 'metal' : 'defect';
          const tooClose = s.parts.some((p) => !p.ejectedBy && p.x < 130);
          if (!tooClose) {
            s.parts.push({
              id: s.nextId++,
              kind,
              x: 68,
              y: 264,
              ejectedBy: null,
              inspected: false,
              counted: false,
            });
          }
        }
      }

      setParts([...s.parts]);
      setCyl1Stroke(s.cyl1Stroke);
      setCyl2Stroke(s.cyl2Stroke);
      setIoState({
        i02Infeed,
        i03Metal,
        i04Vision,
        i05Cyl1Ret,
        i06Cyl1Ext,
        i07EndCount,
        q00Belt,
        q01Cyl1,
        q02Cyl2,
      });
    }, dtMs);

    return () => window.clearInterval(timer);
  }, [paused, mode, lineRunning, autoFeed, beltHz, feedIntervalSec, faultCyl1Jam, faultEStop, faultPhotoStuck, manualQ]);

  const handleResetFault = () => {
    if (faultEStop || faultCyl1Jam || faultPhotoStuck) {
      // Clear field faults automatically when clicking banner button
      setFaultEStop(false);
      setFaultCyl1Jam(false);
      setFaultPhotoStuck(false);
    }
    stateRef.current.alarmCode = null;
    stateRef.current.cyl1WatchdogMs = 0;
    stateRef.current.photoStuckMs = 0;
    stateRef.current.cyl1CmdTimerMs = 0;
    setAlarmCode(null);
  };

  const handleFullReset = () => {
    setFaultEStop(false);
    setFaultCyl1Jam(false);
    setFaultPhotoStuck(false);
    setAlarmCode(null);
    setMode('auto');
    setLineRunning(true);
    setAutoFeed(true);
    setBeltHz(35);
    setFeedIntervalSec(2.8);
    setCounts({ total: 0, qualified: 0, metal: 0, defect: 0 });
    stateRef.current = {
      nextId: 2,
      feedAccumMs: 0,
      cyl1CmdTimerMs: 0,
      cyl2CmdTimerMs: 0,
      cyl1WatchdogMs: 0,
      photoStuckMs: 0,
      visionFlashMs: 0,
      cyl1Stroke: 0,
      cyl2Stroke: 0,
      parts: [{ id: 1, kind: 'metal', x: 110, y: 264, ejectedBy: null, inspected: false, counted: false }],
      alarmCode: null,
    };
    setParts([...stateRef.current.parts]);
  };

  const banner = useMemo(() => {
    if (alarmCode === 'ESTOP') {
      return {
        tone: 'danger' as const,
        text: '🚨 急停回路断开 (%I0.1 = 0)：全线立即安全停机，切断变频传送带 %Q0.0 与双气缸电磁阀，声光报警塔红灯爆闪！',
        actionLabel: '旋起急停并复位',
        onAction: handleResetFault,
      };
    }
    if (alarmCode === 'CYL1_TIMEOUT') {
      return {
        tone: 'danger' as const,
        text: '🚨 1# 金属分拣气缸超时报警 (TON > 1.3s)：电磁阀 %Q0.1 已得电，但伸出到位磁性开关 %I0.6 始终未闭合（机械卡滞/气压不足），PLC 已触发联锁停线！',
        actionLabel: '排除气缸卡死并复位',
        onAction: handleResetFault,
      };
    }
    if (alarmCode === 'INFEED_JAM') {
      return {
        tone: 'danger' as const,
        text: '🚨 上料工位堵料/传感器粘连报警：对射光电 %I0.2 持续被遮挡超过 3.0s，PLC 自动停带防堆积，请清理光路或检查传感器！',
        actionLabel: '解除遮挡并复位',
        onAction: handleResetFault,
      };
    }
    return undefined;
  }, [alarmCode]);

  const vfdRawQw80 = ioState.q00Belt ? Math.round((beltHz / 50) * 27648) : 0;
  const yieldPct = counts.total > 0 ? Math.round((counts.qualified / counts.total) * 100) : 100;

  const ioSignals: IoSignalItem[] = [
    {
      address: '%I0.1',
      symbol: 'EStop_OK',
      label: '全线急停 (NC)',
      kind: 'I',
      value: !faultEStop,
      fault: faultEStop,
    },
    {
      address: '%I0.2',
      symbol: 'PE_Infeed',
      label: '上料对射光电',
      kind: 'I',
      value: ioState.i02Infeed,
      fault: faultPhotoStuck,
    },
    { address: '%I0.3', symbol: 'Prox_Metal', label: '电感金属接近开关', kind: 'I', value: ioState.i03Metal },
    { address: '%I0.4', symbol: 'Cam_Trig', label: '视觉相机检测工位', kind: 'I', value: ioState.i04Vision },
    { address: '%I0.5', symbol: 'Cyl1_Ret', label: '1# 气缸缩回到位', kind: 'I', value: ioState.i05Cyl1Ret },
    {
      address: '%I0.6',
      symbol: 'Cyl1_Ext',
      label: '1# 气缸伸出到位',
      kind: 'I',
      value: ioState.i06Cyl1Ext,
      fault: alarmCode === 'CYL1_TIMEOUT',
    },
    { address: '%I0.7', symbol: 'PE_EndBox', label: '合格入箱计数光电', kind: 'I', value: ioState.i07EndCount },
    {
      address: '%Q0.0',
      symbol: 'VFD_Run',
      label: '变频皮带主电机',
      kind: 'Q',
      value: ioState.q00Belt,
      onToggle: () => setManualQ((m) => ({ ...m, belt: !m.belt })),
    },
    {
      address: '%Q0.1',
      symbol: 'Sol_Cyl1',
      label: '1# 金属分拣电磁阀',
      kind: 'Q',
      value: ioState.q01Cyl1,
      onToggle: () => setManualQ((m) => ({ ...m, cyl1: !m.cyl1 })),
    },
    {
      address: '%Q0.2',
      symbol: 'Sol_Cyl2',
      label: '2# 次品剔除电磁阀',
      kind: 'Q',
      value: ioState.q02Cyl2,
      onToggle: () => setManualQ((m) => ({ ...m, cyl2: !m.cyl2 })),
    },
    { address: '%QW80', symbol: 'VFD_FreqRef', label: '变频器频率给定', kind: 'QW', value: vfdRawQw80 },
  ];

  const sliders: ParamSliderItem[] = [
    {
      id: 'belt-hz',
      label: 'SINAMICS G120 传送带变频频率',
      value: beltHz,
      min: 10,
      max: 50,
      step: 1,
      unit: 'Hz',
      onChange: setBeltHz,
    },
    {
      id: 'feed-sec',
      label: '自动上料节拍间隔',
      value: feedIntervalSec,
      min: 1.5,
      max: 6.0,
      step: 0.1,
      unit: 's',
      onChange: setFeedIntervalSec,
    },
  ];

  const faults: FaultSwitchItem[] = [
    {
      id: 'cyl1-jam',
      label: '1# 气缸卡死超时未到位',
      active: faultCyl1Jam,
      onToggle: () => setFaultCyl1Jam((v) => !v),
    },
    {
      id: 'estop',
      label: '拍下现场急停按钮 (%I0.1=0)',
      active: faultEStop,
      onToggle: () => setFaultEStop((v) => !v),
    },
    {
      id: 'photo-stuck',
      label: '上料光电传感器遮挡常亮',
      active: faultPhotoStuck,
      onToggle: () => setFaultPhotoStuck((v) => !v),
    },
  ];

  const shellStatus: 'run' | 'stop' | 'fault' = alarmCode
    ? 'fault'
    : ioState.q00Belt
      ? 'run'
      : 'stop';

  return (
    <TwinShell
      title="三工位视觉检测与气动分拣传送带数字孪生"
      subtitle="一维实时物理位移仿真 · 对射光电 + 电感接近 + 视觉闪光拍照 + 双气缸磁性开关超时看门狗联锁"
      status={shellStatus}
      statusText={
        alarmCode
          ? `FAULT · ${alarmCode}`
          : ioState.q00Belt
            ? `自动运行 · ${beltHz} Hz`
            : 'STANDBY'
      }
      mode={mode}
      onModeChange={setMode}
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
            <span className="dt-action-label">手动投放工件</span>
            <button type="button" className="dt-btn" onClick={() => spawnPart('plastic')}>
              <Box size={13} color="#38bdf8" />
              蓝色塑料合格件
            </button>
            <button type="button" className="dt-btn" onClick={() => spawnPart('metal')}>
              <Box size={13} color="#cbd5e1" />
              银色金属件
            </button>
            <button type="button" className="dt-btn" onClick={() => spawnPart('defect')}>
              <Box size={13} color="#f87171" />
              红色超差次品
            </button>
          </div>

          <div className="dt-action-group">
            <button
              type="button"
              className={`dt-btn ${autoFeed ? 'dt-btn--active' : ''}`}
              onClick={() => setAutoFeed((v) => !v)}
            >
              <Camera size={13} />
              自动上料：{autoFeed ? '开启' : '关闭'}
            </button>
            <button
              type="button"
              className={`dt-btn ${lineRunning ? 'dt-btn--danger' : 'dt-btn--success'}`}
              onClick={() => setLineRunning((v) => !v)}
            >
              {lineRunning ? <StopCircle size={13} /> : <PlayCircle size={13} />}
              {lineRunning ? '停止产线' : '启动产线'}
            </button>
            {alarmCode && (
              <button type="button" className="dt-btn dt-btn--primary" onClick={handleResetFault}>
                <CheckCircle size={13} />
                报警复位
              </button>
            )}
          </div>
        </>
      }
    >
      <svg
        viewBox="0 0 1040 520"
        className="dt-svg"
        role="img"
        aria-label="三工位视觉检测与双气缸分拣产线数字孪生画布"
      >
        <defs>
          <linearGradient id="frameMetal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="50%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="beltSurf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="steelPart" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="45%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <linearGradient id="bluePart" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient id="redPart" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#b91c1c" />
          </linearGradient>
          <linearGradient id="cylBody" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
        </defs>

        {/* ==================== TOP KPI & ANDON SIGNAL TOWER ==================== */}
        <g transform="translate(24, 18)">
          <rect x="0" y="0" width="540" height="58" rx="10" fill="#0f172a" stroke="#334155" />
          {[
            { lbl: '累计加工', val: counts.total, color: '#f1f5f9', x: 54 },
            { lbl: '合格品入箱', val: counts.qualified, color: '#38bdf8', x: 162 },
            { lbl: '1# 金属分拣', val: counts.metal, color: '#cbd5e1', x: 274 },
            { lbl: '2# 次品剔除', val: counts.defect, color: '#f87171', x: 386 },
            { lbl: '实时良率', val: `${yieldPct}%`, color: '#34d399', x: 486 },
          ].map((k) => (
            <g key={k.lbl} transform={`translate(${k.x}, 0)`}>
              <text x="0" y="20" textAnchor="middle" fill="#94a3b8" fontSize="11.2" fontWeight="600">
                {k.lbl}
              </text>
              <text
                x="0"
                y="45"
                textAnchor="middle"
                fill={k.color}
                fontSize="18"
                fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                fontWeight="800"
              >
                {k.val}
              </text>
            </g>
          ))}
        </g>

        {/* Industrial 3-Color Andon Stack Light Tower (Top Right) */}
        <g transform="translate(946, 18)">
          <rect x="0" y="0" width="72" height="122" rx="10" fill="#0f172a" stroke="#334155" />
          <text x="36" y="16" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700">
            声光报警塔
          </text>
          {/* Red Tier */}
          <rect
            x="22"
            y="24"
            width="28"
            height="22"
            rx="4"
            fill={alarmCode ? '#ef4444' : '#450a0a'}
            stroke="#f87171"
            className={alarmCode ? 'dt-blink' : ''}
          />
          {/* Amber Tier */}
          <rect
            x="22"
            y="49"
            width="28"
            height="22"
            rx="4"
            fill={!alarmCode && !ioState.q00Belt ? '#f59e0b' : '#451a03'}
            stroke="#fbbf24"
          />
          {/* Green Tier */}
          <rect
            x="22"
            y="74"
            width="28"
            height="22"
            rx="4"
            fill={!alarmCode && ioState.q00Belt ? '#10b981' : '#064e3b'}
            stroke="#34d399"
          />
          {/* Tower pole */}
          <rect x="33" y="96" width="6" height="18" fill="#64748b" />
        </g>

        {/* ==================== CHUTES & COLLECTION BINS (BELOW CONVEYOR) ==================== */}
        {/* 1# Metal Chute & Bin */}
        <g transform="translate(600, 316)">
          <polygon points="10,0 66,0 78,108 -2,108" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
          <line x1="26" y1="8" x2="20" y2="100" stroke="#475569" strokeWidth="1.2" />
          <line x1="50" y1="8" x2="56" y2="100" stroke="#475569" strokeWidth="1.2" />
          <rect x="-12" y="106" width="100" height="68" rx="8" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
          <text x="38" y="130" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">
            1# 金属分拣箱
          </text>
          <text x="38" y="155" textAnchor="middle" fill="#cbd5e1" fontSize="15" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif" fontWeight="800">
            {counts.metal} 件
          </text>
        </g>

        {/* 2# Defect Reject Chute & Bin */}
        <g transform="translate(758, 316)">
          <polygon points="10,0 66,0 78,108 -2,108" fill="#2a1215" stroke="#ef4444" strokeWidth="1.5" />
          <rect x="-12" y="106" width="100" height="68" rx="8" fill="#2a1215" stroke="#f87171" strokeWidth="2" />
          <text x="38" y="130" textAnchor="middle" fill="#fecaca" fontSize="11" fontWeight="700">
            2# 次品剔除箱
          </text>
          <text x="38" y="155" textAnchor="middle" fill="#f87171" fontSize="15" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif" fontWeight="800">
            {counts.defect} 件
          </text>
        </g>

        {/* End Qualified Bin */}
        <g transform="translate(918, 316)">
          <rect x="0" y="24" width="102" height="150" rx="10" fill="#082f49" stroke="#38bdf8" strokeWidth="2" />
          <text x="51" y="54" textAnchor="middle" fill="#bae6fd" fontSize="11" fontWeight="700">
            末端合格品入箱
          </text>
          <text x="51" y="74" textAnchor="middle" fill="#7dd3fc" fontSize="11" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
            %I0.7 计数光电
          </text>
          <circle
            cx="51"
            cy="96"
            r="7"
            fill={ioState.i07EndCount ? '#10b981' : '#1e293b'}
            stroke="#38bdf8"
          />
          <text x="51" y="136" textAnchor="middle" fill="#38bdf8" fontSize="22" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif" fontWeight="800">
            {counts.qualified}
          </text>
          <text x="51" y="156" textAnchor="middle" fill="#7dd3fc" fontSize="11.2">
            合格装箱数
          </text>
        </g>

        {/* ==================== CONVEYOR BELT MECHANICAL FRAME ==================== */}
        <g>
          {/* Aluminum Side Rails */}
          <rect x="34" y="232" width="908" height="92" rx="14" fill="url(#frameMetal)" stroke="#64748b" strokeWidth="2" />
          {/* Belt Track */}
          <rect x="48" y="244" width="880" height="68" rx="6" fill="url(#beltSurf)" stroke="#334155" />

          {/* Moving Belt Chevron Treads */}
          <g clipPath="inset(0)">
            {Array.from({ length: 26 }).map((_, idx) => {
              const tx = 54 + idx * 36 + beltOffset - 36;
              if (tx < 48 || tx > 922) return null;
              return (
                <path
                  key={`tread-${idx}`}
                  d={`M ${tx} 248 L ${tx + 10} 278 L ${tx} 308`}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="2.2"
                />
              );
            })}
          </g>

          {/* Left Drive Roller + VFD Badge */}
          <circle cx="52" cy="278" r="24" fill="#334155" stroke="#94a3b8" strokeWidth="2.5" />
          <g transform={`translate(52, 278) rotate(${beltOffset * 10})`}>
            <line x1="-16" y1="0" x2="16" y2="0" stroke="#00c4c4" strokeWidth="3" />
            <line x1="0" y1="-16" x2="0" y2="16" stroke="#00c4c4" strokeWidth="3" />
          </g>
          {/* Right Idler Roller */}
          <circle cx="924" cy="278" r="24" fill="#334155" stroke="#94a3b8" strokeWidth="2.5" />
          <g transform={`translate(924, 278) rotate(${beltOffset * 10})`}>
            <line x1="-16" y1="0" x2="16" y2="0" stroke="#94a3b8" strokeWidth="2.5" />
            <line x1="0" y1="-16" x2="0" y2="16" stroke="#94a3b8" strokeWidth="2.5" />
          </g>

          {/* VFD Motor Readout Plate */}
          <g transform="translate(36, 344)">
            <rect x="0" y="0" width="214" height="72" rx="9" fill="#0f172a" stroke={ioState.q00Belt ? '#10b981' : '#475569'} />
            <text x="14" y="21" fill="#94a3b8" fontSize="11.2" fontWeight="700">
              SINAMICS G120 变频驱动 (%Q0.0)
            </text>
            <text x="14" y="45" fill={ioState.q00Belt ? '#34d399' : '#64748b'} fontSize="17" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif" fontWeight="800">
              {ioState.q00Belt ? `${beltHz.toFixed(1)} Hz` : '0.0 Hz'}
            </text>
            <text x="112" y="44" fill="#a78bfa" fontSize="11" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
              %QW80={vfdRawQw80}
            </text>
            <text x="14" y="62" fill="#94a3b8" fontSize="11">
              线速度：{ioState.q00Belt ? ((beltHz / 50) * 0.65).toFixed(2) : '0.00'} m/s
            </text>
          </g>
        </g>

        {/* ==================== STATION 1: INFEED THRU-BEAM PHOTOELECTRIC (%I0.2) ==================== */}
        <g transform={`translate(${STATION_INFEED_X}, 178)`}>
          <rect x="-18" y="0" width="36" height="36" rx="5" fill="#1e293b" stroke={ioState.i02Infeed ? '#f59e0b' : '#64748b'} strokeWidth="1.6" />
          <circle cx="0" cy="18" r="5" fill={ioState.i02Infeed ? '#f59e0b' : '#334155'} />
          {/* Laser Beam across conveyor */}
          <line
            x1="0"
            y1="36"
            x2="0"
            y2="148"
            stroke={ioState.i02Infeed ? '#f59e0b' : '#ef4444'}
            strokeWidth={ioState.i02Infeed ? 3.2 : 1.8}
            strokeDasharray={ioState.i02Infeed ? '5 3' : undefined}
          />
          <rect x="-12" y="148" width="24" height="16" rx="3" fill="#334155" stroke="#64748b" />
          <text x="0" y="-20" textAnchor="middle" fill="#cbd5e1" fontSize="10.5" fontWeight="700">
            上料光电
          </text>
          <text x="0" y="-6" textAnchor="middle" fill="#38bdf8" fontSize="11.2" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif" fontWeight="700">
            %I0.2 [{ioState.i02Infeed ? '1' : '0'}]
          </text>
        </g>

        {/* ==================== STATION 2: INDUCTIVE METAL PROXIMITY (%I0.3) ==================== */}
        <g transform={`translate(${STATION_METAL_X}, 172)`}>
          <rect x="-14" y="0" width="28" height="48" rx="4" fill="#334155" stroke={ioState.i03Metal ? '#38bdf8' : '#94a3b8'} strokeWidth="1.6" />
          <rect x="-10" y="42" width="20" height="10" rx="2" fill="#0284c7" />
          {/* Electromagnetic Induction Field Cone */}
          <path
            d="M -10 52 L -28 84 L 28 84 L 10 52 Z"
            fill={ioState.i03Metal ? 'rgba(56,189,248,0.42)' : 'rgba(56,189,248,0.08)'}
            stroke={ioState.i03Metal ? '#38bdf8' : 'none'}
            strokeDasharray="3 3"
          />
          <text x="0" y="-22" textAnchor="middle" fill="#cbd5e1" fontSize="10.5" fontWeight="700">
            电感金属接近
          </text>
          <text x="0" y="-8" textAnchor="middle" fill="#38bdf8" fontSize="11.2" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif" fontWeight="700">
            %I0.3 [{ioState.i03Metal ? '1' : '0'}]
          </text>
        </g>

        {/* ==================== STATION 3: INDUSTRIAL VISION CAMERA (%I0.4) ==================== */}
        <g transform={`translate(${STATION_VISION_X}, 118)`}>
          {/* Gantry Arm */}
          <rect x="-4" y="0" width="8" height="32" fill="#64748b" />
          <rect x="-32" y="28" width="64" height="46" rx="7" fill="#1e293b" stroke={visionFlash ? '#fbbf24' : '#00c4c4'} strokeWidth="2" />
          <circle cx="0" cy="51" r="14" fill="#020617" stroke="#38bdf8" strokeWidth="2" />
          <circle cx="0" cy="51" r="6" fill={visionFlash ? '#fde047' : '#0ea5e9'} />
          {/* Strobe Inspection Cone */}
          <polygon
            points="-22,74 22,74 44,132 -44,132"
            fill={visionFlash ? 'rgba(250,204,21,0.34)' : 'rgba(0,196,196,0.08)'}
            stroke={visionFlash ? '#facc15' : 'rgba(0,196,196,0.28)'}
            strokeDasharray="4 4"
          />
          <text x="0" y="-14" textAnchor="middle" fill="#5eead4" fontSize="10.5" fontWeight="700">
            工业视觉相机工位
          </text>
          <text x="0" y="-1" textAnchor="middle" fill="#38bdf8" fontSize="11.2" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif" fontWeight="700">
            %I0.4 [{ioState.i04Vision ? '1' : '0'}]
          </text>
          {/* Vision Classification HUD Popup */}
          {visionFlash && (
            <g transform="translate(-54, 82)">
              <rect
                x="0"
                y="0"
                width="108"
                height="24"
                rx="5"
                fill={
                  visionFlash.kind === 'defect'
                    ? '#991b1b'
                    : visionFlash.kind === 'metal'
                      ? '#334155'
                      : '#065f46'
                }
                stroke="#f8fafc"
              />
              <text x="54" y="15" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="800">
                {visionFlash.label}
              </text>
            </g>
          )}
        </g>

        {/* ==================== STATION 4: 1# METAL SORTING PNEUMATIC CYLINDER (%Q0.1) ==================== */}
        <g transform={`translate(${STATION_CYL1_X}, 102)`}>
          <text x="0" y="-18" textAnchor="middle" fill="#e2e8f0" fontSize="10.5" fontWeight="700">
            1# 金属分拣气缸
          </text>
          <text x="0" y="-4" textAnchor="middle" fill="#34d399" fontSize="11.2" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif" fontWeight="700">
            %Q0.1 [{ioState.q01Cyl1 ? '1' : '0'}]
          </text>
          {/* Cylinder Barrel */}
          <rect
            x="-22"
            y="8"
            width="44"
            height="92"
            rx="5"
            fill="url(#cylBody)"
            stroke={alarmCode === 'CYL1_TIMEOUT' ? '#ef4444' : '#94a3b8'}
            strokeWidth="2"
          />
          {/* Dual Magnetic Reed Switches (%I0.5 Retracted / %I0.6 Extended) */}
          <rect x="24" y="16" width="54" height="18" rx="3" fill="#0f172a" stroke={ioState.i05Cyl1Ret ? '#38bdf8' : '#475569'} />
          <circle cx="31" cy="25" r="3.5" fill={ioState.i05Cyl1Ret ? '#38bdf8' : '#334155'} />
          <text x="39" y="28" fill="#cbd5e1" fontSize="10.4" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
            I0.5缩
          </text>

          <rect
            x="24"
            y="76"
            width="54"
            height="18"
            rx="3"
            fill="#0f172a"
            stroke={alarmCode === 'CYL1_TIMEOUT' ? '#ef4444' : ioState.i06Cyl1Ext ? '#38bdf8' : '#475569'}
          />
          <circle cx="31" cy="85" r="3.5" fill={ioState.i06Cyl1Ext ? '#38bdf8' : '#334155'} />
          <text x="39" y="88" fill="#cbd5e1" fontSize="10.4" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
            I0.6伸
          </text>

          {/* Moving Piston Rod + Pusher Plate */}
          <rect x="-6" y="100" width="12" height={26 + cyl1Stroke * 68} fill="#e2e8f0" stroke="#64748b" />
          <rect
            x="-24"
            y={122 + cyl1Stroke * 68}
            width="48"
            height="12"
            rx="3"
            fill={faultCyl1Jam ? '#ef4444' : '#00c4c4'}
            stroke="#0f172a"
          />
        </g>

        {/* ==================== STATION 5: 2# DEFECT REJECT PNEUMATIC CYLINDER (%Q0.2) ==================== */}
        <g transform={`translate(${STATION_CYL2_X}, 102)`}>
          <text x="0" y="-18" textAnchor="middle" fill="#fecaca" fontSize="10.5" fontWeight="700">
            2# 次品剔除气缸
          </text>
          <text x="0" y="-4" textAnchor="middle" fill="#34d399" fontSize="11.2" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif" fontWeight="700">
            %Q0.2 [{ioState.q02Cyl2 ? '1' : '0'}]
          </text>
          <rect x="-22" y="8" width="44" height="92" rx="5" fill="url(#cylBody)" stroke="#f87171" strokeWidth="1.6" />
          <rect x="-6" y="100" width="12" height={26 + cyl2Stroke * 68} fill="#e2e8f0" stroke="#64748b" />
          <rect
            x="-24"
            y={122 + cyl2Stroke * 68}
            width="48"
            height="12"
            rx="3"
            fill="#f87171"
            stroke="#0f172a"
          />
        </g>

        {/* ==================== DYNAMIC WORKPIECES ON BELT & CHUTES ==================== */}
        {parts.map((p) => {
          const fill =
            p.kind === 'metal'
              ? 'url(#steelPart)'
              : p.kind === 'defect'
                ? 'url(#redPart)'
                : 'url(#bluePart)';
          const stroke = p.kind === 'metal' ? '#f8fafc' : p.kind === 'defect' ? '#fecaca' : '#bae6fd';
          const tag = p.kind === 'metal' ? 'Fe' : p.kind === 'defect' ? 'NG' : 'OK';
          return (
            <g key={p.id} transform={`translate(${p.x - 19}, ${p.y - 16})`}>
              <rect x="0" y="0" width="38" height="32" rx="5" fill={fill} stroke={stroke} strokeWidth="1.8" />
              {/* Subtle industrial top bevel */}
              <rect x="4" y="4" width="30" height="7" rx="2" fill="rgba(255,255,255,0.22)" />
              <text
                x="19"
                y="23"
                textAnchor="middle"
                fill={p.kind === 'metal' ? '#0f172a' : '#ffffff'}
                fontSize="11.2"
                fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                fontWeight="900"
              >
                {tag}
              </text>
            </g>
          );
        })}

        {/* Legend Footer inside SVG */}
        <g transform="translate(274, 356)">
          <rect x="0" y="0" width="300" height="58" rx="8" fill="#0f172a" stroke="#1e293b" />
          <text x="14" y="20" fill="#94a3b8" fontSize="11.2" fontWeight="700">
            分拣工艺路由图例：
          </text>
          <rect x="14" y="32" width="12" height="12" rx="2" fill="#38bdf8" />
          <text x="31" y="42" fill="#cbd5e1" fontSize="11.2">
            蓝:合格入箱
          </text>
          <rect x="104" y="32" width="12" height="12" rx="2" fill="#cbd5e1" />
          <text x="121" y="42" fill="#cbd5e1" fontSize="11.2">
            银:1#缸分拣
          </text>
          <rect x="196" y="32" width="12" height="12" rx="2" fill="#f87171" />
          <text x="213" y="42" fill="#cbd5e1" fontSize="11.2">
            红:2#缸剔除
          </text>
        </g>
      </svg>
    </TwinShell>
  );
};
