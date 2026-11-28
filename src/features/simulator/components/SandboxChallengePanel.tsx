import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  PlayCircle,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react';
import {
  LADDER_CHALLENGES,
  type ChallengeVerifyReport,
  type LadderChallenge,
} from '../sandboxChallenges';

interface SandboxChallengePanelProps {
  activeChallenge: LadderChallenge;
  passedIds: string[];
  report: ChallengeVerifyReport | null;
  onSelectChallenge: (challenge: LadderChallenge) => void;
  onRunVerify: () => void;
  onResetStarter: () => void;
  onLoadReference: () => void;
}

const WaveformCompareSvg: React.FC<{ report: ChallengeVerifyReport }> = ({ report }) => {
  const pts = report.waveform;
  if (pts.length < 2) return null;
  const W = 560;
  const H = 104;
  const padL = 78;
  const padR = 14;
  const plotW = W - padL - padR;

  const xAt = (i: number) => padL + (i / (pts.length - 1)) * plotW;

  const buildStepPath = (vals: boolean[], yHigh: number, yLow: number) => {
    let d = `M ${xAt(0).toFixed(1)} ${(vals[0] ? yHigh : yLow).toFixed(1)}`;
    for (let i = 1; i < vals.length; i += 1) {
      const x = xAt(i).toFixed(1);
      const prevY = (vals[i - 1] ? yHigh : yLow).toFixed(1);
      const currY = (vals[i] ? yHigh : yLow).toFixed(1);
      d += ` L ${x} ${prevY}`;
      if (prevY !== currY) d += ` L ${x} ${currY}`;
    }
    return d;
  };

  const expPath = buildStepPath(
    pts.map((p) => p.expected),
    18,
    40,
  );
  const actPath = buildStepPath(
    pts.map((p) => p.actual),
    64,
    88,
  );

  // Highlight mismatch intervals
  const mismatchRects: { x1: number; x2: number }[] = [];
  let start: number | null = null;
  for (let i = 0; i < pts.length; i += 1) {
    const bad = pts[i].expected !== pts[i].actual;
    if (bad && start === null) start = i;
    if ((!bad || i === pts.length - 1) && start !== null) {
      const endIdx = bad ? i : i - 1;
      mismatchRects.push({
        x1: xAt(start),
        x2: Math.max(xAt(start) + 4, xAt(endIdx)),
      });
      start = null;
    }
  }

  return (
    <div className="v32-wf-wrap">
      <div className="v32-wf-caption">
        <span>时序波形对比：{report.targetOutputLabel}</span>
        <span className="v32-wf-legend">
          <i className="dot exp" /> 期望输出
          <i className="dot act" /> 你的程序输出
          {mismatchRects.length > 0 && (
            <>
              <i className="dot err" /> 偏差区间
            </>
          )}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="v32-wf-svg" role="img" aria-label="期望与实际输出波形对比图">
        {mismatchRects.map((r, i) => (
          <rect
            key={i}
            x={r.x1}
            y={8}
            width={Math.max(4, r.x2 - r.x1)}
            height={88}
            fill="rgba(239, 68, 68, 0.16)"
            rx={3}
          />
        ))}
        <line x1={padL} y1={40} x2={W - padR} y2={40} stroke="rgba(148,163,184,0.22)" strokeDasharray="3 3" />
        <line x1={padL} y1={88} x2={W - padR} y2={88} stroke="rgba(148,163,184,0.22)" strokeDasharray="3 3" />

        <text x={8} y={32} className="v32-wf-label">期望 (1/0)</text>
        <text x={8} y={80} className="v32-wf-label">你的输出</text>

        <path d={expPath} fill="none" stroke="#38bdf8" strokeWidth={2.2} strokeDasharray="5 3" />
        <path
          d={actPath}
          fill="none"
          stroke={report.passed ? '#10b981' : '#f59e0b'}
          strokeWidth={2.5}
        />
      </svg>
    </div>
  );
};

export const SandboxChallengePanel: React.FC<SandboxChallengePanelProps> = ({
  activeChallenge,
  passedIds,
  report,
  onSelectChallenge,
  onRunVerify,
  onResetStarter,
  onLoadReference,
}) => {
  const [hintLevel, setHintLevel] = useState<number>(0);

  const handleSelect = (ch: LadderChallenge) => {
    setHintLevel(0);
    onSelectChallenge(ch);
  };

  const nextChallenge = LADDER_CHALLENGES.find((c) => c.order === activeChallenge.order + 1);
  const isAlreadyPassed = passedIds.includes(activeChallenge.id);

  return (
    <section className="v32-challenge-card" aria-label="梯形图实战闯关自动验收台">
      <div className="v32-ch-top">
        <div className="v32-ch-heading">
          <Trophy size={16} color="#fbbf24" />
          <strong>梯形图自动验收闯关台（像刷题一样验证你的电路）</strong>
        </div>
        <span className="v32-ch-progress">
          已通关 <b>{passedIds.length}</b> / {LADDER_CHALLENGES.length} 关
        </span>
      </div>

      {/* 6-level challenge selector pills */}
      <div className="v32-ch-tabs" role="tablist" aria-label="选择梯形图闯关关卡">
        {LADDER_CHALLENGES.map((ch) => {
          const passed = passedIds.includes(ch.id);
          const active = ch.id === activeChallenge.id;
          return (
            <button
              key={ch.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`v32-ch-tab${active ? ' is-active' : ''}${passed ? ' is-passed' : ''}`}
              onClick={() => handleSelect(ch)}
            >
              <span className="v32-ch-num">
                {passed ? <CheckCircle2 size={13} /> : `0${ch.order}`}
              </span>
              <span>{ch.title.replace(/^第 \d+ 关 · /, '')}</span>
            </button>
          );
        })}
      </div>

      {/* Active challenge brief + actions */}
      <div className="v32-ch-brief">
        <div className="v32-ch-brief-head">
          <span className="v32-ch-level">{activeChallenge.level}</span>
          <h3>{activeChallenge.title}</h3>
          {isAlreadyPassed && (
            <span className="v32-ch-passed-pill">
              <CheckCircle2 size={12} /> 已通关
            </span>
          )}
        </div>
        <p className="v32-ch-goal">{activeChallenge.goal}</p>

        <div className="v32-ch-actions">
          <button
            type="button"
            className="v32-verify-btn"
            onClick={onRunVerify}
          >
            <PlayCircle size={15} />
            运行自动时序验收（{activeChallenge.phases.length} 组工况）
          </button>

          <button
            type="button"
            className="v32-ch-sec-btn"
            onClick={() => setHintLevel((v) => Math.min(2, v + 1))}
            disabled={hintLevel >= 2}
          >
            <Lightbulb size={14} />
            {hintLevel === 0 ? '查看提示 1' : hintLevel === 1 ? '查看提示 2' : '已显示全部提示'}
          </button>

          <button
            type="button"
            className="v32-ch-sec-btn"
            onClick={() => {
              setHintLevel(0);
              onResetStarter();
            }}
          >
            <RotateCcw size={13} /> 重置初始题面
          </button>

          {hintLevel >= 2 && (
            <button
              type="button"
              className="v32-ch-sec-btn is-ref"
              onClick={onLoadReference}
            >
              <Sparkles size={13} /> 一键载入参考电路
            </button>
          )}
        </div>

        {hintLevel > 0 && (
          <div className="v32-ch-hints">
            {activeChallenge.hints.slice(0, hintLevel).map((h, i) => (
              <div key={i} className="v32-ch-hint-row">
                <b>提示 {i + 1}：</b>
                <span>{h}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verification Report */}
      {report && report.challengeId === activeChallenge.id && (
        <div className={`v32-verify-report ${report.passed ? 'is-pass' : 'is-fail'}`} role="status">
          <div className="v32-vr-head">
            <div className="v32-vr-status">
              {report.passed ? (
                <CheckCircle2 size={18} color="#34d399" />
              ) : report.doubleCoilBlocked ? (
                <AlertTriangle size={18} color="#fbbf24" />
              ) : (
                <XCircle size={18} color="#f87171" />
              )}
              <strong>{report.summary}</strong>
            </div>
            {report.passed && nextChallenge && (
              <button
                type="button"
                className="v32-next-ch-btn"
                onClick={() => handleSelect(nextChallenge)}
              >
                挑战下一关：{nextChallenge.title.replace(/^第 \d+ 关 · /, '')}
                <ArrowRight size={14} />
              </button>
            )}
          </div>

          <WaveformCompareSvg report={report} />

          <ul className="v32-vr-phases">
            {report.phases.map((p, i) => (
              <li key={i} className={p.passed ? 'ok' : 'bad'}>
                <span className="v32-vr-icon">
                  {p.passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                </span>
                <div className="v32-vr-text">
                  <div className="v32-vr-line">
                    <b>{p.label}</b>
                    <span className="v32-vr-mono">
                      期望: {p.expectedSummary} · 实际: {p.actualSummary}
                    </span>
                  </div>
                  {p.reason && <div className="v32-vr-reason">{p.reason}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
