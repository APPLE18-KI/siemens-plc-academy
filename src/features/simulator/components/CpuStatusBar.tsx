import React from 'react';
import { Cpu, Play, RotateCcw, Square, StepForward } from 'lucide-react';
import type { ScanMetrics } from '../../../types/plc';
import type { ScanIntervalOption } from '../../../core/plc';

interface CpuStatusBarProps {
  metrics: ScanMetrics;
  intervalMs: ScanIntervalOption;
  onToggleRun: () => void;
  onSingleScan: () => void;
  onChangeInterval: (ms: ScanIntervalOption) => void;
  onReset: () => void;
  compact?: boolean;
  programLabel?: string;
}

const INTERVAL_OPTIONS: { ms: ScanIntervalOption; label: string; title: string }[] = [
  { ms: 20, label: '20ms', title: '高速扫描 (50Hz)' },
  { ms: 50, label: '50ms', title: '标准教学扫描 (20Hz)' },
  { ms: 200, label: '200ms', title: '慢放观察模式 (5Hz)' },
  { ms: 500, label: '500ms 慢放', title: '逐拍教学慢放模式 (2Hz)' },
];

export const CpuStatusBar: React.FC<CpuStatusBarProps> = ({
  metrics,
  intervalMs,
  onToggleRun,
  onSingleScan,
  onChangeInterval,
  onReset,
  compact = false,
  programLabel,
}) => {
  const { running, cycleCount, lastScanMs } = metrics;

  return (
    <div className={`plc-sim-cpu-bar ${compact ? 'is-compact' : ''}`}>
      <div className="plc-sim-cpu-id">
        <div className="plc-sim-cpu-leds" aria-label="S7-1200 CPU LED 指示灯">
          <span
            className={`plc-sim-cpu-led ${running ? 'led-run' : 'led-stop'}`}
            title={running ? 'RUN 运行模式' : 'STOP 停机模式'}
          />
          <span className="plc-sim-cpu-led led-off" title="ERROR 正常" />
          <span className="plc-sim-cpu-led led-off" title="MAINT 正常" />
        </div>
        <div className="plc-sim-cpu-text">
          <div className="plc-sim-cpu-model">
            <Cpu size={13} />
            <span>S7-1200 CPU 1214C</span>
            <span className={`plc-sim-run-pill ${running ? 'is-run' : 'is-stop'}`}>
              {running ? 'RUN' : 'STOP'}
            </span>
          </div>
          {!compact && programLabel && (
            <div className="plc-sim-cpu-sub">OB1 · {programLabel}</div>
          )}
        </div>
      </div>

      {/* Scan Pipeline Telemetry */}
      {!compact && (
        <div className="plc-sim-pipeline" title="西门子 S7-1200 标准循环扫描三阶段">
          <span className={`plc-sim-stage ${running ? 'active' : ''}`} title="PII：过程映像输入，扫描开始时一次性读取全部输入点">1 读输入 PII</span>
          <span className="plc-sim-arrow">→</span>
          <span className={`plc-sim-stage ${running ? 'active' : ''}`} title="OB1：主程序，从第 1 个网段到最后一个网段依次执行">2 执行 OB1</span>
          <span className="plc-sim-arrow">→</span>
          <span className={`plc-sim-stage ${running ? 'active' : ''}`} title="PIQ：过程映像输出，程序算完后一次性写到输出点">3 写输出 PIQ</span>
          <span className="plc-sim-cycle-stat">
            周期 <b>#{cycleCount}</b> · {lastScanMs.toFixed(2)}ms
          </span>
        </div>
      )}

      {/* Action Controls */}
      <div className="plc-sim-cpu-controls">
        <button
          type="button"
          className={`plc-sim-ctrl-btn ${running ? 'btn-stop' : 'btn-run'}`}
          onClick={onToggleRun}
          title={running ? '切换 CPU 为 STOP（物理输出安全切断）' : '启动 CPU 进入 RUN 循环扫描'}
        >
          {running ? <Square size={13} /> : <Play size={13} />}
          <span>{running ? '停止 CPU' : '运行 CPU'}</span>
        </button>

        <button
          type="button"
          className="plc-sim-ctrl-btn btn-step"
          onClick={onSingleScan}
          title="执行严格 1 个完整扫描周期（PII → OB1 → PIQ），适合观察边沿脉冲与双线圈覆盖"
        >
          <StepForward size={13} />
          <span>{compact ? '单步' : '单步扫描'}</span>
        </button>

        <div className="plc-sim-interval-group" role="group" aria-label="扫描速度：数值越大越慢，方便看清每一步">
          <span className="plc-sim-interval-label">速度</span>
          {INTERVAL_OPTIONS.filter((o) => (!compact ? true : o.ms !== 20)).map((opt) => (
            <button
              key={opt.ms}
              type="button"
              className={intervalMs === opt.ms ? 'active' : ''}
              onClick={() => onChangeInterval(opt.ms)}
              title={opt.title}
            >
              {compact ? `${opt.ms}ms` : opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="plc-sim-ctrl-btn btn-reset"
          onClick={onReset}
          title="复位所有 I/O、定时器、计数器与示波器缓冲"
        >
          <RotateCcw size={13} />
          <span>{compact ? '复位' : '全部复位'}</span>
        </button>
      </div>
    </div>
  );
};
