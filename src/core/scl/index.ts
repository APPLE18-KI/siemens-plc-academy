import type { TagDataType, TagValue } from '../../types/plc';
import { formatPlcValueHelper } from './types';

export * from './types';
export * from './ast';
export { lexScl, parseIecTimeLiteral, normalizeDirectAddress } from './lexer';
export { parseAndCheckScl, BUILTIN_FC_NAMES, BUILTIN_FB_TYPES } from './parser';
export {
  evaluateSclProgram,
  buildTagIndex,
  exportInstancesSnapshot,
  MAX_LOOP_ITERATIONS,
  MAX_STMTS_PER_SCAN,
} from './evaluator';
export { compileSclProgram, createSclVmSession } from './session';
export { SCL_PROJECT_TEMPLATES } from './templates';

export function formatPlcValue(val: TagValue, type?: TagDataType): string {
  return formatPlcValueHelper(val, type);
}
