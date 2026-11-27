import type { TagDef } from '../../types/plc';
import type { LadderNode, LadderProgram } from '../../core/plc';
import { formatSiemensTime, inferTagArea } from '../../core/plc';

function exprForNode(node: LadderNode): string | null {
  switch (node.kind) {
    case 'NO':
      return `"${node.tag}"`;
    case 'NC':
      return `(NOT "${node.tag}")`;
    case 'P_TRIG':
      return `R_TRIG("${node.tag}")`;
    case 'N_TRIG':
      return `F_TRIG("${node.tag}")`;
    case 'CMP':
      return `("${node.leftTag}" ${node.op} ${
        typeof node.rightValue === 'number' ? node.rightValue : `"${node.rightValue}"`
      })`;
    case 'BRANCH': {
      const parts = node.branches
        .map((b) => exprForChain(b))
        .filter((s) => s.length > 0);
      if (parts.length === 0) return 'TRUE';
      if (parts.length === 1) return parts[0];
      return `(${parts.join(' OR ')})`;
    }
    default:
      return null;
  }
}

function exprForChain(nodes: LadderNode[]): string {
  const parts: string[] = [];
  for (const n of nodes) {
    const e = exprForNode(n);
    if (e) parts.push(e);
  }
  return parts.length > 0 ? parts.join(' AND ') : 'TRUE';
}

function renderNetworkRegions(program: LadderProgram, indent = ''): string[] {
  const lines: string[] = [];

  for (const net of program.networks) {
    lines.push(`${indent}REGION Network_${net.number} // ${net.title}`);

    const conditionNodes: LadderNode[] = [];
    let timerNode: Extract<LadderNode, { kind: 'TIMER' }> | null = null;
    const coilNodes: Extract<LadderNode, { kind: 'OTE' | 'SET' | 'RESET' }>[] = [];

    for (const node of net.nodes) {
      if (node.kind === 'TIMER') {
        timerNode = node;
      } else if (node.kind === 'OTE' || node.kind === 'SET' || node.kind === 'RESET') {
        coilNodes.push(node);
      } else if (node.kind === 'OUTPUT_BRANCH') {
        for (const outChain of node.outputs) {
          for (const sub of outChain) {
            if (sub.kind === 'OTE' || sub.kind === 'SET' || sub.kind === 'RESET') {
              coilNodes.push(sub);
            }
          }
        }
      } else {
        conditionNodes.push(node);
      }
    }

    let condExpr = exprForChain(conditionNodes);

    if (timerNode) {
      lines.push(
        `${indent}    #${timerNode.dbName}(IN := ${condExpr}, PT := ${formatSiemensTime(timerNode.ptMs)});`,
      );
      condExpr = `#${timerNode.dbName}.Q`;
    }

    for (const coil of coilNodes) {
      if (coil.kind === 'OTE') {
        lines.push(`${indent}    "${coil.tag}" := ${condExpr};`);
      } else if (coil.kind === 'SET') {
        lines.push(`${indent}    IF ${condExpr} THEN`);
        lines.push(`${indent}        "${coil.tag}" := TRUE; // 置位 (S)`);
        lines.push(`${indent}    END_IF;`);
      } else if (coil.kind === 'RESET') {
        lines.push(`${indent}    IF ${condExpr} THEN`);
        lines.push(`${indent}        "${coil.tag}" := FALSE; // 复位 (R)`);
        lines.push(`${indent}    END_IF;`);
      }
    }

    if (!timerNode && coilNodes.length === 0) {
      lines.push(`${indent}    // 空网段（请添加输出线圈）`);
    }

    lines.push(`${indent}END_REGION`, '');
  }

  return lines;
}

/**
 * Generates authentic Siemens S7-1200 TIA Portal SCL code live from any LadderProgram AST
 * (used by the interactive Custom Ladder Sandbox!).
 */
export function generateSclFromLadder(program: LadderProgram): string {
  const lines: string[] = [
    '// 由自定义梯形图实时自动转译 — S7-1200 OB1 SCL 等效代码',
    ...renderNetworkRegions(program, ''),
  ];
  return lines.join('\n').trimEnd();
}

function collectTimerInstances(
  nodes: LadderNode[],
  out: { dbName: string; iecType: string; ptMs: number }[],
): void {
  for (const n of nodes) {
    if (n.kind === 'TIMER') {
      const iecType =
        n.timerType === 'TON' ? 'TON_TIME' : n.timerType === 'TOF' ? 'TOF_TIME' : 'TP_TIME';
      out.push({ dbName: n.dbName, iecType, ptMs: n.ptMs });
    } else if (n.kind === 'BRANCH') {
      for (const b of n.branches) collectTimerInstances(b, out);
    } else if (n.kind === 'OUTPUT_BRANCH') {
      for (const o of n.outputs) collectTimerInstances(o, out);
    }
  }
}

/**
 * Generates a TIA Portal V18/V19 compatible External Source (.scl) FUNCTION_BLOCK file
 * complete with S7_Optimized_Access pragma, VAR declarations, and REGION blocks.
 */
export function generateTiaSclFile(
  program: LadderProgram,
  tagDefs: TagDef[],
  options?: { fbName?: string; projectTitle?: string },
): string {
  const fbName = (options?.fbName ?? 'FB_Custom_Ladder').replace(/[^A-Za-z0-9_]/g, '_');
  const exportedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const inputs = tagDefs.filter((d) => inferTagArea(d) === 'I');
  const outputs = tagDefs.filter((d) => inferTagArea(d) === 'Q');
  const statics = tagDefs.filter((d) => {
    const area = inferTagArea(d);
    return area === 'M' || area === 'DB';
  });

  const timers: { dbName: string; iecType: string; ptMs: number }[] = [];
  for (const net of program.networks) collectTimerInstances(net.nodes, timers);

  const lines: string[] = [
    `// ============================================================================`,
    `// Siemens TIA Portal External Source (.scl)`,
    `// Block Name : "${fbName}"`,
    `// Source     : 西门子 PLC 工程师实训工坊 — 自定义梯形图沙盒`,
    `// Project    : ${options?.projectTitle ?? program.name}`,
    `// Networks   : ${program.networks.length}`,
    `// Exported   : ${exportedAt} UTC`,
    `// 导入方式   : TIA Portal -> 外部源文件 -> 添加新外部文件 -> 右键“从源生成块”`,
    `// ============================================================================`,
    ``,
    `FUNCTION_BLOCK "${fbName}"`,
    `{ S7_Optimized_Access := 'TRUE' }`,
    `VERSION : 0.1`,
    `   VAR_INPUT`,
    ...inputs.map((d) => `      ${d.name} : ${d.type};   // ${d.address} ${d.comment ?? ''}`.trimEnd()),
    `   END_VAR`,
    ``,
    `   VAR_OUTPUT`,
    ...outputs.map((d) => `      ${d.name} : ${d.type};   // ${d.address} ${d.comment ?? ''}`.trimEnd()),
    `   END_VAR`,
    ``,
    `   VAR`,
    ...statics.map((d) => `      ${d.name} : ${d.type};   // ${d.address} ${d.comment ?? ''}`.trimEnd()),
    ...timers.map(
      (t) =>
        `      ${t.dbName} {InstructionName := '${t.iecType}'; LibVersion := '1.0'} : ${t.iecType};   // PT := ${formatSiemensTime(t.ptMs)}`,
    ),
    `   END_VAR`,
    ``,
    `BEGIN`,
    ...renderNetworkRegions(program, '    '),
    `END_FUNCTION_BLOCK`,
    ``,
  ];

  return lines.join('\r\n');
}
