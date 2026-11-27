import React, { useEffect, useRef, useState } from 'react';
import { Check, Clock, Copy, NotebookPen, Trash2, X } from 'lucide-react';
import { haptic } from '../../app/native/platform';
import {
  currentStamp,
  formatNoteTime,
  saveLessonNote,
  useLessonNotes,
} from './lessonNotes';

const TEMPLATES: { label: string; insert: string; title: string }[] = [
  { label: '%I0.0', insert: '%I0.0', title: '插入数字量输入地址 %I0.0' },
  { label: '%Q0.0', insert: '%Q0.0', title: '插入数字量输出地址 %Q0.0' },
  { label: '%M0.0', insert: '%M0.0', title: '插入标志位地址 %M0.0' },
  { label: '%MW10', insert: '%MW10', title: '插入字寄存器 %MW10' },
  { label: 'TON', insert: 'TON(IN:= , PT:=T#5s)', title: '插入接通延时定时器模板' },
  { label: 'NORM_X', insert: 'NORM_X(MIN:=0, VALUE:=%IW64, MAX:=27648)', title: '插入模拟量归一化模板' },
];

interface LessonNotesPanelProps {
  lessonId: string;
  lessonOrder: number;
  lessonTitle: string;
  open: boolean;
  onClose: () => void;
  onCopyCheatSheet: () => void;
  copied: boolean;
}

export const LessonNotesPanel: React.FC<LessonNotesPanelProps> = ({
  lessonId,
  lessonOrder,
  lessonTitle,
  open,
  onClose,
  onCopyCheatSheet,
  copied,
}) => {
  const allNotes = useLessonNotes();
  const saved = allNotes[lessonId];
  const [draft, setDraft] = useState(saved?.text ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftRef = useRef(draft);
  const lessonIdRef = useRef(lessonId);
  const dirtyRef = useRef(false);

  draftRef.current = draft;

  // 切换课时时先把上一讲未落盘的草稿立即保存，再加载新课时笔记
  useEffect(() => {
    if (lessonIdRef.current !== lessonId) {
      if (dirtyRef.current) {
        saveLessonNote(lessonIdRef.current, draftRef.current);
        dirtyRef.current = false;
      }
      lessonIdRef.current = lessonId;
    }
    const nextText = allNotes[lessonId]?.text ?? '';
    setDraft(nextText);
    setSaving(false);
    setConfirmClear(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  // 自动防抖保存（450ms）
  useEffect(() => {
    if (!dirtyRef.current) return;
    setSaving(true);
    const timer = window.setTimeout(() => {
      saveLessonNote(lessonId, draft);
      dirtyRef.current = false;
      setSaving(false);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [draft, lessonId]);

  // 卸载时兜底落盘，避免丢失最后几个字
  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        saveLessonNote(lessonIdRef.current, draftRef.current);
        dirtyRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const updateDraft = (next: string) => {
    dirtyRef.current = true;
    setDraft(next);
    setConfirmClear(false);
  };

  const insertAtCursor = (snippet: string) => {
    haptic('tap');
    const el = textareaRef.current;
    if (!el) {
      updateDraft(draft ? `${draft}\n${snippet}` : snippet);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const prefix = start > 0 && !/[\s\n]$/.test(draft.slice(0, start)) && !snippet.startsWith('[') ? ' ' : '';
    const next = `${draft.slice(0, start)}${prefix}${snippet}${draft.slice(end)}`;
    updateDraft(next);
    const caret = start + prefix.length + snippet.length;
    window.requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const handleClear = () => {
    if (!confirmClear) {
      haptic('tap');
      setConfirmClear(true);
      return;
    }
    haptic('tap');
    dirtyRef.current = false;
    setDraft('');
    saveLessonNote(lessonId, '');
    setSaving(false);
    setConfirmClear(false);
  };

  if (!open) return null;

  return (
    <aside
      className="v3-notes-drawer"
      role="region"
      aria-label={`第 ${lessonOrder} 讲随堂笔记`}
    >
      <div className="v3-notes-head">
        <div className="v3-notes-title">
          <NotebookPen size={16} aria-hidden />
          <div>
            <strong>本讲随堂笔记</strong>
            <span className="v3-notes-sub">
              第 {lessonOrder} 讲 · {lessonTitle}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="v3-notes-close press"
          onClick={() => {
            haptic('tap');
            onClose();
          }}
          aria-label="收起随堂笔记"
        >
          <X size={18} />
        </button>
      </div>

      <div className="v3-notes-chips" role="group" aria-label="快捷插入模板">
        <button
          type="button"
          className="v3-tpl-chip press"
          onClick={() => insertAtCursor(currentStamp())}
          title="在光标处插入当前时间"
        >
          <Clock size={12} aria-hidden />
          时间戳
        </button>
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.label}
            type="button"
            className="v3-tpl-chip is-mono press"
            onClick={() => insertAtCursor(tpl.insert)}
            title={tpl.title}
          >
            {tpl.label}
          </button>
        ))}
      </div>

      <textarea
        ref={textareaRef}
        className="v3-notes-input"
        value={draft}
        onChange={(e) => updateDraft(e.target.value)}
        placeholder="记下容易踩坑的接线、寄存器地址或博途设置，自动保存在本机…"
        rows={6}
        aria-label="随堂笔记正文"
      />

      <div className="v3-notes-foot">
        <span className="v3-notes-status" role="status" aria-live="polite">
          {saving
            ? '正在保存…'
            : saved
              ? `已自动保存 · ${formatNoteTime(saved.updatedAt)}（${draft.trim().length} 字）`
              : '仅存在本机，随时可合入速查卡'}
        </span>
        <div className="v3-notes-actions">
          {draft.trim().length > 0 && (
            <button
              type="button"
              className={`btn btn-sm press${confirmClear ? ' v3-btn-danger' : ''}`}
              onClick={handleClear}
            >
              <Trash2 size={13} aria-hidden />
              {confirmClear ? '确认清空' : '清空'}
            </button>
          )}
          <button type="button" className="btn btn-primary btn-sm press" onClick={onCopyCheatSheet}>
            {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
            {copied ? '已复制 Markdown' : '复制速查卡'}
          </button>
        </div>
      </div>
    </aside>
  );
};
