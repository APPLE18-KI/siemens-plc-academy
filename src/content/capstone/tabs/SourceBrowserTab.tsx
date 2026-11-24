import React, { useState } from 'react';
import { Check, Copy, Download, FileCode2, FileSpreadsheet, FileText, FolderOpen, Info } from 'lucide-react';
import { CAPSTONE_SOURCE_FILES, type CapstoneSourceFile } from '../data/sourceFiles';

const FOLDERS: Array<{ id: CapstoneSourceFile['folder']; label: string }> = [
  { id: 'types', label: 'types/ · PLC 数据类型 (UDT)' },
  { id: 'blocks', label: 'blocks/ · 程序块 (FB / OB)' },
  { id: 'tags', label: 'tags/ · 标准变量表 (CSV)' },
  { id: 'docs', label: 'docs/ · 工程与面试文档' },
];

export const SourceBrowserTab: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string>(CAPSTONE_SOURCE_FILES[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeFile =
    CAPSTONE_SOURCE_FILES.find((f) => f.id === selectedId) ?? CAPSTONE_SOURCE_FILES[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopiedId(activeFile.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback copy via textarea
      const ta = document.createElement('textarea');
      ta.value = activeFile.content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedId(activeFile.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFileIcon = (lang: CapstoneSourceFile['lang']) => {
    if (lang === 'csv') return <FileSpreadsheet size={14} color="#34d399" />;
    if (lang === 'md') return <FileText size={14} color="#38bdf8" />;
    return <FileCode2 size={14} color="#14b8a6" />;
  };

  const lines = activeFile.content.split('\n');

  return (
    <div className="cap-panel">
      <div className="cap-panel-head">
        <h2 className="cap-panel-title">
          <FileCode2 size={18} color="#14b8a6" /> TIA Portal V18/V19 可导入工程源码浏览器（10 份真实工程文件）
        </h2>
        <span className="cap-badge teal">已同步落盘至 capstone/tia-portal-project/</span>
      </div>

      {/* TIA Portal Import Order Reminder */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 10,
          background: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          fontSize: 12.5,
          lineHeight: 1.55,
          marginBottom: 14,
        }}
      >
        <Info size={16} color="#38bdf8" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>博途“外部源文件”一键生成块顺序（严防 Unresolved Type 报错）：</strong>
          先导入 <code>PLC_TagTable_S71215C.csv</code> → 再导入 <code>UDT_ModuleRecipeAndStation.scl</code> 右键“从源生成块” →
          接着导入 3 个底层设备块 (<code>FB_Cylinder2Pos</code> / <code>FB_SinamicsDrive_Tel1</code> / <code>FB_ThermalPress_PID</code>) →
          最后导入主控 <code>FB_CellSortingStation_Main</code> 与 <code>OB100/OB1/OB30</code> 并整机编译！
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
                {files.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    className={`cap-file-item ${file.id === activeFile.id ? 'active' : ''}`}
                    onClick={() => setSelectedId(file.id)}
                  >
                    {getFileIcon(file.lang)}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.fileName}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </aside>

        {/* Right Code Viewer */}
        <div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              padding: '11px 14px',
              background: 'var(--cap-bg)',
              border: '1px solid var(--cap-border)',
              borderBottom: 'none',
              borderRadius: '10px 10px 0 0',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong className="cap-mono" style={{ fontSize: 13.5 }}>
                  {activeFile.fileName}
                </strong>
                <span className="cap-badge teal">{activeFile.importOrder}</span>
                <span className="cap-badge blue">{lines.length} 行</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--cap-text-muted)', marginTop: 4 }}>
                {activeFile.summary}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="cap-btn" onClick={handleCopy}>
                {copiedId === activeFile.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                {copiedId === activeFile.id ? '已复制源码' : '复制全文'}
              </button>
              <button type="button" className="cap-btn primary" onClick={handleDownload}>
                <Download size={14} /> 下载 {activeFile.fileName.split('.').pop()?.toUpperCase()} 文件
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
