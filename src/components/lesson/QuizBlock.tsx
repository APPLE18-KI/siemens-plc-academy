import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, ClipboardCheck, RotateCcw, XCircle } from 'lucide-react';
import type { QuizQuestion } from '../../types/content';
import { useProgress } from '../../app/store/progressStore';

interface QuizBlockProps {
  lessonId: string;
  title?: string;
  items: QuizQuestion[];
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const QuizBlock: React.FC<QuizBlockProps> = ({ lessonId, title, items }) => {
  const { state, recordQuizScore } = useProgress();
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  // Reset local attempt state when switching lessons
  useEffect(() => {
    setSelected({});
    setSubmitted(false);
  }, [lessonId]);

  if (!items || items.length === 0) return null;

  const answeredCount = Object.keys(selected).length;
  const allAnswered = answeredCount === items.length;
  const correctCount = items.reduce(
    (acc, q, idx) => acc + (selected[idx] === q.answer ? 1 : 0),
    0
  );
  const allCorrect = submitted && correctCount === items.length;
  const savedBest = state.quizHighScores[lessonId];

  const handleSelect = (qIdx: number, optIdx: number) => {
    if (submitted) return;
    setSelected((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleSubmit = () => {
    setSubmitted(true);
    recordQuizScore(lessonId, correctCount, items.length);
  };

  const handleRetry = () => {
    setSelected({});
    setSubmitted(false);
  };

  return (
    <section className="quiz-card">
      <div className="quiz-head">
        <div>
          <div className="embedded-stage-kicker" style={{ marginBottom: 4 }}>
            <ClipboardCheck size={13} />
            随堂闯关测验 · CHECKPOINT QUIZ
          </div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {title || '本讲核心知识点随堂校验'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge-mono">{items.length} 道精选工程题</span>
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
          const isRight = submitted && picked === item.answer;

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
                  if (submitted) {
                    if (isAnswer) stateClass = ' correct';
                    else if (isSelected && !isAnswer) stateClass = ' wrong';
                  } else if (isSelected) {
                    stateClass = ' selected';
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={submitted}
                      className={`quiz-opt${stateClass}`}
                      onClick={() => handleSelect(qIdx, optIdx)}
                    >
                      <span className="quiz-opt-letter">
                        {OPTION_LETTERS[optIdx] ?? optIdx + 1}
                      </span>
                      <span style={{ flex: 1 }}>{opt}</span>
                      {submitted && isAnswer && (
                        <CheckCircle2 size={17} color="var(--power-green)" style={{ flexShrink: 0 }} />
                      )}
                      {submitted && isSelected && !isAnswer && (
                        <XCircle size={17} color="var(--fault-red)" style={{ flexShrink: 0 }} />
                      )}
                    </button>
                  );
                })}
              </div>

              {submitted && (
                <div className={`quiz-explain ${isRight ? 'is-ok' : 'is-err'}`}>
                  <div className="quiz-explain-head">
                    {isRight ? (
                      <>
                        <CheckCircle2 size={15} />
                        回答正确 · 原理解析
                      </>
                    ) : (
                      <>
                        <XCircle size={15} />
                        正确答案：{OPTION_LETTERS[item.answer] ?? item.answer + 1} · 原理解析
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
        <div className="quiz-result-banner">
          {!submitted ? (
            <span style={{ color: 'var(--ink-secondary)', fontWeight: 500 }}>
              已作答 {answeredCount} / {items.length} 题 · 全部答对自动点亮本课进度
            </span>
          ) : allCorrect ? (
            <>
              <Award size={20} color="var(--power-green)" />
              <span style={{ color: 'var(--power-green)' }}>
                全对通关 ({correctCount}/{items.length})！本课学习进度已自动点亮 ✓
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--alarm-amber)' }}>
              本次得分：{correctCount} / {items.length}（
              {Math.round((correctCount / items.length) * 100)}%），请结合解析复习后重试
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {submitted ? (
            <button type="button" className="btn btn-sm" onClick={handleRetry}>
              <RotateCcw size={14} />
              重新作答
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!allAnswered}
              onClick={handleSubmit}
            >
              提交并判分 ({answeredCount}/{items.length})
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
