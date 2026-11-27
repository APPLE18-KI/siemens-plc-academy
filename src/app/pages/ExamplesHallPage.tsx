import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Code2,
  Cpu,
  FolderKanban,
  LayoutGrid,
  RotateCcw,
  Search,
  Table2,
  TableProperties,
} from 'lucide-react';
import { examples } from '../../registry';
import type { ExampleCase } from '../../types/content';
import { useProgress } from '../store/progressStore';
import {
  computeIoBreakdown,
  EXAMPLE_META_MAP,
  loadFatChecklistMap,
  PROCESS_TAGS,
  type ProcessTag,
} from '../../content/examples/engineeringPack';
import './examples-v3.css';

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
  const [processTag, setProcessTag] = useState<ProcessTag>('全部');
  const [viewMode, setViewMode] = useState<'cards' | 'matrix'>('cards');
  const fatMap = useMemo(() => loadFatChecklistMap(), []);

  const safeExamples = useMemo(() => (Array.isArray(examples) ? examples : []), []);

  const enriched = useMemo(
    () =>
      safeExamples.map((ex, idx) => {
        const meta = EXAMPLE_META_MAP[ex.id] ?? {
          processTags: [],
          coreInstructions: ['LAD', 'SCL'],
          plcModelShort: 'CPU 1214C',
        };
        const io = computeIoBreakdown(ex.ioTags);
        const fatChecks = fatMap[ex.id] ?? [];
        const fatDone = fatChecks.filter(Boolean).length;
        const searchHay = [
          ex.title,
          ex.subtitle,
          ex.industry,
          ex.hardware,
          ex.summary,
          ...(ex.highlights || []),
          ...meta.processTags,
          ...meta.coreInstructions,
          ...(ex.ioTags || []).map((t) => `${t.address} ${t.name} ${t.comment ?? ''}`),
        ]
          .join(' ')
          .toLowerCase();
        return { ex, idx, meta, io, fatDone, searchHay };
      }),
    [safeExamples, fatMap]
  );

  const tagCounts = useMemo(() => {
    const counts: Record<ProcessTag, number> = {
      全部: enriched.length,
      电机互锁: 0,
      定时器: 0,
      PID模拟量: 0,
      顺序分拣: 0,
    };
    for (const item of enriched) {
      for (const tag of item.meta.processTags) {
        counts[tag] += 1;
      }
    }
    return counts;
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter(({ ex, meta, searchHay }) => {
      if (difficulty !== '全部' && ex.difficulty !== difficulty) return false;
      if (processTag !== '全部' && !meta.processTags.includes(processTag)) return false;
      if (q && !searchHay.includes(q)) return false;
      return true;
    });
  }, [enriched, difficulty, processTag, query]);

  const handleReset = () => {
    setQuery('');
    setDifficulty('全部');
    setProcessTag('全部');
  };

  const formatIoSummary = (io: ReturnType<typeof computeIoBreakdown>) => {
    const parts = [`${io.di} DI`, `${io.doCount} DO`];
    if (io.ai > 0) parts.push(`${io.ai} AI`);
    if (io.aq > 0) parts.push(`${io.aq} AQ`);
    return parts.join(' / ');
  };

  return (
    <div className="catalog-page">
      <div className="spa-container">
        <div className="page-hero-bar">
          <div>
            <div className="telemetry-eyebrow">
              <span className="telemetry-dot teal" />
              真实工程案例库 · 支持 .SCL 与 .CSV 交付包导出
            </div>
            <h1>西门子 S7-1200 工业实例大厅</h1>
            <p>
              每一个案例均完整交付 <strong>工艺控制需求</strong>、<strong>标准 I/O 表 (.csv)</strong>、
              <strong>博途 LAD + SCL 源码 (.scl)</strong>、<strong>五步 FAT 上电点检表</strong>与在线数字孪生/仿真联动。
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

        {/* Filter Toolbar: Keyword Search + Process Tags + Difficulty + View Switch */}
        <div className="filter-toolbar">
          <div className="filter-row">
            <div className="search-input-wrap">
              <Search size={15} className="search-input-icon" />
              <input
                type="search"
                className="search-input"
                placeholder="搜案例、指令(TON/NORM_X/PID/CASE)、地址(%IW64)或工艺…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="关键词快速检索工业实例"
              />
            </div>

            <div className="ex3-view-toggle" role="group" aria-label="案例展示视图切换">
              <button
                type="button"
                className={`ex3-view-btn ${viewMode === 'cards' ? 'is-active' : ''}`}
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid size={14} />
                卡片视图
              </button>
              <button
                type="button"
                className={`ex3-view-btn ${viewMode === 'matrix' ? 'is-active' : ''}`}
                onClick={() => setViewMode('matrix')}
              >
                <Table2 size={14} />
                参数对比表
              </button>
            </div>
          </div>

          <div className="ex3-filter-group">
            <div className="filter-pills" role="group" aria-label="按工艺标签筛选">
              <span className="ex3-filter-label">工艺标签</span>
              {PROCESS_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`filter-pill${processTag === tag ? ' active' : ''}`}
                  onClick={() => setProcessTag(tag)}
                >
                  {tag} ({tagCounts[tag]})
                </button>
              ))}
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
        </div>

        {safeExamples.length === 0 ? (
          <div className="empty-state-card">
            <FolderKanban size={32} color="var(--siemens-teal)" />
            <h3>工业实例库正在装配中</h3>
            <Link to="/models" className="btn btn-primary btn-sm">
              先体验 2.5D 数字孪生建模
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state-card">
            <Search size={30} color="var(--ink-muted)" />
            <h3>没有匹配的工业实例</h3>
            <p>可尝试搜索 TON、NORM_X、互锁、气缸、%IW64，或重置工艺标签筛选。</p>
            <button type="button" className="btn btn-sm" onClick={handleReset}>
              <RotateCcw size={14} />
              重置筛选
            </button>
          </div>
        ) : viewMode === 'matrix' ? (
          <div className="ex3-matrix-wrap">
            <table className="ex3-matrix-table">
              <thead>
                <tr>
                  <th>编号 / 案例名称</th>
                  <th>工艺分类</th>
                  <th>硬件点数</th>
                  <th>核心 PLC 指令</th>
                  <th>FAT 点检</th>
                  <th>进入工作台</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ ex, idx, meta, io, fatDone }) => (
                  <tr key={ex.id}>
                    <td>
                      <Link to={`/examples/${ex.id}`} className="ex3-matrix-link">
                        0{idx + 1}. {ex.title}
                      </Link>
                      <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 3 }}>
                        {meta.plcModelShort} · {ex.difficulty}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {meta.processTags.map((t) => (
                          <span key={t} className="badge badge-teal">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className="ex3-io-pill">{formatIoSummary(io)}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {meta.coreInstructions.map((ins) => (
                          <span key={ins} className="ex3-instr-chip">
                            {ins}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {fatDone}/5 步
                    </td>
                    <td>
                      <Link to={`/examples/${ex.id}`} className="btn btn-sm btn-primary">
                        打开
                        <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="examples-grid">
            {filtered.map(({ ex, idx, meta, io, fatDone }) => {
              const studied = state.visitedExampleIds.includes(ex.id);
              return (
                <Link key={ex.id} to={`/examples/${ex.id}`} className="example-card">
                  <div className="example-card-meta">
                    <span className="badge badge-mono">案例 0{idx + 1}</span>
                    <span className={`badge ${diffBadgeClass(ex.difficulty)}`}>
                      {ex.difficulty}
                    </span>
                    {meta.processTags.map((t) => (
                      <span key={t} className="badge badge-teal">
                        {t}
                      </span>
                    ))}
                    {studied ? (
                      <span className="badge badge-green" style={{ marginLeft: 'auto' }}>
                        <CheckCircle2 size={12} />
                        已研读
                      </span>
                    ) : null}
                  </div>

                  <h2 className="example-card-title">{ex.title}</h2>
                  <div className="example-card-sub">{ex.subtitle}</div>

                  {/* Hardware I/O Points & Core Instructions Quick Comparison Strip */}
                  <div className="ex3-spec-strip" aria-label="硬件点数与核心指令">
                    <span className="ex3-io-pill">{formatIoSummary(io)}</span>
                    {meta.coreInstructions.map((ins) => (
                      <span key={ins} className="ex3-instr-chip">
                        {ins}
                      </span>
                    ))}
                    {fatDone > 0 ? (
                      <span className="ex3-instr-chip" style={{ marginLeft: 'auto' }}>
                        FAT {fatDone}/5
                      </span>
                    ) : null}
                  </div>

                  <p className="example-card-summary">{ex.summary}</p>

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
                      {ex.linkedModelId ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Boxes size={13} color="var(--info-cyan)" />
                          数字孪生
                        </span>
                      ) : null}
                      {ex.linkedSimPreset ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Cpu size={13} color="var(--power-green)" />
                          实时仿真
                        </span>
                      ) : null}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <TableProperties size={13} color="var(--alarm-amber)" />
                        {io.total} 点 I/O (.csv)
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Code2 size={13} color="var(--siemens-teal-bright)" />
                        LAD + .scl
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
