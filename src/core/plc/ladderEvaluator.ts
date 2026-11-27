import type { TagDef, TagValue } from '../../types/plc';
import {
  evalCompare,
  evalIecCounter,
  evalIecTimer,
  evalNormX,
  evalScaleX,
  formatSiemensTime,
} from './instructions';
import type {
  DoubleCoilWarning,
  IecCounterState,
  IecTimerState,
  LadderEvalSnapshot,
  LadderNode,
  LadderProgram,
  NodeEvalState,
  ScanPhaseSnapshot,
} from './types';

export interface LadderInternalState {
  edges: Record<string, boolean>;
  timers: Record<string, IecTimerState>;
  counters: Record<string, IecCounterState>;
}

export function createLadderInternalState(): LadderInternalState {
  return {
    edges: {},
    timers: {},
    counters: {},
  };
}

function asBool(v: TagValue | undefined): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return false;
}

function asNumber(v: TagValue | undefined): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return 0;
}

interface CoilWriteRecord {
  networkNumber: number;
  value: boolean;
}

/**
 * Evaluate an entire Siemens S7-1200 LAD program network-by-network (OB1).
 * Mutates `tags` in place (PIQ/M/DB) and updates persistent `internal` state (timers, counters, edges).
 */
export function evaluateLadderProgram(
  program: LadderProgram,
  tags: Record<string, TagValue>,
  tagDefs: TagDef[],
  internal: LadderInternalState,
  dtMs: number,
  phaseLog: ScanPhaseSnapshot
): LadderEvalSnapshot {
  const nodeStates: Record<string, NodeEvalState> = {};
  const branchStates: Record<string, { powerIn: boolean; powerOut: boolean }[]> = {};
  const networkEnergized: Record<string, boolean> = {};
  const oteWritesByTag: Record<string, CoilWriteRecord[]> = {};

  const tagAddrMap = new Map<string, string>();
  for (const def of tagDefs) {
    tagAddrMap.set(def.name, def.address);
  }

  const evalChain = (nodes: LadderNode[], startPower: boolean, networkNumber: number): boolean => {
    let power = startPower;

    for (const node of nodes) {
      const powerIn = power;

      switch (node.kind) {
        case 'NO': {
          const val = asBool(tags[node.tag]);
          const powerOut = powerIn && val;
          nodeStates[node.id] = {
            powerIn,
            powerOut,
            active: val,
          };
          power = powerOut;
          break;
        }

        case 'NC': {
          const val = asBool(tags[node.tag]);
          const closed = !val;
          const powerOut = powerIn && closed;
          nodeStates[node.id] = {
            powerIn,
            powerOut,
            active: closed,
          };
          power = powerOut;
          break;
        }

        case 'P_TRIG': {
          const val = asBool(tags[node.tag]);
          const edgeKey = `${node.id}:${node.tag}`;
          const prev = internal.edges[edgeKey] ?? false;
          const rising = val && !prev;
          internal.edges[edgeKey] = val;
          const powerOut = powerIn && rising;
          nodeStates[node.id] = {
            powerIn,
            powerOut,
            active: rising,
            subText: rising ? '↑ 触发' : undefined,
          };
          power = powerOut;
          break;
        }

        case 'N_TRIG': {
          const val = asBool(tags[node.tag]);
          const edgeKey = `${node.id}:${node.tag}`;
          const prev = internal.edges[edgeKey] ?? false;
          const falling = !val && prev;
          internal.edges[edgeKey] = val;
          const powerOut = powerIn && falling;
          nodeStates[node.id] = {
            powerIn,
            powerOut,
            active: falling,
            subText: falling ? '↓ 触发' : undefined,
          };
          power = powerOut;
          break;
        }

        case 'CMP': {
          const left = asNumber(tags[node.leftTag]);
          const right =
            typeof node.rightValue === 'number'
              ? node.rightValue
              : asNumber(tags[node.rightValue]);
          const ok = evalCompare(left, node.op, right);
          const powerOut = powerIn && ok;
          const unit = node.unit ?? '';
          nodeStates[node.id] = {
            powerIn,
            powerOut,
            active: ok,
            valueText: `${Number(left.toFixed(1))}${unit}`,
            subText: `${node.op} ${right}${unit}`,
          };
          power = powerOut;
          break;
        }

        case 'BRANCH': {
          let mergedOut = false;
          const perBranch: { powerIn: boolean; powerOut: boolean }[] = [];
          for (const branchNodes of node.branches) {
            const bOut = evalChain(branchNodes, powerIn, networkNumber);
            perBranch.push({ powerIn, powerOut: bOut });
            if (bOut) mergedOut = true;
          }
          branchStates[node.id] = perBranch;
          nodeStates[node.id] = {
            powerIn,
            powerOut: mergedOut,
            active: mergedOut,
          };
          power = mergedOut;
          break;
        }

        case 'TIMER': {
          const tState = evalIecTimer(
            internal.timers[node.id],
            node.id,
            node.dbName,
            node.timerType,
            powerIn,
            node.ptMs,
            dtMs
          );
          internal.timers[node.id] = tState;
          if (node.qTag) tags[node.qTag] = tState.q;
          if (node.etTag) tags[node.etTag] = Math.round(tState.etMs);

          const progress = tState.ptMs > 0 ? Math.min(1, tState.etMs / tState.ptMs) : tState.q ? 1 : 0;
          nodeStates[node.id] = {
            powerIn,
            powerOut: tState.q,
            active: tState.q || tState.timing,
            valueText: `${Math.round(tState.etMs)} / ${tState.ptMs} ms`,
            subText: `PT=${formatSiemensTime(tState.ptMs)} · Q=${tState.q ? '1' : '0'}`,
            progress,
          };
          power = tState.q;
          break;
        }

        case 'COUNTER': {
          const resetVal = node.resetTag ? asBool(tags[node.resetTag]) : false;
          const cState = evalIecCounter(
            internal.counters[node.id],
            node.id,
            node.dbName,
            node.counterType,
            powerIn,
            resetVal,
            node.pv
          );
          internal.counters[node.id] = cState;
          if (node.qTag) tags[node.qTag] = cState.q;
          if (node.cvTag) tags[node.cvTag] = cState.cv;

          const progress = cState.pv > 0 ? Math.min(1, Math.max(0, cState.cv / cState.pv)) : cState.q ? 1 : 0;
          nodeStates[node.id] = {
            powerIn,
            powerOut: cState.q,
            active: cState.q,
            valueText: `CV=${cState.cv} / PV=${cState.pv}`,
            subText: `R=${resetVal ? '1' : '0'} · Q=${cState.q ? '1' : '0'}`,
            progress,
          };
          power = cState.q;
          break;
        }

        case 'NORM_X': {
          if (powerIn) {
            const raw = asNumber(tags[node.valueTag]);
            const norm = evalNormX(raw, node.min, node.max);
            tags[node.outTag] = norm;
            nodeStates[node.id] = {
              powerIn,
              powerOut: true,
              active: true,
              valueText: `${norm.toFixed(3)}`,
              subText: `IN=${Math.round(raw)} [${node.min}..${node.max}]`,
              progress: Math.min(1, Math.max(0, norm)),
            };
            power = true;
          } else {
            const cur = asNumber(tags[node.outTag]);
            nodeStates[node.id] = {
              powerIn: false,
              powerOut: false,
              active: false,
              valueText: `${cur.toFixed(3)}`,
              subText: 'EN=0',
              progress: Math.min(1, Math.max(0, cur)),
            };
            power = false;
          }
          break;
        }

        case 'SCALE_X': {
          const unit = node.unit ?? '';
          if (powerIn) {
            const normVal = asNumber(tags[node.valueTag]);
            const scaled = evalScaleX(normVal, node.min, node.max);
            tags[node.outTag] = scaled;
            const span = node.max - node.min;
            const pct = span !== 0 ? Math.min(1, Math.max(0, (scaled - node.min) / span)) : 0;
            nodeStates[node.id] = {
              powerIn,
              powerOut: true,
              active: true,
              valueText: `${scaled.toFixed(1)}${unit}`,
              subText: `IN=${normVal.toFixed(3)} → [${node.min}..${node.max}${unit}]`,
              progress: pct,
            };
            power = true;
          } else {
            const cur = asNumber(tags[node.outTag]);
            nodeStates[node.id] = {
              powerIn: false,
              powerOut: false,
              active: false,
              valueText: `${cur.toFixed(1)}${unit}`,
              subText: 'EN=0',
              progress: 0,
            };
            power = false;
          }
          break;
        }

        case 'OTE': {
          tags[node.tag] = powerIn;
          if (!oteWritesByTag[node.tag]) oteWritesByTag[node.tag] = [];
          oteWritesByTag[node.tag].push({ networkNumber, value: powerIn });
          nodeStates[node.id] = {
            powerIn,
            powerOut: powerIn,
            active: powerIn,
            writtenValue: powerIn,
          };
          power = powerIn;
          break;
        }

        case 'SET': {
          if (powerIn) {
            tags[node.tag] = true;
          }
          const currentVal = asBool(tags[node.tag]);
          nodeStates[node.id] = {
            powerIn,
            powerOut: powerIn,
            active: currentVal,
            writtenValue: powerIn ? true : undefined,
          };
          power = powerIn;
          break;
        }

        case 'RESET': {
          if (powerIn) {
            tags[node.tag] = false;
          }
          const currentVal = asBool(tags[node.tag]);
          nodeStates[node.id] = {
            powerIn,
            powerOut: powerIn,
            active: currentVal,
            writtenValue: powerIn ? false : undefined,
          };
          power = powerIn;
          break;
        }

        case 'OUTPUT_BRANCH': {
          let anyOut = false;
          const perOut: { powerIn: boolean; powerOut: boolean }[] = [];
          for (const outChain of node.outputs) {
            const oRes = evalChain(outChain, powerIn, networkNumber);
            perOut.push({ powerIn, powerOut: oRes });
            if (oRes) anyOut = true;
          }
          branchStates[node.id] = perOut;
          nodeStates[node.id] = {
            powerIn,
            powerOut: anyOut,
            active: anyOut,
          };
          power = anyOut;
          break;
        }
      }
    }

    return power;
  };

  for (const net of program.networks) {
    const energized = evalChain(net.nodes, true, net.number);
    networkEnergized[net.id] = energized;
  }

  // Analyze double-coil (duplicate OTE writes across networks)
  const doubleCoilWarnings: DoubleCoilWarning[] = [];
  for (const [tag, writes] of Object.entries(oteWritesByTag)) {
    if (writes.length > 1) {
      const nums = writes.map((w) => w.networkNumber);
      const last = writes[writes.length - 1];
      const earlierDiffer = writes.slice(0, -1).some((w) => w.value !== last.value);
      const addr = tagAddrMap.get(tag) ?? tag;
      doubleCoilWarnings.push({
        tag,
        address: addr,
        networkNumbers: nums,
        finalWriterNetwork: last.networkNumber,
        overwritten: earlierDiffer,
        message: earlierDiffer
          ? `检测到双线圈覆盖冲突！"${tag}" (${addr}) 在 NW ${nums.join('、NW ')} 被重复用普通线圈 ( ) 赋值，最终仅以最后的 NW ${last.networkNumber}（输出=${last.value ? '1' : '0'}）刷新至 PIQ！`
          : `警告："${tag}" (${addr}) 在 NW ${nums.join('、NW ')} 存在重复普通线圈 ( ) 写入（双线圈隐患），请合并为并联支路或改用单出口归属设计。`,
      });
    }
  }

  // Shallow clone timers & counters for immutable snapshot
  const timersCopy: Record<string, IecTimerState> = {};
  for (const [k, v] of Object.entries(internal.timers)) timersCopy[k] = { ...v };
  const countersCopy: Record<string, IecCounterState> = {};
  for (const [k, v] of Object.entries(internal.counters)) countersCopy[k] = { ...v };

  return {
    nodeStates,
    branchStates,
    networkEnergized,
    timers: timersCopy,
    counters: countersCopy,
    doubleCoilWarnings,
    phaseLog,
  };
}
