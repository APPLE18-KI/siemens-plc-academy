import React, { memo, useId, useMemo } from 'react';
import { AlertTriangle, Zap } from 'lucide-react';
import type { TagDef, TagValue } from '../../../types/plc';
import {
  formatSiemensTime,
  inferTagArea,
  type LadderEvalSnapshot,
  type LadderNetwork,
  type LadderNode,
  type LadderProgram,
} from '../../../core/plc';

interface LadderCanvasProps {
  program: LadderProgram;
  tagDefs: TagDef[];
  tags: Record<string, TagValue>;
  evalSnapshot: LadderEvalSnapshot;
  running: boolean;
  compact?: boolean;
  focusedNetwork?: number | null;
  onToggleInputTag?: (tagName: string) => void;
}

interface BoxMetrics {
  width: number;
  height: number;
  wireY: number;
}

const CONTACT_W = 114;
const CONTACT_H = 68;
const CONTACT_WIRE_Y = 40;

const CMP_W = 136;
const CMP_H = 78;
const CMP_WIRE_Y = 44;

const BLOCK_W = 198;
const BLOCK_H = 116;
const BLOCK_WIRE_Y = 46;

const BRANCH_PAD_X = 20;
const BRANCH_GAP_Y = 12;
const NODE_GAP_X = 18;
const LEFT_RAIL_X = 20;
const RIGHT_PAD = 24;

function measureNode(node: LadderNode): BoxMetrics {
  switch (node.kind) {
    case 'NO':
    case 'NC':
    case 'P_TRIG':
    case 'N_TRIG':
    case 'OTE':
    case 'SET':
    case 'RESET':
      return { width: CONTACT_W, height: CONTACT_H, wireY: CONTACT_WIRE_Y };
    case 'CMP':
      return { width: CMP_W, height: CMP_H, wireY: CMP_WIRE_Y };
    case 'TIMER':
    case 'COUNTER':
    case 'NORM_X':
    case 'SCALE_X':
      return { width: BLOCK_W, height: BLOCK_H, wireY: BLOCK_WIRE_Y };
    case 'BRANCH': {
      const subMetrics = node.branches.map((b) => measureChain(b));
      const maxW = subMetrics.reduce((m, s) => Math.max(m, s.width), CONTACT_W);
      const totalH =
        subMetrics.reduce((sum, s) => sum + s.height, 0) +
        Math.max(0, subMetrics.length - 1) * BRANCH_GAP_Y;
      const firstWireY = subMetrics[0]?.wireY ?? CONTACT_WIRE_Y;
      return {
        width: maxW + BRANCH_PAD_X * 2,
        height: Math.max(CONTACT_H, totalH),
        wireY: firstWireY,
      };
    }
    case 'OUTPUT_BRANCH': {
      const subMetrics = node.outputs.map((b) => measureChain(b));
      const maxW = subMetrics.reduce((m, s) => Math.max(m, s.width), CONTACT_W);
      const totalH =
        subMetrics.reduce((sum, s) => sum + s.height, 0) +
        Math.max(0, subMetrics.length - 1) * BRANCH_GAP_Y;
      const firstWireY = subMetrics[0]?.wireY ?? CONTACT_WIRE_Y;
      return {
        width: maxW + BRANCH_PAD_X,
        height: Math.max(CONTACT_H, totalH),
        wireY: firstWireY,
      };
    }
  }
}

function measureChain(nodes: LadderNode[]): BoxMetrics {
  if (nodes.length === 0) {
    return { width: 48, height: CONTACT_H, wireY: CONTACT_WIRE_Y };
  }
  const metrics = nodes.map(measureNode);
  const maxAbove = metrics.reduce((m, s) => Math.max(m, s.wireY), CONTACT_WIRE_Y);
  const maxBelow = metrics.reduce((m, s) => Math.max(m, s.height - s.wireY), CONTACT_H - CONTACT_WIRE_Y);
  const width =
    metrics.reduce((sum, s) => sum + s.width, 0) + Math.max(0, nodes.length - 1) * NODE_GAP_X;
  return {
    width,
    height: maxAbove + maxBelow,
    wireY: maxAbove,
  };
}

function isOutputNode(node: LadderNode): boolean {
  return (
    node.kind === 'OTE' ||
    node.kind === 'SET' ||
    node.kind === 'RESET' ||
    node.kind === 'OUTPUT_BRANCH'
  );
}

const COLOR_ON = '#10b981';
const COLOR_OFF = '#475569';
const COLOR_WARN = '#f59e0b';
const COLOR_CYAN = '#38bdf8';

export const LadderCanvas: React.FC<LadderCanvasProps> = memo(function LadderCanvas({
  program,
  tagDefs,
  tags,
  evalSnapshot,
  running,
  compact = false,
  focusedNetwork = null,
  onToggleInputTag,
}) {
  const uid = useId().replace(/:/g, '');
  const glowId = `plc-glow-${uid}`;

  const tagMap = useMemo(() => {
    const m = new Map<string, TagDef>();
    for (const def of tagDefs) m.set(def.name, def);
    return m;
  }, [tagDefs]);

  const warningByNetwork = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const w of evalSnapshot.doubleCoilWarnings) {
      for (const nw of w.networkNumbers) {
        const list = map.get(nw) ?? [];
        list.push(w.message);
        map.set(nw, list);
      }
    }
    return map;
  }, [evalSnapshot.doubleCoilWarnings]);

  const renderWire = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    energized: boolean,
    key: string
  ) => (
    <g key={key}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={energized ? COLOR_ON : COLOR_OFF}
        strokeWidth={energized ? 3 : 2}
        strokeDasharray={energized ? undefined : '5 4'}
        strokeLinecap="round"
        filter={energized ? `url(#${glowId})` : undefined}
      />
      {energized && (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#a7f3d0"
          strokeWidth={1.6}
          strokeDasharray="6 14"
          strokeLinecap="round"
          className="plc-sim-flow-dash"
        />
      )}
    </g>
  );

  const renderNode = (
    node: LadderNode,
    x: number,
    wireY: number,
    keyPrefix: string
  ): React.ReactNode => {
    const st = evalSnapshot.nodeStates[node.id] ?? {
      powerIn: false,
      powerOut: false,
      active: false,
    };

    switch (node.kind) {
      case 'NO':
      case 'NC':
      case 'P_TRIG':
      case 'N_TRIG': {
        const def = tagMap.get(node.tag);
        const isInput = def ? inferTagArea(def) === 'I' : false;
        const addr = def?.address ?? '';
        const midX = x + CONTACT_W / 2;
        const barGap = node.kind === 'P_TRIG' || node.kind === 'N_TRIG' ? 14 : 11;
        const barLeft = midX - barGap;
        const barRight = midX + barGap;
        const barTop = wireY - 12;
        const barBot = wireY + 12;

        const wireInOn = st.powerIn;
        const wireOutOn = st.powerOut;
        const contactColor = wireOutOn
          ? COLOR_ON
          : st.active
          ? '#34d399'
          : '#64748b';

        return (
          <g
            key={`${keyPrefix}-${node.id}`}
            className={isInput && onToggleInputTag ? 'plc-sim-svg-clickable' : undefined}
            onClick={() => {
              if (isInput && onToggleInputTag) onToggleInputTag(node.tag);
            }}
          >
            {isInput && onToggleInputTag && (
              <title>{`点击切换输入 ${node.tag} (${addr})`}</title>
            )}
            {/* Invisible hit target for easy click */}
            {isInput && onToggleInputTag && (
              <rect
                x={x + 6}
                y={wireY - 34}
                width={CONTACT_W - 12}
                height={60}
                rx={6}
                className="plc-sim-svg-hit"
              />
            )}

            {/* Left lead */}
            {renderWire(x, wireY, barLeft, wireY, wireInOn, `${keyPrefix}-${node.id}-in`)}
            {/* Right lead */}
            {renderWire(barRight, wireY, x + CONTACT_W, wireY, wireOutOn, `${keyPrefix}-${node.id}-out`)}

            {/* Contact vertical bars */}
            <line
              x1={barLeft}
              y1={barTop}
              x2={barLeft}
              y2={barBot}
              stroke={contactColor}
              strokeWidth={wireOutOn ? 3.2 : 2.4}
              strokeLinecap="round"
              filter={wireOutOn ? `url(#${glowId})` : undefined}
            />
            <line
              x1={barRight}
              y1={barTop}
              x2={barRight}
              y2={barBot}
              stroke={contactColor}
              strokeWidth={wireOutOn ? 3.2 : 2.4}
              strokeLinecap="round"
              filter={wireOutOn ? `url(#${glowId})` : undefined}
            />

            {/* Internal glowing bridge when conducting */}
            {wireOutOn && (
              <line
                x1={barLeft + 2}
                y1={wireY}
                x2={barRight - 2}
                y2={wireY}
                stroke={COLOR_ON}
                strokeWidth={2.2}
                strokeOpacity={0.75}
              />
            )}

            {/* NC diagonal slash */}
            {node.kind === 'NC' && (
              <line
                x1={barLeft + 2}
                y1={barBot - 1}
                x2={barRight - 2}
                y2={barTop + 1}
                stroke={contactColor}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            )}

            {/* P_TRIG / N_TRIG letter */}
            {(node.kind === 'P_TRIG' || node.kind === 'N_TRIG') && (
              <>
                <text
                  x={midX}
                  y={wireY + 4}
                  textAnchor="middle"
                  fill={wireOutOn ? '#fef08a' : COLOR_CYAN}
                  fontSize={12}
                  fontWeight={800}
                  fontFamily="ui-monospace, Consolas, monospace"
                >
                  {node.kind === 'P_TRIG' ? 'P' : 'N'}
                </text>
                {node.memTag && (
                  <text
                    x={midX}
                    y={wireY + 24}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize={11}
                    fontFamily="ui-monospace, Consolas, monospace"
                  >
                    {node.memTag}
                  </text>
                )}
              </>
            )}

            {/* Address badge & Symbol name above */}
            <text
              x={midX}
              y={wireY - 26}
              textAnchor="middle"
              fill={isInput ? '#38bdf8' : '#94a3b8'}
              fontSize={11}
              fontWeight={700}
              fontFamily="ui-monospace, Consolas, monospace"
            >
              {addr}
            </text>
            <text
              x={midX}
              y={wireY - 14}
              textAnchor="middle"
              fill={wireOutOn ? '#ecfdf5' : '#cbd5e1'}
              fontSize={10.5}
              fontWeight={600}
              fontFamily="ui-monospace, Consolas, monospace"
            >
              {`"${node.tag}"`}
            </text>
          </g>
        );
      }

      case 'CMP': {
        const bx = x + 12;
        const bw = CMP_W - 24;
        const by = wireY - 26;
        const bh = 54;
        const borderCol = st.powerOut ? COLOR_ON : st.powerIn ? '#38bdf8' : '#475569';
        return (
          <g key={`${keyPrefix}-${node.id}`}>
            {renderWire(x, wireY, bx, wireY, st.powerIn, `${keyPrefix}-${node.id}-in`)}
            {renderWire(bx + bw, wireY, x + CMP_W, wireY, st.powerOut, `${keyPrefix}-${node.id}-out`)}
            <rect
              x={bx}
              y={by}
              width={bw}
              height={bh}
              rx={6}
              fill={st.powerOut ? 'rgba(16, 185, 129, 0.14)' : 'rgba(15, 23, 42, 0.92)'}
              stroke={borderCol}
              strokeWidth={st.powerOut ? 2.2 : 1.5}
              filter={st.powerOut ? `url(#${glowId})` : undefined}
            />
            <rect
              x={bx}
              y={by}
              width={bw}
              height={18}
              rx={5}
              fill={st.powerOut ? 'rgba(16, 185, 129, 0.25)' : 'rgba(30, 41, 59, 0.95)'}
            />
            <text
              x={bx + bw / 2}
              y={by + 13}
              textAnchor="middle"
              fill={st.powerOut ? '#6ee7b7' : '#e2e8f0'}
              fontSize={11}
              fontWeight={800}
              fontFamily="ui-monospace, Consolas, monospace"
            >
              {`CMP ${node.op}`}
            </text>
            <text
              x={bx + bw / 2}
              y={by + 33}
              textAnchor="middle"
              fill="#38bdf8"
              fontSize={11}
              fontWeight={700}
              fontFamily="ui-monospace, Consolas, monospace"
            >
              {st.valueText ?? `${tags[node.leftTag] ?? 0}`}
            </text>
            <text
              x={bx + bw / 2}
              y={by + 47}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize={11}
              fontFamily="ui-monospace, Consolas, monospace"
            >
              {st.subText ?? `${node.op} ${node.rightValue}`}
            </text>
          </g>
        );
      }

      case 'TIMER':
      case 'COUNTER':
      case 'NORM_X':
      case 'SCALE_X': {
        const bx = x + 16;
        const bw = BLOCK_W - 32;
        const by = wireY - 22;
        const bh = 88;
        const pct = Math.max(0, Math.min(1, st.progress ?? 0));

        let dbTitle = '';
        let headerText = '';
        let leftPin1 = 'IN';
        let leftPin2 = '';
        let rightPin1 = 'Q';
        let rightPin2 = '';

        if (node.kind === 'TIMER') {
          dbTitle = `"${node.dbName}"`;
          headerText = `${node.timerType} · Time`;
          leftPin1 = 'IN';
          leftPin2 = `PT: ${formatSiemensTime(node.ptMs)}`;
          rightPin1 = 'Q';
          rightPin2 = 'ET';
        } else if (node.kind === 'COUNTER') {
          dbTitle = `"${node.dbName}"`;
          headerText = `${node.counterType} · Int`;
          leftPin1 = node.counterType === 'CTU' ? 'CU' : 'CD';
          leftPin2 = `R:${node.resetTag ? (tags[node.resetTag] ? '1' : '0') : '0'} PV:${node.pv}`;
          rightPin1 = 'Q';
          rightPin2 = 'CV';
        } else if (node.kind === 'NORM_X') {
          dbTitle = `Int → Real`;
          headerText = 'NORM_X';
          leftPin1 = 'EN';
          leftPin2 = `${node.min}..${node.max}`;
          rightPin1 = 'ENO';
          rightPin2 = 'OUT';
        } else {
          dbTitle = `Real → ${node.unit ?? 'Eng'}`;
          headerText = 'SCALE_X';
          leftPin1 = 'EN';
          leftPin2 = `${node.min}..${node.max}${node.unit ?? ''}`;
          rightPin1 = 'ENO';
          rightPin2 = 'OUT';
        }

        const isTimingOrActive = st.active || st.powerOut;
        const borderCol = st.powerOut
          ? COLOR_ON
          : isTimingOrActive
          ? COLOR_CYAN
          : '#475569';

        return (
          <g key={`${keyPrefix}-${node.id}`}>
            {/* IN / EN wire */}
            {renderWire(x, wireY, bx, wireY, st.powerIn, `${keyPrefix}-${node.id}-in`)}
            {/* Q / ENO wire */}
            {renderWire(bx + bw, wireY, x + BLOCK_W, wireY, st.powerOut, `${keyPrefix}-${node.id}-out`)}

            {/* DB Instance Title above block */}
            <text
              x={bx + bw / 2}
              y={by - 6}
              textAnchor="middle"
              fill="#38bdf8"
              fontSize={11.2}
              fontWeight={700}
              fontFamily="ui-monospace, Consolas, monospace"
            >
              {dbTitle}
            </text>

            {/* Main Block Rect */}
            <rect
              x={bx}
              y={by}
              width={bw}
              height={bh}
              rx={7}
              fill={st.powerOut ? 'rgba(16, 185, 129, 0.13)' : 'rgba(15, 23, 42, 0.94)'}
              stroke={borderCol}
              strokeWidth={st.powerOut ? 2.2 : 1.6}
              filter={st.powerOut ? `url(#${glowId})` : undefined}
            />

            {/* Header strip */}
            <rect
              x={bx}
              y={by}
              width={bw}
              height={21}
              rx={6}
              fill={
                st.powerOut
                  ? 'rgba(16, 185, 129, 0.28)'
                  : isTimingOrActive
                  ? 'rgba(56, 189, 248, 0.22)'
                  : 'rgba(30, 41, 59, 0.96)'
              }
            />
            <text
              x={bx + bw / 2}
              y={by + 14.5}
              textAnchor="middle"
              fill={st.powerOut ? '#a7f3d0' : '#f1f5f9'}
              fontSize={11}
              fontWeight={800}
              fontFamily="ui-monospace, Consolas, monospace"
            >
              {headerText}
            </text>

            {/* Pin labels */}
            <text
              x={bx + 7}
              y={wireY + 3}
              fill={st.powerIn ? '#6ee7b7' : '#94a3b8'}
              fontSize={11}
              fontWeight={700}
              fontFamily="ui-monospace, Consolas, monospace"
            >
              {leftPin1}
            </text>
            <text
              x={bx + bw - 7}
              y={wireY + 3}
              textAnchor="end"
              fill={st.powerOut ? '#6ee7b7' : '#94a3b8'}
              fontSize={11}
              fontWeight={700}
              fontFamily="ui-monospace, Consolas, monospace"
            >
              {rightPin1}
            </text>

            <text
              x={bx + 7}
              y={by + 44}
              fill="#94a3b8"
              fontSize={11}
              fontFamily="ui-monospace, Consolas, monospace"
            >
              {leftPin2}
            </text>
            <text
              x={bx + bw - 7}
              y={by + 44}
              textAnchor="end"
              fill="#94a3b8"
              fontSize={11}
              fontFamily="ui-monospace, Consolas, monospace"
            >
              {rightPin2}
            </text>

            {/* Live progress bar inside block */}
            <rect
              x={bx + 9}
              y={by + 53}
              width={bw - 18}
              height={11}
              rx={5.5}
              fill="rgba(30, 41, 59, 0.95)"
              stroke="rgba(148, 163, 184, 0.25)"
              strokeWidth={1}
            />
            {pct > 0 && (
              <rect
                x={bx + 9}
                y={by + 53}
                width={Math.max(6, (bw - 18) * pct)}
                height={11}
                rx={5.5}
                fill={st.powerOut ? COLOR_ON : COLOR_CYAN}
              />
            )}

            {/* Primary live value readout */}
            <text
              x={bx + bw / 2}
              y={by + 79}
              textAnchor="middle"
              fill={st.powerOut ? '#6ee7b7' : '#e2e8f0'}
              fontSize={10.5}
              fontWeight={700}
              fontFamily="ui-monospace, Consolas, monospace"
            >
              {st.valueText ?? '--'}
            </text>
          </g>
        );
      }

      case 'OTE':
      case 'SET':
      case 'RESET': {
        const def = tagMap.get(node.tag);
        const addr = def?.address ?? '';
        const midX = x + CONTACT_W / 2;
        const r = 13;
        const energized = st.powerIn;
        const coilCol = energized
          ? node.kind === 'RESET'
            ? COLOR_WARN
            : COLOR_ON
          : st.active
          ? '#34d399'
          : '#64748b';

        return (
          <g key={`${keyPrefix}-${node.id}`}>
            {/* Left lead into coil */}
            {renderWire(x, wireY, midX - r - 2, wireY, energized, `${keyPrefix}-${node.id}-in`)}
            {/* Right tail */}
            <line
              x1={midX + r + 2}
              y1={wireY}
              x2={x + CONTACT_W}
              y2={wireY}
              stroke={energized ? COLOR_ON : COLOR_OFF}
              strokeWidth={energized ? 2.5 : 1.8}
              strokeDasharray={energized ? undefined : '4 4'}
            />

            {/* Active glowing aura */}
            {energized && (
              <circle
                cx={midX}
                cy={wireY}
                r={15}
                fill={node.kind === 'RESET' ? 'rgba(245,158,11,0.22)' : 'rgba(16,185,129,0.24)'}
                filter={`url(#${glowId})`}
              />
            )}

            {/* Curved coil parentheses ( ) */}
            <path
              d={`M ${midX - 8} ${wireY - 13} Q ${midX - 18} ${wireY} ${midX - 8} ${wireY + 13}`}
              fill="none"
              stroke={coilCol}
              strokeWidth={energized ? 3.2 : 2.4}
              strokeLinecap="round"
            />
            <path
              d={`M ${midX + 8} ${wireY - 13} Q ${midX + 18} ${wireY} ${midX + 8} ${wireY + 13}`}
              fill="none"
              stroke={coilCol}
              strokeWidth={energized ? 3.2 : 2.4}
              strokeLinecap="round"
            />

            {/* Coil symbol inside ( ) */}
            {node.kind !== 'OTE' ? (
              <text
                x={midX}
                y={wireY + 4}
                textAnchor="middle"
                fill={energized ? '#fef08a' : '#e2e8f0'}
                fontSize={12}
                fontWeight={800}
                fontFamily="ui-monospace, Consolas, monospace"
              >
                {node.kind === 'SET' ? 'S' : 'R'}
              </text>
            ) : (
              energized && <circle cx={midX} cy={wireY} r={4} fill={COLOR_ON} />
            )}

            {/* Address & Symbol */}
            <text
              x={midX}
              y={wireY - 26}
              textAnchor="middle"
              fill={addr.startsWith('%Q') ? '#34d399' : '#f59e0b'}
              fontSize={11}
              fontWeight={700}
              fontFamily="ui-monospace, Consolas, monospace"
            >
              {addr}
            </text>
            <text
              x={midX}
              y={wireY - 14}
              textAnchor="middle"
              fill={energized ? '#ecfdf5' : '#cbd5e1'}
              fontSize={10.5}
              fontWeight={600}
              fontFamily="ui-monospace, Consolas, monospace"
            >
              {`"${node.tag}"`}
            </text>
          </g>
        );
      }

      case 'BRANCH': {
        const bMetrics = node.branches.map((b) => measureChain(b));
        const maxSubW = bMetrics.reduce((m, s) => Math.max(m, s.width), CONTACT_W);
        const totalW = maxSubW + BRANCH_PAD_X * 2;
        const leftBusX = x + BRANCH_PAD_X;
        const rightBusX = x + totalW - BRANCH_PAD_X;
        const perBranchState = evalSnapshot.branchStates[node.id] ?? [];

        // Top branch aligns its wireY with parent wireY
        let cursorTop = wireY - (bMetrics[0]?.wireY ?? CONTACT_WIRE_Y);
        const branchWireYs: number[] = [];
        const renderedBranches: React.ReactNode[] = [];

        node.branches.forEach((branchNodes, bIdx) => {
          const bm = bMetrics[bIdx];
          const bWireY = cursorTop + bm.wireY;
          branchWireYs.push(bWireY);
          const bs = perBranchState[bIdx] ?? { powerIn: st.powerIn, powerOut: false };

          // Render sub-chain
          renderedBranches.push(
            renderChain(branchNodes, leftBusX, bWireY, `${keyPrefix}-${node.id}-b${bIdx}`)
          );
          // Trailing bridge wire if this branch is narrower than maxSubW
          if (bm.width < maxSubW) {
            renderedBranches.push(
              renderWire(
                leftBusX + bm.width,
                bWireY,
                rightBusX,
                bWireY,
                bs.powerOut,
                `${keyPrefix}-${node.id}-b${bIdx}-pad`
              )
            );
          }
          cursorTop += bm.height + BRANCH_GAP_Y;
        });

        const firstY = branchWireYs[0] ?? wireY;
        const lastY = branchWireYs[branchWireYs.length - 1] ?? wireY;

        // Determine right bus vertical segment energization cleanly
        const anyLowerEnergized = (idx: number) =>
          perBranchState.slice(idx + 1).some((s) => s.powerOut);

        return (
          <g key={`${keyPrefix}-${node.id}`}>
            {/* Entry horizontal stem */}
            {renderWire(x, wireY, leftBusX, wireY, st.powerIn, `${keyPrefix}-${node.id}-entry`)}
            {/* Left vertical split rail */}
            {branchWireYs.length > 1 &&
              renderWire(
                leftBusX,
                firstY,
                leftBusX,
                lastY,
                st.powerIn,
                `${keyPrefix}-${node.id}-lrail`
              )}

            {/* Sub-branches */}
            {renderedBranches}

            {/* Right vertical merge rail (segment by segment so energy path is accurate) */}
            {branchWireYs.slice(0, -1).map((yTop, idx) => {
              const yBot = branchWireYs[idx + 1];
              const segOn = anyLowerEnergized(idx);
              return renderWire(
                rightBusX,
                yTop,
                rightBusX,
                yBot,
                segOn,
                `${keyPrefix}-${node.id}-rrail-${idx}`
              );
            })}

            {/* Exit horizontal stem */}
            {renderWire(
              rightBusX,
              wireY,
              x + totalW,
              wireY,
              st.powerOut,
              `${keyPrefix}-${node.id}-exit`
            )}
          </g>
        );
      }

      case 'OUTPUT_BRANCH': {
        const oMetrics = node.outputs.map((b) => measureChain(b));
        const leftBusX = x + BRANCH_PAD_X;
        let cursorTop = wireY - (oMetrics[0]?.wireY ?? CONTACT_WIRE_Y);
        const outWireYs: number[] = [];
        const renderedOuts: React.ReactNode[] = [];

        node.outputs.forEach((outChain, oIdx) => {
          const om = oMetrics[oIdx];
          const oWireY = cursorTop + om.wireY;
          outWireYs.push(oWireY);
          renderedOuts.push(
            renderChain(outChain, leftBusX, oWireY, `${keyPrefix}-${node.id}-o${oIdx}`)
          );
          cursorTop += om.height + BRANCH_GAP_Y;
        });

        const firstY = outWireYs[0] ?? wireY;
        const lastY = outWireYs[outWireYs.length - 1] ?? wireY;

        return (
          <g key={`${keyPrefix}-${node.id}`}>
            {renderWire(x, wireY, leftBusX, wireY, st.powerIn, `${keyPrefix}-${node.id}-entry`)}
            {outWireYs.length > 1 &&
              renderWire(
                leftBusX,
                firstY,
                leftBusX,
                lastY,
                st.powerIn,
                `${keyPrefix}-${node.id}-lrail`
              )}
            {renderedOuts}
          </g>
        );
      }
    }
  };

  const renderChain = (
    nodes: LadderNode[],
    startX: number,
    wireY: number,
    keyPrefix: string
  ): React.ReactNode => {
    const items: React.ReactNode[] = [];
    let curX = startX;

    nodes.forEach((node, idx) => {
      const m = measureNode(node);
      const st = evalSnapshot.nodeStates[node.id];
      items.push(renderNode(node, curX, wireY, `${keyPrefix}-n${idx}`));
      curX += m.width;

      if (idx < nodes.length - 1) {
        const segOn = st?.powerOut ?? false;
        items.push(
          renderWire(curX, wireY, curX + NODE_GAP_X, wireY, segOn, `${keyPrefix}-gap-${idx}`)
        );
        curX += NODE_GAP_X;
      }
    });

    return <g key={keyPrefix}>{items}</g>;
  };

  const renderNetwork = (net: LadderNetwork) => {
    // Separate leading conditions/blocks from trailing output node(s) so coils align cleanly on right
    const lastNode = net.nodes[net.nodes.length - 1];
    const hasTrailingOutput = lastNode ? isOutputNode(lastNode) : false;
    const condNodes = hasTrailingOutput ? net.nodes.slice(0, -1) : net.nodes;
    const outNode = hasTrailingOutput ? lastNode : null;

    const condMetrics = measureChain(condNodes);
    const outMetrics = outNode ? measureNode(outNode) : { width: 0, height: CONTACT_H, wireY: CONTACT_WIRE_Y };

    const topPadding = 16;
    const botPadding = 14;
    const mainWireY = topPadding + Math.max(condMetrics.wireY, outMetrics.wireY);
    const belowWire = Math.max(
      condMetrics.height - condMetrics.wireY,
      outMetrics.height - outMetrics.wireY
    );
    const svgHeight = Math.max(compact ? 94 : 106, mainWireY + belowWire + botPadding);

    const startCondX = LEFT_RAIL_X + 20;
    const minCanvasW = compact ? 640 : 760;
    const contentEndCondX = condNodes.length > 0 ? startCondX + condMetrics.width : startCondX;
    const naturalTotalW =
      contentEndCondX + (outNode ? 44 + outMetrics.width : 20) + RIGHT_PAD;
    const svgWidth = Math.max(minCanvasW, naturalTotalW);
    const outX = outNode ? svgWidth - RIGHT_PAD - outMetrics.width : contentEndCondX;

    const lastCondNode = condNodes[condNodes.length - 1];
    const condOutPower = lastCondNode
      ? evalSnapshot.nodeStates[lastCondNode.id]?.powerOut ?? false
      : true;

    const isNetOn = evalSnapshot.networkEnergized[net.id] ?? false;
    const warnings = warningByNetwork.get(net.number) ?? [];
    const isFocused = focusedNetwork === net.number;

    return (
      <div
        key={net.id}
        data-network-number={net.number}
        className={`plc-sim-network ${isNetOn ? 'is-energized' : ''} ${
          warnings.length > 0 ? 'has-warning' : ''
        } ${isFocused ? 'is-focused' : ''}`}
      >
        <div className="plc-sim-network-head">
          <div className="plc-sim-network-title-row">
            <span className="plc-sim-nw-badge">NW {net.number}</span>
            <span className="plc-sim-nw-title">{net.title}</span>
          </div>
          <div className="plc-sim-network-badges">
            {warnings.length > 0 && (
              <span className="plc-sim-pill-warn" title={warnings[0]}>
                <AlertTriangle size={12} /> 双线圈风险
              </span>
            )}
            <span className={`plc-sim-pill-flow ${isNetOn ? 'on' : 'off'}`}>
              <Zap size={11} />
              {isNetOn ? '能流导通' : '断开'}
            </span>
          </div>
        </div>

        {!compact && net.comment && (
          <div className="plc-sim-network-comment">{net.comment}</div>
        )}

        <div className="plc-sim-svg-scroll">
          <svg
            className="plc-sim-svg"
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ minWidth: `${Math.min(svgWidth, compact ? 560 : 680)}px` }}
            role="img"
            aria-label={`Network ${net.number}: ${net.title}`}
          >
            <defs>
              <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2.4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Left L+ Power Rail */}
            <line
              x1={LEFT_RAIL_X}
              y1={8}
              x2={LEFT_RAIL_X}
              y2={svgHeight - 8}
              stroke={running ? COLOR_ON : COLOR_WARN}
              strokeWidth={4}
              strokeLinecap="round"
              filter={running ? `url(#${glowId})` : undefined}
            />
            <text
              x={LEFT_RAIL_X}
              y={svgHeight - 1}
              textAnchor="middle"
              fill={running ? '#6ee7b7' : '#fbbf24'}
              fontSize={10.4}
              fontWeight={700}
              fontFamily="ui-monospace, Consolas, monospace"
            >
              L+
            </text>

            {/* Entry stem from left power rail */}
            {renderWire(LEFT_RAIL_X, mainWireY, startCondX, mainWireY, true, `${net.id}-rail-stem`)}

            {/* Condition / Function Block chain */}
            {condNodes.length > 0 && renderChain(condNodes, startCondX, mainWireY, `${net.id}-cond`)}

            {/* Bridge wire to right-aligned output coil(s) */}
            {outNode && (
              <>
                {renderWire(
                  contentEndCondX,
                  mainWireY,
                  outX,
                  mainWireY,
                  condOutPower,
                  `${net.id}-to-out`
                )}
                {renderNode(outNode, outX, mainWireY, `${net.id}-out`)}
              </>
            )}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="plc-sim-ladder-wrap">
      {evalSnapshot.doubleCoilWarnings.length > 0 && (
        <div className="plc-sim-doublecoil-banner">
          <AlertTriangle size={16} className="plc-sim-dc-icon" />
          <div className="plc-sim-dc-body">
            {evalSnapshot.doubleCoilWarnings.map((w) => (
              <div key={w.tag} className="plc-sim-dc-line">
                {w.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="plc-sim-networks-list">{program.networks.map(renderNetwork)}</div>
    </div>
  );
});
