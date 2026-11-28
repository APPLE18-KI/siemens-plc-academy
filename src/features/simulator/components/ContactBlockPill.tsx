import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import type { TagDef } from '../../../types/plc';
import type { SandboxContactDraft, SandboxContactKind } from '../sandboxCodec';

const KIND_CYCLE: SandboxContactKind[] = ['NO', 'NC', 'P_TRIG', 'N_TRIG'];

const KIND_META: Record<
  SandboxContactKind,
  { glyph: string; name: string; tip: string; badgeClass: string }
> = {
  NO: { glyph: '-| |-', name: '常开 NO', tip: '为 1 时导通（点击切换为常闭）', badgeClass: 'k-no' },
  NC: { glyph: '-|/|-', name: '常闭 NC', tip: '为 0 时导通（点击切换为上升沿）', badgeClass: 'k-nc' },
  P_TRIG: { glyph: '-|P|-', name: '上升沿 P', tip: '0→1 瞬间导通 1 周期（点击切换下降沿）', badgeClass: 'k-edge' },
  N_TRIG: { glyph: '-|N|-', name: '下降沿 N', tip: '1→0 瞬间导通 1 周期（点击切换常开）', badgeClass: 'k-edge' },
};

interface ContactBlockPillProps {
  contact: SandboxContactDraft;
  tagDefs: TagDef[];
  canDelete: boolean;
  onChangeKind: (kind: SandboxContactKind) => void;
  onChangeTag: (tag: string) => void;
  onDelete: () => void;
}

export const ContactBlockPill: React.FC<ContactBlockPillProps> = ({
  contact,
  tagDefs,
  canDelete,
  onChangeKind,
  onChangeTag,
  onDelete,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [pickerOpen]);

  const meta = KIND_META[contact.kind];
  const currentDef = tagDefs.find((d) => d.name === contact.tag);
  const areaClass =
    currentDef?.area === 'I' ? 'area-i' : currentDef?.area === 'Q' ? 'area-q' : 'area-m';

  const cycleKind = () => {
    const idx = KIND_CYCLE.indexOf(contact.kind);
    onChangeKind(KIND_CYCLE[(idx + 1) % KIND_CYCLE.length]);
  };

  const groups: { title: string; area: 'I' | 'M' | 'Q'; items: TagDef[] }[] = [
    { title: '输入按钮/传感器 (%I)', area: 'I', items: tagDefs.filter((d) => d.area === 'I') },
    { title: '输出线圈反馈 (%Q)', area: 'Q', items: tagDefs.filter((d) => d.area === 'Q') },
    { title: '中间继电器 (%M)', area: 'M', items: tagDefs.filter((d) => d.area === 'M') },
  ];

  return (
    <div className="v32-contact-pill" ref={wrapRef}>
      <button
        type="button"
        className={`v32-sym-btn ${meta.badgeClass}`}
        onClick={cycleKind}
        title={meta.tip}
        aria-label={`${meta.name}，点击切换触点类型`}
      >
        <span className="v32-sym-glyph">{meta.glyph}</span>
        <span className="v32-sym-sub">{contact.kind === 'NO' ? '常开' : contact.kind === 'NC' ? '常闭' : contact.kind === 'P_TRIG' ? '上升沿' : '下降沿'}</span>
      </button>

      <button
        type="button"
        className={`v32-tag-btn ${areaClass}`}
        onClick={() => setPickerOpen((v) => !v)}
        aria-expanded={pickerOpen}
        title="点击选择变量地址"
      >
        <span className="v32-tag-addr">{currentDef?.address ?? ''}</span>
        <span className="v32-tag-name">{contact.tag}</span>
        <ChevronDown size={12} />
      </button>

      {canDelete && (
        <button
          type="button"
          className="v32-pill-del"
          onClick={onDelete}
          aria-label="删除触点"
          title="删除此触点"
        >
          <X size={13} />
        </button>
      )}

      {pickerOpen && (
        <div className="v32-tag-popover" role="dialog" aria-label="选择触点类型与地址">
          <div className="v32-pop-sec">
            <div className="v32-pop-label">触点类型</div>
            <div className="v32-pop-kinds">
              {KIND_CYCLE.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`v32-pop-kind-btn${contact.kind === k ? ' is-selected' : ''}`}
                  onClick={() => onChangeKind(k)}
                >
                  <code>{KIND_META[k].glyph}</code>
                  <span>{KIND_META[k].name}</span>
                </button>
              ))}
            </div>
          </div>

          {groups.map((g) => (
            <div key={g.area} className="v32-pop-sec">
              <div className="v32-pop-label">{g.title}</div>
              <div className="v32-pop-tags">
                {g.items.map((d) => (
                  <button
                    key={d.name}
                    type="button"
                    className={`v32-pop-tag-btn area-${g.area.toLowerCase()}${contact.tag === d.name ? ' is-selected' : ''}`}
                    onClick={() => {
                      onChangeTag(d.name);
                      setPickerOpen(false);
                    }}
                    title={d.comment}
                  >
                    <b>{d.address}</b>
                    <span>{d.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface QuickAddContactButtonProps {
  label: string;
  defaultTag: string;
  onAdd: (kind: SandboxContactKind, tag: string) => void;
}

export const QuickAddContactButton: React.FC<QuickAddContactButtonProps> = ({
  label,
  defaultTag,
  onAdd,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="v32-quick-add-wrap" ref={ref}>
      <button
        type="button"
        className="plc-sim-add-chip"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Plus size={12} /> {label}
      </button>
      {open && (
        <div className="v32-quick-add-pop">
          {KIND_CYCLE.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                onAdd(k, defaultTag);
                setOpen(false);
              }}
            >
              <code>{KIND_META[k].glyph}</code>
              <span>{KIND_META[k].name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
