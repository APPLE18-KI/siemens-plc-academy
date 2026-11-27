import React, { memo, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Network,
  Search,
} from 'lucide-react';
import type { TagDef } from '../../../types/plc';
import {
  analyzeProgramCrossRef,
  type CrossRefAnalysis,
  type CrossRefCategory,
  type CrossRefEntry,
  type CrossRefUsage,
  type LadderProgram,
} from '../../../core/plc';

type FilterScope = 'all' | 'input' | 'output' | 'memory' | 'blocks' | 'issues';

const FILTERS: { id: FilterScope; label: string }[] = [
  { id: 'all', label: '全部地址' },
  { id: 'input', label: '%I / %IW' },
  { id: 'output', label: '%Q / %QW' },
  { id: 'memory', label: '%M' },
  { id: 'blocks', label: 'T / C / DB' },
  { id: 'issues', label: '仅异常项' },
];

const CAT_BADGE: Record<CrossRefCategory, string> = {
  I: '%I', IW: '%IW', Q: '%Q', QW: '%QW', M: '%M', T: 'T', C: 'C', DB: 'DB',
};

function matchesScope(e: CrossRefEntry, scope: FilterScope): boolean {
  if (scope === 'all') return true;
  if (scope === 'input') return e.category === 'I' || e.category === 'IW';
  if (scope === 'output') return e.category === 'Q' || e.category === 'QW';
  if (scope === 'memory') return e.category === 'M';
  if (scope === 'blocks') return e.category === 'T' || e.category === 'C' || e.category === 'DB';
  return e.diagnostics.length > 0;
}

function primaryTarget(e: CrossRefEntry): CrossRefUsage | undefined {
  if (e.status === 'double-coil') return e.writes.find((u) => u.isOrdinaryCoil) ?? e.writes[0];
  return e.writes[0] ?? e.reads[0] ?? e.usages[0];
}

function statusMeta(status: CrossRefEntry['status']) {
  if (status === 'double-coil') return { label: '双线圈冲突', tone: 'error' };
  if (status === 'input-write') return { label: '误写输入区', tone: 'error' };
  if (status === 'read-only') return { label: '只读未写', tone: 'warn' };
  if (status === 'write-only') return { label: '只写未读', tone: 'info' };
  if (status === 'unused') return { label: '未引用', tone: 'muted' };
  return { label: '正常', tone: 'ok' };
}

export type CrossRefJumpHandler = (networkNumber: number, nodeId?: string) => void;

export const CrossRefDiagnosticsStrip = memo<{
  analysis: CrossRefAnalysis;
  onJumpToNetwork?: CrossRefJumpHandler;
  theme: 'tia' | 'instrument';
}>(function CrossRefDiagnosticsStrip({ analysis, onJumpToNetwork, theme }) {
  const cls = theme === 'tia' ? 'ps-xref-diags' : 'plc-xref-diags';
  if (analysis.diagnostics.length === 0) {
    return (
      <div className={`${cls} is-clean`} role="status">
        <CheckCircle2 size={16} aria-hidden />
        <span>静态体检通过：0 处双线圈冲突，所有已用标志与输出读写路径完整。</span>
      </div>
    );
  }
  return (
    <div className={cls} role="region" aria-label="静态双线圈与地址体检结果">
      {analysis.diagnostics.map((d) => {
        const Icon = d.severity === 'error' ? AlertOctagon : d.severity === 'warning' ? AlertTriangle : Info;
        return (
          <div key={d.id} className={`xref-diag-item sev-${d.severity}`}>
            <div className="xref-diag-main">
              <Icon size={16} className="xref-diag-icon" aria-hidden />
              <div className="xref-diag-copy">
                <div className="xref-diag-head">
                  <strong>{d.title}</strong>
                  <code className="xref-diag-addr">{d.address}</code>
                </div>
                <p className="xref-diag-msg">{d.message}</p>
                <p className="xref-diag-fix">修复建议：{d.suggestion}</p>
              </div>
            </div>
            {onJumpToNetwork && d.networkNumbers.length > 0 && (
              <div className="xref-diag-jumps">
                {d.networkNumbers.map((nw) => (
                  <button key={nw} type="button" className="xref-jump-btn" onClick={() => onJumpToNetwork(nw)}>
                    <span>定位 NW {nw}</span>
                    <ArrowUpRight size={13} aria-hidden />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

export const CrossRefTable = memo<{
  analysis: CrossRefAnalysis;
  onJumpToNetwork?: CrossRefJumpHandler;
  theme: 'tia' | 'instrument';
}>(function CrossRefTable({ analysis, onJumpToNetwork, theme }) {
  const [scope, setScope] = useState<FilterScope>('all');
  const [query, setQuery] = useState('');
  const [showUnused, setShowUnused] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return analysis.entries.filter((e) => {
      if (!showUnused && e.usages.length === 0 && scope !== 'issues') return false;
      if (!matchesScope(e, scope)) return false;
      if (!q) return true;
      return e.tag.toLowerCase().includes(q) || e.address.toLowerCase().includes(q) || (e.comment ?? '').toLowerCase().includes(q);
    });
  }, [analysis.entries, scope, query, showUnused]);

  const unusedCount = useMemo(() => analysis.entries.filter((e) => e.usages.length === 0).length, [analysis.entries]);
  const issueCount = useMemo(() => analysis.entries.filter((e) => e.diagnostics.length > 0).length, [analysis.entries]);

  return (
    <div className={`xref-table-block theme-${theme}`}>
      <div className="xref-filter-bar">
        <div className="xref-scope-pills" role="group" aria-label="地址区筛选">
          {FILTERS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`xref-scope-pill${scope === opt.id ? ' on' : ''}${opt.id === 'issues' && issueCount > 0 ? ' has-alert' : ''}`}
              aria-pressed={scope === opt.id}
              onClick={() => setScope(opt.id)}
            >
              <span>{opt.label}</span>
              {opt.id === 'issues' && issueCount > 0 && <span className="xref-pill-badge">{issueCount}</span>}
            </button>
          ))}
        </div>
        <div className="xref-search-row">
          <label className="xref-search-box">
            <Search size={14} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="筛选符号、%I/%Q/%M 地址..."
              aria-label="筛选交叉引用变量"
            />
          </label>
          {unusedCount > 0 && (
            <label className="xref-unused-toggle">
              <input type="checkbox" checked={showUnused} onChange={(e) => setShowUnused(e.target.checked)} />
              <span>显示未引用 ({unusedCount})</span>
            </label>
          )}
        </div>
      </div>

      <div className="xref-table-scroll">
        <table className="xref-table">
          <thead>
            <tr>
              <th>对象 / 地址</th>
              <th>静态体检</th>
              <th>读取位置 (R)</th>
              <th>写入位置 (W)</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="xref-empty-cell">当前筛选条件下没有匹配的交叉引用记录。</td></tr>
            ) : filtered.map((e) => {
              const st = statusMeta(e.status);
              const target = primaryTarget(e);
              const clickable = Boolean(onJumpToNetwork && target);
              const isDc = e.status === 'double-coil';
              return (
                <tr
                  key={`${e.category}:${e.tag}:${e.address}`}
                  className={`xref-row status-${e.status}${clickable ? ' is-clickable' : ''}`}
                  onClick={clickable && target ? () => onJumpToNetwork?.(target.networkNumber, target.nodeId) : undefined}
                  title={clickable && target ? `点击定位到程序段 NW ${target.networkNumber}` : undefined}
                >
                  <td className="xref-col-sym">
                    <div className="xref-sym-top">
                      <span className={`xref-area-tag cat-${e.category.toLowerCase()}`}>{CAT_BADGE[e.category]}</span>
                      <span className="xref-sym-name">"{e.tag}"</span>
                    </div>
                    <div className="xref-sym-sub">
                      <code className="xref-mono">{e.address}</code>
                      <span className="xref-dtype">{e.dataType}</span>
                    </div>
                  </td>
                  <td className="xref-col-status"><span className={`xref-status-pill tone-${st.tone}`}>{st.label}</span></td>
                  <td className="xref-col-refs">
                    {e.reads.length === 0 ? <span className="xref-none">—</span> : (
                      <div className="xref-ref-list">
                        {e.reads.map((u, idx) => (
                          <button key={`${u.nodeId}-r-${idx}`} type="button" className="xref-ref-chip kind-r" onClick={(ev) => { ev.stopPropagation(); onJumpToNetwork?.(u.networkNumber, u.nodeId); }} title={`NW ${u.networkNumber} (${u.networkTitle}) · ${u.detail ?? u.instruction}`}>
                            <b>R</b><span>NW {u.networkNumber}</span><em>{u.instruction}</em>
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="xref-col-refs">
                    {e.writes.length === 0 ? <span className="xref-none">—</span> : (
                      <div className="xref-ref-list">
                        {e.writes.map((u, idx) => (
                          <button key={`${u.nodeId}-w-${idx}`} type="button" className={`xref-ref-chip kind-w${isDc && u.isOrdinaryCoil ? ' is-hazard' : ''}`} onClick={(ev) => { ev.stopPropagation(); onJumpToNetwork?.(u.networkNumber, u.nodeId); }} title={`NW ${u.networkNumber} (${u.networkTitle}) · ${u.detail ?? u.instruction}`}>
                            <b>W</b><span>NW {u.networkNumber}</span><em>{u.instruction}</em>
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="xref-col-comment">{e.comment || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export interface CrossRefPanelProps {
  program: LadderProgram;
  tagDefs: TagDef[];
  onJumpToNetwork?: CrossRefJumpHandler;
}

export const CrossRefWorkbenchPanel = memo<CrossRefPanelProps>(function CrossRefWorkbenchPanel({
  program, tagDefs, onJumpToNetwork,
}) {
  const analysis = useMemo(() => analyzeProgramCrossRef(program, tagDefs), [program, tagDefs]);
  const refCount = useMemo(() => analysis.entries.filter((e) => e.usages.length > 0).length, [analysis.entries]);

  return (
    <section className="ps-xref" aria-label="交叉引用表与静态地址体检">
      <div className="ps-xref-head">
        <div className="ps-xref-summary">
          <div className="ps-xref-title">
            <Network size={15} aria-hidden />
            <strong>交叉引用信息 (Cross-Reference · F11)</strong>
          </div>
          <p className="ps-note inline">点击任意变量行或 <code>NW</code> 位置徽章，切换回 Main [OB1] 并滚动高亮对应程序段。</p>
        </div>
        <div className="ps-xref-kpis" aria-label="静态扫描统计">
          <span className="xref-kpi">程序段 <b>{program.networks.length}</b></span>
          <span className="xref-kpi">引用对象 <b>{refCount}</b></span>
          <span className={`xref-kpi${analysis.doubleCoilCount > 0 ? ' is-error' : ' is-ok'}`}>双线圈 <b>{analysis.doubleCoilCount}</b></span>
          <span className={`xref-kpi${analysis.warningCount > 0 ? ' is-warn' : ''}`}>警告 <b>{analysis.warningCount}</b></span>
        </div>
      </div>
      <CrossRefDiagnosticsStrip analysis={analysis} onJumpToNetwork={onJumpToNetwork} theme="tia" />
      <CrossRefTable analysis={analysis} onJumpToNetwork={onJumpToNetwork} theme="tia" />
    </section>
  );
});

export const CrossRefSandboxPanel = memo<CrossRefPanelProps>(function CrossRefSandboxPanel({
  program, tagDefs, onJumpToNetwork,
}) {
  const [expanded, setExpanded] = useState(false);
  const analysis = useMemo(() => analyzeProgramCrossRef(program, tagDefs), [program, tagDefs]);
  const refCount = useMemo(() => analysis.entries.filter((e) => e.usages.length > 0).length, [analysis.entries]);

  return (
    <section className="plc-xref-sandbox" aria-label="沙盒静态体检与交叉引用">
      <div className="plc-xref-sb-head">
        <div className="plc-xref-sb-title">
          <Network size={15} aria-hidden />
          <strong>博途级静态体检 & 交叉引用 (F11)</strong>
          <span className="xref-kpi">已引用 {refCount} 项</span>
          {analysis.doubleCoilCount > 0
            ? <span className="xref-kpi is-error">双线圈冲突 ×{analysis.doubleCoilCount}</span>
            : <span className="xref-kpi is-ok">0 双线圈</span>}
          {analysis.warningCount > 0 && <span className="xref-kpi is-warn">地址警告 ×{analysis.warningCount}</span>}
        </div>
        <button type="button" className="plc-sim-mini-btn plc-xref-toggle-btn" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span>{expanded ? '收起交叉引用表' : '展开交叉引用表 (R/W 索引)'}</span>
        </button>
      </div>
      <CrossRefDiagnosticsStrip analysis={analysis} onJumpToNetwork={onJumpToNetwork} theme="instrument" />
      {expanded && (
        <div className="plc-xref-sb-drawer">
          <CrossRefTable analysis={analysis} onJumpToNetwork={onJumpToNetwork} theme="instrument" />
        </div>
      )}
    </section>
  );
});

export const CrossRefInspector = {
  Workbench: CrossRefWorkbenchPanel,
  Sandbox: CrossRefSandboxPanel,
  Diagnostics: CrossRefDiagnosticsStrip,
  Table: CrossRefTable,
};
