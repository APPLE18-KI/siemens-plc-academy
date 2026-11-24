import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Wrench,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import '../models.css';

export type TwinControlMode = 'auto' | 'manual';

export interface IoSignalItem {
  address: string;
  symbol: string;
  label: string;
  kind: 'I' | 'Q' | 'IW' | 'QW';
  value: boolean | number;
  unit?: string;
  fault?: boolean;
  /** When mode === 'manual' and onToggle is supplied, clicking forces the signal */
  onToggle?: () => void;
}

export interface ParamSliderItem {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (next: number) => void;
}

export interface FaultSwitchItem {
  id: string;
  label: string;
  active: boolean;
  onToggle: () => void;
}

export interface TwinShellProps {
  title: string;
  subtitle: string;
  status: 'run' | 'stop' | 'fault';
  statusText: string;
  mode: TwinControlMode;
  onModeChange: (next: TwinControlMode) => void;
  paused?: boolean;
  onTogglePause?: () => void;
  onReset: () => void;
  embedded?: boolean;
  banner?: {
    tone: 'danger' | 'warn' | 'ok';
    text: string;
    actionLabel?: string;
    onAction?: () => void;
  };
  /** Custom action toolbar placed directly below the SVG viewport */
  actionBar?: React.ReactNode;
  ioSignals: IoSignalItem[];
  sliders: ParamSliderItem[];
  faults: FaultSwitchItem[];
  children: React.ReactNode;
}

const ZOOM_LEVELS = [100, 130, 165] as const;

export const TwinShell: React.FC<TwinShellProps> = ({
  title,
  subtitle,
  status,
  statusText,
  mode,
  onModeChange,
  paused = false,
  onTogglePause,
  onReset,
  embedded = false,
  banner,
  actionBar,
  ioSignals,
  sliders,
  faults,
  children,
}) => {
  const [zoomIdx, setZoomIdx] = useState<number>(0);
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const zoomPct = ZOOM_LEVELS[zoomIdx];

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const shellContent = (
    <div
      className={`dt-root dt-shell ${embedded ? 'dt-shell--embedded' : ''} ${
        fullscreen ? 'dt-shell--fullscreen' : ''
      }`}
    >
      {/* SCADA Header Bar */}
      <div className="dt-topbar">
        <div className="dt-topbar-left">
          <span className={`dt-status-pill dt-status-pill--${status}`}>
            <span className={`dt-led dt-led--${status}`} />
            {statusText}
          </span>
          <div className="dt-title-group">
            <h3 className="dt-title">{title}</h3>
            {(!embedded || fullscreen) && <p className="dt-subtitle">{subtitle}</p>}
          </div>
        </div>

        <div className="dt-topbar-controls">
          <div className="dt-mode-switch" role="group" aria-label="控制模式切换">
            <button
              type="button"
              className={`dt-mode-btn ${mode === 'auto' ? 'dt-mode-btn--active-auto' : ''}`}
              onClick={() => onModeChange('auto')}
            >
              <Cpu size={13} />
              PLC 自动
            </button>
            <button
              type="button"
              className={`dt-mode-btn ${mode === 'manual' ? 'dt-mode-btn--active-manual' : ''}`}
              onClick={() => onModeChange('manual')}
            >
              <Wrench size={13} />
              手动强制
            </button>
          </div>

          {onTogglePause && (
            <button type="button" className="dt-btn" onClick={onTogglePause}>
              {paused ? <Play size={13} /> : <Pause size={13} />}
              {paused ? '继续' : '暂停'}
            </button>
          )}

          <button type="button" className="dt-btn" onClick={onReset}>
            <RotateCcw size={13} />
            复位
          </button>

          <button
            type="button"
            className={`dt-btn ${fullscreen ? 'dt-btn--primary' : ''}`}
            onClick={() => setFullscreen((f) => !f)}
            title={fullscreen ? '退出全屏视图 (Esc)' : '全屏高清展开数字孪生'}
          >
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {fullscreen ? '退出全屏' : '全屏高清'}
          </button>
        </div>
      </div>

      {/* Live Diagnostic / Fault Banner */}
      {banner && (
        <div
          className={`dt-alarm-banner ${
            banner.tone === 'warn'
              ? 'dt-alarm-banner--warn'
              : banner.tone === 'ok'
                ? 'dt-alarm-banner--ok'
                : ''
          }`}
        >
          <div className="dt-alarm-text">
            {banner.tone === 'ok' ? (
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            ) : (
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            )}
            <span>{banner.text}</span>
          </div>
          {banner.actionLabel && banner.onAction && (
            <button
              type="button"
              className={`dt-btn ${banner.tone === 'danger' ? 'dt-btn--danger' : 'dt-btn--primary'}`}
              onClick={banner.onAction}
            >
              {banner.actionLabel}
            </button>
          )}
        </div>
      )}

      {/* High-Precision SCADA SVG Canvas with HD Zoom & Smooth Touch Pan */}
      <div className="dt-stage-wrap">
        <div className="dt-stage-hud">
          <span className="dt-pan-hint">⇄ 可左右滑动 · 点击画面元件直接交互</span>
          <div className="dt-zoom-bar" role="group" aria-label="图纸清晰度缩放">
            <button
              type="button"
              className="dt-zoom-btn"
              onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
              disabled={zoomIdx === 0}
              title="缩小画布"
            >
              <ZoomOut size={13} />
            </button>
            <button
              type="button"
              className="dt-zoom-readout"
              onClick={() => setZoomIdx((i) => (i + 1) % ZOOM_LEVELS.length)}
              title="点击切换 100% / 130% / 165% 高清特写"
            >
              {zoomPct}% 高清
            </button>
            <button
              type="button"
              className="dt-zoom-btn"
              onClick={() => setZoomIdx((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
              disabled={zoomIdx === ZOOM_LEVELS.length - 1}
              title="放大查看端子与字号细节"
            >
              <ZoomIn size={13} />
            </button>
          </div>
        </div>

        <div className="dt-stage-scroll">
          <div
            className="dt-stage-canvas"
            style={{
              width: `${zoomPct}%`,
              minWidth: `${Math.round(820 * (zoomPct / 100))}px`,
            }}
          >
            <div className="dt-stage-grid" />
            {children}
          </div>
        </div>
      </div>

      {/* Interactive Field Operation Toolbar */}
      {actionBar && <div className="dt-action-bar">{actionBar}</div>}

      {/* Real-time PLC I/O Signal Monitor Strip */}
      <div className="dt-io-strip">
        <div className="dt-section-head">
          <span className="dt-section-title">
            <Activity size={14} color="#00c4c4" />
            实时 PLC I/O 映像区监控（%I / %Q / %IW / %QW）
          </span>
          <span className="dt-section-hint">
            {mode === 'manual'
              ? '手动强制调试中：点击带 ✋ 信号直接强制 0/1 状态'
              : '蓝色为输入 %I · 荧光绿为输出 %Q · 紫色为模拟量'}
          </span>
        </div>

        <div className="dt-io-grid">
          {ioSignals.map((sig) => {
            const isAnalog = sig.kind === 'IW' || sig.kind === 'QW';
            const isOn = typeof sig.value === 'boolean' ? sig.value : sig.value !== 0;
            const canClick = mode === 'manual' && Boolean(sig.onToggle);

            let chipClass = 'dt-io-chip';
            if (canClick) chipClass += ' dt-io-chip--clickable';
            if (sig.fault) {
              chipClass += ' dt-io-chip--fault';
            } else if (isAnalog) {
              chipClass += ' dt-io-chip--analog';
            } else if (isOn) {
              chipClass += sig.kind === 'I' ? ' dt-io-chip--on-i' : ' dt-io-chip--on-q';
            }

            let valClass = 'dt-io-val dt-io-val--0';
            if (isAnalog) {
              valClass = 'dt-io-val dt-io-val--analog';
            } else if (isOn) {
              valClass = sig.kind === 'I' ? 'dt-io-val dt-io-val--1-i' : 'dt-io-val dt-io-val--1-q';
            }

            const displayVal = isAnalog
              ? `${typeof sig.value === 'number' ? Math.round(sig.value) : 0}${sig.unit ? ` ${sig.unit}` : ''}`
              : isOn
                ? '1'
                : '0';

            return (
              <button
                key={`${sig.address}-${sig.symbol}`}
                type="button"
                className={chipClass}
                onClick={canClick ? sig.onToggle : undefined}
                disabled={!canClick}
                title={`${sig.address} (${sig.symbol}) — ${sig.label}${canClick ? ' [点击强制翻转]' : ''}`}
              >
                <div className="dt-io-meta">
                  <span className="dt-io-addr">
                    {sig.address}
                    {canClick ? ' ✋' : ''}
                  </span>
                  <span className="dt-io-label">{sig.label}</span>
                </div>
                <span className={valClass}>{displayVal}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lower Interactive Deck: Physical Parameters + Field Fault Injection */}
      <div className="dt-deck">
        <div className="dt-deck-pane">
          <div className="dt-section-head">
            <span className="dt-section-title">
              <Sliders size={14} color="#38bdf8" />
              物理参数与工艺设定调节
            </span>
          </div>
          <div className="dt-sliders">
            {sliders.map((s) => (
              <label key={s.id} className="dt-slider-row">
                <div className="dt-slider-header">
                  <span className="dt-slider-name">{s.label}</span>
                  <span className="dt-slider-value">
                    {Number.isInteger(s.step) ? s.value : s.value.toFixed(1)}
                    {s.unit ? ` ${s.unit}` : ''}
                  </span>
                </div>
                <input
                  type="range"
                  className="dt-range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={s.value}
                  onChange={(e) => s.onChange(Number(e.target.value))}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="dt-deck-pane">
          <div className="dt-section-head">
            <span className="dt-section-title">
              <AlertTriangle size={14} color="#f59e0b" />
              现场异常与故障注入实训台
            </span>
          </div>
          <div className="dt-fault-list">
            {faults.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`dt-fault-btn ${f.active ? 'dt-fault-btn--active' : ''}`}
                onClick={f.onToggle}
              >
                <span className="dt-fault-name">{f.label}</span>
                <span className={`dt-fault-badge ${f.active ? 'dt-fault-badge--on' : ''}`}>
                  {f.active ? '已触发 · 点击恢复' : '注入故障'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="dt-fullscreen-backdrop" role="dialog" aria-modal="true" aria-label={title}>
        {shellContent}
      </div>
    );
  }

  return shellContent;
};
