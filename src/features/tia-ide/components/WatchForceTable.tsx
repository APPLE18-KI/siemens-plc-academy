import React, { useMemo, useState } from 'react';
import { Cpu, Gauge, ShieldAlert, ShieldOff, Zap } from 'lucide-react';
import type { TagArea, TagDef, TagValue } from '../../../types/plc';
import type { SclBlockInstanceState } from '../../../core/scl/types';
import { formatPlcValue } from '../../../core/scl';
import { haptic } from '../../../app/native/platform';
import { showToast } from '../../../app/native/useNativeBridge';

export interface WatchForceTableProps {
  tagDefs: TagDef[];
  liveTags: Record<string, TagValue>;
  forcedTags: Record<string, TagValue>;
  instances: Record<string, SclBlockInstanceState>;
  onModifyTag: (name: string, value: TagValue) => void;
  onSetForcedTag: (name: string, value: TagValue | null) => void;
  onClearAllForces: () => void;
}

function getArea(tag: TagDef): TagArea {
  if (tag.area) return tag.area;
  const u = tag.address.toUpperCase();
  if (u.startsWith('%I')) return 'I';
  if (u.startsWith('%Q')) return 'Q';
  if (u.startsWith('DB')) return 'DB';
  return 'M';
}

export const WatchForceTable: React.FC<WatchForceTableProps> = ({
  tagDefs,
  liveTags,
  forcedTags,
  instances,
  onModifyTag,
  onSetForcedTag,
  onClearAllForces,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'I' | 'Q' | 'M' | 'FORCED'>('ALL');
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  // Merge declared tagDefs + any runtime local #variables present in liveTags
  const allRows = useMemo(() => {
    const known = new Set(tagDefs.map((t) => t.name));
    const extras: TagDef[] = Object.keys(liveTags)
      .filter((k) => !known.has(k) && !k.startsWith('%'))
      .map((k) => {
        const val = liveTags[k];
        return {
          name: k,
          address: k.startsWith('#') ? 'TEMP/STAT' : 'LOCAL',
          type: typeof val === 'boolean' ? 'Bool' : Number.isInteger(val) ? 'Int' : 'Real',
          area: 'DB' as TagArea,
          comment: 'SCL 程序局部/静态保持变量',
        };
      });
    return [...tagDefs, ...extras];
  }, [tagDefs, liveTags]);

  const filteredRows = useMemo(() => {
    return allRows.filter((tag) => {
      const isForced = Object.prototype.hasOwnProperty.call(forcedTags, tag.name);
      if (filter === 'FORCED') return isForced;
      if (filter === 'ALL') return true;
      return getArea(tag) === filter;
    });
  }, [allRows, forcedTags, filter]);

  const activeForceCount = Object.keys(forcedTags).length;
  const instanceList = Object.values(instances);

  const parseNumericInput = (tag: TagDef, raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    return tag.type === 'Int' || tag.type === 'Time' ? Math.round(n) : n;
  };

  return (
    <div className="tia-table-view">
      {/* Header Toolbar */}
      <div className="tia-table-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Gauge size={15} color="#10b981" />
            监控与强制表 (Watch &amp; Force)
          </strong>
          <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
            {(
              [
                { id: 'ALL', label: '全部' },
                { id: 'I', label: '输入 %I' },
                { id: 'Q', label: '输出 %Q' },
                { id: 'M', label: '中间 %M' },
                { id: 'FORCED', label: `已强制 F (${activeForceCount})` },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                className={`tia-btn tia-btn--sm ${filter === f.id ? 'tia-btn--primary' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="tia-btn tia-btn--sm"
          disabled={activeForceCount === 0}
          onClick={() => {
            haptic('press');
            onClearAllForces();
            showToast('已解除全部变量强制 (F)');
          }}
          style={
            activeForceCount > 0
              ? {
                  background: '#facc15',
                  borderColor: '#eab308',
                  color: '#422006',
                  fontWeight: 800,
                }
              : undefined
          }
        >
          <ShieldOff size={13} />
          <span>全部取消强制</span>
        </button>
      </div>

      {/* Explanatory Tip */}
      <div
        style={{
          padding: '6px 12px',
          background: 'var(--bg-surface-2)',
          borderBottom: '1px solid var(--border-hairline)',
          fontSize: 11.5,
          color: 'var(--ink-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <span>
          <strong style={{ color: 'var(--info-cyan)' }}>修改瞬时值</strong>：单次写入当前扫描周期（可能被程序或传感器下周期覆盖）；
        </span>
        <span>
          <span className="tia-force-badge" style={{ width: 17, height: 17, fontSize: 10, marginRight: 4 }}>
            F
          </span>
          <strong style={{ color: 'var(--alarm-amber)' }}>强制表</strong>：每周期强行锁定 I/O 映像值，用于现场传感器故障排查与单动测试！
        </span>
      </div>

      {/* Main Watch/Force Table */}
      <div className="tia-table-scroll">
        <table className="tia-table">
          <thead>
            <tr>
              <th style={{ width: 42, textAlign: 'center' }}>强制</th>
              <th>符号 / 地址</th>
              <th>监控值</th>
              <th>修改瞬时值 (Modify)</th>
              <th>博途强制 (Force F)</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((tag) => {
              const area = getArea(tag);
              const val = liveTags[tag.name] ?? tag.init ?? (tag.type === 'Bool' ? false : 0);
              const isForced = Object.prototype.hasOwnProperty.call(forcedTags, tag.name);
              const forcedVal = forcedTags[tag.name];
              const isBool = tag.type === 'Bool' || typeof val === 'boolean';
              const draft = draftValues[tag.name] ?? String(typeof val === 'number' ? val : 0);

              return (
                <tr key={tag.name} className={isForced ? 'is-forced' : ''}>
                  <td style={{ textAlign: 'center' }}>
                    {isForced ? (
                      <span className="tia-force-badge" title={`已强制为 ${formatPlcValue(forcedVal, tag.type)}`}>
                        F
                      </span>
                    ) : (
                      <span style={{ color: 'var(--ink-muted)', fontSize: 11 }}>·</span>
                    )}
                  </td>

                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {tag.name.startsWith('#') ? tag.name : `"${tag.name}"`}
                      </strong>
                      <span className={`tia-addr-chip area-${area}`} style={{ fontSize: 10.5 }}>
                        {tag.address}
                      </span>
                    </div>
                    {tag.comment && (
                      <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}>{tag.comment}</div>
                    )}
                  </td>

                  <td>
                    <span className={`tia-live-val ${isBool ? (val ? 'is-true' : '') : 'is-num'}`}>
                      {formatPlcValue(val, tag.type)}
                    </span>
                  </td>

                  <td>
                    {isBool ? (
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <button
                          type="button"
                          className="tia-btn tia-btn--sm"
                          onClick={() => {
                            haptic('tap');
                            onModifyTag(tag.name, true);
                          }}
                        >
                          置 1
                        </button>
                        <button
                          type="button"
                          className="tia-btn tia-btn--sm"
                          onClick={() => {
                            haptic('tap');
                            onModifyTag(tag.name, false);
                          }}
                        >
                          复 0
                        </button>
                        <button
                          type="button"
                          className="tia-btn tia-btn--sm"
                          onClick={() => {
                            haptic('tap');
                            onModifyTag(tag.name, !Boolean(val));
                          }}
                          title="瞬时取反"
                        >
                          <Zap size={11} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number"
                          className="tia-input"
                          value={draft}
                          onChange={(e) =>
                            setDraftValues((prev) => ({ ...prev, [tag.name]: e.target.value }))
                          }
                          style={{ width: 84, minHeight: 28, padding: '2px 6px', fontFamily: 'var(--font-mono)' }}
                        />
                        <button
                          type="button"
                          className="tia-btn tia-btn--sm"
                          onClick={() => {
                            const parsed = parseNumericInput(tag, draft);
                            if (parsed === null) return;
                            haptic('tap');
                            onModifyTag(tag.name, parsed);
                          }}
                        >
                          写入
                        </button>
                      </div>
                    )}
                  </td>

                  <td>
                    {isBool ? (
                      <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="tia-btn tia-btn--sm"
                          style={
                            isForced && forcedVal === true
                              ? { background: '#facc15', borderColor: '#eab308', color: '#422006' }
                              : undefined
                          }
                          onClick={() => {
                            haptic('press');
                            onSetForcedTag(tag.name, isForced && forcedVal === true ? null : true);
                          }}
                        >
                          F=1
                        </button>
                        <button
                          type="button"
                          className="tia-btn tia-btn--sm"
                          style={
                            isForced && forcedVal === false
                              ? { background: '#facc15', borderColor: '#eab308', color: '#422006' }
                              : undefined
                          }
                          onClick={() => {
                            haptic('press');
                            onSetForcedTag(tag.name, isForced && forcedVal === false ? null : false);
                          }}
                        >
                          F=0
                        </button>
                        {isForced && (
                          <button
                            type="button"
                            className="tia-btn tia-btn--sm"
                            onClick={() => {
                              haptic('tap');
                              onSetForcedTag(tag.name, null);
                            }}
                          >
                            解除
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          className="tia-btn tia-btn--sm"
                          style={
                            isForced
                              ? { background: '#facc15', borderColor: '#eab308', color: '#422006' }
                              : undefined
                          }
                          onClick={() => {
                            const parsed = parseNumericInput(tag, draft);
                            if (parsed === null) return;
                            haptic('press');
                            onSetForcedTag(tag.name, parsed);
                          }}
                        >
                          <ShieldAlert size={11} /> 强制={draft}
                        </button>
                        {isForced && (
                          <button
                            type="button"
                            className="tia-btn tia-btn--sm"
                            onClick={() => {
                              haptic('tap');
                              onSetForcedTag(tag.name, null);
                            }}
                          >
                            解除
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* FB Background Instances Section */}
        <div
          style={{
            padding: '12px',
            borderTop: '1px solid var(--border-medium)',
            background: 'var(--bg-surface-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
            <Cpu size={14} color="#a78bfa" />
            <span>定时器 / 计数器 / 边沿检测背景数据块监控 ({instanceList.length})</span>
          </div>
          {instanceList.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
              当前运行的 OB1 程序中无背景实例数据（运行含 <code>TON / TOF / CTU / R_TRIG</code> 的程序后自动显示）。
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {instanceList.map((inst) => (
                <div
                  key={inst.name}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-hairline)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--db-violet)' }}>
                      #{inst.name}
                    </strong>
                    <span className="tia-tree-badge">{inst.kind}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
                    {Object.entries(inst.fields).map(([field, fval]) => (
                      <span
                        key={field}
                        style={{
                          color: field === 'Q' && fval ? 'var(--power-green)' : 'var(--ink-secondary)',
                          fontWeight: field === 'Q' ? 700 : 500,
                        }}
                      >
                        {field}: {formatPlcValue(fval, field === 'ET' || field === 'PT' ? 'Time' : undefined)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
