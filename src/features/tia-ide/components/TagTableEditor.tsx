import React, { useMemo, useState } from 'react';
import { Plus, RotateCcw, Search, Table2, Trash2 } from 'lucide-react';
import type { TagArea, TagDataType, TagDef, TagValue } from '../../../types/plc';
import { formatPlcValue } from '../../../core/scl';
import { haptic } from '../../../app/native/platform';
import { showToast } from '../../../app/native/useNativeBridge';

export interface TagTableEditorProps {
  tagDefs: TagDef[];
  liveTags: Record<string, TagValue>;
  monitoring: boolean;
  onUpdateTagDefs: (next: TagDef[]) => void;
  onResetDefaultTags: () => void;
}

function inferAreaFromAddress(address: string): TagArea {
  const upper = address.trim().toUpperCase();
  if (upper.startsWith('%I') || upper.startsWith('I')) return 'I';
  if (upper.startsWith('%Q') || upper.startsWith('Q')) return 'Q';
  if (upper.startsWith('DB')) return 'DB';
  return 'M';
}

export const TagTableEditor: React.FC<TagTableEditorProps> = ({
  tagDefs,
  liveTags,
  monitoring,
  onUpdateTagDefs,
  onResetDefaultTags,
}) => {
  const [areaFilter, setAreaFilter] = useState<'ALL' | TagArea>('ALL');
  const [search, setSearch] = useState('');

  // Add new tag form state
  const [newName, setNewName] = useState('');
  const [newAddr, setNewAddr] = useState('%M0.5');
  const [newType, setNewType] = useState<TagDataType>('Bool');
  const [newInit, setNewInit] = useState('FALSE');
  const [newComment, setNewComment] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tagDefs.filter((t) => {
      const area = t.area ?? inferAreaFromAddress(t.address);
      if (areaFilter !== 'ALL' && area !== areaFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q) ||
        (t.comment ?? '').toLowerCase().includes(q)
      );
    });
  }, [tagDefs, areaFilter, search]);

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim().replace(/^["']|["']$/g, '');
    const cleanAddr = newAddr.trim().toUpperCase();
    if (!cleanName) {
      showToast('请输入变量符号名（如 Auto_Flag）');
      return;
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(cleanName)) {
      showToast('符号名仅支持字母、数字与下划线，且不能数字开头');
      return;
    }
    if (tagDefs.some((t) => t.name.toLowerCase() === cleanName.toLowerCase())) {
      showToast(`变量 "${cleanName}" 已存在`);
      return;
    }
    if (!cleanAddr) {
      showToast('请输入标准地址（如 %M0.5 或 %MW20）');
      return;
    }

    let initVal: TagValue = false;
    if (newType === 'Bool') {
      initVal = newInit.trim().toUpperCase() === 'TRUE' || newInit.trim() === '1';
    } else {
      const num = Number(newInit);
      initVal = Number.isFinite(num) ? num : 0;
    }

    const nextTag: TagDef = {
      name: cleanName,
      address: cleanAddr.startsWith('%') || cleanAddr.startsWith('DB') ? cleanAddr : `%${cleanAddr}`,
      type: newType,
      area: inferAreaFromAddress(cleanAddr),
      init: initVal,
      comment: newComment.trim() || '学员自定义变量',
    };

    haptic('success');
    onUpdateTagDefs([...tagDefs, nextTag]);
    showToast(`已新增 PLC 变量 "${cleanName}" (${nextTag.address})`);
    setNewName('');
    setNewComment('');
  };

  const handleDeleteTag = (name: string) => {
    haptic('tap');
    onUpdateTagDefs(tagDefs.filter((t) => t.name !== name));
    showToast(`已删除变量 "${name}"`);
  };

  const applyQuickPreset = (preset: 'bool' | 'int' | 'real') => {
    haptic('tap');
    if (preset === 'bool') {
      const nextBit = tagDefs.filter((t) => t.address.startsWith('%M0.')).length;
      setNewName(`User_Flag${nextBit + 1}`);
      setNewAddr(`%M0.${Math.min(7, nextBit)}`);
      setNewType('Bool');
      setNewInit('FALSE');
      setNewComment('自定义中间标志位');
    } else if (preset === 'int') {
      const nextWord = 20 + tagDefs.filter((t) => t.address.startsWith('%MW')).length * 2;
      setNewName(`Count_${nextWord}`);
      setNewAddr(`%MW${nextWord}`);
      setNewType('Int');
      setNewInit('0');
      setNewComment('自定义整数计数/步序');
    } else {
      const nextDWord = 40 + tagDefs.filter((t) => t.address.startsWith('%MD')).length * 4;
      setNewName(`Setpoint_${nextDWord}`);
      setNewAddr(`%MD${nextDWord}`);
      setNewType('Real');
      setNewInit('50.0');
      setNewComment('自定义工程量实数设定值');
    }
  };

  return (
    <div className="tia-table-view">
      {/* Toolbar */}
      <div className="tia-table-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Table2 size={15} color="#fbbf24" />
            默认变量表 (PLC Tags)
          </strong>
          <div style={{ display: 'inline-flex', gap: 4 }}>
            {(['ALL', 'I', 'Q', 'M', 'DB'] as const).map((a) => (
              <button
                key={a}
                type="button"
                className={`tia-btn tia-btn--sm ${areaFilter === a ? 'tia-btn--primary' : ''}`}
                onClick={() => setAreaFilter(a)}
              >
                {a === 'ALL' ? '全部' : a}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <Search size={13} style={{ position: 'absolute', left: 8, color: 'var(--ink-muted)' }} />
            <input
              type="text"
              className="tia-input"
              placeholder="搜索符号/地址/注释..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 26, width: 165 }}
            />
          </div>
          <button
            type="button"
            className="tia-btn tia-btn--sm"
            onClick={() => {
              haptic('tap');
              onResetDefaultTags();
            }}
            title="恢复当前模板标准变量表"
          >
            <RotateCcw size={12} /> 恢复标准表
          </button>
        </div>
      </div>

      {/* Add Custom Tag Bar */}
      <form className="tia-add-tag-form" onSubmit={handleAddTag}>
        <input
          type="text"
          className="tia-input"
          placeholder="符号名 (如 Auto_Flag)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          aria-label="新变量符号名"
        />
        <input
          type="text"
          className="tia-input"
          placeholder="地址 (如 %M0.5)"
          value={newAddr}
          onChange={(e) => setNewAddr(e.target.value)}
          style={{ fontFamily: 'var(--font-mono)' }}
          aria-label="新变量地址"
        />
        <select
          className="tia-input"
          value={newType}
          onChange={(e) => {
            const nextT = e.target.value as TagDataType;
            setNewType(nextT);
            setNewInit(nextT === 'Bool' ? 'FALSE' : '0');
          }}
          aria-label="新变量数据类型"
        >
          <option value="Bool">Bool</option>
          <option value="Int">Int</option>
          <option value="Real">Real</option>
          <option value="Time">Time</option>
        </select>
        <input
          type="text"
          className="tia-input"
          placeholder="初始值"
          value={newInit}
          onChange={(e) => setNewInit(e.target.value)}
          style={{ fontFamily: 'var(--font-mono)' }}
          aria-label="新变量初始值"
        />
        <input
          type="text"
          className="tia-input"
          placeholder="变量注释（可选）"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          aria-label="新变量注释"
        />
        <button type="submit" className="tia-btn tia-btn--primary tia-btn--sm">
          <Plus size={14} /> 新增变量
        </button>
      </form>

      {/* Quick Presets Hint */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: 'var(--bg-surface-2)',
          borderBottom: '1px solid var(--border-hairline)',
          fontSize: 11.5,
          color: 'var(--ink-muted)',
          flexWrap: 'wrap',
        }}
      >
        <span>快捷填表：</span>
        <button type="button" className="tia-btn tia-btn--sm" onClick={() => applyQuickPreset('bool')}>
          + %M Bool 标志
        </button>
        <button type="button" className="tia-btn tia-btn--sm" onClick={() => applyQuickPreset('int')}>
          + %MW Int 计数
        </button>
        <button type="button" className="tia-btn tia-btn--sm" onClick={() => applyQuickPreset('real')}>
          + %MD Real 实数
        </button>
        <span style={{ marginLeft: 'auto' }}>
          共 <strong>{filtered.length}</strong> / {tagDefs.length} 项
        </span>
      </div>

      {/* Tag Table */}
      <div className="tia-table-scroll">
        <table className="tia-table">
          <thead>
            <tr>
              <th>符号名 (Name)</th>
              <th>地址 (Address)</th>
              <th>类型</th>
              <th>初始值</th>
              {monitoring && <th>在线监控值</th>}
              <th>注释 (Comment)</th>
              <th style={{ width: 52, textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tag) => {
              const area = tag.area ?? inferAreaFromAddress(tag.address);
              const liveVal = liveTags[tag.name];
              const isBool = typeof liveVal === 'boolean';
              return (
                <tr key={tag.name}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--siemens-teal-bright)' }}>
                    &quot;{tag.name}&quot;
                  </td>
                  <td>
                    <span className={`tia-addr-chip area-${area}`}>{tag.address}</span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--info-cyan)' }}>
                    {tag.type}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-muted)' }}>
                    {tag.init !== undefined ? formatPlcValue(tag.init, tag.type) : '-'}
                  </td>
                  {monitoring && (
                    <td>
                      {liveVal !== undefined ? (
                        <span className={`tia-live-val ${isBool ? (liveVal ? 'is-true' : '') : 'is-num'}`}>
                          {formatPlcValue(liveVal, tag.type)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-muted)', fontSize: 11 }}>--</span>
                      )}
                    </td>
                  )}
                  <td style={{ color: 'var(--ink-secondary)', fontSize: 12 }}>{tag.comment ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="tia-tree-collapse-btn"
                      onClick={() => handleDeleteTag(tag.name)}
                      title={`删除变量 "${tag.name}"`}
                      aria-label={`删除变量 ${tag.name}`}
                    >
                      <Trash2 size={13} color="var(--fault-red)" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={monitoring ? 7 : 6} style={{ textAlign: 'center', padding: 24, color: 'var(--ink-muted)' }}>
                  没有匹配的 PLC 变量，可在上方表单新增自定义变量。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
