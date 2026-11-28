import React, { useState } from 'react';
import { CheckCircle2, Compass, HelpCircle, Lightbulb, Sparkles, XCircle } from 'lucide-react';
import { haptic } from '../../app/native/platform';

export interface PredictCardProps {
  title: string;
  scenario: string;
  ladSnippet?: string;
  question: string;
  options: string[];
  answer: number;
  explain: string;
  simHint?: string;
}

/**
 * Brilliant 风格的“先预测，再验证”微交互卡片：
 * 在进入仿真器或看结论之前，让初学者花 5 秒先做直觉判断，再揭晓原理并引导去下方实操验证。
 */
export const PredictCard: React.FC<PredictCardProps> = ({
  title,
  scenario,
  ladSnippet,
  question,
  options,
  answer,
  explain,
  simHint,
}) => {
  const [picked, setPicked] = useState<number | null>(null);
  const revealed = picked !== null;
  const isRight = picked === answer;

  return (
    <section className={`v32-predict-card${revealed ? (isRight ? ' is-right' : ' is-wrong') : ''}`} aria-label="先猜一猜再验证">
      <div className="v32-predict-head">
        <span className="v32-predict-kicker">
          <HelpCircle size={14} /> 先猜一猜 · 再去验证
        </span>
        <span className="v32-predict-sub">选完立刻揭晓，不用怕猜错</span>
      </div>

      <h3 className="v32-predict-title">{title}</h3>
      <p className="v32-predict-scenario">{scenario}</p>

      {ladSnippet && (
        <pre className="v32-predict-lad" aria-label="梯形图示意">
          <code>{ladSnippet}</code>
        </pre>
      )}

      <div className="v32-predict-q">{question}</div>

      <div className="v32-predict-opts" role="radiogroup" aria-label={question}>
        {options.map((opt, idx) => {
          const selected = picked === idx;
          const correct = revealed && idx === answer;
          const wrongPick = revealed && selected && idx !== answer;
          return (
            <button
              key={idx}
              type="button"
              className={`v32-predict-opt${selected ? ' is-picked' : ''}${correct ? ' is-correct' : ''}${wrongPick ? ' is-wrong' : ''}`}
              disabled={revealed}
              onClick={() => {
                haptic(idx === answer ? 'success' : 'tap');
                setPicked(idx);
              }}
            >
              <span className="v32-predict-letter">{String.fromCharCode(65 + idx)}</span>
              <span className="v32-predict-opt-text">{opt}</span>
              {correct && <CheckCircle2 size={16} className="v32-predict-mark ok" />}
              {wrongPick && <XCircle size={16} className="v32-predict-mark bad" />}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div className={`v32-predict-result ${isRight ? 'ok' : 'nudge'}`} role="status">
          <div className="v32-predict-res-head">
            {isRight ? (
              <>
                <Sparkles size={15} /> <strong>直觉很准！你猜对了</strong>
              </>
            ) : (
              <>
                <Lightbulb size={15} /> <strong>这是 90% 新手都会直觉踩坑的地方，正好趁现在记住！</strong>
              </>
            )}
          </div>
          <p>{explain}</p>
          {simHint && (
            <div className="v32-predict-simhint">
              <Compass size={14} />
              <span>{simHint}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
