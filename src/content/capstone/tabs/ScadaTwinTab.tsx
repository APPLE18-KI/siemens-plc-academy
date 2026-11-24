import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  BellOff,
  CheckCircle2,
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

interface AlarmRecord {
  code: string;
  severity: 'CRITICAL' | 'WARNING';
  message: string;
  time: string;
  acked: boolean;
}

type TwinPackML = 'Stopped' | 'Idle' | 'Execute' | 'Held' | 'Aborted';

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

  // Active module in line
  const [activeBarcode, setActiveBarcode] = useState<string>('BAT26-LFP-0003');
  const [activeGrade, setActiveGrade] = useState<'A' | 'B' | 'NG'>('A');
  const [activeResistance, setActiveResistance] = useState<number>(0.34);
  const [targetSlotIdx, setTargetSlotIdx] = useState<number>(3);

  // 4x3 Warehouse matrix + selected slot drawer
  const [slots, setSlots] = useState<WarehouseSlotState[]>(buildInitialSlots);
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number>(1);

  // KPIs
  const [totalProduced, setTotalProduced] = useState<number>(2);
  const [goodCount, setGoodCount] = useState<number>(2);
  const [rejectCount, setRejectCount] = useState<number>(0);
  const [cycleTimeSec, setCycleTimeSec] = useState<number>(11.2);

  // Industrial alarms + mute
  const [alarms, setAlarms] = useState<AlarmRecord[]>([]);
  const [muted, setMuted] = useState<boolean>(false);
  const milestoneFiredRef = useRef<boolean>(false);

  const pushAlarm = (code: string, severity: AlarmRecord['severity'], message: string) => {
    setMuted(false);
    setAlarms((prev) => {
      if (prev.some((a) => a.code === code)) return prev;
      return [{ code, severity, message, time: nowTimeStr(), acked: false }, ...prev];
    });
  };

  // Real-time 250ms PLC + Thermal PID + Motion Digital Twin Tick
  useEffect(() => {
    const timer = window.setInterval(() => {
      // 1. OB30 Thermal PID simulation (1st-order plant + PI anti-windup)
      setActTemp((prevTemp) => {
        const hasOverTemp = alarms.some((a) => a.code === 'ALM-009');
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

        // Thermal physics: heat gain vs ambient cooling (25°C)
        const dT = ((out * 0.095) - (prevTemp - 25.0) * 0.048) * 0.25 + (Math.random() - 0.5) * 0.08;
        const nextTemp = Math.max(25, Number((prevTemp + dT).toFixed(2)));

        if (nextTemp >= recipe.overTemp) {
          pushAlarm('ALM-009', 'CRITICAL', `热压腔严重超温 (${nextTemp.toFixed(1)}°C ≥ ${recipe.overTemp}°C)！已切断 SSR 加热并跳 Aborted`);
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

          // Transition to next GRAFCET step
          setStep((currStep) => {
            if (currStep === 10) {
              // Entering Step 20: generate new barcode & vision inspection
              const seqStr = String(batchSeqRef.current).padStart(4, '0');
              const prefix = recipe.name.split('-')[0];
              setActiveBarcode(`BAT26-${prefix}-${seqStr}`);
              const roll = Math.random();
              const grade: 'A' | 'B' | 'NG' = roll < 0.72 ? 'A' : roll < 0.9 ? 'B' : 'NG';
              setActiveGrade(grade);
              setActiveResistance(
                Number((grade === 'NG' ? 0.58 + Math.random() * 0.12 : 0.28 + Math.random() * 0.13).toFixed(2))
              );
              return 20;
            }
            if (currStep === 20) {
              if (activeGrade === 'NG') {
                setTotalProduced((t) => t + 1);
                setRejectCount((r) => r + 1);
                batchSeqRef.current += 1;
                return 10; // Reject NG immediately!
              }
              // Search first unoccupied & unlocked slot in 4x3 warehouse
              const freeSlot = slots.find((s) => !s.occupied && !s.locked);
              if (!freeSlot) {
                pushAlarm('ALM-012', 'WARNING', '4×3 立体库 12 个仓位已全满！暂停进料，请点击“出库清空”后恢复');
                setPackml('Held');
                return 20;
              }
              setTargetSlotIdx(freeSlot.idx);
              return 30;
            }
            if (currStep === 30) {
              return 40; // Enter Thermal Press
            }
            if (currStep === 40) {
              return 50; // Enter AS/RS Store
            }
            // Step 50 -> commit slot to RETAIN DB & loop to Step 10
            const storedSlot = targetSlotIdx;
            const storedBarcode = activeBarcode;
            const storedGrade: 'A' | 'B' = activeGrade === 'B' ? 'B' : 'A';
            const peakT = actTemp;
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
            setTotalProduced((t) => t + 1);
            setGoodCount((g) => g + 1);
            setCycleTimeSec(Number((10.8 + Math.random() * 0.9).toFixed(1)));
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
  }, [packml, recipe, heaterEnabled, alarms, activeGrade, slots, targetSlotIdx, activeBarcode, actTemp]);

  // Operator Commands
  const handleStart = () => {
    if (!servoHomed) {
      pushAlarm('ALM-008', 'WARNING', 'SINAMICS V90 X/Z 轴伺服尚未完成原点回归，禁止启动自动生产！');
      return;
    }
    if (alarms.some((a) => a.severity === 'CRITICAL')) {
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
    if (packml === 'Held' && !alarms.some((a) => a.code === 'ALM-012')) {
      setPackml('Execute');
    }
  };

  const handleStop = () => {
    setPackml('Stopped');
    setStep(0);
    setStepProgress(0);
  };

  const handleReset = () => {
    // Allow clearing alarms if temp dropped below overTemp - 5°C (hysteresis!)
    const overTempActive = alarms.some((a) => a.code === 'ALM-009');
    if (overTempActive && actTemp >= recipe.overTemp - 5.0) {
      // Cool down rapidly in demo helper note or require cooling
      setActTemp(recipe.overTemp - 6.5);
    }
    setServoHomed(true);
    setAlarms([]);
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
      `[故障注入] 热压腔模拟超温 ${(recipe.overTemp + 2.4).toFixed(1)}°C！OB30 强切 SSR 加热输出并锁存，PackML 瞬跳 Aborted！`
    );
    setPackml('Aborted');
    setStep(0);
  };

  const injectServoUnhomed = () => {
    setServoHomed(false);
    pushAlarm(
      'ALM-008',
      'WARNING',
      '[故障注入] V90 PN 立体库 X/Z 轴编码器原点丢失！设备转入 Held，须执行“确认复位回零”'
    );
    if (packml === 'Execute') setPackml('Held');
  };

  const injectCylinderTimeout = () => {
    pushAlarm(
      'ALM-004',
      'CRITICAL',
      '[故障注入] 阻挡夹紧气缸 FB_Cylinder2Pos 伸出超过 3.0s 未检测到磁簧到位 (FaultCode=101)！'
    );
    setPackml('Held');
  };

  const ackAllAlarms = () => {
    setAlarms((prev) => prev.map((a) => ({ ...a, acked: true })));
  };

  const clearWarehouse = () => {
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
    setAlarms((prev) => prev.filter((a) => a.code !== 'ALM-012'));
  };

  const toggleSlotLock = (idx: number) => {
    setSlots((prev) => prev.map((s) => (s.idx === idx ? { ...s, locked: !s.locked } : s)));
  };

  const occupiedCount = slots.filter((s) => s.occupied).length;
  const yieldPct = totalProduced > 0 ? ((goodCount / totalProduced) * 100).toFixed(1) : '100.0';
  const oeePct =
    packml === 'Aborted' ? '0.0' : packml === 'Held' ? '72.4' : Math.min(98.5, Number(yieldPct) * 0.94).toFixed(1);
  const selectedSlot = slots.find((s) => s.idx === selectedSlotIdx) ?? slots[0];
  const hasActiveAlarms = alarms.length > 0;

  // Build SVG polyline for temperature trend (Y range 70°C .. 102°C)
  const tempToY = (t: number) => {
    const clamped = Math.max(70, Math.min(102, t));
    return 118 - ((clamped - 70) / 32) * 102;
  };
  const trendPoints = tempHistory
    .map((t, i) => `${(18 + (i / Math.max(1, tempHistory.length - 1)) * 392).toFixed(1)},${tempToY(t).toFixed(1)}`)
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
      {/* Top Scrolling Industrial Alarm Banner */}
      <div className={`cap-alarm-bar ${hasActiveAlarms ? 'has-alarm' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          {hasActiveAlarms ? (
            <AlertTriangle size={18} color="#f87171" style={{ flexShrink: 0 }} />
          ) : (
            <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0 }} />
          )}
          <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
            {hasActiveAlarms ? (
              <>
                <strong style={{ color: '#fca5a5' }}>
                  [{alarms[0].code} · {alarms[0].time}] {alarms[0].acked ? '(已确认)' : '(未确认!)'}{' '}
                </strong>
                <span>{alarms[0].message}</span>
                {alarms.length > 1 && (
                  <span style={{ marginLeft: 8, color: '#fbbf24' }}>+{alarms.length - 1} 条并发报警</span>
                )}
              </>
            ) : (
              <span style={{ color: '#86efac' }}>
                <strong>[SCADA 报警横幅]</strong> 全站 PROFINET 节点通信正常 · 安全回路闭合 · 当前无未复位工业报警
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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
            disabled={!hasActiveAlarms}
            onClick={ackAllAlarms}
          >
            报警确认 Ack
          </button>
          <button
            type="button"
            className="cap-btn primary"
            style={{ padding: '4px 9px', fontSize: 11.5 }}
            onClick={handleReset}
          >
            <RotateCcw size={13} /> 复位回零 Reset
          </button>
        </div>
      </div>

      {/* WinCC Unified Command & Recipe Control Strip */}
      <div className="cap-panel" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
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
                pushAlarm('ALM-001', 'CRITICAL', '操作员拍下急停按钮 (E-Stop)！硬件切断 STO 与 SSR 加热！');
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
        <div className="cap-kpi-card">
          <div className="cap-kpi-label">综合设备效率 OEE</div>
          <div className="cap-kpi-value" style={{ color: '#14b8a6' }}>
            {oeePct}%
          </div>
        </div>
        <div className="cap-kpi-card">
          <div className="cap-kpi-label">视觉分拣良率</div>
          <div className="cap-kpi-value" style={{ color: '#10b981' }}>
            {yieldPct}%
          </div>
        </div>
        <div className="cap-kpi-card">
          <div className="cap-kpi-label">单件实测节拍 CT</div>
          <div className="cap-kpi-value">{cycleTimeSec}s</div>
        </div>
        <div className="cap-kpi-card">
          <div className="cap-kpi-label">累计 / 合格 / NG</div>
          <div className="cap-kpi-value" style={{ fontSize: 15 }}>
            {totalProduced} / <span style={{ color: '#10b981' }}>{goodCount}</span> /{' '}
            <span style={{ color: '#f87171' }}>{rejectCount}</span>
          </div>
        </div>
        <div className="cap-kpi-card">
          <div className="cap-kpi-label">立体库占用率 (RETAIN)</div>
          <div className="cap-kpi-value">
            {occupiedCount} / 12
          </div>
        </div>
      </div>

      {/* Main 2-Column WinCC Unified SCADA Workspace */}
      <div className="cap-scada-grid">
        {/* Left Column: Animated Production Line Mimic + Live PID Temperature Curve */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                {/* Floor & Conveyor Rail */}
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
                  rx="9"
                  fill={step === 10 && packml === 'Execute' ? 'rgba(16,185,129,0.16)' : '#0f172a'}
                  stroke={step === 10 && packml === 'Execute' ? '#10b981' : '#334155'}
                  strokeWidth={step === 10 ? 2.2 : 1.2}
                />
                <text x="85" y="54" textAnchor="middle" fill="#e2e8f0" fontSize="11.5" fontWeight="700">
                  ① G120 进料段
                </text>
                <text x="85" y="72" textAnchor="middle" fill="#94a3b8" fontSize="11.2" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                  设定 {recipe.speedPct}% 转速
                </text>
                <text x="85" y="92" textAnchor="middle" fill={step === 10 ? '#34d399' : '#64748b'} fontSize="10.5">
                  {step === 10 && packml === 'Execute' ? '▶ 传送与阻挡夹紧' : '待机'}
                </text>

                {/* Station 2: Barcode + Smart Vision */}
                <rect
                  x="166"
                  y="32"
                  width="136"
                  height="98"
                  rx="9"
                  fill={step === 20 && packml === 'Execute' ? 'rgba(167,139,250,0.18)' : '#0f172a'}
                  stroke={step === 20 && packml === 'Execute' ? '#a78bfa' : '#334155'}
                  strokeWidth={step === 20 ? 2.2 : 1.2}
                />
                <text x="234" y="54" textAnchor="middle" fill="#e2e8f0" fontSize="11.5" fontWeight="700">
                  ② 扫码视觉分级
                </text>
                <text x="234" y="74" textAnchor="middle" fill="#38bdf8" fontSize="11.2" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
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
                  <polygon points="214,104 254,104 268,136 200,136" fill="rgba(167,139,250,0.22)" />
                )}

                {/* Station 3: Thermal Press PID Chamber */}
                <rect
                  x="320"
                  y="32"
                  width="142"
                  height="98"
                  rx="9"
                  fill={
                    actTemp >= recipe.overTemp
                      ? 'rgba(239,68,68,0.26)'
                      : step === 40 && packml === 'Execute'
                        ? 'rgba(245,158,11,0.2)'
                        : '#0f172a'
                  }
                  stroke={actTemp >= recipe.overTemp ? '#ef4444' : step === 40 ? '#f59e0b' : '#334155'}
                  strokeWidth={step === 40 || actTemp >= recipe.overTemp ? 2.2 : 1.2}
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
                <text x="391" y="96" textAnchor="middle" fill="#94a3b8" fontSize="11.2" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                  SV:{recipe.targetTemp.toFixed(1)}°C · SSR:{pidOutPct}%
                </text>
                {/* Press cylinder piston animation */}
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
                  rx="9"
                  fill={(step === 30 || step === 50) && packml === 'Execute' ? 'rgba(20,184,166,0.18)' : '#0f172a'}
                  stroke={step === 30 || step === 50 ? '#14b8a6' : '#334155'}
                  strokeWidth={step === 30 || step === 50 ? 2.2 : 1.2}
                />
                <text x="551" y="54" textAnchor="middle" fill="#e2e8f0" fontSize="11.5" fontWeight="700">
                  ④ V90 X/Z 堆垛机
                </text>
                <text x="551" y="75" textAnchor="middle" fill={servoHomed ? '#34d399' : '#f87171'} fontSize="10.5" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                  {servoHomed ? '原点 Homed: OK' : '原点丢失!'}
                </text>
                <text x="551" y="94" textAnchor="middle" fill="#38bdf8" fontSize="11.2" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                  目标仓位: #{targetSlotIdx}
                </text>
                <text x="551" y="112" textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
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
                    <rect width="34" height="16" rx="4" fill="#10b981" stroke="#ecfdf5" strokeWidth="1.2" />
                    <text x="17" y="11" textAnchor="middle" fill="#052e16" fontSize="10.4" fontWeight="800">
                      CELL
                    </text>
                  </g>
                )}

                {/* Bottom live telemetry bar */}
                <text x="22" y="186" fill="#94a3b8" fontSize="11" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                  当前追溯条码: {activeBarcode}  |  热压保压: {recipe.holdSec}s  |  进度: {stepProgress}%
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
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="cap-badge amber">目标 {recipe.targetTemp.toFixed(1)}°C ±0.5°C</span>
                <span className={`cap-badge ${actTemp >= recipe.overTemp ? 'red' : 'green'}`}>
                  实测 {actTemp.toFixed(2)}°C
                </span>
              </div>
            </div>

            <div className="cap-svg-stage">
              <svg viewBox="0 0 430 134" width="100%" style={{ display: 'block' }}>
                {/* Tolerance band ±0.5°C */}
                <rect
                  x="18"
                  y={tempToY(recipe.targetTemp + 0.5)}
                  width="392"
                  height={Math.max(4, tempToY(recipe.targetTemp - 0.5) - tempToY(recipe.targetTemp + 0.5))}
                  fill="rgba(16,185,129,0.22)"
                />
                {/* OverTemp Red Trip Line */}
                <line
                  x1="18"
                  y1={tempToY(recipe.overTemp)}
                  x2="410"
                  y2={tempToY(recipe.overTemp)}
                  stroke="#ef4444"
                  strokeWidth="1.2"
                  strokeDasharray="4 3"
                />
                <text x="408" y={tempToY(recipe.overTemp) - 3} textAnchor="end" fill="#f87171" fontSize="11" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                  超温急停 {recipe.overTemp}°C
                </text>

                {/* Target Setpoint Line */}
                <line
                  x1="18"
                  y1={tempToY(recipe.targetTemp)}
                  x2="410"
                  y2={tempToY(recipe.targetTemp)}
                  stroke="#10b981"
                  strokeWidth="1.2"
                  strokeDasharray="5 3"
                />
                <text x="22" y={tempToY(recipe.targetTemp) - 4} fill="#34d399" fontSize="11" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                  SV {recipe.targetTemp.toFixed(1)}°C
                </text>

                {/* Live Curve */}
                <polyline
                  fill="none"
                  stroke={actTemp >= recipe.overTemp ? '#ef4444' : '#38bdf8'}
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                  points={trendPoints}
                />

                {/* Axis labels */}
                <text x="18" y="130" fill="#94a3b8" fontSize="11" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                  t - 10s
                </text>
                <text x="215" y="130" textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                  SSR PWM 占空比输出: {pidOutPct}% (100ms 循环中断)
                </text>
                <text x="410" y="130" textAnchor="end" fill="#94a3b8" fontSize="11" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                  实时
                </text>
              </svg>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive 4x3 AS/RS Warehouse Matrix + Selected Tray Inspector */}
        <div className="cap-panel" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
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

          {/* 3 Rows (Row 3 on top like a real vertical rack!) × 4 Columns */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[3, 2, 1].map((rowNum) => (
              <div key={rowNum}>
                <div style={{ fontSize: 11, color: 'var(--cap-text-muted)', marginBottom: 4, fontFamily: 'var(--cap-mono)' }}>
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
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
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
                          <div className="cap-mono" style={{ fontSize: 10, color: 'var(--cap-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.locked ? '维保禁用' : s.occupied ? s.barcode.slice(-8) : `X:${s.posX}`}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>

          {/* Selected Warehouse Slot Detail Drawer */}
          <div
            style={{
              background: 'var(--cap-bg)',
              border: '1px solid var(--cap-border-teal)',
              borderRadius: 11,
              padding: 14,
              marginTop: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
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
                <strong className="cap-mono" style={{ color: '#38bdf8' }}>
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
    </div>
  );
};
