import React, { useState } from 'react';
import { Check, Code2, Copy } from 'lucide-react';
import type { TagValue } from '../../../types/plc';

interface SclCodePanelProps {
  code: string;
  tags: Record<string, TagValue>;
  title?: string;
  compact?: boolean;
}

const SCL_KEYWORDS = new Set([
  'REGION',
  'END_REGION',
  'IF',
  'THEN',
  'ELSIF',
  'ELSE',
  'END_IF',
  'CASE',
  'OF',
  'END_CASE',
  'AND',
  'OR',
  'NOT',
  'XOR',
  'TRUE',
  'FALSE',
  'NORM_X',
  'SCALE_X',
  'MIN',
  'MAX',
  'VALUE',
  'IN',
  'PT',
  'ET',
  'CU',
  'CD',
  'PV',
  'CV',
  'CLK',
  'R_TRIG',
  'F_TRIG',
]);

function renderSclLine(line: string, lineIdx: number, tags: Record<string, TagValue>) {
  const commentIdx = line.indexOf('//');
  const codePart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
  const commentPart = commentIdx >= 0 ? line.slice(commentIdx) : '';

  const tokens: React.ReactNode[] = [];
  const regex = /("[^"]+"|T#[0-9a-zA-Z_]+|:=|=>|<=|>=|\b[A-Za-z_][A-Za-z0-9_]*\b|\b\d+(?:\.\d+)?\b)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let tokIdx = 0;

  while ((match = regex.exec(codePart)) !== null) {
    if (match.index > lastIdx) {
      tokens.push(codePart.slice(lastIdx, match.index));
    }
    const raw = match[0];
    tokIdx += 1;

    if (raw.startsWith('"') && raw.endsWith('"')) {
      const sym = raw.slice(1, -1);
      const val = tags[sym];
      const isOn = typeof val === 'boolean' ? val : false;
      tokens.push(
        <span
          key={`${lineIdx}-${tokIdx}`}
          className={`plc-scl-sym ${isOn ? 'is-live-true' : ''}`}
          title={val !== undefined ? `${sym} = ${String(val)}` : sym}
        >
          {raw}
        </span>
      );
    } else if (raw.startsWith('T#')) {
      tokens.push(
        <span key={`${lineIdx}-${tokIdx}`} className="plc-scl-time">
          {raw}
        </span>
      );
    } else if (raw === ':=' || raw === '=>' || raw === '<=' || raw === '>=') {
      tokens.push(
        <span key={`${lineIdx}-${tokIdx}`} className="plc-scl-op">
          {raw}
        </span>
      );
    } else if (SCL_KEYWORDS.has(raw)) {
      tokens.push(
        <span key={`${lineIdx}-${tokIdx}`} className="plc-scl-kw">
          {raw}
        </span>
      );
    } else if (/^\d/.test(raw)) {
      tokens.push(
        <span key={`${lineIdx}-${tokIdx}`} className="plc-scl-num">
          {raw}
        </span>
      );
    } else {
      tokens.push(raw);
    }

    lastIdx = match.index + raw.length;
  }

  if (lastIdx < codePart.length) {
    tokens.push(codePart.slice(lastIdx));
  }

  if (commentPart) {
    tokens.push(
      <span key={`${lineIdx}-c`} className="plc-scl-comment">
        {commentPart}
      </span>
    );
  }

  return tokens;
}

export const SclCodePanel: React.FC<SclCodePanelProps> = ({
  code,
  tags,
  title = '同步西门子 S7-1200 SCL 等效代码',
  compact = false,
}) => {
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored safely
    }
  };

  return (
    <div className={`plc-sim-scl ${compact ? 'is-compact' : ''}`}>
      <div className="plc-sim-dock-head">
        <div className="plc-sim-dock-title">
          <Code2 size={14} />
          <span>{title}</span>
          <span className="plc-sim-trace-meta">绿色高亮 = 当前为 TRUE</span>
        </div>
        <div className="plc-sim-dock-actions">
          <button type="button" className="plc-sim-mini-btn" onClick={handleCopy}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? '已复制' : '复制 SCL'}
          </button>
        </div>
      </div>

      <pre className="plc-sim-scl-pre">
        <code>
          {lines.map((line, i) => (
            <div key={i} className="plc-sim-scl-line">
              <span className="plc-sim-scl-ln">{String(i + 1).padStart(2, ' ')}</span>
              <span className="plc-sim-scl-code">{renderSclLine(line, i, tags)}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
};
