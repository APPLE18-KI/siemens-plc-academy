import type { TagDef } from '../../types/plc';
import { formatSiemensTime } from './instructions';
import type { LadderNetwork, LadderNode, LadderProgram } from './types';

export type CrossRefAccess = 'R' | 'W' | 'RW';

export type CrossRefCategory = 'I' | 'Q' | 'M' | 'IW' | 'QW' | 'T' | 'C' | 'DB';

export type StaticDiagnosticSeverity = 'error' | 'warning' | 'info';

export type StaticDiagnosticCode =
  | 'DOUBLE_COIL'
  | 'INPUT_COIL_WRITE'
  | 'EDGE_MEM_CONFLICT'
  | 'READ_ONLY_INTERNAL'
  | 'WRITE_ONLY_SIGNAL'
  | 'EMPTY_NETWORK';

export interface CrossRefUsage {
  networkId: string;
  networkNumber: number;
  networkTitle: string;
  nodeId: string;
  instruction: string;
  access: CrossRefAccess;
  isOrdinaryCoil: boolean;
  detail?: string;
}

export interface StaticDiagnostic {
  id: string;
  code: StaticDiagnosticCode;
  severity: StaticDiagnosticSeverity;
  tag: string;
  address: string;
  networkNumbers: number[];
  title: string;
  message: string;
  suggestion: string;
}

export type CrossRefEntryStatus =
  | 'ok'
  | 'double-coil'
  | 'input-write'
  | 'read-only'
  | 'write-only'
  | 'unused';

export interface CrossRefEntry {
  tag: string;
  address: string;
  category: CrossRefCategory;
  dataType: string;
  comment?: string;
  reads: CrossRefUsage[];
  writes: CrossRefUsage[];
  usages: CrossRefUsage[];
  oteWriteNetworks: number[];
  diagnostics: StaticDiagnostic[];
  status: CrossRefEntryStatus;
}

export interface CrossRefAnalysis {
  entries: CrossRefEntry[];
  diagnostics: StaticDiagnostic[];
  doubleCoilCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  /** Map from network number to static diagnostics affecting that network */
  networkDiagnostics: Record<number, StaticDiagnostic[]>;
  /** Set-friendly list of network numbers containing a double-coil OTE write */
  doubleCoilNetworks: number[];
}

const CATEGORY_ORDER: Record<CrossRefCategory, number> = {
  I: 0,
  IW: 1,
  Q: 2,
  QW: 3,
  M: 4,
  T: 5,
  C: 6,
  DB: 7,
};

function classifyCategory(address: string, def?: TagDef, forced?: CrossRefCategory): CrossRefCategory {
  if (forced) return forced;
  const addr = address.trim().toUpperCase();
  if (addr.startsWith('%IW') || addr.startsWith('%ID') || addr.startsWith('IW') || addr.startsWith('ID')) {
    return 'IW';
  }
  if (addr.startsWith('%QW') || addr.startsWith('%QD') || addr.startsWith('QW') || addr.startsWith('QD')) {
    return 'QW';
  }
  if (addr.startsWith('%I') || addr.startsWith('I')) return 'I';
  if (addr.startsWith('%Q') || addr.startsWith('Q')) return 'Q';
  if (addr.startsWith('%M') || addr.startsWith('M')) return 'M';
  if (addr.startsWith('T/') || addr.startsWith('T ') || addr.startsWith('TON') || addr.startsWith('TOF') || addr.startsWith('TP')) {
    return 'T';
  }
  if (addr.startsWith('C/') || addr.startsWith('C ') || addr.startsWith('CTU') || addr.startsWith('CTD')) {
    return 'C';
  }
  if (def?.area === 'I') return def.type === 'Bool' ? 'I' : 'IW';
  if (def?.area === 'Q') return def.type === 'Bool' ? 'Q' : 'QW';
  if (def?.area === 'M') return 'M';
  return 'DB';
}

function collectCoilTagsInNetwork(nodes: LadderNode[], target: Set<string>): void {
  for (const node of nodes) {
    if (node.kind === 'OTE' || node.kind === 'SET' || node.kind === 'RESET') {
      target.add(node.tag);
    } else if (node.kind === 'BRANCH') {
      for (const b of node.branches) collectCoilTagsInNetwork(b, target);
    } else if (node.kind === 'OUTPUT_BRANCH') {
      for (const o of node.outputs) collectCoilTagsInNetwork(o, target);
    }
  }
}

function hasExecutableNode(nodes: LadderNode[]): boolean {
  for (const node of nodes) {
    if (node.kind === 'BRANCH') {
      if (node.branches.some(hasExecutableNode)) return true;
    } else if (node.kind === 'OUTPUT_BRANCH') {
      if (node.outputs.some(hasExecutableNode)) return true;
    } else {
      return true;
    }
  }
  return false;
}

function hasWriteNode(nodes: LadderNode[]): boolean {
  for (const node of nodes) {
    if (
      node.kind === 'OTE' ||
      node.kind === 'SET' ||
      node.kind === 'RESET' ||
      node.kind === 'TIMER' ||
      node.kind === 'COUNTER' ||
      node.kind === 'NORM_X' ||
      node.kind === 'SCALE_X'
    ) {
      return true;
    }
    if (node.kind === 'BRANCH' && node.branches.some(hasWriteNode)) return true;
    if (node.kind === 'OUTPUT_BRANCH' && node.outputs.some(hasWriteNode)) return true;
  }
  return false;
}

/**
 * TIA Portal style Cross-Reference (F11) & Static Program Health Analyzer.
 * Uses O(1) Map indexing (js-index-maps) to traverse all OB1 networks in a single pass.
 */
export function analyzeProgramCrossRef(
  program: LadderProgram,
  tagDefs: TagDef[],
): CrossRefAnalysis {
  const defByName = new Map<string, TagDef>();
  const defByAddr = new Map<string, TagDef>();
  for (const def of tagDefs) {
    defByName.set(def.name, def);
    defByAddr.set(def.address.trim().toUpperCase(), def);
  }

  const entryMap = new Map<string, CrossRefEntry>();
  const edgeMemUsages = new Map<string, { networkNumber: number; nodeId: string; tag: string }[]>();

  const ensureEntry = (
    key: string,
    opts?: { address?: string; category?: CrossRefCategory; dataType?: string; comment?: string },
  ): CrossRefEntry => {
    const existing = entryMap.get(key);
    if (existing) return existing;

    const def = defByName.get(key) ?? defByAddr.get(key.trim().toUpperCase());
    const address = opts?.address ?? def?.address ?? key;
    const category = classifyCategory(address, def, opts?.category);
    const entry: CrossRefEntry = {
      tag: def?.name ?? key,
      address,
      category,
      dataType: opts?.dataType ?? def?.type ?? 'Bool',
      comment: opts?.comment ?? def?.comment,
      reads: [],
      writes: [],
      usages: [],
      oteWriteNetworks: [],
      diagnostics: [],
      status: 'unused',
    };
    entryMap.set(key, entry);
    return entry;
  };

  // Seed all declared tags so unused tags can also be inspected when requested
  for (const def of tagDefs) {
    ensureEntry(def.name);
  }

  const recordUsage = (
    key: string,
    net: LadderNetwork,
    nodeId: string,
    instruction: string,
    access: CrossRefAccess,
    isOrdinaryCoil = false,
    detail?: string,
    meta?: { address?: string; category?: CrossRefCategory; dataType?: string; comment?: string },
  ) => {
    const entry = ensureEntry(key, meta);
    const usage: CrossRefUsage = {
      networkId: net.id,
      networkNumber: net.number,
      networkTitle: net.title,
      nodeId,
      instruction,
      access,
      isOrdinaryCoil,
      detail,
    };
    entry.usages.push(usage);
    if (access === 'R' || access === 'RW') entry.reads.push(usage);
    if (access === 'W' || access === 'RW') entry.writes.push(usage);
    if (isOrdinaryCoil) entry.oteWriteNetworks.push(net.number);
  };

  const extraDiagnostics: StaticDiagnostic[] = [];

  const walkNodes = (nodes: LadderNode[], net: LadderNetwork, networkCoilTags: Set<string>) => {
    for (const node of nodes) {
      switch (node.kind) {
        case 'NO':
          recordUsage(node.tag, net, node.id, 'NO | |', 'R', false, '常开触点读取');
          break;

        case 'NC':
          recordUsage(node.tag, net, node.id, 'NC |/|', 'R', false, '常闭触点读取');
          break;

        case 'P_TRIG':
        case 'N_TRIG': {
          const sym = node.kind === 'P_TRIG' ? 'P_TRIG |P|' : 'N_TRIG |N|';
          recordUsage(node.tag, net, node.id, sym, 'R', false, '边沿检测输入');
          if (node.memTag) {
            const memKey = node.memTag.trim();
            const existingDef = defByName.get(memKey) ?? defByAddr.get(memKey.toUpperCase());
            const entryKey = existingDef?.name ?? memKey;
            recordUsage(
              entryKey,
              net,
              node.id,
              `${node.kind} 存储位`,
              'RW',
              false,
              '上一周期状态存储位',
              {
                address: existingDef?.address ?? memKey,
                dataType: 'Bool',
                comment: existingDef?.comment ?? '边沿检测专用存储位（严禁与其他边沿指令共用）',
              },
            );
            const list = edgeMemUsages.get(entryKey) ?? [];
            list.push({ networkNumber: net.number, nodeId: node.id, tag: entryKey });
            edgeMemUsages.set(entryKey, list);
          }
          break;
        }

        case 'CMP': {
          const opLabel = node.op === '!=' ? '<>' : node.op;
          recordUsage(node.leftTag, net, node.id, `CMP (${opLabel})`, 'R', false, '比较输入 IN1');
          if (typeof node.rightValue === 'string') {
            recordUsage(node.rightValue, net, node.id, `CMP (${opLabel})`, 'R', false, '比较输入 IN2');
          }
          break;
        }

        case 'TIMER': {
          const ptText = formatSiemensTime(node.ptMs);
          recordUsage(
            node.dbName,
            net,
            node.id,
            `${node.timerType} (PT=${ptText})`,
            'RW',
            false,
            'IEC 定时器背景实例',
            {
              address: `T · ${node.dbName}`,
              category: 'T',
              dataType: 'IEC_TIMER',
              comment: `${node.timerType} 定时器实例（PT = ${ptText}）`,
            },
          );
          if (node.qTag && !networkCoilTags.has(node.qTag)) {
            recordUsage(node.qTag, net, node.id, `${node.timerType}.Q`, 'W', false, '定时器输出 Q');
          }
          if (node.etTag) {
            recordUsage(node.etTag, net, node.id, `${node.timerType}.ET`, 'W', false, '当前计时值 ET');
          }
          break;
        }

        case 'COUNTER': {
          recordUsage(
            node.dbName,
            net,
            node.id,
            `${node.counterType} (PV=${node.pv})`,
            'RW',
            false,
            'IEC 计数器背景实例',
            {
              address: `C · ${node.dbName}`,
              category: 'C',
              dataType: 'IEC_COUNTER',
              comment: `${node.counterType} 计数器实例（PV = ${node.pv}）`,
            },
          );
          if (node.resetTag) {
            recordUsage(
              node.resetTag,
              net,
              node.id,
              `${node.counterType}.${node.counterType === 'CTU' ? 'R' : 'LD'}`,
              'R',
              false,
              '计数器复位/装载输入',
            );
          }
          if (node.qTag && !networkCoilTags.has(node.qTag)) {
            recordUsage(node.qTag, net, node.id, `${node.counterType}.Q`, 'W', false, '计数器输出 Q');
          }
          if (node.cvTag) {
            recordUsage(node.cvTag, net, node.id, `${node.counterType}.CV`, 'W', false, '当前计数值 CV');
          }
          break;
        }

        case 'NORM_X':
        case 'SCALE_X':
          recordUsage(node.valueTag, net, node.id, `${node.kind}.VALUE`, 'R', false, '模拟量换算输入');
          recordUsage(node.outTag, net, node.id, `${node.kind}.OUT`, 'W', false, '模拟量换算输出');
          break;

        case 'OTE':
          recordUsage(node.tag, net, node.id, 'OTE -( )-', 'W', true, '普通输出线圈赋值');
          break;

        case 'SET':
          recordUsage(node.tag, net, node.id, 'SET -(S)-', 'W', false, '置位锁存为 1');
          break;

        case 'RESET':
          recordUsage(node.tag, net, node.id, 'RESET -(R)-', 'W', false, '复位清零为 0');
          break;

        case 'BRANCH':
          for (const branch of node.branches) {
            walkNodes(branch, net, networkCoilTags);
          }
          break;

        case 'OUTPUT_BRANCH':
          for (const outChain of node.outputs) {
            walkNodes(outChain, net, networkCoilTags);
          }
          break;
      }
    }
  };

  for (const net of program.networks) {
    const coilTags = new Set<string>();
    collectCoilTagsInNetwork(net.nodes, coilTags);
    walkNodes(net.nodes, net, coilTags);

    if (!hasExecutableNode(net.nodes) || !hasWriteNode(net.nodes)) {
      extraDiagnostics.push({
        id: `empty-nw-${net.number}`,
        code: 'EMPTY_NETWORK',
        severity: 'warning',
        tag: `NW ${net.number}`,
        address: `OB1.NW${net.number}`,
        networkNumbers: [net.number],
        title: `程序段 ${net.number} 缺少有效输出`,
        message: `NW ${net.number}（${net.title}）未包含输出线圈或功能块写入，该段能流不会影响任何地址。`,
        suggestion: '请补充输出线圈 -( )- / -(S)- / -(R)- 或移除空程序段。',
      });
    }
  }

  // Edge memory bit conflict check (two edge instructions sharing the same M bit)
  for (const [memKey, uses] of edgeMemUsages.entries()) {
    if (uses.length > 1) {
      const nums = Array.from(new Set(uses.map((u) => u.networkNumber))).sort((a, b) => a - b);
      const entry = entryMap.get(memKey);
      const diag: StaticDiagnostic = {
        id: `edge-conflict-${memKey}`,
        code: 'EDGE_MEM_CONFLICT',
        severity: 'error',
        tag: entry?.tag ?? memKey,
        address: entry?.address ?? memKey,
        networkNumbers: nums,
        title: '边沿存储位冲突',
        message: `边沿存储位 "${entry?.tag ?? memKey}" (${entry?.address ?? memKey}) 被多个 P_TRIG/N_TRIG 指令重复占用（NW ${nums.join('、NW ')}），会导致上升沿/下降沿漏触发或误触发！`,
        suggestion: '每个 P_TRIG / N_TRIG 必须分配独立的 %M 或静态 DB Bool 位。',
      };
      if (entry) entry.diagnostics.push(diag);
      extraDiagnostics.push(diag);
    }
  }

  const allDiagnostics: StaticDiagnostic[] = [...extraDiagnostics];
  const doubleCoilNetworkSet = new Set<number>();

  for (const entry of entryMap.values()) {
    const uniqueOteNws = entry.oteWriteNetworks;
    const isPhysicalInput = entry.category === 'I' || entry.category === 'IW';
    const isPhysicalOutput = entry.category === 'Q' || entry.category === 'QW';
    const isInternal = entry.category === 'M' || entry.category === 'DB';

    // 1. Double-coil detection (highest priority hazard)
    if (uniqueOteNws.length > 1) {
      const uniqueSorted = Array.from(new Set(uniqueOteNws)).sort((a, b) => a - b);
      const finalNw = uniqueOteNws[uniqueOteNws.length - 1];
      uniqueSorted.forEach((n) => doubleCoilNetworkSet.add(n));
      const diag: StaticDiagnostic = {
        id: `double-coil-${entry.tag}`,
        code: 'DOUBLE_COIL',
        severity: 'error',
        tag: entry.tag,
        address: entry.address,
        networkNumbers: uniqueSorted,
        title: '双线圈冲突 (Double-Coil Hazard)',
        message: `双线圈冲突 (Double-Coil Hazard)："${entry.tag}" (${entry.address}) 在 NW ${uniqueOteNws.join('、NW ')} 被普通线圈 -( )- 重复写入，后执行的程序段（NW ${finalNw}）会覆盖前面的结果！`,
        suggestion: `将多个驱动条件合并到同一程序段的并联 OR 支路，或改用不同中间标志 %M 汇总后在单出口驱动 ${entry.address}。`,
      };
      entry.diagnostics.push(diag);
      allDiagnostics.push(diag);
      entry.status = 'double-coil';
    }

    // 2. Writing directly to a physical input address (%I / %IW)
    if (isPhysicalInput && entry.writes.length > 0) {
      const nums = Array.from(new Set(entry.writes.map((w) => w.networkNumber))).sort((a, b) => a - b);
      const diag: StaticDiagnostic = {
        id: `input-write-${entry.tag}`,
        code: 'INPUT_COIL_WRITE',
        severity: 'error',
        tag: entry.tag,
        address: entry.address,
        networkNumbers: nums,
        title: '非法写入物理输入映像区',
        message: `程序在 NW ${nums.join('、NW ')} 对物理输入地址 "${entry.tag}" (${entry.address}) 执行了写操作，下一周期 PII 采样会立即覆盖该值。`,
        suggestion: '请将线圈目标地址改为 %M 中间标志或 %Q 物理输出。',
      };
      entry.diagnostics.push(diag);
      allDiagnostics.push(diag);
      if (entry.status === 'unused') entry.status = 'input-write';
    }

    // 3. Read-only internal memory/DB flag (never written anywhere in OB1)
    if (isInternal && entry.reads.length > 0 && entry.writes.length === 0) {
      const nums = Array.from(new Set(entry.reads.map((r) => r.networkNumber))).sort((a, b) => a - b);
      const diag: StaticDiagnostic = {
        id: `read-only-${entry.tag}`,
        code: 'READ_ONLY_INTERNAL',
        severity: 'warning',
        tag: entry.tag,
        address: entry.address,
        networkNumbers: nums,
        title: '只读未写中间标志',
        message: `只读未写中间标志："${entry.tag}" (${entry.address}) 在 NW ${nums.join('、NW ')} 被触点/指令读取，但全程序没有任何线圈或功能块对其写入，运行时将恒保持初值！`,
        suggestion: `请检查是否漏写了驱动 "${entry.tag}" 的程序段，或核对变量地址是否选错。`,
      };
      entry.diagnostics.push(diag);
      allDiagnostics.push(diag);
      if (entry.status === 'unused') entry.status = 'read-only';
    }

    // 4. Write-only internal signal (written in OB1, never read by any contact/block)
    if (isInternal && entry.writes.length > 0 && entry.reads.length === 0) {
      const nums = Array.from(new Set(entry.writes.map((w) => w.networkNumber))).sort((a, b) => a - b);
      const isTelemetry = entry.dataType === 'Time' || entry.dataType === 'Int' || entry.dataType === 'Real';
      const diag: StaticDiagnostic = {
        id: `write-only-${entry.tag}`,
        code: 'WRITE_ONLY_SIGNAL',
        severity: 'info',
        tag: entry.tag,
        address: entry.address,
        networkNumbers: nums,
        title: '只写未读信号',
        message: isTelemetry
          ? `只写未读信号："${entry.tag}" (${entry.address}) 在 NW ${nums.join('、NW ')} 写入数值，未在 OB1 其他段被读取（若供 HMI/示波器监视属正常）。`
          : `只写未读信号："${entry.tag}" (${entry.address}) 在 NW ${nums.join('、NW ')} 被写入，但全程序无任何触点读取它，可能遗漏了下游联锁逻辑。`,
        suggestion: isTelemetry
          ? '用于监控或示波器显示可忽略；若需参与控制请添加比较指令 CMP。'
          : `若 "${entry.tag}" 用于级联控制，请在目标程序段添加它的常开/常闭触点。`,
      };
      entry.diagnostics.push(diag);
      allDiagnostics.push(diag);
      if (entry.status === 'unused') entry.status = 'write-only';
    }

    // Determine final status if not flagged above
    if (entry.status === 'unused') {
      if (entry.usages.length > 0) {
        // Physical inputs read-only & physical outputs write-only are completely healthy in PLC programs
        if (isPhysicalInput || isPhysicalOutput || entry.category === 'T' || entry.category === 'C') {
          entry.status = 'ok';
        } else {
          entry.status = 'ok';
        }
      } else {
        entry.status = 'unused';
      }
    }
  }

  // Sort diagnostics: error -> warning -> info, then by first network number
  const sevRank: Record<StaticDiagnosticSeverity, number> = { error: 0, warning: 1, info: 2 };
  allDiagnostics.sort((a, b) => {
    const s = sevRank[a.severity] - sevRank[b.severity];
    if (s !== 0) return s;
    return (a.networkNumbers[0] ?? 999) - (b.networkNumbers[0] ?? 999);
  });

  // Index diagnostics by network number for O(1) rendering lookups
  const networkDiagnostics: Record<number, StaticDiagnostic[]> = {};
  for (const diag of allDiagnostics) {
    for (const nw of diag.networkNumbers) {
      if (!networkDiagnostics[nw]) networkDiagnostics[nw] = [];
      networkDiagnostics[nw].push(diag);
    }
  }

  // Sort entries: hazards first? Better: preserve industrial TIA order (I -> IW -> Q -> QW -> M -> T -> C -> DB) with address natural sort
  const entries = Array.from(entryMap.values()).sort((a, b) => {
    const catDiff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    if (catDiff !== 0) return catDiff;
    return a.address.localeCompare(b.address, 'en', { numeric: true });
  });

  let doubleCoilCount = 0;
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  for (const d of allDiagnostics) {
    if (d.code === 'DOUBLE_COIL') doubleCoilCount += 1;
    if (d.severity === 'error') errorCount += 1;
    else if (d.severity === 'warning') warningCount += 1;
    else infoCount += 1;
  }

  return {
    entries,
    diagnostics: allDiagnostics,
    doubleCoilCount,
    errorCount,
    warningCount,
    infoCount,
    networkDiagnostics,
    doubleCoilNetworks: Array.from(doubleCoilNetworkSet).sort((a, b) => a - b),
  };
}
