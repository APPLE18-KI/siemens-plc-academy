import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Cpu, GitBranch, Layers, Link2, Milestone } from 'lucide-react';
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

const VALID_WORKFLOW_IDS: ReadonlySet<string> = new Set<WorkflowId>([
  'scan-cycle',
  'grafcet-packml',
  'project-lifecycle',
]);

function parseWorkflowParam(value: string | null): WorkflowId {
  if (value && VALID_WORKFLOW_IDS.has(value)) {
    return value as WorkflowId;
  }
  return 'scan-cycle';
}

export const WorkflowsShowcase: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [copiedLink, setCopiedLink] = useState(false);

  const activeId: WorkflowId = parseWorkflowParam(searchParams.get('wf'));
  const activeEntry = workflowRegistry[activeId];
  const ActiveComponent = activeEntry.Component;

  const handleSelectWorkflow = (id: WorkflowId) => {
    const next = new URLSearchParams(searchParams);
    next.set('wf', id);
    setSearchParams(next, { replace: true });
  };

  const handleCopyDeepLink = async () => {
    const nextUrl = new URL(window.location.href);
    // Support HashRouter links (#/workflows?wf=...)
    const hashBase = nextUrl.hash.split('?')[0] || '#/workflows';
    const fullLink = `${nextUrl.origin}${nextUrl.pathname}${hashBase}?wf=${activeId}`;
    try {
      await navigator.clipboard.writeText(fullLink);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = fullLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="wf-root">
      <div className="wf-showcase">
        <header className="wf-hero">
          <div style={{ minWidth: 0 }}>
            <div className="wf-hero-kicker">
              <Layers size={14} /> 原理动画 · 看懂 PLC 内部怎么工作
            </div>
            <h1>PLC 底层执行机制与非标自动化工程工作流</h1>
            <p>
              从微秒级 CPU 扫描周期（PII / OB1 / PIQ）、国际 OMAC PackML + GRAFCET 状态机，到非标自动化项目
              URS → EPLAN → 博途模块化开发 → FAT/SAT 工程交付八步法，边交互操作边理清底层执行逻辑。
            </p>
          </div>
          <div className="wf-hero-actions">
            <span className="wf-badge teal">3 大交互实验室 · ?wf={activeId}</span>
            <button type="button" className="wf-btn" onClick={handleCopyDeepLink}>
              {copiedLink ? <Check size={14} color="#10b981" /> : <Link2 size={14} />}
              {copiedLink ? '已复制当前实验直达链接' : '复制当前实验链接'}
            </button>
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
                onClick={() => handleSelectWorkflow(id)}
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
