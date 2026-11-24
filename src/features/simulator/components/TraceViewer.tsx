import React, { useMemo, useState } from 'react';
import { Activity, Pause, Play, Trash2 } from 'lucide-react';
import type { TraceChannelDef, TraceSample } from '../../../core/plc';

interface TraceViewerProps {
  channels: TraceChannelDef[];
  samples: TraceSample[];
  paused: boolean;
  onTogglePause: () => void;
  onClear: () => void;
  compact?: boolean;
}

const LANE_H = 38;
const LANE_GAP = 6;
const LABEL_W = 136;
const PLOT_W = 540;
const RIGHT_PAD = 14;
const TOP_PAD = 12;
const BOT_PAD = 16;

export const TraceViewer: React.FC<TraceViewerProps> = ({
  channels,
  samples,
  paused,
  onTogglePause,
  onClear,
  compact = false,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const svgWidth = LABEL_W + PLOT_W + RIGHT_PAD;
  const svgHeight = TOP_PAD + channels.length * (LANE_H + LANE_GAP) + BOT_PAD;

  const latestSample = samples[samples.length - 1];
  const inspectedSample =
    hoverIdx !== null && samples[hoverIdx] ? samples[hoverIdx] : latestSample;

  const paths = useMemo(() => {
    const count = samples.length;
    const maxSlots = Math.max(24, count);

    return channels.map((ch, cIdx) => {
      const laneTop = TOP_PAD + cIdx * (LANE_H + LANE_GAP);
      const yHigh = laneTop + 7;
      const yLow = laneTop + LANE_H - 6;

      if (count === 0) {
        return { ch, laneTop, yHigh, yLow, strokePath: '', fillPath: '' };
      }

      const xFor = (i: number) =>
        LABEL_W + (count <= 1 ? PLOT_W : (i / (maxSlots - 1)) * PLOT_W);

      if (ch.kind === 'bool') {
        let d = '';
        let fill = '';
        let prevY = yLow;

        for (let i = 0; i < count; i++) {
          const val = Boolean(samples[i].values[ch.tag]);
          const x = xFor(i);
          const y = val ? yHigh : yLow;

          if (i === 0) {
            d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
            fill += `M ${x.toFixed(1)} ${yLow.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
          } else {
            // Crisp 90-degree digital edge step
            if (y !== prevY) {
              d += ` L ${x.toFixed(1)} ${prevY.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
              fill += ` L ${x.toFixed(1)} ${prevY.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
            } else {
              d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
              fill += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
            }
          }
          prevY = y;
        }
        const lastX = xFor(count - 1);
        fill += ` L ${lastX.toFixed(1)} ${yLow.toFixed(1)} Z`;

        return { ch, laneTop, yHigh, yLow, strokePath: d, fillPath: fill };
      } else {
        const min = ch.min ?? 0;
        const max = ch.max ?? 100;
        const span = Math.max(1e-6, max - min);

        let d = '';
        let fill = '';
        for (let i = 0; i < count; i++) {
          const raw = Number(samples[i].values[ch.tag] ?? 0);
          const norm = Math.max(0, Math.min(1, (raw - min) / span));
          const x = xFor(i);
          const y = yLow - norm * (yLow - yHigh);
          if (i === 0) {
            d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
            fill += `M ${x.toFixed(1)} ${yLow.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
          } else {
            d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
            fill += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
          }
        }
        const lastX = xFor(count - 1);
        fill += ` L ${lastX.toFixed(1)} ${yLow.toFixed(1)} Z`;

        return { ch, laneTop, yHigh, yLow, strokePath: d, fillPath: fill };
      }
    });
  }, [channels, samples]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (samples.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = svgWidth / rect.width;
    const svgX = (e.clientX - rect.left) * scaleX;
    if (svgX < LABEL_W || svgX > LABEL_W + PLOT_W) {
      setHoverIdx(null);
      return;
    }
    const maxSlots = Math.max(24, samples.length);
    const ratio = (svgX - LABEL_W) / PLOT_W;
    const idx = Math.round(ratio * (maxSlots - 1));
    if (idx >= 0 && idx < samples.length) {
      setHoverIdx(idx);
    } else {
      setHoverIdx(null);
    }
  };

  const hoverX =
    hoverIdx !== null && samples.length > 1
      ? LABEL_W + (hoverIdx / (Math.max(24, samples.length) - 1)) * PLOT_W
      : null;

  return (
    <div className={`plc-sim-trace ${compact ? 'is-compact' : ''}`}>
      <div className="plc-sim-dock-head">
        <div className="plc-sim-dock-title">
          <Activity size={14} />
          <span>实时时序示波器 (Trace 逻辑分析仪)</span>
          <span className="plc-sim-trace-meta">
            {inspectedSample ? `周期 #${inspectedSample.cycle}` : '等待采样'} · {samples.length}/120 点
          </span>
        </div>
        <div className="plc-sim-dock-actions">
          <button
            type="button"
            className={`plc-sim-mini-btn ${paused ? 'is-warn' : ''}`}
            onClick={onTogglePause}
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
            {paused ? '继续采样' : '暂停抓拍'}
          </button>
          <button type="button" className="plc-sim-mini-btn" onClick={onClear}>
            <Trash2 size={12} /> 清空
          </button>
        </div>
      </div>

      <div className="plc-sim-trace-body">
        <svg
          className="plc-sim-trace-svg"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Plot background */}
          <rect
            x={LABEL_W}
            y={TOP_PAD - 4}
            width={PLOT_W}
            height={svgHeight - TOP_PAD - BOT_PAD + 4}
            rx={6}
            fill="rgba(7, 13, 25, 0.9)"
            stroke="rgba(51, 65, 85, 0.7)"
            strokeWidth={1}
          />

          {/* Vertical scan grid lines */}
          {[0.2, 0.4, 0.6, 0.8].map((r) => (
            <line
              key={r}
              x1={LABEL_W + PLOT_W * r}
              y1={TOP_PAD - 4}
              x2={LABEL_W + PLOT_W * r}
              y2={svgHeight - BOT_PAD}
              stroke="rgba(51, 65, 85, 0.42)"
              strokeDasharray="3 4"
            />
          ))}

          {/* Lanes */}
          {paths.map(({ ch, laneTop, yLow, strokePath, fillPath }) => {
            const curVal = inspectedSample?.values[ch.tag];
            const valLabel =
              ch.kind === 'bool'
                ? curVal
                  ? '1'
                  : '0'
                : `${typeof curVal === 'number' ? Number(curVal.toFixed(1)) : 0}${ch.unit ?? ''}`;

            return (
              <g key={ch.id}>
                {/* Lane separator */}
                <line
                  x1={LABEL_W}
                  y1={yLow}
                  x2={LABEL_W + PLOT_W}
                  y2={yLow}
                  stroke="rgba(51, 65, 85, 0.45)"
                  strokeWidth={1}
                />

                {/* Left channel label */}
                <circle cx={10} cy={laneTop + 14} r={4} fill={ch.color} />
                <text
                  x={19}
                  y={laneTop + 16}
                  fill="#e2e8f0"
                  fontSize={10.5}
                  fontWeight={600}
                >
                  {ch.label}
                </text>
                <text
                  x={19}
                  y={laneTop + 30}
                  fill="#94a3b8"
                  fontSize={11}
                  fontFamily="ui-monospace, Consolas, monospace"
                >
                  {ch.address}
                </text>

                {/* Live value pill on left */}
                <text
                  x={LABEL_W - 8}
                  y={laneTop + 23}
                  textAnchor="end"
                  fill={ch.kind === 'bool' ? (curVal ? ch.color : '#64748b') : ch.color}
                  fontSize={10.5}
                  fontWeight={700}
                  fontFamily="ui-monospace, Consolas, monospace"
                >
                  {valLabel}
                </text>

                {/* Waveform fill & crisp trace */}
                {fillPath && <path d={fillPath} fill={ch.color} fillOpacity={0.14} />}
                {strokePath && (
                  <path
                    d={strokePath}
                    fill="none"
                    stroke={ch.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                  />
                )}
              </g>
            );
          })}

          {/* Hover crosshair */}
          {hoverX !== null && (
            <line
              x1={hoverX}
              y1={TOP_PAD - 4}
              x2={hoverX}
              y2={svgHeight - BOT_PAD}
              stroke="#e2e8f0"
              strokeWidth={1.2}
              strokeDasharray="3 2"
            />
          )}
        </svg>
      </div>
    </div>
  );
};
