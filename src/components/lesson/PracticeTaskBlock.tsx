import React from 'react';
import { Check, CheckCircle2, Wrench } from 'lucide-react';
import { useProgress } from '../../app/store/progressStore';

interface PracticeTaskBlockProps {
  taskKey: string;
  title: string;
  scenario: string;
  steps: string[];
  checkPoints: string[];
}

export const PracticeTaskBlock: React.FC<PracticeTaskBlockProps> = ({
  taskKey,
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

  return (
    <section className={`practice-card${isCompleted ? ' completed' : ''}`}>
      <div className="practice-head">
        <div>
          <div className="embedded-stage-kicker" style={{ marginBottom: 4 }}>
            <Wrench size={13} />
            动手实训工单 · LAB TASK
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
          <strong style={{ color: 'var(--ink-primary)' }}>工业现场工况：</strong>
          {scenario}
        </div>

        <div>
          <div className="practice-section-label">
            实施操作步骤 ({checkedSteps.length} / {steps.length})
          </div>
          <div className="practice-list">
            {steps.map((step, idx) => {
              const checked = checkedSteps.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  className={`practice-check-item${checked ? ' checked' : ''}`}
                  onClick={() =>
                    togglePracticeItem(taskKey, 'step', idx, steps.length, checkPoints.length)
                  }
                >
                  <span className="practice-checkbox">
                    <Check size={13} strokeWidth={3} />
                  </span>
                  <span className="practice-check-text">
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: 'var(--siemens-teal-bright)',
                        marginRight: 8,
                      }}
                    >
                      STEP {String(idx + 1).padStart(2, '0')}
                    </span>
                    {step}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {checkPoints.length > 0 && (
          <div>
            <div className="practice-section-label">
              工程验收检查点 ({checkedPoints.length} / {checkPoints.length})
            </div>
            <div className="practice-list">
              {checkPoints.map((cp, idx) => {
                const checked = checkedPoints.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`practice-check-item${checked ? ' checked' : ''}`}
                    onClick={() =>
                      togglePracticeItem(taskKey, 'point', idx, steps.length, checkPoints.length)
                    }
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
