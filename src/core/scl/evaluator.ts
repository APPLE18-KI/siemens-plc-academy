import type { TagDataType, TagDef, TagValue } from '../../types/plc';
import {
  formatTargetDisplay,
  type AssignTarget,
  type CallArg,
  type CallStmt,
  type CompiledSclProgram,
  type ExprNode,
  type MemberExpr,
  type StmtNode,
  type VarDeclInfo,
  type VarRefExpr,
} from './ast';
import { normalizeDirectAddress } from './lexer';
import { BUILTIN_FB_TYPES } from './parser';
import {
  formatPlcValueHelper,
  type SclBlockInstanceState,
  type SclBlockKind,
  type SclLineTelemetry,
} from './types';

export const MAX_LOOP_ITERATIONS = 500;
export const MAX_STMTS_PER_SCAN = 5000;

export interface InternalFbInstance {
  name: string;
  kind: SclBlockKind;
  fields: Record<string, TagValue>;
  prevIn: boolean;
  timing: boolean;
  prevClk: boolean;
}

export interface TagIndex {
  exactTagMap: Map<string, TagDef>;
  lowerTagMap: Map<string, TagDef>;
  addrToTagMap: Map<string, TagDef>;
}

export function buildTagIndex(tagDefs: TagDef[]): TagIndex {
  const exactTagMap = new Map<string, TagDef>();
  const lowerTagMap = new Map<string, TagDef>();
  const addrToTagMap = new Map<string, TagDef>();

  for (const def of tagDefs) {
    exactTagMap.set(def.name, def);
    lowerTagMap.set(def.name.toLowerCase(), def);
    if (def.address) {
      addrToTagMap.set(normalizeDirectAddress(def.address), def);
    }
  }

  return { exactTagMap, lowerTagMap, addrToTagMap };
}

export interface SclVmState {
  tags: Record<string, TagValue>;
  tagIndex: TagIndex;
  localCaseMap: Map<string, string>;
  instances: Record<string, InternalFbInstance>;
  instanceCaseMap: Map<string, string>;
}

export interface EvalResult {
  lineTelemetry: Record<number, SclLineTelemetry>;
  runtimeError?: {
    line: number;
    message: string;
  };
}

type FlowSignal = 'normal' | 'exit' | 'continue' | 'return' | 'abort';

interface EvalValue {
  value: TagValue;
  typeHint?: TagDataType;
}

function toBool(v: TagValue): boolean {
  if (typeof v === 'boolean') return v;
  return v !== 0 && !Number.isNaN(v);
}

function toNum(v: TagValue): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  return v ? 1 : 0;
}

function isDirectBitAddress(addr: string): boolean {
  return /^%[IQM]\d+\.\d+$/i.test(addr) || /DBX\d+\.\d+$/i.test(addr);
}

export function resolveVarKey(
  node: VarRefExpr,
  state: SclVmState
): { key: string; def?: TagDef } {
  const { exactTagMap, lowerTagMap, addrToTagMap } = state.tagIndex;

  if (node.style === 'quoted') {
    const def = exactTagMap.get(node.name) ?? lowerTagMap.get(node.name.toLowerCase());
    return { key: def ? def.name : node.name, def };
  }

  if (node.style === 'direct') {
    const norm = normalizeDirectAddress(node.name);
    const def = addrToTagMap.get(norm);
    return { key: def ? def.name : norm, def };
  }

  if (node.style === 'local') {
    const lower = node.name.toLowerCase();
    let canonical = state.localCaseMap.get(lower);
    if (!canonical) {
      canonical = node.name;
      state.localCaseMap.set(lower, canonical);
    }
    return { key: canonical };
  }

  // Plain identifier: check declared PLC tags first, otherwise treat as persistent local variable (#name)
  const def = exactTagMap.get(node.name) ?? lowerTagMap.get(node.name.toLowerCase());
  if (def) {
    return { key: def.name, def };
  }
  const localRaw = `#${node.name}`;
  const lower = localRaw.toLowerCase();
  let canonical = state.localCaseMap.get(lower);
  if (!canonical) {
    canonical = localRaw;
    state.localCaseMap.set(lower, canonical);
  }
  return { key: canonical };
}

function coerceForTagDef(val: TagValue, def?: TagDef): TagValue {
  if (!def) {
    if (typeof val === 'number' && !Number.isFinite(val)) return 0;
    return val;
  }
  switch (def.type) {
    case 'Bool':
      return toBool(val);
    case 'Int': {
      const n = Math.round(toNum(val));
      return Math.max(-32768, Math.min(32767, n));
    }
    case 'Real': {
      const n = toNum(val);
      return Number.isFinite(n) ? n : 0;
    }
    case 'Time': {
      const n = Math.round(toNum(val));
      return Math.max(0, n);
    }
  }
}

function inferFbKind(
  rawInstName: string,
  explicitKind: SclBlockKind | undefined,
  decl: VarDeclInfo | undefined,
  existing: InternalFbInstance | undefined,
  args: CallArg[]
): SclBlockKind {
  if (explicitKind) return explicitKind;
  if (decl?.blockKind) return decl.blockKind;
  if (existing) return existing.kind;

  const namedSet = new Set(args.filter((a) => a.name).map((a) => a.name!));
  const noHash = rawInstName.startsWith('#') ? rawInstName.slice(1) : rawInstName;
  const lower = noHash.toLowerCase();

  if (namedSet.has('CU')) return 'CTU';
  if (namedSet.has('CD') || namedSet.has('LD')) return 'CTD';
  if (namedSet.has('CLK')) {
    if (/(f_?trig|n_?trig|fall|neg|down)/.test(lower)) {
      return 'F_TRIG';
    }
    return 'R_TRIG';
  }

  if (namedSet.has('IN') || namedSet.has('PT') || namedSet.has('ET')) {
    if (lower.startsWith('tof') || lower.includes('_tof') || lower.includes('offdelay') || lower.includes('off_delay')) {
      return 'TOF';
    }
    if (
      /^(?:tp|TP)(?:$|[^a-z])/.test(noHash) ||
      lower.startsWith('tp_') ||
      lower.includes('_tp') ||
      lower.includes('pulse')
    ) {
      return 'TP';
    }
    return 'TON';
  }

  // Name-based fallback for positional-only calls
  if (lower.includes('ctd')) return 'CTD';
  if (lower.includes('ctu') || lower.includes('cnt') || lower.includes('count')) return 'CTU';
  if (/(f_?trig|n_?trig)/.test(lower)) return 'F_TRIG';
  if (/(r_?trig|p_?trig)/.test(lower)) return 'R_TRIG';
  if (lower.startsWith('tof') || lower.includes('_tof')) return 'TOF';
  if (/^(?:tp|TP)(?:$|[^a-z])/.test(noHash) || lower.startsWith('tp_') || lower.includes('pulse')) return 'TP';
  return 'TON';
}

function createInitialFbInstance(name: string, kind: SclBlockKind): InternalFbInstance {
  switch (kind) {
    case 'TON':
    case 'TOF':
    case 'TP':
      return {
        name,
        kind,
        fields: { IN: false, PT: 0, Q: false, ET: 0 },
        prevIn: false,
        timing: false,
        prevClk: false,
      };
    case 'CTU':
      return {
        name,
        kind,
        fields: { CU: false, R: false, PV: 0, Q: false, CV: 0 },
        prevIn: false,
        timing: false,
        prevClk: false,
      };
    case 'CTD':
      return {
        name,
        kind,
        fields: { CD: false, LD: false, PV: 0, Q: false, CV: 0 },
        prevIn: false,
        timing: false,
        prevClk: false,
      };
    case 'R_TRIG':
    case 'F_TRIG':
      return {
        name,
        kind,
        fields: { CLK: false, Q: false },
        prevIn: false,
        timing: false,
        prevClk: false,
      };
  }
}

export function exportInstancesSnapshot(
  instances: Record<string, InternalFbInstance>
): Record<string, SclBlockInstanceState> {
  const out: Record<string, SclBlockInstanceState> = {};
  for (const [key, inst] of Object.entries(instances)) {
    out[key] = {
      name: inst.name,
      kind: inst.kind,
      fields: { ...inst.fields },
    };
  }
  return out;
}

/**
 * Execute a compiled SCL program (OB1 or OB100) for one scan cycle.
 */
export function evaluateSclProgram(
  program: CompiledSclProgram,
  state: SclVmState,
  dtMs: number,
  collectTelemetry: boolean
): EvalResult {
  const safeDt = Math.max(0, dtMs);
  const lineTelemetry: Record<number, SclLineTelemetry> = {};

  if (collectTelemetry) {
    for (const line of program.executableLines) {
      lineTelemetry[line] = { line, executed: false, values: [] };
    }
  }

  let runtimeError: { line: number; message: string } | undefined;
  let stmtBudget = 0;

  const markLineExecuted = (line: number) => {
    if (!collectTelemetry) return;
    if (!lineTelemetry[line]) {
      lineTelemetry[line] = { line, executed: true, values: [] };
    } else {
      lineTelemetry[line].executed = true;
    }
  };

  const recordValue = (line: number, exprLabel: string, value: TagValue, typeHint?: TagDataType) => {
    if (!collectTelemetry) return;
    markLineExecuted(line);
    const entry = lineTelemetry[line];
    const formatted = formatPlcValueHelper(value, typeHint);
    const existing = entry.values.find((v) => v.expr === exprLabel);
    if (existing) {
      existing.value = value;
      existing.formatted = formatted;
      return;
    }
    if (entry.values.length < 3) {
      entry.values.push({ expr: exprLabel, value, formatted });
    }
  };

  const getCanonicalInstance = (rawName: string): InternalFbInstance | undefined => {
    const key = state.instanceCaseMap.get(rawName.toLowerCase());
    return key ? state.instances[key] : undefined;
  };

  const getOrCreateInstance = (
    rawName: string,
    kind: SclBlockKind
  ): InternalFbInstance => {
    const lower = rawName.toLowerCase();
    let canonical = state.instanceCaseMap.get(lower);
    if (!canonical) {
      canonical = rawName;
      state.instanceCaseMap.set(lower, canonical);
    }
    let inst = state.instances[canonical];
    if (!inst) {
      inst = createInitialFbInstance(canonical, kind);
      state.instances[canonical] = inst;
    }
    return inst;
  };

  const readVarRef = (node: VarRefExpr): EvalValue => {
    const { key, def } = resolveVarKey(node, state);
    if (key in state.tags) {
      return { value: state.tags[key], typeHint: def?.type };
    }
    if (def) {
      const init = def.init !== undefined ? def.init : def.type === 'Bool' ? false : 0;
      state.tags[key] = init;
      return { value: init, typeHint: def.type };
    }
    if (node.style === 'direct') {
      const defVal: TagValue = isDirectBitAddress(key) ? false : 0;
      state.tags[key] = defVal;
      return { value: defVal, typeHint: typeof defVal === 'boolean' ? 'Bool' : 'Int' };
    }
    // Uninitialized persistent local variable defaults to 0
    return { value: 0 };
  };

  const writeVarRef = (node: VarRefExpr, val: TagValue): { value: TagValue; typeHint?: TagDataType } => {
    const { key, def } = resolveVarKey(node, state);
    const coerced = coerceForTagDef(val, def);
    state.tags[key] = coerced;
    return { value: coerced, typeHint: def?.type };
  };

  const readMember = (node: MemberExpr): EvalValue => {
    const objName =
      node.object.kind === 'VarRef'
        ? node.object.style === 'quoted'
          ? node.object.name
          : node.object.style === 'plain'
            ? `#${node.object.name}`
            : node.object.name
        : formatTargetDisplay(node.object);

    const propUpper = node.property.toUpperCase();
    const inst =
      getCanonicalInstance(objName) ??
      (node.object.kind === 'VarRef' ? getCanonicalInstance(node.object.name) : undefined);

    if (inst && propUpper in inst.fields) {
      const val = inst.fields[propUpper];
      const isTimeField =
        (inst.kind === 'TON' || inst.kind === 'TOF' || inst.kind === 'TP') &&
        (propUpper === 'ET' || propUpper === 'PT');
      return {
        value: val,
        typeHint: isTimeField ? 'Time' : typeof val === 'boolean' ? 'Bool' : 'Int',
      };
    }

    // Well-known FB output field accessed before FB call on a later line
    if (propUpper === 'Q' || propUpper === 'IN' || propUpper === 'CLK' || propUpper === 'CU' || propUpper === 'CD' || propUpper === 'R' || propUpper === 'LD') {
      const compositeKey = `${objName}.${node.property}`;
      if (compositeKey in state.tags) {
        return { value: state.tags[compositeKey] };
      }
      return { value: false, typeHint: 'Bool' };
    }
    if (propUpper === 'ET' || propUpper === 'PT') {
      return { value: 0, typeHint: 'Time' };
    }
    if (propUpper === 'CV' || propUpper === 'PV') {
      return { value: 0, typeHint: 'Int' };
    }

    const compositeKey = `${objName}.${node.property}`;
    if (compositeKey in state.tags) {
      return { value: state.tags[compositeKey] };
    }
    return { value: 0 };
  };

  const writeMember = (node: MemberExpr, val: TagValue): EvalValue => {
    const objName =
      node.object.kind === 'VarRef'
        ? node.object.style === 'quoted'
          ? node.object.name
          : node.object.style === 'plain'
            ? `#${node.object.name}`
            : node.object.name
        : formatTargetDisplay(node.object);

    const propUpper = node.property.toUpperCase();
    const inst =
      getCanonicalInstance(objName) ??
      (node.object.kind === 'VarRef' ? getCanonicalInstance(node.object.name) : undefined);

    if (inst && propUpper in inst.fields) {
      const isTimeField =
        (inst.kind === 'TON' || inst.kind === 'TOF' || inst.kind === 'TP') &&
        (propUpper === 'ET' || propUpper === 'PT');
      inst.fields[propUpper] =
        typeof inst.fields[propUpper] === 'boolean' ? toBool(val) : toNum(val);
      return {
        value: inst.fields[propUpper],
        typeHint: isTimeField ? 'Time' : typeof inst.fields[propUpper] === 'boolean' ? 'Bool' : 'Int',
      };
    }

    const compositeKey = `${objName}.${node.property}`;
    state.tags[compositeKey] = val;
    return { value: val };
  };

  const writeTarget = (target: AssignTarget, val: TagValue): EvalValue => {
    if (target.kind === 'VarRef') {
      return writeVarRef(target, val);
    }
    return writeMember(target, val);
  };

  const evalBuiltinFc = (callee: string, args: CallArg[], traceLine: number): EvalValue => {
    const inArgs = args.filter((a) => a.direction === 'in');
    const namedValues = new Map<string, EvalValue>();
    const positionalValues: EvalValue[] = [];

    for (const arg of inArgs) {
      const ev = evalExpr(arg.expr, traceLine);
      if (arg.name) {
        namedValues.set(arg.name.toUpperCase(), ev);
      } else {
        positionalValues.push(ev);
      }
    }

    const getArg = (posIdx: number, ...names: string[]): EvalValue => {
      for (const n of names) {
        const hit = namedValues.get(n);
        if (hit !== undefined) return hit;
      }
      if (posIdx < positionalValues.length) {
        return positionalValues[posIdx];
      }
      return { value: 0 };
    };

    const getAllNumArgs = (): number[] => {
      const out: number[] = [];
      for (const arg of inArgs) {
        const ev = arg.name ? namedValues.get(arg.name.toUpperCase()) : undefined;
        if (ev) out.push(toNum(ev.value));
      }
      for (const ev of positionalValues) {
        out.push(toNum(ev.value));
      }
      return out;
    };

    switch (callee) {
      case 'NORM_X': {
        const min = toNum(getArg(0, 'MIN', 'MN').value);
        const val = toNum(getArg(1, 'VALUE', 'IN').value);
        const max = toNum(getArg(2, 'MAX', 'MX').value);
        const span = max - min;
        return { value: span === 0 ? 0 : (val - min) / span, typeHint: 'Real' };
      }
      case 'SCALE_X': {
        const min = toNum(getArg(0, 'MIN', 'MN').value);
        const val = toNum(getArg(1, 'VALUE', 'IN').value);
        const max = toNum(getArg(2, 'MAX', 'MX').value);
        return { value: val * (max - min) + min, typeHint: 'Real' };
      }
      case 'LIMIT': {
        const mn = toNum(getArg(0, 'MN', 'MIN').value);
        const inp = toNum(getArg(1, 'IN', 'VALUE').value);
        const mx = toNum(getArg(2, 'MX', 'MAX').value);
        const lo = Math.min(mn, mx);
        const hi = Math.max(mn, mx);
        return { value: Math.min(hi, Math.max(lo, inp)), typeHint: 'Real' };
      }
      case 'MIN': {
        const nums = getAllNumArgs();
        return { value: nums.length > 0 ? Math.min(...nums) : 0 };
      }
      case 'MAX': {
        const nums = getAllNumArgs();
        return { value: nums.length > 0 ? Math.max(...nums) : 0 };
      }
      case 'ABS': {
        const v = toNum(getArg(0, 'IN', 'VALUE').value);
        return { value: Math.abs(v) };
      }
      case 'SQRT': {
        const v = toNum(getArg(0, 'IN', 'VALUE').value);
        return { value: v <= 0 ? 0 : Math.sqrt(v), typeHint: 'Real' };
      }
      case 'SQR': {
        const v = toNum(getArg(0, 'IN', 'VALUE').value);
        return { value: v * v, typeHint: 'Real' };
      }
      case 'INT_TO_REAL':
      case 'DINT_TO_REAL': {
        const v = toNum(getArg(0, 'IN', 'VALUE').value);
        return { value: Number(v), typeHint: 'Real' };
      }
      case 'REAL_TO_INT':
      case 'DINT_TO_INT': {
        const v = Math.round(toNum(getArg(0, 'IN', 'VALUE').value));
        return { value: Math.max(-32768, Math.min(32767, v)), typeHint: 'Int' };
      }
      case 'REAL_TO_DINT':
      case 'INT_TO_DINT': {
        return { value: Math.round(toNum(getArg(0, 'IN', 'VALUE').value)), typeHint: 'Int' };
      }
      case 'TRUNC': {
        return { value: Math.trunc(toNum(getArg(0, 'IN', 'VALUE').value)), typeHint: 'Int' };
      }
      case 'ROUND': {
        return { value: Math.round(toNum(getArg(0, 'IN', 'VALUE').value)), typeHint: 'Int' };
      }
      case 'BOOL_TO_INT': {
        return { value: toBool(getArg(0, 'IN', 'VALUE').value) ? 1 : 0, typeHint: 'Int' };
      }
      case 'INT_TO_BOOL': {
        return { value: toNum(getArg(0, 'IN', 'VALUE').value) !== 0, typeHint: 'Bool' };
      }
      case 'TIME_TO_DINT': {
        return { value: Math.round(toNum(getArg(0, 'IN', 'VALUE').value)), typeHint: 'Int' };
      }
      case 'DINT_TO_TIME': {
        return { value: Math.max(0, Math.round(toNum(getArg(0, 'IN', 'VALUE').value))), typeHint: 'Time' };
      }
      case 'SEL': {
        const g = toBool(getArg(0, 'G').value);
        const in0 = getArg(1, 'IN0');
        const in1 = getArg(2, 'IN1');
        return g ? in1 : in0;
      }
      default:
        return { value: 0 };
    }
  };

  const evalExpr = (expr: ExprNode, traceLine: number, recordReads = true): EvalValue => {
    switch (expr.kind) {
      case 'Literal':
        return {
          value: expr.value,
          typeHint: expr.isTime ? 'Time' : typeof expr.value === 'boolean' ? 'Bool' : undefined,
        };

      case 'VarRef': {
        const res = readVarRef(expr);
        if (recordReads) {
          recordValue(traceLine, expr.raw, res.value, res.typeHint);
        }
        return res;
      }

      case 'Member': {
        const res = readMember(expr);
        if (recordReads) {
          recordValue(traceLine, formatTargetDisplay(expr), res.value, res.typeHint);
        }
        return res;
      }

      case 'Unary': {
        const opVal = evalExpr(expr.operand, traceLine, recordReads);
        if (expr.op === 'NOT') {
          return { value: !toBool(opVal.value), typeHint: 'Bool' };
        }
        if (expr.op === '-') {
          return { value: -toNum(opVal.value), typeHint: opVal.typeHint };
        }
        return { value: +toNum(opVal.value), typeHint: opVal.typeHint };
      }

      case 'Binary': {
        const l = evalExpr(expr.left, traceLine, recordReads);
        const r = evalExpr(expr.right, traceLine, recordReads);

        switch (expr.op) {
          case 'OR':
            return { value: toBool(l.value) || toBool(r.value), typeHint: 'Bool' };
          case 'XOR':
            return { value: toBool(l.value) !== toBool(r.value), typeHint: 'Bool' };
          case 'AND':
            return { value: toBool(l.value) && toBool(r.value), typeHint: 'Bool' };
          case '=': {
            if (typeof l.value === 'boolean' && typeof r.value === 'boolean') {
              return { value: l.value === r.value, typeHint: 'Bool' };
            }
            return { value: Math.abs(toNum(l.value) - toNum(r.value)) < 1e-6, typeHint: 'Bool' };
          }
          case '<>': {
            if (typeof l.value === 'boolean' && typeof r.value === 'boolean') {
              return { value: l.value !== r.value, typeHint: 'Bool' };
            }
            return { value: Math.abs(toNum(l.value) - toNum(r.value)) >= 1e-6, typeHint: 'Bool' };
          }
          case '<':
            return { value: toNum(l.value) < toNum(r.value), typeHint: 'Bool' };
          case '<=':
            return { value: toNum(l.value) <= toNum(r.value), typeHint: 'Bool' };
          case '>':
            return { value: toNum(l.value) > toNum(r.value), typeHint: 'Bool' };
          case '>=':
            return { value: toNum(l.value) >= toNum(r.value), typeHint: 'Bool' };
          case '+':
            return {
              value: toNum(l.value) + toNum(r.value),
              typeHint: l.typeHint === 'Time' || r.typeHint === 'Time' ? 'Time' : undefined,
            };
          case '-':
            return {
              value: toNum(l.value) - toNum(r.value),
              typeHint: l.typeHint === 'Time' || r.typeHint === 'Time' ? 'Time' : undefined,
            };
          case '*':
            return { value: toNum(l.value) * toNum(r.value) };
          case '/': {
            const denom = toNum(r.value);
            if (Math.abs(denom) < 1e-12) {
              if (!runtimeError) {
                runtimeError = {
                  line: expr.line,
                  message: `第 ${expr.line} 行: 除数为 0，运算结果已安全置 0`,
                };
              }
              return { value: 0 };
            }
            return { value: toNum(l.value) / denom, typeHint: 'Real' };
          }
          case 'MOD': {
            const denom = Math.trunc(toNum(r.value));
            if (denom === 0) {
              if (!runtimeError) {
                runtimeError = {
                  line: expr.line,
                  message: `第 ${expr.line} 行: MOD 求余除数为 0，结果已安全置 0`,
                };
              }
              return { value: 0, typeHint: 'Int' };
            }
            return { value: Math.trunc(toNum(l.value)) % denom, typeHint: 'Int' };
          }
        }
      }

      case 'Call':
        return evalBuiltinFc(expr.callee, expr.args, traceLine);
    }
  };

  const execCallStmt = (stmt: CallStmt) => {
    markLineExecuted(stmt.line);

    // Determine FB instance name & explicit FB kind (e.g. `#ton1(...)`, `#ton1.TON(...)`, `TON(...)`)
    let instName: string;
    let explicitKind: SclBlockKind | undefined;

    if (stmt.target.kind === 'Member') {
      const propUpper = stmt.target.property.toUpperCase();
      if (propUpper in BUILTIN_FB_TYPES) {
        explicitKind = BUILTIN_FB_TYPES[propUpper];
        instName =
          stmt.target.object.kind === 'VarRef'
            ? stmt.target.object.style === 'quoted'
              ? stmt.target.object.name
              : stmt.target.object.style === 'plain'
                ? `#${stmt.target.object.name}`
                : stmt.target.object.name
            : formatTargetDisplay(stmt.target.object);
      } else {
        instName = formatTargetDisplay(stmt.target);
      }
    } else {
      const upper = stmt.target.name.toUpperCase();
      if (stmt.target.style === 'plain' && upper in BUILTIN_FB_TYPES) {
        explicitKind = BUILTIN_FB_TYPES[upper];
        instName = `#${upper}_L${stmt.line}`;
      } else if (stmt.target.style === 'plain') {
        instName = `#${stmt.target.name}`;
      } else {
        instName = stmt.target.name;
      }
    }

    const noHashLower = (instName.startsWith('#') ? instName.slice(1) : instName).toLowerCase();
    const decl = program.declarations[noHashLower];
    const existing = getCanonicalInstance(instName);
    const kind = inferFbKind(instName, explicitKind, decl, existing, stmt.args);
    const inst = getOrCreateInstance(instName, kind);

    // Evaluate all input arguments
    const namedInputs = new Map<string, EvalValue>();
    const posInputs: EvalValue[] = [];
    const outputs: Array<{ name: string; target: AssignTarget }> = [];

    for (const arg of stmt.args) {
      if (arg.direction === 'out') {
        if (arg.name && (arg.expr.kind === 'VarRef' || arg.expr.kind === 'Member')) {
          outputs.push({ name: arg.name.toUpperCase(), target: arg.expr });
        }
      } else {
        // Don't flood line telemetry with sub-reads before recording the FB's own key outputs
        const ev = evalExpr(arg.expr, stmt.line, false);
        if (arg.name) {
          namedInputs.set(arg.name.toUpperCase(), ev);
        } else {
          posInputs.push(ev);
        }
      }
    }

    const getIn = (posIdx: number, ...names: string[]): EvalValue | undefined => {
      for (const n of names) {
        const hit = namedInputs.get(n);
        if (hit !== undefined) return hit;
      }
      return posIdx < posInputs.length ? posInputs[posIdx] : undefined;
    };

    // Execute IEC 61131-3 / Siemens S7-1200 FB state transition
    if (kind === 'TON' || kind === 'TOF' || kind === 'TP') {
      const inEv = getIn(0, 'IN');
      const ptEv = getIn(1, 'PT');
      const inVal = inEv ? toBool(inEv.value) : toBool(inst.fields.IN ?? false);
      const ptMs = Math.max(0, ptEv ? toNum(ptEv.value) : toNum(inst.fields.PT ?? 0));
      let etMs = toNum(inst.fields.ET ?? 0);
      let q = toBool(inst.fields.Q ?? false);

      if (kind === 'TON') {
        if (inVal) {
          if (etMs < ptMs) {
            etMs = Math.min(ptMs, etMs + safeDt);
          }
          q = etMs >= ptMs;
          inst.timing = !q;
        } else {
          etMs = 0;
          q = false;
          inst.timing = false;
        }
      } else if (kind === 'TOF') {
        if (inVal) {
          q = true;
          etMs = 0;
          inst.timing = false;
        } else if (inst.prevIn || inst.timing) {
          etMs = Math.min(ptMs, etMs + safeDt);
          if (etMs >= ptMs) {
            q = false;
            inst.timing = false;
          } else {
            q = true;
            inst.timing = true;
          }
        } else {
          q = false;
          etMs = 0;
          inst.timing = false;
        }
      } else {
        // TP (Pulse Timer)
        if (inst.timing) {
          etMs = Math.min(ptMs, etMs + safeDt);
          if (etMs >= ptMs) {
            q = false;
            inst.timing = false;
          } else {
            q = true;
          }
        } else if (inVal && !inst.prevIn) {
          if (ptMs <= 0) {
            etMs = 0;
            q = false;
            inst.timing = false;
          } else {
            etMs = Math.min(ptMs, safeDt);
            if (etMs >= ptMs) {
              q = false;
              inst.timing = false;
            } else {
              q = true;
              inst.timing = true;
            }
          }
        } else if (!inVal) {
          etMs = 0;
          q = false;
          inst.timing = false;
        }
      }

      inst.prevIn = inVal;
      inst.fields.IN = inVal;
      inst.fields.PT = ptMs;
      inst.fields.ET = etMs;
      inst.fields.Q = q;

      recordValue(stmt.line, `${inst.name}.Q`, q, 'Bool');
      recordValue(stmt.line, `${inst.name}.ET`, etMs, 'Time');
      recordValue(stmt.line, 'IN', inVal, 'Bool');
    } else if (kind === 'CTU') {
      const cuEv = getIn(0, 'CU', 'CLK');
      const rEv = getIn(1, 'R', 'RESET');
      const pvEv = getIn(2, 'PV');
      const cu = cuEv ? toBool(cuEv.value) : false;
      const r = rEv ? toBool(rEv.value) : false;
      const pv = Math.round(pvEv ? toNum(pvEv.value) : toNum(inst.fields.PV ?? 0));
      let cv = Math.round(toNum(inst.fields.CV ?? 0));

      const rising = cu && !inst.prevClk;
      if (r) {
        cv = 0;
      } else if (rising) {
        cv = Math.min(32767, cv + 1);
      }
      const q = cv >= pv;

      inst.prevClk = cu;
      inst.fields.CU = cu;
      inst.fields.R = r;
      inst.fields.PV = pv;
      inst.fields.CV = cv;
      inst.fields.Q = q;

      recordValue(stmt.line, `${inst.name}.CV`, cv, 'Int');
      recordValue(stmt.line, `${inst.name}.Q`, q, 'Bool');
      recordValue(stmt.line, 'PV', pv, 'Int');
    } else if (kind === 'CTD') {
      const cdEv = getIn(0, 'CD', 'CLK');
      const ldEv = getIn(1, 'LD', 'LOAD');
      const pvEv = getIn(2, 'PV');
      const cd = cdEv ? toBool(cdEv.value) : false;
      const ld = ldEv ? toBool(ldEv.value) : false;
      const pv = Math.round(pvEv ? toNum(pvEv.value) : toNum(inst.fields.PV ?? 0));
      let cv = Math.round(toNum(inst.fields.CV ?? 0));

      const rising = cd && !inst.prevClk;
      if (ld) {
        cv = pv;
      } else if (rising) {
        cv = Math.max(-32768, cv - 1);
      }
      const q = cv <= 0;

      inst.prevClk = cd;
      inst.fields.CD = cd;
      inst.fields.LD = ld;
      inst.fields.PV = pv;
      inst.fields.CV = cv;
      inst.fields.Q = q;

      recordValue(stmt.line, `${inst.name}.CV`, cv, 'Int');
      recordValue(stmt.line, `${inst.name}.Q`, q, 'Bool');
      recordValue(stmt.line, 'PV', pv, 'Int');
    } else if (kind === 'R_TRIG' || kind === 'F_TRIG') {
      const clkEv = getIn(0, 'CLK', 'IN');
      const clk = clkEv ? toBool(clkEv.value) : false;
      const q = kind === 'R_TRIG' ? clk && !inst.prevClk : !clk && inst.prevClk;

      inst.prevClk = clk;
      inst.fields.CLK = clk;
      inst.fields.Q = q;

      recordValue(stmt.line, `${inst.name}.Q`, q, 'Bool');
      recordValue(stmt.line, 'CLK', clk, 'Bool');
    }

    // Flush any `PARAM => target` output bindings
    for (const out of outputs) {
      if (out.name in inst.fields) {
        writeTarget(out.target, inst.fields[out.name]);
      }
    }
  };

  const execStmtList = (stmts: StmtNode[]): FlowSignal => {
    for (const stmt of stmts) {
      stmtBudget += 1;
      if (stmtBudget > MAX_STMTS_PER_SCAN) {
        if (!runtimeError) {
          runtimeError = {
            line: stmt.line,
            message: `第 ${stmt.line} 行: 单扫描周期执行语句超过上限 (${MAX_STMTS_PER_SCAN})，已触发看门狗保护`,
          };
        }
        return 'abort';
      }

      const sig = execStmt(stmt);
      if (sig !== 'normal') return sig;
    }
    return 'normal';
  };

  const execStmt = (stmt: StmtNode): FlowSignal => {
    switch (stmt.kind) {
      case 'Region': {
        markLineExecuted(stmt.line);
        return execStmtList(stmt.body);
      }

      case 'Assign': {
        markLineExecuted(stmt.line);
        const rhs = evalExpr(stmt.value, stmt.line, false);
        const written = writeTarget(stmt.target, rhs.value);
        // Primary telemetry entry is always the LHS target with its newly written value
        recordValue(
          stmt.line,
          formatTargetDisplay(stmt.target),
          written.value,
          written.typeHint ?? rhs.typeHint
        );
        // Capture up to 2 RHS operand values for live "eyeglasses" inspection
        if (collectTelemetry) {
          collectOperandReads(stmt.value, stmt.line);
        }
        return 'normal';
      }

      case 'CallStmt': {
        execCallStmt(stmt);
        return 'normal';
      }

      case 'If': {
        for (const br of stmt.branches) {
          markLineExecuted(br.line);
          const cond = evalExpr(br.condition, br.line, true);
          const taken = toBool(cond.value);
          recordValue(br.line, '条件', taken, 'Bool');
          if (taken) {
            return execStmtList(br.body);
          }
        }
        if (stmt.elseBody.length > 0) {
          if (stmt.elseLine !== undefined) {
            markLineExecuted(stmt.elseLine);
          }
          return execStmtList(stmt.elseBody);
        }
        return 'normal';
      }

      case 'Case': {
        markLineExecuted(stmt.line);
        const disc = evalExpr(stmt.discriminant, stmt.line, true);
        const discInt = Math.round(toNum(disc.value));
        if (stmt.discriminant.kind !== 'VarRef' && stmt.discriminant.kind !== 'Member') {
          recordValue(stmt.line, 'CASE', discInt, 'Int');
        }
        for (const br of stmt.branches) {
          const matched = br.matchers.some((m) =>
            m.high !== undefined
              ? discInt >= Math.min(m.low, m.high) && discInt <= Math.max(m.low, m.high)
              : discInt === m.low
          );
          if (matched) {
            markLineExecuted(br.line);
            return execStmtList(br.body);
          }
        }
        if (stmt.elseBody.length > 0) {
          if (stmt.elseLine !== undefined) {
            markLineExecuted(stmt.elseLine);
          }
          return execStmtList(stmt.elseBody);
        }
        return 'normal';
      }

      case 'For': {
        markLineExecuted(stmt.line);
        const startVal = Math.round(toNum(evalExpr(stmt.from, stmt.line, false).value));
        const endVal = Math.round(toNum(evalExpr(stmt.to, stmt.line, false).value));
        const stepVal = stmt.by
          ? Math.round(toNum(evalExpr(stmt.by, stmt.line, false).value))
          : 1;

        if (stepVal === 0) {
          runtimeError = {
            line: stmt.line,
            message: `第 ${stmt.line} 行: FOR 循环步长 BY 不能为 0，已跳过防死循环`,
          };
          return 'abort';
        }

        let current = startVal;
        let iterations = 0;

        while (stepVal > 0 ? current <= endVal : current >= endVal) {
          iterations += 1;
          if (iterations > MAX_LOOP_ITERATIONS) {
            runtimeError = {
              line: stmt.line,
              message: `第 ${stmt.line} 行: FOR 循环超过单周期上限 (${MAX_LOOP_ITERATIONS} 次)，已触发看门狗保护`,
            };
            return 'abort';
          }

          writeVarRef(stmt.iterator, current);
          const sig = execStmtList(stmt.body);
          if (sig === 'exit') break;
          if (sig === 'return' || sig === 'abort') return sig;

          current += stepVal;
        }

        recordValue(stmt.line, stmt.iterator.raw, current, 'Int');
        return 'normal';
      }

      case 'While': {
        markLineExecuted(stmt.line);
        let iterations = 0;
        while (toBool(evalExpr(stmt.condition, stmt.line, false).value)) {
          iterations += 1;
          if (iterations > MAX_LOOP_ITERATIONS) {
            runtimeError = {
              line: stmt.line,
              message: `第 ${stmt.line} 行: WHILE 循环超过单周期上限 (${MAX_LOOP_ITERATIONS} 次)，已触发看门狗保护`,
            };
            return 'abort';
          }
          const sig = execStmtList(stmt.body);
          if (sig === 'exit') break;
          if (sig === 'return' || sig === 'abort') return sig;
        }
        return 'normal';
      }

      case 'Repeat': {
        markLineExecuted(stmt.line);
        let iterations = 0;
        while (true) {
          iterations += 1;
          if (iterations > MAX_LOOP_ITERATIONS) {
            runtimeError = {
              line: stmt.line,
              message: `第 ${stmt.line} 行: REPEAT 循环超过单周期上限 (${MAX_LOOP_ITERATIONS} 次)，已触发看门狗保护`,
            };
            return 'abort';
          }
          const sig = execStmtList(stmt.body);
          if (sig === 'exit') break;
          if (sig === 'return' || sig === 'abort') return sig;

          const done = toBool(evalExpr(stmt.until, stmt.line, false).value);
          if (done) break;
        }
        return 'normal';
      }

      case 'Exit':
        markLineExecuted(stmt.line);
        return 'exit';

      case 'Continue':
        markLineExecuted(stmt.line);
        return 'continue';

      case 'Return':
        markLineExecuted(stmt.line);
        return 'return';
    }
  };

  /**
   * Collect up to remaining telemetry slots (max 3 total) from key variable/member reads in an expression.
   */
  const collectOperandReads = (expr: ExprNode, line: number) => {
    const entry = lineTelemetry[line];
    if (!entry || entry.values.length >= 3) return;

    switch (expr.kind) {
      case 'VarRef': {
        const ev = readVarRef(expr);
        recordValue(line, expr.raw, ev.value, ev.typeHint);
        return;
      }
      case 'Member': {
        const ev = readMember(expr);
        recordValue(line, formatTargetDisplay(expr), ev.value, ev.typeHint);
        return;
      }
      case 'Unary':
        collectOperandReads(expr.operand, line);
        return;
      case 'Binary':
        collectOperandReads(expr.left, line);
        collectOperandReads(expr.right, line);
        return;
      case 'Call':
        for (const arg of expr.args) {
          collectOperandReads(arg.expr, line);
        }
        return;
      case 'Literal':
        return;
    }
  };

  // Initialize any VAR declarations with default initializers if not yet present in state
  for (const decl of Object.values(program.declarations)) {
    if (decl.blockKind) {
      const instKey = `#${decl.name}`;
      if (!state.instanceCaseMap.has(instKey.toLowerCase())) {
        getOrCreateInstance(instKey, decl.blockKind);
      }
    } else if (decl.initExpr) {
      const localKey = `#${decl.name}`;
      if (!state.localCaseMap.has(localKey.toLowerCase())) {
        state.localCaseMap.set(localKey.toLowerCase(), localKey);
        const initEv = evalExpr(decl.initExpr, decl.line, false);
        state.tags[localKey] = initEv.value;
      }
    }
  }

  execStmtList(program.statements);

  return { lineTelemetry, runtimeError };
}
