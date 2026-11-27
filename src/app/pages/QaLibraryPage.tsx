import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessagesSquare, Search, Star, X } from 'lucide-react';
import { lessons } from '../../content/curriculum';
import { LESSON_QA } from '../../content/qa/lessonQa';
import type { QaItem } from '../../content/qa/types';
import { QaRow } from '../../features/qa/LessonQa';
import { qaBookmarkKey, toggleQaBookmark, useQaBookmarks } from '../../features/qa/qaBookmarks';
import { haptic } from '../native/platform';
import '../../features/study/study-v3.css';

interface Entry {
  item: QaItem;
  lessonId: string;
  lessonTitle: string;
  order: number;
  idx: number;
  /** 预处理后的检索文本 */
  hay: string;
  qNorm: string;
}

/** 规范化：小写、全角转半角、去掉空白与标点、去掉行内标记 */
export function normalize(s: string): string {
  return s
    .replace(/\[\^[\w-]+\]/g, '')
    .replace(/\[\[([^|\]]*)\|?([^\]]*)\]\]/g, '$1 $2')
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .replace(/[\s`*_~#=?？!！,，.。、:：;；"“”'‘’()（）[\]【】<>《》/\\|-]+/g, '');
}

/** 常见同义说法：搜任何一个都能命中 */
const SYNONYMS: string[][] = [
  ['常闭', 'nc'],
  ['常开', 'no'],
  ['急停', '紧急停止', '蘑菇头'],
  ['博途', 'tiaportal', 'tia', 'step7'],
  ['仿真', 'plcsim', '模拟'],
  ['定时器', 'ton', 'tof', 'tp', '延时'],
  ['计数器', 'ctu', '计数'],
  ['触摸屏', 'hmi', 'wincc'],
  ['模拟量', '420ma', '4~20ma', '27648'],
  ['互锁', '正反转'],
  ['自锁', '起保停', '保持'],
  ['数据块', 'db'],
  ['边沿', '上升沿', 'p_trig'],
  ['双线圈', '覆盖'],
];

function expand(q: string): string[] {
  const out = new Set<string>([q]);
  for (const group of SYNONYMS) {
    for (const w of group) {
      if (q.includes(w)) group.forEach((g) => out.add(q.replace(w, g)));
    }
  }
  return [...out];
}

function bigrams(s: string): Set<string> {
  const b = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) b.add(s.slice(i, i + 2));
  return b;
}

/** 简单模糊打分：整串命中 > 双字重合度 > 单字覆盖。中文不分词也能用 */
export function score(qn: string, e: Entry): number {
  if (!qn) return 0;
  let best = 0;
  for (const v of expand(qn)) {
    let s = 0;
    if (e.qNorm.includes(v)) s += 100;
    else if (e.hay.includes(v)) s += 60;
    if (v.length >= 2) {
      const qb = bigrams(v);
      let hit = 0;
      qb.forEach((g) => {
        if (e.qNorm.includes(g)) hit += 2;
        else if (e.hay.includes(g)) hit += 1;
      });
      s += (hit / (qb.size * 2)) * 50;
    }
    let chars = 0;
    for (const ch of new Set(v)) if (e.hay.includes(ch)) chars++;
    s += (chars / new Set(v).size) * 35;
    best = Math.max(best, s);
  }
  return best;
}

function buildIndex(): Entry[] {
  const out: Entry[] = [];
  for (const l of lessons) {
    (LESSON_QA[l.id] ?? []).forEach((item, idx) => {
      out.push({
        item,
        lessonId: l.id,
        lessonTitle: l.title,
        order: l.order,
        idx,
        qNorm: normalize(item.q),
        hay: normalize(`${item.q} ${item.a} ${l.title} ${(l.tags ?? []).join(' ')}`),
      });
    });
  }
  return out;
}

const HOT = ['常闭', '自锁', '双线圈', 'PLCSIM', '定时器', '27648', '急停', '触摸屏'];

export const QaLibraryPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const [starredOnly, setStarredOnly] = useState(() => params.get('saved') === '1');
  const [liveMsg, setLiveMsg] = useState('');
  const bookmarks = useQaBookmarks();
  const bookmarkSet = useMemo(() => new Set(bookmarks), [bookmarks]);
  const index = useMemo(buildIndex, []);
  const qn = normalize(query);

  const visibleIndex = useMemo(
    () => (starredOnly ? index.filter((e) => bookmarkSet.has(qaBookmarkKey(e.lessonId, e.idx))) : index),
    [index, starredOnly, bookmarkSet],
  );

  const results = useMemo(() => {
    if (!qn) return null;
    return visibleIndex
      .map((e) => ({ e, s: score(qn, e) }))
      .filter((r) => r.s >= (qn.length <= 2 ? 15 : 30))
      .sort((a, b) => b.s - a.s || a.e.order - b.e.order)
      .slice(0, 40);
  }, [qn, visibleIndex]);

  const setQ = (v: string) => {
    setQuery(v);
    const p = new URLSearchParams(params);
    if (v) p.set('q', v);
    else p.delete('q');
    setParams(p, { replace: true });
  };

  const setSavedMode = (only: boolean) => {
    haptic('tap');
    setStarredOnly(only);
    const p = new URLSearchParams(params);
    if (only) p.set('saved', '1');
    else p.delete('saved');
    setParams(p, { replace: true });
  };

  const handleToggleStar = (e: Entry) => {
    const key = qaBookmarkKey(e.lessonId, e.idx);
    const added = toggleQaBookmark(key);
    setLiveMsg(added ? `已收藏：${e.item.q}` : `已取消收藏：${e.item.q}`);
  };

  const highlight = (s: string): React.ReactNode => {
    const raw = query.trim();
    if (!raw) return s;
    const i = s.toLowerCase().indexOf(raw.toLowerCase());
    if (i < 0) return s;
    return (
      <>
        {s.slice(0, i)}
        <mark className="qa-hl">{s.slice(i, i + raw.length)}</mark>
        {s.slice(i + raw.length)}
      </>
    );
  };

  const grouped = useMemo(() => {
    const m = new Map<string, Entry[]>();
    visibleIndex.forEach((e) => {
      if (!m.has(e.lessonId)) m.set(e.lessonId, []);
      m.get(e.lessonId)!.push(e);
    });
    return [...m.values()];
  }, [visibleIndex]);

  return (
    <div className="qa-page">
      <div className="spa-container">
        <div className="v3-sr-only" role="status" aria-live="polite">
          {liveMsg}
        </div>
        <div className="page-hero-bar">
          <div>
            <div className="telemetry-eyebrow">
              <MessagesSquare size={14} />
              新手帮助
            </div>
            <h1>问答库</h1>
            <p>
              全部 {lessons.length} 讲的 {index.length} 个新手问题，离线可搜。点每条右侧星标可收藏重点问答，随时集中复习。
            </p>
          </div>
        </div>

        <div className="filter-toolbar qa-search-bar">
          <div className="search-input-wrap">
            <Search size={16} className="search-input-icon" />
            <input
              type="search"
              className="search-input"
              placeholder={starredOnly ? '在已收藏的重点问答中搜索…' : '搜问题，如：为什么停止按钮用常闭'}
              value={query}
              onChange={(e) => setQ(e.target.value)}
              aria-label="搜索问答"
              enterKeyHint="search"
            />
            {query && (
              <button type="button" className="qa-clear press" aria-label="清除搜索" onClick={() => setQ('')}>
                <X size={16} />
              </button>
            )}
          </div>
          <div className="v3-qa-mode-bar">
            <div className="filter-pills" role="group" aria-label="按收藏筛选">
              <button
                type="button"
                className={`filter-pill press${!starredOnly ? ' active' : ''}`}
                aria-pressed={!starredOnly}
                onClick={() => setSavedMode(false)}
              >
                全部问答 ({index.length})
              </button>
              <button
                type="button"
                className={`filter-pill press${starredOnly ? ' active' : ''}`}
                aria-pressed={starredOnly}
                onClick={() => setSavedMode(true)}
              >
                <Star size={13} fill={starredOnly ? 'currentColor' : 'none'} aria-hidden />
                已收藏重点 ({bookmarks.length})
              </button>
            </div>
          </div>
          <div className="qa-hot" role="group" aria-label="大家常搜">
            <span>常搜：</span>
            {HOT.map((h) => (
              <button
                key={h}
                type="button"
                className="filter-pill press"
                onClick={() => {
                  haptic('tap');
                  setQ(h);
                }}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {results ? (
          results.length === 0 ? (
            <div className="empty-state-card" role="status">
              <Search size={28} color="var(--ink-muted)" />
              <h3>
                {starredOnly
                  ? `已收藏的问答里没有找到“${query}”`
                  : `没有找到“${query}”相关的问题`}
              </h3>
              <p>
                {starredOnly
                  ? '可以切回“全部问答”继续搜，或者换个更短的关键词。'
                  : '换个说法试试，比如把“为什么急停要接常闭”换成“急停 常闭”。也可以去术语表查单个词。'}
              </p>
              <div className="qa-empty-btns">
                {starredOnly && (
                  <button type="button" className="btn btn-primary btn-sm press" onClick={() => setSavedMode(false)}>
                    在全部问答里搜
                  </button>
                )}
                <button type="button" className="btn btn-sm press" onClick={() => setQ('')}>
                  <X size={14} /> 清除搜索
                </button>
                <Link to="/glossary" className="btn btn-sm press">
                  去术语表
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="qa-result-count" role="status">
                {starredOnly ? '在已收藏重点中' : ''}找到 {results.length} 个相关问题
              </p>
              <div className="qa-list">
                {results.map(({ e }) => {
                  const bk = qaBookmarkKey(e.lessonId, e.idx);
                  return (
                    <div key={`${e.lessonId}-${e.idx}`} className="qa-result">
                      <Link to={`/learn/${e.lessonId}`} className="qa-from">
                        第 {e.order} 讲 · {e.lessonTitle}
                      </Link>
                      <QaRow
                        item={e.item}
                        idPrefix={`qs-${e.lessonId}-${e.idx}`}
                        highlight={highlight}
                        defaultOpen={results.length <= 3}
                        starred={bookmarkSet.has(bk)}
                        onToggleStar={() => handleToggleStar(e)}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )
        ) : grouped.length === 0 ? (
          <div className="empty-state-card" role="status">
            <Star size={28} color="var(--alarm-amber)" />
            <h3>还没有收藏重点问答</h3>
            <p>
              遇到容易搞混的接线、定时器或通信问题，点右侧星标就能收进来，后续复习直接在这里集中查看。
            </p>
            <div className="qa-empty-btns">
              <button type="button" className="btn btn-primary btn-sm press" onClick={() => setSavedMode(false)}>
                浏览全部问答
              </button>
            </div>
          </div>
        ) : (
          grouped.map((g) => (
            <section key={g[0].lessonId} className="qa-group">
              <h2 className="qa-group-h">
                <Link to={`/learn/${g[0].lessonId}`}>
                  第 {g[0].order} 讲 · {g[0].lessonTitle}
                </Link>
                <span className="qa-count">{g.length} 题</span>
              </h2>
              <div className="qa-list">
                {g.map((e) => {
                  const bk = qaBookmarkKey(e.lessonId, e.idx);
                  return (
                    <QaRow
                      key={e.idx}
                      item={e.item}
                      idPrefix={`qg-${e.lessonId}-${e.idx}`}
                      starred={bookmarkSet.has(bk)}
                      onToggleStar={() => handleToggleStar(e)}
                    />
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
};

export default QaLibraryPage;
