import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlcRuntime, ScanMetrics, TagDef, TagValue } from '../../types/plc';
import { createLadderInternalState, evaluateLadderProgram } from './ladderEvaluator';
import { TraceRingBuffer } from './traceBuffer';
import {
  inferTagArea,
  type LadderEvalSnapshot,
  type LadderPlcRuntime,
  type LadderProgram,
  type LadderRuntimeSnapshot,
  type CpuInfo,
  type DiagEntry,
  type ScanIntervalOption,
  type ScanPhase,
  type TraceChannelDef,
} from './types';

export * from './types';
export * from './instructions';
export * from './ladderEvaluator';
export * from './crossRefAnalyzer';
export * from './traceBuffer';

export type ScanProgramFn = (
  tags: Record<string, TagValue>,
  dtMs: number,
  cycleCount: number
) => void;

/**
 * Standard backward-compatible PLC runtime used by digital twin models & custom scripts.
 * Implements PII (Input Image) -> OB1 program -> PIQ (Output Image) scan model.
 */
export function createPlcRuntime(tagDefs: TagDef[], program?: ScanProgramFn): PlcRuntime {
  const buildDefaults = (): Record<string, TagValue> => {
    const map: Record<string, TagValue> = {};
    for (const def of tagDefs) {
      map[def.name] = def.init !== undefined ? def.init : def.type === 'Bool' ? false : 0;
    }
    return map;
  };

  let fieldInputs = buildDefaults();
  let tags = buildDefaults();
  let cycleCount = 0;
  let lastScanMs = 0.2;
  let scanIntervalMs = 50;
  let running = true;

  const inputTagNames = tagDefs.filter((d) => inferTagArea(d) === 'I').map((d) => d.name);
  const listeners = new Set<(t: Record<string, TagValue>, m?: ScanMetrics) => void>();

  const getMetrics = (): ScanMetrics => ({
    cycleCount,
    lastScanMs,
    scanIntervalMs,
    running,
  });
  const notify = () => {
    const snapshot = { ...tags };
    const metrics = getMetrics();
    listeners.forEach((fn) => fn(snapshot, metrics));
  };

  return {
    tagDefs,
    get tags() {
      return tags;
    },
    getTag(name: string) {
      return tags[name] ?? false;
    },
    setTag(name: string, value: TagValue) {
      fieldInputs[name] = value;
      tags[name] = value;
      notify();
    },
    scan(dtMs: number) {
      if (!running) return;
      const t0 = performance.now();
      cycleCount += 1;
      // 1. PII sample
      for (const name of inputTagNames) {
        tags[name] = fieldInputs[name];
      }
      // 2. OB1 execute
      if (program) {
        program(tags, dtMs, cycleCount);
      }
      // 3. PIQ flush (tags already holds updated Q image for consumers)
      lastScanMs = Math.max(0.05, Number((performance.now() - t0).toFixed(3)));
      notify();
    },
    reset() {
      fieldInputs = buildDefaults();
      tags = buildDefaults();
      cycleCount = 0;
      notify();
    },
    setRunning(next: boolean) {
      running = next;
      notify();
    },
    getMetrics,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Backward-compatible React hook for PlcRuntime.
 */
export function usePlcRuntime(tagDefs: TagDef[], program?: ScanProgramFn, intervalMs = 50) {
  const [runtime] = useState<PlcRuntime>(() => createPlcRuntime(tagDefs, program));
  const [tags, setTags] = useState<Record<string, TagValue>>(() => ({ ...runtime.tags }));
  const [metrics, setMetrics] = useState<ScanMetrics>(() =>
    runtime.getMetrics
      ? runtime.getMetrics()
      : { cycleCount: 0, lastScanMs: 0.1, scanIntervalMs: intervalMs, running: true }
  );

  useEffect(() => {
    const unsub = runtime.subscribe((nextTags, nextMetrics) => {
      setTags(nextTags);
      if (nextMetrics) setMetrics(nextMetrics);
    });
    const timer = window.setInterval(() => {
      runtime.scan(intervalMs);
    }, intervalMs);
    return () => {
      unsub();
      window.clearInterval(timer);
    };
  }, [runtime, intervalMs]);

  return { runtime, tags, metrics };
}

export interface CreateLadderRuntimeOptions {
  tagDefs: TagDef[];
  program: LadderProgram;
  traceChannels?: TraceChannelDef[];
  initialIntervalMs?: ScanIntervalOption;
  traceCapacity?: number;
  /** Optional physical plant hook invoked after PIQ flush (e.g. closed-loop tank level) */
  onAfterScan?: (
    fieldOutputs: Record<string, TagValue>,
    fieldInputs: Record<string, TagValue>,
    dtMs: number
  ) => void;
}

/**
 * Full-featured Siemens S7-1200 LAD Scan Runtime:
 * - Authentic PII (Process Image Input) -> OB1 Network-by-Network Eval -> PIQ (Process Image Output)
 * - RUN / STOP (safe Q de-energize) / Single Scan (step 1 cycle while stopped)
 * - Adjustable scan cycle interval (20 / 50 / 200 / 500 ms)
 * - 120-sample circular Trace ring buffer
 */
export function createLadderRuntime(options: CreateLadderRuntimeOptions): LadderPlcRuntime {
  const { tagDefs, traceChannels = [], traceCapacity = 120, onAfterScan } = options;
  let currentProgram: LadderProgram = options.program;

  const inputDefs = tagDefs.filter((d) => inferTagArea(d) === 'I');
  const outputDefs = tagDefs.filter((d) => inferTagArea(d) === 'Q');

  const buildDefaults = (): Record<string, TagValue> => {
    const map: Record<string, TagValue> = {};
    for (const def of tagDefs) {
      map[def.name] = def.init !== undefined ? def.init : def.type === 'Bool' ? false : 0;
    }
    return map;
  };

  const pickSubset = (source: Record<string, TagValue>, defs: TagDef[]): Record<string, TagValue> => {
    const out: Record<string, TagValue> = {};
    for (const d of defs) out[d.name] = source[d.name];
    return out;
  };

  const buildSafeOutputs = (): Record<string, TagValue> => {
    const out: Record<string, TagValue> = {};
    for (const d of outputDefs) out[d.name] = d.type === 'Bool' ? false : 0;
    return out;
  };

  let fieldInputs = pickSubset(buildDefaults(), inputDefs);
  let tags = buildDefaults();
  let pii = pickSubset(tags, inputDefs);
  let piq = pickSubset(tags, outputDefs);
  let fieldOutputs = pickSubset(tags, outputDefs);

  let internal = createLadderInternalState();
  const traceBuffer = new TraceRingBuffer(traceCapacity);

  let cycleCount = 0;
  let elapsedSimMs = 0;
  let lastScanMs = 0.14;
  let scanIntervalMs: ScanIntervalOption = options.initialIntervalMs ?? 50;
  let running = true;
  let tracePaused = false;
  let activePhase: ScanPhase = 'IDLE';
  /** 强制值（键 = 变量名；只对 I/Q 生效，模拟 S7-1200 强制表 I_:P / Q_:P） */
  let forces: Record<string, TagValue> = {};
  /** 循环时间统计（ms） */
  let cycleMin = Infinity;
  let cycleMax = 0;
  /** 诊断缓冲区（最新在前，最多 50 条） */
  let diag: DiagEntry[] = [];
  let diagSeq = 0;
  let errorLatched = false;
  const pushDiag = (text: string, kind: DiagEntry['kind'] = 'info', detail?: string) => {
    diagSeq += 1;
    diag = [{ seq: diagSeq, time: Date.now(), text, kind, detail }, ...diag].slice(0, 50);
  };
  pushDiag('上电：CPU 进入 RUN（启动方式：暖启动）', 'mode', '仿真 CPU 已就绪，启动后执行 OB1 循环。');

  let evalSnapshot: LadderEvalSnapshot = evaluateLadderProgram(
    currentProgram,
    tags,
    tagDefs,
    internal,
    0,
    {
      cycle: 0,
      phase: 'IDLE',
      piiCaptured: { ...pii },
      piqFlushed: { ...piq },
      durationMs: 0.1,
    }
  );
  // Sync initial PIQ/fieldOutputs after initial eval
  piq = pickSubset(tags, outputDefs);
  fieldOutputs = { ...piq };

  const legacyListeners = new Set<(t: Record<string, TagValue>, m?: ScanMetrics) => void>();
  const snapshotListeners = new Set<(s: LadderRuntimeSnapshot) => void>();

  const getMetrics = (): ScanMetrics => ({
    cycleCount,
    lastScanMs,
    scanIntervalMs,
    running,
  });

  const getCpuInfo = (): CpuInfo => ({
    cycleMinMs: Number.isFinite(cycleMin) ? cycleMin : 0,
    cycleMaxMs: cycleMax,
    maxCycleLimitMs: 150,
    forces: { ...forces },
    diag: diag.slice(),
    errorActive: errorLatched,
  });


  const buildSnapshot = (): LadderRuntimeSnapshot => ({
    tags: { ...tags },
    fieldInputs: { ...fieldInputs },
    pii: { ...pii },
    piq: { ...piq },
    fieldOutputs: { ...fieldOutputs },
    metrics: getMetrics(),
    cpu: getCpuInfo(),
    activePhase,
    evalSnapshot,
    traceSamples: traceBuffer.getSamples(),
  });

  const notifyAll = () => {
    const snap = buildSnapshot();
    legacyListeners.forEach((fn) => fn(snap.tags, snap.metrics));
    snapshotListeners.forEach((fn) => fn(snap));
  };

  const executeOneScan = (dtMs: number) => {
    const t0 = performance.now();
    cycleCount += 1;
    elapsedSimMs += dtMs;

    // ─── Stage 1: PII Input Process Image Sampling ───
    activePhase = 'PII_SAMPLE';
    for (const def of inputDefs) {
      const val = def.name in forces ? forces[def.name] : fieldInputs[def.name];
      pii[def.name] = val;
      tags[def.name] = val;
    }

    // ─── Stage 2: OB1 Sequential Network Evaluation ───
    activePhase = 'OB1_EXEC';
    const phaseLog = {
      cycle: cycleCount,
      phase: 'PIQ_FLUSH' as ScanPhase,
      piiCaptured: { ...pii },
      piqFlushed: {} as Record<string, TagValue>,
      durationMs: 0,
    };

    evalSnapshot = evaluateLadderProgram(currentProgram, tags, tagDefs, internal, dtMs, phaseLog);

    // ─── Stage 3: PIQ Output Process Image Flush ───
    activePhase = 'PIQ_FLUSH';
    for (const def of outputDefs) {
      const outVal = tags[def.name];
      piq[def.name] = outVal;
      fieldOutputs[def.name] = def.name in forces ? forces[def.name] : outVal;
    }

    const duration = Math.max(0.06, Number((performance.now() - t0).toFixed(3)));
    lastScanMs = duration;
    cycleMin = Math.min(cycleMin, duration);
    cycleMax = Math.max(cycleMax, duration);
    phaseLog.piqFlushed = { ...piq };
    phaseLog.durationMs = duration;

    // Optional physical plant dynamics hook
    if (onAfterScan) {
      onAfterScan(fieldOutputs, fieldInputs, dtMs);
    }

    // ─── Stage 4: Circular Trace Recording ───
    if (!tracePaused) {
      const values: Record<string, number | boolean> = {};
      if (traceChannels.length > 0) {
        for (const ch of traceChannels) {
          values[ch.tag] = tags[ch.tag] ?? false;
        }
      } else {
        for (const def of tagDefs) {
          values[def.name] = tags[def.name] ?? false;
        }
      }
      traceBuffer.push({
        cycle: cycleCount,
        timeMs: elapsedSimMs,
        values,
      });
    }

    activePhase = running ? 'IDLE' : 'STOPPED';
    notifyAll();
  };

  // Seed 1 initial trace sample so oscilloscope isn't blank on mount
  if (traceChannels.length > 0) {
    const initVals: Record<string, number | boolean> = {};
    for (const ch of traceChannels) {
      initVals[ch.tag] = tags[ch.tag] ?? false;
    }
    traceBuffer.push({ cycle: 0, timeMs: 0, values: initVals });
  }

  return {
    tagDefs,
    get tags() {
      return tags;
    },
    getTag(name: string) {
      return tags[name] ?? false;
    },
    setTag(name: string, value: TagValue) {
      const isInput = inputDefs.some((d) => d.name === name);
      if (isInput) {
        fieldInputs[name] = value;
      }
      if (running || !isInput) {
        tags[name] = value;
      }
      notifyAll();
    },
    setFieldInput(name: string, value: TagValue) {
      fieldInputs[name] = value;
      // Note: Do NOT overwrite PII directly when STOPPED so learners can observe PII sampling on Single Scan!
      notifyAll();
    },
    getFieldInput(name: string) {
      return fieldInputs[name] ?? false;
    },
    scan(dtMs: number) {
      if (!running) return;
      executeOneScan(dtMs);
    },
    singleScan(dtMs?: number) {
      executeOneScan(dtMs ?? scanIntervalMs);
    },
    reset() {
      const defaults = buildDefaults();
      fieldInputs = pickSubset(defaults, inputDefs);
      tags = { ...defaults };
      pii = pickSubset(tags, inputDefs);
      piq = pickSubset(tags, outputDefs);
      fieldOutputs = running ? { ...piq } : buildSafeOutputs();
      internal = createLadderInternalState();
      traceBuffer.clear();
      cycleCount = 0;
      elapsedSimMs = 0;
      errorLatched = false;
      evalSnapshot = evaluateLadderProgram(currentProgram, tags, tagDefs, internal, 0, {
        cycle: 0,
        phase: running ? 'IDLE' : 'STOPPED',
        piiCaptured: { ...pii },
        piqFlushed: { ...piq },
        durationMs: 0.08,
      });
      piq = pickSubset(tags, outputDefs);
      fieldOutputs = running ? { ...piq } : buildSafeOutputs();
      notifyAll();
    },
    setRunning(next: boolean) {
      if (next !== running) {
        pushDiag(
          next ? '运行模式转换：STOP → RUN（操作员请求）' : '运行模式转换：RUN → STOP（操作员请求）',
          'mode',
          next
            ? '经过启动（STARTUP）后进入 RUN：读输入、执行 OB1、写输出循环开始。'
            : 'CPU 停止执行用户程序，过程映像不再自动更新，输出进入安全状态（本仿真为 0）。',
        );
      }
      running = next;
      activePhase = next ? 'IDLE' : 'STOPPED';
      if (!next) {
        // Siemens S7-1200 STOP mode puts physical Q outputs into safe de-energized state
        fieldOutputs = buildSafeOutputs();
      } else {
        fieldOutputs = { ...piq };
      }
      notifyAll();
    },
    setScanInterval(ms: ScanIntervalOption) {
      scanIntervalMs = ms;
      notifyAll();
    },
    getScanInterval() {
      return scanIntervalMs;
    },
    setProgram(nextProgram: LadderProgram) {
      currentProgram = nextProgram;
      // Re-evaluate immediately with dt=0 to refresh node topology and double-coil warnings
      evalSnapshot = evaluateLadderProgram(currentProgram, tags, tagDefs, internal, 0, {
        cycle: cycleCount,
        phase: activePhase,
        piiCaptured: { ...pii },
        piqFlushed: { ...piq },
        durationMs: lastScanMs,
      });
      notifyAll();
    },
    getProgram() {
      return currentProgram;
    },
    setTracePaused(paused: boolean) {
      tracePaused = paused;
      notifyAll();
    },
    isTracePaused() {
      return tracePaused;
    },
    clearTrace() {
      traceBuffer.clear();
      notifyAll();
    },
    getMetrics,
    getCpuInfo,
    setForce(name: string, value: TagValue | undefined) {
      const had = name in forces;
      if (value === undefined) {
        delete forces[name];
        if (had) pushDiag(`强制已取消：${name}`, 'force');
      } else {
        forces[name] = value;
        pushDiag(`强制已启动：${name} = ${typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : value}`, 'force', '强制值会覆盖程序读到的物理输入或写到物理输出的值，直到停止强制。');
      }
      if (!running) notifyAll();
      else notifyAll();
    },
    clearForces() {
      if (Object.keys(forces).length) pushDiag('已停止全部强制', 'force');
      forces = {};
      notifyAll();
    },
    warmRestart() {
      // STARTUP：Q 映像清零、非保持 M 与定时器/计数器回到初值，输入保持现场状态，并清除故障锁存
      const defaults = buildDefaults();
      for (const d of tagDefs) {
        const area = inferTagArea(d);
        if (area !== 'I') tags[d.name] = defaults[d.name];
      }
      piq = pickSubset(tags, outputDefs);
      internal = createLadderInternalState();
      if (errorLatched) {
        errorLatched = false;
        pushDiag('故障锁存已清除：CPU 暖启动恢复正常', 'mode', '清除时间错误报警灯，重新按正常周期扫描 OB1。');
      }
      notifyAll();
    },
    memoryReset() {
      const defaults = buildDefaults();
      tags = { ...defaults };
      for (const d of inputDefs) tags[d.name] = fieldInputs[d.name];
      pii = pickSubset(tags, inputDefs);
      piq = pickSubset(tags, outputDefs);
      fieldOutputs = buildSafeOutputs();
      internal = createLadderInternalState();
      cycleCount = 0;
      cycleMin = Infinity;
      cycleMax = 0;
      errorLatched = false;
      running = false;
      activePhase = 'STOPPED';
      pushDiag('存储器复位（MRES）完成', 'mode', '清除工作存储器中的数据并复位故障锁存，重新从装载存储器复制程序；诊断缓冲区不会被清除。');
      notifyAll();
    },
    simulateCycleOverrun(ms = 320) {
      cycleMax = Math.max(cycleMax, ms);
      lastScanMs = ms;
      pushDiag(`循环时间超出最大循环时间（${ms} ms > 2 × 150 ms）`, 'error', '没有下载过时间错误中断 OB80：第一次超时被忽略；同一循环内第二次超时（2 倍最大循环时间），CPU 写入诊断条目并转入 STOP。');
      running = false;
      activePhase = 'STOPPED';
      fieldOutputs = buildSafeOutputs();
      errorLatched = true;
      pushDiag('运行模式转换：RUN → STOP（时间错误）', 'mode');
      notifyAll();
    },
    getSnapshot: buildSnapshot,
    subscribe(listener) {
      legacyListeners.add(listener);
      return () => {
        legacyListeners.delete(listener);
      };
    },
    subscribeSnapshot(listener) {
      snapshotListeners.add(listener);
      return () => {
        snapshotListeners.delete(listener);
      };
    },
  };
}

/**
 * React hook driving a LadderPlcRuntime with adjustable scan interval (20 / 50 / 200 / 500 ms).
 */
export function useLadderSimulation(options: CreateLadderRuntimeOptions) {
  const onAfterScanRef = useRef(options.onAfterScan);
  onAfterScanRef.current = options.onAfterScan;

  const [runtime] = useState<LadderPlcRuntime>(() =>
    createLadderRuntime({
      ...options,
      onAfterScan: (out, inp, dt) => {
        if (onAfterScanRef.current) onAfterScanRef.current(out, inp, dt);
      },
    })
  );

  const [snapshot, setSnapshot] = useState<LadderRuntimeSnapshot>(() => runtime.getSnapshot());
  const [intervalMs, setIntervalMsState] = useState<ScanIntervalOption>(
    options.initialIntervalMs ?? 50
  );
  const [tracePaused, setTracePausedState] = useState(false);

  useEffect(() => {
    const unsub = runtime.subscribeSnapshot((next) => {
      setSnapshot(next);
    });
    return unsub;
  }, [runtime]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      runtime.scan(intervalMs);
    }, intervalMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [runtime, intervalMs]);

  const setScanInterval = useCallback(
    (ms: ScanIntervalOption) => {
      setIntervalMsState(ms);
      runtime.setScanInterval(ms);
    },
    [runtime]
  );

  const toggleTracePaused = useCallback(() => {
    setTracePausedState((prev) => {
      const next = !prev;
      runtime.setTracePaused(next);
      return next;
    });
  }, [runtime]);

  return {
    runtime,
    snapshot,
    intervalMs,
    setScanInterval,
    tracePaused,
    toggleTracePaused,
  };
}

export { buildCycleMicroTrace, type MicroStepFrame, type MicroTagDiff } from './microStep';
