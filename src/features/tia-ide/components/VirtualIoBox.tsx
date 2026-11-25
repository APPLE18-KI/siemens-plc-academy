import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Lightbulb, Pause, Play, Sliders, ToggleLeft, Trash2 } from 'lucide-react';
import type { TagDef, TagValue } from '../../../types/plc';
import { formatPlcValue } from '../../../core/scl';
import { haptic } from '../../../app/native/platform';

const TRACE_COLORS = ['#10b981', '#38bdf8', '#f59e0b', '#c084fc'];
const MAX_SAMPLES = 100;

export interface VirtualIoBoxProps {
  tagDefs: TagDef[];
  liveTags: Record<string, TagValue>;
  cycleCount: number;
  onSetTag: (name: string, value: TagValue) => void;
}

export const VirtualIoBox: React.FC<VirtualIoBoxProps> = ({
  tagDefs,
  liveTags,
  cycleCount,
  onSetTag,
}) => {
  const [momentaryMap, setMomentaryMap] = useState<Record<string, boolean>>({});
  const [scopePaused, setScopePaused] = useState(false);
  const [samples, setSamples] = useState<Array<Record<string, number>>>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

  const boolInputs = useMemo(
    () => tagDefs.filter((t) => (t.area === 'I' || t.address.toUpperCase().startsWith('%I')) && t.type === 'Bool'),
    [tagDefs]
  );
  const analogInputs = useMemo(
    () => tagDefs.filter((t) => (t.area === 'I' || t.address.toUpperCase().startsWith('%I')) && t.type !== 'Bool'),
    [tagDefs]
  );
  const boolOutputs = useMemo(
    () => tagDefs.filter((t) => (t.area === 'Q' || t.address.toUpperCase().startsWith('%Q')) && t.type === 'Bool'),
    [tagDefs]
  );
  const analogOutputs = useMemo(
    () => tagDefs.filter((t) => (t.area === 'Q' || t.address.toUpperCase().startsWith('%Q')) && t.type !== 'Bool'),
    [tagDefs]
  );
  const memoryTags = useMemo(
    () => tagDefs.filter((t) => t.area === 'M' || t.address.toUpperCase().startsWith('%M')),
    [tagDefs]
  );

  // Auto-select up to 4 interesting channels when tagDefs change
  useEffect(() => {
    const preferred: string[] = [];
    for (const t of boolInputs.slice(0, 2)) preferred.push(t.name);
    for (const t of boolOutputs.slice(0, 2)) preferred.push(t.name);
    if (preferred.length < 4) {
      for (const t of [...analogInputs, ...analogOutputs, ...memoryTags]) {
        if (!preferred.includes(t.name) && preferred.length < 4) preferred.push(t.name);
      }
    }
    setSelectedChannels(preferred);
    setSamples([]);
  }, [tagDefs, boolInputs, boolOutputs, analogInputs, analogOutputs, memoryTags]);

  // Append rolling waveform sample on every PLC cycle tick
  useEffect(() => {
    if (scopePaused) return;
    const frame: Record<string, number> = {};
    for (const ch of selectedChannels) {
      const raw = liveTags[ch];
      if (typeof raw === 'boolean') frame[ch] = raw ? 1 : 0;
      else if (typeof raw === 'number') frame[ch] = raw;
      else frame[ch] = 0;
    }
    setSamples((prev) => {
      const next = prev.length >= MAX_SAMPLES ? [...prev.slice(prev.length - MAX_SAMPLES + 1), frame] : [...prev, frame];
      return next;
    });
  }, [cycleCount, scopePaused, selectedChannels, liveTags]);

  const toggleChannel = (name: string) => {
    haptic('tap');
    setSelectedChannels((prev) => {
      if (prev.includes(name)) return prev.filter((c) => c !== name);
      if (prev.length >= 4) return [...prev.slice(1), name];
      return [...prev, name];
    });
  };

  const toggleMomentary = (name: string) => {
    haptic('tap');
    setMomentaryMap((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="tia-vio-grid">
      {/* Digital Inputs (%I) Pushbuttons & Dip Switches */}
      <div className="tia-vio-card">
        <div className="tia-vio-card-head">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ToggleLeft size={15} color="var(--info-cyan)" />
            <span>数字量输入开关箱 (%I DI)</span>
          </span>
          <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>支持自锁拨码 / 点动按钮切换</span>
        </div>

        {boolInputs.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>当前变量表中无数字量输入 (%I Bool)。</div>
        ) : (
          <div className="tia-vio-switches">
            {boolInputs.map((tag) => {
              const on = Boolean(liveTags[tag.name]);
              // Default Start_PB / Ped_Request to momentary feel if user hasn't toggled yet? Let's default latch so mobile users can easily test AND provide a 1-tap "点动/自锁" toggle pill!
              const isMomentary = Boolean(momentaryMap[tag.name]);
              return (
                <div key={tag.name} className={`tia-vio-switch ${on ? 'is-on' : ''}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                    <span className="tia-addr-chip area-I" style={{ fontSize: 10 }}>
                      {tag.address}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleMomentary(tag.name)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        fontSize: 10,
                        color: 'var(--ink-muted)',
                        padding: '1px 4px',
                        textDecoration: 'underline',
                      }}
                      title="切换自锁拨码开关 / 按住点动按钮"
                    >
                      {isMomentary ? '点动' : '拨码'}
                    </button>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tag.comment ?? tag.name}>
                    {tag.name}
                  </div>

                  {isMomentary ? (
                    <button
                      type="button"
                      className="tia-vio-btn-press"
                      onPointerDown={() => {
                        haptic('press');
                        onSetTag(tag.name, true);
                      }}
                      onPointerUp={() => onSetTag(tag.name, false)}
                      onPointerLeave={() => {
                        if (on) onSetTag(tag.name, false);
                      }}
                      onPointerCancel={() => onSetTag(tag.name, false)}
                    >
                      {on ? '按下 = 1' : '按住点动'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="tia-vio-btn-press"
                      onClick={() => {
                        haptic('tap');
                        onSetTag(tag.name, !on);
                      }}
                    >
                      {on ? 'ON (1)' : 'OFF (0)'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Analog Inputs (%IW) */}
      {analogInputs.length > 0 && (
        <div className="tia-vio-card">
          <div className="tia-vio-card-head">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Sliders size={15} color="#a78bfa" />
              <span>模拟量变送器仿真 (%IW 0~27648)</span>
            </span>
          </div>
          {analogInputs.map((tag) => {
            const val = Number(liveTags[tag.name] ?? tag.init ?? 0);
            const pct = Math.max(0, Math.min(100, (val / 27648) * 100));
            const ma = 4 + (pct / 100) * 16;
            return (
              <div key={tag.name} className="tia-vio-slider-row">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ fontWeight: 700 }}>
                    <span className="tia-addr-chip area-I" style={{ marginRight: 6, fontSize: 10 }}>
                      {tag.address}
                    </span>
                    {tag.name}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--info-cyan)' }}>
                    {Math.round(val)} ({pct.toFixed(1)}% · {ma.toFixed(1)}mA)
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={27648}
                  step={128}
                  value={Math.max(0, Math.min(27648, val))}
                  onChange={(e) => onSetTag(tag.name, Number(e.target.value))}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Digital & Analog Outputs (%Q / %QW) LED Array */}
      <div className="tia-vio-card">
        <div className="tia-vio-card-head">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Lightbulb size={15} color="var(--power-green)" />
            <span>数字量输出 LED 指示阵列 (%Q DO)</span>
          </span>
        </div>

        <div className="tia-vio-leds">
          {boolOutputs.map((tag) => {
            const on = Boolean(liveTags[tag.name]);
            return (
              <div key={tag.name} className={`tia-vio-led-item ${on ? 'is-on' : ''}`} title={tag.comment}>
                <span className="tia-vio-lamp" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted)' }}>
                    {tag.address}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: on ? 'var(--power-green)' : 'var(--ink-primary)',
                    }}
                  >
                    {tag.name}
                  </div>
                </div>
              </div>
            );
          })}

          {analogOutputs.map((tag) => {
            const raw = Number(liveTags[tag.name] ?? 0);
            const pct = Math.max(0, Math.min(100, (raw / 27648) * 100));
            return (
              <div key={tag.name} className="tia-vio-led-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--power-green)' }}>{tag.address}</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(raw)}</strong>
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700 }}>{tag.name}</div>
                <div style={{ height: 5, borderRadius: 99, background: 'var(--bg-surface-3)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--siemens-teal-bright)' }} />
                </div>
              </div>
            );
          })}
        </div>

        {memoryTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border-hairline)' }}>
            {memoryTags.map((tag) => {
              const v = liveTags[tag.name];
              return (
                <span key={tag.name} className={`tia-live-val ${v === true ? 'is-true' : typeof v === 'number' ? 'is-num' : ''}`}>
                  {tag.address} {tag.name}={v !== undefined ? formatPlcValue(v, tag.type) : '--'}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* 100-Cycle Live Oscilloscope / Trend Chart */}
      <div className="tia-vio-card">
        <div className="tia-vio-card-head">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Activity size={15} color="#38bdf8" />
            <span>实时 100 周期逻辑分析仪波形</span>
          </span>
          <div style={{ display: 'inline-flex', gap: 5 }}>
            <button
              type="button"
              className="tia-btn tia-btn--sm"
              onClick={() => setScopePaused((p) => !p)}
            >
              {scopePaused ? <Play size={11} /> : <Pause size={11} />}
              <span>{scopePaused ? '继续' : '冻结'}</span>
            </button>
            <button
              type="button"
              className="tia-btn tia-btn--sm"
              onClick={() => setSamples([])}
              title="清空波形历史"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        {/* Channel Picker Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {tagDefs.slice(0, 12).map((tag) => {
            const idx = selectedChannels.indexOf(tag.name);
            const active = idx >= 0;
            const color = active ? TRACE_COLORS[idx % TRACE_COLORS.length] : undefined;
            return (
              <button
                key={tag.name}
                type="button"
                onClick={() => toggleChannel(tag.name)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 7px',
                  borderRadius: 99,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  border: `1px solid ${active ? color : 'var(--border-hairline)'}`,
                  background: active ? `${color}22` : 'var(--bg-surface-2)',
                  color: active ? color : 'var(--ink-muted)',
                  fontWeight: active ? 700 : 500,
                }}
              >
                {active && (
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: color }} />
                )}
                {tag.name}
              </button>
            );
          })}
        </div>

        {/* SVG Oscilloscope Canvas */}
        <svg className="tia-scope-svg" viewBox="0 0 420 170" preserveAspectRatio="none" role="img" aria-label="100 周期数字逻辑分析仪波形">
          {/* Background Grid */}
          {[1, 2, 3].map((row) => (
            <line
              key={`h-${row}`}
              x1={0}
              y1={(170 / 4) * row}
              x2={420}
              y2={(170 / 4) * row}
              stroke="rgba(148,179,206,0.14)"
              strokeDasharray="3 3"
            />
          ))}
          {[1, 2, 3, 4].map((col) => (
            <line
              key={`v-${col}`}
              x1={(420 / 5) * col}
              y1={0}
              x2={(420 / 5) * col}
              y2={170}
              stroke="rgba(148,179,206,0.1)"
            />
          ))}

          {/* Channel Lanes */}
          {selectedChannels.map((ch, chIdx) => {
            const color = TRACE_COLORS[chIdx % TRACE_COLORS.length];
            const tag = tagDefs.find((t) => t.name === ch);
            const isBool = !tag || tag.type === 'Bool';
            const laneH = 170 / Math.max(1, selectedChannels.length);
            const topY = chIdx * laneH + 8;
            const bottomY = (chIdx + 1) * laneH - 8;

            const vals = samples.map((s) => s[ch] ?? 0);
            const maxVal = isBool ? 1 : Math.max(1, ...vals, tag?.address.includes('W') ? 27648 : 100);
            const minVal = isBool ? 0 : Math.min(0, ...vals);
            const range = Math.max(1e-5, maxVal - minVal);

            let d = '';
            const count = samples.length;
            if (count > 0) {
              for (let i = 0; i < count; i++) {
                const x = (i / Math.max(1, MAX_SAMPLES - 1)) * 420;
                const norm = (vals[i] - minVal) / range;
                const y = bottomY - norm * (bottomY - topY);
                if (i === 0) {
                  d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
                } else if (isBool) {
                  const prevY = bottomY - ((vals[i - 1] - minVal) / range) * (bottomY - topY);
                  d += ` L ${x.toFixed(1)} ${prevY.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
                } else {
                  d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
                }
              }
            }

            const curVal = liveTags[ch];
            return (
              <g key={ch}>
                {d && (
                  <path
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                  />
                )}
                <text
                  x={6}
                  y={topY + 9}
                  fill={color}
                  fontSize={10}
                  fontFamily="JetBrains Mono, Consolas, monospace"
                  fontWeight={700}
                >
                  {ch}: {curVal !== undefined ? formatPlcValue(curVal, tag?.type) : '--'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
