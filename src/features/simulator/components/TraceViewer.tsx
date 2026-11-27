import React, { memo, useCallback, useMemo, useState } from 'react';
import { Activity, Crosshair, Download, Pause, Play, Trash2, X } from 'lucide-react';
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
const TOP_PAD = 16;
const BOT_PAD = 18;

function formatChannelVal(ch: TraceChannelDef, v: number | boolean | undefined): string {
  if (ch.kind === 'bool') return v ? '1' : '0';
  const num = typeof v === 'number' ? Number(v.toFixed(1)) : 0;
  return `${num}${ch.unit ?? ''}`;
}

function escapeCsvCell(text: string): string {
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export const TraceViewer: React.FC<TraceViewerProps> = memo(function TraceViewer({
  channels,
  samples,
  paused,
  onTogglePause,
  onClear,
  compact = false,
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [cursorACycle, setCursorACycle] = useState<number | null>(null);
  const [cursorBCycle, setCursorBCycle] = useState<number | null>(null);

  const svgWidth = LABEL_W + PLOT_W + RIGHT_PAD;
  const svgHeight = TOP_PAD + channels.length * (LANE_H + LANE_GAP) + BOT_PAD;
  const maxSlots = Math.max(24, samples.length);

  const xForIndex = useCallback(
    (i: number) =>
      LABEL_W + (samples.length <= 1 ? PLOT_W : (i / (maxSlots - 1)) * PLOT_W),
    [samples.length, maxSlots],
  );

  // Map cycle -> index once for O(1) cursor lookup across ring buffer shifts (js-index-maps)
  const indexByCycle = useMemo(() => {
    const map = new Map<number, number>();
    for (let i = 0; i < samples.length; i++) map.set(samples[i].cycle, i);
    return map;
  }, [samples]);

  const cursorAIdx = cursorACycle !== null ? (indexByCycle.get(cursorACycle) ?? null) : null;
  const cursorBIdx = cursorBCycle !== null ? (indexByCycle.get(cursorBCycle) ?? null) : null;
  const cursorASample = cursorAIdx !== null ? samples[cursorAIdx] : null;
  const cursorBSample = cursorBIdx !== null ? samples[cursorBIdx] : null;

  const latestSample = samples[samples.length - 1];
  const inspectedSample =
    hoverIdx !== null && samples[hoverIdx]
      ? samples[hoverIdx]
      : cursorBSample ?? cursorASample ?? latestSample;

  const paths = useMemo(() => {
    const count = samples.length;
    const slots = Math.max(24, count);

    return channels.map((ch, cIdx) => {
      const laneTop = TOP_PAD + cIdx * (LANE_H + LANE_GAP);
      const yHigh = laneTop + 7;
      const yLow = laneTop + LANE_H - 6;
      if (count === 0) return { ch, laneTop, yHigh, yLow, strokePath: '', fillPath: '' };

      const xFor = (i: number) => LABEL_W + (count <= 1 ? PLOT_W : (i / (slots - 1)) * PLOT_W);
      let d = '';
      let fill = '';

      if (ch.kind === 'bool') {
        let prevY = yLow;
        for (let i = 0; i < count; i++) {
          const x = xFor(i);
          const y = Boolean(samples[i].values[ch.tag]) ? yHigh : yLow;
          if (i === 0) {
            d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
            fill = `M ${x.toFixed(1)} ${yLow.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
          } else if (y !== prevY) {
            d += ` L ${x.toFixed(1)} ${prevY.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
            fill += ` L ${x.toFixed(1)} ${prevY.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
          } else {
            d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
            fill += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
          }
          prevY = y;
        }
      } else {
        const min = ch.min ?? 0;
        const max = ch.max ?? 100;
        const span = Math.max(1e-6, max - min);
        for (let i = 0; i < count; i++) {
          const raw = Number(samples[i].values[ch.tag] ?? 0);
          const norm = Math.max(0, Math.min(1, (raw - min) / span));
          const x = xFor(i);
          const y = yLow - norm * (yLow - yHigh);
          if (i === 0) {
            d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
            fill = `M ${x.toFixed(1)} ${yLow.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
          } else {
            d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
            fill += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
          }
        }
      }
      fill += ` L ${xFor(count - 1).toFixed(1)} ${yLow.toFixed(1)} Z`;
      return { ch, laneTop, yHigh, yLow, strokePath: d, fillPath: fill };
    });
  }, [channels, samples]);

  const sampleIndexFromClientX = useCallback(
    (svg: SVGSVGElement, clientX: number): number | null => {
      if (samples.length < 2) return samples.length === 1 ? 0 : null;
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0) return null;
      const svgX = ((clientX - rect.left) * svgWidth) / rect.width;
      if (svgX < LABEL_W || svgX > LABEL_W + PLOT_W) return null;
      const idx = Math.round(((svgX - LABEL_W) / PLOT_W) * (maxSlots - 1));
      return idx >= 0 && idx < samples.length ? idx : null;
    },
    [samples.length, svgWidth, maxSlots],
  );

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    setHoverIdx(sampleIndexFromClientX(e.currentTarget, e.clientX));
  };

  const handlePlotClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const idx = sampleIndexFromClientX(e.currentTarget, e.clientX);
    if (idx === null || !samples[idx]) return;
    const cyc = samples[idx].cycle;
    if (cursorACycle === null || (cursorACycle !== null && cursorBCycle !== null)) {
      setCursorACycle(cyc);
      setCursorBCycle(null);
    } else {
      setCursorBCycle(cyc);
    }
  };

  const handleClearCursors = () => {
    setCursorACycle(null);
    setCursorBCycle(null);
  };

  const handleClearAll = () => {
    handleClearCursors();
    setHoverIdx(null);
    onClear();
  };

  const handleExportCsv = () => {
    if (samples.length === 0) return;
    const headers = [
      'ScanCycle',
      'Time_ms',
      ...channels.map((c) => `${c.label}(${c.address})`),
    ];
    const rows = [headers.map(escapeCsvCell).join(',')];
    for (const s of samples) {
      const cells = [
        String(s.cycle),
        String(Math.round(s.timeMs)),
        ...channels.map((c) => {
          const v = s.values[c.tag];
          if (c.kind === 'bool') return v ? '1' : '0';
          return typeof v === 'number' ? String(Number(v.toFixed(3))) : '0';
        }),
      ];
      rows.push(cells.join(','));
    }
    const blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plc-trace-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hoverX = hoverIdx !== null && samples.length > 1 ? xForIndex(hoverIdx) : null;
  const cursorAX = cursorAIdx !== null ? xForIndex(cursorAIdx) : null;
  const cursorBX = cursorBIdx !== null ? xForIndex(cursorBIdx) : null;
  const deltaMs = cursorASample && cursorBSample ? Math.abs(cursorBSample.timeMs - cursorASample.timeMs) : null;
  const deltaCycles = cursorASample && cursorBSample ? Math.abs(cursorBSample.cycle - cursorASample.cycle) : null;

  return (
    <div className={`plc-sim-trace ${compact ? 'is-compact' : ''}`}>
      <div className="plc-sim-dock-head">
        <div className="plc-sim-dock-title">
          <Activity size={14} aria-hidden />
          <span>实时时序示波器 (Trace 逻辑分析仪)</span>
          <span className="plc-sim-trace-meta">
            {inspectedSample ? `周期 #${inspectedSample.cycle} · ${Math.round(inspectedSample.timeMs)}ms` : '等待采样'} · {samples.length}/120 点
          </span>
        </div>
        <div className="plc-sim-dock-actions">
          {(cursorACycle !== null || cursorBCycle !== null) && (
            <button type="button" className="plc-sim-mini-btn" onClick={handleClearCursors} title="清除测量游标 A/B">
              <X size={12} /> 清除游标
            </button>
          )}
          <button type="button" className={`plc-sim-mini-btn ${paused ? 'is-warn' : ''}`} onClick={onTogglePause}>
            {paused ? <Play size={12} /> : <Pause size={12} />}
            {paused ? '继续采样' : '暂停抓拍'}
          </button>
          <button type="button" className="plc-sim-mini-btn" onClick={handleExportCsv} disabled={samples.length === 0} title="导出当前缓冲区波形为 CSV 文件">
            <Download size={12} /> 导出 CSV
          </button>
          <button type="button" className="plc-sim-mini-btn" onClick={handleClearAll}>
            <Trash2 size={12} /> 清空
          </button>
        </div>
      </div>

      {/* Dual-Cursor Δt & Hover Measurement Strip */}
      <div className="plc-trace-measure-bar" aria-live="polite">
        <div className="plc-trace-cursors">
          <Crosshair size={13} aria-hidden />
          {cursorASample && cursorBSample && deltaMs !== null && deltaCycles !== null ? (
            <>
              <span className="plc-cur-pill is-a">A #{cursorASample.cycle} ({Math.round(cursorASample.timeMs)}ms)</span>
              <span className="plc-cur-pill is-b">B #{cursorBSample.cycle} ({Math.round(cursorBSample.timeMs)}ms)</span>
              <span className="plc-cur-delta">
                Δt = <b>{Math.round(deltaMs)} ms</b> ({(deltaMs / 1000).toFixed(2)}s) · Δ周期 = <b>{deltaCycles}</b>
              </span>
            </>
          ) : cursorASample ? (
            <>
              <span className="plc-cur-pill is-a">A #{cursorASample.cycle} ({Math.round(cursorASample.timeMs)}ms)</span>
              <span className="plc-cur-hint">再点击波形任意处放置游标 B 计算 Δt</span>
            </>
          ) : (
            <span className="plc-cur-hint">点击波形可放置双游标 A/B 测时间差 Δt 与扫描周期差（建议先暂停抓拍）</span>
          )}
        </div>
        {inspectedSample && !compact && (
          <div className="plc-trace-readout-pills">
            {channels.map((ch) => (
              <span key={ch.id} className="plc-trace-val-chip">
                <i style={{ background: ch.color }} />
                <span>{ch.label}:</span>
                <b>{formatChannelVal(ch, inspectedSample.values[ch.tag])}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="plc-sim-trace-body">
        <svg
          className="plc-sim-trace-svg"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
          onClick={handlePlotClick}
          role="img"
          aria-label="PLC 实时时序示波器波形（点击放置游标 A/B）"
        >
          <rect
            x={LABEL_W} y={TOP_PAD - 4} width={PLOT_W} height={svgHeight - TOP_PAD - BOT_PAD + 4}
            rx={6} fill="rgba(7, 13, 25, 0.9)" stroke="rgba(51, 65, 85, 0.7)" strokeWidth={1}
          />
          {[0.2, 0.4, 0.6, 0.8].map((r) => (
            <line
              key={r} x1={LABEL_W + PLOT_W * r} y1={TOP_PAD - 4} x2={LABEL_W + PLOT_W * r} y2={svgHeight - BOT_PAD}
              stroke="rgba(51, 65, 85, 0.42)" strokeDasharray="3 4"
            />
          ))}

          {/* Shaded Δt span between Cursor A and Cursor B */}
          {cursorAX !== null && cursorBX !== null && (
            <rect
              x={Math.min(cursorAX, cursorBX)} y={TOP_PAD - 4}
              width={Math.max(1, Math.abs(cursorBX - cursorAX))} height={svgHeight - TOP_PAD - BOT_PAD + 4}
              fill="rgba(56, 189, 248, 0.12)"
            />
          )}

          {paths.map(({ ch, laneTop, yLow, strokePath, fillPath }) => {
            const curVal = inspectedSample?.values[ch.tag];
            return (
              <g key={ch.id}>
                <line x1={LABEL_W} y1={yLow} x2={LABEL_W + PLOT_W} y2={yLow} stroke="rgba(51, 65, 85, 0.45)" strokeWidth={1} />
                <circle cx={10} cy={laneTop + 14} r={4} fill={ch.color} />
                <text x={19} y={laneTop + 16} fill="#e2e8f0" fontSize={10.5} fontWeight={600}>{ch.label}</text>
                <text x={19} y={laneTop + 30} fill="#94a3b8" fontSize={11} fontFamily="ui-monospace, Consolas, monospace">{ch.address}</text>
                <text
                  x={LABEL_W - 8} y={laneTop + 23} textAnchor="end"
                  fill={ch.kind === 'bool' ? (curVal ? ch.color : '#64748b') : ch.color}
                  fontSize={10.5} fontWeight={700} fontFamily="ui-monospace, Consolas, monospace"
                >
                  {formatChannelVal(ch, curVal)}
                </text>
                {fillPath && <path d={fillPath} fill={ch.color} fillOpacity={0.14} />}
                {strokePath && <path d={strokePath} fill="none" stroke={ch.color} strokeWidth={2} strokeLinejoin="round" />}
              </g>
            );
          })}

          {cursorAX !== null && (
            <g>
              <line x1={cursorAX} y1={TOP_PAD - 4} x2={cursorAX} y2={svgHeight - BOT_PAD} stroke="#38bdf8" strokeWidth={1.6} />
              <text x={cursorAX + 3} y={TOP_PAD + 6} fill="#38bdf8" fontSize={10} fontWeight={700} fontFamily="ui-monospace, monospace">A</text>
            </g>
          )}
          {cursorBX !== null && (
            <g>
              <line x1={cursorBX} y1={TOP_PAD - 4} x2={cursorBX} y2={svgHeight - BOT_PAD} stroke="#f59e0b" strokeWidth={1.6} />
              <text x={cursorBX + 3} y={TOP_PAD + 6} fill="#f59e0b" fontSize={10} fontWeight={700} fontFamily="ui-monospace, monospace">B</text>
            </g>
          )}
          {hoverX !== null && (
            <line x1={hoverX} y1={TOP_PAD - 4} x2={hoverX} y2={svgHeight - BOT_PAD} stroke="#e2e8f0" strokeWidth={1.2} strokeDasharray="3 2" />
          )}
        </svg>
      </div>
    </div>
  );
});
