import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { findGlossaryTerm } from '../content/glossary';
import { useBackDismiss } from '../app/native/overlay';

interface TermProps {
  /** 词条名或别名，如 "PLC"、"常开" */
  name: string;
  /** 显示文字（默认与 name 相同） */
  children?: React.ReactNode;
}

/**
 * 行内术语：带虚线下划线，点按/回车弹出一句话解释，并可跳转术语表。
 * 找不到词条时退化为普通文字。
 */
export const Term: React.FC<TermProps> = ({ name, children }) => {
  const entry = findGlossaryTerm(name);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const popId = useId();
  const popRef = useRef<HTMLSpanElement | null>(null);
  const [shift, setShift] = useState(0);
  // 安卓返回键先关掉解释弹框，而不是直接离开课程页
  useBackDismiss(open, () => setOpen(false));

  // 弹出框贴近屏幕边缘时向内平移，避免被裁掉
  useLayoutEffect(() => {
    if (!open) {
      setShift(0);
      return;
    }
    const el = popRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    let dx = 0;
    if (r.left < margin) dx = margin - r.left;
    else if (r.right > window.innerWidth - margin) dx = window.innerWidth - margin - r.right;
    setShift(dx);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = children ?? name;
  if (!entry) return <>{label}</>;

  return (
    <span className="term-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`term-trigger${open ? ' open' : ''}`}
        aria-expanded={open}
        aria-controls={popId}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open && (
        <span
          className="term-pop"
          id={popId}
          role="tooltip"
          ref={popRef}
          style={shift ? { transform: `translateX(calc(-50% + ${shift}px))` } : undefined}
        >
          <span className="term-pop-title">
            {entry.term}
            {entry.en && <span className="term-pop-en">{entry.en}</span>}
          </span>
          <span className="term-pop-body">{entry.short}</span>
          <Link
            to={`/glossary?term=${encodeURIComponent(entry.id)}`}
            className="term-pop-link"
            onClick={() => setOpen(false)}
          >
            在术语表中查看 →
          </Link>
        </span>
      )}
    </span>
  );
};
