import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  BarChart3,
  BellOff,
  Check,
  CheckCircle2,
  ClipboardList,
  Download,
  Flame,
  Lock,
  PauseCircle,
  Play,
  RotateCcw,
  ShieldAlert,
  Square,
  Trash2,
  Unlock,
} from 'lucide-react';

interface RecipePreset {
  id: number;
  name: string;
  targetTemp: number;
  overTemp: number;
  holdSec: number;
  speedPct: number;
}

const RECIPES: RecipePreset[] = [
  { id: 1, name: 'LFP-100Ah 磷酸铁锂', targetTemp: 85.0, overTemp: 95.0, holdSec: 5, speedPct: 65 },
  { id: 2, name: 'NCM-150Ah 三元高镍', targetTemp: 90.0, overTemp: 98.0, holdSec: 6, speedPct: 55 },
  { id: 3, name: 'CTP-280Ah 储能电芯', targetTemp: 82.0, overTemp: 93.0, holdSec: 4, speedPct: 75 },
];

const CT_TARGET_SEC = 12.0;

interface WarehouseSlotState {
  idx: number;
  row: number;
  col: number;
  posX: number;
  posZ: number;
  occupied: boolean;
  locked: boolean;
  barcode: string;
  grade: 'A' | 'B' | null;
  peakTemp: number;
  entryTime: string;
}

type AlarmStatus = 'ACTIVE_UNACK' | 'ACTIVE_ACK' | 'CLEARED';

interface AlarmEventRecord {
  id: number;
  code: string;
  severity: 'CRITICAL' | 'WARNING';
  message: string;
  triggeredAt: string;
  ackedAt: string | null;
  clearedAt: string | null;
  status: AlarmStatus;
}

interface ShiftCycleRecord {
  seq: number;
  barcode: string;
  grade: 'A' | 'B' | 'NG';
  ctSec: number;
  time: string;
}

type TwinPackML = 'Stopped' | 'Idle' | 'Execute' | 'Held' | 'Aborted';
type AlarmFilter = 'ALL' | 'ACTIVE' | 'UNACK' | 'CLEARED';

function buildInitialSlots(): WarehouseSlotState[] {
  return Array.from({ length: 12 }, (_, i) => {
    const idx = i + 1;
    const row = Math.floor(i / 4) + 1;
    const col = (i % 4) + 1;
    const prefill = idx <= 2;
    return {
      idx,
      row,
      col,
      posX: 480 + (col - 1) * 320,
      posZ: 180 + (row - 1) * 240,
      occupied: prefill,
      locked: false,
      barcode: prefill ? `BAT26-LFP-000${idx}` : '',
      grade: prefill ? (idx === 1 ? 'A' : 'B') : null,
      peakTemp: prefill ? 85.1 : 0,
      entryTime: prefill ? '09:12:08' : '',
    };
  });
}

function buildInitialShiftCycles(): ShiftCycleRecord[] {
  return [
    { seq: 1, barcode: 'BAT26-LFP-0001', grade: 'A', ctSec: 11.1, time: '09:11:57' },
    { seq: 2, barcode: 'BAT26-LFP-0002', grade: 'B', ctSec: 11.3, time: '09:12:08' },
  ];
}

function nowTimeStr(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

interface ScadaTwinTabProps {
  onMilestoneAchieved?: () => void;
}

export const ScadaTwinTab: React.FC<ScadaTwinTabProps> = ({ onMilestoneAchieved }) => {
  const [recipeIdx, setRecipeIdx] = useState<number>(0);
  const recipe = RECIPES[recipeIdx];

  const [packml, setPackml] = useState<TwinPackML>('Idle');
  const [step, setStep] = useState<number>(10);
  const [stepProgress, setStepProgress] = useState<number>(0);
  const [servoHomed, setServoHomed] = useState<boolean>(true);
  const [heaterEnabled, setHeaterEnabled] = useState<boolean>(true);

  // Live thermal PID states
  const [actTemp, setActTemp] = useState<number>(84.6);
  const [pidOutPct, setPidOutPct] = useState<number>(36);
  const [tempHistory, setTempHistory] = useState<number[]>(() =>
    Array.from({ length: 36 }, (_, i) => 83.2 + Math.sin(i * 0.35) * 0.6 + i * 0.04)
  );
  const integralRef = useRef<number>(32);
  const batchSeqRef = useRef<number>(3);
  const alarmSeqRef = useRef<number>(1);

  // Active module in line
  const [activeBarcode, setActiveBarcode] = useState<string>('BAT26-LFP-0003');
  const [activeGrade, setActiveGrade] = useState<'A' | 'B' | 'NG'>('A');
  const [activeResistance, setActiveResistance] = useState<number>(0.34);
  const [targetSlotIdx, setTargetSlotIdx] = useState<number>(3);

  // 4x3 Warehouse matrix + selected slot drawer
  const [slots, setSlots] = useState<WarehouseSlotState[]>(buildInitialSlots);
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number>(1);

  // Shift cycle & yield records (single source of truth for KPIs + Shift Panel)
  const [shiftCycles, setShiftCycles] = useState<ShiftCycleRecord[]>(buildInitialShiftCycles);

  // Industrial alarm event log (active + acknowledged + archived cleared)
  const [alarmLog, setAlarmLog] = useState<AlarmEventRecord[]>([]);
  const [alarmFilter, setAlarmFilter] = useState<AlarmFilter>('ALL');
  const [muted, setMuted] = useState<boolean>(false);
  const milestoneFiredRef = useRef<boolean>(false);

  const activeAlarms = useMemo(() => alarmLog.filter((a) => a.status !== 'CLEARED'), [alarmLog]);
  const unackedAlarms = useMemo(
    () => alarmLog.filter((a) => a.status === 'ACTIVE_UNACK'),
    [alarmLog]
  );
  const archivedAlarms = useMemo(() => alarmLog.filter((a) => a.status === 'CLEARED'), [alarmLog]);

  const pushAlarm = (code: string, severity: AlarmEventRecord['severity'], message: string) => {
    setMuted(false);
    setAlarmLog((prev) => {
      // Avoid duplicate active alarm of same code
      if (prev.some((a) => a.code === code && a.status !== 'CLEARED')) return prev;
      const nextId = alarmSeqRef.current;
      alarmSeqRef.current += 1;
      const entry: AlarmEventRecord = {
        id: nextId,
        code,
        severity,
        message,
        triggeredAt: nowTimeStr(),
        ackedAt: null,
        clearedAt: null,
        status: 'ACTIVE_UNACK',
      };
      return [entry, ...prev].slice(0, 60);
    });
  };

  // Real-time 280ms PLC + Thermal PID + Motion Digital Twin Tick
  useEffect(() => {
    const timer = window.setInterval(() => {
      // 1. OB30 Thermal PID simulation (1st-order plant + PI anti-windup)
      setActTemp((prevTemp) => {
        const hasOverTemp = activeAlarms.some((a) => a.code === 'ALM-009');
        const allowHeat = heaterEnabled && packml !== 'Aborted' && !hasOverTemp;

        let out = 0;
        if (allowHeat) {
          const err = recipe.targetTemp - prevTemp;
          const pTerm = 8.5 * err;
          if ((pTerm + integralRef.current > 0 && pTerm + integralRef.current < 100) || err < 0) {
            integralRef.current = Math.max(0, Math.min(75, integralRef.current + 0.55 * err * 0.25));
          }
          out = Math.max(0, Math.min(100, pTerm + integralRef.current));
        } else {
          integralRef.current = Math.max(0, integralRef.current - 2);
          out = 0;
        }
        setPidOutPct(Math.round(out));

        const dT =
          (out * 0.095 - (prevTemp - 25.0) * 0.048) * 0.25 + (Math.random() - 0.5) * 0.08;
        const nextTemp = Math.max(25, Number((prevTemp + dT).toFixed(2)));

        if (nextTemp >= recipe.overTemp) {
          pushAlarm(
            'ALM-009',
            'CRITICAL',
            `热压腔超温 (${nextTemp.toFixed(1)}°C ≥ ${recipe.overTemp}°C)，OB30 已切断 SSR 输出并转入 Aborted`
          );
          setPackml('Aborted');
          setStep(0);
        }

        setTempHistory((hist) => [...hist.slice(-39), nextTemp]);
        return nextTemp;
      });

      // 2. GRAFCET Step Progression when PackML = Execute
      if (packml === 'Execute') {
        setStepProgress((prog) => {
          const nextProg = prog + 20;
          if (nextProg < 100) return nextProg;

          setStep((currStep) => {
            if (currStep === 10) {
              const seqStr = String(batchSeqRef.current).padStart(4, '0');
              const prefix = recipe.name.split('-')[0];
              setActiveBarcode(`BAT26-${prefix}-${seqStr}`);
              const roll = Math.random();
              const grade: 'A' | 'B' | 'NG' = roll < 0.72 ? 'A' : roll < 0.9 ? 'B' : 'NG';
              setActiveGrade(grade);
              setActiveResistance(
                Number(
                  (grade === 'NG' ? 0.58 + Math.random() * 0.12 : 0.28 + Math.random() * 0.13).toFixed(
                    2
                  )
                )
              );
              return 20;
            }
            if (currStep === 20) {
              if (activeGrade === 'NG') {
                const ngSeq = batchSeqRef.current;
                const ngBarcode = activeBarcode;
                // NG module rejected at Step 20 without thermal press
                setShiftCycles((prev) => [
                  ...prev,
                  {
                    seq: ngSeq,
                    barcode: ngBarcode,
                    grade: 'NG',
                    ctSec: Number((4.8 + Math.random() * 0.6).toFixed(1)),
                    time: nowTimeStr(),
                  },
                ]);
                batchSeqRef.current += 1;
                return 10;
              }
              const freeSlot = slots.find((s) => !s.occupied && !s.locked);
              if (!freeSlot) {
                pushAlarm(
                  'ALM-012',
                  'WARNING',
                  '4×3 立体库 12 个仓位已满，状态机切入 Held，请出库清空后点击 Unhold 续跑'
                );
                setPackml('Held');
                return 20;
              }
              setTargetSlotIdx(freeSlot.idx);
              return 30;
            }
            if (currStep === 30) {
              return 40;
            }
            if (currStep === 40) {
              return 50;
            }
            // Step 50 -> commit slot to RETAIN DB & record measured cycle time
            const storedSlot = targetSlotIdx;
            const storedBarcode = activeBarcode;
            const storedGrade: 'A' | 'B' = activeGrade === 'B' ? 'B' : 'A';
            const peakT = actTemp;
            const recipeBaseCt = 9.4 + recipe.holdSec * 0.36;
            const measuredCt = Number((recipeBaseCt + (Math.random() - 0.35) * 1.1).toFixed(1));
            const seqNo = batchSeqRef.current;

            setSlots((prev) =>
              prev.map((s) =>
                s.idx === storedSlot
                  ? {
                      ...s,
                      occupied: true,
                      barcode: storedBarcode,
                      grade: storedGrade,
                      peakTemp: Number(peakT.toFixed(1)),
                      entryTime: nowTimeStr(),
                    }
                  : s
              )
            );
            setSelectedSlotIdx(storedSlot);
            setShiftCycles((prev) => [
              ...prev,
              {
                seq: seqNo,
                barcode: storedBarcode,
                grade: storedGrade,
                ctSec: measuredCt,
                time: nowTimeStr(),
              },
            ]);
            batchSeqRef.current += 1;
            if (!milestoneFiredRef.current && onMilestoneAchieved) {
              milestoneFiredRef.current = true;
              onMilestoneAchieved();
            }
            return 10;
          });
          return 0;
        });
      }
    }, 280);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packml, recipe, heaterEnabled, activeAlarms, activeGrade, slots, targetSlotIdx, activeBarcode, actTemp]);

  // Operator Commands
  const handleStart = () => {
    if (!servoHomed) {
      pushAlarm('ALM-008', 'WARNING', 'SINAMICS V90 X/Z 轴尚未完成原点回归，禁止启动自动生产');
      return;
    }
    if (activeAlarms.some((a) => a.severity === 'CRITICAL')) {
      return;
    }
    setHeaterEnabled(true);
    setPackml('Execute');
    setStep((s) => (s === 0 ? 10 : s));
  };

  const handleHold = () => {
    if (packml === 'Execute') setPackml('Held');
  };

  const handleUnhold = () => {
    if (packml === 'Held' && !activeAlarms.some((a) => a.code === 'ALM-012')) {
      setPackml('Execute');
    }
  };

  const handleStop = () => {
    setPackml('Stopped');
    setStep(0);
    setStepProgress(0);
  };

  const handleReset = () => {
    const overTempActive = activeAlarms.some((a) => a.code === 'ALM-009');
    if (overTempActive && actTemp >= recipe.overTemp - 5.0) {
      setActTemp(recipe.overTemp - 6.5);
    }
    const ts = nowTimeStr();
    setServoHomed(true);
    setAlarmLog((prev) =>
      prev.map((a) =>
        a.status !== 'CLEARED'
          ? {
              ...a,
              ackedAt: a.ackedAt ?? ts,
              clearedAt: ts,
              status: 'CLEARED',
            }
          : a
      )
    );
    setMuted(false);
    setHeaterEnabled(true);
    setPackml('Idle');
    setStep(10);
    setStepProgress(0);
  };

  // Fault Injection Actions
  const injectOverTemp = () => {
    setActTemp(recipe.overTemp + 2.4);
    pushAlarm(
      'ALM-009',
      'CRITICAL',
      `[故障注入] 热压腔模拟超温 ${(recipe.overTemp + 2.4).toFixed(1)}°C，OB30 强切 SSR 加热并锁存，PackML 转 Aborted`
    );
    setPackml('Aborted');
    setStep(0);
  };

  const injectServoUnhomed = () => {
    setServoHomed(false);
    pushAlarm(
      'ALM-008',
      'WARNING',
      '[故障注入] V90 PN 立体库 X/Z 轴编码器原点丢失，设备转入 Held，须确认并执行 Reset 回零'
    );
    if (packml === 'Execute') setPackml('Held');
  };

  const injectCylinderTimeout = () => {
    pushAlarm(
      'ALM-004',
      'CRITICAL',
      '[故障注入] 阻挡夹紧气缸 FB_Cylinder2Pos 伸出超 3.0s 未检出磁簧到位 (FaultCode=101)'
    );
    setPackml('Held');
  };

  const ackAllAlarms = () => {
    const ts = nowTimeStr();
    setAlarmLog((prev) =>
      prev.map((a) =>
        a.status === 'ACTIVE_UNACK'
          ? { ...a, ackedAt: ts, status: 'ACTIVE_ACK' }
          : a
      )
    );
  };

  const ackSingleAlarm = (id: number) => {
    const ts = nowTimeStr();
    setAlarmLog((prev) =>
      prev.map((a) =>
        a.id === id && a.status === 'ACTIVE_UNACK'
          ? { ...a, ackedAt: ts, status: 'ACTIVE_ACK' }
          : a
      )
    );
  };

  const clearArchivedAlarms = () => {
    setAlarmLog((prev) => prev.filter((a) => a.status !== 'CLEARED'));
  };

  const exportAlarmCsv = () => {
    const header = 'EventID,AlarmCode,Severity,Status,TriggeredAt,AckedAt,ClearedAt,Message';
    const rows = alarmLog.map((a) =>
      [
        `EV-${String(a.id).padStart(3, '0')}`,
        a.code,
        a.severity,
        a.status,
        a.triggeredAt,
        a.ackedAt ?? '',
        a.clearedAt ?? '',
        `"${a.message.replace(/"/g, '""')}"`,
      ].join(',')
    );
    const blob = new Blob([`\uFEFF${[header, ...rows].join('\n')}`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'SCADA_Alarm_Event_Log.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const clearWarehouse = () => {
    const ts = nowTimeStr();
    setSlots((prev) =>
      prev.map((s) => ({
        ...s,
        occupied: false,
        barcode: '',
        grade: null,
        peakTemp: 0,
        entryTime: '',
      }))
    );
    setAlarmLog((prev) =>
      prev.map((a) =>
        a.code === 'ALM-012' && a.status !== 'CLEARED'
          ? { ...a, ackedAt: a.ackedAt ?? ts, clearedAt: ts, status: 'CLEARED' }
          : a
      )
    );
  };

  const toggleSlotLock = (idx: number) => {
    setSlots((prev) => prev.map((s) => (s.idx === idx ? { ...s, locked: !s.locked } : s)));
  };

  // Shift Yield & Cycle Time Telemetry (derived strictly from recorded cycles)
  const shiftMetrics = useMemo(() => {
    const total = shiftCycles.length;
    const gradeA = shiftCycles.filter((c) => c.grade === 'A').length;
    const gradeB = shiftCycles.filter((c) => c.grade === 'B').length;
    const ng = shiftCycles.filter((c) => c.grade === 'NG').length;
    const good = gradeA + gradeB;

    const fullProcessCycles = shiftCycles.filter((c) => c.grade !== 'NG');
    const latestCt =
      fullProcessCycles.length > 0
        ? fullProcessCycles[fullProcessCycles.length - 1].ctSec
        : 0;
    const avgCt =
      fullProcessCycles.length > 0
        ? Number(
            (
              fullProcessCycles.reduce((s, c) => s + c.ctSec, 0) /
              fullProcessCycles.length
            ).toFixed(2)
          )
        : 0;
    const minCt =
      fullProcessCycles.length > 0
        ? Math.min(...fullProcessCycles.map((c) => c.ctSec))
        : 0;
    const maxCt =
      fullProcessCycles.length > 0
        ? Math.max(...fullProcessCycles.map((c) => c.ctSec))
        : 0;
    const onTargetCount = fullProcessCycles.filter((c) => c.ctSec <= CT_TARGET_SEC).length;
    const ctPassRatePct =
      fullProcessCycles.length > 0
        ? Math.round((onTargetCount / fullProcessCycles.length) * 100)
        : 100;
    const uph = avgCt > 0 ? Math.round(3600 / avgCt) : 0;

    const yieldPctNum = total > 0 ? (good / total) * 100 : 100;
    const gradeAPct = total > 0 ? (gradeA / total) * 100 : 0;
    const gradeBPct = total > 0 ? (gradeB / total) * 100 : 0;
    const ngPct = total > 0 ? (ng / total) * 100 : 0;

    // Formula-backed OEE = Availability * Performance * Quality
    const availability =
      packml === 'Aborted' ? 0 : packml === 'Held' ? 0.78 : packml === 'Stopped' ? 0.65 : 0.96;
    const performance = avgCt > 0 ? Math.min(1, 11.2 / avgCt) : 1;
    const quality = total > 0 ? good / total : 1;
    const oeePct = (availability * performance * quality * 100).toFixed(1);

    return {
      total,
      good,
      gradeA,
      gradeB,
      ng,
      yieldPct: yieldPctNum.toFixed(1),
      gradeAPct,
      gradeBPct,
      ngPct,
      latestCt,
      avgCt,
      minCt,
      maxCt,
      ctPassRatePct,
      uph,
      oeePct,
      recentFullCycles: fullProcessCycles.slice(-10),
    };
  }, [shiftCycles, packml]);

  const filteredAlarmLog = useMemo(() => {
    if (alarmFilter === 'ACTIVE') return activeAlarms;
    if (alarmFilter === 'UNACK') return unackedAlarms;
    if (alarmFilter === 'CLEARED') return archivedAlarms;
    return alarmLog;
  }, [alarmFilter, alarmLog, activeAlarms, unackedAlarms, archivedAlarms]);

  const occupiedCount = slots.filter((s) => s.occupied).length;
  const selectedSlot = slots.find((s) => s.idx === selectedSlotIdx) ?? slots[0];
  const hasActiveAlarms = activeAlarms.length > 0;
  const hasUnackedAlarms = unackedAlarms.length > 0;

  // Build SVG polyline for temperature trend (Y range 70°C .. 102°C)
  const tempToY = (t: number) => {
    const clamped = Math.max(70, Math.min(102, t));
    return 118 - ((clamped - 70) / 32) * 102;
  };
  const trendPoints = tempHistory
    .map(
      (t, i) =>
        `${(18 + (i / Math.max(1, tempHistory.length - 1)) * 392).toFixed(1)},${tempToY(t).toFixed(1)}`
    )
    .join(' ');

  const stepLabels: Record<number, string> = {
    0: '停机待命',
    10: 'Step 10 · G120 进料阻挡',
    20: 'Step 20 · 扫码与视觉分级',
    30: 'Step 30 · V90 抓取入模',
    40: 'Step 40 · 85°C 恒温热压',
    50: 'Step 50 · 立体库精准入库',
  };

  return (
    <div>
      {/* Top Industrial Real-Time Alarm Banner */}
      <div
        className={`cap-alarm-bar ${
          hasUnackedAlarms ? 'has-alarm' : hasActiveAlarms ? 'has-acked-alarm' : ''
        }`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
          {hasActiveAlarms ? (
            <AlertTriangle
              size={18}
              color={hasUnackedAlarms ? '#f87171' : '#fbbf24'}
              style={{ flexShrink: 0 }}
            />
          ) : (
            <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0 }} />
          )}
          <div style={{ fontSize: 12.5, lineHeight: 1.45, minWidth: 0 }}>
            {hasActiveAlarms ? (
              <>
                <strong
                  className="cap-mono"
                  style={{ color: hasUnackedAlarms ? '#fca5a5' : '#fde68a' }}
                >
                  [{activeAlarms[0].code} · {activeAlarms[0].triggeredAt}]{' '}
                  {activeAlarms[0].status === 'ACTIVE_UNACK' ? '未确认 UNACK' : '已确认 ACK'}{' '}
                </strong>
                <span>{activeAlarms[0].message}</span>
                {activeAlarms.length > 1 && (
                  <span className="cap-mono" style={{ marginLeft: 8, color: '#fbbf24' }}>
                    +{activeAlarms.length - 1} 条并发活动报警
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: '#86efac' }}>
                <strong>[SCADA 报警横幅]</strong> 全站 PROFINET 节点通信正常 · 安全回路闭合 · 当前无活动报警
                {archivedAlarms.length > 0 && (
                  <span className="cap-mono" style={{ marginLeft: 8, color: '#94a3b8' }}>
                    (历史已归档 {archivedAlarms.length} 条)
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span className="cap-badge red">未确认 {unackedAlarms.length}</span>
          <span className="cap-badge amber">活动 {activeAlarms.length}</span>
          <button
            type="button"
            className="cap-btn"
            style={{ padding: '4px 9px', fontSize: 11.5 }}
            disabled={!hasActiveAlarms}
            onClick={() => setMuted((m) => !m)}
          >
            <BellOff size={13} /> {muted ? '已消音' : '蜂鸣消音'}
          </button>
          <button
            type="button"
            className="cap-btn warn"
            style={{ padding: '4px 9px', fontSize: 11.5 }}
            disabled={!hasUnackedAlarms}
            onClick={ackAllAlarms}
          >
            <Check size={13} /> 全部确认 ACK
          </button>
          <button
            type="button"
            className="cap-btn primary"
            style={{ padding: '4px 9px', fontSize: 11.5 }}
            onClick={handleReset}
          >
            <RotateCcw size={13} /> 复位归档 Reset
          </button>
        </div>
      </div>

      {/* WinCC Unified Command & Recipe Control Strip */}
      <div className="cap-panel" style={{ padding: 14, marginBottom: 14 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
            <button
              type="button"
              className="cap-btn success"
              disabled={packml === 'Execute' || packml === 'Aborted'}
              onClick={handleStart}
            >
              <Play size={14} /> 自动启动 Execute
            </button>
            <button
              type="button"
              className="cap-btn warn"
              disabled={packml !== 'Execute'}
              onClick={handleHold}
            >
              <PauseCircle size={14} /> 工艺暂停 Hold
            </button>
            <button
              type="button"
              className="cap-btn success"
              disabled={packml !== 'Held'}
              onClick={handleUnhold}
            >
              继续 Unhold
            </button>
            <button
              type="button"
              className="cap-btn"
              disabled={packml === 'Stopped' || packml === 'Aborted'}
              onClick={handleStop}
            >
              <Square size={13} /> 停机 Stop
            </button>
            <button
              type="button"
              className="cap-btn danger-solid"
              onClick={() => {
                pushAlarm(
                  'ALM-001',
                  'CRITICAL',
                  '操作员拍下急停按钮 (E-Stop)，安全继电器切断 STO 与 SSR 加热'
                );
                setPackml('Aborted');
                setStep(0);
              }}
            >
              <AlertOctagon size={14} /> 急停 E-Stop
            </button>
          </div>

          {/* Recipe Switcher & Fault Injection */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--cap-text-muted)' }}>当前工艺配方：</span>
            <select
              aria-label="切换锂电模组工艺配方"
              className="cap-input"
              value={recipeIdx}
              onChange={(e) => setRecipeIdx(Number(e.target.value))}
            >
              {RECIPES.map((r, i) => (
                <option key={r.id} value={i}>
                  {r.name} ({r.targetTemp.toFixed(1)}°C)
                </option>
              ))}
            </select>
            <button type="button" className="cap-btn danger" onClick={injectOverTemp}>
              <Flame size={13} /> 注入超温
            </button>
            <button type="button" className="cap-btn warn" onClick={injectServoUnhomed}>
              <ShieldAlert size={13} /> 注入伺服未回零
            </button>
            <button type="button" className="cap-btn danger" onClick={injectCylinderTimeout}>
              注入气缸超时
            </button>
          </div>
        </div>
      </div>

      {/* 6-Card Live OEE & Station KPI Strip */}
      <div className="cap-kpi-strip">
        <div className="cap-kpi-card">
          <div className="cap-kpi-label">PackML 主状态</div>
          <div
            className="cap-kpi-value"
            style={{
              color:
                packml === 'Execute'
                  ? '#10b981'
                  : packml === 'Aborted'
                    ? '#ef4444'
                    : packml === 'Held'
                      ? '#f59e0b'
                      : '#14b8a6',
            }}
          >
            {packml}
          </div>
        </div>
        <div className="cap-kpi-card" title="OEE = 可动率 × 节拍性能率 × 视觉良率">
          <div className="cap-kpi-label">综合设备效率 OEE</div>
          <div className="cap-kpi-value" style={{ color: '#14b8a6' }}>
            {shiftMetrics.oeePct}%
          </div>
        </div>
        <div className="cap-kpi-card">
          <div className="cap-kpi-label">班次视觉良率</div>
          <div className="cap-kpi-value" style={{ color: '#10b981' }}>
            {shiftMetrics.yieldPct}%
          </div>
        </div>
        <div className="cap-kpi-card">
          <div className="cap-kpi-label">单件最新 / 平均 CT</div>
          <div className="cap-kpi-value" style={{ fontSize: 15 }}>
            {shiftMetrics.latestCt.toFixed(1)}s{' '}
            <span style={{ color: 'var(--cap-text-muted)', fontSize: 12 }}>
              / avg {shiftMetrics.avgCt.toFixed(1)}s
            </span>
          </div>
        </div>
        <div className="cap-kpi-card">
          <div className="cap-kpi-label">累计 / 合格 / NG</div>
          <div className="cap-kpi-value" style={{ fontSize: 15 }}>
            {shiftMetrics.total} / <span style={{ color: '#10b981' }}>{shiftMetrics.good}</span> /{' '}
            <span style={{ color: '#f87171' }}>{shiftMetrics.ng}</span>
          </div>
        </div>
        <div className="cap-kpi-card">
          <div className="cap-kpi-label">立体库占用 (RETAIN)</div>
          <div className="cap-kpi-value">{occupiedCount} / 12</div>
        </div>
      </div>

      {/* Main 2-Column WinCC Unified SCADA Workspace */}
      <div className="cap-scada-grid">
        {/* Left Column: Animated Production Line Mimic + Live PID Temperature Curve */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {/* Animated Station Mimic */}
          <div className="cap-panel" style={{ marginBottom: 0 }}>
            <div className="cap-panel-head" style={{ marginBottom: 10 }}>
              <h3 className="cap-panel-title">
                <Activity size={16} color="#14b8a6" /> 锂电模组工作站实时数字孪生画面
              </h3>
              <span className="cap-badge teal">{stepLabels[step] ?? '待机'}</span>
            </div>

            <div className="cap-svg-stage">
              <svg viewBox="0 0 640 212" width="100%" style={{ display: 'block', minWidth: 460 }}>
                <rect x="14" y="140" width="612" height="16" rx="5" fill="#1e293b" stroke="#334155" />
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                  <circle
                    key={i}
                    cx={36 + i * 52}
                    cy={148}
                    r={4}
                    fill={packml === 'Execute' && step === 10 ? '#10b981' : '#475569'}
                  />
                ))}

                {/* Station 1: Infeed & G120 */}
                <rect
                  x="22"
                  y="32"
                  width="126"
                  height="98"
                  rx="6"
                  fill={step === 10 && packml === 'Execute' ? 'rgba(16,185,129,0.16)' : '#0f172a'}
                  stroke={step === 10 && packml === 'Execute' ? '#10b981' : '#334155'}
                  strokeWidth={step === 10 ? 2 : 1.2}
                />
                <text x="85" y="54" textAnchor="middle" fill="#e2e8f0" fontSize="11.5" fontWeight="700">
                  ① G120 进料段
                </text>
                <text
                  x="85"
                  y="72"
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="11"
                  fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                >
                  设定 {recipe.speedPct}% 转速
                </text>
                <text x="85" y="92" textAnchor="middle" fill={step === 10 ? '#34d399' : '#64748b'} fontSize="10.5">
                  {step === 10 && packml === 'Execute' ? '传送与阻挡夹紧' : '待机'}
                </text>

                {/* Station 2: Barcode + Smart Vision */}
                <rect
                  x="166"
                  y="32"
                  width="136"
                  height="98"
                  rx="6"
                  fill={step === 20 && packml === 'Execute' ? 'rgba(56,189,248,0.16)' : '#0f172a'}
                  stroke={step === 20 && packml === 'Execute' ? '#38bdf8' : '#334155'}
                  strokeWidth={step === 20 ? 2 : 1.2}
                />
                <text x="234" y="54" textAnchor="middle" fill="#e2e8f0" fontSize="11.5" fontWeight="700">
                  ② 扫码视觉分级
                </text>
                <text
                  x="234"
                  y="74"
                  textAnchor="middle"
                  fill="#38bdf8"
                  fontSize="11"
                  fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                >
                  {activeBarcode}
                </text>
                <text
                  x="234"
                  y="94"
                  textAnchor="middle"
                  fill={activeGrade === 'NG' ? '#f87171' : activeGrade === 'A' ? '#34d399' : '#38bdf8'}
                  fontSize="11"
                  fontWeight="700"
                >
                  分级: {activeGrade}级 · 内阻 {activeResistance}mΩ
                </text>
                {step === 20 && packml === 'Execute' && (
                  <polygon points="214,104 254,104 268,136 200,136" fill="rgba(56,189,248,0.2)" />
                )}

                {/* Station 3: Thermal Press PID Chamber */}
                <rect
                  x="320"
                  y="32"
                  width="142"
                  height="98"
                  rx="6"
                  fill={
                    actTemp >= recipe.overTemp
                      ? 'rgba(239,68,68,0.24)'
                      : step === 40 && packml === 'Execute'
                        ? 'rgba(245,158,11,0.18)'
                        : '#0f172a'
                  }
                  stroke={actTemp >= recipe.overTemp ? '#ef4444' : step === 40 ? '#f59e0b' : '#334155'}
                  strokeWidth={step === 40 || actTemp >= recipe.overTemp ? 2 : 1.2}
                />
                <text x="391" y="54" textAnchor="middle" fill="#e2e8f0" fontSize="11.5" fontWeight="700">
                  ③ OB30 热压恒温腔
                </text>
                <text
                  x="391"
                  y="78"
                  textAnchor="middle"
                  fill={actTemp >= recipe.overTemp ? '#fca5a5' : '#fbbf24'}
                  fontSize="15"
                  fontWeight="800"
                  fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                >
                  {actTemp.toFixed(1)} °C
                </text>
                <text
                  x="391"
                  y="96"
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="11"
                  fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                >
                  SV:{recipe.targetTemp.toFixed(1)}°C · SSR:{pidOutPct}%
                </text>
                <rect
                  x="375"
                  y={step === 40 && packml === 'Execute' ? 112 : 102}
                  width="32"
                  height="14"
                  rx="3"
                  fill={step === 40 ? '#f59e0b' : '#475569'}
                />

                {/* Station 4: V90 X/Z Servo Gantry -> AS/RS */}
                <rect
                  x="480"
                  y="32"
                  width="142"
                  height="98"
                  rx="6"
                  fill={(step === 30 || step === 50) && packml === 'Execute' ? 'rgba(20,184,166,0.18)' : '#0f172a'}
                  stroke={step === 30 || step === 50 ? '#14b8a6' : '#334155'}
                  strokeWidth={step === 30 || step === 50 ? 2 : 1.2}
                />
                <text x="551" y="54" textAnchor="middle" fill="#e2e8f0" fontSize="11.5" fontWeight="700">
                  ④ V90 X/Z 堆垛机
                </text>
                <text
                  x="551"
                  y="75"
                  textAnchor="middle"
                  fill={servoHomed ? '#34d399' : '#f87171'}
                  fontSize="10.5"
                  fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                >
                  {servoHomed ? '原点 Homed: OK' : '原点丢失'}
                </text>
                <text
                  x="551"
                  y="94"
                  textAnchor="middle"
                  fill="#38bdf8"
                  fontSize="11"
                  fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                >
                  目标仓位: #{targetSlotIdx}
                </text>
                <text
                  x="551"
                  y="112"
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="11"
                  fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                >
                  X={slots[targetSlotIdx - 1]?.posX ?? 480} Z={slots[targetSlotIdx - 1]?.posZ ?? 180}
                </text>

                {/* Moving Battery Module Token */}
                {step > 0 && (
                  <g
                    transform={`translate(${
                      step === 10
                        ? 70 + stepProgress * 0.6
                        : step === 20
                          ? 218
                          : step === 30
                            ? 280 + stepProgress * 0.9
                            : step === 40
                              ? 375
                              : 530
                    }, 126)`}
                  >
                    <rect width="34" height="16" rx="3" fill="#10b981" stroke="#ecfdf5" strokeWidth="1.2" />
                    <text x="17" y="11" textAnchor="middle" fill="#052e16" fontSize="10" fontWeight="800">
                      CELL
                    </text>
                  </g>
                )}

                {/* Bottom live telemetry bar */}
                <text
                  x="22"
                  y="186"
                  fill="#94a3b8"
                  fontSize="11"
                  fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                >
                  当前追溯条码: {activeBarcode} | 热压保压: {recipe.holdSec}s | 步进进度: {stepProgress}%
                </text>
                <rect x="22" y="194" width="596" height="6" rx="3" fill="#1e293b" />
                <rect x="22" y="194" width={(596 * stepProgress) / 100} height="6" rx="3" fill="#14b8a6" />
              </svg>
            </div>
          </div>

          {/* Live SVG PID Temperature Trend Chart */}
          <div className="cap-panel" style={{ marginBottom: 0 }}>
            <div className="cap-panel-head" style={{ marginBottom: 10 }}>
              <h3 className="cap-panel-title">
                <Flame size={16} color="#f59e0b" /> OB30 热压腔 PID 实时温度趋势曲线
              </h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className="cap-badge amber">目标 {recipe.targetTemp.toFixed(1)}°C ±0.5°C</span>
                <span className={`cap-badge ${actTemp >= recipe.overTemp ? 'red' : 'green'}`}>
                  实测 {actTemp.toFixed(2)}°C
                </span>
              </div>
            </div>

            <div className="cap-svg-stage">
              <svg viewBox="0 0 430 134" width="100%" style={{ display: 'block' }}>
                <rect
                  x="18"
                  y={tempToY(recipe.targetTemp + 0.5)}
                  width="392"
                  height={Math.max(4, tempToY(recipe.targetTemp - 0.5) - tempToY(recipe.targetTemp + 0.5))}
                  fill="rgba(16,185,129,0.22)"
                />
                <line
                  x1="18"
                  y1={tempToY(recipe.overTemp)}
                  x2="410"
                  y2={tempToY(recipe.overTemp)}
                  stroke="#ef4444"
                  strokeWidth="1.2"
                  strokeDasharray="4 3"
                />
                <text
                  x="408"
                  y={tempToY(recipe.overTemp) - 3}
                  textAnchor="end"
                  fill="#f87171"
                  fontSize="11"
                  fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                >
                  超温急停 {recipe.overTemp}°C
                </text>

                <line
                  x1="18"
                  y1={tempToY(recipe.targetTemp)}
                  x2="410"
                  y2={tempToY(recipe.targetTemp)}
                  stroke="#10b981"
                  strokeWidth="1.2"
                  strokeDasharray="5 3"
                />
                <text
                  x="22"
                  y={tempToY(recipe.targetTemp) - 4}
                  fill="#34d399"
                  fontSize="11"
                  fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                >
                  SV {recipe.targetTemp.toFixed(1)}°C
                </text>

                <polyline
                  fill="none"
                  stroke={actTemp >= recipe.overTemp ? '#ef4444' : '#38bdf8'}
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                  points={trendPoints}
                />

                <text
                  x="18"
                  y="130"
                  fill="#94a3b8"
                  fontSize="11"
                  fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                >
                  t - 10s
                </text>
                <text
                  x="215"
                  y="130"
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="11"
                  fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                >
                  SSR PWM 占空比: {pidOutPct}% (OB30 100ms)
                </text>
                <text
                  x="410"
                  y="130"
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="11"
                  fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                >
                  实时
                </text>
              </svg>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive 4x3 AS/RS Warehouse Matrix + Selected Tray Inspector */}
        <div
          className="cap-panel"
          style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}
        >
          <div className="cap-panel-head" style={{ marginBottom: 0 }}>
            <h3 className="cap-panel-title">4×3 立体库仓位矩阵（点击仓位追溯条码）</h3>
            <button
              type="button"
              className="cap-btn"
              style={{ padding: '4px 10px', fontSize: 11.5 }}
              onClick={clearWarehouse}
            >
              <Trash2 size={13} /> 一键出库清空
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[3, 2, 1].map((rowNum) => (
              <div key={rowNum}>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--cap-text-muted)',
                    marginBottom: 4,
                    fontFamily: 'var(--cap-mono)',
                  }}
                >
                  第 {rowNum} 层 (Z = {180 + (rowNum - 1) * 240} mm)
                </div>
                <div className="cap-rack-grid">
                  {slots
                    .filter((s) => s.row === rowNum)
                    .map((s) => {
                      const cls = [
                        'cap-rack-slot',
                        s.locked
                          ? 'locked'
                          : s.occupied
                            ? s.grade === 'A'
                              ? 'occupied-a'
                              : 'occupied-b'
                            : '',
                        selectedSlotIdx === s.idx ? 'selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <button
                          key={s.idx}
                          type="button"
                          className={cls}
                          onClick={() => setSelectedSlotIdx(s.idx)}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 3,
                            }}
                          >
                            <span className="cap-mono" style={{ fontSize: 11, fontWeight: 700 }}>
                              #{String(s.idx).padStart(2, '0')}
                            </span>
                            {s.locked ? (
                              <Lock size={12} color="#f59e0b" />
                            ) : s.occupied ? (
                              <span
                                className={`cap-badge ${s.grade === 'A' ? 'green' : 'blue'}`}
                                style={{ padding: '0px 5px', fontSize: 10 }}
                              >
                                {s.grade}
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, color: 'var(--cap-text-muted)' }}>空仓</span>
                            )}
                          </div>
                          <div
                            className="cap-mono"
                            style={{
                              fontSize: 10,
                              color: 'var(--cap-text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {s.locked ? '维保禁用' : s.occupied ? s.barcode.slice(-8) : `X:${s.posX}`}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: 'var(--cap-bg)',
              border: '1px solid var(--cap-border-teal)',
              borderRadius: 11,
              padding: 14,
              marginTop: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 13.5 }}>
                仓位 #{selectedSlot.idx} 追溯详情（第 {selectedSlot.row} 层 · 第 {selectedSlot.col} 列）
              </strong>
              <button
                type="button"
                className="cap-btn"
                style={{ padding: '4px 9px', fontSize: 11.5 }}
                onClick={() => toggleSlotLock(selectedSlot.idx)}
              >
                {selectedSlot.locked ? <Unlock size={12} /> : <Lock size={12} />}
                {selectedSlot.locked ? '解除禁用' : '禁用维护'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12.5 }}>
              <div>
                <span style={{ color: 'var(--cap-text-muted)' }}>占用状态：</span>
                <strong>
                  {selectedSlot.locked
                    ? '人工维护禁用'
                    : selectedSlot.occupied
                      ? `已入库 (${selectedSlot.grade}级)`
                      : '空仓可分配'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--cap-text-muted)' }}>伺服目标坐标：</span>
                <strong className="cap-mono">
                  X={selectedSlot.posX} / Z={selectedSlot.posZ}mm
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--cap-text-muted)' }}>电芯托盘条码：</span>
                <strong className="cap-mono" style={{ color: 'var(--cap-blue)' }}>
                  {selectedSlot.barcode || '—'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--cap-text-muted)' }}>入库时间 / 峰值温：</span>
                <strong className="cap-mono">
                  {selectedSlot.entryTime ? `${selectedSlot.entryTime} (${selectedSlot.peakTemp}°C)` : '—'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* v3.0 Industrial Telemetry Row: Shift Yield/CT Stats + Alarm ACK Event Archive */}
      <div className="cap-scada-bottom-grid" style={{ marginTop: 14 }}>
        {/* Shift Yield & Cycle Time (CT) Statistics Panel */}
        <section className="cap-panel" style={{ marginBottom: 0 }}>
          <div className="cap-panel-head" style={{ marginBottom: 12 }}>
            <h3 className="cap-panel-title">
              <BarChart3 size={16} color="#14b8a6" /> 班次良率与节拍（CT）实测统计
            </h3>
            <span className="cap-badge teal">目标 CT ≤ {CT_TARGET_SEC.toFixed(1)}s</span>
          </div>

          {/* Segmented Yield Breakdown Bar */}
          <div style={{ marginBottom: 12 }}>
            <div
              className="cap-mono"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 6,
                fontSize: 11.5,
                marginBottom: 6,
              }}
            >
              <span style={{ color: 'var(--cap-green)' }}>
                A 级优品: {shiftMetrics.gradeA} ({shiftMetrics.gradeAPct.toFixed(1)}%)
              </span>
              <span style={{ color: 'var(--cap-blue)' }}>
                B 级良配: {shiftMetrics.gradeB} ({shiftMetrics.gradeBPct.toFixed(1)}%)
              </span>
              <span style={{ color: 'var(--cap-red)' }}>
                NG 剔除: {shiftMetrics.ng} ({shiftMetrics.ngPct.toFixed(1)}%)
              </span>
            </div>
            <div className="cap-yield-bar" aria-label="班次良率分布条">
              <div style={{ width: `${shiftMetrics.gradeAPct}%`, background: '#10b981' }} />
              <div style={{ width: `${shiftMetrics.gradeBPct}%`, background: '#38bdf8' }} />
              <div style={{ width: `${shiftMetrics.ngPct}%`, background: '#ef4444' }} />
            </div>
          </div>

          {/* Monospace Cycle Time Metrics Grid */}
          <div className="cap-shift-stat-grid cap-mono">
            <div className="cap-shift-cell">
              <span>班次平均 CT</span>
              <strong>{shiftMetrics.avgCt.toFixed(2)} s</strong>
            </div>
            <div className="cap-shift-cell">
              <span>最快 / 最慢 CT</span>
              <strong>
                {shiftMetrics.minCt.toFixed(1)} / {shiftMetrics.maxCt.toFixed(1)} s
              </strong>
            </div>
            <div className="cap-shift-cell">
              <span>折算实时 UPH</span>
              <strong style={{ color: 'var(--cap-teal-bright)' }}>{shiftMetrics.uph} 件/时</strong>
            </div>
            <div className="cap-shift-cell">
              <span>节拍达标率 (≤12s)</span>
              <strong style={{ color: shiftMetrics.ctPassRatePct >= 90 ? '#10b981' : '#f59e0b' }}>
                {shiftMetrics.ctPassRatePct}%
              </strong>
            </div>
          </div>

          {/* Last 10 Full-Process CT Bars */}
          <div style={{ marginTop: 12 }}>
            <div
              className="cap-mono"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: 'var(--cap-text-muted)',
                marginBottom: 6,
              }}
            >
              <span>最近入库模组实测节拍（最多展示近 10 件）</span>
              <span>虚线 = 12.0s 上限</span>
            </div>
            <div className="cap-ct-bars">
              <div className="cap-ct-limit-line" />
              {shiftMetrics.recentFullCycles.map((rec) => {
                const heightPct = Math.min(100, Math.max(18, (rec.ctSec / 14) * 100));
                const overLimit = rec.ctSec > CT_TARGET_SEC;
                return (
                  <div
                    key={rec.seq}
                    className="cap-ct-col"
                    title={`${rec.barcode} · ${rec.grade}级 · ${rec.ctSec}s (${rec.time})`}
                  >
                    <span className="cap-mono cap-ct-val">{rec.ctSec.toFixed(1)}</span>
                    <div className="cap-ct-bar-track">
                      <div
                        className={`cap-ct-bar-fill ${overLimit ? 'over' : ''}`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="cap-mono cap-ct-seq">#{rec.seq}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Industrial Alarm & ACK Event Archive Panel */}
        <section className="cap-panel" style={{ marginBottom: 0 }}>
          <div className="cap-panel-head" style={{ marginBottom: 10 }}>
            <h3 className="cap-panel-title">
              <ClipboardList size={16} color="#14b8a6" /> 工业报警确认（ACK）与历史归档事件表
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                type="button"
                className="cap-btn"
                style={{ padding: '4px 9px', fontSize: 11.5 }}
                disabled={alarmLog.length === 0}
                onClick={exportAlarmCsv}
              >
                <Download size={13} /> 导出日志 CSV
              </button>
              <button
                type="button"
                className="cap-btn"
                style={{ padding: '4px 9px', fontSize: 11.5 }}
                disabled={archivedAlarms.length === 0}
                onClick={clearArchivedAlarms}
              >
                清空已归档
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {(
              [
                { id: 'ALL', label: `全部 (${alarmLog.length})` },
                { id: 'ACTIVE', label: `活动 (${activeAlarms.length})` },
                { id: 'UNACK', label: `未确认 (${unackedAlarms.length})` },
                { id: 'CLEARED', label: `已归档 (${archivedAlarms.length})` },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                className={`cap-btn ${alarmFilter === f.id ? 'primary' : ''}`}
                style={{ padding: '4px 10px', fontSize: 11.5 }}
                onClick={() => setAlarmFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredAlarmLog.length === 0 ? (
            <div className="cap-empty-log">
              <CheckCircle2 size={20} color="#10b981" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>当前筛选条件下无报警事件记录</div>
                <div style={{ fontSize: 12, color: 'var(--cap-text-muted)', marginTop: 3 }}>
                  可点击上方「注入超温」「注入伺服未回零」「注入气缸超时」或「急停 E-Stop」，演练完整的触发 → 确认 (ACK) → 复位归档闭环。
                </div>
              </div>
            </div>
          ) : (
            <div className="cap-table-wrap" style={{ maxHeight: 270, overflowY: 'auto' }}>
              <table className="cap-table">
                <thead>
                  <tr>
                    <th>代码 / 级别</th>
                    <th>状态</th>
                    <th>报警详情</th>
                    <th>触发 / ACK / 复位</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlarmLog.map((ev) => (
                    <tr key={ev.id}>
                      <td className="cap-mono" style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700 }}>{ev.code}</div>
                        <span
                          className={`cap-badge ${ev.severity === 'CRITICAL' ? 'red' : 'amber'}`}
                          style={{ marginTop: 3, fontSize: 10 }}
                        >
                          {ev.severity === 'CRITICAL' ? '停机' : '预警'}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span
                          className={`cap-badge ${
                            ev.status === 'ACTIVE_UNACK'
                              ? 'red'
                              : ev.status === 'ACTIVE_ACK'
                                ? 'amber'
                                : 'green'
                          }`}
                        >
                          {ev.status === 'ACTIVE_UNACK'
                            ? '未确认触发'
                            : ev.status === 'ACTIVE_ACK'
                              ? '已确认待复位'
                              : '已复位归档'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{ev.message}</td>
                      <td className="cap-mono" style={{ fontSize: 11, whiteSpace: 'nowrap', color: 'var(--cap-text-muted)' }}>
                        <div>触: {ev.triggeredAt}</div>
                        <div>确: {ev.ackedAt ?? '--:--:--'}</div>
                        <div>复: {ev.clearedAt ?? '--:--:--'}</div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {ev.status === 'ACTIVE_UNACK' ? (
                          <button
                            type="button"
                            className="cap-btn warn"
                            style={{ padding: '4px 8px', fontSize: 11.5 }}
                            onClick={() => ackSingleAlarm(ev.id)}
                          >
                            确认 ACK
                          </button>
                        ) : (
                          <span className="cap-mono" style={{ fontSize: 11, color: 'var(--cap-text-muted)' }}>
                            {ev.status === 'ACTIVE_ACK' ? '待 Reset' : '已归档'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
