import { inferTagArea } from '../plc/types';
import type { PlcRuntime, ScanMetrics, TagDef, TagValue } from '../../types/plc';
import type { CompiledSclProgram } from './ast';
import {
  buildTagIndex,
  evaluateSclProgram,
  exportInstancesSnapshot,
  type SclVmState,
} from './evaluator';
import { normalizeDirectAddress } from './lexer';
import { parseAndCheckScl } from './parser';
import type {
  SclCompileResult,
  SclLineTelemetry,
  SclScanSnapshot,
  SclVmSession,
} from './types';

const DEFAULT_SCAN_INTERVAL_MS = 50;

/**
 * Compile an SCL program against the given tag definitions.
 */
export function compileSclProgram(
  code: string,
  tagDefs: TagDef[],
  ob100Code?: string
): SclCompileResult {
  const t0 = performance.now();
  const ob1Compiled = parseAndCheckScl(code, tagDefs);
  const diagnostics = [...ob1Compiled.diagnostics];
  const refSet = new Set<string>(ob1Compiled.referencedTags);

  if (ob100Code && ob100Code.trim().length > 0) {
    const ob100Compiled = parseAndCheckScl(ob100Code, tagDefs);
    for (const d of ob100Compiled.diagnostics) {
      diagnostics.push({
        ...d,
        message: `[OB100] ${d.message}`,
      });
    }
    for (const r of ob100Compiled.referencedTags) {
      refSet.add(r);
    }
  }

  const ok = diagnostics.every((d) => d.severity !== 'error');
  const compileTimeMs = Math.max(0.05, Number((performance.now() - t0).toFixed(2)));

  return {
    ok,
    diagnostics,
    referencedTags: Array.from(refSet),
    compileTimeMs,
  };
}

/**
 * Create a full Siemens S7-1200/1500 TIA Portal SCL Virtual Machine Session.
 *
 * Implements PII -> Force Inputs -> OB1 AST Eval (+ Line Telemetry) -> Force Outputs -> PIQ Flush,
 * automatic 50ms RUN scan timer (auto-starts when subscribed, yields if external caller drives scan(),
 * auto-clears when all subscribers detach), and full PlcRuntime compatibility for digital twins.
 */
export function createSclVmSession(
  initialTags: TagDef[],
  initialOb1: string,
  initialOb100?: string
): SclVmSession {
  let currentTagDefs: TagDef[] = initialTags.map((d) => ({ ...d }));
  let inputTagNames = new Set<string>();
  let outputTagNames = new Set<string>();

  const buildDefaults = (defs: TagDef[]): Record<string, TagValue> => {
    const map: Record<string, TagValue> = {};
    for (const def of defs) {
      map[def.name] = def.init !== undefined ? def.init : def.type === 'Bool' ? false : 0;
    }
    return map;
  };

  const vmState: SclVmState = {
    tags: buildDefaults(currentTagDefs),
    tagIndex: buildTagIndex(currentTagDefs),
    localCaseMap: new Map(),
    instances: {},
    instanceCaseMap: new Map(),
  };

  const rebuildAreaSets = (defs: TagDef[]) => {
    inputTagNames = new Set(defs.filter((d) => inferTagArea(d) === 'I').map((d) => d.name));
    outputTagNames = new Set(defs.filter((d) => inferTagArea(d) === 'Q').map((d) => d.name));
  };
  rebuildAreaSets(currentTagDefs);

  // Field input image (separate from process image so Force Table can override inputs cleanly)
  let fieldInputs: Record<string, TagValue> = {};
  for (const name of inputTagNames) {
    fieldInputs[name] = vmState.tags[name];
  }

  let forcedTags: Record<string, TagValue> = {};
  let cpuMode: 'RUN' | 'STOP' = 'RUN';
  let cycleCount = 0;
  let scanDurationMs = 0.1;
  let lineTelemetry: Record<number, SclLineTelemetry> = {};
  let runtimeError: { line: number; message: string } | undefined;

  let compiledOb1: CompiledSclProgram | null = null;
  let compiledOb100: CompiledSclProgram | null = null;

  const runtimeListeners = new Set<(tags: Record<string, TagValue>, metrics?: ScanMetrics) => void>();
  const snapshotListeners = new Set<(snap: SclScanSnapshot) => void>();

  // Auto-scan interval handle & external scan yield guard
  let autoTimer: ReturnType<typeof setInterval> | null = null;
  let lastExternalScanAt = -Infinity;

  const resolveCanonicalName = (name: string): string => {
    const trimmed = name.trim();
    if (trimmed.startsWith('%')) {
      const norm = normalizeDirectAddress(trimmed);
      const mapped = vmState.tagIndex.addrToTagMap.get(norm);
      return mapped ? mapped.name : norm;
    }
    const exact = vmState.tagIndex.exactTagMap.get(trimmed);
    if (exact) return exact.name;
    const lowerDef = vmState.tagIndex.lowerTagMap.get(trimmed.toLowerCase());
    if (lowerDef) return lowerDef.name;
    if (trimmed.startsWith('#')) {
      return vmState.localCaseMap.get(trimmed.toLowerCase()) ?? trimmed;
    }
    return trimmed;
  };

  const getMetrics = (): ScanMetrics => ({
    cycleCount,
    lastScanMs: scanDurationMs,
    scanIntervalMs: DEFAULT_SCAN_INTERVAL_MS,
    running: cpuMode === 'RUN',
  });

  const buildSnapshot = (): SclScanSnapshot => ({
    cycleCount,
    scanDurationMs,
    cpuMode,
    onlineMonitoring: true,
    lineTelemetry: { ...lineTelemetry },
    instances: exportInstancesSnapshot(vmState.instances),
    forcedTags: { ...forcedTags },
    ...(runtimeError ? { runtimeError: { ...runtimeError } } : {}),
  });

  const notifyAll = () => {
    const tagsCopy = { ...vmState.tags };
    const metrics = getMetrics();
    runtimeListeners.forEach((fn) => fn(tagsCopy, metrics));

    if (snapshotListeners.size > 0) {
      const snap = buildSnapshot();
      snapshotListeners.forEach((fn) => fn(snap));
    }
  };

  const applyPreScanForces = () => {
    // 1. Sample field inputs into PII
    for (const name of inputTagNames) {
      if (name in fieldInputs) {
        vmState.tags[name] = fieldInputs[name];
      }
    }
    // 2. Override forced non-output tags (I, M, DB, locals) before OB1 executes
    for (const [name, forcedVal] of Object.entries(forcedTags)) {
      if (!outputTagNames.has(name)) {
        vmState.tags[name] = forcedVal;
      }
    }
  };

  const applyPostScanForces = () => {
    // Override forced output tags (and re-pin any forced tags overwritten by OB1) before PIQ flush
    for (const [name, forcedVal] of Object.entries(forcedTags)) {
      vmState.tags[name] = forcedVal;
    }
  };

  const runOb100Startup = () => {
    if (!compiledOb100) return;
    applyPreScanForces();
    const res = evaluateSclProgram(compiledOb100, vmState, 0, false);
    if (res.runtimeError) {
      runtimeError = {
        line: res.runtimeError.line,
        message: `[OB100] ${res.runtimeError.message}`,
      };
    }
    applyPostScanForces();
  };

  const executeOneScan = (dtMs: number) => {
    const t0 = performance.now();
    cycleCount += 1;

    // Stage 1: PII sample + apply input forces
    applyPreScanForces();

    // Stage 2: Execute OB1 AST with line telemetry
    if (compiledOb1) {
      const evalRes = evaluateSclProgram(compiledOb1, vmState, dtMs, true);
      lineTelemetry = evalRes.lineTelemetry;
      runtimeError = evalRes.runtimeError;
    } else {
      lineTelemetry = {};
      runtimeError = undefined;
    }

    // Stage 3: Apply output forces (PIQ flush)
    applyPostScanForces();

    scanDurationMs = Math.max(0.05, Number((performance.now() - t0).toFixed(3)));
    notifyAll();
  };

  const syncAutoTimer = () => {
    const shouldRun =
      cpuMode === 'RUN' && (runtimeListeners.size > 0 || snapshotListeners.size > 0);

    if (shouldRun && autoTimer === null) {
      autoTimer = setInterval(() => {
        if (cpuMode !== 'RUN') return;
        // If an external driver (e.g. React useEffect) is actively calling runtime.scan(), yield to avoid 2x speed
        if (performance.now() - lastExternalScanAt < DEFAULT_SCAN_INTERVAL_MS * 2.4) {
          return;
        }
        executeOneScan(DEFAULT_SCAN_INTERVAL_MS);
      }, DEFAULT_SCAN_INTERVAL_MS);

      // Prevent hanging Node.js CLI verification scripts if a subscriber wasn't detached
      const maybeNodeTimer = autoTimer as unknown as { unref?: () => void };
      maybeNodeTimer.unref?.();
    } else if (!shouldRun && autoTimer !== null) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  };

  // Initial compile & OB100 startup
  if (initialOb1 && initialOb1.trim().length > 0) {
    const initOb1 = parseAndCheckScl(initialOb1, currentTagDefs);
    if (initOb1.diagnostics.every((d) => d.severity !== 'error')) {
      compiledOb1 = initOb1;
    }
  }
  if (initialOb100 && initialOb100.trim().length > 0) {
    const initOb100 = parseAndCheckScl(initialOb100, currentTagDefs);
    if (initOb100.diagnostics.every((d) => d.severity !== 'error')) {
      compiledOb100 = initOb100;
      runOb100Startup();
    }
  }

  const runtime: PlcRuntime = {
    get tagDefs() {
      return currentTagDefs;
    },
    get tags() {
      return vmState.tags;
    },
    getTag(name: string): TagValue {
      const canonical = resolveCanonicalName(name);
      if (canonical in vmState.tags) {
        return vmState.tags[canonical];
      }
      return false;
    },
    setTag(name: string, value: TagValue) {
      const canonical = resolveCanonicalName(name);
      if (inputTagNames.has(canonical)) {
        fieldInputs[canonical] = value;
      }
      // If forced, keep the forced override intact in process image
      if (canonical in forcedTags) {
        return;
      }
      if (vmState.tags[canonical] === value) {
        return;
      }
      vmState.tags[canonical] = value;
      notifyAll();
    },
    scan(dtMs: number) {
      if (cpuMode !== 'RUN') return;
      lastExternalScanAt = performance.now();
      executeOneScan(dtMs);
    },
    reset() {
      resetMemoryImpl();
    },
    setRunning(running: boolean) {
      setCpuModeImpl(running ? 'RUN' : 'STOP');
    },
    getMetrics,
    subscribe(listener) {
      runtimeListeners.add(listener);
      syncAutoTimer();
      return () => {
        runtimeListeners.delete(listener);
        syncAutoTimer();
      };
    },
  };

  const setCpuModeImpl = (mode: 'RUN' | 'STOP') => {
    if (cpuMode === mode) return;
    cpuMode = mode;
    syncAutoTimer();
    notifyAll();
  };

  const resetMemoryImpl = () => {
    const defaults = buildDefaults(currentTagDefs);
    vmState.tags = defaults;
    vmState.localCaseMap.clear();
    vmState.instances = {};
    vmState.instanceCaseMap.clear();

    fieldInputs = {};
    for (const name of inputTagNames) {
      fieldInputs[name] = defaults[name];
    }

    cycleCount = 0;
    lineTelemetry = {};
    runtimeError = undefined;

    runOb100Startup();
    applyPostScanForces();
    notifyAll();
  };

  const compileImpl = (ob1Code: string, ob100Code?: string): SclCompileResult => {
    return compileSclProgram(ob1Code, currentTagDefs, ob100Code);
  };

  const downloadImpl = (
    ob1Code: string,
    ob100Code?: string,
    runStartupOb100 = false
  ): SclCompileResult => {
    const t0 = performance.now();
    const ob1Parsed = parseAndCheckScl(ob1Code, currentTagDefs);
    const diagnostics = [...ob1Parsed.diagnostics];
    const refSet = new Set<string>(ob1Parsed.referencedTags);

    let ob100Parsed: CompiledSclProgram | null = null;
    if (ob100Code && ob100Code.trim().length > 0) {
      ob100Parsed = parseAndCheckScl(ob100Code, currentTagDefs);
      for (const d of ob100Parsed.diagnostics) {
        diagnostics.push({
          ...d,
          message: `[OB100] ${d.message}`,
        });
      }
      for (const r of ob100Parsed.referencedTags) {
        refSet.add(r);
      }
    }

    const ok = diagnostics.every((d) => d.severity !== 'error');
    const compileTimeMs = Math.max(0.05, Number((performance.now() - t0).toFixed(2)));

    if (ok) {
      compiledOb1 = ob1Parsed;
      compiledOb100 = ob100Parsed;
      runtimeError = undefined;

      if (runStartupOb100 && compiledOb100) {
        runOb100Startup();
      }
      // Run one immediate evaluation pass (dt=0) if in RUN mode so lineTelemetry refreshes right after download
      if (cpuMode === 'RUN') {
        applyPreScanForces();
        const evalRes = evaluateSclProgram(compiledOb1, vmState, 0, true);
        lineTelemetry = evalRes.lineTelemetry;
        runtimeError = evalRes.runtimeError;
        applyPostScanForces();
      }
      notifyAll();
    }

    return {
      ok,
      diagnostics,
      referencedTags: Array.from(refSet),
      compileTimeMs,
    };
  };

  const updateTagDefsImpl = (nextTagDefs: TagDef[]) => {
    currentTagDefs = nextTagDefs.map((d) => ({ ...d }));
    vmState.tagIndex = buildTagIndex(currentTagDefs);
    rebuildAreaSets(currentTagDefs);

    for (const def of currentTagDefs) {
      const defVal = def.init !== undefined ? def.init : def.type === 'Bool' ? false : 0;
      if (!(def.name in vmState.tags)) {
        vmState.tags[def.name] = defVal;
      }
      if (inputTagNames.has(def.name) && !(def.name in fieldInputs)) {
        fieldInputs[def.name] = vmState.tags[def.name];
      }
    }

    applyPostScanForces();
    notifyAll();
  };

  const setForcedTagImpl = (tagName: string, value: TagValue | null) => {
    const canonical = resolveCanonicalName(tagName);
    if (value === null) {
      delete forcedTags[canonical];
      // Restore real physical field input immediately when releasing force on an input tag
      if (inputTagNames.has(canonical) && canonical in fieldInputs) {
        vmState.tags[canonical] = fieldInputs[canonical];
      }
    } else {
      forcedTags[canonical] = value;
      vmState.tags[canonical] = value;
    }
    notifyAll();
  };

  const clearAllForcesImpl = () => {
    const prevKeys = Object.keys(forcedTags);
    forcedTags = {};
    for (const key of prevKeys) {
      if (inputTagNames.has(key) && key in fieldInputs) {
        vmState.tags[key] = fieldInputs[key];
      }
    }
    notifyAll();
  };

  return {
    runtime,
    compile: compileImpl,
    download: downloadImpl,
    updateTagDefs: updateTagDefsImpl,
    setCpuMode: setCpuModeImpl,
    getCpuMode: () => cpuMode,
    stepSingleScan: (dtMs = DEFAULT_SCAN_INTERVAL_MS) => {
      executeOneScan(dtMs);
    },
    resetMemory: resetMemoryImpl,
    setForcedTag: setForcedTagImpl,
    clearAllForces: clearAllForcesImpl,
    getSnapshot: buildSnapshot,
    subscribeSnapshot(listener) {
      snapshotListeners.add(listener);
      syncAutoTimer();
      return () => {
        snapshotListeners.delete(listener);
        syncAutoTimer();
      };
    },
  };
}
