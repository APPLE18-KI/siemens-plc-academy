import type { TimerType } from '../../core/plc';

export type SandboxContactKind = 'NO' | 'NC' | 'P_TRIG' | 'N_TRIG';
export type SandboxCoilKind = 'OTE' | 'SET' | 'RESET';

export interface SandboxContactDraft {
  id: string;
  kind: SandboxContactKind;
  tag: string;
}

export interface SandboxNetworkDraft {
  id: string;
  title: string;
  topBranch: SandboxContactDraft[];
  hasParallelBranch: boolean;
  parallelBranch: SandboxContactDraft[];
  seriesAfter: SandboxContactDraft[];
  timerMode: 'NONE' | TimerType;
  timerPtMs: number;
  coilKind: SandboxCoilKind;
  coilTag: string;
}

export interface SandboxProjectJson {
  schema: 'siemens-plc-academy.sandbox.v1';
  exportedAt: string;
  name: string;
  drafts: SandboxNetworkDraft[];
}

const VALID_CONTACT_KINDS = new Set<string>(['NO', 'NC', 'P_TRIG', 'N_TRIG']);
const VALID_COIL_KINDS = new Set<string>(['OTE', 'SET', 'RESET']);
const VALID_TIMER_MODES = new Set<string>(['NONE', 'TON', 'TOF', 'TP']);

export function serializeSandboxProject(
  drafts: SandboxNetworkDraft[],
  name = 'OB1_Custom_Sandbox',
): string {
  const payload: SandboxProjectJson = {
    schema: 'siemens-plc-academy.sandbox.v1',
    exportedAt: new Date().toISOString(),
    name,
    drafts,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseSandboxProjectJson(
  rawText: string,
  allowedContactTags: ReadonlySet<string>,
  allowedCoilTags: ReadonlySet<string>,
): { ok: true; drafts: SandboxNetworkDraft[]; name: string } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: 'JSON 格式解析失败：请检查括号与逗号是否完整。' };
  }

  const obj = Array.isArray(parsed) ? { drafts: parsed, name: 'Imported_Sandbox' } : parsed;
  if (!obj || typeof obj !== 'object' || !Array.isArray((obj as { drafts?: unknown }).drafts)) {
    return { ok: false, error: '缺少 drafts 数组：请粘贴或选择本沙盒导出的工程 JSON。' };
  }

  const rawDrafts = (obj as { drafts: unknown[]; name?: unknown }).drafts;
  if (rawDrafts.length < 1 || rawDrafts.length > 6) {
    return { ok: false, error: `网段数量需在 1 ~ 6 个之间（当前 ${rawDrafts.length} 个）。` };
  }

  const parseContacts = (
    arr: unknown,
    fieldLabel: string,
    maxLen: number,
    minLen: number,
    nwIndex: number,
  ): SandboxContactDraft[] | string => {
    if (!Array.isArray(arr)) return `NW ${nwIndex + 1} 的 ${fieldLabel} 必须是数组。`;
    if (arr.length < minLen || arr.length > maxLen) {
      return `NW ${nwIndex + 1} 的 ${fieldLabel} 触点数量需在 ${minLen}~${maxLen} 之间。`;
    }
    const out: SandboxContactDraft[] = [];
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i] as Partial<SandboxContactDraft> | null;
      if (!item || typeof item !== 'object') return `NW ${nwIndex + 1} 存在无效触点对象。`;
      if (!VALID_CONTACT_KINDS.has(String(item.kind))) {
        return `NW ${nwIndex + 1} 触点类型 "${String(item.kind)}" 不受支持（仅限 NO/NC/P_TRIG/N_TRIG）。`;
      }
      if (!allowedContactTags.has(String(item.tag))) {
        return `NW ${nwIndex + 1} 触点引用了未知变量 "${String(item.tag)}"。`;
      }
      out.push({
        id: typeof item.id === 'string' && item.id.trim() ? item.id : `imp-c-${nwIndex}-${i}`,
        kind: item.kind as SandboxContactKind,
        tag: String(item.tag),
      });
    }
    return out;
  };

  const drafts: SandboxNetworkDraft[] = [];
  for (let i = 0; i < rawDrafts.length; i++) {
    const raw = rawDrafts[i] as Partial<SandboxNetworkDraft> | null;
    if (!raw || typeof raw !== 'object') return { ok: false, error: `NW ${i + 1} 数据结构无效。` };

    const top = parseContacts(raw.topBranch, '主支路', 4, 1, i);
    if (typeof top === 'string') return { ok: false, error: top };

    const hasParallel = Boolean(raw.hasParallelBranch);
    const parallel = parseContacts(
      raw.parallelBranch ?? [],
      '并联支路',
      3,
      hasParallel ? 1 : 0,
      i,
    );
    if (typeof parallel === 'string') return { ok: false, error: parallel };

    const seriesAfter = parseContacts(raw.seriesAfter ?? [], '汇合后串联', 3, 0, i);
    if (typeof seriesAfter === 'string') return { ok: false, error: seriesAfter };

    const timerMode = String(raw.timerMode ?? 'NONE');
    if (!VALID_TIMER_MODES.has(timerMode)) {
      return { ok: false, error: `NW ${i + 1} 定时器类型 "${timerMode}" 无效。` };
    }

    const coilKind = String(raw.coilKind ?? '');
    if (!VALID_COIL_KINDS.has(coilKind)) {
      return { ok: false, error: `NW ${i + 1} 线圈类型 "${coilKind}" 无效（仅限 OTE/SET/RESET）。` };
    }
    if (!allowedCoilTags.has(String(raw.coilTag))) {
      return { ok: false, error: `NW ${i + 1} 线圈目标 "${String(raw.coilTag)}" 必须是 %Q 或 %M 变量。` };
    }

    const rawPt = Number(raw.timerPtMs ?? 2000);
    drafts.push({
      id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : `imp-nw-${i + 1}`,
      title:
        typeof raw.title === 'string' && raw.title.trim()
          ? raw.title.trim().slice(0, 80)
          : `导入网段 ${i + 1}`,
      topBranch: top,
      hasParallelBranch: hasParallel,
      parallelBranch: parallel,
      seriesAfter,
      timerMode: timerMode as 'NONE' | TimerType,
      timerPtMs: Number.isFinite(rawPt) ? Math.max(200, Math.min(15000, Math.round(rawPt))) : 2000,
      coilKind: coilKind as SandboxCoilKind,
      coilTag: String(raw.coilTag),
    });
  }

  const rawName = (obj as { name?: unknown }).name;
  return {
    ok: true,
    drafts,
    name: typeof rawName === 'string' && rawName.trim() ? rawName.trim() : 'Imported_Sandbox',
  };
}
