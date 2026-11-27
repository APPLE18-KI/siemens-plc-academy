import React, { useCallback, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Gauge,
  RefreshCw,
  RotateCcw,
  Shuffle,
  Wrench,
  XCircle,
} from 'lucide-react';
import type { ModelId } from '../../../types/content';
import {
  FAULT_DRILLS,
  loadDrillProgress,
  saveDrillProgress,
  type FaultDrillCase,
  type FaultDrillProgress,
} from '../data/faultDrills';
import { SignalChainDiagram } from './SignalChainDiagram';

interface FaultDrillPanelProps {
  activeModelId: ModelId;
  onSelectModel: (id: ModelId) => void;
  onProgressChange?: (solvedCount: number, totalCount: number) => void;
}

const SEVERITY_LABEL: Record<FaultDrillCase['severity'], string> = {
  critical: 'P0 致命安全',
  high: 'P1 高危停线',
  medium: 'P2 工艺异常',
};

export const FaultDrillPanel: React.FC<FaultDrillPanelProps> = ({
  activeModelId,
  onSelectModel,
  onProgressChange,
}) => {
  const [scope, setScope] = useState<'all' | 'current'>('all');
  const [progress, setProgress] = useState<FaultDrillProgress>(() => loadDrillProgress());
  const [activeId, setActiveId] = useState<string>(FAULT_DRILLS[0].id);
  const [probedMeters, setProbedMeters] = useState<string[]>([]);
  const [probedWatch, setProbedWatch] = useState<string[]>([]);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<'idle' | 'wrong' | 'correct'>('idle');

  const pool = useMemo(
    () => (scope === 'current' ? FAULT_DRILLS.filter((d) => d.modelId === activeModelId) : FAULT_DRILLS),
    [scope, activeModelId]
  );

  const currentCase = useMemo(
    () => FAULT_DRILLS.find((d) => d.id === activeId) ?? pool[0] ?? FAULT_DRILLS[0],
    [activeId, pool]
  );

  const solvedSet = useMemo(() => new Set(progress.solvedIds), [progress.solvedIds]);
  const isAlreadySolved = solvedSet.has(currentCase.id);
  const revealedReview = submitState === 'correct';

  const switchCase = useCallback((nextCase: FaultDrillCase) => {
    setActiveId(nextCase.id);
    setProbedMeters([]);
    setProbedWatch([]);
    setSelectedOpt(null);
    setSubmitState('idle');
  }, []);

  const handleDrawRandom = useCallback(() => {
    const candidates = pool.filter((d) => d.id !== currentCase.id);
    const unsolved = candidates.filter((d) => !solvedSet.has(d.id));
    const source = unsolved.length > 0 ? unsolved : candidates.length > 0 ? candidates : pool;
    const picked = source[Math.floor(Math.random() * source.length)];
    if (picked) switchCase(picked);
  }, [pool, currentCase.id, solvedSet, switchCase]);

  const toggleMeterProbe = useCallback((probeId: string) => {
    setProbedMeters((prev) => (prev.includes(probeId) ? prev : [...prev, probeId]));
  }, []);

  const toggleWatchProbe = useCallback((probeId: string) => {
    setProbedWatch((prev) => (prev.includes(probeId) ? prev : [...prev, probeId]));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!selectedOpt) return;
    const prevAttempts = progress.attempts[currentCase.id] ?? 0;
    const nextAttempts = prevAttempts + 1;

    if (selectedOpt === currentCase.correctOptionId) {
      setSubmitState('correct');
      const nextSolved = progress.solvedIds.includes(currentCase.id)
        ? progress.solvedIds
        : [...progress.solvedIds, currentCase.id];
      const nextFirstTry =
        nextAttempts === 1 && !progress.firstTryIds.includes(currentCase.id)
          ? [...progress.firstTryIds, currentCase.id]
          : progress.firstTryIds;
      const updated: FaultDrillProgress = {
        solvedIds: nextSolved,
        firstTryIds: nextFirstTry,
        attempts: { ...progress.attempts, [currentCase.id]: nextAttempts },
      };
      setProgress(updated);
      saveDrillProgress(updated);
      onProgressChange?.(nextSolved.length, FAULT_DRILLS.length);
    } else {
      setSubmitState('wrong');
      const updated: FaultDrillProgress = {
        ...progress,
        attempts: { ...progress.attempts, [currentCase.id]: nextAttempts },
      };
      setProgress(updated);
      saveDrillProgress(updated);
    }
  }, [selectedOpt, progress, currentCase, onProgressChange]);

  const handleResetProgress = useCallback(() => {
    const empty: FaultDrillProgress = { solvedIds: [], firstTryIds: [], attempts: {} };
    setProgress(empty);
    saveDrillProgress(empty);
    onProgressChange?.(0, FAULT_DRILLS.length);
    setProbedMeters([]);
    setProbedWatch([]);
    setSelectedOpt(null);
    setSubmitState('idle');
  }, [onProgressChange]);

  const totalClues = currentCase.meterProbes.length + currentCase.watchProbes.length;
  const usedClues = probedMeters.length + probedWatch.length;
  const pct = Math.round((progress.solvedIds.length / FAULT_DRILLS.length) * 100);

  return (
    <section className="dt-drill-panel" aria-label="现场盲测排故实训台">
      <div className="dt-drill-header">
        <div className="dt-drill-head-left">
          <div className="dt-drill-eyebrow">
            <Wrench size={13} />
            BLIND FAULT TROUBLESHOOTING DRILL · 现场盲测排故实训台
          </div>
          <h2 className="dt-drill-title">12 道工厂真实故障工单盲测</h2>
          <p className="dt-drill-sub">
            先读现场报修现象，再逐点用<strong>虚拟万用表测端子</strong>与<strong>查博途监控表</strong>收集客观数据，定位根因并给出标准排故步骤。
          </p>
        </div>

        <div className="dt-drill-badge-card">
          <div className="dt-drill-badge-top">
            <span className="dt-drill-badge-label">
              <Award size={14} />
              排故勋章进度
            </span>
            <span className="dt-drill-badge-count">
              {progress.solvedIds.length} / {FAULT_DRILLS.length}
            </span>
          </div>
          <div className="dt-drill-progress-track" aria-hidden="true">
            <div className="dt-drill-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="dt-drill-badge-foot">
            <span>首测一次通过：{progress.firstTryIds.length} 枚</span>
            {progress.solvedIds.length > 0 ? (
              <button type="button" className="dt-drill-link-btn" onClick={handleResetProgress}>
                <RotateCcw size={12} />
                清空记录
              </button>
            ) : (
              <span>全部通关解锁高级排故师</span>
            )}
          </div>
        </div>
      </div>

      {/* Draw & Filter Toolbar */}
      <div className="dt-drill-toolbar">
        <div className="dt-drill-toolbar-group">
          <button type="button" className="dt-btn dt-btn--primary dt-drill-draw-btn" onClick={handleDrawRandom}>
            <Shuffle size={14} />
            抽取现场故障工单
          </button>

          <div className="dt-mode-switch" role="group" aria-label="工单抽取范围">
            <button
              type="button"
              className={`dt-mode-btn ${scope === 'all' ? 'dt-mode-btn--active-auto' : ''}`}
              onClick={() => setScope('all')}
            >
              全厂 4 套设备 ({FAULT_DRILLS.length})
            </button>
            <button
              type="button"
              className={`dt-mode-btn ${scope === 'current' ? 'dt-mode-btn--active-auto' : ''}`}
              onClick={() => {
                setScope('current');
                const firstMatch = FAULT_DRILLS.find((d) => d.modelId === activeModelId);
                if (firstMatch && currentCase.modelId !== activeModelId) switchCase(firstMatch);
              }}
            >
              仅当前模型 (3)
            </button>
          </div>
        </div>

        <div className="dt-drill-ticket-pills" role="list" aria-label="故障工单列表">
          {pool.map((item) => {
            const active = item.id === currentCase.id;
            const solved = solvedSet.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`dt-drill-pill ${active ? 'is-active' : ''} ${solved ? 'is-solved' : ''}`}
                onClick={() => switchCase(item)}
                title={`${item.ticketNo} · ${item.title}`}
              >
                <span>{item.ticketNo}</span>
                {solved ? <CheckCircle2 size={12} /> : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Work Order Sheet */}
      <div className="dt-drill-sheet">
        <div className="dt-drill-ticket-bar">
          <div className="dt-drill-ticket-meta">
            <span className="dt-drill-code">{currentCase.ticketNo}</span>
            <span className={`dt-drill-sev dt-drill-sev--${currentCase.severity}`}>
              {SEVERITY_LABEL[currentCase.severity]}
            </span>
            <span className="dt-drill-meta-tag">{currentCase.modelName}</span>
            <span className="dt-drill-meta-tag">{currentCase.category}</span>
            {isAlreadySolved ? (
              <span className="dt-drill-solved-tag">
                <CheckCircle2 size={12} />
                已通关
              </span>
            ) : null}
          </div>

          {currentCase.modelId !== activeModelId ? (
            <button
              type="button"
              className="dt-btn"
              onClick={() => onSelectModel(currentCase.modelId)}
            >
              切换至对应数字孪生
              <ExternalLink size={13} />
            </button>
          ) : null}
        </div>

        <h3 className="dt-drill-case-title">{currentCase.title}</h3>
        <div className="dt-drill-symptom">
          <span className="dt-drill-symptom-label">现场报修现象</span>
          <p>{currentCase.symptom}</p>
        </div>

        <SignalChainDiagram
          ticketNo={currentCase.ticketNo}
          nodes={currentCase.chainNodes}
          edges={currentCase.chainEdges}
          revealed={revealedReview}
        />

        {/* Two Diagnostic Instruments */}
        <div className="dt-drill-instruments">
          <div className="dt-drill-instrument-box">
            <div className="dt-drill-inst-head">
              <span className="dt-drill-inst-title">
                <Gauge size={14} />
                虚拟万用表测端子（点击采集物理读数）
              </span>
              <span className="dt-drill-inst-counter">
                {probedMeters.length}/{currentCase.meterProbes.length}
              </span>
            </div>
            <div className="dt-drill-probe-list">
              {currentCase.meterProbes.map((probe) => {
                const opened = probedMeters.includes(probe.id) || revealedReview;
                return (
                  <button
                    key={probe.id}
                    type="button"
                    className={`dt-drill-probe-btn ${opened ? 'is-open' : ''} ${
                      opened && probe.abnormal ? 'is-abnormal' : ''
                    }`}
                    onClick={() => toggleMeterProbe(probe.id)}
                  >
                    <div className="dt-drill-probe-top">
                      <span className="dt-drill-probe-point">{probe.point}</span>
                      <span className="dt-drill-probe-mode">{probe.mode}</span>
                    </div>
                    {opened ? (
                      <div className="dt-drill-probe-result">
                        <span className="dt-drill-reading">{probe.reading}</span>
                        <span className="dt-drill-hint">{probe.hint}</span>
                      </div>
                    ) : (
                      <span className="dt-drill-probe-cta">点击用万用表测端子 →</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="dt-drill-instrument-box">
            <div className="dt-drill-inst-head">
              <span className="dt-drill-inst-title">
                <Activity size={14} />
                博途在线监控表（点击读取 PLC 映像区）
              </span>
              <span className="dt-drill-inst-counter">
                {probedWatch.length}/{currentCase.watchProbes.length}
              </span>
            </div>
            <div className="dt-drill-probe-list">
              {currentCase.watchProbes.map((probe) => {
                const opened = probedWatch.includes(probe.id) || revealedReview;
                return (
                  <button
                    key={probe.id}
                    type="button"
                    className={`dt-drill-probe-btn ${opened ? 'is-open' : ''} ${
                      opened && probe.abnormal ? 'is-abnormal' : ''
                    }`}
                    onClick={() => toggleWatchProbe(probe.id)}
                  >
                    <div className="dt-drill-probe-top">
                      <span className="dt-drill-probe-point">
                        <code>{probe.address}</code> · {probe.symbol}
                      </span>
                      <span className="dt-drill-probe-mode">WATCH</span>
                    </div>
                    {opened ? (
                      <div className="dt-drill-probe-result">
                        <span className="dt-drill-reading">{probe.value}</span>
                        <span className="dt-drill-hint">{probe.note}</span>
                      </div>
                    ) : (
                      <span className="dt-drill-probe-cta">点击查博途监控表 →</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Diagnosis Choices */}
        <div className="dt-drill-diagnosis">
          <div className="dt-drill-inst-head">
            <span className="dt-drill-inst-title">
              <ClipboardCheck size={14} />
              提交根因诊断与现场排故方案
            </span>
            <span className="dt-drill-inst-counter">
              已采集线索 {usedClues}/{totalClues}
            </span>
          </div>

          <div className="dt-drill-options" role="radiogroup" aria-label="故障诊断选项">
            {currentCase.options.map((opt, idx) => {
              const chosen = selectedOpt === opt.id;
              const isCorrectChoice = revealedReview && opt.id === currentCase.correctOptionId;
              const isWrongChoice = submitState === 'wrong' && chosen;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  className={`dt-drill-opt ${chosen ? 'is-chosen' : ''} ${
                    isCorrectChoice ? 'is-correct' : ''
                  } ${isWrongChoice ? 'is-wrong' : ''}`}
                  onClick={() => {
                    if (revealedReview) return;
                    setSelectedOpt(opt.id);
                    if (submitState === 'wrong') setSubmitState('idle');
                  }}
                >
                  <span className="dt-drill-opt-key">{String.fromCharCode(65 + idx)}</span>
                  <span className="dt-drill-opt-text">{opt.text}</span>
                </button>
              );
            })}
          </div>

          <div className="dt-drill-actions">
            {!revealedReview ? (
              <button
                type="button"
                className="dt-btn dt-btn--primary dt-drill-submit-btn"
                disabled={!selectedOpt}
                onClick={handleSubmit}
              >
                提交诊断结单
              </button>
            ) : (
              <button
                type="button"
                className="dt-btn dt-btn--primary dt-drill-submit-btn"
                onClick={handleDrawRandom}
              >
                <RefreshCw size={14} />
                抽取下一张故障工单
              </button>
            )}

            {submitState === 'wrong' ? (
              <div className="dt-drill-feedback dt-drill-feedback--wrong" role="alert">
                <XCircle size={15} />
                <span>诊断偏差：请对照万用表物理读数与博途监控表映像区，排除干扰项后重新判断。</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Senior Commissioning Engineer Review */}
        {revealedReview ? (
          <div className="dt-drill-review">
            <div className="dt-drill-review-head">
              <CheckCircle2 size={16} />
              <span>诊断通过 · 资深调试工程师现场复盘解析</span>
            </div>
            <p className="dt-drill-review-cause">
              <strong>根因剖析：</strong>
              {currentCase.rootCause}
            </p>
            <div className="dt-drill-sop">
              <div className="dt-drill-sop-title">标准现场排故 SOP</div>
              <ol>
                {currentCase.repairSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
            <div className="dt-drill-tip">
              <strong>工程防呆建议：</strong>
              {currentCase.preventionTip}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};
