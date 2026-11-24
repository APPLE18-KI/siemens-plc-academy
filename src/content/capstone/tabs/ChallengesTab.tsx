import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  Code2,
  Eye,
  Lightbulb,
  Play,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { CODING_CHALLENGES } from '../data/projectData';
import { renderInline } from '../../../components/MarkdownRenderer';

interface ChallengesTabProps {
  passedIds: string[];
  onPassChallenge: (id: string) => void;
}

interface EvalResult {
  passed: boolean;
  details: Array<{ label: string; ok: boolean }>;
}

function normalizeScl(code: string): string {
  // Strip single-line // comments and (* ... *) comments, normalize whitespace & case
  return code
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\(\*[\s\S]*?\*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export const ChallengesTab: React.FC<ChallengesTabProps> = ({ passedIds, onPassChallenge }) => {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [codeMap, setCodeMap] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const ch of CODING_CHALLENGES) {
      init[ch.id] = ch.starterCode;
    }
    return init;
  });
  const [evalMap, setEvalMap] = useState<Record<string, EvalResult>>({});
  const [showHint, setShowHint] = useState<boolean>(false);
  const [showSolution, setShowSolution] = useState<boolean>(false);

  const challenge = CODING_CHALLENGES[activeIdx];
  const currentCode = codeMap[challenge.id] ?? challenge.starterCode;
  const currentEval = evalMap[challenge.id];
  const isPassed = passedIds.includes(challenge.id);

  const handleEvaluate = () => {
    const normalized = normalizeScl(currentCode);
    const details = challenge.checks.map((chk) => ({
      label: chk.label,
      ok: chk.test(normalized),
    }));
    const allPassed = details.every((d) => d.ok);
    setEvalMap((prev) => ({
      ...prev,
      [challenge.id]: { passed: allPassed, details },
    }));
    if (allPassed) {
      onPassChallenge(challenge.id);
    }
  };

  const handleResetCode = () => {
    setCodeMap((prev) => ({ ...prev, [challenge.id]: challenge.starterCode }));
    setEvalMap((prev) => {
      const next = { ...prev };
      delete next[challenge.id];
      return next;
    });
  };

  const handleApplySolution = () => {
    setCodeMap((prev) => ({ ...prev, [challenge.id]: challenge.solutionCode }));
    setShowSolution(true);
  };

  const switchChallenge = (idx: number) => {
    setActiveIdx(idx);
    setShowHint(false);
    setShowSolution(false);
  };

  return (
    <div className="cap-panel">
      <div className="cap-panel-head">
        <h2 className="cap-panel-title">
          <Code2 size={18} color="#14b8a6" /> 5 关工业级 SCL 实战编程与排错闯关台
        </h2>
        <span className={`cap-badge ${passedIds.length === CODING_CHALLENGES.length ? 'green' : 'teal'}`}>
          <Award size={13} /> 已通关：{passedIds.length} / {CODING_CHALLENGES.length} 关
          {passedIds.length === CODING_CHALLENGES.length ? ' · 🏆 毕业代码考核全部点亮!' : ''}
        </span>
      </div>

      <div className="cap-challenge-layout">
        {/* Left Challenge Navigation */}
        <div className="cap-challenge-list">
          {CODING_CHALLENGES.map((ch, idx) => {
            const done = passedIds.includes(ch.id);
            const active = idx === activeIdx;
            return (
              <button
                key={ch.id}
                type="button"
                className={`cap-challenge-item ${active ? 'active' : ''} ${done ? 'passed' : ''}`}
                onClick={() => switchChallenge(idx)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span className="cap-mono" style={{ fontSize: 11, color: '#14b8a6', fontWeight: 700 }}>
                    STAGE 0{ch.level} · {ch.difficulty}
                  </span>
                  {done ? (
                    <CheckCircle2 size={15} color="#10b981" />
                  ) : (
                    <span style={{ fontSize: 10.5, color: 'var(--cap-text-muted)' }}>待通关</span>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35, marginBottom: 4 }}>
                  {renderInline(ch.title.replace(/^关卡 \d+ · /, ''), `cht-${ch.id}`)}
                </div>
                <div className="cap-mono" style={{ fontSize: 11, color: 'var(--cap-text-muted)' }}>
                  {ch.fileRef}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Interactive SCL Editor & Evaluator */}
        <div
          style={{
            background: 'var(--cap-bg)',
            border: '1px solid var(--cap-border)',
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>{renderInline(challenge.title, `chh-${challenge.id}`)}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="cap-badge blue">{challenge.fileRef}</span>
              {isPassed && <span className="cap-badge green">✓ 已通关认证</span>}
            </div>
          </div>

          <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.65, color: 'var(--cap-text-muted)' }}>
            <strong style={{ color: 'var(--cap-text)' }}>现场工程场景：</strong>
            {renderInline(challenge.scenario, `chs-${challenge.id}`)}
          </p>

          <div
            style={{
              background: 'var(--cap-panel)',
              border: '1px solid var(--cap-border)',
              borderRadius: 9,
              padding: '10px 14px',
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#14b8a6', marginBottom: 6 }}>
              验收要求（评测器自动校验以下关键工程逻辑）：
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.65 }}>
              {challenge.requirements.map((req, i) => (
                <li key={i}>{renderInline(req, `chr-${i}`)}</li>
              ))}
            </ol>
          </div>

          {/* Code Editor */}
          <label
            htmlFor={`scl-editor-${challenge.id}`}
            style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--cap-text-muted)' }}
          >
            TIA Portal SCL 源码编辑区（按要求补全或修复 Bug 后点击“运行规则编译与评测”）：
          </label>
          <textarea
            id={`scl-editor-${challenge.id}`}
            className="cap-code-editor"
            spellCheck={false}
            value={currentCode}
            onChange={(e) => setCodeMap((prev) => ({ ...prev, [challenge.id]: e.target.value }))}
          />

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <button type="button" className="cap-btn primary" onClick={handleEvaluate}>
              <Play size={14} /> 运行规则编译与评测
            </button>
            <button type="button" className="cap-btn warn" onClick={() => setShowHint((h) => !h)}>
              <Lightbulb size={14} /> {showHint ? '隐藏工程提示' : '查看工程提示'}
            </button>
            <button type="button" className="cap-btn" onClick={() => setShowSolution((s) => !s)}>
              <Eye size={14} /> {showSolution ? '收起参考答案' : '查看满分答案'}
            </button>
            <button type="button" className="cap-btn" onClick={handleApplySolution}>
              一键填入标准源码
            </button>
            <button type="button" className="cap-btn" onClick={handleResetCode}>
              <RotateCcw size={14} /> 重置题目
            </button>
            {activeIdx < CODING_CHALLENGES.length - 1 && isPassed && (
              <button
                type="button"
                className="cap-btn success"
                onClick={() => switchChallenge(activeIdx + 1)}
              >
                挑战下一关 →
              </button>
            )}
          </div>

          {/* Evaluation Feedback */}
          {currentEval && (
            <div
              style={{
                marginTop: 14,
                padding: 13,
                borderRadius: 10,
                background: currentEval.passed
                  ? 'rgba(16, 185, 129, 0.12)'
                  : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${currentEval.passed ? 'rgba(16,185,129,0.45)' : 'rgba(239,68,68,0.45)'}`,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>
                {currentEval.passed
                  ? '🎉 静态编译与安全联锁校验全部通过！本关已点亮毕业进度！'
                  : '⚠️ 评测未完全通过，请根据下方未满足项修正你的 SCL 代码：'}
              </div>
              {currentEval.details.map((d, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12.5,
                    marginBottom: 4,
                  }}
                >
                  {d.ok ? (
                    <CheckCircle2 size={15} color="#10b981" />
                  ) : (
                    <XCircle size={15} color="#ef4444" />
                  )}
                  <span>{d.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Hints */}
          {showHint && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 9,
                background: 'rgba(245, 158, 11, 0.1)',
                borderLeft: '3px solid #f59e0b',
                fontSize: 12.5,
                lineHeight: 1.65,
              }}
            >
              <strong>工程师排查提示：</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {challenge.hints.map((h, i) => (
                  <li key={i}>{renderInline(h, `chhint-${i}`)}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Reference Solution */}
          {showSolution && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399', marginBottom: 5 }}>
                TIA Portal V18 工程标准参考实现：
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  borderRadius: 9,
                  background: 'var(--cap-code-bg)',
                  color: '#a7f3d0',
                  fontFamily: 'var(--cap-mono)',
                  fontSize: 12,
                  overflowX: 'auto',
                  lineHeight: 1.55,
                }}
              >
                {challenge.solutionCode}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
