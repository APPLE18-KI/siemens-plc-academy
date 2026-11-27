import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileCode2,
  FileJson,
  GitBranch,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  Upload,
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
import { generateSclFromLadder, generateTiaSclFile } from '../sclGenerator';
import {
  parseSandboxProjectJson,
  serializeSandboxProject,
  type SandboxCoilKind,
  type SandboxContactDraft,
  type SandboxContactKind,
  type SandboxNetworkDraft,
} from '../sandboxCodec';
import { CpuStatusBar } from './CpuStatusBar';
import { CrossRefSandboxPanel } from './CrossRefInspector';
import { FieldPanel, type InputOperationMode } from './FieldPanel';
import { LadderCanvas } from './LadderCanvas';
import { SclCodePanel } from './SclCodePanel';
import { ShortcutHintBar } from './ShortcutHintBar';
import { TraceViewer } from './TraceViewer';
import { useSimulatorShortcuts } from '../hooks/useSimulatorShortcuts';

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

const ALL_CONTACT_TAG_SET = new Set(SANDBOX_TAG_DEFS.map((d) => d.name));
const COIL_TAG_SET = new Set(
  SANDBOX_TAG_DEFS.filter((d) => d.area === 'Q' || d.area === 'M').map((d) => d.name),
);

function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const LadderSandbox: React.FC = () => {
  const [activeTemplateId, setActiveTemplateId] = useState<string>('seal-in');
  const [drafts, setDrafts] = useState<SandboxNetworkDraft[]>(() =>
    cloneDrafts(SANDBOX_TEMPLATES[0].drafts),
  );
  const [inputMode, setInputMode] = useState<InputOperationMode>('momentary');
  const [jsonDrawerOpen, setJsonDrawerOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [focusedNetwork, setFocusedNetwork] = useState<number | null>(null);

  const canvasPaneRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const focusTimer = useRef<number | undefined>(undefined);

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

  useEffect(
    () => () => {
      window.clearTimeout(noticeTimer.current);
      window.clearTimeout(focusTimer.current);
    },
    [],
  );

  const flashNotice = useCallback((msg: string) => {
    setStatusNotice(msg);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setStatusNotice(null), 2800);
  }, []);

  const loadTemplate = (tpl: SandboxTemplate) => {
    setActiveTemplateId(tpl.id);
    setDrafts(cloneDrafts(tpl.drafts));
    setJsonError(null);
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

  const handleToggleRun = useCallback(() => {
    const isRunning = runtime.getMetrics?.().running ?? true;
    runtime.setRunning?.(!isRunning);
  }, [runtime]);

  const handleSingleScan = useCallback(() => {
    if (runtime.getMetrics?.().running) runtime.setRunning?.(false);
    runtime.singleScan(intervalMs);
  }, [runtime, intervalMs]);

  const handleReset = useCallback(() => {
    runtime.reset();
    flashNotice('已复位沙盒 I/O、定时器与示波器缓冲。');
  }, [runtime, flashNotice]);

  const handleClearTrace = useCallback(() => runtime.clearTrace(), [runtime]);

  const handleSetFieldInput = useCallback(
    (tag: string, val: TagValue) => runtime.setFieldInput(tag, val),
    [runtime],
  );

  const handleToggleInputFromCanvas = useCallback(
    (t: string) => runtime.setFieldInput(t, !Boolean(runtime.getFieldInput(t))),
    [runtime],
  );

  const handleJumpToNetwork = useCallback(
    (nw: number) => {
      setFocusedNetwork(nw);
      window.clearTimeout(focusTimer.current);
      focusTimer.current = window.setTimeout(() => setFocusedNetwork(null), 2600);
      const el = canvasPaneRef.current?.querySelector<HTMLElement>(
        `[data-network-number="${nw}"]`,
      );
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      flashNotice(`已滚动定位到 NW ${nw}。`);
    },
    [flashNotice],
  );

  const handleExportSclFile = useCallback(() => {
    const tplLabel =
      SANDBOX_TEMPLATES.find((t) => t.id === activeTemplateId)?.label ?? 'Custom_Sandbox';
    const content = generateTiaSclFile(compiledProgram, SANDBOX_TAG_DEFS, {
      fbName: 'FB_Custom_Ladder',
      projectTitle: tplLabel,
    });
    downloadTextFile('FB_Custom_Ladder.scl', content, 'text/plain;charset=utf-8');
    flashNotice('已导出博途外部源文件 FB_Custom_Ladder.scl（含 FUNCTION_BLOCK 与 REGION 头）。');
  }, [activeTemplateId, compiledProgram, flashNotice]);

  const handleCopyProjectJson = useCallback(async () => {
    const json = serializeSandboxProject(drafts);
    try {
      await navigator.clipboard.writeText(json);
      setCopiedJson(true);
      window.setTimeout(() => setCopiedJson(false), 1800);
      flashNotice('已复制沙盒工程 JSON 到剪贴板，可直接保存或分享给同伴导入。');
    } catch {
      setJsonInput(json);
      setJsonDrawerOpen(true);
      flashNotice('浏览器未授予剪贴板权限，已在下方展开工程 JSON 供手动复制。');
    }
  }, [drafts, flashNotice]);

  const handleDownloadJsonFile = useCallback(() => {
    const json = serializeSandboxProject(drafts);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`plc-sandbox-${stamp}.json`, json, 'application/json;charset=utf-8');
    flashNotice(`已下载沙盒工程文件 plc-sandbox-${stamp}.json。`);
  }, [drafts, flashNotice]);

  const handleToggleJsonDrawer = useCallback(() => {
    setJsonDrawerOpen((open) => {
      const next = !open;
      if (next) {
        setJsonInput(serializeSandboxProject(drafts));
        setJsonError(null);
      }
      return next;
    });
  }, [drafts]);

  const applyImportedJson = useCallback(
    (raw: string) => {
      const result = parseSandboxProjectJson(raw, ALL_CONTACT_TAG_SET, COIL_TAG_SET);
      if (!result.ok) {
        setJsonError(result.error);
        return;
      }
      setDrafts(cloneDrafts(result.drafts));
      setActiveTemplateId('custom-imported');
      setJsonError(null);
      setJsonDrawerOpen(false);
      runtime.reset();
      flashNotice(`成功导入沙盒工程（${result.drafts.length} 个程序段）并已实时编译。`);
    },
    [runtime, flashNotice],
  );

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setJsonInput(text);
      applyImportedJson(text);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  useSimulatorShortcuts({
    onToggleRun: handleToggleRun,
    onSingleScan: handleSingleScan,
    onResetMres: handleReset,
  });

  const shortcutItems = useMemo(
    () => [
      {
        keys: 'Alt+R',
        label: snapshot.metrics.running ? '停止 CPU' : '运行 CPU',
        onTrigger: handleToggleRun,
      },
      { keys: 'Alt+S', label: '单步扫描 OB1', onTrigger: handleSingleScan },
      { keys: 'Alt+M', label: '复位沙盒 (MRES)', onTrigger: handleReset },
    ],
    [snapshot.metrics.running, handleToggleRun, handleSingleScan, handleReset],
  );

  const activeTemplate = SANDBOX_TEMPLATES.find((t) => t.id === activeTemplateId);

  return (
    <div className="plc-sim-root is-full is-sandbox">
      <CpuStatusBar
        metrics={snapshot.metrics}
        intervalMs={intervalMs}
        onToggleRun={handleToggleRun}
        onSingleScan={handleSingleScan}
        onChangeInterval={setScanInterval}
        onReset={handleReset}
        programLabel="OB1_Custom_Sandbox"
      />

      <ShortcutHintBar items={shortcutItems} variant="instrument" />

      {/* Sandbox Starter Templates & Engineering Export/Import Bar */}
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

        {/* Engineering Productivity Toolbar: .scl Export + Project JSON Copy/Import */}
        <div className="plc-sb-tools" role="toolbar" aria-label="沙盒工程导入导出工具">
          <button
            type="button"
            className="plc-sb-tool-btn is-primary"
            onClick={handleExportSclFile}
            title="生成带标准 FUNCTION_BLOCK 与 REGION 注释头的博途外部源文件 (.scl)"
          >
            <FileCode2 size={14} />
            <span>导出博途 .scl 源文件</span>
          </button>
          <button
            type="button"
            className="plc-sb-tool-btn"
            onClick={handleCopyProjectJson}
            title="复制当前自定义梯形图工程 JSON，用于保存或分享"
          >
            {copiedJson ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedJson ? '已复制工程 JSON' : '复制工程 JSON'}</span>
          </button>
          <button
            type="button"
            className={`plc-sb-tool-btn${jsonDrawerOpen ? ' is-open' : ''}`}
            aria-expanded={jsonDrawerOpen}
            onClick={handleToggleJsonDrawer}
            title="粘贴或上传 JSON 恢复已保存的梯形图工程"
          >
            <FileJson size={14} />
            <span>{jsonDrawerOpen ? '收起 JSON 导入/导出' : '导入 / 管理工程 JSON'}</span>
          </button>
          {statusNotice && (
            <span className="plc-sb-notice" role="status">
              {statusNotice}
            </span>
          )}
        </div>

        {jsonDrawerOpen && (
          <div className="plc-sb-json-drawer">
            <div className="plc-sb-json-head">
              <span>粘贴沙盒工程 JSON 代码以恢复程序段，或下载 / 上传 <code>.json</code> 文件：</span>
              <div className="plc-sb-json-actions">
                <button type="button" className="plc-sim-mini-btn" onClick={handleDownloadJsonFile}>
                  <Download size={13} /> 下载 .json
                </button>
                <button
                  type="button"
                  className="plc-sim-mini-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={13} /> 从文件导入
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="plc-sr-only"
                  onChange={handleImportFileChange}
                />
              </div>
            </div>
            <textarea
              className="plc-sb-json-textarea"
              rows={6}
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                if (jsonError) setJsonError(null);
              }}
              placeholder='{"schema":"siemens-plc-academy.sandbox.v1","drafts":[...]}'
              aria-label="沙盒工程 JSON 代码"
            />
            {jsonError && (
              <div className="plc-sb-json-error" role="alert">
                <AlertTriangle size={14} />
                <span>{jsonError}</span>
              </div>
            )}
            <div className="plc-sb-json-foot">
              <button
                type="button"
                className="plc-sb-tool-btn is-primary"
                onClick={() => applyImportedJson(jsonInput)}
              >
                <Upload size={14} /> 校验并加载该工程
              </button>
              <button
                type="button"
                className="plc-sb-tool-btn"
                onClick={() => {
                  setJsonInput(serializeSandboxProject(drafts));
                  setJsonError(null);
                }}
              >
                刷新为当前梯形图 JSON
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Live TIA-grade Static Double-Coil & Address Health Diagnostics + Expandable Cross-Ref (F11) */}
      <CrossRefSandboxPanel
        program={compiledProgram}
        tagDefs={SANDBOX_TAG_DEFS}
        onJumpToNetwork={handleJumpToNetwork}
      />

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
        <div className="plc-sim-ladder-pane" ref={canvasPaneRef}>
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
            focusedNetwork={focusedNetwork}
            onToggleInputTag={handleToggleInputFromCanvas}
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
            onSetInput={handleSetFieldInput}
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
          onClear={handleClearTrace}
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
