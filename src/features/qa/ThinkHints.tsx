import React, { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { PRACTICE_HINTS } from '../../content/qa/checkpoints';
import { renderInline } from '../../components/MarkdownRenderer';
import { haptic } from '../../app/native/platform';

/**
 * “想一想”：苏格拉底式提示阶梯（参考 learn-tutor：先自己想 → 提示 1 → 提示 2 → 答案）。
 * 每次只多给一点，答案放在最后；看过答案后可以“自己再想一遍”收起。
 */
export const ThinkHints: React.FC<{ lessonId: string }> = ({ lessonId }) => {
  const h = PRACTICE_HINTS[lessonId];
  const [level, setLevel] = useState(0); // 0 = 只看问题；1、2 = 提示；3 = 答案
  if (!h) return null;
  const labels = ['给我提示 1', '还是不会，给提示 2', '看答案'];
  return (
    <div className="think" aria-live="polite">
      <div className="think-head">
        <Lightbulb size={16} aria-hidden /> 想一想
        <span className="think-steps" aria-label={`第 ${Math.min(level, 3)} 级，共 3 级`}>
          {[1, 2, 3].map((n) => (
            <i key={n} className={level >= n ? 'on' : ''} />
          ))}
        </span>
      </div>
      <p className="think-q">{renderInline(h.think, `th-${lessonId}`)}</p>
      {level >= 1 && (
        <p className="think-hint">
          <b>提示 1</b>
          {renderInline(h.hints[0], `th1-${lessonId}`)}
        </p>
      )}
      {level >= 2 && (
        <p className="think-hint">
          <b>提示 2</b>
          {renderInline(h.hints[1], `th2-${lessonId}`)}
        </p>
      )}
      {level >= 3 && (
        <p className="think-answer">
          <b>答案</b>
          {renderInline(h.answer, `tha-${lessonId}`)}
        </p>
      )}
      <div className="think-btns">
        {level < 3 ? (
          <button
            type="button"
            className={`btn btn-sm press${level === 2 ? ' btn-primary' : ''}`}
            onClick={() => {
              haptic('tap');
              setLevel((l) => l + 1);
            }}
          >
            {labels[level]}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-sm press"
            onClick={() => {
              haptic('tap');
              setLevel(0);
            }}
          >
            收起，自己再想一遍
          </button>
        )}
        {level === 0 && <span className="think-tip">先自己想 30 秒，再点提示。</span>}
      </div>
    </div>
  );
};
