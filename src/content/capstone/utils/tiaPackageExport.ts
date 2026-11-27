import type { CapstoneSourceFile } from '../data/sourceFiles';

/**
 * Download a single source file (.scl / .csv / .md) directly from the browser.
 * Prepends UTF-8 BOM for CSV files so Chinese comments render cleanly in Excel / TIA Portal.
 */
export function downloadSingleSourceFile(file: CapstoneSourceFile): void {
  const needsBom = file.lang === 'csv';
  const payload = needsBom ? `\uFEFF${file.content}` : file.content;
  const mime =
    file.lang === 'csv'
      ? 'text/csv;charset=utf-8'
      : file.lang === 'md'
        ? 'text/markdown;charset=utf-8'
        : 'text/plain;charset=utf-8';

  const blob = new Blob([payload], { type: mime });
  triggerBlobDownload(blob, file.fileName);
}

/** Build step-by-step TIA Portal import guide included inside the full package */
export function buildTiaImportManifest(files: CapstoneSourceFile[]): string {
  const lines: string[] = [
    '# SIMATIC S7-1215C 毕业项目 · TIA Portal 外部源文件合集说明包',
    '',
    '适用软件：TIA Portal V17 / V18 / V19（目标 PLC：CPU 1215C DC/DC/DC，6ES7 215-1AG40-0XB0）',
    '',
    '## 一、压缩包文件清单与严格导入顺序',
    '',
    '请严格按以下依赖顺序执行「外部源文件 → 添加新的外部文件 → 右键从源生成块」，否则编译时会报未解析数据类型错误：',
    '',
    '| 顺序 | 压缩包内路径 | 类型 | 用途说明 |',
    '|---|---|---|---|',
  ];

  files.forEach((f, idx) => {
    const relPath = f.diskPath.replace(/^capstone\/tia-portal-project\//, '');
    lines.push(`| ${idx + 1} | \`${relPath}\` | ${f.lang.toUpperCase()} | ${f.importOrder}：${f.summary} |`);
  });

  lines.push(
    '',
    '## 二、TIA Portal 导入操作步骤',
    '',
    '1. 新建博途工程并添加站点：CPU 1215C DC/DC/DC（固件建议 V4.5+）。',
    '2. 在项目树展开 PLC →「外部源文件」，先添加 `types/UDT_ModuleRecipeAndStation.scl`，右键执行「从源生成块」。',
    '3. 依次导入并生成底层设备块：`blocks/FB_Cylinder2Pos.scl`、`blocks/FB_SinamicsDrive_Tel1.scl`、`blocks/FB_ThermalPress_PID.scl`。',
    '4. 导入主控块与组织块：`blocks/FB_CellSortingStation_Main.scl`、`blocks/OB100_WarmRestart.scl`、`blocks/OB1_MainCycle.scl`。',
    '5. 变量表 `tags/PLC_TagTable_S71215C.csv` 已带 UTF-8 BOM，可直接用 Excel 打开核对并复制到博途导出的变量表 `.xlsx` 模板后导入。',
    '6. 在设备组态中按 `docs/FDS_功能设计说明书.md` 挂载 SINAMICS G120（标准报文 1，%IW256/%QW256）与 ET 200SP 模块，执行「编译 → 软件（全部重建）」。',
    '',
    '注：本源码包用于教学实训与仿真验证，下装现场设备前请按实际电气图纸逐项校对 I/O 极性与安全回路。',
    ''
  );

  return lines.join('\n');
}

// ── Zero-dependency standard ZIP builder (Store method 0 + IEEE CRC-32 + UTF-8 flag) ──

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function getDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() >> 1) & 0x1f);
  const dosDate =
    (((year - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);
  return { dosTime, dosDate };
}

export interface ZipEntryInput {
  path: string;
  content: string;
  bom?: boolean;
}

export function buildZipBlob(entries: ZipEntryInput[]): Blob {
  const encoder = new TextEncoder();
  const { dosTime, dosDate } = getDosDateTime(new Date());

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const dataText = entry.bom ? `\uFEFF${entry.content}` : entry.content;
    const dataBytes = encoder.encode(dataText);
    const checksum = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed (2.0)
    lv.setUint16(6, 0x0800, true); // General purpose flag: UTF-8 filename
    lv.setUint16(8, 0, true); // Compression: 0 (store)
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // Extra field length
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    // Central directory header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central directory signature
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed
    cv.setUint16(8, 0x0800, true); // UTF-8 filename flag
    cv.setUint16(10, 0, true); // Compression: store
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // Extra length
    cv.setUint16(32, 0, true); // Comment length
    cv.setUint16(34, 0, true); // Disk number start
    cv.setUint16(36, 0, true); // Internal attrs
    cv.setUint32(38, 0, true); // External attrs
    cv.setUint32(42, localOffset, true); // Relative offset of local header
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    localOffset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);

  // End of Central Directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // EOCD signature
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, localOffset, true);
  ev.setUint16(20, 0, true);

  const blobParts: BlobPart[] = [...localParts, ...centralParts, eocd].map(
    (u8) => new Uint8Array(u8)
  );
  return new Blob(blobParts, { type: 'application/zip' });
}

/** Export the complete TIA Portal external sources bundle (.zip) containing all .scl, .csv, .md + import guide */
export function downloadFullTiaSourcePackage(files: CapstoneSourceFile[]): number {
  const entries: ZipEntryInput[] = [
    {
      path: 'tia-portal-project/00_TIA_Portal_导入说明.md',
      content: buildTiaImportManifest(files),
    },
    ...files.map((f) => ({
      path: `tia-portal-project/${f.diskPath.replace(/^capstone\/tia-portal-project\//, '')}`,
      content: f.content,
      bom: f.lang === 'csv',
    })),
  ];

  const blob = buildZipBlob(entries);
  triggerBlobDownload(blob, 'S7-1215C_Capstone_TIA_Portal_Sources.zip');
  return entries.length;
}

/** Export the standalone TIA Portal import guide + combined bundle reference (.md) */
export function downloadTiaImportGuide(files: CapstoneSourceFile[]): void {
  const manifest = buildTiaImportManifest(files);
  const blob = new Blob([manifest], { type: 'text/markdown;charset=utf-8' });
  triggerBlobDownload(blob, 'TIA_Portal_外部源文件导入指南.md');
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
