import React, { memo } from 'react';
import type { ChainNode } from '../data/faultDrillTypes';

interface SignalChainDiagramProps {
  ticketNo: string;
  nodes: [ChainNode, ChainNode, ChainNode, ChainNode];
  edges: [string, string, string];
  /** Only highlight exact fault focal nodes after diagnosis is submitted */
  revealed: boolean;
}

const NODE_W = 148;
const NODE_H = 64;
const NODE_Y = 24;
const NODE_XS = [16, 208, 400, 592] as const;

export const SignalChainDiagram: React.FC<SignalChainDiagramProps> = memo(
  ({ ticketNo, nodes, edges, revealed }) => {
    const slug = ticketNo.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const titleId = `${slug}-chain-title`;
    const descId = `${slug}-chain-desc`;

    return (
      <div className="dt-drill-chain-wrap">
        <div className="dt-drill-chain-head">
          <span className="dt-drill-eyebrow">SIGNAL CHAIN TOPOLOGY · 信号链路示意图</span>
          <span className="dt-drill-chain-state">
            {revealed ? '已定位故障焦点节点' : '盲测态 · 请先用下方仪表采集线索'}
          </span>
        </div>
        <div className="dt-drill-chain-scroll">
          <svg
            className="dt-drill-chain-svg"
            viewBox="0 0 756 108"
            role="img"
            aria-labelledby={`${titleId} ${descId}`}
          >
            <title id={titleId}>{`${ticketNo} 工业控制信号链路拓扑`}</title>
            <desc id={descId}>
              展示从现场传感器或控制回路到 PLC 与执行器的四节点信号流向，并在完成诊断后标出故障焦点。
            </desc>
            <defs>
              <marker
                id={`${slug}-arrow`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" className="dt-chain-arrow-fill" />
              </marker>
              <marker
                id={`${slug}-arrow-fault`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" className="dt-chain-arrow-fault" />
              </marker>
            </defs>

            {/* Connectors drawn BEFORE node boxes (diagram-design rule) */}
            {edges.map((edgeLabel, idx) => {
              const x1 = NODE_XS[idx] + NODE_W;
              const x2 = NODE_XS[idx + 1] - 4;
              const midX = (x1 + x2) / 2;
              const y = NODE_Y + NODE_H / 2;
              const isFaultEdge =
                revealed && (nodes[idx].status === 'fault' || nodes[idx + 1].status === 'fault');
              const shownLabel = revealed ? edgeLabel : '待测';

              return (
                <g key={idx}>
                  <line
                    x1={x1}
                    y1={y}
                    x2={x2}
                    y2={y}
                    className={isFaultEdge ? 'dt-chain-line dt-chain-line--fault' : 'dt-chain-line'}
                    strokeDasharray={revealed ? undefined : '4 3'}
                    markerEnd={`url(#${slug}-${isFaultEdge ? 'arrow-fault' : 'arrow'})`}
                  />
                  {/* Opaque mask rect placed above connector line with clean label gap */}
                  <rect
                    x={midX - 20}
                    y={y - 22}
                    width={40}
                    height={14}
                    rx={2}
                    className="dt-chain-label-mask"
                  />
                  <text
                    x={midX}
                    y={y - 12}
                    textAnchor="middle"
                    className={isFaultEdge ? 'dt-chain-edge-txt dt-chain-edge-txt--fault' : 'dt-chain-edge-txt'}
                  >
                    {shownLabel}
                  </text>
                </g>
              );
            })}

            {/* 4 Orthogonal Grid Nodes */}
            {nodes.map((node, idx) => {
              const x = NODE_XS[idx];
              const tone = revealed ? node.status : 'neutral';
              const tagText = !revealed
                ? `NODE 0${idx + 1}`
                : node.status === 'fault'
                  ? 'FAULT 焦点'
                  : node.status === 'warn'
                    ? 'AFFECTED'
                    : 'NOMINAL';

              return (
                <g key={idx} transform={`translate(${x}, ${NODE_Y})`}>
                  <rect width={NODE_W} height={NODE_H} rx={6} className={`dt-chain-box dt-chain-box--${tone}`} />
                  <rect x={10} y={8} width={64} height={14} rx={2} className={`dt-chain-tag-bg dt-chain-tag-bg--${tone}`} />
                  <text x={14} y={18} className={`dt-chain-tag-txt dt-chain-tag-txt--${tone}`}>
                    {tagText}
                  </text>
                  <text x={10} y={39} className="dt-chain-name">
                    {node.label}
                  </text>
                  <text x={10} y={55} className={`dt-chain-sub dt-chain-sub--${tone}`}>
                    {revealed ? node.sub : '点击下方探针检测'}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  }
);

SignalChainDiagram.displayName = 'SignalChainDiagram';
