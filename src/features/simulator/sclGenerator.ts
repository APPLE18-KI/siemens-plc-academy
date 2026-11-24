import type { LadderNode, LadderProgram } from '../../core/plc';
import { formatSiemensTime } from '../../core/plc';

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

/**
 * Generates authentic Siemens S7-1200 TIA Portal SCL code live from any LadderProgram AST
 * (used by the interactive Custom Ladder Sandbox!).
 */
export function generateSclFromLadder(program: LadderProgram): string {
  const lines: string[] = [
    `// 由自定义梯形图实时自动转译 — S7-1200 OB1 SCL 等效代码`,
  ];

  for (const net of program.networks) {
    lines.push(`REGION Network_${net.number} // ${net.title}`);

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
        `    "${timerNode.dbName}"(IN := ${condExpr}, PT := ${formatSiemensTime(timerNode.ptMs)});`
      );
      condExpr = `"${timerNode.dbName}".Q`;
    }

    for (const coil of coilNodes) {
      if (coil.kind === 'OTE') {
        lines.push(`    "${coil.tag}" := ${condExpr};`);
      } else if (coil.kind === 'SET') {
        lines.push(`    IF ${condExpr} THEN`);
        lines.push(`        "${coil.tag}" := TRUE; // 置位 (S)`);
        lines.push(`    END_IF;`);
      } else if (coil.kind === 'RESET') {
        lines.push(`    IF ${condExpr} THEN`);
        lines.push(`        "${coil.tag}" := FALSE; // 复位 (R)`);
        lines.push(`    END_IF;`);
      }
    }

    if (!timerNode && coilNodes.length === 0) {
      lines.push(`    // 空网段（请添加输出线圈）`);
    }

    lines.push(`END_REGION`, '');
  }

  return lines.join('\n').trimEnd();
}
