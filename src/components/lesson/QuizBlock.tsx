import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, ClipboardCheck, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import type { QuizQuestion } from '../../types/content';
import { useProgress } from '../../app/store/progressStore';
import { haptic } from '../../app/native/platform';
import { recordQuizAttempt } from '../../features/study/studyStore';

interface QuizBlockProps {
  lessonId: string;
  title?: string;
  items: QuizQuestion[];
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const QuizBlock: React.FC<QuizBlockProps> = ({ lessonId, title, items }) => {
  const { state, recordQuizScore } = useProgress();
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [checkedMap, setCheckedMap] = useState<Record<number, boolean>>({});
  const [instantMode, setInstantMode] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const rootRef = React.useRef<HTMLElement | null>(null);

  useEffect(() => {
    setSelected({});
    setCheckedMap({});
    setSubmitted(false);
  }, [lessonId]);

  if (!items || items.length === 0) return null;

  const answeredCount = Object.keys(selected).length;
  const allAnswered = answeredCount === items.length;
  const correctCount = items.reduce(
    (acc, q, idx) => acc + (selected[idx] === q.answer ? 1 : 0),
    0,
  );
  const allCorrect = submitted && correctCount === items.length;
  const savedBest = state.quizHighScores[lessonId];

  const finalizeSubmit = (nextSelected: Record<number, number>) => {
    const score = items.reduce(
      (acc, q, idx) => acc + (nextSelected[idx] === q.answer ? 1 : 0),
      0,
    );
    setSubmitted(true);
    haptic(score === items.length ? 'success' : 'error');
    recordQuizScore(lessonId, score, items.length);
    recordQuizAttempt(lessonId, items, nextSelected);
  };

  const handleSelect = (qIdx: number, optIdx: number) => {
    if (submitted) return;
    if (instantMode && checkedMap[qIdx]) return;

    const nextSelected = { ...selected, [qIdx]: optIdx };
    setSelected(nextSelected);

    if (instantMode) {
      const right = optIdx === items[qIdx].answer;
      haptic(right ? 'success' : 'error');
      const nextChecked = { ...checkedMap, [qIdx]: true };
      setCheckedMap(nextChecked);
      if (Object.keys(nextChecked).length === items.length) {
        finalizeSubmit(nextSelected);
      }
    } else {
      haptic('tap');
    }
  };

  const handleSubmit = () => {
    finalizeSubmit(selected);
  };

  const handleRetry = () => {
    setSelected({});
    setCheckedMap({});
    setSubmitted(false);
    const el = rootRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' });
    el?.querySelector<HTMLButtonElement>('.quiz-opt')?.focus({ preventScroll: true });
  };

  return (
    <section className="quiz-card" ref={rootRef}>
      <div className="quiz-head">
        <div>
          <div className="embedded-stage-kicker" style={{ marginBottom: 4 }}>
            <ClipboardCheck size={13} />
            小测验
          </div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {title || '检查一下本讲的重点'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`v32-quiz-mode-pill${instantMode ? ' is-on' : ''}`}
            disabled={submitted || answeredCount > 0}
            title="开启后每选一题立刻揭晓对错与解析；关闭则全部做完统一交卷"
            onClick={() => setInstantMode((v) => !v)}
          >
            <Sparkles size={12} />
            {instantMode ? '逐题即时出解析' : '整卷统一交卷'}
          </button>
          <span className="badge">{items.length} 道题</span>
          {savedBest && (
            <span className={`badge ${savedBest.bestPct === 100 ? 'badge-green' : 'badge-teal'}`}>
              历史最高 {savedBest.bestPct}%
            </span>
          )}
        </div>
      </div>

      <div className="quiz-list">
        {items.map((item, qIdx) => {
          const picked = selected[qIdx];
          const isRevealed = submitted || Boolean(instantMode && checkedMap[qIdx]);
          const isRight = isRevealed && picked === item.answer;

          return (
            <div key={qIdx} className="quiz-item">
              <div className="quiz-q-title">
                <span className="quiz-q-index">Q{qIdx + 1}</span>
                <span>{item.question}</span>
              </div>

              <div className="quiz-options">
                {item.options.map((opt, optIdx) => {
                  const isSelected = picked === optIdx;
                  const isAnswer = optIdx === item.answer;

                  let stateClass = '';
                  if (isRevealed) {
                    if (isAnswer) stateClass = ' correct';
                    else if (isSelected && !isAnswer) stateClass = ' wrong';
                  } else if (isSelected) {
                    stateClass = ' selected';
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={isRevealed}
                      aria-pressed={isSelected}
                      className={`quiz-opt${stateClass}`}
                      onClick={() => handleSelect(qIdx, optIdx)}
                    >
                      <span className="quiz-opt-letter">
                        {OPTION_LETTERS[optIdx] ?? optIdx + 1}
                      </span>
                      <span style={{ flex: 1 }}>{opt}</span>
                      {isRevealed && isAnswer && (
                        <CheckCircle2 size={17} color="var(--power-green)" style={{ flexShrink: 0 }} />
                      )}
                      {isRevealed && isSelected && !isAnswer && (
                        <XCircle size={17} color="var(--fault-red)" style={{ flexShrink: 0 }} />
                      )}
                    </button>
                  );
                })}
              </div>

              {isRevealed && (
                <div className={`quiz-explain ${isRight ? 'is-ok' : 'is-err'}`}>
                  <div className="quiz-explain-head">
                    {isRight ? (
                      <>
                        <CheckCircle2 size={15} />
                        答对了！为什么是 {OPTION_LETTERS[item.answer] ?? item.answer + 1}：
                      </>
                    ) : (
                      <>
                        <XCircle size={15} />
                        你选了 {OPTION_LETTERS[picked] ?? picked + 1}，正确答案是{' '}
                        {OPTION_LETTERS[item.answer] ?? item.answer + 1}。原因：
                      </>
                    )}
                  </div>
                  <div>{item.explain}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="quiz-footer">
        <div className="quiz-result-banner" role="status" aria-live="polite">
          {!submitted ? (
            <span style={{ color: 'var(--ink-secondary)', fontWeight: 500 }}>
              已作答 {answeredCount} / {items.length} 题
              {instantMode
                ? ' · 选完每一题立刻出解析，答完最后一题自动结算'
                : ' · 全部答对会自动标记本讲完成'}
            </span>
          ) : allCorrect ? (
            <>
              <Award size={20} color="var(--power-green)" />
              <span style={{ color: 'var(--power-green)' }}>
                全部答对（{correctCount}/{items.length}）！本讲已标记为完成 ✓
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--alarm-amber)' }}>
              本次得分：{correctCount} / {items.length}（
              {Math.round((correctCount / items.length) * 100)}%）。看看每题下面的解析，再试一次吧
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {submitted ? (
            <button type="button" className="btn btn-sm" onClick={handleRetry}>
              <RotateCcw size={14} />
              重新作答
            </button>
          ) : !instantMode ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!allAnswered}
              onClick={handleSubmit}
            >
              {allAnswered ? '提交答案' : `还有 ${items.length - answeredCount} 题未作答`}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
};
