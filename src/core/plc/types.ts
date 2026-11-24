import type { PlcRuntime, ScanMetrics, TagArea, TagDef, TagValue } from '../../types/plc';

export type ScanPhase = 'STOPPED' | 'PII_SAMPLE' | 'OB1_EXEC' | 'PIQ_FLUSH' | 'IDLE';

export type ScanIntervalOption = 20 | 50 | 200 | 500;

export type TimerType = 'TON' | 'TOF' | 'TP';
export type CounterType = 'CTU' | 'CTD';
export type CompareOp = '>=' | '<=' | '>' | '<' | '==' | '!=';

export interface IecTimerState {
  id: string;
  dbName: string;
  type: TimerType;
  ptMs: number;
  etMs: number;
  inVal: boolean;
  q: boolean;
  prevIn: boolean;
  timing: boolean;
}

export interface IecCounterState {
  id: string;
  dbName: string;
  type: CounterType;
  pv: number;
  cv: number;
  clkVal: boolean;
  resetVal: boolean;
  q: boolean;
  prevClk: boolean;
}

export type LadderNode =
  | {
      kind: 'NO';
      id: string;
      tag: string;
      label?: string;
    }
  | {
      kind: 'NC';
      id: string;
      tag: string;
      label?: string;
    }
  | {
      kind: 'P_TRIG';
      id: string;
      tag: string;
      memTag?: string;
      label?: string;
    }
  | {
      kind: 'N_TRIG';
      id: string;
      tag: string;
      memTag?: string;
      label?: string;
    }
  | {
      kind: 'CMP';
      id: string;
      op: CompareOp;
      leftTag: string;
      rightValue: number | string;
      unit?: string;
      label?: string;
    }
  | {
      kind: 'BRANCH';
      id: string;
      branches: LadderNode[][];
    }
  | {
      kind: 'TIMER';
      id: string;
      timerType: TimerType;
      dbName: string;
      ptMs: number;
      qTag?: string;
      etTag?: string;
      label?: string;
    }
  | {
      kind: 'COUNTER';
      id: string;
      counterType: CounterType;
      dbName: string;
      pv: number;
      resetTag?: string;
      qTag?: string;
      cvTag?: string;
      label?: string;
    }
  | {
      kind: 'NORM_X';
      id: string;
      blockName: string;
      min: number;
      max: number;
      valueTag: string;
      outTag: string;
      label?: string;
    }
  | {
      kind: 'SCALE_X';
      id: string;
      blockName: string;
      min: number;
      max: number;
      valueTag: string;
      outTag: string;
      unit?: string;
      label?: string;
    }
  | {
      kind: 'OTE';
      id: string;
      tag: string;
      label?: string;
    }
  | {
      kind: 'SET';
      id: string;
      tag: string;
      label?: string;
    }
  | {
      kind: 'RESET';
      id: string;
      tag: string;
      label?: string;
    }
  | {
      kind: 'OUTPUT_BRANCH';
      id: string;
      outputs: LadderNode[][];
    };

export interface LadderNetwork {
  id: string;
  number: number;
  title: string;
  comment?: string;
  nodes: LadderNode[];
}

export interface LadderProgram {
  id: string;
  name: string;
  networks: LadderNetwork[];
}

export interface NodeEvalState {
  powerIn: boolean;
  powerOut: boolean;
  /** Whether the underlying tag or block output is active */
  active: boolean;
  /** Primary live readout (e.g. "2450 / 4000 ms", "4 / 6", "30.0 %") */
  valueText?: string;
  /** Secondary live readout (e.g. "Q = 1", "IN1 = 30.0") */
  subText?: string;
  /** Normalized progress 0..1 for timer/counter bars */
  progress?: number;
  /** For coil write tracking (double-coil diagnostics) */
  writtenValue?: boolean;
}

export interface DoubleCoilWarning {
  tag: string;
  address: string;
  networkNumbers: number[];
  finalWriterNetwork: number;
  overwritten: boolean;
  message: string;
}

export interface ScanPhaseSnapshot {
  cycle: number;
  phase: ScanPhase;
  piiCaptured: Record<string, TagValue>;
  piqFlushed: Record<string, TagValue>;
  durationMs: number;
}

export interface LadderEvalSnapshot {
  nodeStates: Record<string, NodeEvalState>;
  branchStates: Record<string, { powerIn: boolean; powerOut: boolean }[]>;
  networkEnergized: Record<string, boolean>;
  timers: Record<string, IecTimerState>;
  counters: Record<string, IecCounterState>;
  doubleCoilWarnings: DoubleCoilWarning[];
  phaseLog: ScanPhaseSnapshot;
}

export interface TraceChannelDef {
  id: string;
  tag: string;
  label: string;
  address: string;
  kind: 'bool' | 'number';
  color: string;
  min?: number;
  max?: number;
  unit?: string;
}

export interface TraceSample {
  cycle: number;
  timeMs: number;
  values: Record<string, number | boolean>;
}

export interface LadderRuntimeSnapshot {
  tags: Record<string, TagValue>;
  fieldInputs: Record<string, TagValue>;
  pii: Record<string, TagValue>;
  piq: Record<string, TagValue>;
  fieldOutputs: Record<string, TagValue>;
  metrics: ScanMetrics;
  activePhase: ScanPhase;
  evalSnapshot: LadderEvalSnapshot;
  traceSamples: TraceSample[];
}

export interface LadderPlcRuntime extends PlcRuntime {
  setFieldInput(name: string, value: TagValue): void;
  getFieldInput(name: string): TagValue;
  singleScan(dtMs?: number): void;
  setScanInterval(ms: ScanIntervalOption): void;
  getScanInterval(): ScanIntervalOption;
  setProgram(program: LadderProgram): void;
  getProgram(): LadderProgram;
  setTracePaused(paused: boolean): void;
  isTracePaused(): boolean;
  clearTrace(): void;
  getSnapshot(): LadderRuntimeSnapshot;
  subscribeSnapshot(listener: (snapshot: LadderRuntimeSnapshot) => void): () => void;
}

export function inferTagArea(def: TagDef): TagArea {
  if (def.area) return def.area;
  const addr = def.address.trim().toUpperCase();
  if (addr.startsWith('%I') || addr.startsWith('I')) return 'I';
  if (addr.startsWith('%Q') || addr.startsWith('Q')) return 'Q';
  if (addr.startsWith('%M') || addr.startsWith('M')) return 'M';
  return 'DB';
}
