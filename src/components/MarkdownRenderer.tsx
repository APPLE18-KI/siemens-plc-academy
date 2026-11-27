import React from 'react';
import { CodeViewer } from './CodeViewer';
import { Term } from './Term';
import { CiteChip } from './fold';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const PLC_ADDRESS_PATTERN =
  /^(%[IQM][BWD]?[0-9]+(\.[0-7])?|DB\d+\.DB[XBWD]\d+(\.[0-7])?|OB\d+|FB\d+|FC\d+|T#\d+(ms|s|m|h))$/i;

/**
 * Render inline markdown safely into React nodes:
 * Supports `code`, **bold**, __bold__, *italic*, ~~strike~~, [link](href), [[术语]] glossary terms.
 */
export function renderInline(text: string, keyPrefix = 'inl'): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Combined tokenizer ordered by specificity
  const tokenRegex =
    /(`[^`]+`|\[\^[\w-]+\]|==!?[^=\s][^=]*?==|\[\[[^\]]+\]\]|\*\*[^*]+?\*\*|__[^_]+?__|~~[^~]+?~~|\*[^*\n]+?\*|\[[^\]]+\]\([^)]+\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const raw = match[0];
    const key = `${keyPrefix}-${idx++}`;

    if (raw.startsWith('[^') && raw.endsWith(']')) {
      nodes.push(<CiteChip key={key} id={raw.slice(2, -1)} />);
    } else if (raw.startsWith('==') && raw.endsWith('==')) {
      const stmt = raw.startsWith('==!');
      nodes.push(
        <mark key={key} className={stmt ? 'k-stmt' : 'k-sent'}>
          {renderInline(raw.slice(stmt ? 3 : 2, -2), `${key}-k`)}
        </mark>
      );
    } else if (raw.startsWith('[[') && raw.endsWith(']]')) {
      // [[词条]] 或 [[词条|显示文字]]
      const inner = raw.slice(2, -2);
      const [name, display] = inner.split('|');
      nodes.push(
        <Term key={key} name={name.trim()}>
          {(display ?? name).trim()}
        </Term>
      );
    } else if (raw.startsWith('`') && raw.endsWith('`')) {
      const code = raw.slice(1, -1);
      const isAddr = PLC_ADDRESS_PATTERN.test(code.trim());
      nodes.push(
        <code key={key} className={`md-inline-code${isAddr ? ' plc-addr' : ''}`}>
          {code}
        </code>
      );
    } else if (
      (raw.startsWith('**') && raw.endsWith('**')) ||
      (raw.startsWith('__') && raw.endsWith('__'))
    ) {
      nodes.push(<strong key={key}>{renderInline(raw.slice(2, -2), `${key}-b`)}</strong>);
    } else if (raw.startsWith('~~') && raw.endsWith('~~')) {
      nodes.push(<del key={key}>{renderInline(raw.slice(2, -2), `${key}-d`)}</del>);
    } else if (raw.startsWith('*') && raw.endsWith('*')) {
      nodes.push(<em key={key}>{renderInline(raw.slice(1, -1), `${key}-i`)}</em>);
    } else if (raw.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(raw);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        const safeHref = href.trim();
        const isExternal = /^https?:\/\//i.test(safeHref);
        nodes.push(
          <a
            key={key}
            href={safeHref}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
          >
            {renderInline(label, `${key}-a`)}
          </a>
        );
      } else {
        nodes.push(raw);
      }
    }

    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  const cells = trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
  return cells.length >= 1 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isSpecialLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (/^#{1,6}\s+/.test(t)) return true;
  if (/^```/.test(t)) return true;
  if (/^>\s?/.test(t)) return true;
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) return true;
  if (/^[-*+•]\s+/.test(t)) return true;
  if (/^\d+[.)]\s+/.test(t)) return true;
  return false;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  if (!content) return null;

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Blank line
    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code block ```lang
    if (trimmed.startsWith('```')) {
      const langRaw = trimmed.slice(3).trim().toLowerCase();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing ```
      const lang =
        langRaw === 'scl' || langRaw === 'lad' || langRaw === 'stl' ? langRaw : 'text';
      elements.push(
        <CodeViewer key={`md-code-${blockKey++}`} lang={lang} code={codeLines.join('\n')} />
      );
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      elements.push(<hr key={`md-hr-${blockKey++}`} className="md-hr" />);
      i++;
      continue;
    }

    // Headings # .. ####
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].replace(/\s+#+$/, '').trim();
      const key = `md-h-${blockKey++}`;
      const rendered = renderInline(text, key);
      if (level <= 2) {
        elements.push(<h2 key={key}>{rendered}</h2>);
      } else if (level === 3) {
        elements.push(<h3 key={key}>{rendered}</h3>);
      } else {
        elements.push(<h4 key={key}>{rendered}</h4>);
      }
      i++;
      continue;
    }

    // Markdown Table (header + separator + body rows)
    if (
      trimmed.includes('|') &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const headers = parseTableRow(lines[i]);
      i += 2; // skip header & separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        rows.push(parseTableRow(lines[i]));
        i++;
      }
      const key = `md-tbl-${blockKey++}`;
      elements.push(
        <div key={key} className="md-table-wrap">
          <table className="md-table">
            <thead>
              <tr>
                {headers.map((h, hIdx) => (
                  <th key={`${key}-th-${hIdx}`}>{renderInline(h, `${key}-th-${hIdx}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={`${key}-tr-${rIdx}`}>
                  {headers.map((_, cIdx) => (
                    <td key={`${key}-td-${rIdx}-${cIdx}`}>
                      {renderInline(row[cIdx] ?? '', `${key}-td-${rIdx}-${cIdx}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      const key = `md-bq-${blockKey++}`;
      elements.push(
        <blockquote key={key} className="md-blockquote">
          {quoteLines.map((ql, qIdx) => (
            <div key={`${key}-${qIdx}`}>{renderInline(ql, `${key}-${qIdx}`)}</div>
          ))}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (/^[-*+•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+•]\s+/, ''));
        i++;
      }
      const key = `md-ul-${blockKey++}`;
      elements.push(
        <ul key={key}>
          {items.map((item, idx) => (
            <li key={`${key}-${idx}`}>{renderInline(item, `${key}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i++;
      }
      const key = `md-ol-${blockKey++}`;
      elements.push(
        <ol key={key}>
          {items.map((item, idx) => (
            <li key={`${key}-${idx}`}>{renderInline(item, `${key}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Regular paragraph (consume contiguous non-special lines)
    const paraLines: string[] = [];
    while (i < lines.length && !isSpecialLine(lines[i])) {
      // Stop if next line starts a table
      if (
        lines[i].includes('|') &&
        i + 1 < lines.length &&
        isTableSeparator(lines[i + 1])
      ) {
        break;
      }
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      const key = `md-p-${blockKey++}`;
      elements.push(<p key={key}>{renderInline(paraLines.join(' '), key)}</p>);
    } else {
      // Safety advance to avoid infinite loop on edge characters
      const key = `md-raw-${blockKey++}`;
      elements.push(<p key={key}>{renderInline(trimmed, key)}</p>);
      i++;
    }
  }

  return <div className={`md-prose${className ? ` ${className}` : ''}`}>{elements}</div>;
};
