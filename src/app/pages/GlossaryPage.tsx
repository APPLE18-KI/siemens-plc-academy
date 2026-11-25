import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookA, Search, X } from 'lucide-react';
import { GLOSSARY, GLOSSARY_CATEGORIES, type GlossaryTerm } from '../../content/glossary';
import { lessons } from '../../registry';
import { FaqSection } from '../../components/FaqSection';

type CategoryFilter = '全部' | GlossaryTerm['category'];

export const GlossaryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('term');
  const section = searchParams.get('section');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('全部');

  const lessonTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of lessons) map.set(l.id, `第 ${l.order} 讲 · ${l.title}`);
    return map;
  }, []);

  useEffect(() => {
    const targetId = section === 'faq' ? 'faq' : highlightId ? `term-${highlightId}` : null;
    if (!targetId) return;
    const el = document.getElementById(targetId);
    if (el) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      // 等待路由切换时的“回到顶部”完成后再滚动
      window.setTimeout(() => el.scrollIntoView({ block: section === 'faq' ? 'start' : 'center', behavior: reduce || section === 'faq' ? 'auto' : 'smooth' }), 60);
    }
  }, [highlightId, section]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GLOSSARY.filter((t) => {
      if (category !== '全部' && t.category !== category) return false;
      if (!q) return true;
      return [t.term, t.en ?? '', ...(t.aliases ?? []), t.short, t.detail ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [query, category]);

  return (
    <div className="glossary-page">
      <div className="spa-container">
        <div className="page-hero-bar">
          <div>
            <div className="telemetry-eyebrow">
              <BookA size={14} />
              新手帮助
            </div>
            <h1>术语表</h1>
            <p>
              课程里反复出现的 {GLOSSARY.length} 个关键词，用大白话各讲一句。在课程正文里看到带虚线下划线的词，也可以直接点开查看。
            </p>
          </div>
        </div>

        <div className="filter-toolbar">
          <div className="filter-row">
            <div className="search-input-wrap">
              <Search size={15} className="search-input-icon" />
              <input
                type="search"
                className="search-input"
                placeholder="搜索术语，如 TON、常闭、PROFINET…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="搜索术语"
              />
            </div>
          </div>
          <div className="filter-pills" role="group" aria-label="按类别筛选">
            {(['全部', ...GLOSSARY_CATEGORIES] as CategoryFilter[]).map((c) => (
              <button
                key={c}
                type="button"
                className={`filter-pill${category === c ? ' active' : ''}`}
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state-card">
            <Search size={28} color="var(--ink-muted)" />
            <h3>没有找到“{query}”</h3>
            <p>换个说法试试，或者清除筛选查看全部术语。</p>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setQuery('');
                setCategory('全部');
              }}
            >
              <X size={14} />
              清除筛选
            </button>
          </div>
        ) : (
          <dl className="glossary-grid">
            {filtered.map((t) => (
              <div
                key={t.id}
                id={`term-${t.id}`}
                className={`glossary-card${highlightId === t.id ? ' is-highlight' : ''}`}
              >
                <dt className="glossary-term">
                  <span>{t.term}</span>
                  {t.en && <span className="glossary-en">{t.en}</span>}
                </dt>
                <dd className="glossary-def">
                  <span className="badge glossary-cat">{t.category}</span>
                  <p>{t.short}</p>
                  {t.detail && <p className="glossary-detail">{t.detail}</p>}
                  {t.lessonId && lessonTitle.has(t.lessonId) && (
                    <Link to={`/learn/${t.lessonId}`} className="glossary-lesson-link">
                      详见 {lessonTitle.get(t.lessonId)}
                      <ArrowRight size={13} />
                    </Link>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div className="glossary-faq-wrap">
          <FaqSection id="faq" />
        </div>
      </div>
    </div>
  );
};
