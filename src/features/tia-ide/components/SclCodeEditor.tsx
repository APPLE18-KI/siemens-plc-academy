import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  FileCode2,
  PlaySquare,
  RotateCcw,
  Sparkles,
  Tag,
} from 'lucide-react';
import type { TagDef } from '../../../types/plc';
import type { SclDiagnostic, SclLineTelemetry } from '../../../core/scl/types';
import { renderSclLineTokens, tokenizeSclDocument } from '../sclHighlight';
import { haptic } from '../../../app/native/platform';

const LINE_HEIGHT_PX = 24;

interface QuickSnippet {
  id: string;
  label: string;
  text: string;
  cursorOffset: number;
  title: string;
}

const QUICK_SNIPPETS: QuickSnippet[] = [
  { id: 'assign', label: ':=', text: ' := ', cursorOffset: 4, title: 'SCL 赋值运算符 :=' },
  { id: 'quotes', label: '""', text: '""', cursorOffset: 1, title: '插入双引号全局符号名' },
  {
    id: 'if',
    label: 'IF..THEN',
    text: 'IF  THEN\n  ;\nEND_IF;',
    cursorOffset: 3,
    title: '插入 IF 条件分支块',
  },
  {
    id: 'case',
    label: 'CASE..OF',
    text: 'CASE #statStep OF\n  0:\n    ;\n  10:\n    ;\n  ELSE\n    #statStep := 0;\nEND_CASE;',
    cursorOffset: 5,
    title: '插入 CASE 步序状态机模板',
  },
  {
    id: 'ton',
    label: '#ton1(TON)',
    text: '#ton1(IN := , PT := T#3s);',
    cursorOffset: 12,
    title: '插入接通延时定时器 TON 调用',
  },
  {
    id: 'rtrig',
    label: '#rTrig1',
    text: '#rTrig1(CLK := );',
    cursorOffset: 15,
    title: '插入上升沿检测 R_TRIG 调用',
  },
  {
    id: 'ctu',
    label: '#ctu1(CTU)',
    text: '#ctu1(CU := , R := FALSE, PV := 5);',
    cursorOffset: 12,
    title: '插入加计数器 CTU 调用',
  },
  {
    id: 'norm',
    label: 'NORM_X',
    text: 'NORM_X(MIN := 0.0, VALUE := , MAX := 27648.0)',
    cursorOffset: 28,
    title: '模拟量标准化函数 NORM_X',
  },
  {
    id: 'scale',
    label: 'SCALE_X',
    text: 'SCALE_X(MIN := 0.0, VALUE := , MAX := 100.0)',
    cursorOffset: 29,
    title: '模拟量工程量缩放函数 SCALE_X',
  },
  {
    id: 'for',
    label: 'FOR..DO',
    text: 'FOR #i := 1 TO 10 DO\n  ;\nEND_FOR;',
    cursorOffset: 23,
    title: '插入 FOR 循环语句',
  },
];

export interface SclCodeEditorProps {
  activeBlock: 'ob1' | 'ob100';
  onSwitchBlock: (block: 'ob1' | 'ob100') => void;
  code: string;
  onChangeCode: (next: string) => void;
  isDirtyOb1: boolean;
  isDirtyOb100: boolean;
  monitoring: boolean;
  lineTelemetry: Record<number, SclLineTelemetry>;
  diagnostics: SclDiagnostic[];
  runtimeErrorLine?: number;
  jumpRequest: { line: number; seq: number } | null;
  tagDefs: TagDef[];
  onCompile: () => void;
  onDownload: () => void;
  onRestoreDefault: () => void;
}

export const SclCodeEditor: React.FC<SclCodeEditorProps> = ({
  activeBlock,
  onSwitchBlock,
  code,
  onChangeCode,
  isDirtyOb1,
  isDirtyOb100,
  monitoring,
  lineTelemetry,
  diagnostics,
  runtimeErrorLine,
  jumpRequest,
  tagDefs,
  onCompile,
  onDownload,
  onRestoreDefault,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [jumpedLine, setJumpedLine] = useState<number | null>(null);
  const [showTagChips, setShowTagChips] = useState<boolean>(false);
  const [showMonitorLane, setShowMonitorLane] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const lines = useMemo(() => code.split('\n'), [code]);
  const tokenizedLines = useMemo(() => tokenizeSclDocument(code), [code]);

  const diagByLine = useMemo(() => {
    const map: Record<number, SclDiagnostic> = {};
    for (const d of diagnostics) {
      if (!map[d.line] || d.severity === 'error') {
        map[d.line] = d;
      }
    }
    return map;
  }, [diagnostics]);

  // Estimate longest line width in px to prevent line wrapping drift
  const contentMinWidthPx = useMemo(() => {
    let maxChars = 48;
    for (const line of lines) {
      // Count CJK characters as ~1.8 monospace cells
      let width = 0;
      for (let i = 0; i < line.length; i++) {
        width += line.charCodeAt(i) > 255 ? 1.85 : 1;
      }
      if (width > maxChars) maxChars = width;
    }
    return Math.ceil(maxChars * 8.1 + 56);
  }, [lines]);

  const totalHeightPx = Math.max(360, lines.length * LINE_HEIGHT_PX + 24);
  const liveTelemetryActive = monitoring && activeBlock === 'ob1';

  // Jump to line on diagnostic click
  useEffect(() => {
    if (!jumpRequest) return;
    const targetLine = Math.max(1, Math.min(lines.length, jumpRequest.line));
    setJumpedLine(targetLine);
    if (scrollRef.current) {
      const targetTop = Math.max(0, (targetLine - 4) * LINE_HEIGHT_PX);
      scrollRef.current.scrollTo({ top: targetTop, behavior: 'smooth' });
    }
    if (textareaRef.current) {
      let charPos = 0;
      for (let i = 0; i < targetLine - 1; i++) {
        charPos += (lines[i]?.length ?? 0) + 1;
      }
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(charPos, charPos);
    }
    const timer = window.setTimeout(() => setJumpedLine(null), 1800);
    return () => window.clearTimeout(timer);
  }, [jumpRequest, lines]);

  const insertAtCursor = (snippetText: string, cursorOffset = snippetText.length) => {
    haptic('tap');
    const ta = textareaRef.current;
    if (!ta) {
      onChangeCode(code + (code.endsWith('\n') ? '' : '\n') + snippetText);
      return;
    }
    const start = ta.selectionStart ?? code.length;
    const end = ta.selectionEnd ?? code.length;
    const next = code.slice(0, start) + snippetText + code.slice(end);
    onChangeCode(next);
    const nextPos = start + cursorOffset;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(nextPos, nextPos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      onCompile();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onDownload();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      insertAtCursor('  ', 2);
      return;
    }
    if (e.key === 'Enter') {
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const before = code.slice(0, start);
      const lineStart = before.lastIndexOf('\n') + 1;
      const currentLine = before.slice(lineStart);
      const indentMatch = currentLine.match(/^(\s*)/);
      let indent = indentMatch ? indentMatch[1] : '';
      if (/\b(THEN|OF|DO|ELSE|REGION)\s*$/i.test(currentLine.trim())) {
        indent += '  ';
      }
      if (indent.length > 0) {
        e.preventDefault();
        insertAtCursor('\n' + indent, 1 + indent.length);
      }
    }
  };

  const handleCopyCode = async () => {
    haptic('tap');
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Block Tabs & Editor Actions */}
      <div className="tia-editor-head">
        <div className="tia-block-tabs">
          <button
            type="button"
            className={`tia-block-tab ${activeBlock === 'ob1' ? 'active' : ''}`}
            onClick={() => onSwitchBlock('ob1')}
          >
            <FileCode2 size={14} color="#2dd4bf" />
            <span>Main [OB1]</span>
            {isDirtyOb1 && <span style={{ color: '#fb923c', fontSize: 11 }}>●</span>}
          </button>

          <button
            type="button"
            className={`tia-block-tab ${activeBlock === 'ob100' ? 'active' : ''}`}
            onClick={() => onSwitchBlock('ob100')}
          >
            <PlaySquare size={14} color="#38bdf8" />
            <span>Startup [OB100]</span>
            {isDirtyOb100 && <span style={{ color: '#fb923c', fontSize: 11 }}>●</span>}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {liveTelemetryActive && (
            <button
              type="button"
              className="tia-btn tia-btn--sm"
              onClick={() => setShowMonitorLane((v) => !v)}
              title="切换右侧小眼镜实时监控数值列显示"
            >
              {showMonitorLane ? <Eye size={13} color="#f97316" /> : <EyeOff size={13} />}
              <span>{showMonitorLane ? '监控列: 开' : '监控列: 隐'}</span>
            </button>
          )}
          <button
            type="button"
            className="tia-btn tia-btn--sm"
            onClick={() => setShowTagChips((v) => !v)}
            title="展开/收起当前项目变量符号一键插入栏"
          >
            <Tag size={13} color="#34d399" />
            <span>插变量</span>
          </button>
          <button type="button" className="tia-btn tia-btn--sm" onClick={handleCopyCode} title="复制当前块 SCL 代码">
            {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
            <span>{copied ? '已复制' : '复制'}</span>
          </button>
          <button
            type="button"
            className="tia-btn tia-btn--sm"
            onClick={() => {
              haptic('tap');
              onRestoreDefault();
            }}
            title="恢复当前模板初始参考代码"
          >
            <RotateCcw size={12} />
            <span>还原模板</span>
          </button>
        </div>
      </div>

      {/* Mobile & Beginner Friendly Quick-Insert Bar */}
      <div className="tia-quick-bar" aria-label="快捷指令插入栏">
        <span className="tia-quick-label">
          <Sparkles size={11} style={{ verticalAlign: -1, marginRight: 3 }} />
          快捷插入
        </span>
        {QUICK_SNIPPETS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="tia-quick-chip"
            title={s.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertAtCursor(s.text, s.cursorOffset)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Optional Project Tag Quick-Insert Row */}
      {showTagChips && tagDefs.length > 0 && (
        <div
          className="tia-quick-bar"
          style={{ background: '#0c151f', borderBottomColor: 'rgba(16, 185, 129, 0.22)' }}
          aria-label="项目符号变量一键插入"
        >
          <span className="tia-quick-label" style={{ color: '#6ee7b7' }}>
            符号变量
          </span>
          {tagDefs.map((tag) => (
            <button
              key={tag.name}
              type="button"
              className="tia-quick-chip tia-quick-chip--tag"
              title={`${tag.address} (${tag.type}) ${tag.comment ?? ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertAtCursor(`"${tag.name}"`)}
            >
              &quot;{tag.name}&quot;
              <span style={{ opacity: 0.65, fontSize: 10 }}>{tag.address}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Dual-Layer Code Stage + Synchronized Live Telemetry Lane */}
      <div className="tia-code-stage">
        <div className="tia-code-scroll" ref={scrollRef}>
          {/* Left Sticky Line Numbers + Green Power-Flow Rail */}
          <div className="tia-gutter" style={{ height: totalHeightPx }} aria-hidden="true">
            {lines.map((_, idx) => {
              const lineNo = idx + 1;
              const diag = diagByLine[lineNo];
              const isRuntimeErr = runtimeErrorLine === lineNo;
              const tel = liveTelemetryActive ? lineTelemetry[lineNo] : undefined;
              const rowCls = [
                'tia-gutter-row',
                isRuntimeErr || diag?.severity === 'error'
                  ? 'has-error'
                  : diag?.severity === 'warning'
                    ? 'has-warn'
                    : tel
                      ? tel.executed
                        ? 'is-exec'
                        : 'is-unexec'
                      : '',
                jumpedLine === lineNo ? 'is-jumped' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <div
                  key={lineNo}
                  className={rowCls}
                  title={
                    diag
                      ? `第 ${lineNo} 行: ${diag.message}`
                      : tel
                        ? tel.executed
                          ? '本扫描周期已执行此行'
                          : '本扫描周期未进入此分支'
                        : undefined
                  }
                >
                  {lineNo}
                </div>
              );
            })}
          </div>

          {/* Center Syntax-Highlighted Backdrop + Pixel-Locked Transparent Textarea */}
          <div
            className="tia-editor-layer-wrap"
            style={{ minWidth: contentMinWidthPx, height: totalHeightPx }}
          >
            <div className="tia-code-backdrop" aria-hidden="true">
              {tokenizedLines.map((tokens, idx) => {
                const lineNo = idx + 1;
                const diag = diagByLine[lineNo];
                const isRuntimeErr = runtimeErrorLine === lineNo;
                const tel = liveTelemetryActive ? lineTelemetry[lineNo] : undefined;
                const cls = [
                  'tia-code-line-bg',
                  isRuntimeErr || diag?.severity === 'error'
                    ? 'has-error'
                    : diag?.severity === 'warning'
                      ? 'has-warn'
                      : tel
                        ? tel.executed
                          ? 'is-exec'
                          : 'is-unexec'
                        : '',
                  jumpedLine === lineNo ? 'is-jumped' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <div key={lineNo} className={cls}>
                    {renderSclLineTokens(tokens)}
                  </div>
                );
              })}
            </div>

            <textarea
              ref={textareaRef}
              className="tia-code-textarea"
              value={code}
              onChange={(e) => onChangeCode(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              aria-label={activeBlock === 'ob1' ? 'Main [OB1] SCL 代码编辑器' : 'Startup [OB100] SCL 代码编辑器'}
              style={{ height: totalHeightPx }}
            />
          </div>

          {/* Right Sticky TIA Portal "Live Glasses" Monitor Lane */}
          {liveTelemetryActive && showMonitorLane && (
            <div
              className="tia-telemetry-lane"
              style={{ height: totalHeightPx }}
              aria-label="博途小眼镜实时行变量监控列"
            >
              {lines.map((_, idx) => {
                const lineNo = idx + 1;
                const tel = lineTelemetry[lineNo];
                return (
                  <div key={lineNo} className="tia-telemetry-row">
                    {tel && tel.values.length > 0 ? (
                      tel.values.slice(0, 3).map((item, vi) => {
                        const isBool = typeof item.value === 'boolean';
                        const pillCls = isBool
                          ? item.value
                            ? 'tia-val-pill is-true'
                            : 'tia-val-pill is-false'
                          : 'tia-val-pill is-num';
                        return (
                          <span
                            key={`${item.expr}-${vi}`}
                            className={pillCls}
                            title={`${item.expr} = ${item.formatted}`}
                          >
                            <span className="tia-val-expr">{item.expr}=</span>
                            <strong>{item.formatted}</strong>
                          </span>
                        );
                      })
                    ) : tel && tel.executed ? (
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: 'var(--font-mono)',
                          color: 'rgba(16, 185, 129, 0.55)',
                          paddingLeft: 4,
                        }}
                      >
                        ● RUN
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
