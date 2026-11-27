import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookA, Check, Copy, Search, X } from 'lucide-react';
import { lessons } from '../../content/curriculum';
import { GLOSSARY, type GlossaryTerm } from '../../content/glossary';
import { FaqSection } from '../../components/FaqSection';
import { preloadRoute } from '../layout/routePreload';

type DomainCategory = '全部' | '硬件接线' | '位逻辑与定时器' | '数据块与SCL' | '模拟量与通讯';

const DOMAIN_CATEGORIES: DomainCategory[] = [
  '全部',
  '硬件接线',
  '位逻辑与定时器',
  '数据块与SCL',
  '模拟量与通讯',
];

/** 将底层词条归类到工程师最常用的 4 大技术领域，不遗漏任意词条 */
const TERM_DOMAIN_BY_ID: Record<string, Exclude<DomainCategory, '全部'>> = {
  // 硬件接线与调试安全
  plc: '硬件接线',
  cpu: '硬件接线',
  'no-nc': '硬件接线',
  'source-sink': '硬件接线',
  contactor: '硬件接线',
  'tia-portal': '硬件接线',
  plcsim: '硬件接线',
  pgpc: '硬件接线',
  'diag-buffer': '硬件接线',
  force: '硬件接线',
  // 位逻辑、扫描周期与定时器/计数器
  'scan-cycle': '位逻辑与定时器',
  'process-image': '位逻辑与定时器',
  coil: '位逻辑与定时器',
  'set-reset': '位逻辑与定时器',
  edge: '位逻辑与定时器',
  timers: '位逻辑与定时器',
  ctu: '位逻辑与定时器',
  lad: '位逻辑与定时器',
  'double-coil': '位逻辑与定时器',
  'compile-download': '位逻辑与定时器',
  'online-monitor': '位逻辑与定时器',
  // 数据块、块结构、数据类型与 SCL
  ob1: '数据块与SCL',
  db: '数据块与SCL',
  'fb-fc': '数据块与SCL',
  udt: '数据块与SCL',
  scl: '数据块与SCL',
  'byte-word': '数据块与SCL',
  hex: '数据块与SCL',
  // 模拟量、PID、HMI 与网络通讯
  profinet: '模拟量与通讯',
  pid: '模拟量与通讯',
  '4-20ma': '模拟量与通讯',
  hmi: '模拟量与通讯',
  'ip-address': '模拟量与通讯',
  'digital-twin': '模拟量与通讯',
};

function resolveDomain(term: GlossaryTerm): Exclude<DomainCategory, '全部'> {
  const mapped = TERM_DOMAIN_BY_ID[term.id];
  if (mapped) return mapped;
  switch (term.category) {
    case '电气元件':
      return '硬件接线';
    case '编程指令':
      return '位逻辑与定时器';
    case '程序结构':
      return '数据块与SCL';
    case '通讯与模拟量':
      return '模拟量与通讯';
    default:
      return '硬件接线';
  }
}

async function copyTextSafe(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below for file:// or restricted WebViews
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export const GlossaryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('term');
  const section = searchParams.get('section');

  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState<DomainCategory>('全部');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyStatusText, setCopyStatusText] = useState('');

  const lessonTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of lessons) map.set(l.id, `第 ${l.order} 讲 · ${l.title}`);
    return map;
  }, []);

  const enrichedGlossary = useMemo(
    () => GLOSSARY.map((t) => ({ ...t, domain: resolveDomain(t) })),
    []
  );

  const domainCounts = useMemo(() => {
    const counts: Record<DomainCategory, number> = {
      全部: enrichedGlossary.length,
      硬件接线: 0,
      位逻辑与定时器: 0,
      数据块与SCL: 0,
      模拟量与通讯: 0,
    };
    enrichedGlossary.forEach((t) => {
      counts[t.domain] += 1;
    });
    return counts;
  }, [enrichedGlossary]);

  useEffect(() => {
    const targetId = section === 'faq' ? 'faq' : highlightId ? `term-${highlightId}` : null;
    if (!targetId) return;
    // 若 URL 定位到指定术语，重置筛选确保词条可见
    if (highlightId) {
      setDomain('全部');
      setQuery('');
    }
    const el = document.getElementById(targetId);
    if (el) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.setTimeout(
        () =>
          el.scrollIntoView({
            block: section === 'faq' ? 'start' : 'center',
            behavior: reduce || section === 'faq' ? 'auto' : 'smooth',
          }),
        60
      );
    }
  }, [highlightId, section]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enrichedGlossary.filter((t) => {
      if (domain !== '全部' && t.domain !== domain) return false;
      if (!q) return true;
      return [t.term, t.en ?? '', ...(t.aliases ?? []), t.short, t.detail ?? '', t.domain, t.category]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [enrichedGlossary, query, domain]);

  const handleCopyTerm = async (t: GlossaryTerm & { domain: Exclude<DomainCategory, '全部'> }) => {
    const head = t.en ? `【${t.term} (${t.en})】` : `【${t.term}】`;
    const body = t.detail ? `${head}${t.short}\n补充：${t.detail}` : `${head}${t.short}`;
    const ok = await copyTextSafe(body);
    if (ok) {
      setCopiedId(t.id);
      setCopyStatusText(`已复制「${t.term}」的术语解释到剪贴板`);
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === t.id ? null : prev));
      }, 1800);
    } else {
      setCopyStatusText('复制失败，请手动选中词条文字复制');
    }
  };

  return (
    <div className="glossary-page">
      <div className="spa-container">
        <div className="page-hero-bar">
          <div>
            <div className="telemetry-eyebrow">
              <BookA size={14} />
              工控术语速查 · 4 大领域分类
            </div>
            <h1>术语表</h1>
            <p>
              课程里反复出现的 {GLOSSARY.length} 个核心术语，按工程领域分类并支持一键复制解释，方便贴进笔记或发给同事对照。
            </p>
          </div>
        </div>

        <div className="filter-toolbar glossary-toolbar-v3">
          <div className="filter-row">
            <div className="search-input-wrap">
              <Search size={15} className="search-input-icon" />
              <input
                type="search"
                className="search-input"
                placeholder="搜索术语或别名，如 TON、常闭、NPN、UDT、4-20mA、PROFINET…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="搜索术语"
              />
            </div>
            <span className="glossary-result-meta" aria-live="polite">
              显示 {filtered.length} / {GLOSSARY.length} 条
            </span>
          </div>
          <div className="filter-pills" role="group" aria-label="按工程领域快速筛选">
            {DOMAIN_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`filter-pill${domain === c ? ' active' : ''}`}
                aria-pressed={domain === c}
                onClick={() => setDomain(c)}
              >
                <span>{c}</span>
                <span className="glossary-pill-count">{domainCounts[c]}</span>
              </button>
            ))}
          </div>
        </div>

        <span className="sr-only" role="status" aria-live="polite">
          {copyStatusText}
        </span>

        {filtered.length === 0 ? (
          <div className="empty-state-card">
            <Search size={28} color="var(--ink-muted)" />
            <h3>没有找到“{query}”</h3>
            <p>换个关键词或切换领域分类试试，也可以清除筛选查看全部术语。</p>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setQuery('');
                setDomain('全部');
              }}
            >
              <X size={14} />
              清除筛选
            </button>
          </div>
        ) : (
          <dl className="glossary-grid">
            {filtered.map((t) => {
              const isCopied = copiedId === t.id;
              return (
                <div
                  key={t.id}
                  id={`term-${t.id}`}
                  className={`glossary-card${highlightId === t.id ? ' is-highlight' : ''}`}
                >
                  <dt className="glossary-term-head">
                    <div className="glossary-term">
                      <span>{t.term}</span>
                      {t.en && <span className="glossary-en">{t.en}</span>}
                    </div>
                    <button
                      type="button"
                      className={`glossary-copy-btn${isCopied ? ' is-copied' : ''}`}
                      onClick={() => void handleCopyTerm(t)}
                      aria-label={`复制术语「${t.term}」的解释`}
                      title="一键复制术语解释"
                    >
                      {isCopied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{isCopied ? '已复制' : '复制解释'}</span>
                    </button>
                  </dt>
                  <dd className="glossary-def">
                    <div className="glossary-badge-row">
                      <span className="badge badge-teal glossary-cat">{t.domain}</span>
                      <span className="badge glossary-cat">{t.category}</span>
                    </div>
                    <p>{t.short}</p>
                    {t.detail && <p className="glossary-detail">{t.detail}</p>}
                    {t.lessonId && lessonTitle.has(t.lessonId) && (
                      <Link
                        to={`/learn/${t.lessonId}`}
                        onMouseEnter={() => preloadRoute(`/learn/${t.lessonId}`)}
                        onFocus={() => preloadRoute(`/learn/${t.lessonId}`)}
                        className="glossary-lesson-link"
                      >
                        详见 {lessonTitle.get(t.lessonId)}
                        <ArrowRight size={13} />
                      </Link>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}

        <div className="glossary-faq-wrap">
          <FaqSection id="faq" />
        </div>
      </div>
    </div>
  );
};
