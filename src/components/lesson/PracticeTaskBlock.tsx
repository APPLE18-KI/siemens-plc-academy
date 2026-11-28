import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, Sparkles, Wrench, Zap } from 'lucide-react';
import { useProgress } from '../../app/store/progressStore';
import { haptic } from '../../app/native/platform';
import { ThinkHints } from '../../features/qa/ThinkHints';
import {
  getAutoStepIndices,
  LESSON_PRACTICE_AUTO_RULES,
  subscribeSimTelemetry,
} from '../../features/simulator/lessonPracticeBridge';

interface PracticeTaskBlockProps {
  taskKey: string;
  lessonId?: string;
  title: string;
  scenario: string;
  steps: string[];
  checkPoints: string[];
}

export const PracticeTaskBlock: React.FC<PracticeTaskBlockProps> = ({
  taskKey,
  lessonId,
  title,
  scenario,
  steps,
  checkPoints,
}) => {
  const { state, togglePracticeItem } = useProgress();
  const record = state.practiceCheckins[taskKey];
  const checkedSteps = record?.checkedSteps ?? [];
  const checkedPoints = record?.checkedPoints ?? [];
  const totalCount = steps.length + checkPoints.length;
  const doneCount = checkedSteps.length + checkedPoints.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const isCompleted = totalCount > 0 && doneCount >= totalCount;

  const autoIndices = useMemo(() => getAutoStepIndices(lessonId), [lessonId]);
  const [autoVerifiedSet, setAutoVerifiedSet] = useState<number[]>([]);
  const [autoBanner, setAutoBanner] = useState<string | null>(null);
  const memRef = useRef<Record<string, boolean>>({});
  const checkedStepsRef = useRef<number[]>(checkedSteps);
  checkedStepsRef.current = checkedSteps;
  const bannerTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    memRef.current = {};
    setAutoVerifiedSet([]);
    setAutoBanner(null);
  }, [lessonId, taskKey]);

  useEffect(() => {
    if (!lessonId) return;
    const rules = LESSON_PRACTICE_AUTO_RULES[lessonId];
    if (!rules || rules.length === 0) return;

    const unsub = subscribeSimTelemetry((ev) => {
      for (const rule of rules) {
        if (ev.presetId !== rule.presetId) continue;
        if (rule.stepIndex >= steps.length) continue;
        if (checkedStepsRef.current.includes(rule.stepIndex)) continue;
        if (rule.evaluate(ev, memRef.current)) {
          haptic('success');
          togglePracticeItem(taskKey, 'step', rule.stepIndex, steps.length, checkPoints.length);
          setAutoVerifiedSet((prev) =>
            prev.includes(rule.stepIndex) ? prev : [...prev, rule.stepIndex],
          );
          setAutoBanner(`第 ${rule.stepIndex + 1} 步自动验收通过：${rule.toast}`);
          window.clearTimeout(bannerTimerRef.current);
          bannerTimerRef.current = window.setTimeout(() => setAutoBanner(null), 5500);
        }
      }
    });

    return () => {
      unsub();
      window.clearTimeout(bannerTimerRef.current);
    };
  }, [lessonId, taskKey, steps.length, checkPoints.length, togglePracticeItem]);

  /** 勾选反馈：普通勾选轻振一下，勾完最后一项给“完成”振动 */
  const toggleWithFeedback = (kind: 'step' | 'point', idx: number, wasChecked: boolean) => {
    const willComplete = !wasChecked && doneCount + 1 >= totalCount;
    haptic(willComplete ? 'success' : 'tap');
    togglePracticeItem(taskKey, kind, idx, steps.length, checkPoints.length);
  };

  return (
    <section className={`practice-card${isCompleted ? ' completed' : ''}`}>
      <div className="practice-head">
        <div>
          <div className="embedded-stage-kicker" style={{ marginBottom: 4 }}>
            <Wrench size={13} />
            动手练习
            {autoIndices.size > 0 && (
              <span className="v32-auto-head-chip">
                <Zap size={11} /> 已联动上方仿真器自动感应打卡
              </span>
            )}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isCompleted ? (
            <span className="badge badge-green">
              <CheckCircle2 size={13} />
              实训验收通过
            </span>
          ) : (
            <span className="badge badge-mono">
              进度 {doneCount} / {totalCount} ({pct}%)
            </span>
          )}
        </div>
      </div>

      <div className="practice-body">
        <div className="practice-scenario">
          <strong style={{ color: 'var(--ink-primary)' }}>任务说明：</strong>
          {scenario}
        </div>

        {autoBanner && (
          <div className="v32-auto-toast" role="status" aria-live="polite">
            <Sparkles size={15} />
            <span>{autoBanner}</span>
          </div>
        )}

        <div>
          <div className="practice-section-label">
            操作步骤 ({checkedSteps.length} / {steps.length})
          </div>
          <div className="practice-list">
            {steps.map((step, idx) => {
              const checked = checkedSteps.includes(idx);
              const supportsAuto = autoIndices.has(idx);
              const wasAutoVerified = autoVerifiedSet.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  className={`practice-check-item${checked ? ' checked' : ''}${wasAutoVerified ? ' is-auto-hit' : ''}`}
                  onClick={() => toggleWithFeedback('step', idx, checked)}
                >
                  <span className="practice-checkbox">
                    <Check size={13} strokeWidth={3} />
                  </span>
                  <span className="practice-check-text">
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: 'var(--teal-text, var(--siemens-teal-bright))',
                        marginRight: 8,
                      }}
                    >
                      第 {idx + 1} 步
                    </span>
                    {step}
                    {supportsAuto && (
                      <span className={`v32-step-auto-tag${checked ? ' is-done' : ''}`}>
                        <Zap size={11} />
                        {checked ? '仿真器已验证' : '操作上方仿真器自动打勾'}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {lessonId && <ThinkHints lessonId={lessonId} />}

        {checkPoints.length > 0 && (
          <div>
            <div className="practice-section-label">
              做完后确认 ({checkedPoints.length} / {checkPoints.length})
            </div>
            <div className="practice-list">
              {checkPoints.map((cp, idx) => {
                const checked = checkedPoints.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`practice-check-item${checked ? ' checked' : ''}`}
                    onClick={() => toggleWithFeedback('point', idx, checked)}
                  >
                    <span className="practice-checkbox">
                      <Check size={13} strokeWidth={3} />
                    </span>
                    <span className="practice-check-text">{cp}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
