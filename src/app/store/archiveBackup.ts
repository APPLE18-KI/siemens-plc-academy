/**
 * 学习档案 JSON 一键备份导出 & 导入恢复模块（v3.0）
 *
 * 覆盖全站所有本机学习数据键（同时兼容 v2.2 与 v3.0 全部功能模块）：
 * - siemens-plc-academy-progress-v1 / siemens-plc-academy-progress（主进度、测验、里程碑、主题）
 * - plc-study-v1 / plc_study_v2（SM-2 复习卡片、错题本、费曼解释、打卡天数）
 * - siemens_plc_academy_capstone_v1（毕业项目闯关、SCADA、面试题掌握度）
 * - plc_lesson_notes_v3（课程随堂笔记）
 * - 以及所有 siemens[-_]plc[-_]* / plc[-_]* 前缀的本机学习偏好（四级折叠、讲课进度、收藏问答、排故勋章等）
 */

export const PRIMARY_ARCHIVE_KEYS = [
  'siemens-plc-academy-progress-v1',
  'siemens-plc-academy-progress',
  'plc-study-v1',
  'plc_study_v2',
  'siemens_plc_academy_capstone_v1',
  'plc_lesson_notes_v3',
] as const;

const SAFE_KEY_PATTERN = /^(siemens[-_]plc[-_]|plc[-_])[a-zA-Z0-9._:-]{1,96}$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_IMPORT_BYTES = 4 * 1024 * 1024; // 4MB safety ceiling

export interface AcademyArchivePayload {
  schema: 'siemens-plc-academy-backup';
  version: 3;
  appVersion: string;
  exportedAt: string;
  keyCount: number;
  rawEntries: Record<string, string>;
  /** 便于人工审阅的可读预览字段 */
  entries: Record<string, unknown>;
}

export interface ArchiveExportResult {
  fileName: string;
  keyCount: number;
  bytes: number;
}

export interface ArchiveImportResult {
  ok: boolean;
  restoredKeys: string[];
  message: string;
}

export interface ArchiveLocalSummary {
  keyCount: number;
  hasNotes: boolean;
  hasStudyData: boolean;
  hasCapstoneData: boolean;
}

export function isSafeAcademyStorageKey(key: string): boolean {
  if (!key || FORBIDDEN_KEYS.has(key)) return false;
  return SAFE_KEY_PATTERN.test(key);
}

function collectAcademyRawEntries(): Record<string, string> {
  const rawEntries: Record<string, string> = {};
  if (typeof window === 'undefined' || !window.localStorage) return rawEntries;

  const keys = new Set<string>(PRIMARY_ARCHIVE_KEYS);
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && isSafeAcademyStorageKey(k)) {
        keys.add(k);
      }
    }

    keys.forEach((key) => {
      const val = window.localStorage.getItem(key);
      if (val !== null) {
        rawEntries[key] = val;
      }
    });
  } catch {
    // Ignore storage read errors in restricted environments
  }

  return rawEntries;
}

export function getLocalArchiveSummary(): ArchiveLocalSummary {
  const raw = collectAcademyRawEntries();
  const keys = Object.keys(raw);
  return {
    keyCount: keys.length,
    hasNotes: Boolean(raw['plc_lesson_notes_v3'] && raw['plc_lesson_notes_v3'] !== '{}'),
    hasStudyData: Boolean(raw['plc-study-v1'] || raw['plc_study_v2']),
    hasCapstoneData: Boolean(raw['siemens_plc_academy_capstone_v1']),
  };
}

export function buildArchivePayload(): AcademyArchivePayload {
  const rawEntries = collectAcademyRawEntries();
  const entries: Record<string, unknown> = {};

  Object.entries(rawEntries).forEach(([key, rawVal]) => {
    try {
      entries[key] = JSON.parse(rawVal);
    } catch {
      entries[key] = rawVal;
    }
  });

  return {
    schema: 'siemens-plc-academy-backup',
    version: 3,
    appVersion: '3.0.0',
    exportedAt: new Date().toISOString(),
    keyCount: Object.keys(rawEntries).length,
    rawEntries,
    entries,
  };
}

function formatDateStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 生成带日期的 .json 学习档案并触发浏览器下载 */
export function exportArchiveToJsonFile(): ArchiveExportResult {
  const payload = buildArchivePayload();
  const text = JSON.stringify(payload, null, 2);
  const fileName = `siemens-plc-academy-backup-${formatDateStamp()}.json`;
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);

  return {
    fileName,
    keyCount: payload.keyCount,
    bytes: blob.size,
  };
}

/** 校验并导入 .json 学习档案到本机 localStorage */
export function validateAndRestoreArchiveJson(jsonText: string): ArchiveImportResult {
  if (typeof jsonText !== 'string' || !jsonText.trim()) {
    return { ok: false, restoredKeys: [], message: '备份文件内容为空，请重新选择有效的 .json 文件。' };
  }

  if (jsonText.length > MAX_IMPORT_BYTES) {
    return { ok: false, restoredKeys: [], message: '备份文件体积超过 4MB 上限，已取消导入。' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, restoredKeys: [], message: 'JSON 格式解析失败，请确认选择的是本站导出的 .json 备份文件。' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, restoredKeys: [], message: '备份文件顶层结构无效，无法恢复。' };
  }

  const record = parsed as Record<string, unknown>;
  const normalizedPairs = new Map<string, string>();

  const ingestMap = (source: unknown, expectRawString: boolean) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return;
    Object.entries(source as Record<string, unknown>).forEach(([key, value]) => {
      if (!isSafeAcademyStorageKey(key) || value === undefined || value === null) return;
      if (expectRawString && typeof value === 'string') {
        normalizedPairs.set(key, value);
      } else if (typeof value === 'string') {
        normalizedPairs.set(key, value);
      } else {
        try {
          normalizedPairs.set(key, JSON.stringify(value));
        } catch {
          // Skip unserializable values
        }
      }
    });
  };

  if (record.schema === 'siemens-plc-academy-backup') {
    // 优先使用 lossless rawEntries，其次回退 entries
    if (record.rawEntries && typeof record.rawEntries === 'object') {
      ingestMap(record.rawEntries, true);
    }
    if (normalizedPairs.size === 0 && record.entries && typeof record.entries === 'object') {
      ingestMap(record.entries, false);
    }
  } else if (record.entries && typeof record.entries === 'object') {
    ingestMap(record.entries, false);
  } else {
    // 兼容直接以键名作为顶层字段的扁平备份结构
    ingestMap(record, false);
  }

  if (normalizedPairs.size === 0) {
    return {
      ok: false,
      restoredKeys: [],
      message: '未在文件中检测到西门子 PLC 实训工坊的有效学习档案字段。',
    };
  }

  // 兼容别名：如果备份中仅有 siemens-plc-academy-progress，同步一份到主存储键 siemens-plc-academy-progress-v1
  if (
    normalizedPairs.has('siemens-plc-academy-progress') &&
    !normalizedPairs.has('siemens-plc-academy-progress-v1')
  ) {
    const val = normalizedPairs.get('siemens-plc-academy-progress');
    if (val) normalizedPairs.set('siemens-plc-academy-progress-v1', val);
  }

  // 校验核心主进度字段（若存在）是否为合法 JSON 对象
  const mainProgressRaw = normalizedPairs.get('siemens-plc-academy-progress-v1');
  if (mainProgressRaw) {
    try {
      const mainObj = JSON.parse(mainProgressRaw);
      if (!mainObj || typeof mainObj !== 'object' || Array.isArray(mainObj)) {
        return { ok: false, restoredKeys: [], message: '主学习进度数据格式异常，已中止导入。' };
      }
    } catch {
      return { ok: false, restoredKeys: [], message: '主学习进度 JSON 损坏，已中止导入。' };
    }
  }

  const restoredKeys: string[] = [];
  try {
    normalizedPairs.forEach((value, key) => {
      window.localStorage.setItem(key, value);
      restoredKeys.push(key);
    });
  } catch {
    return {
      ok: false,
      restoredKeys,
      message: '写入本机浏览器存储失败（可能处于无痕模式或存储空间已满）。',
    };
  }

  return {
    ok: true,
    restoredKeys,
    message: `已成功校验并恢复 ${restoredKeys.length} 项本机学习档案，正在刷新页面同步…`,
  };
}
