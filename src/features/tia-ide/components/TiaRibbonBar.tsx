import React from 'react';
import {
  Cpu,
  Download,
  Eye,
  EyeOff,
  Hammer,
  Play,
  RotateCcw,
  ShieldAlert,
  Square,
  StepForward,
} from 'lucide-react';
import type { SclProjectTemplate } from '../../../core/scl/types';
import { haptic } from '../../../app/native/platform';

export interface TiaRibbonBarProps {
  templates: SclProjectTemplate[];
  selectedTemplateId: string;
  onSelectTemplate: (id: string) => void;
  isDirty: boolean;
  monitoring: boolean;
  onToggleMonitor: () => void;
  runOb100OnDownload: boolean;
  onToggleRunOb100: (next: boolean) => void;
  onCompile: () => void;
  onDownload: () => void;
  cpuMode: 'RUN' | 'STOP';
  onSetCpuMode: (mode: 'RUN' | 'STOP') => void;
  onStepScan: () => void;
  onResetMemory: () => void;
  cycleCount: number;
  scanDurationMs: number;
  activeForceCount: number;
  onJumpToForceTable: () => void;
}

export const TiaRibbonBar: React.FC<TiaRibbonBarProps> = ({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  isDirty,
  monitoring,
  onToggleMonitor,
  runOb100OnDownload,
  onToggleRunOb100,
  onCompile,
  onDownload,
  cpuMode,
  onSetCpuMode,
  onStepScan,
  onResetMemory,
  cycleCount,
  scanDurationMs,
  activeForceCount,
  onJumpToForceTable,
}) => {
  return (
    <header className="tia-ribbon" aria-label="TIA Portal 工程工具栏">
      {/* Left: Brand & Template Switcher */}
      <div className="tia-ribbon-group">
        <div className="tia-brand-pill" title="SIMATIC S7-1200 CPU 1214C DC/DC/DC">
          <span className={`tia-online-dot ${monitoring ? 'active' : ''}`} />
          <Cpu size={14} />
          <span>TIA Portal · S7-1214C</span>
          {monitoring && (
            <span
              style={{
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'rgba(249,115,22,0.22)',
                fontWeight: 800,
              }}
            >
              ONLINE
            </span>
          )}
        </div>

        <div className="tia-template-wrap">
          <select
            className="tia-select"
            aria-label="选择博途工程模板"
            value={selectedTemplateId}
            onChange={(e) => {
              haptic('tap');
              onSelectTemplate(e.target.value);
            }}
          >
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                [{tpl.difficulty}] {tpl.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Center: Compile / Download / Monitor Glasses */}
      <div className="tia-ribbon-group">
        <button
          type="button"
          className="tia-btn"
          onClick={() => {
            haptic('tap');
            onCompile();
          }}
          title="编译 OB1 与 OB100 语法校验 (Ctrl+S)"
        >
          <Hammer size={14} />
          <span>编译</span>
        </button>

        <button
          type="button"
          className={`tia-btn ${isDirty ? 'tia-btn--dirty' : 'tia-btn--primary'}`}
          onClick={() => {
            haptic('press');
            onDownload();
          }}
          title="编译并热下载程序到虚拟 CPU 1214C (Ctrl+Enter)"
        >
          <Download size={14} />
          <span>{isDirty ? '下载到设备 ●' : '下载到设备'}</span>
        </button>

        <label className="tia-ob100-check" title="下载完成后立即执行一次 Startup [OB100] 暖启动初始化">
          <input
            type="checkbox"
            checked={runOb100OnDownload}
            onChange={(e) => onToggleRunOb100(e.target.checked)}
          />
          <span>OB100 暖启动</span>
        </label>

        <button
          type="button"
          className={`tia-btn ${monitoring ? 'tia-btn--monitor-on' : ''}`}
          onClick={() => {
            haptic('tap');
            onToggleMonitor();
          }}
          title="博途小眼镜：开启/关闭在线程序状态与逐行实时监控"
        >
          {monitoring ? <Eye size={14} /> : <EyeOff size={14} />}
          <span>{monitoring ? '监控中 (ON)' : '转至在线监控'}</span>
        </button>
      </div>

      {/* Right: S7-1214C CPU Operator Panel */}
      <div className="tia-cpu-panel" aria-label="CPU 操作面板">
        <button
          type="button"
          className={`tia-cpu-mode-btn ${cpuMode === 'RUN' ? 'is-run' : ''}`}
          onClick={() => {
            haptic('tap');
            onSetCpuMode('RUN');
          }}
          title="将 CPU 切换至 RUN 自动周期扫描状态"
        >
          <span className={`tia-led ${cpuMode === 'RUN' ? 'green' : ''}`} />
          <Play size={12} />
          <span>RUN</span>
        </button>

        <button
          type="button"
          className={`tia-cpu-mode-btn ${cpuMode === 'STOP' ? 'is-stop' : ''}`}
          onClick={() => {
            haptic('tap');
            onSetCpuMode('STOP');
          }}
          title="将 CPU 切换至 STOP 停机状态"
        >
          <span className={`tia-led ${cpuMode === 'STOP' ? 'amber' : ''}`} />
          <Square size={11} />
          <span>STOP</span>
        </button>

        <button
          type="button"
          className="tia-btn tia-btn--sm"
          onClick={() => {
            haptic('tap');
            onStepScan();
          }}
          title="单步执行 1 个 PLC 扫描周期 (50ms)，适合 STOP 状态下逐拍调试"
        >
          <StepForward size={13} />
          <span>单步</span>
        </button>

        <button
          type="button"
          className="tia-btn tia-btn--sm"
          onClick={() => {
            haptic('press');
            onResetMemory();
          }}
          title="MRES 复位 CPU 存储区与定时器/计数器背景数据"
        >
          <RotateCcw size={12} />
          <span>MRES</span>
        </button>

        <div className="tia-cpu-metrics" title="当前扫描周期计数与单次执行耗时">
          <span>#{cycleCount}</span>
          <span>{scanDurationMs.toFixed(2)}ms</span>
        </div>

        {activeForceCount > 0 && (
          <button
            type="button"
            className="tia-force-indicator"
            onClick={() => {
              haptic('tap');
              onJumpToForceTable();
            }}
            title="当前有变量处于强制状态，点击查看监控与强制表"
          >
            <ShieldAlert size={12} />
            <span>F ({activeForceCount})</span>
          </button>
        )}
      </div>
    </header>
  );
};
