import React, { useState } from 'react';
import {
  Archive,
  Check,
  Copy,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Info,
} from 'lucide-react';
import { CAPSTONE_SOURCE_FILES, type CapstoneSourceFile } from '../data/sourceFiles';
import {
  downloadFullTiaSourcePackage,
  downloadSingleSourceFile,
  downloadTiaImportGuide,
} from '../utils/tiaPackageExport';

const FOLDERS: Array<{ id: CapstoneSourceFile['folder']; label: string }> = [
  { id: 'types', label: 'types/ · PLC 数据类型 (UDT)' },
  { id: 'blocks', label: 'blocks/ · 程序块 (FB / OB)' },
  { id: 'tags', label: 'tags/ · 标准变量表 (CSV)' },
  { id: 'docs', label: 'docs/ · 工程与面试文档' },
];

export const SourceBrowserTab: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string>(CAPSTONE_SOURCE_FILES[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadedFileId, setDownloadedFileId] = useState<string | null>(null);
  const [bundleStatus, setBundleStatus] = useState<string | null>(null);

  const activeFile =
    CAPSTONE_SOURCE_FILES.find((f) => f.id === selectedId) ?? CAPSTONE_SOURCE_FILES[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.content);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = activeFile.content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedId(activeFile.id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadFile = (file: CapstoneSourceFile) => {
    downloadSingleSourceFile(file);
    setDownloadedFileId(file.id);
    window.setTimeout(() => setDownloadedFileId((curr) => (curr === file.id ? null : curr)), 2200);
  };

  const handleDownloadFullPackage = () => {
    const count = downloadFullTiaSourcePackage(CAPSTONE_SOURCE_FILES);
    setBundleStatus(`已导出完整合集包（共 ${count} 个文件，含导入顺序指南）`);
    window.setTimeout(() => setBundleStatus(null), 3500);
  };

  const handleDownloadGuideOnly = () => {
    downloadTiaImportGuide(CAPSTONE_SOURCE_FILES);
    setBundleStatus('已导出《TIA_Portal_外部源文件导入指南.md》');
    window.setTimeout(() => setBundleStatus(null), 3000);
  };

  const getFileIcon = (lang: CapstoneSourceFile['lang']) => {
    if (lang === 'csv') return <FileSpreadsheet size={14} color="#34d399" />;
    if (lang === 'md') return <FileText size={14} color="#38bdf8" />;
    return <FileCode2 size={14} color="#14b8a6" />;
  };

  const lines = activeFile.content.split('\n');
  const activeExt = `.${activeFile.lang}`;
  const sclCount = CAPSTONE_SOURCE_FILES.filter((f) => f.lang === 'scl').length;
  const csvCount = CAPSTONE_SOURCE_FILES.filter((f) => f.lang === 'csv').length;
  const docCount = CAPSTONE_SOURCE_FILES.filter((f) => f.lang === 'md').length;

  return (
    <div className="cap-panel">
      <div className="cap-panel-head">
        <h2 className="cap-panel-title">
          <FileCode2 size={18} color="#14b8a6" /> 可导入 TIA Portal 的工程源码（建议 V17 及以上）
        </h2>
        <span className="cap-badge teal">
          {sclCount} 个 .scl · {csvCount} 份 .csv · {docCount} 份工程文档
        </span>
      </div>

      {/* One-Click Full TIA Portal Source Bundle Bar */}
      <div className="cap-export-banner">
        <div className="cap-export-banner-info">
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 3 }}>
            本地导入 TIA Portal 一键导出区（支持浏览器离线直接保存）
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--cap-text-muted)', lineHeight: 1.55 }}>
            打包包含全部 <code className="cap-mono">.scl</code> 外部源文件、带 UTF-8 BOM 的变量表{' '}
            <code className="cap-mono">.csv</code>、FDS 说明书及按依赖排好顺序的{' '}
            <code className="cap-mono">00_TIA_Portal_导入说明.md</code>，解压即可按序「从源生成块」。
          </div>
          {bundleStatus && (
            <div className="cap-export-feedback">
              <Check size={14} /> {bundleStatus}
            </div>
          )}
        </div>

        <div className="cap-export-actions">
          <button type="button" className="cap-btn primary" onClick={handleDownloadFullPackage}>
            <Archive size={15} /> 一键导出全套博途外部源文件合集说明包 (.zip)
          </button>
          <button type="button" className="cap-btn" onClick={handleDownloadGuideOnly}>
            <FileText size={14} /> 仅下载导入顺序清单 (.md)
          </button>
        </div>
      </div>

      {/* TIA Portal Import Order Reminder */}
      <div className="cap-info-strip">
        <Info size={16} color="#38bdf8" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>TIA Portal 导入顺序要求（目标 CPU：S7-1215C DC/DC/DC）：</strong>
          <ol style={{ margin: '6px 0 4px 18px', padding: 0 }}>
            <li>
              在项目树展开 PLC → <strong>外部源文件</strong>，双击 <strong>添加新的外部文件</strong>，导入下载的{' '}
              <code className="cap-mono">.scl</code> 文件。
            </li>
            <li>
              右键源文件 → <strong>从源生成块</strong>，按依赖顺序执行：先{' '}
              <code className="cap-mono">UDT_ModuleRecipeAndStation</code>，再 3 个设备块（
              <code className="cap-mono">FB_Cylinder2Pos</code> /{' '}
              <code className="cap-mono">FB_SinamicsDrive_Tel1</code> /{' '}
              <code className="cap-mono">FB_ThermalPress_PID</code>），然后主控{' '}
              <code className="cap-mono">FB_CellSortingStation_Main</code>，最后{' '}
              <code className="cap-mono">OB100 / OB1</code>。
            </li>
            <li>
              变量表 <code className="cap-mono">PLC_TagTable_S71215C.csv</code> 已添加 UTF-8 BOM，Excel 打开无乱码，可对照建点或粘入博途导出的{' '}
              <code className="cap-mono">.xlsx</code> 变量模板导入。
            </li>
            <li>全部生成后编译整个 PLC，并在设备组态补齐 SINAMICS G120 标准报文 1 与 ET 200SP 硬件槽位。</li>
          </ol>
        </div>
      </div>

      <div className="cap-ide-layout">
        {/* Left IDE File Tree */}
        <aside className="cap-file-tree" aria-label="工程源码文件树">
          {FOLDERS.map((folder) => {
            const files = CAPSTONE_SOURCE_FILES.filter((f) => f.folder === folder.id);
            return (
              <div key={folder.id} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: 'var(--cap-text-muted)',
                    padding: '4px 6px',
                  }}
                >
                  <FolderOpen size={13} color="#14b8a6" /> {folder.label}
                </div>
                {files.map((file) => {
                  const isActive = file.id === activeFile.id;
                  return (
                    <div key={file.id} className={`cap-file-row ${isActive ? 'active' : ''}`}>
                      <button
                        type="button"
                        className={`cap-file-item ${isActive ? 'active' : ''}`}
                        onClick={() => setSelectedId(file.id)}
                      >
                        {getFileIcon(file.lang)}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.fileName}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="cap-file-dl-mini"
                        title={`一键下载 ${file.fileName}`}
                        aria-label={`一键下载 ${file.fileName}`}
                        onClick={() => handleDownloadFile(file)}
                      >
                        {downloadedFileId === file.id ? (
                          <Check size={13} color="#10b981" />
                        ) : (
                          <Download size={13} />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </aside>

        {/* Right Code Viewer */}
        <div style={{ minWidth: 0 }}>
          <div className="cap-code-header">
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong className="cap-mono" style={{ fontSize: 13.5, wordBreak: 'break-all' }}>
                  {activeFile.fileName}
                </strong>
                <span className="cap-badge teal">{activeFile.importOrder}</span>
                <span className="cap-badge blue">{lines.length} 行</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--cap-text-muted)', marginTop: 4 }}>
                {activeFile.summary}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button type="button" className="cap-btn" onClick={handleCopy}>
                {copiedId === activeFile.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                {copiedId === activeFile.id ? '已复制源码' : '复制全文'}
              </button>
              <button
                type="button"
                className={`cap-btn ${downloadedFileId === activeFile.id ? 'success' : 'primary'}`}
                onClick={() => handleDownloadFile(activeFile)}
              >
                {downloadedFileId === activeFile.id ? <Check size={14} /> : <Download size={14} />}
                {downloadedFileId === activeFile.id
                  ? `已保存 ${activeExt}`
                  : `一键下载当前文件 (${activeExt})`}
              </button>
            </div>
          </div>

          <div className="cap-code-viewer" style={{ borderRadius: '0 0 10px 10px' }}>
            {lines.map((line, i) => (
              <div key={i} className="cap-code-line">
                <span className="cap-code-ln">{i + 1}</span>
                <span
                  style={{
                    color: line.trim().startsWith('//')
                      ? '#6ee7b7'
                      : /^\s*(FUNCTION_BLOCK|ORGANIZATION_BLOCK|DATA_BLOCK|TYPE|END_|VAR|CASE|IF|ELSIF|ELSE|FOR|BEGIN)\b/.test(
                            line
                          )
                        ? '#38bdf8'
                        : '#e2e8f0',
                  }}
                >
                  {line || ' '}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
