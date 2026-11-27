import React, { memo, useMemo } from 'react';
import type { TagDef, TagValue } from '../../../types/plc';
import type { LadderEvalSnapshot, LadderNode, LadderProgram, NodeEvalState } from '../../../core/plc';
import { formatSiemensTime } from '../../../core/plc';

/**
 * 博途（TIA Portal）风格的 LAD 程序编辑器视图（自绘，未使用任何西门子截图或图标资源）。
 * - 每个程序段：标题“程序段 N: 标题”+ 注释行 + 左侧母线
 * - 操作数显示在元件上方：第一行绝对地址 %I0.0，第二行符号名 "Start"
 * - 在线监视配色参考 TIA 文档“程序状态显示”：绿色实线 = 满足（有能流），蓝色虚线 = 不满足，灰色 = 未知/未执行
 */

const EMPTY_FORCED: Record<string, TagValue> = {};
const EMPTY_HIGHLIGHTS: string[] = [];

interface TiaLadderProps {
  program: LadderProgram;
  tagDefs: TagDef[];
  tags: Record<string, TagValue>;
  evalSnapshot: LadderEvalSnapshot;
  /** CPU 在 RUN 且“监视”打开时才显示能流颜色 */
  monitoring: boolean;
  /** 强制中的变量名（显示 F 标记） */
  forced?: Record<string, TagValue>;
  onToggleInputTag?: (tag: string) => void;
  /** 只显示指定程序段（讲课模式等） */
  networkFilter?: number[];
  compact?: boolean;
  /** 指针高亮的元件 id（讲课模式） */
  highlightIds?: string[];
  /** 从交叉引用表 F11 一键定位高亮的目标程序段号 */
  focusedNetwork?: number | null;
}

const RY = 44; // 每个元件内“母线高度”（导线 y 偏移）
const CW = 128; // 触点/线圈单元宽度
const RH = 78; // 一行触点所需高度
const PIN = 20; // 功能框引脚间距
const BOX_W = 132;
const LEFT = 18;

type Ctx = {
  defs: Map<string, TagDef>;
  tags: Record<string, TagValue>;
  ev: LadderEvalSnapshot;
  mon: boolean;
  forced: Record<string, TagValue>;
  onToggle?: (t: string) => void;
  hl: Set<string>;
};

type Laid = { w: number; h: number; render: (x: number, y: number, ctx: Ctx) => React.ReactNode };

function boxPins(node: LadderNode): { left: string[]; right: string[]; title: string; sub: string } {
  switch (node.kind) {
    case 'TIMER':
      return { left: ['IN', 'PT'], right: ['Q', 'ET'], title: node.timerType, sub: 'Time' };
    case 'COUNTER':
      return { left: [node.counterType === 'CTU' ? 'CU' : 'CD', node.counterType === 'CTU' ? 'R' : 'LD', 'PV'], right: ['Q', 'CV'], title: node.counterType, sub: 'Int' };
    case 'NORM_X':
      return { left: ['EN', 'MIN', 'VALUE', 'MAX'], right: ['ENO', 'OUT'], title: 'NORM_X', sub: 'Int to Real' };
    case 'SCALE_X':
      return { left: ['EN', 'MIN', 'VALUE', 'MAX'], right: ['ENO', 'OUT'], title: 'SCALE_X', sub: 'Real to Real' };
    default:
      return { left: [], right: [], title: '', sub: '' };
  }
}

function stateOf(ctx: Ctx, id: string): NodeEvalState | undefined {
  return ctx.ev.nodeStates[id];
}

/** 导线样式：监视时 绿色实线 / 蓝色虚线；离线时 深灰实线 */
function wire(ctx: Ctx, on: boolean | undefined): React.SVGProps<SVGLineElement> {
  if (!ctx.mon) return { className: 'tl-w tl-off' };
  return { className: on ? 'tl-w tl-on' : 'tl-w tl-no' };
}

function fmtVal(def: TagDef | undefined, v: TagValue | undefined): string {
  if (v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (def?.type === 'Real') return Number(v).toFixed(2);
  if (def?.type === 'Time') return formatSiemensTime(Number(v));
  return String(Math.round(Number(v)));
}

function Operand({ x, y, tag, ctx, extra }: { x: number; y: number; tag: string; ctx: Ctx; extra?: string }) {
  const def = ctx.defs.get(tag);
  const forced = tag in ctx.forced;
  return (
    <g className="tl-operand">
      <text x={x} y={y - 16} textAnchor="middle" className="tl-addr">
        {forced ? 'F ' : ''}
        {def?.address ?? ''}
        {extra ?? ''}
      </text>
      <text x={x} y={y - 3} textAnchor="middle" className="tl-sym">
        "{tag.length > 17 ? `${tag.slice(0, 16)}…` : tag}"
      </text>
    </g>
  );
}

function layout(nodes: LadderNode[]): Laid {
  const items = nodes.map(layoutNode);
  const w = items.reduce((a, b) => a + b.w, 0);
  const h = items.reduce((a, b) => Math.max(a, b.h), RH);
  return {
    w,
    h,
    render: (x, y, ctx) => {
      let cx = x;
      return items.map((it, i) => {
        const el = <g key={i}>{it.render(cx, y, ctx)}</g>;
        cx += it.w;
        return el;
      });
    },
  };
}

function layoutNode(node: LadderNode): Laid {
  switch (node.kind) {
    case 'NO':
    case 'NC':
    case 'P_TRIG':
    case 'N_TRIG':
      return {
        w: CW,
        h: node.kind === 'P_TRIG' || node.kind === 'N_TRIG' ? RH + 18 : RH,
        render: (x, y, ctx) => {
          const st = stateOf(ctx, node.id);
          const cy = y + RY;
          const mid = x + CW / 2;
          const on = st?.powerOut;
          const isInput = ctx.defs.get(node.tag)?.address?.startsWith('%I');
          const cls = !ctx.mon ? 'tl-sym-off' : on ? 'tl-sym-on' : 'tl-sym-no';
          const hl = ctx.hl.has(node.id);
          const click = isInput && ctx.onToggle ? () => ctx.onToggle?.(node.tag) : undefined;
          return (
            <g
              className={`tl-el${click ? ' tl-click' : ''}${hl ? ' tl-hl' : ''}`}
              id={`tl-${node.id}`}
              data-tl={node.id}
              onClick={click}
              role={click ? 'button' : undefined}
              tabIndex={click ? 0 : undefined}
              aria-label={click ? `切换输入 ${node.tag}` : undefined}
              onKeyDown={
                click
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        click();
                      }
                    }
                  : undefined
              }
            >
              {click && <rect x={x + 6} y={y + 2} width={CW - 12} height={RH - 6} className="tl-hit" rx={6} />}
              <line x1={x} y1={cy} x2={mid - 8} y2={cy} {...wire(ctx, st?.powerIn)} />
              <line x1={mid + 8} y1={cy} x2={x + CW} y2={cy} {...wire(ctx, st?.powerOut)} />
              <line x1={mid - 8} y1={cy - 12} x2={mid - 8} y2={cy + 12} className={`tl-bar ${cls}`} />
              <line x1={mid + 8} y1={cy - 12} x2={mid + 8} y2={cy + 12} className={`tl-bar ${cls}`} />
              {node.kind === 'NC' && <line x1={mid - 12} y1={cy + 12} x2={mid + 12} y2={cy - 12} className={`tl-bar ${cls}`} />}
              {(node.kind === 'P_TRIG' || node.kind === 'N_TRIG') && (
                <>
                  <text x={mid} y={cy + 4} textAnchor="middle" className={`tl-pn ${cls}`}>
                    {node.kind === 'P_TRIG' ? 'P' : 'N'}
                  </text>
                  <text x={mid} y={cy + 30} textAnchor="middle" className="tl-addr">
                    {node.memTag ? `"${node.memTag}"` : '"边沿存储位"'}
                  </text>
                </>
              )}
              <Operand x={mid} y={cy - 14} tag={node.tag} ctx={ctx} />
            </g>
          );
        },
      };
    case 'CMP':
      return {
        w: CW + 8,
        h: RH + 22,
        render: (x, y, ctx) => {
          const st = stateOf(ctx, node.id);
          const cy = y + RY;
          const w = CW + 8;
          const mid = x + w / 2;
          const cls = !ctx.mon ? 'tl-sym-off' : st?.powerOut ? 'tl-sym-on' : 'tl-sym-no';
          const def = ctx.defs.get(node.leftTag);
          const right = typeof node.rightValue === 'number' ? String(node.rightValue) : `"${node.rightValue}"`;
          return (
            <g className={`tl-el${ctx.hl.has(node.id) ? ' tl-hl' : ''}`} id={`tl-${node.id}`} data-tl={node.id}>
              <line x1={x} y1={cy} x2={mid - 18} y2={cy} {...wire(ctx, st?.powerIn)} />
              <line x1={mid + 18} y1={cy} x2={x + w} y2={cy} {...wire(ctx, st?.powerOut)} />
              <line x1={mid - 18} y1={cy - 14} x2={mid - 18} y2={cy + 14} className={`tl-bar ${cls}`} />
              <line x1={mid + 18} y1={cy - 14} x2={mid + 18} y2={cy + 14} className={`tl-bar ${cls}`} />
              <text x={mid} y={cy - 1} textAnchor="middle" className="tl-op">
                {node.op === '==' ? '==' : node.op === '!=' ? '<>' : node.op}
              </text>
              <text x={mid} y={cy + 11} textAnchor="middle" className="tl-type">
                {def?.type === 'Real' ? 'Real' : 'Int'}
              </text>
              <Operand x={mid} y={cy - 16} tag={node.leftTag} ctx={ctx} />
              <text x={mid} y={cy + 30} textAnchor="middle" className="tl-sym">
                {right}
              </text>
              {ctx.mon && (
                <text x={mid} y={cy - 46} textAnchor="middle" className="tl-live">
                  {fmtVal(def, ctx.tags[node.leftTag])}
                </text>
              )}
            </g>
          );
        },
      };
    case 'OTE':
    case 'SET':
    case 'RESET':
      return {
        w: CW,
        h: RH,
        render: (x, y, ctx) => {
          const st = stateOf(ctx, node.id);
          const cy = y + RY;
          const mid = x + CW / 2;
          const val = Boolean(ctx.tags[node.tag]);
          const cls = !ctx.mon ? 'tl-sym-off' : (node.kind === 'OTE' ? st?.powerIn : val) ? 'tl-sym-on' : 'tl-sym-no';
          const letter = node.kind === 'SET' ? 'S' : node.kind === 'RESET' ? 'R' : '';
          return (
            <g className={`tl-el${ctx.hl.has(node.id) ? ' tl-hl' : ''}`} id={`tl-${node.id}`} data-tl={node.id}>
              <line x1={x} y1={cy} x2={mid - 12} y2={cy} {...wire(ctx, st?.powerIn)} />
              <path d={`M ${mid - 6} ${cy - 13} Q ${mid - 14} ${cy} ${mid - 6} ${cy + 13}`} className={`tl-coil ${cls}`} />
              <path d={`M ${mid + 6} ${cy - 13} Q ${mid + 14} ${cy} ${mid + 6} ${cy + 13}`} className={`tl-coil ${cls}`} />
              {letter && (
                <text x={mid} y={cy + 4} textAnchor="middle" className={`tl-pn ${cls}`}>
                  {letter}
                </text>
              )}
              <Operand x={mid} y={cy - 14} tag={node.tag} ctx={ctx} />
            </g>
          );
        },
      };
    case 'TIMER':
    case 'COUNTER':
    case 'NORM_X':
    case 'SCALE_X': {
      const pins = boxPins(node);
      const rows = Math.max(pins.left.length, pins.right.length);
      const boxH = 30 + rows * PIN;
      const w = BOX_W + 56;
      return {
        w,
        h: RY + boxH + 10,
        render: (x, y, ctx) => {
          const st = stateOf(ctx, node.id);
          const top = y + RY - 30;
          const bx = x + 28;
          const cls = !ctx.mon ? 'tl-sym-off' : st?.powerIn ? 'tl-sym-on' : 'tl-sym-no';
          const pinY = (i: number) => top + 30 + i * PIN;
          const leftVals: (string | undefined)[] = [];
          const rightVals: (string | undefined)[] = [];
          let dbLine = '';
          if (node.kind === 'TIMER') {
            const t = ctx.ev.timers[node.id];
            dbLine = node.dbName;
            leftVals.push(undefined, formatSiemensTime(node.ptMs));
            rightVals.push(node.qTag ? `"${node.qTag}"` : undefined, ctx.mon ? formatSiemensTime(Math.round(t?.etMs ?? 0)) : node.etTag ? `"${node.etTag}"` : '…');
          } else if (node.kind === 'COUNTER') {
            const c = ctx.ev.counters[node.id];
            dbLine = node.dbName;
            leftVals.push(undefined, node.resetTag ? `"${node.resetTag}"` : 'FALSE', String(node.pv));
            rightVals.push(node.qTag ? `"${node.qTag}"` : undefined, ctx.mon ? String(c?.cv ?? 0) : node.cvTag ? `"${node.cvTag}"` : '…');
          } else {
            leftVals.push(undefined, String(node.min), `"${node.valueTag}"`, String(node.max));
            const out = ctx.tags[node.outTag];
            rightVals.push(undefined, ctx.mon ? Number(out ?? 0).toFixed(node.kind === 'NORM_X' ? 3 : 1) : `"${node.outTag}"`);
          }
          return (
            <g className={`tl-el${ctx.hl.has(node.id) ? ' tl-hl' : ''}`} id={`tl-${node.id}`} data-tl={node.id}>
              {dbLine && (
                <text x={bx + BOX_W / 2} y={top - 6} textAnchor="middle" className="tl-sym">
                  "{dbLine}"
                </text>
              )}
              <rect x={bx} y={top} width={BOX_W} height={boxH} rx={2} className={`tl-box ${cls}`} />
              <text x={bx + BOX_W / 2} y={top + 13} textAnchor="middle" className="tl-box-title">
                {pins.title}
              </text>
              <text x={bx + BOX_W / 2} y={top + 25} textAnchor="middle" className="tl-type">
                {pins.sub}
              </text>
              {/* 左侧引脚：第一个引脚接能流 */}
              <line x1={x} y1={pinY(0)} x2={bx} y2={pinY(0)} {...wire(ctx, st?.powerIn)} />
              {pins.left.map((p, i) => (
                <g key={`l${i}`}>
                  <text x={bx + 5} y={pinY(i) + 4} className="tl-pin">
                    {p}
                  </text>
                  {i > 0 && leftVals[i] && (
                    <text x={bx - 4} y={pinY(i) + 4} textAnchor="end" className="tl-pinval">
                      {leftVals[i]}
                    </text>
                  )}
                </g>
              ))}
              {pins.right.map((p, i) => (
                <g key={`r${i}`}>
                  <text x={bx + BOX_W - 5} y={pinY(i) + 4} textAnchor="end" className="tl-pin">
                    {p}
                  </text>
                  {i > 0 && rightVals[i] && (
                    <text x={bx + BOX_W + 4} y={pinY(i) + 4} className={ctx.mon ? 'tl-pinval tl-live' : 'tl-pinval'}>
                      {rightVals[i]}
                    </text>
                  )}
                </g>
              ))}
              <line x1={bx + BOX_W} y1={pinY(0)} x2={x + w} y2={pinY(0)} {...wire(ctx, st?.powerOut)} />
            </g>
          );
        },
      };
    }
    case 'BRANCH':
    case 'OUTPUT_BRANCH': {
      const chains = (node.kind === 'BRANCH' ? node.branches : node.outputs).map(layout);
      const inner = chains.reduce((a, c) => Math.max(a, c.w), 0);
      const pad = 10;
      const w = inner + pad * 2 + (node.kind === 'OUTPUT_BRANCH' ? 0 : 0);
      const h = chains.reduce((a, c) => a + c.h, 0);
      return {
        w,
        h,
        render: (x, y, ctx) => {
          const st = stateOf(ctx, node.id);
          const bs = ctx.ev.branchStates[node.id] ?? [];
          let cy = y;
          const ys: number[] = [];
          const parts = chains.map((c, i) => {
            ys.push(cy + RY);
            const g = (
              <g key={i}>
                <line x1={x} y1={cy + RY} x2={x + pad} y2={cy + RY} {...wire(ctx, st?.powerIn)} />
                {c.render(x + pad, cy, ctx)}
                {node.kind === 'BRANCH' && (
                  <line x1={x + pad + c.w} y1={cy + RY} x2={x + w} y2={cy + RY} {...wire(ctx, bs[i]?.powerOut)} />
                )}
              </g>
            );
            cy += c.h;
            return g;
          });
          const last = ys[ys.length - 1] ?? y + RY;
          return (
            <g>
              <line x1={x} y1={y + RY} x2={x} y2={last} {...wire(ctx, st?.powerIn)} />
              {node.kind === 'BRANCH' && (
                <line x1={x + w} y1={y + RY} x2={x + w} y2={last} {...wire(ctx, st?.powerOut)} />
              )}
              {parts}
            </g>
          );
        },
      };
    }
    default:
      return { w: 0, h: RH, render: () => null };
  }
}

export const TiaLadder: React.FC<TiaLadderProps> = memo(function TiaLadder({
  program,
  tagDefs,
  tags,
  evalSnapshot,
  monitoring,
  forced = EMPTY_FORCED,
  onToggleInputTag,
  networkFilter,
  compact = false,
  highlightIds = EMPTY_HIGHLIGHTS,
  focusedNetwork = null,
}) {
  const defs = useMemo(() => new Map(tagDefs.map((d) => [d.name, d])), [tagDefs]);
  const nets = useMemo(
    () => program.networks.filter((n) => !networkFilter || networkFilter.includes(n.number)),
    [program, networkFilter],
  );
  const laid = useMemo(() => nets.map((n) => layout(n.nodes)), [nets]);
  const hlSet = useMemo(() => new Set(highlightIds), [highlightIds]);
  const ctx: Ctx = {
    defs,
    tags,
    ev: evalSnapshot,
    mon: monitoring,
    forced,
    onToggle: onToggleInputTag,
    hl: hlSet,
  };

  return (
    <div className={`tl-editor${compact ? ' is-compact' : ''}${monitoring ? ' is-online' : ''}`}>
      {nets.map((n, i) => {
        const l = laid[i];
        const width = Math.max(LEFT + l.w + 40, 360);
        const height = l.h + 12;
        const energized = evalSnapshot.networkEnergized[n.id];
        const isFocused = focusedNetwork === n.number;
        return (
          <section
            key={n.id}
            data-network-number={n.number}
            className={`tl-network${isFocused ? ' is-focused' : ''}`}
            aria-label={`程序段 ${n.number}`}
          >
            <header className="tl-net-head">
              <span className="tl-net-caret" aria-hidden>
                ▾
              </span>
              <span className="tl-net-no">程序段 {n.number}:</span>
              <span className="tl-net-title">{n.title}</span>
              {monitoring && (
                <span className={`tl-net-state ${energized ? 'on' : ''}`}>{energized ? '有能流' : '无能流'}</span>
              )}
            </header>
            {n.comment && !compact && <p className="tl-net-comment">{n.comment}</p>}
            <div className="tl-net-scroll">
              <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="tl-svg" role="img" aria-label={`程序段 ${n.number} 梯形图`}>
                <line x1={LEFT} y1={0} x2={LEFT} y2={height} className={`tl-rail${monitoring ? ' on' : ''}`} />
                {l.render(LEFT, 4, ctx)}
              </svg>
            </div>
          </section>
        );
      })}
    </div>
  );
});

export const TiaLegend: React.FC<{ monitoring: boolean }> = memo(function TiaLegend({ monitoring }) {
  return (
    <div className="tl-legend" aria-label="图例">
      {monitoring ? (
        <>
          <span>
            <i className="tl-key on" /> 绿色实线：满足（有能流）
          </span>
          <span>
            <i className="tl-key no" /> 蓝色虚线：不满足
          </span>
          <span>
            <b className="tl-key-f">F</b> 已强制
          </span>
        </>
      ) : (
        <span>监视已关闭：只显示程序结构。打开“监视”看能流。</span>
      )}
    </div>
  );
});
