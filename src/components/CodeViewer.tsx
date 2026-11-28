import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Code2, Columns2, Copy, HelpCircle, Link2, X } from 'lucide-react';
import { lookupCodeToken, type CodeTokenInfo } from './codeTokenHelp';

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
  'IF', 'THEN', 'ELSIF', 'ELSE', 'END_IF',
  'CASE', 'OF', 'END_CASE',
  'FOR', 'TO', 'BY', 'DO', 'END_FOR',
  'WHILE', 'END_WHILE', 'REPEAT', 'UNTIL', 'END_REPEAT',
  'REGION', 'END_REGION',
  'FUNCTION_BLOCK', 'END_FUNCTION_BLOCK',
  'FUNCTION', 'END_FUNCTION',
  'ORGANIZATION_BLOCK', 'END_ORGANIZATION_BLOCK',
  'DATA_BLOCK', 'END_DATA_BLOCK',
  'TYPE', 'END_TYPE', 'STRUCT', 'END_STRUCT',
  'VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT', 'VAR_TEMP', 'VAR_STAT', 'VAR', 'END_VAR',
  'BEGIN', 'RETURN', 'EXIT', 'CONTINUE',
  'AND', 'OR', 'XOR', 'NOT', 'MOD', 'DIV',
  'TRUE', 'FALSE', 'TITLE', 'VERSION',
]);

const SCL_TYPES = new Set([
  'BOOL', 'BYTE', 'WORD', 'DWORD', 'SINT', 'USINT', 'INT', 'UINT', 'DINT', 'UDINT',
  'REAL', 'LREAL', 'TIME', 'LTIME', 'STRING', 'WSTRING', 'CHAR',
  'TON', 'TOF', 'TP', 'TON_TIME', 'TOF_TIME', 'TP_TIME',
  'CTU', 'CTD', 'CTUD', 'CTU_INT', 'R_TRIG', 'F_TRIG',
  'NORM_X', 'SCALE_X', 'PID_COMPACT', 'IEC_TIMER', 'IEC_COUNTER',
]);

/** 从单行代码提取可用于 LAD ⇄ SCL 双栏匹配的语义锚点（符号名、绝对地址、关键指令） */
function extractSyncKeys(line: string): string[] {
  const keys = new Set<string>();
  const addrRe = /%[IQM][BWD]?\d+(?:\.\d)?/gi;
  for (const m of line.matchAll(addrRe)) keys.add(m[0].toUpperCase());

  const symRe = /"([^"]+)"|#([A-Za-z_][A-Za-z0-9_]*)/g;
  for (const m of line.matchAll(symRe)) {
    const raw = (m[1] || m[2] || '').trim().toLowerCase();
    if (raw.length >= 2) keys.add(`sym:${raw}`);
  }

  const instrRe = /\b(TON|TOF|TP|CTU|CTD|NORM_X|SCALE_X|PID_Compact|R_TRIG|F_TRIG|P_TRIG|N_TRIG|MOVE)\b/gi;
  for (const m of line.matchAll(instrRe)) keys.add(`op:${m[1].toUpperCase()}`);

  const nwRe = /(?:Network|网络|NW|程序段)\s*(\d+)/i;
  const nw = line.match(nwRe);
  if (nw) keys.add(`nw:${nw[1]}`);

  return Array.from(keys);
}

/** 按 Network / REGION / 空行把代码划分成逻辑块编号，便于无相同符号时仍能段对段联动 */
function assignLineGroups(lines: string[]): number[] {
  let group = 0;
  let seenContent = false;
  return lines.map((raw) => {
    const t = raw.trim();
    if (!t) {
      if (seenContent) group += 1;
      seenContent = false;
      return -1;
    }
    if (/^(?:\/\/\s*)?(?:Network|网络|NW|程序段|REGION)\b/i.test(t) && seenContent) {
      group += 1;
    }
    seenContent = true;
    return group;
  });
}

function findSyncedLines(
  sourceLines: string[],
  sourceGroups: number[],
  targetLines: string[],
  targetGroups: number[],
  activeLineIdx: number,
): number[] {
  const srcLine = sourceLines[activeLineIdx];
  if (!srcLine || !srcLine.trim()) return [];
  const srcKeys = extractSyncKeys(srcLine);
  const matched = new Set<number>();

  if (srcKeys.length > 0) {
    targetLines.forEach((tLine, tIdx) => {
      const tKeys = extractSyncKeys(tLine);
      if (tKeys.some((k) => srcKeys.includes(k))) {
        matched.add(tIdx);
      }
    });
  }

  // 若符号/地址未直接命中（如注释行或结构框），退回到同序段号匹配
  if (matched.size === 0) {
    const g = sourceGroups[activeLineIdx];
    if (g >= 0) {
      targetGroups.forEach((tg, tIdx) => {
        if (tg === g) matched.add(tIdx);
      });
    }
  }
  return Array.from(matched).sort((a, b) => a - b);
}

function wrapClickable(
  key: string,
  cls: string,
  raw: string,
  onInspect: (info: CodeTokenInfo) => void,
): React.ReactNode {
  const info = lookupCodeToken(raw);
  if (!info) {
    return (
      <span key={key} className={cls}>
        {raw}
      </span>
    );
  }
  return (
    <button
      key={key}
      type="button"
      className={`${cls} code-tok-btn`}
      title={`点击查看「${info.token}」大白话解释`}
      onClick={(e) => {
        e.stopPropagation();
        onInspect(info);
      }}
    >
      {raw}
    </button>
  );
}

function highlightSclLine(
  line: string,
  lineIdx: number,
  onInspect: (info: CodeTokenInfo) => void,
): React.ReactNode {
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
        </span>,
      );
    } else if (raw.startsWith('"') || raw.startsWith("'")) {
      tokens.push(
        <span key={k} className="tok-sym">
          {raw}
        </span>,
      );
    } else if (raw.startsWith('%') || /^T#/i.test(raw)) {
      tokens.push(wrapClickable(k, 'tok-addr', raw, onInspect));
    } else if (/^(16#|2#|\d)/.test(raw)) {
      tokens.push(wrapClickable(k, 'tok-num', raw, onInspect));
    } else if (raw === ':=' || raw === '=>' || raw === '<>' || raw === '<=' || raw === '>=') {
      tokens.push(wrapClickable(k, 'tok-op', raw, onInspect));
    } else {
      const upper = raw.toUpperCase();
      if (SCL_KEYWORDS.has(upper)) {
        tokens.push(wrapClickable(k, 'tok-kw', raw, onInspect));
      } else if (SCL_TYPES.has(upper)) {
        tokens.push(wrapClickable(k, 'tok-type', raw, onInspect));
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
      </span>,
    );
  }
  return tokens;
}

function highlightLadLine(
  line: string,
  lineIdx: number,
  onInspect: (info: CodeTokenInfo) => void,
): React.ReactNode {
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
        </span>,
      );
    } else if (raw.startsWith('"')) {
      tokens.push(
        <span key={k} className="tok-sym">
          {raw}
        </span>,
      );
    } else if (raw.startsWith('%') || /^T#/i.test(raw)) {
      tokens.push(wrapClickable(k, 'tok-addr', raw, onInspect));
    } else if (raw.startsWith('(') && raw.endsWith(')')) {
      tokens.push(wrapClickable(k, 'tok-coil', raw, onInspect));
    } else if (raw.startsWith('|') && raw.endsWith('|') && raw.length > 1) {
      tokens.push(wrapClickable(k, 'tok-contact', raw, onInspect));
    } else if (raw.startsWith('[')) {
      tokens.push(wrapClickable(k, 'tok-type', raw, onInspect));
    } else {
      tokens.push(
        <span key={k} className="tok-rail">
          {raw}
        </span>,
      );
    }
    last = match.index + raw.length;
  }

  if (last < line.length) {
    tokens.push(line.slice(last));
  }
  return tokens;
}

const LANG_LABELS: Record<SingleLang, string> = {
  scl: 'SCL 结构化文本',
  lad: 'LAD 梯形图',
  stl: 'STL 语句表',
  text: 'TEXT 工程文本',
};

const TokenInspectorBar: React.FC<{
  info: CodeTokenInfo;
  onClose: () => void;
}> = ({ info, onClose }) => (
  <div className="code-token-popover" role="region" aria-label="代码词条原地速解">
    <div className="code-token-popover-head">
      <div className="code-token-popover-title">
        <code className="code-token-pill">{info.token}</code>
        <span className="code-token-badge">{info.badge}</span>
        <strong>{info.title}</strong>
      </div>
      <button type="button" className="code-token-close" onClick={onClose} aria-label="关闭解释卡片">
        <X size={14} />
      </button>
    </div>
    <p className="code-token-summary">{info.summary}</p>
    {info.tip && <p className="code-token-tip">注意：{info.tip}</p>}
    {info.linkTo && (
      <Link to={info.linkTo} className="code-token-link">
        {info.linkLabel || '去相关课程深入看'}
        <ArrowRight size={13} />
      </Link>
    )}
  </div>
);

export const CodeViewer: React.FC<CodeViewerProps> = (props) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [dualView, setDualView] = useState<'split' | 'lad' | 'scl'>(
    props.mode === 'dual' ? (props.defaultView ?? 'split') : 'split',
  );
  const [inspected, setInspected] = useState<CodeTokenInfo | null>(null);
  const [hoverSync, setHoverSync] = useState<{ side: 'lad' | 'scl'; lineIdx: number } | null>(null);
  const [pinnedSync, setPinnedSync] = useState<{ side: 'lad' | 'scl'; lineIdx: number } | null>(null);

  const activeSync = hoverSync ?? pinnedSync;

  const dualAnalysis = useMemo(() => {
    if (props.mode !== 'dual') return null;
    const ladLines = (props.lad || '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
    const sclLines = (props.scl || '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
    return {
      ladLines,
      sclLines,
      ladGroups: assignLineGroups(ladLines),
      sclGroups: assignLineGroups(sclLines),
    };
  }, [props]);

  const syncedLines = useMemo(() => {
    if (!dualAnalysis || !activeSync) return { lad: new Set<number>(), scl: new Set<number>(), label: '' };
    const { ladLines, sclLines, ladGroups, sclGroups } = dualAnalysis;
    if (activeSync.side === 'lad') {
      const peers = findSyncedLines(ladLines, ladGroups, sclLines, sclGroups, activeSync.lineIdx);
      const ladSet = new Set<number>([activeSync.lineIdx]);
      const sclSet = new Set<number>(peers);
      const peerText =
        peers.length === 0
          ? ''
          : peers.length === 1
            ? `已联动：左 LAD 第 ${activeSync.lineIdx + 1} 行 ⇄ 右 SCL 第 ${peers[0] + 1} 行`
            : `已联动：左 LAD 第 ${activeSync.lineIdx + 1} 行 ⇄ 右 SCL 第 ${peers[0] + 1}–${peers[peers.length - 1] + 1} 行`;
      return { lad: ladSet, scl: sclSet, label: peerText };
    }
    const peers = findSyncedLines(sclLines, sclGroups, ladLines, ladGroups, activeSync.lineIdx);
    const sclSet = new Set<number>([activeSync.lineIdx]);
    const ladSet = new Set<number>(peers);
    const peerText =
      peers.length === 0
        ? ''
        : peers.length === 1
          ? `已联动：右 SCL 第 ${activeSync.lineIdx + 1} 行 ⇄ 左 LAD 第 ${peers[0] + 1} 行`
          : `已联动：右 SCL 第 ${activeSync.lineIdx + 1} 行 ⇄ 左 LAD 第 ${peers[0] + 1}–${peers[peers.length - 1] + 1} 行`;
    return { lad: ladSet, scl: sclSet, label: peerText };
  }, [dualAnalysis, activeSync]);

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

  const renderInteractiveLines = (
    code: string,
    lang: SingleLang,
    syncSide?: 'lad' | 'scl',
  ): React.ReactNode => {
    const normalized = (code || '').replace(/\r\n/g, '\n').replace(/\n+$/, '');
    const lines = normalized.split('\n');
    const activeSet = syncSide === 'lad' ? syncedLines.lad : syncSide === 'scl' ? syncedLines.scl : null;

    return (
      <div className="code-scroll">
        <pre className="code-pre">
          {lines.map((line, idx) => {
            const isPrimary = Boolean(syncSide && activeSync?.side === syncSide && activeSync.lineIdx === idx);
            const isPeer = Boolean(syncSide && !isPrimary && activeSet?.has(idx));
            const lineCls = `code-line${isPrimary ? ' is-sync-src' : isPeer ? ' is-sync-peer' : ''}`;
            return (
              <div
                key={idx}
                className={lineCls}
                onMouseEnter={syncSide && line.trim() ? () => setHoverSync({ side: syncSide, lineIdx: idx }) : undefined}
                onMouseLeave={syncSide ? () => setHoverSync(null) : undefined}
                onClick={
                  syncSide && line.trim()
                    ? () =>
                        setPinnedSync((prev) =>
                          prev && prev.side === syncSide && prev.lineIdx === idx
                            ? null
                            : { side: syncSide, lineIdx: idx },
                        )
                    : undefined
                }
              >
                <span className="code-ln">{idx + 1}</span>
                <span className="code-txt">
                  {lang === 'scl' || lang === 'stl'
                    ? highlightSclLine(line, idx, setInspected)
                    : lang === 'lad'
                      ? highlightLadLine(line, idx, setInspected)
                      : line || ' '}
                </span>
              </div>
            );
          })}
        </pre>
      </div>
    );
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

        <div className="code-interact-hint">
          <span>
            <HelpCircle size={12} /> 点击带下划线的地址/指令（如 <code>:=</code>、<code>%I0.0</code>、<code>TON</code>）即刻出白话解释
          </span>
          {dualView === 'split' && (
            <span className={`code-sync-badge${syncedLines.label ? ' is-live' : ''}`}>
              <Link2 size={12} />
              {syncedLines.label || '悬停或点击任意一行，左右 LAD ⇄ SCL 自动同步高亮'}
            </span>
          )}
        </div>

        {inspected && <TokenInspectorBar info={inspected} onClose={() => setInspected(null)} />}

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
              {renderInteractiveLines(props.lad, 'lad', 'lad')}
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
              {renderInteractiveLines(props.scl, 'scl', 'scl')}
            </div>
          </div>
        ) : dualView === 'lad' ? (
          renderInteractiveLines(props.lad, 'lad')
        ) : (
          renderInteractiveLines(props.scl, 'scl')
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

      {(props.lang === 'scl' || props.lang === 'lad') && (
        <div className="code-interact-hint">
          <span>
            <HelpCircle size={12} /> 看不懂某指令或地址？直接点击代码里的高亮词条即可原地看白话解释
          </span>
        </div>
      )}

      {inspected && <TokenInspectorBar info={inspected} onClose={() => setInspected(null)} />}

      {renderInteractiveLines(props.code, props.lang)}

      {props.caption && (
        <div className="code-caption">
          <Code2 size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />
          {props.caption}
        </div>
      )}
    </div>
  );
};
