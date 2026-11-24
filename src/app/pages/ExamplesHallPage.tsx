import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Code2,
  Cpu,
  FolderKanban,
  RotateCcw,
  Search,
  TableProperties,
} from 'lucide-react';
import { examples } from '../../registry';
import type { ExampleCase } from '../../types/content';
import { useProgress } from '../store/progressStore';

const DIFFICULTIES: Array<'全部' | ExampleCase['difficulty']> = [
  '全部',
  '基础',
  '进阶',
  '工业综合',
];

function diffBadgeClass(diff: ExampleCase['difficulty']): string {
  switch (diff) {
    case '基础':
      return 'badge-cyan';
    case '进阶':
      return 'badge-teal';
    case '工业综合':
      return 'badge-amber';
    default:
      return '';
  }
}

export const ExamplesHallPage: React.FC = () => {
  const { state } = useProgress();
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState<'全部' | ExampleCase['difficulty']>('全部');
  const [industry, setIndustry] = useState<string>('全部');

  const safeExamples = useMemo(() => (Array.isArray(examples) ? examples : []), []);

  const industries = useMemo(() => {
    const set = new Set<string>();
    for (const ex of safeExamples) {
      if (ex.industry) set.add(ex.industry);
    }
    return ['全部', ...Array.from(set)];
  }, [safeExamples]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return safeExamples.filter((ex) => {
      if (difficulty !== '全部' && ex.difficulty !== difficulty) return false;
      if (industry !== '全部' && ex.industry !== industry) return false;
      if (q) {
        const hay = [
          ex.title,
          ex.subtitle,
          ex.industry,
          ex.hardware,
          ex.summary,
          ...(ex.highlights || []),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [safeExamples, difficulty, industry, query]);

  const handleReset = () => {
    setQuery('');
    setDifficulty('全部');
    setIndustry('全部');
  };

  return (
    <div className="catalog-page">
      <div className="spa-container">
        <div className="page-hero-bar">
          <div>
            <div className="telemetry-eyebrow">
              <span className="telemetry-dot teal" />
              INDUSTRIAL CASE LIBRARY · 真实工程案例库
            </div>
            <h1>西门子 S7-1200 工业实例大厅</h1>
            <p>
              每一个案例均完整交付 <strong>工艺控制需求</strong>、<strong>标准 PLC I/O 表</strong>、
              <strong>LAD 梯形图 + SCL 源码</strong>、<strong>在线数字孪生/仿真联动</strong>，以及一线工程师总结的调试踩坑与面试考点。
            </p>
          </div>

          <div
            style={{
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-hairline)',
              background: 'var(--bg-surface)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700 }}>
                {safeExamples.length}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>精选工业实例</div>
            </div>
            <div style={{ width: 1, height: 28, background: 'var(--border-hairline)' }} />
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--siemens-teal-bright)',
                }}
              >
                {state.visitedExampleIds.length}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>已研读案例</div>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="filter-toolbar">
          <div className="filter-row">
            <div className="search-input-wrap">
              <Search size={15} className="search-input-icon" />
              <input
                type="search"
                className="search-input"
                placeholder="搜索实例名称、行业、PLC 型号或工艺关键词…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="filter-pills" role="group" aria-label="按难度筛选">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`filter-pill${difficulty === d ? ' active' : ''}`}
                  onClick={() => setDifficulty(d)}
                >
                  {d === '全部' ? '全部难度' : d}
                </button>
              ))}
            </div>
          </div>

          {industries.length > 1 && (
            <div className="filter-pills" role="group" aria-label="按行业筛选">
              {industries.map((ind) => (
                <button
                  key={ind}
                  type="button"
                  className={`filter-pill${industry === ind ? ' active' : ''}`}
                  onClick={() => setIndustry(ind)}
                >
                  {ind === '全部' ? '全部行业' : ind}
                </button>
              ))}
            </div>
          )}
        </div>

        {safeExamples.length === 0 ? (
          <div className="empty-state-card">
            <FolderKanban size={32} color="var(--siemens-teal)" />
            <h3>工业实例库正在装配中</h3>
            <p>
              当 6 套经典工程案例写入 <code>src/content/examples/index.ts</code>{' '}
              后，这里会自动渲染完整实例大厅与左右双栏工作台。
            </p>
            <Link to="/models" className="btn btn-primary btn-sm">
              先体验 2.5D 数字孪生建模
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state-card">
            <Search size={30} color="var(--ink-muted)" />
            <h3>没有匹配的工业实例</h3>
            <p>请更换搜索关键词或重置行业与难度筛选。</p>
            <button type="button" className="btn btn-sm" onClick={handleReset}>
              <RotateCcw size={14} />
              重置筛选
            </button>
          </div>
        ) : (
          <div className="examples-grid">
            {filtered.map((ex, idx) => {
              const studied = state.visitedExampleIds.includes(ex.id);
              return (
                <Link key={ex.id} to={`/examples/${ex.id}`} className="example-card">
                  <div className="example-card-meta">
                    <span className="badge badge-mono">
                      CASE {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className={`badge ${diffBadgeClass(ex.difficulty)}`}>
                      {ex.difficulty}
                    </span>
                    <span className="badge">{ex.industry}</span>
                    <span className="badge badge-mono">{ex.hardware}</span>
                    {studied && (
                      <span className="badge badge-green" style={{ marginLeft: 'auto' }}>
                        <CheckCircle2 size={12} />
                        已研读
                      </span>
                    )}
                  </div>

                  <h2 className="example-card-title">{ex.title}</h2>
                  <div className="example-card-sub">{ex.subtitle}</div>
                  <p className="example-card-summary">{ex.summary}</p>

                  {ex.highlights && ex.highlights.length > 0 && (
                    <div className="example-highlights">
                      {ex.highlights.slice(0, 4).map((hl, i) => (
                        <span key={i} className="badge" style={{ fontSize: 11.5 }}>
                          {hl}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="example-card-foot">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 10,
                        fontSize: 12,
                        color: 'var(--ink-muted)',
                      }}
                    >
                      {ex.linkedModelId && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Boxes size={13} color="var(--info-cyan)" />
                          数字孪生
                        </span>
                      )}
                      {ex.linkedSimPreset && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Cpu size={13} color="var(--power-green)" />
                          实时仿真
                        </span>
                      )}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <TableProperties size={13} color="var(--alarm-amber)" />
                        {ex.ioTags?.length ?? 0} 点 I/O
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Code2 size={13} color="var(--siemens-teal-bright)" />
                        LAD + SCL
                      </span>
                    </div>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--siemens-teal-bright)',
                      }}
                    >
                      进入工程工作台
                      <ArrowRight size={14} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
