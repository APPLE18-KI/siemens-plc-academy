import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, Download, FileCode2, FileSpreadsheet, FileText, FolderOpen, Info, Zap } from 'lucide-react';
import { CAPSTONE_SOURCE_FILES, type CapstoneSourceFile } from '../data/sourceFiles';
import { haptic, isNativeApp } from '../../../app/native/platform';
import { showToast } from '../../../app/native/useNativeBridge';

const FOLDERS: Array<{ id: CapstoneSourceFile['folder']; label: string }> = [
  { id: 'types', label: 'types/ · PLC 数据类型 (UDT)' },
  { id: 'blocks', label: 'blocks/ · 程序块 (FB / OB)' },
  { id: 'tags', label: 'tags/ · 标准变量表 (CSV)' },
  { id: 'docs', label: 'docs/ · 工程与面试文档' },
];

export const SourceBrowserTab: React.FC = () => {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string>(CAPSTONE_SOURCE_FILES[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeFile =
    CAPSTONE_SOURCE_FILES.find((f) => f.id === selectedId) ?? CAPSTONE_SOURCE_FILES[0];

  const copyTextToClipboard = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      } catch {
        return false;
      }
    }
  };

  const handleCopy = async () => {
    haptic('tap');
    await copyTextToClipboard(activeFile.content);
    setCopiedId(activeFile.id);
    showToast('已复制源码全文');
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = async () => {
    haptic('tap');
    if (isNativeApp()) {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: activeFile.fileName,
            text: activeFile.content,
          });
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
        }
      }
      await copyTextToClipboard(activeFile.content);
      setCopiedId(activeFile.id);
      window.setTimeout(() => setCopiedId(null), 2000);
      showToast('已复制源码，可直接粘贴至电脑博途软件', 2600);
      return;
    }

    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const handleSendToIde = () => {
    haptic('press');
    try {
      sessionStorage.setItem('plc_ide_import_code', activeFile.content);
      sessionStorage.setItem('plc_ide_import_name', activeFile.fileName);
    } catch {
      // Ignore storage quota issues
    }
    showToast(`正在载入 ${activeFile.fileName} 至在线博途 IDE…`);
    navigate('/ide?from=capstone');
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
          <FileCode2 size={18} color="#14b8a6" /> 可导入 TIA Portal 的工程源码（建议 V17 及以上）
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
          <strong>如何导入到 TIA Portal（建议 V17 或更新版本，目标 CPU 为 S7-1200，如 CPU 1215C DC/DC/DC）：</strong>
          <ol style={{ margin: '6px 0 6px 18px', padding: 0 }}>
            <li>在项目树中展开 PLC → <strong>外部源文件</strong>，双击 <strong>添加新的外部文件</strong>，选择 <code>.scl</code> 文件。</li>
            <li>右键导入的源文件 → <strong>从源生成块</strong>。请按依赖顺序：先 <code>UDT_ModuleRecipeAndStation</code>，再 3 个设备 FB（<code>FB_Cylinder2Pos</code> / <code>FB_SinamicsDrive_Tel1</code> / <code>FB_ThermalPress_PID</code>），然后主控 <code>FB_CellSortingStation_Main</code>，最后 <code>OB100 / OB1</code>，否则会提示找不到数据类型或块。</li>
            <li>变量表 <code>PLC_TagTable_S71215C.csv</code> 是文本清单：博途的变量表导入使用 Excel（.xlsx）格式，可以照着 CSV 手动建立变量，或先从博途导出一个变量表模板，再把 CSV 内容按列粘贴进去后导入。</li>
            <li>全部生成后编译整个 PLC，按提示补齐缺少的硬件组态（如 SINAMICS 驱动的报文配置）。</li>
          </ol>
          这些源文件是教学示例，导入真实项目前请结合现场硬件逐项检查和测试。
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

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {activeFile.lang === 'scl' && (
                <button
                  type="button"
                  className="cap-btn"
                  onClick={handleSendToIde}
                  style={{
                    borderColor: 'var(--alarm-amber-border)',
                    background: 'var(--alarm-amber-soft)',
                    color: 'var(--alarm-amber)',
                    fontWeight: 700,
                  }}
                >
                  <Zap size={14} /> 复制到在线博途 IDE 试编辑
                </button>
              )}
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
