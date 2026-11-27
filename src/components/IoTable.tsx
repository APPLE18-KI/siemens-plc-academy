import React from 'react';
import { TableProperties } from 'lucide-react';
import type { TagArea, TagDef } from '../types/plc';

interface IoTableProps {
  title?: string;
  tags: TagDef[];
}

function inferArea(tag: TagDef): TagArea {
  if (tag.area) return tag.area;
  const addr = tag.address.trim().toUpperCase();
  if (addr.startsWith('%I') || addr.startsWith('I')) return 'I';
  if (addr.startsWith('%Q') || addr.startsWith('Q')) return 'Q';
  if (addr.startsWith('DB')) return 'DB';
  return 'M';
}

const AREA_META: Record<TagArea, { label: string; desc: string }> = {
  I: { label: '输入 I', desc: '过程映像输入' },
  Q: { label: '输出 Q', desc: '过程映像输出' },
  M: { label: '位存储 M', desc: '中间标志区' },
  DB: { label: '数据块 DB', desc: '背景/全局 DB' },
};

function formatInit(tag: TagDef): string {
  if (tag.init === undefined) return '—';
  if (typeof tag.init === 'boolean') return tag.init ? 'TRUE' : 'FALSE';
  return tag.unit ? `${tag.init} ${tag.unit}` : String(tag.init);
}

export const IoTable: React.FC<IoTableProps> = ({ title, tags }) => {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="io-table-card">
      <div className="io-table-head">
        <div className="io-table-title">
          <TableProperties size={16} color="var(--siemens-teal-bright)" />
          <span>{title || 'TIA Portal 标准 PLC 变量表 (PLC Tags)'}</span>
        </div>
        <span className="badge badge-mono">{tags.length} 个变量</span>
      </div>

      <div className="io-table-scroll">
        <table className="io-table">
          <thead>
            <tr>
              <th>符号名称 (Name)</th>
              <th>地址 (Address)</th>
              <th>存储区</th>
              <th>数据类型</th>
              <th>初始值 / 单位</th>
              <th>工程注释 (Comment)</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((tag, idx) => {
              const area = inferArea(tag);
              const meta = AREA_META[area];
              return (
                <tr key={`${tag.name}-${tag.address}-${idx}`}>
                  <td>
                    <span className="io-symbol">"{tag.name}"</span>
                  </td>
                  <td>
                    <span className={`io-addr-pill area-${area}`}>{tag.address}</span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--ink-muted)',
                        whiteSpace: 'nowrap',
                      }}
                      title={meta.desc}
                    >
                      {meta.label}
                    </span>
                  </td>
                  <td>
                    <span className="io-type-tag">{tag.type}</span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-secondary)' }}>
                    {formatInit(tag)}
                  </td>
                  <td style={{ color: 'var(--ink-secondary)', minWidth: 180 }}>
                    {tag.comment || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
