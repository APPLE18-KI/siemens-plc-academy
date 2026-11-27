import React, { createContext, useContext, useState } from 'react';
import { BookMarked, ExternalLink, X } from 'lucide-react';
import { CITATIONS, SOURCE_DOCS } from '../content/sources';
import { useBackDismiss } from '../app/native/overlay';
import { haptic } from '../app/native/platform';

/**
 * 四级折叠（完整 / 精读 / 要点 / 结论）。
 * 思路来自 unfold（MIT）的 fold levels，它又受 TextFold（chenxiachan）启发：同一篇文字按“关键句”折叠成不同详略。
 * - 完整：全部内容，出处原文直接展开
 * - 精读：正常阅读（默认）
 * - 要点：只留作者标记的关键句（==…== 或加粗句）、代码与本讲骨架
 * - 结论：只留定义 / 结论（==!…== 与讲课板书里的关键结论）
 */
export type FoldLevel = 'full' | 'read' | 'points' | 'statements';

export const FOLD_LEVELS: { id: FoldLevel; label: string; hint: string }[] = [
  { id: 'full', label: '完整', hint: '全部内容，出处原文展开' },
  { id: 'read', label: '精读', hint: '正常阅读' },
  { id: 'points', label: '要点', hint: '只看关键句' },
  { id: 'statements', label: '结论', hint: '只看定义和结论' },
];

interface FoldCtx {
  level: FoldLevel;
  setLevel: (l: FoldLevel) => void;
  /** 本讲是否有显式 ==…== 标记（没有时用加粗句作为关键句） */
  explicitMarks: boolean;
}

export const FoldContext = createContext<FoldCtx>({ level: 'read', setLevel: () => undefined, explicitMarks: false });
export const useFold = () => useContext(FoldContext);

/* ───────── 关键句抽取 ───────── */

function cleanLines(md: string): string[] {
  const out: string[] = [];
  let inCode = false;
  for (const raw of md.replace(/\r\n/g, '\n').split('\n')) {
    const t = raw.trim();
    if (t.startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode || !t || t.startsWith('|') || /^#{1,6}\s/.test(t) || /^(-{3,}|\*{3,})$/.test(t)) continue;
    out.push(t.replace(/^([-*+•]|\d+[.)])\s+/, '').replace(/^>\s?/, ''));
  }
  return out;
}

export function splitSentences(md: string): string[] {
  const res: string[] = [];
  for (const line of cleanLines(md)) {
    // 不在 ==…== / **…** 内部断句
    let buf = '';
    let depthMark = false;
    let depthBold = false;
    for (let i = 0; i < line.length; i++) {
      const two = line.slice(i, i + 2);
      if (two === '==') {
        depthMark = !depthMark;
        buf += two;
        i++;
        continue;
      }
      if (two === '**') {
        depthBold = !depthBold;
        buf += two;
        i++;
        continue;
      }
      buf += line[i];
      if ('。！？；'.includes(line[i]) && !depthMark && !depthBold) {
        res.push(buf.trim());
        buf = '';
      }
    }
    if (buf.trim()) res.push(buf.trim());
  }
  return res.filter((s) => s.replace(/[\s:：]/g, '').length > 3);
}

export function hasExplicitMarks(md: string): boolean {
  return /==[^=]+==/.test(md);
}

export function pickKeys(md: string, mode: 'points' | 'statements', explicit: boolean): string[] {
  const s = splitSentences(md);
  if (mode === 'statements') return s.filter((x) => /==![^=]+==/.test(x));
  void explicit;
  return s.filter((x) => /==[^=]+==/.test(x) || /\*\*[^*]+\*\*/.test(x));
}

/* ───────── 出处引用 chip ───────── */

export const CiteChip: React.FC<{ id: string }> = ({ id }) => {
  const { level } = useFold();
  const [open, setOpen] = useState(false);
  useBackDismiss(open, () => setOpen(false));
  const c = CITATIONS[id];
  if (!c) return null;
  const doc = SOURCE_DOCS[c.doc];
  const short = c.doc === 's71200' ? '系统手册' : c.doc === 'plcsim' || c.doc === 'plcsimzh' ? 'PLCSIM 帮助' : c.doc === 'tiastatus' ? '博途文档' : 'FAQ';
  const label = `${short}${c.page ? ` p.${c.page}` : ''}`;

  if (level === 'full') {
    return (
      <span className="cite-inline" role="note">
        <span className="cite-inline-src">
          <BookMarked size={12} /> {doc.name.split('（')[0]} · {c.section}
          {c.page ? ` · 第 ${c.page} 页` : ''}
        </span>
        <q lang={c.doc === 'plcsimzh' ? 'zh' : 'en'}>{c.quote}</q>
        <span className="cite-inline-zh">{c.zh}</span>
      </span>
    );
  }
  return (
    <>
      <button
        type="button"
        className="cite-chip"
        onClick={(e) => {
          e.stopPropagation();
          haptic('tap');
          setOpen(true);
        }}
        aria-label={`查看出处：${doc.name} ${c.section}`}
      >
        <BookMarked size={11} />
        {label}
      </button>
      {open && (
        <div className="cite-sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="cite-sheet" role="dialog" aria-modal="true" aria-label="出处原文" onClick={(e) => e.stopPropagation()}>
            <div className="cite-sheet-grip" aria-hidden />
            <div className="cite-sheet-head">
              <span>出处原文</span>
              <button type="button" className="cite-sheet-x" onClick={() => setOpen(false)} aria-label="关闭">
                <X size={18} />
              </button>
            </div>
            <blockquote lang={c.doc === 'plcsimzh' ? 'zh' : 'en'} className="cite-quote">
              {c.quote}
            </blockquote>
            <p className="cite-zh">
              <b>中文：</b>
              {c.zh}
            </p>
            <dl className="cite-meta">
              <div>
                <dt>文档</dt>
                <dd>{doc.name}</dd>
              </div>
              <div>
                <dt>版本</dt>
                <dd>{doc.version}</dd>
              </div>
              <div>
                <dt>章节</dt>
                <dd>{c.section}</dd>
              </div>
              {c.page && (
                <div>
                  <dt>页码</dt>
                  <dd>第 {c.page} 页（PDF 页码与印刷页码相同）</dd>
                </div>
              )}
            </dl>
            <a className="cite-link" href={doc.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={13} /> 官方文档地址（需联网）
            </a>
            <p className="cite-note">摘录仅用于学习引用，版权归西门子公司所有；以官方最新版本为准。</p>
          </div>
        </div>
      )}
    </>
  );
};

export const FoldSwitch: React.FC = () => {
  const { level, setLevel } = useFold();
  return (
    <div className="fold-switch" role="radiogroup" aria-label="阅读详略">
      {FOLD_LEVELS.map((f) => (
        <button
          key={f.id}
          type="button"
          role="radio"
          aria-checked={level === f.id}
          className={level === f.id ? 'on' : ''}
          title={f.hint}
          onClick={() => {
            haptic('tap');
            setLevel(f.id);
          }}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
};
