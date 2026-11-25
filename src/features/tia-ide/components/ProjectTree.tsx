import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Cpu,
  FileCode2,
  FolderOpen,
  Gauge,
  PlaySquare,
  Table2,
} from 'lucide-react';

export type ProjectNodeId = 'ob1' | 'ob100' | 'tags' | 'watch';

export interface ProjectTreeProps {
  activeNode: ProjectNodeId;
  onSelectNode: (node: ProjectNodeId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isDirtyOb1: boolean;
  isDirtyOb100: boolean;
  tagCount: number;
  forceCount: number;
  linkedPlantLabel: string;
}

export const ProjectTree: React.FC<ProjectTreeProps> = ({
  activeNode,
  onSelectNode,
  collapsed,
  onToggleCollapse,
  isDirtyOb1,
  isDirtyOb100,
  tagCount,
  forceCount,
  linkedPlantLabel,
}) => {
  if (collapsed) {
    return (
      <aside className="tia-tree" aria-label="项目树（收起）">
        <div className="tia-tree-header" style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className="tia-tree-collapse-btn"
            onClick={onToggleCollapse}
            title="展开项目树"
            aria-label="展开项目树"
          >
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="tia-tree-rail">
          <button
            type="button"
            className={`tia-tree-rail-btn ${activeNode === 'ob1' ? 'active' : ''}`}
            onClick={() => onSelectNode('ob1')}
            title="Main [OB1] 主循环组织块"
          >
            <FileCode2 size={16} />
          </button>
          <button
            type="button"
            className={`tia-tree-rail-btn ${activeNode === 'ob100' ? 'active' : ''}`}
            onClick={() => onSelectNode('ob100')}
            title="Startup [OB100] 启动初始化块"
          >
            <PlaySquare size={16} />
          </button>
          <button
            type="button"
            className={`tia-tree-rail-btn ${activeNode === 'tags' ? 'active' : ''}`}
            onClick={() => onSelectNode('tags')}
            title="PLC 变量表"
          >
            <Table2 size={16} />
          </button>
          <button
            type="button"
            className={`tia-tree-rail-btn ${activeNode === 'watch' ? 'active' : ''}`}
            onClick={() => onSelectNode('watch')}
            title="监控与强制表"
          >
            <Gauge size={16} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="tia-tree" aria-label="TIA Portal 项目树">
      <div className="tia-tree-header">
        <span>项目树 · Project Tree</span>
        <button
          type="button"
          className="tia-tree-collapse-btn"
          onClick={onToggleCollapse}
          title="收起项目树"
          aria-label="收起项目树"
        >
          <ChevronLeft size={15} />
        </button>
      </div>

      <div className="tia-tree-body">
        <div className="tia-tree-device">
          <Cpu size={14} color="var(--siemens-teal-bright)" />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            PLC_1 [CPU 1214C]
          </span>
        </div>

        <div className="tia-tree-folder">
          <FolderOpen size={13} color="var(--siemens-teal)" />
          <span>程序块 (Program blocks)</span>
        </div>

        <button
          type="button"
          className={`tia-tree-item ${activeNode === 'ob1' ? 'active' : ''}`}
          onClick={() => onSelectNode('ob1')}
        >
          <span className="tia-tree-item-main">
            <FileCode2 size={14} color="#2dd4bf" style={{ flexShrink: 0 }} />
            <span className="tia-tree-item-label">Main [OB1]</span>
          </span>
          {isDirtyOb1 && (
            <span
              className="tia-tree-badge"
              style={{ background: 'var(--tia-online-bg)', color: 'var(--tia-online-orange)' }}
              title="有未下载的离线修改"
            >
              改
            </span>
          )}
        </button>

        <button
          type="button"
          className={`tia-tree-item ${activeNode === 'ob100' ? 'active' : ''}`}
          onClick={() => onSelectNode('ob100')}
        >
          <span className="tia-tree-item-main">
            <PlaySquare size={14} color="var(--info-cyan)" style={{ flexShrink: 0 }} />
            <span className="tia-tree-item-label">Startup [OB100]</span>
          </span>
          {isDirtyOb100 && (
            <span
              className="tia-tree-badge"
              style={{ background: 'var(--tia-online-bg)', color: 'var(--tia-online-orange)' }}
              title="有未下载的离线修改"
            >
              改
            </span>
          )}
        </button>

        <div className="tia-tree-folder" style={{ marginTop: 6 }}>
          <FolderOpen size={13} color="var(--alarm-amber)" />
          <span>PLC 变量 (PLC tags)</span>
        </div>

        <button
          type="button"
          className={`tia-tree-item ${activeNode === 'tags' ? 'active' : ''}`}
          onClick={() => onSelectNode('tags')}
        >
          <span className="tia-tree-item-main">
            <Table2 size={14} color="#fbbf24" style={{ flexShrink: 0 }} />
            <span className="tia-tree-item-label">默认变量表</span>
          </span>
          <span className="tia-tree-badge">{tagCount}</span>
        </button>

        <div className="tia-tree-folder" style={{ marginTop: 6 }}>
          <FolderOpen size={13} color="var(--power-green)" />
          <span>监控与强制表</span>
        </div>

        <button
          type="button"
          className={`tia-tree-item ${activeNode === 'watch' ? 'active' : ''}`}
          onClick={() => onSelectNode('watch')}
        >
          <span className="tia-tree-item-main">
            <Gauge size={14} color="#10b981" style={{ flexShrink: 0 }} />
            <span className="tia-tree-item-label">监控与强制表_1</span>
          </span>
          {forceCount > 0 && <span className="tia-tree-badge force">F:{forceCount}</span>}
        </button>

        <div
          style={{
            marginTop: 'auto',
            padding: '10px 8px 4px',
            borderTop: '1px solid var(--border-hairline)',
            fontSize: 11,
            color: 'var(--ink-muted)',
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--ink-secondary)', marginBottom: 2 }}>
            当前联调对象
          </div>
          <div style={{ color: 'var(--siemens-teal-bright)', fontWeight: 600 }}>
            {linkedPlantLabel}
          </div>
        </div>
      </div>
    </aside>
  );
};
