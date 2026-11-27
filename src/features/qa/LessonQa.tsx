import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, MessagesSquare, Search, Star } from 'lucide-react';
import { renderInline } from '../../components/MarkdownRenderer';
import { LESSON_QA } from '../../content/qa/lessonQa';
import type { QaItem } from '../../content/qa/types';
import { haptic } from '../../app/native/platform';
import { qaBookmarkKey, toggleQaBookmark, useQaBookmarks } from './qaBookmarks';

/** 一条可折叠的问答。问题是按钮（≥48px），右侧支持星标收藏，展开时答案淡入 */
export const QaRow: React.FC<{
  item: QaItem;
  idPrefix: string;
  defaultOpen?: boolean;
  highlight?: (s: string) => React.ReactNode;
  starred?: boolean;
  onToggleStar?: () => void;
}> = ({ item, idPrefix, defaultOpen = false, highlight, starred, onToggleStar }) => {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `${idPrefix}-a`;
  return (
    <div className={`qa-row${open ? ' open' : ''}`}>
      <div className="qa-row-head">
        <button
          type="button"
          className="qa-q press"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            haptic('tap');
            setOpen((o) => !o);
          }}
        >
          <span className="qa-q-mark" aria-hidden>
            问
          </span>
          <span className="qa-q-text">{highlight ? highlight(item.q) : item.q}</span>
          <ChevronDown size={18} className="qa-chev" aria-hidden />
        </button>
        {onToggleStar && (
          <button
            type="button"
            className={`qa-star-btn press${starred ? ' is-starred' : ''}`}
            aria-pressed={Boolean(starred)}
            aria-label={starred ? `取消收藏：${item.q}` : `收藏重点问答：${item.q}`}
            title={starred ? '取消收藏' : '收藏为重点问答'}
            onClick={() => {
              haptic('tap');
              onToggleStar();
            }}
          >
            <Star size={17} fill={starred ? 'currentColor' : 'none'} aria-hidden />
          </button>
        )}
      </div>
      {open && (
        <div className="qa-a" id={panelId}>
          <span className="qa-a-mark" aria-hidden>
            答
          </span>
          <div className="qa-a-body">
            <p>{renderInline(item.a, `${idPrefix}-t`)}</p>
            {item.see && item.see.length > 0 && (
              <div className="qa-see">
                {item.see.map((s) => (
                  <Link key={s.to + s.label} to={s.to} className="qa-see-link press">
                    {s.label} →
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/** 课程末尾的“本讲问答” */
export const LessonQaSection: React.FC<{ lessonId: string }> = ({ lessonId }) => {
  const items = LESSON_QA[lessonId];
  const bookmarks = useQaBookmarks();
  if (!items || !items.length) return null;
  return (
    <section className="qa-section" id="lesson-qa" aria-labelledby="lesson-qa-h">
      <div className="qa-section-head">
        <h2 id="lesson-qa-h">
          <MessagesSquare size={18} aria-hidden /> 本讲问答
          <span className="qa-count">{items.length} 题</span>
        </h2>
        <p>新手最常问的问题，点开看答案；右边的星标可以收进问答库重点复习。蓝色词可看术语解释，“出处”对应西门子手册原文。</p>
      </div>
      <div className="qa-list">
        {items.map((it, i) => {
          const bk = qaBookmarkKey(lessonId, i);
          return (
            <QaRow
              key={i}
              item={it}
              idPrefix={`lqa-${lessonId}-${i}`}
              starred={bookmarks.includes(bk)}
              onToggleStar={() => toggleQaBookmark(bk)}
            />
          );
        })}
      </div>
      <Link to="/qa" className="qa-lib-link press">
        <Search size={15} aria-hidden /> 去问答库搜全部问题
      </Link>
    </section>
  );
};
