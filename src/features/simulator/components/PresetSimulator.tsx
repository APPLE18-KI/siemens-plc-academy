import React, { useCallback, useRef, useState } from 'react';
import {
  Activity,
  BookOpen,
  Code2,
  GraduationCap,
  Layers,
  Lightbulb,
  Play,
  RotateCcw,
  Square,
  StepForward,
} from 'lucide-react';
import type { SimPresetId } from '../../../types/content';
import type { TagValue } from '../../../types/plc';
import { useLadderSimulation } from '../../../core/plc';
import { LandscapeSvgStage } from '../../../components/LandscapeSvgStage';
import { SIM_PRESET_DEFINITIONS } from '../presets';
import { CpuStatusBar } from './CpuStatusBar';
import { FieldPanel, type InputOperationMode } from './FieldPanel';
import { LadderCanvas } from './LadderCanvas';
import { SclCodePanel } from './SclCodePanel';
import { TraceViewer } from './TraceViewer';

interface PresetSimulatorProps {
  presetId: SimPresetId;
  embedded?: boolean;
}

type EmbeddedViewTab = 'lad' | 'scl' | 'trace';

export const PresetSimulator: React.FC<PresetSimulatorProps> = ({
  presetId,
  embedded = false,
}) => {
  const preset = SIM_PRESET_DEFINITIONS[presetId];
  const [inputMode, setInputMode] = useState<InputOperationMode>('momentary');
  const [closedLoopTank, setClosedLoopTank] = useState(false);
  const [embeddedTab, setEmbeddedTab] = useState<EmbeddedViewTab>('lad');
  // 手机上默认收起实验指引：先让初学者看到按钮和指示灯，需要时再展开说明
  const [showGuide, setShowGuide] = useState(
    () => !embedded && !(typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches),
  );

  const closedLoopRef = useRef(closedLoopTank);
  closedLoopRef.current = closedLoopTank;

  // Optional closed-loop physical tank dynamics for analog-scale-pid
  const handleAfterScan = useCallback(
    (
      fieldOutputs: Record<string, TagValue>,
      fieldInputs: Record<string, TagValue>,
      dtMs: number
    ) => {
      if (presetId !== 'analog-scale-pid' || !closedLoopRef.current) return;
      const curRaw = Number(fieldInputs['AI_Level_Raw'] ?? 8294);
      const pumpOn = Boolean(fieldOutputs['Pump_Fill']);
      const drainOn = Boolean(fieldOutputs['Valve_Drain_Safe']);

      const dtSec = dtMs / 1000;
      let deltaPerSec = -1650; // gentle natural process outflow (~6%/s)
      if (pumpOn) deltaPerSec += 5800; // fill pump inflows ~21%/s
      if (drainOn) deltaPerSec -= 6200; // emergency drain valve

      const nextRaw = Math.max(0, Math.min(27648, curRaw + deltaPerSec * dtSec));
      fieldInputs['AI_Level_Raw'] = Math.round(nextRaw);
    },
    [presetId]
  );

  const { runtime, snapshot, intervalMs, setScanInterval, tracePaused, toggleTracePaused } =
    useLadderSimulation({
      tagDefs: preset.tagDefs,
      program: preset.program,
      traceChannels: preset.traceChannels,
      initialIntervalMs: 50,
      traceCapacity: 120,
      onAfterScan: handleAfterScan,
    });

  const handleToggleRun = () => {
    runtime.setRunning?.(!snapshot.metrics.running);
  };

  const handleSingleScan = () => {
    if (snapshot.metrics.running) {
      runtime.setRunning?.(false);
    }
    runtime.singleScan(intervalMs);
  };

  const handleSetInput = (tag: string, value: TagValue) => {
    runtime.setFieldInput(tag, value);
  };

  const handleToggleInputFromSvg = (tagName: string) => {
    const cur = Boolean(runtime.getFieldInput(tagName));
    runtime.setFieldInput(tagName, !cur);
  };

  const landscapeCpuControls = (
    <>
      <button
        type="button"
        className={`lss-ctrl-btn ${snapshot.metrics.running ? 'is-warn' : 'is-success'}`}
        onClick={handleToggleRun}
      >
        {snapshot.metrics.running ? <Square size={12} /> : <Play size={12} />}
        <span>{snapshot.metrics.running ? 'STOP 停机' : 'RUN 运行'}</span>
      </button>
      <button type="button" className="lss-ctrl-btn" onClick={handleSingleScan}>
        <StepForward size={12} />
        <span>单步扫描</span>
      </button>
      <button type="button" className="lss-ctrl-btn" onClick={() => runtime.reset()}>
        <RotateCcw size={12} />
        <span>复位</span>
      </button>
    </>
  );

  const landscapeFieldFooter =
    preset.fieldInputs.length > 0 ? (
      <>
        <span className="plc-sim-lss-io-label">快捷 %I 触发:</span>
        {preset.fieldInputs.map((fi) => {
          const on = Boolean(snapshot.fieldInputs[fi.tag]);
          const def = preset.tagDefs.find((d) => d.name === fi.tag);
          return (
            <button
              key={fi.tag}
              type="button"
              className={`plc-sim-lss-io-btn ${on ? 'is-on' : ''}`}
              onClick={() => handleSetInput(fi.tag, !on)}
              title={`${def?.address ?? ''} ${fi.label}（点击切换 0/1）`}
            >
              <span className="plc-sim-lss-io-addr">{def?.address ?? fi.tag}</span>
              <span>{fi.label}</span>
              <span className="plc-sim-lss-io-state">{on ? '1' : '0'}</span>
            </button>
          );
        })}
      </>
    ) : undefined;

  if (embedded) {
    return (
      <div className="plc-sim-root is-embedded">
        <CpuStatusBar
          metrics={snapshot.metrics}
          intervalMs={intervalMs}
          onToggleRun={handleToggleRun}
          onSingleScan={handleSingleScan}
          onChangeInterval={setScanInterval}
          onReset={() => runtime.reset()}
          compact
        />

        <div className="plc-sim-embedded-bar">
          <div className="plc-sim-embedded-tabs">
            <button
              type="button"
              className={embeddedTab === 'lad' ? 'active' : ''}
              onClick={() => setEmbeddedTab('lad')}
            >
              <Layers size={13} /> 梯形图监控 (LAD)
            </button>
            <button
              type="button"
              className={embeddedTab === 'trace' ? 'active' : ''}
              onClick={() => setEmbeddedTab('trace')}
            >
              <Activity size={13} /> 实时波形 (Trace)
            </button>
            <button
              type="button"
              className={embeddedTab === 'scl' ? 'active' : ''}
              onClick={() => setEmbeddedTab('scl')}
            >
              <Code2 size={13} /> SCL 对照
            </button>
          </div>
          <span className="plc-sim-embedded-cycle">
            周期 #{snapshot.metrics.cycleCount} · {snapshot.metrics.lastScanMs.toFixed(2)}ms
          </span>
        </div>

        <div className="plc-sim-embedded-grid">
          <div className="plc-sim-embedded-main">
            {embeddedTab === 'lad' && (
              <LandscapeSvgStage
                title={`${preset.title} · 梯形图监控 (LAD)`}
                subtitle={`Cycle #${snapshot.metrics.cycleCount} · ${snapshot.metrics.running ? 'RUN' : 'STOP'}`}
                compactHud
                hint="点击蓝色 %I 触点切换通断 · 绿色实线 = 通电"
                scopeClassName="plc-sim-root"
                fitMode="width"
                controls={landscapeCpuControls}
                landscapeFooter={landscapeFieldFooter}
                landscapeFooterLabel="现场输入按钮"
              >
                <LadderCanvas
                  program={preset.program}
                  tagDefs={preset.tagDefs}
                  tags={snapshot.tags}
                  evalSnapshot={snapshot.evalSnapshot}
                  running={snapshot.metrics.running}
                  compact
                  onToggleInputTag={handleToggleInputFromSvg}
                />
              </LandscapeSvgStage>
            )}
            {embeddedTab === 'trace' && (
              <TraceViewer
                channels={preset.traceChannels}
                samples={snapshot.traceSamples}
                paused={tracePaused}
                onTogglePause={toggleTracePaused}
                onClear={() => runtime.clearTrace()}
                compact
                landscapeTitle={`${preset.title} · 实时逻辑分析仪波形 (Trace)`}
                landscapeControls={landscapeCpuControls}
                landscapeFooter={landscapeFieldFooter}
              />
            )}
            {embeddedTab === 'scl' && (
              <SclCodePanel code={preset.sclCode} tags={snapshot.tags} compact />
            )}
          </div>

          <div className="plc-sim-embedded-side">
            <FieldPanel
              tagDefs={preset.tagDefs}
              fieldInputMetas={preset.fieldInputs}
              analogInputMetas={preset.analogInputs}
              fieldOutputMetas={preset.fieldOutputs}
              fieldInputs={snapshot.fieldInputs}
              pii={snapshot.pii}
              fieldOutputs={snapshot.fieldOutputs}
              tags={snapshot.tags}
              running={snapshot.metrics.running}
              inputMode={inputMode}
              onInputModeChange={setInputMode}
              onSetInput={handleSetInput}
              closedLoopTank={closedLoopTank}
              onToggleClosedLoopTank={setClosedLoopTank}
              compact
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="plc-sim-root is-full">
      <CpuStatusBar
        metrics={snapshot.metrics}
        intervalMs={intervalMs}
        onToggleRun={handleToggleRun}
        onSingleScan={handleSingleScan}
        onChangeInterval={setScanInterval}
        onReset={() => runtime.reset()}
        programLabel={preset.program.name}
      />

      {/* Collapsible Teaching Guidance Card */}
      <div className="plc-sim-guide-card">
        <div className="plc-sim-guide-head">
          <div className="plc-sim-guide-title">
            <span className="plc-sim-stage-badge">{preset.badge}</span>
            <h3>{preset.title}</h3>
          </div>
          <button
            type="button"
            className="plc-sim-mini-btn"
            onClick={() => setShowGuide((v) => !v)}
            aria-expanded={showGuide}
          >
            <BookOpen size={13} />
            {showGuide ? '收起实验指引' : '展开实验指引（怎么玩这个实验）'}
          </button>
        </div>

        {showGuide && (
          <div className="plc-sim-guide-body">
            <p className="plc-sim-guide-summary">{preset.teachingSummary}</p>
            <div className="plc-sim-guide-cols">
              <div className="plc-sim-guide-box">
                <div className="plc-sim-guide-box-hd">
                  <Lightbulb size={13} /> 动手验证步骤
                </div>
                <ol className="plc-sim-guide-steps">
                  {preset.trySteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
              <div className="plc-sim-guide-box is-interview">
                <div className="plc-sim-guide-box-hd">
                  <GraduationCap size={14} /> 现场调试 / 面试高频考点
                </div>
                <p>{preset.interviewNote}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Engineering Workspace: Ladder Monitor + Field I/O Panel */}
      <div className="plc-sim-main-split">
        <div className="plc-sim-ladder-pane">
          <div className="plc-sim-pane-bar">
            <div className="plc-sim-pane-title">
              <Layers size={14} />
              <span>梯形图 · 在线监视</span>
            </div>
            <span className="plc-sim-pane-hint">
              <span className="hint-wide">提示：可直接点击蓝色 %I 触点或右侧按钮调试</span>
              <span className="hint-narrow">左右滑动查看完整梯形图；按钮和指示灯在上方</span>
            </span>
          </div>
          <LandscapeSvgStage
            title={`${preset.title} · 梯形图在线监视 (LAD)`}
            subtitle={`Cycle #${snapshot.metrics.cycleCount} · ${snapshot.metrics.running ? 'RUN' : 'STOP'} · ${snapshot.metrics.lastScanMs.toFixed(2)}ms`}
            compactHud
            hint="直接点击蓝色 %I 触点可切换通断 · 横屏可全幅调试"
            scopeClassName="plc-sim-root"
            fitMode="width"
            controls={landscapeCpuControls}
            landscapeFooter={landscapeFieldFooter}
            landscapeFooterLabel="现场输入按钮"
          >
            <LadderCanvas
              program={preset.program}
              tagDefs={preset.tagDefs}
              tags={snapshot.tags}
              evalSnapshot={snapshot.evalSnapshot}
              running={snapshot.metrics.running}
              onToggleInputTag={handleToggleInputFromSvg}
            />
          </LandscapeSvgStage>
        </div>

        <aside className="plc-sim-field-pane">
          <FieldPanel
            tagDefs={preset.tagDefs}
            fieldInputMetas={preset.fieldInputs}
            analogInputMetas={preset.analogInputs}
            fieldOutputMetas={preset.fieldOutputs}
            fieldInputs={snapshot.fieldInputs}
            pii={snapshot.pii}
            fieldOutputs={snapshot.fieldOutputs}
            tags={snapshot.tags}
            running={snapshot.metrics.running}
            inputMode={inputMode}
            onInputModeChange={setInputMode}
            onSetInput={handleSetInput}
            closedLoopTank={closedLoopTank}
            onToggleClosedLoopTank={setClosedLoopTank}
          />
        </aside>
      </div>

      {/* Bottom Synchronized Dock: Trace Oscilloscope + Live SCL Code */}
      <div className="plc-sim-bottom-dock">
        <TraceViewer
          channels={preset.traceChannels}
          samples={snapshot.traceSamples}
          paused={tracePaused}
          onTogglePause={toggleTracePaused}
          onClear={() => runtime.clearTrace()}
          landscapeTitle={`${preset.title} · 实时逻辑分析仪波形 (Trace)`}
          landscapeControls={landscapeCpuControls}
          landscapeFooter={landscapeFieldFooter}
        />
        <SclCodePanel code={preset.sclCode} tags={snapshot.tags} />
      </div>
    </div>
  );
};
