import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, MessageSquareText } from 'lucide-react';
import { LECTURES } from '../../content/lectures';
import { saveExplain, useStudy } from './studyStore';
import { haptic } from '../../app/native/platform';

const stripLv = (t: string) => t.replace(/\[\[[\w-]+\|([^\]]+)\]\]/g, '$1');

/** 关键点 = 讲课板书里的关键句；关键词 = 句中加粗的词 */
function checklist(lessonId: string): { text: string; words: string[] }[] {
  const s = LECTURES[lessonId];
  if (!s) return [];
  return s.beats
    .filter((b) => b.board?.kind === 'line' && b.board.key)
    .map((b) => {
      const text = stripLv((b.board as { text: string }).text);
      const words = [...text.matchAll(/\*\*([^*]+)\*\*/g)].flatMap((m) =>
        m[1].split(/[，、,\s/]+/).filter((w) => w.length >= 2),
      );
      return { text: text.replace(/\*\*/g, ''), words };
    });
}

/**
 * “用自己的话解释”（费曼自查）：先写，再对照本讲的关键点逐条检查。
 * 关键词命中只是提示，最终由自己判断“讲到了没有”。
 */
export const ExplainBack: React.FC<{ lessonId: string; lessonTitle: string; compact?: boolean }> = ({ lessonId, lessonTitle, compact }) => {
  const st = useStudy();
  const saved = st.explains[lessonId];
  const [text, setText] = useState(saved?.text ?? '');
  const [checking, setChecking] = useState(Boolean(saved));
  const [marks, setMarks] = useState<string[]>(saved?.selfChecked ?? []);
  const items = useMemo(() => checklist(lessonId), [lessonId]);
  if (!items.length) return null;

  const norm = text.replace(/\s/g, '').toLowerCase();
  const hit = (words: string[]) => words.length > 0 && words.some((w) => norm.includes(w.replace(/\s/g, '').toLowerCase()));
  const covered = items.filter((it, i) => marks.includes(String(i)) || hit(it.words)).length;

  return (
    <section className={`explain-card${compact ? ' is-compact' : ''}`} aria-label="用自己的话解释">
      <header className="explain-head">
        <MessageSquareText size={17} />
        <div>
          <h3>用自己的话讲一遍</h3>
          <p>假装给一个没学过 PLC 的朋友讲「{lessonTitle}」。讲不出来的地方，就是还没真正懂的地方。</p>
        </div>
      </header>
      <textarea
        className="explain-input"
        value={text}
        rows={compact ? 4 : 5}
        placeholder="例如：按钮一松手就弹回，所以要用电机自己的触点并在启动按钮上……"
        onChange={(e) => setText(e.target.value)}
        aria-label="你的解释"
      />
      <div className="explain-actions">
        <span className="explain-count">{text.trim().length} 字</span>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={text.trim().length < 10}
          onClick={() => {
            haptic('tap');
            setChecking(true);
            saveExplain(lessonId, text, marks);
          }}
        >
          对照关键点检查
        </button>
      </div>
      {checking && (
        <div className="explain-check" role="status">
          <div className="explain-score">
            讲到了 <b>{covered}</b> / {items.length} 个关键点
            {covered === items.length ? '，很完整！' : '。没讲到的可以回看正文或讲课模式。'}
          </div>
          <ul>
            {items.map((it, i) => {
              const auto = hit(it.words);
              const on = auto || marks.includes(String(i));
              return (
                <li key={i} className={on ? 'on' : ''}>
                  <button
                    type="button"
                    onClick={() => {
                      if (auto) return;
                      haptic('tap');
                      const next = marks.includes(String(i)) ? marks.filter((m) => m !== String(i)) : [...marks, String(i)];
                      setMarks(next);
                      saveExplain(lessonId, text, next);
                    }}
                    aria-pressed={on}
                    aria-label={`${it.text}${auto ? '（已自动识别）' : '（点一下标记为讲到了）'}`}
                  >
                    {on ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                    <span>{it.text}</span>
                    {auto && <em>已讲到</em>}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="explain-hint">绿色是按关键词自动识别的；你用别的说法讲到了，点一下自己打勾。</p>
        </div>
      )}
    </section>
  );
};
