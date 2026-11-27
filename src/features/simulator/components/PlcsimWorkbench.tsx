import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Glasses,
  ListChecks,
  Lock,
  Network,
  Play,
  RotateCcw,
  ScrollText,
  Square,
  StepForward,
  Table2,
  Tags,
  Workflow,
  Zap,
} from 'lucide-react';
import type { SimPresetId } from '../../../types/content';
import type { TagDef, TagValue } from '../../../types/plc';
import {
  analyzeProgramCrossRef,
  inferTagArea,
  useLadderSimulation,
  type ScanIntervalOption,
} from '../../../core/plc';
import { SIM_PRESET_DEFINITIONS, type FieldInputMeta } from '../presets';
import { TiaLadder, TiaLegend } from './TiaLadder';
import { CrossRefWorkbenchPanel } from './CrossRefInspector';
import { ShortcutHintBar } from './ShortcutHintBar';
import { useSimulatorShortcuts } from '../hooks/useSimulatorShortcuts';
import { haptic } from '../../../app/native/platform';

/**
 * “博途 + PLCSIM”视图：
 * - CPU 操作面板（参考 S7-PLCSIM 紧凑视图：RUN/STOP、ERROR、MAINT 指示灯，RUN/STOP/MRES 按钮）
 * - Main [OB1] 程序编辑器（TIA 风格 LAD，在线监视）
 * - SIM 表 / PLC 变量表 / 监控表 / 强制表 / 交叉引用 (F11) / 诊断缓冲区
 * 行为依据：S7-1200 系统手册 V4.7（运行模式、扫描周期、最大循环时间、强制、状态 LED）
 * 与 S7-PLCSIM 在线帮助（SIM 表列、位复选框、默认只写输入、MRES）。
 */

type TabId = 'ob1' | 'sim' | 'tags' | 'watch' | 'force' | 'xref' | 'diag';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'ob1', label: 'Main [OB1]', icon: Workflow },
  { id: 'xref', label: '交叉引用 (F11)', icon: Network },
  { id: 'sim', label: 'SIM 表', icon: Table2 },
  { id: 'tags', label: 'PLC 变量表', icon: Tags },
  { id: 'watch', label: '监控表', icon: Glasses },
  { id: 'force', label: '强制表', icon: Lock },
  { id: 'diag', label: '诊断缓冲区', icon: ScrollText },
];

const SPEEDS: { ms: ScanIntervalOption; label: string }[] = [
  { ms: 50, label: '正常' },
  { ms: 200, label: '慢' },
  { ms: 500, label: '很慢' },
];

function fmt(def: TagDef, v: TagValue | undefined): string {
  if (v === undefined) return '—';
  if (def.type === 'Bool') return v ? 'TRUE' : 'FALSE';
  if (def.type === 'Real') return Number(v).toFixed(3);
  if (def.type === 'Time') return `T#${Math.round(Number(v))}MS`;
  return String(Math.round(Number(v)));
}

function displayFormat(def: TagDef): string {
  switch (def.type) {
    case 'Bool':
      return '布尔型';
    case 'Real':
      return '浮点数';
    case 'Time':
      return '时间';
    default:
      return '带符号十进制';
  }
}

function parseValue(def: TagDef, raw: string): TagValue | null {
  const t = raw.trim().toUpperCase();
  if (def.type === 'Bool') {
    if (t === '1' || t === 'TRUE') return true;
    if (t === '0' || t === 'FALSE') return false;
    return null;
  }
  const n = Number(t.replace(/^T#/, '').replace(/MS$/, ''));
  if (!Number.isFinite(n)) return null;
  if (def.type === 'Int') return Math.max(-32768, Math.min(32767, Math.round(n)));
  return n;
}

function fmtClock(ts: number): string {
  const d = new Date(ts);
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

/** 现场按钮：常开按下=1；常闭平时=1、按下=0；保持型点一下切换 */
const FieldButton = memo<{
  meta: FieldInputMeta;
  def?: TagDef;
  value: boolean;
  forceLatch?: boolean;
  onSet: (tag: string, v: boolean) => void;
}>(function FieldButton({ meta, def, value, forceLatch = false, onSet }) {
  const momentary = !forceLatch && meta.defaultMomentary !== false;
  const pressedVal = meta.physicalType === 'NC' ? false : true;
  const restVal = !pressedVal;
  const pressed = momentary ? value === pressedVal : value !== (meta.physicalType === 'NC');
  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!momentary) return;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* 合成事件没有活动指针 */
    }
    haptic('press');
    onSet(meta.tag, pressedVal);
  };
  const up = () => {
    if (!momentary) return;
    haptic('tap');
    onSet(meta.tag, restVal);
  };
  return (
    <button
      type="button"
      className={`ps-fbtn tone-${meta.tone}${pressed ? ' is-pressed' : ''}`}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (momentary) return;
        haptic('tap');
        onSet(meta.tag, !value);
      }}
      onKeyDown={(e) => {
        if (momentary && (e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          onSet(meta.tag, pressedVal);
        }
      }}
      onKeyUp={(e) => {
        if (momentary && (e.key === ' ' || e.key === 'Enter')) onSet(meta.tag, restVal);
      }}
      aria-pressed={pressed}
      aria-label={`${meta.label}（${momentary ? '按住' : '点一下切换'}）`}
    >
      <span className="ps-fbtn-addr">{def?.address}</span>
      <span className="ps-fbtn-label">{meta.label}</span>
      <span className="ps-fbtn-hint">
        {meta.physicalType === 'NC' ? '常闭(不按=1)' : '常开(按下=1)'} · {momentary ? '按住生效' : '点一下锁住'} · 当前={value ? '1' : '0'}
      </span>
    </button>
  );
});

export const PlcsimWorkbench: React.FC<{ presetId: SimPresetId }> = ({ presetId }) => {
  const preset = SIM_PRESET_DEFINITIONS[presetId];
  const { runtime, snapshot, intervalMs, setScanInterval } = useLadderSimulation({
    tagDefs: preset.tagDefs,
    program: preset.program,
    traceChannels: preset.traceChannels,
    initialIntervalMs: 50,
    traceCapacity: 60,
  });
  const [tab, setTab] = useState<TabId>('ob1');
  const [monitor, setMonitor] = useState(true);
  const [starting, setStarting] = useState(false);
  const [mresArmed, setMresArmed] = useState(false);
  const [allowNonInput, setAllowNonInput] = useState(false);
  const [watchMods, setWatchMods] = useState<Record<string, string>>({});
  const [forceRows, setForceRows] = useState<Record<string, { on: boolean; value: string }>>({});
  const [openDiag, setOpenDiag] = useState<number | null>(null);
  const [focusedNetwork, setFocusedNetwork] = useState<number | null>(null);
  const [latchMode, setLatchMode] = useState(false);
  const [hideCoach, setHideCoach] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('plc_sim_coach_hide_v1') === '1';
    } catch {
      return false;
    }
  });
  const [coachTriedInput, setCoachTriedInput] = useState(false);
  const [coachTriedStepOrStop, setCoachTriedStepOrStop] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const focusTimer = useRef<number | undefined>(undefined);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const running = snapshot.metrics.running;
  const cpu = snapshot.cpu;
  const forcedCount = Object.keys(cpu.forces).length;
  const defs = preset.tagDefs;
  const defMap = useMemo(() => new Map(defs.map((d) => [d.name, d])), [defs]);
  const ioDefs = useMemo(() => defs.filter((d) => ['I', 'Q'].includes(inferTagArea(d))), [defs]);
  const crossRefSummary = useMemo(
    () => analyzeProgramCrossRef(preset.program, defs),
    [preset.program, defs],
  );
  const xrefBadgeCount = crossRefSummary.errorCount + crossRefSummary.warningCount;

  const say = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current);
      window.clearTimeout(focusTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!mresArmed) return;
    const t = window.setTimeout(() => setMresArmed(false), 3500);
    return () => window.clearTimeout(t);
  }, [mresArmed]);

  const doRun = useCallback(() => {
    if (running || starting) return;
    haptic('success');
    setStarting(true);
    runtime.warmRestart();
    window.setTimeout(() => {
      runtime.setRunning?.(true);
      setStarting(false);
    }, 900);
  }, [running, starting, runtime]);

  const doStop = useCallback(() => {
    if (!running) return;
    haptic('press');
    setCoachTriedStepOrStop(true);
    runtime.setRunning?.(false);
  }, [running, runtime]);

  const doSingleScan = useCallback(() => {
    if (running) {
      runtime.setRunning?.(false);
    }
    haptic('tap');
    setCoachTriedStepOrStop(true);
    runtime.singleScan(intervalMs);
    say('已执行单步 OB1 扫描（PII → OB1 → PIQ）。');
  }, [running, runtime, intervalMs, say]);

  const doMres = useCallback(() => {
    if (running) {
      say('MRES 只能在 STOP 模式下执行：请先点 STOP（或按 Alt+R）。');
      haptic('error');
      return;
    }
    if (!mresArmed) {
      setMresArmed(true);
      haptic('tap');
      say('MRES 已预备：3.5 秒内再点一次或按 Alt+M 确认存储器复位。');
      return;
    }
    setMresArmed(false);
    runtime.memoryReset();
    haptic('success');
    say('存储器复位完成：数据回到初始值，诊断缓冲区保留。');
  }, [running, mresArmed, runtime, say]);

  const doToggleRun = useCallback(() => {
    if (running) doStop();
    else doRun();
  }, [running, doStop, doRun]);

  const handleOpenCrossRef = useCallback(() => {
    setTab('xref');
    say('已切换到交叉引用表 (Cross-Reference · F11)。');
  }, [say]);

  const handleJumpToNetwork = useCallback(
    (nw: number) => {
      setTab('ob1');
      setFocusedNetwork(nw);
      window.clearTimeout(focusTimer.current);
      focusTimer.current = window.setTimeout(() => setFocusedNetwork(null), 2600);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const el = panelRef.current?.querySelector<HTMLElement>(
            `[data-network-number="${nw}"]`,
          );
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
      say(`已定位到 Main [OB1] 程序段 ${nw}。`);
    },
    [say],
  );

  useSimulatorShortcuts({
    onToggleRun: doToggleRun,
    onSingleScan: doSingleScan,
    onResetMres: doMres,
    onOpenCrossRef: handleOpenCrossRef,
  });

  const shortcutItems = useMemo(
    () => [
      { keys: 'Alt+R', label: running ? '切换 STOP' : '启动 RUN', onTrigger: doToggleRun },
      { keys: 'Alt+S', label: '单步 OB1', onTrigger: doSingleScan },
      { keys: 'Alt+M', label: mresArmed ? '确认 MRES' : '复位 MRES', onTrigger: doMres },
      { keys: 'F11 / Alt+X', label: '交叉引用', onTrigger: handleOpenCrossRef },
    ],
    [running, mresArmed, doToggleRun, doSingleScan, doMres, handleOpenCrossRef],
  );

  const leds = {
    run: starting ? 'flash-ry' : running ? 'green' : 'yellow',
    err: cpu.errorActive ? 'flash-red' : 'off',
    maint: 'off',
  };

  const writeInput = useCallback(
    (name: string, v: TagValue) => {
      setCoachTriedInput(true);
      runtime.setFieldInput(name, v);
    },
    [runtime],
  );

  const handleToggleInputTag = useCallback(
    (t: string) => {
      haptic('tap');
      runtime.setFieldInput(t, !Boolean(runtime.getFieldInput(t)));
    },
    [runtime],
  );

  const modifyNow = (def: TagDef, raw: string) => {
    const v = parseValue(def, raw);
    if (v === null) {
      say(`“${raw}” 不是 ${def.type} 类型的有效值`);
      haptic('error');
      return;
    }
    const area = inferTagArea(def);
    if (area === 'I') runtime.setFieldInput(def.name, v);
    else runtime.setTag(def.name, v);
    haptic('tap');
    say(
      area === 'I'
        ? `已把 ${def.address} 改为 ${fmt(def, v)}（下一个循环读输入时生效）`
        : `已写入 ${def.address} = ${fmt(def, v)}；如果程序每个循环都写它，会马上被程序覆盖。`,
    );
  };

  const applyForces = () => {
    let n = 0;
    for (const d of ioDefs) {
      const row = forceRows[d.name];
      if (row?.on) {
        const v = parseValue(d, row.value || (d.type === 'Bool' ? 'TRUE' : '0'));
        if (v !== null) {
          runtime.setForce(d.name, v);
          n += 1;
        }
      } else if (d.name in cpu.forces) {
        runtime.setForce(d.name, undefined);
      }
    }
    haptic(n ? 'success' : 'tap');
    say(n ? `已强制 ${n} 个地址。调试完请记得“停止强制”。` : '没有勾选 F 的行：已取消全部强制。');
  };

  return (
    <div className="ps-root">
      {/* ── CPU 操作面板 ── */}
      <section className="ps-cpu" aria-label="仿真 CPU 操作面板">
        <div className="ps-cpu-id">
          <div className="ps-cpu-name">PLC_1 [CPU 1214C DC/DC/DC]</div>
          <div className="ps-cpu-ip">PROFINET 接口 · 192.168.0.1</div>
        </div>
        <div className="ps-cpu-body">
          <ul className="ps-leds" aria-label="CPU 状态指示灯">
            <li>
              <span className={`ps-led ${leds.run}`} aria-hidden />
              <span>RUN/STOP</span>
            </li>
            <li>
              <span className={`ps-led ${leds.err}`} aria-hidden />
              <span>ERROR</span>
            </li>
            <li>
              <span className={`ps-led ${leds.maint}`} aria-hidden />
              <span>MAINT</span>
            </li>
          </ul>
          <div className="ps-mode" role="status" aria-live="polite">
            <span className={`ps-mode-pill ${starting ? 'startup' : running ? 'run' : 'stop'}`}>
              {starting ? 'STARTUP 启动中' : running ? 'RUN 运行' : 'STOP 停止'}
            </span>
            {forcedCount > 0 && <span className="ps-mode-pill force">强制中 ×{forcedCount}</span>}
            {cpu.errorActive && <span className="ps-mode-pill err">时间错误</span>}
          </div>
          <div className="ps-cpu-btns">
            <button type="button" className="ps-btn run" onClick={doRun} disabled={running || starting}>
              <Play size={15} /> RUN
            </button>
            <button type="button" className="ps-btn stop" onClick={doStop} disabled={!running}>
              <Square size={14} /> STOP
            </button>
            <button type="button" className={`ps-btn mres${mresArmed ? ' armed' : ''}`} onClick={doMres}>
              <RotateCcw size={14} /> {mresArmed ? '再点确认' : 'MRES'}
            </button>
          </div>
        </div>
        <div className="ps-cycle" aria-label="扫描周期">
          <div className={`ps-phases${running ? ' is-running' : ''}`} style={{ ['--ps-cycle' as string]: `${intervalMs * 3}ms` }}>
            <span>① 写输出</span>
            <span>② 读输入</span>
            <span>③ 执行 OB1</span>
          </div>
          <dl className="ps-cycle-stats">
            <div>
              <dt>循环次数</dt>
              <dd>{snapshot.metrics.cycleCount}</dd>
            </div>
            <div>
              <dt>当前循环</dt>
              <dd>{snapshot.metrics.lastScanMs.toFixed(2)} ms</dd>
            </div>
            <div>
              <dt>最短 / 最长</dt>
              <dd>
                {cpu.cycleMinMs.toFixed(2)} / {cpu.cycleMaxMs.toFixed(2)} ms
              </dd>
            </div>
            <div>
              <dt>最大循环时间</dt>
              <dd>{cpu.maxCycleLimitMs} ms</dd>
            </div>
          </dl>
          <div className="ps-cycle-tools">
            <div className="ps-seg" role="group" aria-label="演示速度">
              <span className="ps-seg-label">演示速度</span>
              {SPEEDS.map((s) => (
                <button key={s.ms} type="button" className={intervalMs === s.ms ? 'on' : ''} aria-pressed={intervalMs === s.ms} onClick={() => setScanInterval(s.ms)}>
                  {s.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="ps-btn ghost"
              onClick={doSingleScan}
              title="执行严格 1 个 OB1 扫描周期 (快捷键 Alt+S)"
            >
              <StepForward size={14} /> 单步 OB1
            </button>
            <button
              type="button"
              className="ps-btn ghost danger"
              disabled={!running}
              onClick={() => {
                haptic('error');
                runtime.simulateCycleOverrun();
                say('模拟了一次严重超时：CPU 转入 STOP，ERROR 灯闪烁。去“诊断缓冲区”看看记录。');
              }}
            >
              <AlertTriangle size={14} /> 模拟循环超时
            </button>
          </div>
        </div>
      </section>

      {/* ── 新手 30 秒跟做引导条（可一键收起） ── */}
      {!hideCoach ? (
        <section className="ps-coach-bar" aria-label="仿真新手三步引导">
          <div className="ps-coach-head">
            <strong>第一次用仿真台？跟着做这 3 步就能看懂：</strong>
            <button
              type="button"
              className="ps-coach-dismiss"
              onClick={() => {
                setHideCoach(true);
                try {
                  window.localStorage.setItem('plc_sim_coach_hide_v1', '1');
                } catch {
                  /* ignore */
                }
              }}
            >
              我会用了，收起
            </button>
          </div>
          <ol className="ps-coach-steps">
            <li className={running ? 'done' : ''}>
              <span className="ps-coach-no">{running ? '✓' : '1'}</span>
              <span>确认上方 CPU 处于绿色 <b>RUN 运行</b>（停机时程序不会算）</span>
            </li>
            <li className={coachTriedInput ? 'done' : ''}>
              <span className="ps-coach-no">{coachTriedInput ? '✓' : '2'}</span>
              <span>点下方<b>现场按钮</b>，同时往下看梯形图哪根线变成<b>绿色实线</b>、右侧哪个输出灯亮起</span>
            </li>
            <li className={coachTriedStepOrStop ? 'done' : ''}>
              <span className="ps-coach-no">{coachTriedStepOrStop ? '✓' : '3'}</span>
              <span>手机/触控板可开下方<b>「点一下锁住」</b>腾出手滚屏；想慢动作看过程就点上方<b>「单步 OB1」</b></span>
            </li>
          </ol>
        </section>
      ) : (
        <div className="ps-coach-reopen-row">
          <button
            type="button"
            className="ps-coach-reopen"
            onClick={() => {
              setHideCoach(false);
              try {
                window.localStorage.removeItem('plc_sim_coach_hide_v1');
              } catch {
                /* ignore */
              }
            }}
          >
            展开新手 3 步操作提示
          </button>
        </div>
      )}

      {/* ── 现场 I/O ── */}
      <section className="ps-field" aria-label="现场按钮与输出">
        <div className="ps-field-toolbar">
          <span className="ps-field-title">
            现场电柜按钮与指示灯
            <small>（注：红色常闭按钮平时接通=1，点下断开=0）</small>
          </span>
          <button
            type="button"
            className={`ps-latch-toggle${latchMode ? ' is-on' : ''}`}
            aria-pressed={latchMode}
            onClick={() => {
              haptic('tap');
              setLatchMode((v) => !v);
            }}
          >
            {latchMode ? '当前：点一下锁住（方便腾手滚屏看梯形图）' : '切换为：点一下锁住按钮'}
          </button>
        </div>
        <div className="ps-field-inputs">
          {preset.fieldInputs.map((m) => (
            <FieldButton
              key={m.tag}
              meta={m}
              def={defMap.get(m.tag)}
              value={Boolean(snapshot.fieldInputs[m.tag])}
              forceLatch={latchMode}
              onSet={writeInput}
            />
          ))}
        </div>
        <div className="ps-field-outputs">
          {preset.fieldOutputs.map((o) => {
            const on = Boolean(snapshot.fieldOutputs[o.tag]);
            return (
              <div key={o.tag} className={`ps-lamp${on ? ' on' : ''}${o.tag in cpu.forces ? ' forced' : ''}`} title={o.description}>
                <span className="ps-lamp-dot" aria-hidden />
                <span className="ps-lamp-addr">{defMap.get(o.tag)?.address}</span>
                <span className="ps-lamp-label">{o.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 项目树式标签页 ── */}
      <nav className="ps-tabs" role="tablist" aria-label="仿真工具">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            <Icon size={14} /> {label}
            {id === 'xref' && xrefBadgeCount > 0 && (
              <span className={`ps-count${crossRefSummary.errorCount > 0 ? ' err' : ' warn'}`}>{xrefBadgeCount}</span>
            )}
            {id === 'diag' && cpu.diag.length > 0 && <span className="ps-count">{cpu.diag.length}</span>}
            {id === 'force' && forcedCount > 0 && <span className="ps-count warn">{forcedCount}</span>}
          </button>
        ))}
      </nav>

      <div className="ps-panel" role="tabpanel" ref={panelRef}>
        {tab === 'ob1' && (
          <>
            <div className="ps-toolbar">
              <button type="button" className={`ps-btn ghost${monitor ? ' on' : ''}`} aria-pressed={monitor} onClick={() => setMonitor((v) => !v)}>
                <Glasses size={15} /> {monitor ? '监视：开' : '监视：关'}
              </button>
              <TiaLegend monitoring={monitor && running} />
            </div>
            {!running && monitor && <p className="ps-note">CPU 处于 STOP：程序不执行，梯形图不显示能流。点上方 RUN 运行，或按 Alt+S 单步执行。</p>}
            <p className="ps-note subtle">梯形图较宽时可左右滑动；点上方带 %I 地址的触点也能切换输入。</p>
            <TiaLadder
              program={preset.program}
              tagDefs={defs}
              tags={snapshot.tags}
              evalSnapshot={snapshot.evalSnapshot}
              monitoring={monitor && running}
              forced={cpu.forces}
              focusedNetwork={focusedNetwork}
              onToggleInputTag={handleToggleInputTag}
            />
          </>
        )}

        {tab === 'xref' && (
          <CrossRefWorkbenchPanel
            program={preset.program}
            tagDefs={defs}
            onJumpToNetwork={handleJumpToNetwork}
          />
        )}

        {tab === 'sim' && (
          <>
            <div className="ps-toolbar">
              <label className="ps-check">
                <input type="checkbox" checked={allowNonInput} onChange={(e) => setAllowNonInput(e.target.checked)} />
                允许修改非输入地址
              </label>
              <span className="ps-note inline">PLCSIM 默认只允许写输入（%I）；输出和 M 位由程序决定。</span>
            </div>
            <div className="ps-table-wrap">
              <table className="ps-table">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>地址</th>
                    <th>显示格式</th>
                    <th>监视/修改值</th>
                    <th>位</th>
                  </tr>
                </thead>
                <tbody>
                  {defs.map((d) => {
                    const area = inferTagArea(d);
                    const writable = area === 'I' || allowNonInput;
                    const v = area === 'I' ? snapshot.fieldInputs[d.name] : snapshot.tags[d.name];
                    return (
                      <tr key={d.name} className={d.name in cpu.forces ? 'is-forced' : ''}>
                        <td className="ps-name">
                          {d.name in cpu.forces && <b className="ps-f">F</b>}"{d.name}"
                        </td>
                        <td className="mono">{d.address}</td>
                        <td>{displayFormat(d)}</td>
                        <td className="mono">
                          {d.type === 'Bool' || !writable ? (
                            fmt(d, v)
                          ) : (
                            <input
                              className="ps-input"
                              inputMode="text"
                              defaultValue={fmt(d, v)}
                              key={`${d.name}-${String(v)}`}
                              aria-label={`${d.name} 修改值`}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') modifyNow(d, (e.target as HTMLInputElement).value);
                              }}
                              onBlur={(e) => {
                                if (e.target.value !== fmt(d, v)) modifyNow(d, e.target.value);
                              }}
                            />
                          )}
                        </td>
                        <td>
                          {d.type === 'Bool' ? (
                            <label className="ps-bit">
                              <input
                                type="checkbox"
                                checked={Boolean(v)}
                                disabled={!writable}
                                onChange={(e) => modifyNow(d, e.target.checked ? 'TRUE' : 'FALSE')}
                                aria-label={`${d.address} 位`}
                              />
                            </label>
                          ) : (
                            <span className="ps-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'tags' && (
          <div className="ps-table-wrap">
            <table className="ps-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>数据类型</th>
                  <th>地址</th>
                  <th>保持</th>
                  {monitor && <th>监视值</th>}
                  <th>注释</th>
                </tr>
              </thead>
              <tbody>
                {defs.map((d) => (
                  <tr key={d.name}>
                    <td className="ps-name">{d.name}</td>
                    <td>{d.type}</td>
                    <td className="mono">{d.address}</td>
                    <td>
                      <input type="checkbox" disabled checked={false} aria-label="保持（未勾选）" />
                    </td>
                    {monitor && <td className="mono live">{fmt(d, snapshot.tags[d.name])}</td>}
                    <td className="ps-comment">{d.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'watch' && (
          <>
            <div className="ps-toolbar">
              <button
                type="button"
                className="ps-btn ghost"
                onClick={() => {
                  const entries = Object.entries(watchMods).filter(([, v]) => v.trim() !== '');
                  if (!entries.length) {
                    say('先在“修改值”列填入要写的值。');
                    return;
                  }
                  entries.forEach(([name, raw]) => {
                    const d = defMap.get(name);
                    if (d) modifyNow(d, raw);
                  });
                }}
              >
                <Zap size={14} /> 全部立即修改
              </button>
              <span className="ps-note inline">“修改”只写一次；程序下一次写这个地址时就会被覆盖。</span>
            </div>
            <div className="ps-table-wrap">
              <table className="ps-table">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>地址</th>
                    <th>显示格式</th>
                    <th>监视值</th>
                    <th>修改值</th>
                    <th aria-label="立即修改">⚡</th>
                  </tr>
                </thead>
                <tbody>
                  {defs.map((d) => (
                    <tr key={d.name}>
                      <td className="ps-name">"{d.name}"</td>
                      <td className="mono">{d.address}</td>
                      <td>{displayFormat(d)}</td>
                      <td className="mono live">{fmt(d, snapshot.tags[d.name])}</td>
                      <td>
                        {d.type === 'Bool' ? (
                          <select
                            className="ps-input"
                            value={watchMods[d.name] ?? ''}
                            onChange={(e) => setWatchMods((m) => ({ ...m, [d.name]: e.target.value }))}
                            aria-label={`${d.name} 修改值`}
                          >
                            <option value="">（空）</option>
                            <option value="TRUE">TRUE</option>
                            <option value="FALSE">FALSE</option>
                          </select>
                        ) : (
                          <input
                            className="ps-input"
                            value={watchMods[d.name] ?? ''}
                            placeholder="输入数值"
                            onChange={(e) => setWatchMods((m) => ({ ...m, [d.name]: e.target.value }))}
                            aria-label={`${d.name} 修改值`}
                          />
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ps-icon-btn"
                          aria-label={`立即修改 ${d.name}`}
                          disabled={!watchMods[d.name]}
                          onClick={() => modifyNow(d, watchMods[d.name] ?? '')}
                        >
                          <Zap size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'force' && (
          <>
            <div className="ps-warn" role="note">
              <AlertTriangle size={16} />
              <span>
                强制会让程序读到的输入、或送到端子的输出变成你指定的值，<b>直到停止强制为止</b>。真实设备上强制可能让机器意外动作：只在确认安全时使用，调试完一定停止强制。
              </span>
            </div>
            <div className="ps-toolbar">
              <button type="button" className="ps-btn run" onClick={applyForces}>
                <Lock size={14} /> 开始或替换强制
              </button>
              <button
                type="button"
                className="ps-btn ghost"
                disabled={forcedCount === 0}
                onClick={() => {
                  runtime.clearForces();
                  setForceRows({});
                  haptic('tap');
                  say('已停止全部强制。');
                }}
              >
                停止强制
              </button>
            </div>
            <div className="ps-table-wrap">
              <table className="ps-table">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>地址</th>
                    <th>显示格式</th>
                    <th>监视值</th>
                    <th>强制值</th>
                    <th>F</th>
                  </tr>
                </thead>
                <tbody>
                  {ioDefs.map((d) => {
                    const row = forceRows[d.name] ?? { on: d.name in cpu.forces, value: d.name in cpu.forces ? fmt(d, cpu.forces[d.name]) : '' };
                    const area = inferTagArea(d);
                    const mon = area === 'I' ? snapshot.pii[d.name] : snapshot.fieldOutputs[d.name];
                    return (
                      <tr key={d.name} className={d.name in cpu.forces ? 'is-forced' : ''}>
                        <td className="ps-name">"{d.name}":P</td>
                        <td className="mono">{d.address}:P</td>
                        <td>{displayFormat(d)}</td>
                        <td className="mono live">{fmt(d, mon)}</td>
                        <td>
                          {d.type === 'Bool' ? (
                            <select
                              className="ps-input"
                              value={row.value || 'TRUE'}
                              onChange={(e) => setForceRows((r) => ({ ...r, [d.name]: { ...row, value: e.target.value } }))}
                              aria-label={`${d.name} 强制值`}
                            >
                              <option value="TRUE">TRUE</option>
                              <option value="FALSE">FALSE</option>
                            </select>
                          ) : (
                            <input
                              className="ps-input"
                              value={row.value}
                              placeholder="0"
                              onChange={(e) => setForceRows((r) => ({ ...r, [d.name]: { ...row, value: e.target.value } }))}
                              aria-label={`${d.name} 强制值`}
                            />
                          )}
                        </td>
                        <td>
                          <label className="ps-bit">
                            <input
                              type="checkbox"
                              checked={row.on}
                              onChange={(e) => setForceRows((r) => ({ ...r, [d.name]: { ...row, on: e.target.checked } }))}
                              aria-label={`强制 ${d.address}`}
                            />
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'diag' && (
          <>
            <p className="ps-note">诊断缓冲区按时间倒序记录 CPU 的事件：模式切换、强制、错误等。点一条看说明。</p>
            <ol className="ps-diag">
              {cpu.diag.map((e) => (
                <li key={e.seq} className={`kind-${e.kind}`}>
                  <button type="button" onClick={() => setOpenDiag(openDiag === e.seq ? null : e.seq)} aria-expanded={openDiag === e.seq}>
                    <span className="ps-diag-no">{e.seq}</span>
                    <span className="ps-diag-time">{fmtClock(e.time)}</span>
                    <span className="ps-diag-text">{e.text}</span>
                  </button>
                  {openDiag === e.seq && e.detail && <p className="ps-diag-detail">{e.detail}</p>}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      <div className="ps-footer-stack">
        <ShortcutHintBar items={shortcutItems} variant="tia" />
        <div className="ps-howto">
          <ListChecks size={15} />
          <span>
            试一试：① 点 STOP，看输出灯全部熄灭；② 打开“交叉引用 (F11)”查看每个地址的 R/W 位置并点击跳转；③ 在“强制表”勾选输出后打开“诊断缓冲区”查看记录。
          </span>
        </div>
      </div>

      {toast && (
        <div className="ps-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
};
