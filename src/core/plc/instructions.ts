import type {
  CompareOp,
  CounterType,
  IecCounterState,
  IecTimerState,
  TimerType,
} from './types';

/**
 * Evaluate an IEC 61131-3 / Siemens S7-1200 timer (TON / TOF / TP).
 */
export function evalIecTimer(
  prev: IecTimerState | undefined,
  id: string,
  dbName: string,
  type: TimerType,
  inVal: boolean,
  ptMs: number,
  dtMs: number
): IecTimerState {
  const safePt = Math.max(0, ptMs);
  const safeDt = Math.max(0, dtMs);

  const state: IecTimerState = prev
    ? { ...prev, dbName, type, ptMs: safePt, inVal }
    : {
        id,
        dbName,
        type,
        ptMs: safePt,
        etMs: 0,
        inVal,
        q: false,
        prevIn: false,
        timing: false,
      };

  if (type === 'TON') {
    if (inVal) {
      if (state.etMs < safePt) {
        state.etMs = Math.min(safePt, state.etMs + safeDt);
      }
      state.q = state.etMs >= safePt;
      state.timing = !state.q;
    } else {
      state.etMs = 0;
      state.q = false;
      state.timing = false;
    }
  } else if (type === 'TOF') {
    if (inVal) {
      state.q = true;
      state.etMs = 0;
      state.timing = false;
    } else {
      if (state.prevIn || state.timing) {
        state.etMs = Math.min(safePt, state.etMs + safeDt);
        if (state.etMs >= safePt) {
          state.q = false;
          state.timing = false;
        } else {
          state.q = true;
          state.timing = true;
        }
      } else {
        state.q = false;
        state.etMs = 0;
        state.timing = false;
      }
    }
  } else {
    // TP: Generate Pulse (IEC 61131-3)
    if (state.timing) {
      state.etMs = Math.min(safePt, state.etMs + safeDt);
      if (state.etMs >= safePt) {
        state.q = false;
        state.timing = false;
      } else {
        state.q = true;
      }
    } else if (inVal && !state.prevIn) {
      // Rising edge starts pulse
      if (safePt <= 0) {
        state.etMs = 0;
        state.q = false;
        state.timing = false;
      } else {
        state.etMs = Math.min(safePt, safeDt);
        if (state.etMs >= safePt) {
          state.q = false;
          state.timing = false;
        } else {
          state.q = true;
          state.timing = true;
        }
      }
    } else if (!inVal) {
      state.etMs = 0;
      state.q = false;
      state.timing = false;
    }
  }

  state.prevIn = inVal;
  return state;
}

/**
 * Evaluate an IEC 61131-3 / Siemens S7-1200 counter (CTU / CTD).
 */
export function evalIecCounter(
  prev: IecCounterState | undefined,
  id: string,
  dbName: string,
  type: CounterType,
  clkVal: boolean,
  resetOrLoadVal: boolean,
  pv: number
): IecCounterState {
  const safePv = Math.round(pv);
  const state: IecCounterState = prev
    ? { ...prev, dbName, type, pv: safePv, clkVal, resetVal: resetOrLoadVal }
    : {
        id,
        dbName,
        type,
        pv: safePv,
        cv: type === 'CTD' ? safePv : 0,
        clkVal,
        resetVal: resetOrLoadVal,
        q: false,
        prevClk: false,
      };

  const risingEdge = clkVal && !state.prevClk;

  if (type === 'CTU') {
    if (resetOrLoadVal) {
      state.cv = 0;
    } else if (risingEdge) {
      state.cv = Math.min(32767, state.cv + 1);
    }
    state.q = state.cv >= safePv;
  } else {
    // CTD
    if (resetOrLoadVal) {
      state.cv = safePv;
    } else if (risingEdge) {
      state.cv = Math.max(-32768, state.cv - 1);
    }
    state.q = state.cv <= 0;
  }

  state.prevClk = clkVal;
  return state;
}

/**
 * Siemens S7-1200 NORM_X: linear normalization OUT = (VALUE - MIN) / (MAX - MIN).
 */
export function evalNormX(value: number, min: number, max: number): number {
  const span = max - min;
  if (span === 0) return 0;
  const raw = (value - min) / span;
  return Number(raw.toFixed(4));
}

/**
 * Siemens S7-1200 SCALE_X: linear scaling OUT = VALUE * (MAX - MIN) + MIN.
 */
export function evalScaleX(normValue: number, min: number, max: number): number {
  const scaled = normValue * (max - min) + min;
  return Number(scaled.toFixed(2));
}

/**
 * Convert Siemens S7-1200 unipolar analog raw count (0..27648) to 4..20mA current.
 */
export function rawToMilliAmp(raw: number): number {
  const clamped = Math.max(0, Math.min(32511, raw));
  const ma = 4 + (clamped / 27648) * 16;
  return Number(ma.toFixed(2));
}

/**
 * Evaluate Siemens LAD comparator box.
 */
export function evalCompare(left: number, op: CompareOp, right: number): boolean {
  switch (op) {
    case '>=':
      return left >= right;
    case '<=':
      return left <= right;
    case '>':
      return left > right;
    case '<':
      return left < right;
    case '==':
      return Math.abs(left - right) < 1e-6;
    case '!=':
      return Math.abs(left - right) >= 1e-6;
  }
}

export function formatSiemensTime(ms: number): string {
  const rounded = Math.round(ms);
  if (rounded >= 1000 && rounded % 100 === 0) {
    return `T#${(rounded / 1000).toFixed(rounded % 1000 === 0 ? 0 : 1)}s`;
  }
  return `T#${rounded}ms`;
}
