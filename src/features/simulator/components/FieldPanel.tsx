import React from 'react';
import { haptic } from '../../../app/native/platform';
import {
  AlertOctagon,
  Cog,
  Droplets,
  Gauge,
  Hand,
  Lightbulb,
  MoveHorizontal,
  Radio,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import type { TagDef, TagValue } from '../../../types/plc';
import { rawToMilliAmp } from '../../../core/plc';
import type { AnalogInputMeta, FieldInputMeta, FieldOutputMeta } from '../presets';

export type InputOperationMode = 'momentary' | 'latch';

interface FieldPanelProps {
  tagDefs: TagDef[];
  fieldInputMetas: FieldInputMeta[];
  analogInputMetas?: AnalogInputMeta[];
  fieldOutputMetas: FieldOutputMeta[];
  fieldInputs: Record<string, TagValue>;
  pii: Record<string, TagValue>;
  fieldOutputs: Record<string, TagValue>;
  tags: Record<string, TagValue>;
  running: boolean;
  inputMode: InputOperationMode;
  onInputModeChange: (mode: InputOperationMode) => void;
  onSetInput: (tag: string, value: TagValue) => void;
  closedLoopTank?: boolean;
  onToggleClosedLoopTank?: (enabled: boolean) => void;
  compact?: boolean;
}

export const FieldPanel: React.FC<FieldPanelProps> = ({
  tagDefs,
  fieldInputMetas,
  analogInputMetas = [],
  fieldOutputMetas,
  fieldInputs,
  pii,
  fieldOutputs,
  tags,
  running,
  inputMode,
  onInputModeChange,
  onSetInput,
  closedLoopTank = false,
  onToggleClosedLoopTank,
  compact = false,
}) => {
  const defByName = new Map(tagDefs.map((d) => [d.name, d]));

  const renderOutputIcon = (role: FieldOutputMeta['role'], active: boolean) => {
    switch (role) {
      case 'motor':
      case 'motor-fwd':
        return <Cog size={17} className={active ? 'plc-sim-spin-cw' : ''} />;
      case 'motor-rev':
        return <Cog size={17} className={active ? 'plc-sim-spin-ccw' : ''} />;
      case 'star':
        return <span className="plc-sim-role-glyph">Y</span>;
      case 'delta':
        return <span className="plc-sim-role-glyph">Δ</span>;
      case 'cylinder':
        return <MoveHorizontal size={16} className={active ? 'plc-sim-cyl-active' : ''} />;
      case 'pump':
      case 'valve':
        return <Droplets size={16} className={active ? 'plc-sim-pulse' : ''} />;
      case 'alarm':
        return <AlertOctagon size={16} className={active ? 'plc-sim-blink' : ''} />;
      default:
        return <Lightbulb size={16} />;
    }
  };

  const memoryWatchTags = tagDefs.filter((d) => {
    const a = d.address.toUpperCase();
    return a.startsWith('%M') || a.startsWith('DB');
  });

  return (
    <div className={`plc-sim-field-panel ${compact ? 'is-compact' : ''}`}>
      {/* Digital Inputs Section */}
      <section className="plc-sim-panel-sec">
        <div className="plc-sim-sec-head">
          <div className="plc-sim-sec-title">
            <Radio size={14} />
            <span>输入：按钮与开关（%I）</span>
          </div>
          <div className="plc-sim-mode-switch" role="group" aria-label="输入操作模式">
            <button
              type="button"
              className={inputMode === 'momentary' ? 'active' : ''}
              onClick={() => onInputModeChange('momentary')}
              title="真实按钮手势：按住触发，松开自动复归"
            >
              <Hand size={12} /> 点动按钮
            </button>
            <button
              type="button"
              className={inputMode === 'latch' ? 'active' : ''}
              onClick={() => onInputModeChange('latch')}
              title="拨码保持：单击锁定通/断，方便单手测试组合信号"
            >
              {inputMode === 'latch' ? <ToggleRight size={13} /> : <ToggleLeft size={13} />} 拨码保持
            </button>
          </div>
        </div>

        {fieldInputMetas.some((m) => m.physicalType === 'NC') && (
          <p className="plc-sim-nc-hint">
            标着“常闭”的按钮平时就是接通的（显示 24V · 1），按下才变成 0——这是正常现象，不是故障。
          </p>
        )}
        <div className="plc-sim-io-grid">
          {fieldInputMetas.map((meta) => {
            const def = defByName.get(meta.tag);
            const addr = def?.address ?? '';
            const physicalVal = Boolean(fieldInputs[meta.tag]);
            const piiVal = Boolean(pii[meta.tag]);
            const pendingPii = physicalVal !== piiVal;

            // Is button currently "actuated" by operator?
            // For physical NO: actuated = true; for physical NC: actuated (pressed) = false!
            const isActuated = meta.physicalType === 'NC' ? !physicalVal : physicalVal;
            const useMomentary = inputMode === 'momentary' && meta.defaultMomentary === true;

            const pressedVal = meta.physicalType === 'NC' ? false : true;
            const releasedVal = meta.physicalType === 'NC' ? true : false;

            const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
              if (useMomentary) {
                // 捕获指针：手指轻微移动也不会被当作“松开”
                e.currentTarget.setPointerCapture?.(e.pointerId);
                haptic('press');
                onSetInput(meta.tag, pressedVal);
              }
            };
            const handlePointerUp = () => {
              if (useMomentary) {
                haptic('tap'); // 松手时轻一下：模拟按钮回弹
                onSetInput(meta.tag, releasedVal);
              }
            };
            const handleClick = () => {
              if (!useMomentary) {
                haptic('tap');
                onSetInput(meta.tag, !physicalVal);
              }
            };
            // 键盘操作：空格/回车按住 = 按下，松开 = 释放（点动模式）
            const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
              if (!useMomentary || e.repeat) return;
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onSetInput(meta.tag, pressedVal);
              }
            };
            const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
              if (!useMomentary) return;
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onSetInput(meta.tag, releasedVal);
              }
            };

            return (
              <button
                key={meta.tag}
                type="button"
                className={`plc-sim-input-btn tone-${meta.tone} ${
                  physicalVal ? 'is-high' : 'is-low'
                } ${isActuated ? 'is-actuated' : ''}`}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={() => {
                  if (useMomentary && isActuated) onSetInput(meta.tag, releasedVal);
                }}
                onPointerCancel={handlePointerUp}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                onBlur={() => {
                  if (useMomentary && isActuated) onSetInput(meta.tag, releasedVal);
                }}
                onContextMenu={(e) => e.preventDefault()}
                aria-pressed={isActuated}
                aria-label={`${meta.label}（${addr}），${meta.hint}`}
                title={meta.hint}
              >
                <div className="plc-sim-io-top">
                  <span className="plc-sim-addr-chip area-i">{addr}</span>
                  <span className={`plc-sim-phy-tag ${meta.physicalType === 'NC' ? 'nc' : 'no'}`}>
                    {meta.physicalType === 'NC' ? '常闭' : '常开'}
                    {useMomentary ? '·点动' : '·保持'}
                  </span>
                </div>
                <div className="plc-sim-io-name">{meta.label}</div>
                <div className="plc-sim-io-foot">
                  <span className="plc-sim-io-sym">{meta.tag}</span>
                  <span className={`plc-sim-bit-badge ${physicalVal ? 'bit-1' : 'bit-0'}`}>
                    {physicalVal ? '24V · 1' : '0V · 0'}
                  </span>
                </div>
                {pendingPii && (
                  <div className="plc-sim-pii-pending">待扫描采样 PII</div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Analog Inputs Section (if any) */}
      {analogInputMetas.length > 0 && (
        <section className="plc-sim-panel-sec">
          <div className="plc-sim-sec-head">
            <div className="plc-sim-sec-title">
              <Gauge size={14} />
              <span>模拟量输入通道 (S7-1200 AI)</span>
            </div>
            {analogInputMetas.some((a) => a.supportsClosedLoopTank) && onToggleClosedLoopTank && (
              <button
                type="button"
                className={`plc-sim-mini-toggle ${closedLoopTank ? 'active' : ''}`}
                onClick={() => onToggleClosedLoopTank(!closedLoopTank)}
              >
                {closedLoopTank ? '储罐自动联动: 开' : '开启储罐物理联动'}
              </button>
            )}
          </div>

          {analogInputMetas.map((am) => {
            const def = defByName.get(am.tag);
            const rawVal = Number(fieldInputs[am.tag] ?? 0);
            const ma = rawToMilliAmp(rawVal);
            const pct = Math.max(0, Math.min(100, (rawVal / am.maxRaw) * 100));

            return (
              <div key={am.tag} className="plc-sim-analog-card">
                <div className="plc-sim-analog-head">
                  <div>
                    <span className="plc-sim-addr-chip area-i">{def?.address ?? '%IW64'}</span>{' '}
                    <strong>{am.label}</strong>
                  </div>
                  <div className="plc-sim-analog-readouts">
                    <span className="plc-sim-mono-val">{Math.round(rawVal)} RAW</span>
                    <span className="plc-sim-ma-pill">{ma.toFixed(2)} mA</span>
                    <span className="plc-sim-pct-pill">{pct.toFixed(1)}%</span>
                  </div>
                </div>

                <input
                  type="range"
                  className="plc-sim-slider"
                  min={am.minRaw}
                  max={am.maxRaw}
                  step={64}
                  value={Math.round(rawVal)}
                  onChange={(e) => onSetInput(am.tag, Number(e.target.value))}
                  aria-label={am.label}
                />

                <div className="plc-sim-slider-scale">
                  <span>0 (4.0mA · 0%)</span>
                  <span>13824 (12.0mA · 50%)</span>
                  <span>27648 (20.0mA · 100%)</span>
                </div>

                <div className="plc-sim-analog-presets">
                  {am.presets.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className={`plc-sim-preset-chip tone-${p.tone ?? 'info'}`}
                      onClick={() => onSetInput(am.tag, p.raw)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Digital Outputs LED Section */}
      <section className="plc-sim-panel-sec">
        <div className="plc-sim-sec-head">
          <div className="plc-sim-sec-title">
            <Lightbulb size={14} />
            <span>输出：接触器与指示灯（%Q）</span>
          </div>
          {!running && <span className="plc-sim-stop-tag">STOP 安全切断</span>}
        </div>

        <div className="plc-sim-out-list">
          {fieldOutputMetas.map((om) => {
            const def = defByName.get(om.tag);
            const active = Boolean(fieldOutputs[om.tag]);
            const isAlarm = om.role === 'alarm';

            return (
              <div
                key={om.tag}
                className={`plc-sim-out-row ${active ? 'is-on' : 'is-off'} ${
                  isAlarm ? 'is-alarm' : ''
                }`}
              >
                <div className={`plc-sim-led-orb ${active ? 'on' : 'off'} ${isAlarm ? 'alarm' : ''}`}>
                  {renderOutputIcon(om.role, active)}
                </div>
                <div className="plc-sim-out-info">
                  <div className="plc-sim-out-top">
                    <span className="plc-sim-addr-chip area-q">{def?.address ?? ''}</span>
                    <span className="plc-sim-out-label">{om.label}</span>
                    <span className={`plc-sim-bit-badge ${active ? 'bit-1' : 'bit-0'}`}>
                      {active ? 'ON · 1' : 'OFF · 0'}
                    </span>
                  </div>
                  {!compact && <div className="plc-sim-out-desc">{om.description}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Internal Memory & DB Telemetry (full mode) */}
      {!compact && memoryWatchTags.length > 0 && (
        <section className="plc-sim-panel-sec">
          <div className="plc-sim-sec-head">
            <div className="plc-sim-sec-title">
              <span>中间寄存器 %M / 背景 DB 实时监控</span>
            </div>
          </div>
          <div className="plc-sim-watch-grid">
            {memoryWatchTags.map((d) => {
              const v = tags[d.name];
              const isBool = d.type === 'Bool';
              const display = isBool
                ? v
                  ? 'TRUE (1)'
                  : 'FALSE (0)'
                : `${typeof v === 'number' ? Number(v.toFixed(2)) : 0}${d.unit ? ` ${d.unit}` : ''}`;

              return (
                <div key={d.name} className="plc-sim-watch-cell">
                  <span className="plc-sim-addr-chip area-m">{d.address}</span>
                  <span className="plc-sim-watch-name" title={d.comment}>
                    {d.name}
                  </span>
                  <span
                    className={`plc-sim-watch-val ${
                      isBool ? (v ? 'is-true' : 'is-false') : 'is-num'
                    }`}
                  >
                    {display}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
