import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  StepForward,
  Zap,
} from 'lucide-react';
import { LandscapeSvgStage } from '../../components/LandscapeSvgStage';
import './workflows.css';

type ScanSubStage =
  | 'field-change'
  | 'pii-latch'
  | 'ob1-net1'
  | 'ob1-net2'
  | 'sys-comms'
  | 'piq-write';

type CoilMode = 'normal' | 'double-coil';

interface FieldInputs {
  startPb: boolean; // %I0.0
  autoReq: boolean; // %I0.1
  safetyOk: boolean; // %I0.2
}

interface LogEntry {
  id: number;
  cycle: number;
  stage: string;
  text: string;
  tone: 'info' | 'warn' | 'danger' | 'success';
}

const STAGE_SEQUENCE: ScanSubStage[] = [
  'field-change',
  'pii-latch',
  'ob1-net1',
  'ob1-net2',
  'sys-comms',
  'piq-write',
];

const TOP_FIVE_STAGES: Array<{
  id: string;
  num: string;
  title: string;
  desc: string;
  matches: ScanSubStage[];
}> = [
  {
    id: 's1',
    num: 'STAGE 01',
    title: '现场物理端子变化',
    desc: '传感器与按钮电平到达 DI 模块光耦',
    matches: ['field-change'],
  },
  {
    id: 's2',
    num: 'STAGE 02',
    title: 'PII 映像区批量锁存',
    desc: 'CPU 一次性把物理 DI 冻结写入 PII',
    matches: ['pii-latch'],
  },
  {
    id: 's3',
    num: 'STAGE 03',
    title: 'OB1 顺序求值 N1→N2',
    desc: '自上而下读写 PII/PIQ，不碰物理端子',
    matches: ['ob1-net1', 'ob1-net2'],
  },
  {
    id: 's4',
    num: 'STAGE 04',
    title: '系统通信与 DB 更新',
    desc: 'PROFINET / HMI 读写与背景 DB 诊断',
    matches: ['sys-comms'],
  },
  {
    id: 's5',
    num: 'STAGE 05',
    title: 'PIQ 统一写回硬件',
    desc: '本周期最终 PIQ 一次性驱动 DO 继电器',
    matches: ['piq-write'],
  },
];

export const ScanCycleWorkflow: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [mode, setMode] = useState<CoilMode>('double-coil');
  const [stageIdx, setStageIdx] = useState<number>(0);
  const [cycle, setCycle] = useState<number>(1);
  const [autoPlay, setAutoPlay] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(1100);

  // Field physical inputs (can change asynchronously at ANY time)
  const [fieldIn, setFieldIn] = useState<FieldInputs>({
    startPb: true,
    autoReq: false,
    safetyOk: true,
  });

  // Latched Process Image Input (PII)
  const [pii, setPii] = useState<FieldInputs>({
    startPb: true,
    autoReq: false,
    safetyOk: true,
  });

  // Process Image Output (PIQ)
  const [piqQ00, setPiqQ00] = useState<boolean>(false);
  const [piqQ01, setPiqQ01] = useState<boolean>(false);
  const [net1TempQ00, setNet1TempQ00] = useState<boolean>(false);
  const [overwrittenInScan, setOverwrittenInScan] = useState<boolean>(false);

  // Physical DO Relay outputs (updated ONLY in Stage 05!)
  const [physQ00, setPhysQ00] = useState<boolean>(false);
  const [physQ01, setPhysQ01] = useState<boolean>(false);

  // Mid-scan input drift alert
  const [midScanDrift, setMidScanDrift] = useState<string | null>(null);

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 1,
      cycle: 1,
      stage: 'INIT',
      text: '已载入 S7-1215C 扫描周期实验台。当前为【双线圈事故模式】：手动启动 %I0.0=1、自动请求 %I0.1=0、安全联锁 %I0.2=1。点击“单步步进”观察 %Q0.0 如何被 Network 2 静默覆盖！',
      tone: 'warn',
    },
  ]);

  const currentSubStage = STAGE_SEQUENCE[stageIdx];

  const appendLog = (
    c: number,
    stage: string,
    text: string,
    tone: LogEntry['tone'] = 'info'
  ) => {
    setLogs((prev) => [
      { id: Date.now() + Math.random(), cycle: c, stage, text, tone },
      ...prev.slice(0, 14),
    ]);
  };

  const executeSubStage = (nextIdx: number, nextCycle: number, activeMode: CoilMode) => {
    const stage = STAGE_SEQUENCE[nextIdx];

    if (stage === 'field-change') {
      setOverwrittenInScan(false);
      appendLog(
        nextCycle,
        '① 现场端子',
        `DI 物理端子当前电平：%I0.0=${fieldIn.startPb ? 1 : 0}, %I0.1=${fieldIn.autoReq ? 1 : 0}, %I0.2=${fieldIn.safetyOk ? 1 : 0}`,
        'info'
      );
      return;
    }

    if (stage === 'pii-latch') {
      setPii({ ...fieldIn });
      setMidScanDrift(null);
      appendLog(
        nextCycle,
        '② PII 锁存',
        `CPU 批量锁存输入映像区 PII ← [%I0.0=${fieldIn.startPb ? 1 : 0}, %I0.1=${fieldIn.autoReq ? 1 : 0}, %I0.2=${fieldIn.safetyOk ? 1 : 0}]`,
        'info'
      );
      return;
    }

    if (stage === 'ob1-net1') {
      if (activeMode === 'normal') {
        const res = (pii.startPb || pii.autoReq) && pii.safetyOk;
        setPiqQ00(res);
        setNet1TempQ00(res);
        setOverwrittenInScan(false);
        appendLog(
          nextCycle,
          '③ OB1 Net1',
          `【单线圈合并】PIQ[%Q0.0] := (${pii.startPb ? 1 : 0} OR ${pii.autoReq ? 1 : 0}) AND ${pii.safetyOk ? 1 : 0} → ${res ? 'TRUE' : 'FALSE'}`,
          res ? 'success' : 'info'
        );
      } else {
        const res = pii.startPb && pii.safetyOk;
        setPiqQ00(res);
        setNet1TempQ00(res);
        setOverwrittenInScan(false);
        appendLog(
          nextCycle,
          '③ OB1 Net1',
          `【手动段写入】PIQ[%Q0.0] := %I0.0(${pii.startPb ? 1 : 0}) AND %I0.2(${pii.safetyOk ? 1 : 0}) → ${res ? 'TRUE (暂存映像区!)' : 'FALSE'}`,
          res ? 'success' : 'info'
        );
      }
      return;
    }

    if (stage === 'ob1-net2') {
      if (activeMode === 'normal') {
        setPiqQ01(piqQ00);
        appendLog(
          nextCycle,
          '③ OB1 Net2',
          `【独立指示灯】PIQ[%Q0.1] := PIQ[%Q0.0] → ${piqQ00 ? 'TRUE' : 'FALSE'}（未触碰 %Q0.0）`,
          'info'
        );
      } else {
        const res2 = pii.autoReq && pii.safetyOk;
        const wasTrue = net1TempQ00 && !res2;
        setPiqQ00(res2);
        setPiqQ01(res2);
        setOverwrittenInScan(wasTrue);
        if (wasTrue) {
          appendLog(
            nextCycle,
            '③ OB1 Net2',
            `💥 双线圈覆盖事故！Network 2 用 %I0.1(0) 再次向 %Q0.0 赋值，直接将 Network 1 刚刚置 TRUE 的 PIQ[%Q0.0] 抹写为 FALSE！`,
            'danger'
          );
        } else {
          appendLog(
            nextCycle,
            '③ OB1 Net2',
            `【自动段重写】PIQ[%Q0.0] := %I0.1(${pii.autoReq ? 1 : 0}) AND %I0.2(${pii.safetyOk ? 1 : 0}) → ${res2 ? 'TRUE' : 'FALSE'}`,
            res2 ? 'success' : 'warn'
          );
        }
      }
      return;
    }

    if (stage === 'sys-comms') {
      appendLog(
        nextCycle,
        '④ 通信与DB',
        `操作系统处理 WinCC HMI 监控帧、PROFINET IO 报文交换与背景 DB 刷新（约 0.4ms）`,
        'info'
      );
      return;
    }

    if (stage === 'piq-write') {
      setPhysQ00(piqQ00);
      setPhysQ01(piqQ01);
      if (activeMode === 'double-coil' && net1TempQ00 && !piqQ00) {
        appendLog(
          nextCycle,
          '⑤ PIQ 写硬件',
          `⚠️ 物理继电器 %Q0.0 保持断开(0)！尽管 Net1 曾置 1，但硬件只看周期末尾的最终 PIQ 值！`,
          'danger'
        );
      } else {
        appendLog(
          nextCycle,
          '⑤ PIQ 写硬件',
          `批量写回物理 DO 端子：接触器 %Q0.0=${piqQ00 ? '吸合(1)' : '断开(0)'}，指示灯 %Q0.1=${piqQ01 ? '亮(1)' : '灭(0)'}`,
          piqQ00 ? 'success' : 'info'
        );
      }
    }
  };

  const handleStep = () => {
    const nextIdx = (stageIdx + 1) % STAGE_SEQUENCE.length;
    const nextCycle = nextIdx === 0 ? cycle + 1 : cycle;
    setStageIdx(nextIdx);
    setCycle(nextCycle);
    executeSubStage(nextIdx, nextCycle, mode);
  };

  useEffect(() => {
    if (!autoPlay) return;
    const timer = window.setInterval(() => {
      handleStep();
    }, speedMs);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, speedMs, stageIdx, cycle, mode, fieldIn, pii, piqQ00, piqQ01, net1TempQ00]);

  const toggleFieldInput = (key: keyof FieldInputs, addr: string, label: string) => {
    const nextVal = !fieldIn[key];
    setFieldIn((prev) => ({ ...prev, [key]: nextVal }));
    if (
      currentSubStage === 'ob1-net1' ||
      currentSubStage === 'ob1-net2' ||
      currentSubStage === 'sys-comms'
    ) {
      setMidScanDrift(
        `⚡ 你在扫描周期中途切换了物理端子 ${addr} (${label} → ${nextVal ? '1' : '0'})！注意观察：中间的 PII 映像区仍锁定着 Stage ② 的旧快照，本周期 OB1 不会感知本次突变，直到下个周期 Stage ② 重新锁存！`
      );
      appendLog(
        cycle,
        '⚡ 中途变位',
        `物理端子 ${addr} 在 OB1 扫描途中变为 ${nextVal ? '1' : '0'}，但 PII 保持锁存旧值！`,
        'warn'
      );
    }
  };

  const triggerDoubleCoilDemo = () => {
    setAutoPlay(false);
    setMode('double-coil');
    const demoInputs = { startPb: true, autoReq: false, safetyOk: true };
    setFieldIn(demoInputs);
    setPii(demoInputs);
    setPiqQ00(true);
    setPiqQ01(false);
    setNet1TempQ00(true);
    setOverwrittenInScan(false);
    setPhysQ00(false);
    setPhysQ01(false);
    setMidScanDrift(null);
    setStageIdx(2); // Jump right to ob1-net1 where Net1 just set PIQ[%Q0.0]=TRUE!
    appendLog(
      cycle,
      '🎯 事故复现',
      `已停在 OB1 Network 1：手动按钮 %I0.0=1 使 PIQ[%Q0.0] 刚刚置为 TRUE。现在再点 1 次“单步步进”看 Network 2 如何覆盖它！`,
      'warn'
    );
  };

  const resetLab = () => {
    setAutoPlay(false);
    setStageIdx(0);
    setCycle(1);
    setPiqQ00(false);
    setPiqQ01(false);
    setNet1TempQ00(false);
    setOverwrittenInScan(false);
    setPhysQ00(false);
    setPhysQ01(false);
    setMidScanDrift(null);
    setLogs([
      {
        id: Date.now(),
        cycle: 1,
        stage: 'RESET',
        text: '仿真周期已复位至 Cycle #1 Stage 01。',
        tone: 'info',
      },
    ]);
  };

  const switchMode = (newMode: CoilMode) => {
    setMode(newMode);
    setOverwrittenInScan(false);
    setStageIdx(0);
    appendLog(
      cycle,
      '模式切换',
      newMode === 'normal'
        ? '已切换至【标准单线圈模式】：手动与自动分支合并驱动唯一线圈 %Q0.0，彻底杜绝覆盖。'
        : '已切换至【双线圈事故模式】：Network 1 与 Network 2 对同一地址 %Q0.0 重复赋值。',
      newMode === 'normal' ? 'success' : 'warn'
    );
  };

  const isPiiDifferent =
    fieldIn.startPb !== pii.startPb ||
    fieldIn.autoReq !== pii.autoReq ||
    fieldIn.safetyOk !== pii.safetyOk;

  return (
    <div className="wf-root">
      <div className={`wf-card ${embedded ? 'embedded' : ''}`}>
        {/* Top Controls Toolbar */}
        <div className="wf-toolbar">
          <div className="wf-toolbar-group">
            <div className="wf-seg" role="tablist" aria-label="线圈模式对比">
              <button
                type="button"
                className={`wf-seg-btn ${mode === 'normal' ? 'active' : ''}`}
                onClick={() => switchMode('normal')}
              >
                <CheckCircle2 size={14} /> 正常单线圈（推荐）
              </button>
              <button
                type="button"
                className={`wf-seg-btn ${mode === 'double-coil' ? 'active danger' : ''}`}
                onClick={() => switchMode('double-coil')}
              >
                <ShieldAlert size={14} /> 新手双线圈覆盖事故
              </button>
            </div>
            <span className="wf-badge teal">
              <Cpu size={13} /> Cycle #{cycle} · OB1 周期 ~2.4ms
            </span>
          </div>

          <div className="wf-toolbar-group">
            <button type="button" className="wf-btn wf-btn-primary" onClick={handleStep}>
              <StepForward size={15} /> 单阶段步进 Step
            </button>
            <button
              type="button"
              className={`wf-btn ${autoPlay ? 'wf-btn-warn' : ''}`}
              onClick={() => setAutoPlay((p) => !p)}
            >
              {autoPlay ? <Pause size={15} /> : <Play size={15} />}
              {autoPlay ? '暂停循环' : '自动循环播放'}
            </button>
            <button
              type="button"
              className="wf-btn wf-btn-danger"
              onClick={triggerDoubleCoilDemo}
              title="一键停在 OB1 Network 1，点击下一步亲眼目睹双线圈覆盖"
            >
              <Zap size={15} /> 一键复现双线圈事故
            </button>
            <button
              type="button"
              className="wf-btn"
              onClick={() => setSpeedMs((s) => (s === 1100 ? 550 : 1100))}
            >
              倍速：{speedMs === 1100 ? '慢速解剖' : '快速 2x'}
            </button>
            <button type="button" className="wf-btn" onClick={resetLab} aria-label="重置">
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Mid-scan drift warning */}
        {midScanDrift && (
          <div className="wf-alert warn">
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>{midScanDrift}</div>
          </div>
        )}

        {/* Double-coil accident banner */}
        {overwrittenInScan && (
          <div className="wf-alert danger">
            <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>捕获到经典“双线圈覆盖事故 (Last-Write-Wins)”！</strong>
              Network 1 明明算出 <code>%Q0.0 := TRUE</code>，但因为 OB1 只改内存映像区
              <code>PIQ</code>，Network 2 紧接着把 <code>%Q0.0</code> 改回了 <code>FALSE</code>
              ；到了 Stage 05 统一写回硬件端子时，物理接触器 <code>%Q0.0</code> 纹丝不动！
              <strong>工程铁律：同一输出线圈在程序中只能出现一次，多条件请用并联分支或中间标志位汇总！</strong>
            </div>
          </div>
        )}

        {/* 5-Stage Closed Loop Strip */}
        <div className="wf-stage-strip">
          {TOP_FIVE_STAGES.map((st, i) => {
            const isActive = st.matches.includes(currentSubStage);
            const isAcc = isActive && overwrittenInScan && st.id === 's3';
            return (
              <div
                key={st.id}
                className={`wf-stage-node ${isActive ? 'active' : ''} ${isAcc ? 'accident' : ''}`}
                onClick={() => {
                  const targetIdx = STAGE_SEQUENCE.indexOf(st.matches[0]);
                  if (targetIdx >= 0) {
                    setAutoPlay(false);
                    setStageIdx(targetIdx);
                    executeSubStage(targetIdx, cycle, mode);
                  }
                }}
              >
                <div className="wf-stage-num">
                  {st.num} {i < 4 ? '→' : '↺'}
                </div>
                <div className="wf-stage-name">{st.title}</div>
                <div className="wf-stage-desc">{st.desc}</div>
              </div>
            );
          })}
        </div>

        {/* Main 2-Column Workspace */}
        <div className="wf-scan-grid">
          {/* Left: Physical -> PII -> PIQ -> Physical Relay Dataflow */}
          <div className="wf-subpanel">
            <div className="wf-subpanel-title">
              <span>实时硬件端子与过程映像区 (PII / PIQ) 数据流</span>
              {isPiiDifferent ? (
                <span className="wf-badge amber">物理端子 ≠ PII 快照</span>
              ) : (
                <span className="wf-badge green">PII 与现场同步</span>
              )}
            </div>

            {/* Interactive SVG Loop Ring */}
            <div style={{ marginBottom: 12 }}>
              <LandscapeSvgStage
                title="S7-1200 PLC 五阶段循环扫描周期闭环数据流"
                subtitle={`Cycle #${cycle} · ${mode === 'double-coil' ? '双线圈覆盖事故模式' : '标准单线圈模式'}`}
                scopeClassName="wf-root"
                fitMode="contain"
                inlineMinWidth={540}
                inlinePadding
                hint="⇄ 点击阶段节点可跳转 · 推荐横屏全幅观察 PII/OB1/PIQ 闭环"
                landscapeFooterLabel="DI 端子与映像区"
                controls={
                  <>
                    <button type="button" className="lss-ctrl-btn is-primary" onClick={handleStep}>
                      <StepForward size={12} />
                      <span>单步推进</span>
                    </button>
                    <button
                      type="button"
                      className={`lss-ctrl-btn ${autoPlay ? 'is-warn' : ''}`}
                      onClick={() => setAutoPlay((p) => !p)}
                    >
                      {autoPlay ? <Pause size={12} /> : <Play size={12} />}
                      <span>{autoPlay ? '暂停播放' : '自动播放'}</span>
                    </button>
                    <button type="button" className="lss-ctrl-btn is-danger" onClick={triggerDoubleCoilDemo}>
                      <Zap size={12} />
                      <span>复现双线圈</span>
                    </button>
                    <button type="button" className="lss-ctrl-btn" onClick={resetLab}>
                      <RotateCcw size={12} />
                      <span>重置</span>
                    </button>
                  </>
                }
                landscapeFooter={
                  <>
                    <button
                      type="button"
                      className={`lss-ctrl-btn ${fieldIn.startPb ? 'is-success' : ''}`}
                      onClick={() => toggleFieldInput('startPb', '%I0.0', 'Start_PB')}
                    >
                      %I0.0 启动: {fieldIn.startPb ? '1' : '0'}
                    </button>
                    <button
                      type="button"
                      className={`lss-ctrl-btn ${fieldIn.autoReq ? 'is-success' : ''}`}
                      onClick={() => toggleFieldInput('autoReq', '%I0.1', 'Auto_Req')}
                    >
                      %I0.1 自动: {fieldIn.autoReq ? '1' : '0'}
                    </button>
                    <button
                      type="button"
                      className={`lss-ctrl-btn ${fieldIn.safetyOk ? 'is-success' : ''}`}
                      onClick={() => toggleFieldInput('safetyOk', '%I0.2', 'Safety_OK')}
                    >
                      %I0.2 安全门: {fieldIn.safetyOk ? '1' : '0'}
                    </button>
                    <span className={`wf-badge ${overwrittenInScan ? 'red' : piqQ00 ? 'green' : 'teal'}`}>
                      PIQ %Q0.0: {overwrittenInScan ? '被覆写 0!' : piqQ00 ? '1' : '0'}
                    </span>
                    <span className={`wf-badge ${physQ00 ? 'green' : 'amber'}`}>
                      物理 DO %Q0.0: {physQ00 ? '吸合' : '断开'}
                    </span>
                  </>
                }
              >
                <svg viewBox="0 0 640 132" width="100%" style={{ display: 'block', minWidth: 480 }}>
                  <defs>
                    <marker id="wfArr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#14b8a6" />
                    </marker>
                    <marker id="wfArrGray" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
                    </marker>
                  </defs>

                  {/* Connectors */}
                  {[
                    { x1: 112, x2: 142, active: currentSubStage === 'pii-latch' },
                    { x1: 238, x2: 268, active: currentSubStage === 'ob1-net1' || currentSubStage === 'ob1-net2' },
                    { x1: 368, x2: 398, active: currentSubStage === 'sys-comms' },
                    { x1: 494, x2: 524, active: currentSubStage === 'piq-write' },
                  ].map((c, idx) => (
                    <line
                      key={idx}
                      x1={c.x1}
                      y1={54}
                      x2={c.x2}
                      y2={54}
                      stroke={c.active ? '#14b8a6' : '#475569'}
                      strokeWidth={c.active ? 3 : 2}
                      markerEnd={c.active ? 'url(#wfArr)' : 'url(#wfArrGray)'}
                    />
                  ))}

                  {/* Return feedback loop arrow */}
                  <path
                    d="M 578 86 L 578 116 L 62 116 L 62 88"
                    fill="none"
                    stroke={currentSubStage === 'field-change' ? '#14b8a6' : '#334155'}
                    strokeWidth={currentSubStage === 'field-change' ? 2.5 : 1.5}
                    strokeDasharray="6 4"
                    markerEnd={currentSubStage === 'field-change' ? 'url(#wfArr)' : 'url(#wfArrGray)'}
                  />
                  <text x="320" y="110" textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                    下一扫描周期开始 (Cyclic Scan Loop · 每 1~5ms 周而复始)
                  </text>

                  {/* 5 SVG Nodes */}
                  {[
                    { x: 14, w: 98, stage: 'field-change' as ScanSubStage, label: '① 物理 DI', sub: '%I0.0~%I0.2', active: currentSubStage === 'field-change', color: '#38bdf8' },
                    { x: 144, w: 94, stage: 'pii-latch' as ScanSubStage, label: '② PII 锁存', sub: '输入映像区', active: currentSubStage === 'pii-latch', color: '#14b8a6' },
                    {
                      x: 270,
                      w: 98,
                      stage: 'ob1-net1' as ScanSubStage,
                      label: currentSubStage === 'ob1-net2' ? '③ OB1 Net2' : '③ OB1 Net1',
                      sub: mode === 'double-coil' ? '双线圈覆盖!' : '顺序求值',
                      active: currentSubStage === 'ob1-net1' || currentSubStage === 'ob1-net2',
                      color: overwrittenInScan ? '#ef4444' : '#10b981',
                    },
                    { x: 400, w: 94, stage: 'sys-comms' as ScanSubStage, label: '④ 系统通信', sub: 'HMI/DB 刷新', active: currentSubStage === 'sys-comms', color: '#f59e0b' },
                    { x: 526, w: 100, stage: 'piq-write' as ScanSubStage, label: '⑤ PIQ→DO', sub: physQ00 ? '%Q0.0=吸合' : '%Q0.0=断开', active: currentSubStage === 'piq-write', color: physQ00 ? '#10b981' : '#94a3b8' },
                  ].map((n, idx) => (
                    <g
                      key={idx}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        const targetIdx = STAGE_SEQUENCE.indexOf(n.stage);
                        if (targetIdx >= 0) {
                          setAutoPlay(false);
                          setStageIdx(targetIdx);
                          executeSubStage(targetIdx, cycle, mode);
                        }
                      }}
                    >
                      <rect
                        x={n.x}
                        y={22}
                        width={n.w}
                        height={62}
                        rx={10}
                        fill={n.active ? 'rgba(0,153,153,0.22)' : '#111827'}
                        stroke={n.active ? n.color : '#334155'}
                        strokeWidth={n.active ? 2.5 : 1.2}
                      />
                      <text x={n.x + n.w / 2} y={48} textAnchor="middle" fill="#f8fafc" fontSize="12" fontWeight="700">
                        {n.label}
                      </text>
                      <text x={n.x + n.w / 2} y={68} textAnchor="middle" fill={n.active ? n.color : '#94a3b8'} fontSize="10.5" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                        {n.sub}
                      </text>
                    </g>
                  ))}
                </svg>
              </LandscapeSvgStage>
            </div>

            {/* 3-Column Memory Comparison */}
            <div className="wf-mem-grid">
              {/* Column 1: Field Terminals (Interactive!) */}
              <div className={`wf-mem-box ${currentSubStage === 'field-change' ? 'highlight' : ''}`}>
                <div className="wf-mem-title">
                  <span>现场物理 DI 端子</span>
                  <span style={{ color: '#38bdf8' }}>可随时点击</span>
                </div>
                <div className="wf-io-row">
                  <div>
                    <span className="wf-addr">%I0.0</span> 手动启动
                  </div>
                  <button
                    type="button"
                    className={`wf-toggle-btn ${fieldIn.startPb ? 'on' : 'off'}`}
                    onClick={() => toggleFieldInput('startPb', '%I0.0', 'Start_PB')}
                  >
                    {fieldIn.startPb ? '1 ON' : '0 OFF'}
                  </button>
                </div>
                <div className="wf-io-row">
                  <div>
                    <span className="wf-addr">%I0.1</span> 自动请求
                  </div>
                  <button
                    type="button"
                    className={`wf-toggle-btn ${fieldIn.autoReq ? 'on' : 'off'}`}
                    onClick={() => toggleFieldInput('autoReq', '%I0.1', 'Auto_Req')}
                  >
                    {fieldIn.autoReq ? '1 ON' : '0 OFF'}
                  </button>
                </div>
                <div className="wf-io-row">
                  <div>
                    <span className="wf-addr">%I0.2</span> 安全门OK
                  </div>
                  <button
                    type="button"
                    className={`wf-toggle-btn ${fieldIn.safetyOk ? 'on' : 'off'}`}
                    onClick={() => toggleFieldInput('safetyOk', '%I0.2', 'Safety_OK')}
                  >
                    {fieldIn.safetyOk ? '1 ON' : '0 OFF'}
                  </button>
                </div>
              </div>

              {/* Column 2: CPU Internal PII & PIQ */}
              <div
                className={`wf-mem-box ${
                  overwrittenInScan
                    ? 'highlight-danger'
                    : currentSubStage === 'pii-latch' ||
                        currentSubStage === 'ob1-net1' ||
                        currentSubStage === 'ob1-net2'
                      ? 'highlight'
                      : ''
                }`}
              >
                <div className="wf-mem-title">
                  <span>CPU 内存 PII / PIQ</span>
                  <span>仅程序读写</span>
                </div>
                <div className="wf-io-row">
                  <span className="wf-addr">PII %I0.0</span>
                  <span className={`wf-led ${pii.startPb ? 'on' : 'off'}`}>
                    {pii.startPb ? 'TRUE' : 'FALSE'}
                  </span>
                </div>
                <div className="wf-io-row">
                  <span className="wf-addr">PII %I0.1</span>
                  <span className={`wf-led ${pii.autoReq ? 'on' : 'off'}`}>
                    {pii.autoReq ? 'TRUE' : 'FALSE'}
                  </span>
                </div>
                <div className="wf-io-row">
                  <span className="wf-addr">PIQ %Q0.0</span>
                  <span
                    className={`wf-led ${
                      overwrittenInScan ? 'overwritten' : piqQ00 ? 'on' : 'off'
                    }`}
                  >
                    {overwrittenInScan ? '被覆写 0!' : piqQ00 ? 'TRUE' : 'FALSE'}
                  </span>
                </div>
              </div>

              {/* Column 3: Physical DO Relay */}
              <div className={`wf-mem-box ${currentSubStage === 'piq-write' ? 'highlight' : ''}`}>
                <div className="wf-mem-title">
                  <span>物理 DO 继电器输出</span>
                  <span>仅 Stage ⑤ 刷新</span>
                </div>
                <div className="wf-io-row">
                  <div>
                    <span className="wf-addr">%Q0.0</span> 电机KM1
                  </div>
                  <span className={`wf-led ${physQ00 ? 'on' : 'off'}`}>
                    {physQ00 ? '⚡ 吸合' : '断开'}
                  </span>
                </div>
                <div className="wf-io-row">
                  <div>
                    <span className="wf-addr">%Q0.1</span> 运行绿灯
                  </div>
                  <span className={`wf-led ${physQ01 ? 'on' : 'off'}`}>
                    {physQ01 ? '● 点亮' : '熄灭'}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: 'var(--wf-text-muted)',
                    lineHeight: 1.45,
                  }}
                >
                  提示：可在 OB1 扫描途中点击左侧 <code>%I0.0</code>，验证为何硬件突变不会打断当前扫描周期。
                </div>
              </div>
            </div>
          </div>

          {/* Right: OB1 Network 1 & Network 2 Evaluation + Trace Log */}
          <div className="wf-subpanel">
            <div className="wf-subpanel-title">
              <span>OB1 主程序自上而下顺序求值（TIA Portal）</span>
              <span className={`wf-badge ${mode === 'double-coil' ? 'red' : 'green'}`}>
                {mode === 'double-coil' ? '双线圈错误写法' : '标准单线圈写法'}
              </span>
            </div>

            {/* Network 1 */}
            <div className={`wf-network-card ${currentSubStage === 'ob1-net1' ? 'evaluating' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 12.5 }}>
                  Network 1：{mode === 'normal' ? '手/自动条件并联驱动唯一线圈 %Q0.0' : '手动启停控制段（第一次给 %Q0.0 赋值）'}
                </strong>
                {currentSubStage === 'ob1-net1' && <span className="wf-badge teal">▶ 正在执行</span>}
              </div>
              <div className="wf-rung-line">
                {mode === 'normal'
                  ? `// LAD 并联分支 → 唯一线圈\n"Motor_KM1"(%Q0.0) := ("Start_PB"[${pii.startPb ? 1 : 0}] OR "Auto_Req"[${pii.autoReq ? 1 : 0}])\n                      AND "Safety_OK"[${pii.safetyOk ? 1 : 0}];`
                  : `// 错误示范：手动段直接驱动 %Q0.0\n"Motor_KM1"(%Q0.0) := "Start_PB"[${pii.startPb ? 1 : 0}] AND "Safety_OK"[${pii.safetyOk ? 1 : 0}];\n// → 本行算出 PIQ[%Q0.0] = ${pii.startPb && pii.safetyOk ? 'TRUE' : 'FALSE'}`}
              </div>
            </div>

            {/* Network 2 */}
            <div
              className={`wf-network-card ${
                currentSubStage === 'ob1-net2'
                  ? overwrittenInScan
                    ? 'overwrite-hit'
                    : 'evaluating'
                  : ''
              }`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 12.5 }}>
                  Network 2：{mode === 'normal' ? '运行状态指示灯输出（读写不同地址）' : '自动控制段（再次给同一地址 %Q0.0 赋值！）'}
                </strong>
                {currentSubStage === 'ob1-net2' && (
                  <span className={`wf-badge ${overwrittenInScan ? 'red' : 'teal'}`}>
                    {overwrittenInScan ? '💥 覆盖发生!' : '▶ 正在执行'}
                  </span>
                )}
              </div>
              <div className="wf-rung-line">
                {mode === 'normal'
                  ? `// 读取前面算好的 PIQ[%Q0.0] 驱动指示灯 %Q0.1\n"Run_Lamp"(%Q0.1) := "Motor_KM1"(%Q0.0);`
                  : `// 致命 Bug：再次写入 %Q0.0，前面 Network 1 的结果被彻底覆盖！\n"Motor_KM1"(%Q0.0) := "Auto_Req"[${pii.autoReq ? 1 : 0}] AND "Safety_OK"[${pii.safetyOk ? 1 : 0}];\n// → PIQ[%Q0.0] 最终被强制改写为 ${pii.autoReq && pii.safetyOk ? 'TRUE' : 'FALSE'}!`}
              </div>
            </div>

            {/* Trace Log */}
            <div style={{ marginTop: 12 }}>
              <div className="wf-subpanel-title" style={{ marginBottom: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={14} /> 扫描周期追踪日志 (Trace)
                </span>
              </div>
              <div className="wf-log-list">
                {logs.map((entry) => (
                  <div key={entry.id} className={`wf-log-item ${entry.tone}`}>
                    <strong>
                      [C#{entry.cycle} {entry.stage}]
                    </strong>{' '}
                    {entry.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
