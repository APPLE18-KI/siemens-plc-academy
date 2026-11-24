import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  GitBranch,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react';
import type { TagDef, TagValue } from '../../../types/plc';
import {
  useLadderSimulation,
  type LadderNetwork,
  type LadderNode,
  type LadderProgram,
  type TimerType,
  type TraceChannelDef,
} from '../../../core/plc';
import type { FieldInputMeta, FieldOutputMeta } from '../presets';
import { generateSclFromLadder } from '../sclGenerator';
import { CpuStatusBar } from './CpuStatusBar';
import { FieldPanel, type InputOperationMode } from './FieldPanel';
import { LadderCanvas } from './LadderCanvas';
import { SclCodePanel } from './SclCodePanel';
import { TraceViewer } from './TraceViewer';

type SandboxContactKind = 'NO' | 'NC' | 'P_TRIG' | 'N_TRIG';
type SandboxCoilKind = 'OTE' | 'SET' | 'RESET';

interface SandboxContactDraft {
  id: string;
  kind: SandboxContactKind;
  tag: string;
}

interface SandboxNetworkDraft {
  id: string;
  title: string;
  /** Main series contacts (after optional parallel OR block) */
  topBranch: SandboxContactDraft[];
  /** Optional parallel OR branch (for seal-in / multi-start) */
  hasParallelBranch: boolean;
  parallelBranch: SandboxContactDraft[];
  /** Remaining series contacts after the branch merge */
  seriesAfter: SandboxContactDraft[];
  /** Optional timer block */
  timerMode: 'NONE' | TimerType;
  timerPtMs: number;
  /** Output coil */
  coilKind: SandboxCoilKind;
  coilTag: string;
}

const SANDBOX_TAG_DEFS: TagDef[] = [
  { name: 'I_Btn1', address: '%I0.0', type: 'Bool', area: 'I', init: false, comment: '启动按钮 1 (NO)' },
  { name: 'I_Btn2', address: '%I0.1', type: 'Bool', area: 'I', init: false, comment: '按钮 2 / 复位 (NO)' },
  { name: 'I_Stop_NC', address: '%I0.2', type: 'Bool', area: 'I', init: true, comment: '停止按钮 (物理 NC，正常=1)' },
  { name: 'I_Sensor', address: '%I0.3', type: 'Bool', area: 'I', init: false, comment: '光电传感器 (NO)' },
  { name: 'M_Latch1', address: '%M0.0', type: 'Bool', area: 'M', init: false, comment: '中间辅助继电器 M0.0' },
  { name: 'M_Latch2', address: '%M0.1', type: 'Bool', area: 'M', init: false, comment: '中间辅助继电器 M0.1' },
  { name: 'M_Pulse', address: '%M0.2', type: 'Bool', area: 'M', init: false, comment: '边沿脉冲标志 M0.2' },
  { name: 'M_TimerQ', address: '%M0.3', type: 'Bool', area: 'M', init: false, comment: '定时器完成标志 M0.3' },
  { name: 'Q_Motor', address: '%Q0.0', type: 'Bool', area: 'Q', init: false, comment: '主电机接触器 Q0.0' },
  { name: 'Q_Valve', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '电磁阀输出 Q0.1' },
  { name: 'Q_LampG', address: '%Q0.2', type: 'Bool', area: 'Q', init: false, comment: '绿灯指示 Q0.2' },
  { name: 'Q_AlarmR', address: '%Q0.3', type: 'Bool', area: 'Q', init: false, comment: '报警红灯 Q0.3' },
];

const SANDBOX_FIELD_INPUTS: FieldInputMeta[] = [
  { tag: 'I_Btn1', label: '启动按钮 1', physicalType: 'NO', defaultMomentary: true, tone: 'success', hint: '%I0.0 常开按钮' },
  { tag: 'I_Btn2', label: '辅助/复位按钮 2', physicalType: 'NO', defaultMomentary: true, tone: 'info', hint: '%I0.1 常开按钮' },
  { tag: 'I_Stop_NC', label: '停止按钮 (NC)', physicalType: 'NC', defaultMomentary: true, tone: 'danger', hint: '%I0.2 物理常闭按钮，正常=1，按下=0' },
  { tag: 'I_Sensor', label: '光电传感器', physicalType: 'NO', defaultMomentary: false, tone: 'warn', hint: '%I0.3 传感器开关' },
];

const SANDBOX_FIELD_OUTPUTS: FieldOutputMeta[] = [
  { tag: 'Q_Motor', label: '电机 Q_Motor', role: 'motor', description: '沙盒主执行输出 %Q0.0' },
  { tag: 'Q_Valve', label: '气缸/电磁阀 Q_Valve', role: 'cylinder', description: '沙盒执行阀输出 %Q0.1' },
  { tag: 'Q_LampG', label: '绿色运行灯 Q_LampG', role: 'lamp-green', description: '状态指示 %Q0.2' },
  { tag: 'Q_AlarmR', label: '红色报警灯 Q_AlarmR', role: 'alarm', description: '报警输出 %Q0.3' },
];

const SANDBOX_TRACE_CHANNELS: TraceChannelDef[] = [
  { id: 's1', tag: 'I_Btn1', label: '按钮 1', address: '%I0.0', kind: 'bool', color: '#38bdf8' },
  { id: 's2', tag: 'I_Btn2', label: '按钮 2', address: '%I0.1', kind: 'bool', color: '#a78bfa' },
  { id: 's3', tag: 'I_Stop_NC', label: '停止 NC', address: '%I0.2', kind: 'bool', color: '#f43f5e' },
  { id: 's4', tag: 'Q_Motor', label: '电机 Q0.0', address: '%Q0.0', kind: 'bool', color: '#10b981' },
  { id: 's5', tag: 'Q_Valve', label: '电磁阀 Q0.1', address: '%Q0.1', kind: 'bool', color: '#f59e0b' },
];

const ALL_CONTACT_TAGS = SANDBOX_TAG_DEFS.map((d) => ({
  name: d.name,
  label: `${d.address} "${d.name}"`,
}));

const COIL_TAGS = SANDBOX_TAG_DEFS.filter((d) => d.area === 'Q' || d.area === 'M').map((d) => ({
  name: d.name,
  label: `${d.address} "${d.name}"`,
}));

interface SandboxTemplate {
  id: string;
  label: string;
  hint: string;
  drafts: SandboxNetworkDraft[];
}

const SANDBOX_TEMPLATES: SandboxTemplate[] = [
  {
    id: 'seal-in',
    label: '经典自锁实验',
    hint: '带并联 OR 自锁支路与常闭停止，试着修改并联触点观察自锁失效！',
    drafts: [
      {
        id: 'sb-nw-1',
        title: '电机起保停自锁回路（并联 OR 支路）',
        topBranch: [{ id: 'c1', kind: 'NO', tag: 'I_Btn1' }],
        hasParallelBranch: true,
        parallelBranch: [{ id: 'c2', kind: 'NO', tag: 'Q_Motor' }],
        seriesAfter: [{ id: 'c3', kind: 'NO', tag: 'I_Stop_NC' }],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_Motor',
      },
      {
        id: 'sb-nw-2',
        title: '电机运行联动绿灯',
        topBranch: [{ id: 'c4', kind: 'NO', tag: 'Q_Motor' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_LampG',
      },
    ],
  },
  {
    id: 'double-coil',
    label: '双线圈覆盖事故实验',
    hint: 'NW 1 和 NW 2 同时用普通线圈 ( ) 驱动 %Q0.0！按住 I_Btn1 观察为什么 NW 1 变绿但电机不转！',
    drafts: [
      {
        id: 'dc-nw-1',
        title: 'NW 1 尝试用 I_Btn1 驱动 Q_Motor（将被 NW 2 覆盖！）',
        topBranch: [{ id: 'dc1', kind: 'NO', tag: 'I_Btn1' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_Motor',
      },
      {
        id: 'dc-nw-2',
        title: 'NW 2 又用 I_Btn2 写同一个 Q_Motor（最终决定 PIQ 输出！）',
        topBranch: [{ id: 'dc2', kind: 'NO', tag: 'I_Btn2' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_Motor',
      },
    ],
  },
  {
    id: 'ton-set-reset',
    label: 'TON 延时 + SET/RESET 实验',
    hint: '长按 I_Btn1 满 2 秒置位 (S) 电磁阀，点按 I_Btn2 执行复位 (R)。',
    drafts: [
      {
        id: 'tsr-nw-1',
        title: 'TON 2s 延时置位电磁阀 Q_Valve',
        topBranch: [{ id: 't1', kind: 'NO', tag: 'I_Btn1' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'TON',
        timerPtMs: 2000,
        coilKind: 'SET',
        coilTag: 'Q_Valve',
      },
      {
        id: 'tsr-nw-2',
        title: 'I_Btn2 上升沿复位 (R) 电磁阀',
        topBranch: [{ id: 't2', kind: 'P_TRIG', tag: 'I_Btn2' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'RESET',
        coilTag: 'Q_Valve',
      },
    ],
  },
  {
    id: 'blank',
    label: '空白起步',
    hint: '从最简单的单触点控线圈开始自由组合你的西门子梯形图！',
    drafts: [
      {
        id: 'bl-nw-1',
        title: '自定义网段 1',
        topBranch: [{ id: 'b1', kind: 'NO', tag: 'I_Btn1' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 1500,
        coilKind: 'OTE',
        coilTag: 'Q_Motor',
      },
    ],
  },
];

function cloneDrafts(drafts: SandboxNetworkDraft[]): SandboxNetworkDraft[] {
  return drafts.map((d) => ({
    ...d,
    topBranch: d.topBranch.map((c) => ({ ...c })),
    parallelBranch: d.parallelBranch.map((c) => ({ ...c })),
    seriesAfter: d.seriesAfter.map((c) => ({ ...c })),
  }));
}

function compileDraftsToProgram(drafts: SandboxNetworkDraft[]): LadderProgram {
  const networks: LadderNetwork[] = drafts.map((d, idx) => {
    const nodes: LadderNode[] = [];
    const toNode = (c: SandboxContactDraft): LadderNode => {
      if (c.kind === 'P_TRIG' || c.kind === 'N_TRIG') {
        return { kind: c.kind, id: `${d.id}-${c.id}`, tag: c.tag };
      }
      return { kind: c.kind, id: `${d.id}-${c.id}`, tag: c.tag };
    };

    const topNodes = d.topBranch.map(toNode);
    const parNodes = d.parallelBranch.map(toNode);

    if (d.hasParallelBranch && parNodes.length > 0) {
      nodes.push({
        kind: 'BRANCH',
        id: `${d.id}-branch`,
        branches: [topNodes.length > 0 ? topNodes : [{ kind: 'NO', id: `${d.id}-empty`, tag: 'I_Btn1' }], parNodes],
      });
    } else {
      nodes.push(...topNodes);
    }

    for (const s of d.seriesAfter) {
      nodes.push(toNode(s));
    }

    if (d.timerMode !== 'NONE') {
      nodes.push({
        kind: 'TIMER',
        id: `${d.id}-timer`,
        timerType: d.timerMode,
        dbName: `${d.timerMode}_User_${idx + 1}`,
        ptMs: Math.max(100, Math.min(30000, d.timerPtMs)),
        qTag: 'M_TimerQ',
      });
    }

    nodes.push({
      kind: d.coilKind,
      id: `${d.id}-coil`,
      tag: d.coilTag,
    });

    return {
      id: d.id,
      number: idx + 1,
      title: d.title,
      nodes,
    };
  });

  return {
    id: 'custom-sandbox',
    name: 'OB1_User_Custom_Sandbox',
    networks,
  };
}

let uidCounter = 100;
const nextUid = (prefix: string) => `${prefix}-${++uidCounter}`;

export const LadderSandbox: React.FC = () => {
  const [activeTemplateId, setActiveTemplateId] = useState<string>('seal-in');
  const [drafts, setDrafts] = useState<SandboxNetworkDraft[]>(() =>
    cloneDrafts(SANDBOX_TEMPLATES[0].drafts)
  );
  const [inputMode, setInputMode] = useState<InputOperationMode>('momentary');

  const compiledProgram = useMemo(() => compileDraftsToProgram(drafts), [drafts]);
  const liveScl = useMemo(() => generateSclFromLadder(compiledProgram), [compiledProgram]);

  const { runtime, snapshot, intervalMs, setScanInterval, tracePaused, toggleTracePaused } =
    useLadderSimulation({
      tagDefs: SANDBOX_TAG_DEFS,
      program: compiledProgram,
      traceChannels: SANDBOX_TRACE_CHANNELS,
      initialIntervalMs: 50,
      traceCapacity: 120,
    });

  useEffect(() => {
    runtime.setProgram(compiledProgram);
  }, [runtime, compiledProgram]);

  const loadTemplate = (tpl: SandboxTemplate) => {
    setActiveTemplateId(tpl.id);
    setDrafts(cloneDrafts(tpl.drafts));
    runtime.reset();
  };

  const addNetwork = () => {
    if (drafts.length >= 6) return;
    setDrafts((prev) => [
      ...prev,
      {
        id: nextUid('nw'),
        title: `自定义网段 ${prev.length + 1}`,
        topBranch: [{ id: nextUid('c'), kind: 'NO', tag: 'I_Btn1' }],
        hasParallelBranch: false,
        parallelBranch: [],
        seriesAfter: [],
        timerMode: 'NONE',
        timerPtMs: 2000,
        coilKind: 'OTE',
        coilTag: 'Q_LampG',
      },
    ]);
  };

  const removeNetwork = (id: string) => {
    if (drafts.length <= 1) return;
    setDrafts((prev) => prev.filter((n) => n.id !== id));
  };

  const updateNetwork = (id: string, updater: (n: SandboxNetworkDraft) => SandboxNetworkDraft) => {
    setDrafts((prev) => prev.map((n) => (n.id === id ? updater(n) : n)));
  };

  const handleToggleRun = () => {
    runtime.setRunning?.(!snapshot.metrics.running);
  };

  const handleSingleScan = () => {
    if (snapshot.metrics.running) runtime.setRunning?.(false);
    runtime.singleScan(intervalMs);
  };

  const activeTemplate = SANDBOX_TEMPLATES.find((t) => t.id === activeTemplateId);

  return (
    <div className="plc-sim-root is-full is-sandbox">
      <CpuStatusBar
        metrics={snapshot.metrics}
        intervalMs={intervalMs}
        onToggleRun={handleToggleRun}
        onSingleScan={handleSingleScan}
        onChangeInterval={setScanInterval}
        onReset={() => runtime.reset()}
        programLabel="OB1_Custom_Sandbox"
      />

      {/* Sandbox Starter Templates & Guidance */}
      <div className="plc-sim-sandbox-banner">
        <div className="plc-sim-sb-top">
          <div className="plc-sim-sb-title">
            <Wrench size={15} />
            <strong>自定义梯形图搭建沙盒 (在线改图 · 实时编译监控)</strong>
          </div>
          <div className="plc-sim-sb-tpls">
            {SANDBOX_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className={`plc-sim-tpl-btn ${activeTemplateId === tpl.id ? 'active' : ''}`}
                onClick={() => loadTemplate(tpl)}
              >
                <Sparkles size={12} />
                {tpl.label}
              </button>
            ))}
          </div>
        </div>
        {activeTemplate && (
          <div className="plc-sim-sb-hint">{activeTemplate.hint}</div>
        )}
      </div>

      {/* Interactive Rung Builder */}
      <div className="plc-sim-builder-card">
        <div className="plc-sim-builder-head">
          <div className="plc-sim-pane-title">
            <GitBranch size={14} />
            <span>梯形图网段编辑器（支持串联触点、并联自锁 OR 支路、TON/TOF/TP 与 OTE/SET/RESET）</span>
          </div>
          <button
            type="button"
            className="plc-sim-add-nw-btn"
            onClick={addNetwork}
            disabled={drafts.length >= 6}
          >
            <Plus size={13} /> 新增网段 ({drafts.length}/6)
          </button>
        </div>

        <div className="plc-sim-builder-list">
          {drafts.map((nw, idx) => (
            <div key={nw.id} className="plc-sim-nw-editor">
              <div className="plc-sim-nwe-top">
                <span className="plc-sim-nw-badge">NW {idx + 1}</span>
                <input
                  type="text"
                  className="plc-sim-nwe-title-input"
                  value={nw.title}
                  onChange={(e) =>
                    updateNetwork(nw.id, (cur) => ({ ...cur, title: e.target.value }))
                  }
                  aria-label={`网段 ${idx + 1} 标题`}
                />
                <button
                  type="button"
                  className={`plc-sim-mini-btn ${nw.hasParallelBranch ? 'is-active' : ''}`}
                  onClick={() =>
                    updateNetwork(nw.id, (cur) => ({
                      ...cur,
                      hasParallelBranch: !cur.hasParallelBranch,
                      parallelBranch:
                        !cur.hasParallelBranch && cur.parallelBranch.length === 0
                          ? [{ id: nextUid('p'), kind: 'NO', tag: cur.coilTag }]
                          : cur.parallelBranch,
                    }))
                  }
                >
                  <GitBranch size={12} />
                  {nw.hasParallelBranch ? '已开启并联自锁支路' : '+ 添加并联自锁支路'}
                </button>
                {drafts.length > 1 && (
                  <button
                    type="button"
                    className="plc-sim-mini-btn is-danger"
                    onClick={() => removeNetwork(nw.id)}
                    title="删除该网段"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              <div className="plc-sim-nwe-rows">
                {/* Primary / Top Branch Row */}
                <div className="plc-sim-nwe-group">
                  <span className="plc-sim-nwe-label">
                    {nw.hasParallelBranch ? '主支路 (上)' : '串联触点'}
                  </span>
                  <div className="plc-sim-chip-row">
                    {nw.topBranch.map((c) => (
                      <div key={c.id} className="plc-sim-elem-pill">
                        <select
                          value={c.kind}
                          onChange={(e) =>
                            updateNetwork(nw.id, (cur) => ({
                              ...cur,
                              topBranch: cur.topBranch.map((x) =>
                                x.id === c.id ? { ...x, kind: e.target.value as SandboxContactKind } : x
                              ),
                            }))
                          }
                        >
                          <option value="NO">NO (| |)</option>
                          <option value="NC">NC (|/|)</option>
                          <option value="P_TRIG">P_TRIG (|P|)</option>
                          <option value="N_TRIG">N_TRIG (|N|)</option>
                        </select>
                        <select
                          value={c.tag}
                          onChange={(e) =>
                            updateNetwork(nw.id, (cur) => ({
                              ...cur,
                              topBranch: cur.topBranch.map((x) =>
                                x.id === c.id ? { ...x, tag: e.target.value } : x
                              ),
                            }))
                          }
                        >
                          {ALL_CONTACT_TAGS.map((t) => (
                            <option key={t.name} value={t.name}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        {nw.topBranch.length > 1 && (
                          <button
                            type="button"
                            className="plc-sim-pill-del"
                            onClick={() =>
                              updateNetwork(nw.id, (cur) => ({
                                ...cur,
                                topBranch: cur.topBranch.filter((x) => x.id !== c.id),
                              }))
                            }
                            aria-label="删除触点"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {nw.topBranch.length < 4 && (
                      <button
                        type="button"
                        className="plc-sim-add-chip"
                        onClick={() =>
                          updateNetwork(nw.id, (cur) => ({
                            ...cur,
                            topBranch: [
                              ...cur.topBranch,
                              { id: nextUid('c'), kind: 'NO', tag: 'I_Stop_NC' },
                            ],
                          }))
                        }
                      >
                        + 触点
                      </button>
                    )}
                  </div>
                </div>

                {/* Parallel OR Branch Row */}
                {nw.hasParallelBranch && (
                  <div className="plc-sim-nwe-group is-parallel">
                    <span className="plc-sim-nwe-label">并联 OR 支路 (下)</span>
                    <div className="plc-sim-chip-row">
                      {nw.parallelBranch.map((c) => (
                        <div key={c.id} className="plc-sim-elem-pill">
                          <select
                            value={c.kind}
                            onChange={(e) =>
                              updateNetwork(nw.id, (cur) => ({
                                ...cur,
                                parallelBranch: cur.parallelBranch.map((x) =>
                                  x.id === c.id
                                    ? { ...x, kind: e.target.value as SandboxContactKind }
                                    : x
                                ),
                              }))
                            }
                          >
                            <option value="NO">NO (| |)</option>
                            <option value="NC">NC (|/|)</option>
                            <option value="P_TRIG">P_TRIG (|P|)</option>
                            <option value="N_TRIG">N_TRIG (|N|)</option>
                          </select>
                          <select
                            value={c.tag}
                            onChange={(e) =>
                              updateNetwork(nw.id, (cur) => ({
                                ...cur,
                                parallelBranch: cur.parallelBranch.map((x) =>
                                  x.id === c.id ? { ...x, tag: e.target.value } : x
                                ),
                              }))
                            }
                          >
                            {ALL_CONTACT_TAGS.map((t) => (
                              <option key={t.name} value={t.name}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                          {nw.parallelBranch.length > 1 && (
                            <button
                              type="button"
                              className="plc-sim-pill-del"
                              onClick={() =>
                                updateNetwork(nw.id, (cur) => ({
                                  ...cur,
                                  parallelBranch: cur.parallelBranch.filter((x) => x.id !== c.id),
                                }))
                              }
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      {nw.parallelBranch.length < 3 && (
                        <button
                          type="button"
                          className="plc-sim-add-chip"
                          onClick={() =>
                            updateNetwork(nw.id, (cur) => ({
                              ...cur,
                              parallelBranch: [
                                ...cur.parallelBranch,
                                { id: nextUid('p'), kind: 'NO', tag: 'I_Btn2' },
                              ],
                            }))
                          }
                        >
                          + 支路触点
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Series After Merge (for stop/interlock after seal-in) */}
                {nw.hasParallelBranch && (
                  <div className="plc-sim-nwe-group">
                    <span className="plc-sim-nwe-label">汇合后串联 (停机/互锁)</span>
                    <div className="plc-sim-chip-row">
                      {nw.seriesAfter.map((c) => (
                        <div key={c.id} className="plc-sim-elem-pill">
                          <select
                            value={c.kind}
                            onChange={(e) =>
                              updateNetwork(nw.id, (cur) => ({
                                ...cur,
                                seriesAfter: cur.seriesAfter.map((x) =>
                                  x.id === c.id
                                    ? { ...x, kind: e.target.value as SandboxContactKind }
                                    : x
                                ),
                              }))
                            }
                          >
                            <option value="NO">NO (| |)</option>
                            <option value="NC">NC (|/|)</option>
                            <option value="P_TRIG">P_TRIG (|P|)</option>
                            <option value="N_TRIG">N_TRIG (|N|)</option>
                          </select>
                          <select
                            value={c.tag}
                            onChange={(e) =>
                              updateNetwork(nw.id, (cur) => ({
                                ...cur,
                                seriesAfter: cur.seriesAfter.map((x) =>
                                  x.id === c.id ? { ...x, tag: e.target.value } : x
                                ),
                              }))
                            }
                          >
                            {ALL_CONTACT_TAGS.map((t) => (
                              <option key={t.name} value={t.name}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="plc-sim-pill-del"
                            onClick={() =>
                              updateNetwork(nw.id, (cur) => ({
                                ...cur,
                                seriesAfter: cur.seriesAfter.filter((x) => x.id !== c.id),
                              }))
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {nw.seriesAfter.length < 3 && (
                        <button
                          type="button"
                          className="plc-sim-add-chip"
                          onClick={() =>
                            updateNetwork(nw.id, (cur) => ({
                              ...cur,
                              seriesAfter: [
                                ...cur.seriesAfter,
                                { id: nextUid('s'), kind: 'NO', tag: 'I_Stop_NC' },
                              ],
                            }))
                          }
                        >
                          + 串联互锁
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Timer & Output Coil Row */}
                <div className="plc-sim-nwe-footer">
                  <div className="plc-sim-nwe-inline">
                    <span className="plc-sim-nwe-label">IEC 定时器</span>
                    <select
                      value={nw.timerMode}
                      onChange={(e) =>
                        updateNetwork(nw.id, (cur) => ({
                          ...cur,
                          timerMode: e.target.value as 'NONE' | TimerType,
                        }))
                      }
                    >
                      <option value="NONE">无定时器</option>
                      <option value="TON">TON 接通延时</option>
                      <option value="TOF">TOF 断开延时</option>
                      <option value="TP">TP 脉冲定时</option>
                    </select>
                    {nw.timerMode !== 'NONE' && (
                      <label className="plc-sim-pt-input">
                        PT:
                        <input
                          type="number"
                          min={200}
                          max={15000}
                          step={200}
                          value={nw.timerPtMs}
                          onChange={(e) =>
                            updateNetwork(nw.id, (cur) => ({
                              ...cur,
                              timerPtMs: Number(e.target.value) || 1000,
                            }))
                          }
                        />
                        ms
                      </label>
                    )}
                  </div>

                  <div className="plc-sim-nwe-inline">
                    <span className="plc-sim-nwe-label">输出线圈</span>
                    <select
                      value={nw.coilKind}
                      onChange={(e) =>
                        updateNetwork(nw.id, (cur) => ({
                          ...cur,
                          coilKind: e.target.value as SandboxCoilKind,
                        }))
                      }
                    >
                      <option value="OTE">OTE 普通线圈 ( )</option>
                      <option value="SET">SET 置位线圈 (S)</option>
                      <option value="RESET">RESET 复位线圈 (R)</option>
                    </select>
                    <select
                      value={nw.coilTag}
                      onChange={(e) =>
                        updateNetwork(nw.id, (cur) => ({
                          ...cur,
                          coilTag: e.target.value,
                        }))
                      }
                    >
                      {COIL_TAGS.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Live Monitor + Field Panel */}
      <div className="plc-sim-main-split">
        <div className="plc-sim-ladder-pane">
          <div className="plc-sim-pane-bar">
            <div className="plc-sim-pane-title">
              <Layers size={14} />
              <span>沙盒实时能流监控（上方改图立即生效）</span>
            </div>
            {snapshot.evalSnapshot.doubleCoilWarnings.length > 0 && (
              <span className="plc-sim-pill-warn">
                <AlertTriangle size={12} /> 发现双线圈写入
              </span>
            )}
          </div>
          <LadderCanvas
            program={compiledProgram}
            tagDefs={SANDBOX_TAG_DEFS}
            tags={snapshot.tags}
            evalSnapshot={snapshot.evalSnapshot}
            running={snapshot.metrics.running}
            onToggleInputTag={(t) => runtime.setFieldInput(t, !Boolean(runtime.getFieldInput(t)))}
          />
        </div>

        <aside className="plc-sim-field-pane">
          <FieldPanel
            tagDefs={SANDBOX_TAG_DEFS}
            fieldInputMetas={SANDBOX_FIELD_INPUTS}
            fieldOutputMetas={SANDBOX_FIELD_OUTPUTS}
            fieldInputs={snapshot.fieldInputs}
            pii={snapshot.pii}
            fieldOutputs={snapshot.fieldOutputs}
            tags={snapshot.tags}
            running={snapshot.metrics.running}
            inputMode={inputMode}
            onInputModeChange={setInputMode}
            onSetInput={(tag: string, val: TagValue) => runtime.setFieldInput(tag, val)}
          />
        </aside>
      </div>

      {/* Bottom Dock: Trace + Auto-generated SCL */}
      <div className="plc-sim-bottom-dock">
        <TraceViewer
          channels={SANDBOX_TRACE_CHANNELS}
          samples={snapshot.traceSamples}
          paused={tracePaused}
          onTogglePause={toggleTracePaused}
          onClear={() => runtime.clearTrace()}
        />
        <SclCodePanel
          code={liveScl}
          tags={snapshot.tags}
          title="自定义梯形图实时自动转译 SCL"
        />
      </div>
    </div>
  );
};
