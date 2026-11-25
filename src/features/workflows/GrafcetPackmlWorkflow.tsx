import React, { useEffect, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  PauseCircle,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Square,
  Zap,
} from 'lucide-react';
import { LandscapeSvgStage } from '../../components/LandscapeSvgStage';
import './workflows.css';

type PackMLState =
  | 'Stopped'
  | 'Resetting'
  | 'Idle'
  | 'Starting'
  | 'Execute'
  | 'Holding'
  | 'Held'
  | 'Unholding'
  | 'Completing'
  | 'Complete'
  | 'Stopping'
  | 'Aborting'
  | 'Aborted'
  | 'Clearing';

type OperatingMode = 'Production' | 'Manual' | 'Maintenance';

interface GrafcetStepDef {
  step: number;
  name: string;
  action: string;
  transitionSignal: string;
  transitionLabel: string;
}

const GRAFCET_STEPS: GrafcetStepDef[] = [
  {
    step: 10,
    name: '等待来料',
    action: '皮带变频器低速进料，夹紧气缸待命',
    transitionSignal: 'infeedDetected',
    transitionLabel: '"I_Infeed_OK" & 阻挡到位',
  },
  {
    step: 20,
    name: '扫码与视觉定位',
    action: '触发读码器与智能相机获取电芯 OCV/外观等级',
    transitionSignal: 'visionReady',
    transitionLabel: '"Vision_Done" & 坐标有效',
  },
  {
    step: 30,
    name: '伺服抓取入模',
    action: 'V90 X/Z 伺服按视觉偏移抓取电芯模组送入热压腔',
    transitionSignal: 'servoInPos',
    transitionLabel: '"AxisXZ_InPos" & 夹爪松开',
  },
  {
    step: 40,
    name: '热压恒温保压',
    action: 'OB30 PID 恒温 85.0°C ±0.5°C，下压保压 5.0s',
    transitionSignal: 'pressComplete',
    transitionLabel: '"Temp_OK" & TON_Press.Q',
  },
  {
    step: 50,
    name: '立体库入库完成',
    action: '检索空仓位并驱动堆垛机入库，更新掉电保持 DB',
    transitionSignal: 'asrsAck',
    transitionLabel: '"ASRS_Done" → 循环/完工',
  },
];

const SCL_LINES: Array<{ code: string; matchState?: PackMLState[]; matchStep?: number }> = [
  { code: '// FB_CellSortingStation_Main — OMAC PackML + GRAFCET 核心调度' },
  { code: 'IF NOT #iSafety_EStop_OK THEN' },
  { code: '    #statPackML := #STATE_ABORTING; // 任意态拍急停瞬跳 Aborting!', matchState: ['Aborting', 'Aborted'] },
  { code: 'END_IF;' },
  { code: '' },
  { code: 'CASE #statPackML OF' },
  { code: '    #STATE_STOPPED: // 停机稳态，等待 Reset 指令', matchState: ['Stopped'] },
  { code: '        #qConveyor_Run := FALSE; #qHeater_En := FALSE;', matchState: ['Stopped'] },
  { code: '        IF #iCmd_Reset THEN #statPackML := #STATE_RESETTING; END_IF;', matchState: ['Stopped'] },
  { code: '' },
  { code: '    #STATE_RESETTING: // 各轴回零、气缸退回原位自检', matchState: ['Resetting'] },
  { code: '        #statStep := 10; // 初始化 GRAFCET 步序', matchState: ['Resetting'] },
  { code: '        IF #allHomeOK THEN #statPackML := #STATE_IDLE; END_IF;', matchState: ['Resetting'] },
  { code: '' },
  { code: '    #STATE_IDLE: // 就绪待命，等待 Start 指令', matchState: ['Idle'] },
  { code: '        IF #iCmd_Start THEN #statPackML := #STATE_STARTING; END_IF;', matchState: ['Idle'] },
  { code: '' },
  { code: '    #STATE_STARTING: // 预热腔体与皮带使能检查', matchState: ['Starting'] },
  { code: '        IF #driveReady THEN #statPackML := #STATE_EXECUTE; END_IF;', matchState: ['Starting'] },
  { code: '' },
  { code: '    #STATE_EXECUTE: // ══ 自动运行主态：执行内部 GRAFCET ══', matchState: ['Execute'] },
  { code: '        CASE #statStep OF', matchState: ['Execute'] },
  { code: '            10: // Step 10: 等待来料并阻挡定位', matchState: ['Execute'], matchStep: 10 },
  { code: '                IF #iInfeed_Sensor THEN #statStep := 20; END_IF;', matchState: ['Execute'], matchStep: 10 },
  { code: '            20: // Step 20: 扫码与视觉分级定位', matchState: ['Execute'], matchStep: 20 },
  { code: '                IF #iVision_Done THEN #statStep := 30; END_IF;', matchState: ['Execute'], matchStep: 20 },
  { code: '            30: // Step 30: V90 伺服抓取入热压模腔', matchState: ['Execute'], matchStep: 30 },
  { code: '                IF #iServo_InPos THEN #statStep := 40; END_IF;', matchState: ['Execute'], matchStep: 30 },
  { code: '            40: // Step 40: PID 85°C 恒温热压保压', matchState: ['Execute'], matchStep: 40 },
  { code: '                IF #instTON_Press.Q THEN #statStep := 50; END_IF;', matchState: ['Execute'], matchStep: 40 },
  { code: '            50: // Step 50: 立体库入库与批次计数', matchState: ['Execute'], matchStep: 50 },
  { code: '                IF #iASRS_Done THEN #statStep := 10; END_IF;', matchState: ['Execute'], matchStep: 50 },
  { code: '        END_CASE;', matchState: ['Execute'] },
  { code: '' },
  { code: '    #STATE_HOLDING, #STATE_HELD, #STATE_UNHOLDING: // 暂停保持 #statStep 不丢失', matchState: ['Holding', 'Held', 'Unholding'] },
  { code: '        #qServo_Pause := TRUE; // 恢复后原地续跑当前工步', matchState: ['Holding', 'Held', 'Unholding'] },
  { code: '' },
  { code: '    #STATE_COMPLETING, #STATE_COMPLETE: // 批次清尾完工', matchState: ['Completing', 'Complete'] },
  { code: '        #qBatchDone_Lamp := TRUE;', matchState: ['Completing', 'Complete'] },
  { code: '' },
  { code: '    #STATE_STOPPING: // 正常停机有序卸载', matchState: ['Stopping'] },
  { code: '        #qConveyor_Run := FALSE; #statPackML := #STATE_STOPPED;', matchState: ['Stopping'] },
  { code: '' },
  { code: '    #STATE_ABORTING, #STATE_ABORTED, #STATE_CLEARING: // 安全急停联锁区', matchState: ['Aborting', 'Aborted', 'Clearing'] },
  { code: '        #qSTO_Cut := TRUE; #statStep := 0; // 清零步序，强迫回零', matchState: ['Aborting', 'Aborted', 'Clearing'] },
  { code: 'END_CASE;' },
];

const ACTING_NEXT: Partial<Record<PackMLState, PackMLState>> = {
  Resetting: 'Idle',
  Starting: 'Execute',
  Holding: 'Held',
  Unholding: 'Execute',
  Completing: 'Complete',
  Stopping: 'Stopped',
  Aborting: 'Aborted',
  Clearing: 'Stopped',
};

export const GrafcetPackmlWorkflow: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [packml, setPackml] = useState<PackMLState>('Stopped');
  const [opMode, setOpMode] = useState<OperatingMode>('Production');
  const [grafcetStep, setGrafcetStep] = useState<number>(0);
  const [autoSensors, setAutoSensors] = useState<boolean>(false);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [batchTarget] = useState<number>(3);
  const [statusNote, setStatusNote] = useState<string>(
    '设备处于 Stopped 稳态。请先点击【Reset 复位】回零进入 Idle，再点击【Start 启动】进入 Execute 联动下方 GRAFCET 工步！'
  );

  // Automatic acting-state completion timer (~850ms)
  useEffect(() => {
    const nextState = ACTING_NEXT[packml];
    if (!nextState) return;
    const t = window.setTimeout(() => {
      setPackml(nextState);
      if (packml === 'Resetting') {
        setGrafcetStep(10);
        setStatusNote('Resetting 回零完成 → 进入 Idle（就绪）。点击【Start 启动】开始自动生产！');
      } else if (packml === 'Starting') {
        setGrafcetStep((s) => (s === 0 ? 10 : s));
        setStatusNote('Starting 预热检查通过 → 进入 Execute！下方 GRAFCET 开始按工步流转。');
      } else if (packml === 'Holding') {
        setStatusNote(`Holding 完成 → 进入 Held（已暂停）。注意：当前工步 Step ${grafcetStep} 已安全记忆，点击【Unhold 恢复】可断点续跑！`);
      } else if (packml === 'Unholding') {
        setStatusNote(`Unholding 完成 → 恢复 Execute，从记忆的 Step ${grafcetStep} 继续执行！`);
      } else if (packml === 'Aborting') {
        setGrafcetStep(0);
        setStatusNote('🚨 已执行 STO 安全断能并进入 Aborted！#statStep 已清零，必须先【Clear 清除故障】再【Reset 重新回零】。');
      } else if (packml === 'Clearing') {
        setStatusNote('Clearing 故障清除完成 → 返回 Stopped，请重新执行 Reset 回零。');
      } else if (packml === 'Completing') {
        setStatusNote(`🎉 批次目标 (${batchTarget} 件) 全部完成 → 进入 Complete 态！点击 Reset 开启下一批次。`);
      } else if (packml === 'Stopping') {
        setGrafcetStep(0);
        setStatusNote('正常停机有序卸载完成 → 进入 Stopped。');
      }
    }, 850);
    return () => window.clearTimeout(t);
  }, [packml, grafcetStep, batchTarget]);

  // Auto sensor pulse while in Execute
  useEffect(() => {
    if (!autoSensors || packml !== 'Execute') return;
    const timer = window.setInterval(() => {
      advanceGrafcetStep();
    }, 1500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSensors, packml, grafcetStep, completedCount]);

  const advanceGrafcetStep = () => {
    if (packml !== 'Execute') return;
    if (grafcetStep === 10) {
      setGrafcetStep(20);
      setStatusNote('传感信号 I_Infeed_OK 触发：Step 10 → Step 20（扫码与视觉定位）');
    } else if (grafcetStep === 20) {
      setGrafcetStep(30);
      setStatusNote('视觉坐标与等级校验通过：Step 20 → Step 30（V90 伺服抓取入模）');
    } else if (grafcetStep === 30) {
      setGrafcetStep(40);
      setStatusNote('伺服轴到位且夹爪释放：Step 30 → Step 40（85.0°C 热压恒温保压）');
    } else if (grafcetStep === 40) {
      setGrafcetStep(50);
      setStatusNote('保压计时 TON_Press.Q=1：Step 40 → Step 50（立体库入库完成）');
    } else if (grafcetStep === 50) {
      const nextCount = completedCount + 1;
      setCompletedCount(nextCount);
      if (nextCount >= batchTarget) {
        setPackml('Completing');
        setAutoSensors(false);
        setStatusNote(`第 ${nextCount}/${batchTarget} 件模组入库完毕，触发批次清尾 Completing！`);
      } else {
        setGrafcetStep(10);
        setStatusNote(`第 ${nextCount}/${batchTarget} 件模组入库完成！GRAFCET 自动循环返回 Step 10 等待下件来料。`);
      }
    }
  };

  // PackML Command Handlers
  const cmdReset = () => {
    if (packml === 'Stopped' || packml === 'Complete') {
      if (packml === 'Complete') setCompletedCount(0);
      setPackml('Resetting');
      setStatusNote('执行 Resetting：伺服回零、气缸复位、检查气源与温控模块...');
    }
  };

  const cmdStart = () => {
    if (packml === 'Idle') {
      setPackml('Starting');
      setStatusNote('执行 Starting：启动皮带变频器与热压腔预热...');
    }
  };

  const cmdHold = () => {
    if (packml === 'Execute') {
      setPackml('Holding');
      setStatusNote(`执行 Holding：暂停当前 Step ${grafcetStep}，保持步序记忆以便恢复...`);
    }
  };

  const cmdUnhold = () => {
    if (packml === 'Held') {
      setPackml('Unholding');
      setStatusNote(`执行 Unholding：恢复使能，准备续跑 Step ${grafcetStep}...`);
    }
  };

  const cmdStop = () => {
    if (
      packml === 'Idle' ||
      packml === 'Starting' ||
      packml === 'Execute' ||
      packml === 'Holding' ||
      packml === 'Held' ||
      packml === 'Unholding' ||
      packml === 'Complete'
    ) {
      setAutoSensors(false);
      setPackml('Stopping');
      setStatusNote('执行 Stopping：完成安全卸压与停机收尾...');
    }
  };

  const cmdAbort = () => {
    if (packml !== 'Aborted' && packml !== 'Aborting') {
      setAutoSensors(false);
      setPackml('Aborting');
      setStatusNote('🚨 拍下急停按钮 (E-Stop)！任意状态立即切入 Aborting → 切断 STO 安全力矩！');
    }
  };

  const cmdClear = () => {
    if (packml === 'Aborted') {
      setPackml('Clearing');
      setStatusNote('确认急停蘑菇头已旋起，执行 Clearing 清除安全继电器锁存...');
    }
  };

  const isAbortedZone = packml === 'Aborting' || packml === 'Aborted' || packml === 'Clearing';
  const isHeldZone = packml === 'Holding' || packml === 'Held' || packml === 'Unholding';

  const nodeColor = (state: PackMLState) => {
    const active = packml === state;
    if (state === 'Aborted' || state === 'Aborting') {
      return active ? { fill: 'rgba(239,68,68,0.34)', stroke: '#ef4444', text: '#fecaca' } : { fill: '#1e1318', stroke: '#7f1d1d', text: '#fca5a5' };
    }
    if (state === 'Execute') {
      return active ? { fill: 'rgba(16,185,129,0.32)', stroke: '#10b981', text: '#ecfdf5' } : { fill: '#0f201d', stroke: '#065f46', text: '#6ee7b7' };
    }
    if (state === 'Held' || state === 'Holding' || state === 'Unholding') {
      return active ? { fill: 'rgba(245,158,11,0.3)', stroke: '#f59e0b', text: '#fef3c7' } : { fill: '#1d1911', stroke: '#78350f', text: '#fcd34d' };
    }
    if (active) {
      return { fill: 'rgba(0,153,153,0.34)', stroke: '#14b8a6', text: '#ffffff' };
    }
    return { fill: '#111827', stroke: '#334155', text: '#cbd5e1' };
  };

  const renderPackmlBox = (state: PackMLState, x: number, y: number, w: number, h: number, cn: string) => {
    const c = nodeColor(state);
    const active = packml === state;
    return (
      <g key={state}>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={8}
          fill={c.fill}
          stroke={c.stroke}
          strokeWidth={active ? 2.6 : 1.2}
        />
        <text x={x + w / 2} y={y + 18} textAnchor="middle" fill={c.text} fontSize="11.5" fontWeight="700" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
          {state}
        </text>
        <text x={x + w / 2} y={y + 33} textAnchor="middle" fill={c.text} opacity={0.85} fontSize="11.2">
          {cn}
        </text>
      </g>
    );
  };

  return (
    <div className="wf-root">
      <div className={`wf-card ${embedded ? 'embedded' : ''}`}>
        {/* Top Command Bar */}
        <div className="wf-toolbar">
          <div className="wf-toolbar-group">
            <span className={`wf-badge ${isAbortedZone ? 'red' : packml === 'Execute' ? 'green' : isHeldZone ? 'amber' : 'teal'}`}>
              PackML: {packml}
            </span>
            <span className="wf-badge teal">
              GRAFCET Step: {grafcetStep === 0 ? 'OFF (0)' : `S${grafcetStep}`}
            </span>
            <span className="wf-badge green">
              批次产出: {completedCount}/{batchTarget}
            </span>
            <div className="wf-seg" aria-label="运行模式">
              {(['Production', 'Manual', 'Maintenance'] as OperatingMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`wf-seg-btn ${opMode === m ? 'active' : ''}`}
                  onClick={() => setOpMode(m)}
                >
                  <Sliders size={12} /> {m === 'Production' ? '自动生产' : m === 'Manual' ? '手动调试' : '维保'}
                </button>
              ))}
            </div>
          </div>

          <div className="wf-toolbar-group">
            <button
              type="button"
              className="wf-btn wf-btn-primary"
              disabled={!(packml === 'Stopped' || packml === 'Complete')}
              onClick={cmdReset}
            >
              <RotateCcw size={14} /> Reset 复位
            </button>
            <button
              type="button"
              className="wf-btn wf-btn-success"
              disabled={packml !== 'Idle'}
              onClick={cmdStart}
            >
              <Play size={14} /> Start 启动
            </button>
            <button
              type="button"
              className="wf-btn wf-btn-warn"
              disabled={packml !== 'Execute'}
              onClick={cmdHold}
            >
              <PauseCircle size={14} /> Hold 暂停
            </button>
            <button
              type="button"
              className="wf-btn wf-btn-success"
              disabled={packml !== 'Held'}
              onClick={cmdUnhold}
            >
              <RefreshCw size={14} /> Unhold 恢复
            </button>
            <button
              type="button"
              className="wf-btn"
              disabled={packml === 'Stopped' || packml === 'Stopping' || isAbortedZone}
              onClick={cmdStop}
            >
              <Square size={13} /> Stop 停机
            </button>
            <button
              type="button"
              className="wf-btn wf-btn-danger solid"
              disabled={packml === 'Aborted' || packml === 'Aborting'}
              onClick={cmdAbort}
            >
              <AlertOctagon size={14} /> 急停 Abort
            </button>
            <button
              type="button"
              className="wf-btn wf-btn-warn"
              disabled={packml !== 'Aborted'}
              onClick={cmdClear}
            >
              <ShieldCheck size={14} /> Clear 清除
            </button>
          </div>
        </div>

        {/* Live Status Banner */}
        <div className={`wf-alert ${isAbortedZone ? 'danger' : isHeldZone ? 'warn' : packml === 'Execute' ? 'success' : 'info'}`}>
          <Zap size={17} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>实时联锁解说：</strong>
            {statusNote}
          </div>
        </div>

        {/* Main 2-column layout: Left = PackML SVG + GRAFCET steps, Right = Synced SCL */}
        <div className="wf-packml-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Top Half: PackML State Topology SVG */}
            <div className="wf-subpanel">
              <div className="wf-subpanel-title">
                <span>上层 · OMAC PackML (ISA-TR88) 工业标准状态机拓扑</span>
                <span style={{ fontSize: 11.5, color: 'var(--wf-text-muted)' }}>
                  任意态拍急停 → 瞬跳 Aborting
                </span>
              </div>
              <LandscapeSvgStage
                title="OMAC PackML (ISA-TR88) + GRAFCET 双层状态机拓扑"
                subtitle={`PackML: ${packml} · GRAFCET: ${grafcetStep === 0 ? 'OFF' : `S${grafcetStep}`} · 产出 ${completedCount}/${batchTarget}`}
                scopeClassName="wf-root"
                fitMode="contain"
                inlineMinWidth={580}
                inlinePadding
                hint="⇄ 支持横屏全幅观看状态跃迁 · 顶栏可一键启动/暂停/拍急停"
                landscapeFooterLabel="GRAFCET 工步流"
                controls={
                  <>
                    <button
                      type="button"
                      className="lss-ctrl-btn is-primary"
                      disabled={!(packml === 'Stopped' || packml === 'Complete')}
                      onClick={cmdReset}
                    >
                      <RotateCcw size={12} />
                      <span>Reset 复位</span>
                    </button>
                    <button
                      type="button"
                      className="lss-ctrl-btn is-success"
                      disabled={packml !== 'Idle'}
                      onClick={cmdStart}
                    >
                      <Play size={12} />
                      <span>Start 启动</span>
                    </button>
                    {packml === 'Held' ? (
                      <button type="button" className="lss-ctrl-btn is-success" onClick={cmdUnhold}>
                        <RefreshCw size={12} />
                        <span>Unhold 恢复</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="lss-ctrl-btn is-warn"
                        disabled={packml !== 'Execute'}
                        onClick={cmdHold}
                      >
                        <PauseCircle size={12} />
                        <span>Hold 暂停</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="lss-ctrl-btn"
                      disabled={packml === 'Stopped' || packml === 'Stopping' || isAbortedZone}
                      onClick={cmdStop}
                    >
                      <Square size={11} />
                      <span>Stop</span>
                    </button>
                    <button
                      type="button"
                      className="lss-ctrl-btn is-danger-solid"
                      disabled={packml === 'Aborted' || packml === 'Aborting'}
                      onClick={cmdAbort}
                    >
                      <AlertOctagon size={12} />
                      <span>急停 Abort</span>
                    </button>
                    {packml === 'Aborted' && (
                      <button type="button" className="lss-ctrl-btn is-warn" onClick={cmdClear}>
                        <ShieldCheck size={12} />
                        <span>Clear 清除</span>
                      </button>
                    )}
                  </>
                }
                landscapeFooter={
                  <>
                    <button
                      type="button"
                      className="lss-ctrl-btn is-success"
                      disabled={packml !== 'Execute'}
                      onClick={advanceGrafcetStep}
                    >
                      <CheckCircle2 size={12} />
                      <span>推进 GRAFCET 下一步</span>
                    </button>
                    <button
                      type="button"
                      className={`lss-ctrl-btn ${autoSensors ? 'is-warn' : ''}`}
                      disabled={packml !== 'Execute'}
                      onClick={() => setAutoSensors((v) => !v)}
                    >
                      <span>{autoSensors ? '停止自动传感' : '自动传感联跑'}</span>
                    </button>
                    {GRAFCET_STEPS.map((g) => {
                      const active = packml === 'Execute' && grafcetStep === g.step;
                      const held = isHeldZone && grafcetStep === g.step;
                      return (
                        <span
                          key={g.step}
                          className={`wf-badge ${active ? 'green' : held ? 'amber' : 'teal'}`}
                          style={{ opacity: active || held ? 1 : 0.55 }}
                        >
                          S{g.step} {g.name}
                        </span>
                      );
                    })}
                  </>
                }
              >
                <svg viewBox="0 0 680 228" width="100%" style={{ display: 'block', minWidth: 520 }}>
                  <defs>
                    <marker id="pmArr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
                    </marker>
                    <marker id="pmRed" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
                    </marker>
                  </defs>

                  {/* Main production flow edges */}
                  <line x1="100" y1="40" x2="124" y2="40" stroke="#64748b" strokeWidth="1.6" markerEnd="url(#pmArr)" />
                  <line x1="216" y1="40" x2="240" y2="40" stroke="#64748b" strokeWidth="1.6" markerEnd="url(#pmArr)" />
                  <line x1="322" y1="40" x2="346" y2="40" stroke="#64748b" strokeWidth="1.6" markerEnd="url(#pmArr)" />
                  <line x1="436" y1="40" x2="460" y2="40" stroke="#10b981" strokeWidth="2" markerEnd="url(#pmArr)" />
                  <line x1="560" y1="40" x2="582" y2="40" stroke="#64748b" strokeWidth="1.6" markerEnd="url(#pmArr)" />

                  {/* Execute <-> Holding/Held/Unholding loop */}
                  <line x1="490" y1="62" x2="490" y2="96" stroke="#f59e0b" strokeWidth="1.6" markerEnd="url(#pmArr)" />
                  <line x1="534" y1="118" x2="564" y2="118" stroke="#f59e0b" strokeWidth="1.6" markerEnd="url(#pmArr)" />
                  <path d="M 610 96 L 610 80 L 530 80 L 530 65" fill="none" stroke="#f59e0b" strokeWidth="1.4" strokeDasharray="4 3" markerEnd="url(#pmArr)" />

                  {/* Stopping back to Stopped */}
                  <path d="M 280 62 L 280 118 L 194 118" fill="none" stroke="#64748b" strokeWidth="1.4" strokeDasharray="4 3" markerEnd="url(#pmArr)" />
                  <path d="M 102 118 L 56 118 L 56 64" fill="none" stroke="#64748b" strokeWidth="1.4" markerEnd="url(#pmArr)" />

                  {/* Safety Abort Bar */}
                  <rect x="12" y="160" width="656" height="58" rx={10} fill="rgba(239,68,68,0.08)" stroke="rgba(239,68,68,0.38)" strokeDasharray="5 4" />
                  <text x="24" y="176" fill="#f87171" fontSize="10.5" fontWeight="700">
                    安全联锁域 (任意状态拍急停 E-Stop 立即强制跃迁)
                  </text>
                  <line x1="214" y1="196" x2="262" y2="196" stroke="#ef4444" strokeWidth="1.8" markerEnd="url(#pmRed)" />
                  <line x1="364" y1="196" x2="412" y2="196" stroke="#f59e0b" strokeWidth="1.8" markerEnd="url(#pmArr)" />
                  <path d="M 514 196 L 548 196 L 548 148 L 28 148 L 28 64" fill="none" stroke="#14b8a6" strokeWidth="1.3" strokeDasharray="4 3" markerEnd="url(#pmArr)" />

                  {/* State Nodes */}
                  {renderPackmlBox('Stopped', 14, 18, 86, 44, '停机稳态')}
                  {renderPackmlBox('Resetting', 126, 18, 90, 44, '回零复位中')}
                  {renderPackmlBox('Idle', 242, 18, 80, 44, '就绪待命')}
                  {renderPackmlBox('Starting', 348, 18, 88, 44, '预热启动中')}
                  {renderPackmlBox('Execute', 462, 18, 98, 44, '自动运行★')}
                  {renderPackmlBox('Complete', 584, 18, 86, 44, '批次完工')}

                  {renderPackmlBox('Stopping', 104, 96, 88, 44, '正常停机中')}
                  {renderPackmlBox('Completing', 238, 96, 94, 44, '清尾收料')}
                  {renderPackmlBox('Holding', 442, 96, 92, 44, '暂停减速')}
                  {renderPackmlBox('Held', 566, 96, 92, 44, '暂停保持')}

                  {renderPackmlBox('Aborting', 114, 174, 100, 38, '安全断能')}
                  {renderPackmlBox('Aborted', 264, 174, 100, 38, '急停锁定')}
                  {renderPackmlBox('Clearing', 414, 174, 100, 38, '故障清除')}
                </svg>
              </LandscapeSvgStage>
            </div>

            {/* Bottom Half: GRAFCET Sequential Flow Inside Execute */}
            <div className="wf-subpanel">
              <div className="wf-subpanel-title">
                <span>下层 · Execute 内部 GRAFCET 锂电模组顺序步序流</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="wf-btn wf-btn-success"
                    style={{ padding: '4px 10px', fontSize: 12 }}
                    disabled={packml !== 'Execute'}
                    onClick={advanceGrafcetStep}
                  >
                    <CheckCircle2 size={13} /> 模拟当前转换条件满足 → 下一步
                  </button>
                  <button
                    type="button"
                    className={`wf-btn ${autoSensors ? 'wf-btn-warn' : ''}`}
                    style={{ padding: '4px 10px', fontSize: 12 }}
                    disabled={packml !== 'Execute'}
                    onClick={() => setAutoSensors((v) => !v)}
                  >
                    {autoSensors ? '停止自动传感' : '自动模拟传感联跑'}
                  </button>
                </div>
              </div>

              <div className="wf-grafcet-steps">
                {GRAFCET_STEPS.map((g) => {
                  const isActive = packml === 'Execute' && grafcetStep === g.step;
                  const isHeldHere = isHeldZone && grafcetStep === g.step;
                  return (
                    <div
                      key={g.step}
                      className={`wf-gstep ${isActive ? 'active' : ''} ${isHeldHere ? 'held' : ''} ${isAbortedZone ? 'aborted' : ''}`}
                    >
                      <div className="wf-gstep-id">
                        <span>STEP {g.step}</span>
                        {isActive && <span className="wf-badge green" style={{ padding: '1px 5px', fontSize: 10 }}>RUN</span>}
                        {isHeldHere && <span className="wf-badge amber" style={{ padding: '1px 5px', fontSize: 10 }}>HOLD</span>}
                      </div>
                      <div className="wf-gstep-title">{g.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--wf-text-muted)', lineHeight: 1.4 }}>
                        {g.action}
                      </div>
                      <div className="wf-gstep-trans">T{g.step}: {g.transitionLabel}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Live Synchronized SCL CASE Code */}
          <div className="wf-subpanel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="wf-subpanel-title">
              <span>实时同步高亮 · TIA Portal SCL 状态机源码</span>
              <span className="wf-badge teal">CASE #statPackML OF</span>
            </div>
            <div className="wf-scl-box" style={{ flex: 1 }}>
              {SCL_LINES.map((line, idx) => {
                const stateMatch = line.matchState?.includes(packml) ?? false;
                const stepMatch =
                  line.matchStep === undefined ? true : grafcetStep === line.matchStep;
                const isHit = stateMatch && stepMatch;
                const hlClass = !isHit
                  ? ''
                  : isAbortedZone
                    ? 'hl-danger'
                    : isHeldZone
                      ? 'hl-warn'
                      : 'hl';
                return (
                  <div key={idx} className={`wf-scl-line ${hlClass}`}>
                    <span className="wf-scl-ln">{idx + 1}</span>
                    <span>{line.code || ' '}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
