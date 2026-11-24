import React, { useState } from 'react';
import { Cpu, GitBranch, Layers, Milestone } from 'lucide-react';
import type { WorkflowEntry, WorkflowId } from '../../types/content';
import { ScanCycleWorkflow } from './ScanCycleWorkflow';
import { GrafcetPackmlWorkflow } from './GrafcetPackmlWorkflow';
import { ProjectLifecycleWorkflow } from './ProjectLifecycleWorkflow';
import './workflows.css';

export const workflowRegistry: Record<WorkflowId, WorkflowEntry> = {
  'scan-cycle': {
    id: 'scan-cycle',
    title: 'PLC 扫描周期微观执行与双线圈实验室',
    subtitle: 'PII 输入锁存 → OB1 顺序求值 → PIQ 写回硬件全过程动态追踪',
    tags: ['PII/PIQ', 'OB1', '双线圈排错'],
    Component: ScanCycleWorkflow,
  },
  'grafcet-packml': {
    id: 'grafcet-packml',
    title: 'GRAFCET 顺序功能图与 OMAC PackML 状态机',
    subtitle: '工业标准模式/异常联锁与 SCL CASE 状态机实时同步高亮',
    tags: ['PackML', 'GRAFCET', 'SCL CASE'],
    Component: GrafcetPackmlWorkflow,
  },
  'project-lifecycle': {
    id: 'project-lifecycle',
    title: '非标自动化项目全生命周期工程交付流',
    subtitle: 'URS → EPLAN → I/O 点表 → 博途组态 → PLCSIM 虚拟联调 → FAT/SAT 八步法',
    tags: ['URS→SAT', 'EPLAN', 'FAT/SAT'],
    Component: ProjectLifecycleWorkflow,
  },
};

const WORKFLOW_ORDER: Array<{ id: WorkflowId; icon: React.ReactNode }> = [
  { id: 'scan-cycle', icon: <Cpu size={18} /> },
  { id: 'grafcet-packml', icon: <GitBranch size={18} /> },
  { id: 'project-lifecycle', icon: <Milestone size={18} /> },
];

export const WorkflowsShowcase: React.FC = () => {
  const [activeId, setActiveId] = useState<WorkflowId>('scan-cycle');
  const activeEntry = workflowRegistry[activeId];
  const ActiveComponent = activeEntry.Component;

  return (
    <div className="wf-root">
      <div className="wf-showcase">
        <header className="wf-hero">
          <div>
            <div className="wf-hero-kicker">
              <Layers size={14} /> Siemens TIA Portal · Engineering &amp; Runtime Workflows
            </div>
            <h1>PLC 底层执行机制与非标自动化工程工作流</h1>
            <p>
              从微秒级 CPU 扫描周期（PII/OB1/PIQ）、国际 OMAC PackML + GRAFCET 标准状态机，到完整非标自动化项目的
              URS → EPLAN → 博途模块化开发 → FAT/SAT 工程交付八步法，边交互操作边吃透资深自动化工程师的底层思维。
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <span className="wf-badge teal">3 大核心交互实验室</span>
            <span className="wf-badge green">S7-1200/1500 标准工程范式</span>
          </div>
        </header>

        <div className="wf-tab-grid" role="tablist" aria-label="选择工作流实验室">
          {WORKFLOW_ORDER.map(({ id, icon }) => {
            const entry = workflowRegistry[id];
            const isActive = activeId === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`wf-tab-card ${isActive ? 'active' : ''}`}
                onClick={() => setActiveId(id)}
              >
                <div className="wf-tab-card-head">
                  <span className="wf-tab-icon">{icon}</span>
                  <div className="wf-chip-row">
                    {entry.tags?.map((t) => (
                      <span key={t} className="wf-chip">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <h2 className="wf-tab-title">{entry.title}</h2>
                <p className="wf-tab-sub">{entry.subtitle}</p>
              </button>
            );
          })}
        </div>

        <ActiveComponent embedded={false} />
      </div>
    </div>
  );
};
