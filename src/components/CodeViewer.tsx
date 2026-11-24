import React, { useState } from 'react';
import { Check, Columns2, Copy, Code2 } from 'lucide-react';

type SingleLang = 'scl' | 'lad' | 'stl' | 'text';

interface SingleCodeProps {
  mode?: 'single';
  lang: SingleLang;
  title?: string;
  code: string;
  caption?: string;
}

interface DualCodeProps {
  mode: 'dual';
  title?: string;
  lad: string;
  scl: string;
  caption?: string;
  defaultView?: 'split' | 'lad' | 'scl';
}

export type CodeViewerProps = SingleCodeProps | DualCodeProps;

const SCL_KEYWORDS = new Set([
  'IF',
  'THEN',
  'ELSIF',
  'ELSE',
  'END_IF',
  'CASE',
  'OF',
  'END_CASE',
  'FOR',
  'TO',
  'BY',
  'DO',
  'END_FOR',
  'WHILE',
  'END_WHILE',
  'REPEAT',
  'UNTIL',
  'END_REPEAT',
  'REGION',
  'END_REGION',
  'FUNCTION_BLOCK',
  'END_FUNCTION_BLOCK',
  'FUNCTION',
  'END_FUNCTION',
  'ORGANIZATION_BLOCK',
  'END_ORGANIZATION_BLOCK',
  'DATA_BLOCK',
  'END_DATA_BLOCK',
  'TYPE',
  'END_TYPE',
  'STRUCT',
  'END_STRUCT',
  'VAR_INPUT',
  'VAR_OUTPUT',
  'VAR_IN_OUT',
  'VAR_TEMP',
  'VAR_STAT',
  'VAR',
  'END_VAR',
  'BEGIN',
  'RETURN',
  'EXIT',
  'CONTINUE',
  'AND',
  'OR',
  'XOR',
  'NOT',
  'MOD',
  'DIV',
  'TRUE',
  'FALSE',
  'TITLE',
  'VERSION',
]);

const SCL_TYPES = new Set([
  'BOOL',
  'BYTE',
  'WORD',
  'DWORD',
  'SINT',
  'USINT',
  'INT',
  'UINT',
  'DINT',
  'UDINT',
  'REAL',
  'LREAL',
  'TIME',
  'LTIME',
  'STRING',
  'WSTRING',
  'CHAR',
  'TON',
  'TOF',
  'TP',
  'TON_TIME',
  'TOF_TIME',
  'TP_TIME',
  'CTU',
  'CTD',
  'CTUD',
  'CTU_INT',
  'R_TRIG',
  'F_TRIG',
  'NORM_X',
  'SCALE_X',
  'PID_COMPACT',
  'IEC_TIMER',
  'IEC_COUNTER',
]);

function highlightSclLine(line: string, lineIdx: number): React.ReactNode {
  // Handle single-line // comment
  const commentPos = line.indexOf('//');
  const codePart = commentPos >= 0 ? line.slice(0, commentPos) : line;
  const commentPart = commentPos >= 0 ? line.slice(commentPos) : '';

  const tokens: React.ReactNode[] = [];
  const regex =
    /(\(\*.*?\*\)|"[^"]*"|'[^']*'|%[IQM][BWD]?[0-9]+(?:\.[0-7])?|T#[0-9]+(?:\.[0-9]+)?(?:ms|s|m|h|d)|16#[0-9A-Fa-f_]+|2#[01_]+|\b[A-Za-z_][A-Za-z0-9_]*\b|\b\d+(?:\.\d+)?\b|:=|=>|<>|<=|>=)/g;

  let last = 0;
  let match: RegExpExecArray | null;
  let tokIdx = 0;

  while ((match = regex.exec(codePart)) !== null) {
    if (match.index > last) {
      tokens.push(codePart.slice(last, match.index));
    }
    const raw = match[0];
    const k = `s-${lineIdx}-${tokIdx++}`;

    if (raw.startsWith('(*')) {
      tokens.push(
        <span key={k} className="tok-cmt">
          {raw}
        </span>
      );
    } else if (raw.startsWith('"')) {
      tokens.push(
        <span key={k} className="tok-sym">
          {raw}
        </span>
      );
    } else if (raw.startsWith("'")) {
      tokens.push(
        <span key={k} className="tok-sym">
          {raw}
        </span>
      );
    } else if (raw.startsWith('%') || /^T#/i.test(raw)) {
      tokens.push(
        <span key={k} className="tok-addr">
          {raw}
        </span>
      );
    } else if (/^(16#|2#|\d)/.test(raw)) {
      tokens.push(
        <span key={k} className="tok-num">
          {raw}
        </span>
      );
    } else if (raw === ':=' || raw === '=>' || raw === '<>' || raw === '<=' || raw === '>=') {
      tokens.push(
        <span key={k} className="tok-op">
          {raw}
        </span>
      );
    } else {
      const upper = raw.toUpperCase();
      if (SCL_KEYWORDS.has(upper)) {
        tokens.push(
          <span key={k} className="tok-kw">
            {raw}
          </span>
        );
      } else if (SCL_TYPES.has(upper)) {
        tokens.push(
          <span key={k} className="tok-type">
            {raw}
          </span>
        );
      } else {
        tokens.push(raw);
      }
    }
    last = match.index + raw.length;
  }

  if (last < codePart.length) {
    tokens.push(codePart.slice(last));
  }
  if (commentPart) {
    tokens.push(
      <span key={`sc-${lineIdx}`} className="tok-cmt">
        {commentPart}
      </span>
    );
  }
  return tokens;
}

function highlightLadLine(line: string, lineIdx: number): React.ReactNode {
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
    return <span className="tok-cmt">{line}</span>;
  }
  if (/^(Network|网络|NW)\s*\d+/i.test(trimmed)) {
    return <span className="tok-kw">{line}</span>;
  }

  const tokens: React.ReactNode[] = [];
  const regex =
    /(\/\/.*$|"[^"]*"|%[IQM][BWD]?[0-9]+(?:\.[0-7])?|T#[0-9]+(?:ms|s|m|h)|\([/SRPN\s]*\)|\|[\s/PN]*\||\[(?:TON|TOF|TP|CTU|CTD|NORM_X|SCALE_X|MOVE|CMP|ADD|SUB|MUL|DIV|SR|RS|P_TRIG|N_TRIG)[^\]]*\]|[│├└┌┐┘┤─═+]+|\|)/g;

  let last = 0;
  let match: RegExpExecArray | null;
  let tokIdx = 0;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > last) {
      tokens.push(line.slice(last, match.index));
    }
    const raw = match[0];
    const k = `l-${lineIdx}-${tokIdx++}`;

    if (raw.startsWith('//')) {
      tokens.push(
        <span key={k} className="tok-cmt">
          {raw}
        </span>
      );
    } else if (raw.startsWith('"')) {
      tokens.push(
        <span key={k} className="tok-sym">
          {raw}
        </span>
      );
    } else if (raw.startsWith('%') || /^T#/i.test(raw)) {
      tokens.push(
        <span key={k} className="tok-addr">
          {raw}
        </span>
      );
    } else if (raw.startsWith('(') && raw.endsWith(')')) {
      tokens.push(
        <span key={k} className="tok-coil">
          {raw}
        </span>
      );
    } else if (raw.startsWith('|') && raw.endsWith('|') && raw.length > 1) {
      tokens.push(
        <span key={k} className="tok-contact">
          {raw}
        </span>
      );
    } else if (raw.startsWith('[')) {
      tokens.push(
        <span key={k} className="tok-type">
          {raw}
        </span>
      );
    } else {
      tokens.push(
        <span key={k} className="tok-rail">
          {raw}
        </span>
      );
    }
    last = match.index + raw.length;
  }

  if (last < line.length) {
    tokens.push(line.slice(last));
  }
  return tokens;
}

function renderCodeLines(code: string, lang: SingleLang): React.ReactNode {
  const normalized = (code || '').replace(/\r\n/g, '\n').replace(/\n+$/, '');
  const lines = normalized.split('\n');
  return (
    <div className="code-scroll">
      <pre className="code-pre">
        {lines.map((line, idx) => (
          <div key={idx} className="code-line">
            <span className="code-ln">{idx + 1}</span>
            <span className="code-txt">
              {lang === 'scl' || lang === 'stl'
                ? highlightSclLine(line, idx)
                : lang === 'lad'
                  ? highlightLadLine(line, idx)
                  : line || ' '}
            </span>
          </div>
        ))}
      </pre>
    </div>
  );
}

const LANG_LABELS: Record<SingleLang, string> = {
  scl: 'SCL 结构化文本',
  lad: 'LAD 梯形图',
  stl: 'STL 语句表',
  text: 'TEXT 工程文本',
};

export const CodeViewer: React.FC<CodeViewerProps> = (props) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [dualView, setDualView] = useState<'split' | 'lad' | 'scl'>(
    props.mode === 'dual' ? (props.defaultView ?? 'split') : 'split'
  );

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 1800);
  };

  if (props.mode === 'dual') {
    const activeCopyText =
      dualView === 'lad'
        ? props.lad
        : dualView === 'scl'
          ? props.scl
          : `// === LAD 梯形图 ===\n${props.lad}\n\n// === SCL 结构化语言 ===\n${props.scl}`;

    return (
      <div className="code-card">
        <div className="code-card-head">
          <div className="code-card-title-group">
            <span className="code-lang-pill">LAD ⇄ SCL</span>
            <span className="code-card-title">{props.title || '梯形图与 SCL 双视图对照'}</span>
          </div>
          <div className="code-toolbar">
            <div className="code-mode-tabs" role="tablist" aria-label="代码视图切换">
              <button
                type="button"
                role="tab"
                aria-selected={dualView === 'split'}
                className={`code-mode-tab${dualView === 'split' ? ' active' : ''}`}
                onClick={() => setDualView('split')}
              >
                <Columns2 size={12} style={{ marginRight: 4, verticalAlign: '-1px' }} />
                并排对照
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={dualView === 'lad'}
                className={`code-mode-tab${dualView === 'lad' ? ' active' : ''}`}
                onClick={() => setDualView('lad')}
              >
                LAD
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={dualView === 'scl'}
                className={`code-mode-tab${dualView === 'scl' ? ' active' : ''}`}
                onClick={() => setDualView('scl')}
              >
                SCL
              </button>
            </div>
            <button
              type="button"
              className={`code-copy-btn${copiedKey === 'dual' ? ' copied' : ''}`}
              onClick={() => handleCopy(activeCopyText, 'dual')}
            >
              {copiedKey === 'dual' ? <Check size={13} /> : <Copy size={13} />}
              {copiedKey === 'dual' ? '已复制' : '复制'}
            </button>
          </div>
        </div>

        {dualView === 'split' ? (
          <div className="code-dual-grid">
            <div className="code-dual-pane">
              <div className="code-pane-subbar">
                <span>LAD · 梯形图逻辑 (Network)</span>
                <button
                  type="button"
                  className={`code-copy-btn${copiedKey === 'lad' ? ' copied' : ''}`}
                  style={{ padding: '2px 7px', fontSize: 11 }}
                  onClick={() => handleCopy(props.lad, 'lad')}
                >
                  {copiedKey === 'lad' ? '已复制' : '复制 LAD'}
                </button>
              </div>
              {renderCodeLines(props.lad, 'lad')}
            </div>
            <div className="code-dual-pane">
              <div className="code-pane-subbar">
                <span>SCL · 结构化控制语言 (TIA Portal)</span>
                <button
                  type="button"
                  className={`code-copy-btn${copiedKey === 'scl' ? ' copied' : ''}`}
                  style={{ padding: '2px 7px', fontSize: 11 }}
                  onClick={() => handleCopy(props.scl, 'scl')}
                >
                  {copiedKey === 'scl' ? '已复制' : '复制 SCL'}
                </button>
              </div>
              {renderCodeLines(props.scl, 'scl')}
            </div>
          </div>
        ) : dualView === 'lad' ? (
          renderCodeLines(props.lad, 'lad')
        ) : (
          renderCodeLines(props.scl, 'scl')
        )}

        {props.caption && <div className="code-caption">{props.caption}</div>}
      </div>
    );
  }

  return (
    <div className="code-card">
      <div className="code-card-head">
        <div className="code-card-title-group">
          <span className={`code-lang-pill${props.lang === 'lad' ? ' lad' : ''}`}>
            {LANG_LABELS[props.lang]}
          </span>
          {props.title && <span className="code-card-title">{props.title}</span>}
        </div>
        <div className="code-toolbar">
          <button
            type="button"
            className={`code-copy-btn${copiedKey === 'single' ? ' copied' : ''}`}
            onClick={() => handleCopy(props.code, 'single')}
          >
            {copiedKey === 'single' ? <Check size={13} /> : <Copy size={13} />}
            {copiedKey === 'single' ? '已复制' : '复制源码'}
          </button>
        </div>
      </div>

      {renderCodeLines(props.code, props.lang)}

      {props.caption && (
        <div className="code-caption">
          <Code2 size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />
          {props.caption}
        </div>
      )}
    </div>
  );
};
