import React from 'react';
import { Link } from 'react-router-dom';
import { Boxes, Cpu, ExternalLink, GitBranch, MousePointerClick } from 'lucide-react';
import type { ModelId, SimPresetId, WorkflowId } from '../../types/content';
import { modelRegistry, simPresets, workflowRegistry } from '../../registry';
import { ErrorBoundary } from '../ErrorBoundary';

type StageProps =
  | { kind: 'sim'; preset: SimPresetId; title?: string; instruction?: string }
  | { kind: 'model'; id: ModelId; title?: string; instruction?: string }
  | { kind: 'workflow'; id: WorkflowId; title?: string; instruction?: string };

export const EmbeddedStageBlock: React.FC<StageProps> = (props) => {
  if (props.kind === 'sim') {
    const entry = simPresets?.[props.preset];
    const Comp = entry?.Component;
    return (
      <section className="embedded-stage-card">
        <div className="embedded-stage-head">
          <div className="embedded-stage-title-wrap">
            <span className="embedded-stage-kicker">
              <Cpu size={13} />
              动手仿真
            </span>
            <span className="embedded-stage-title">
              {props.title || entry?.title || `PLC 仿真预设：${props.preset}`}
            </span>
          </div>
          <Link to={`/sim?preset=${encodeURIComponent(props.preset)}`} className="btn btn-sm">
            全屏打开
            <ExternalLink size={13} />
          </Link>
        </div>

        {props.instruction && (
          <div className="embedded-stage-instruction">
            <MousePointerClick
              size={16}
              color="var(--siemens-teal-bright)"
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <span>{props.instruction}</span>
          </div>
        )}

        <div className="embedded-stage-body">
          {Comp ? (
            <ErrorBoundary compact title="内嵌 PLC 仿真器暂时无法加载">
              <Comp embedded />
            </ErrorBoundary>
          ) : (
            <div className="embedded-stage-fallback">
              <Cpu size={28} color="var(--siemens-teal)" />
              <strong>仿真预设 `{props.preset}` 正在接入中</strong>
              <span style={{ fontSize: 13 }}>
                你可以先前往全屏 PLC 仿真实验室体验其他实时梯形图预设。
              </span>
              <Link to="/sim" className="btn btn-sm btn-primary">
                前往仿真实验室
              </Link>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (props.kind === 'model') {
    const entry = modelRegistry?.[props.id];
    const Comp = entry?.Component;
    return (
      <section className="embedded-stage-card">
        <div className="embedded-stage-head">
          <div className="embedded-stage-title-wrap">
            <span className="embedded-stage-kicker">
              <Boxes size={13} />
              设备模型
            </span>
            <span className="embedded-stage-title">
              {props.title || entry?.title || `数字孪生模型：${props.id}`}
            </span>
          </div>
          <Link to={`/models?model=${encodeURIComponent(props.id)}`} className="btn btn-sm">
            全屏打开
            <ExternalLink size={13} />
          </Link>
        </div>

        {props.instruction && (
          <div className="embedded-stage-instruction">
            <MousePointerClick
              size={16}
              color="var(--siemens-teal-bright)"
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <span>{props.instruction}</span>
          </div>
        )}

        <div className="embedded-stage-body">
          {Comp ? (
            <ErrorBoundary compact title="数字孪生模型加载异常">
              <Comp embedded />
            </ErrorBoundary>
          ) : (
            <div className="embedded-stage-fallback">
              <Boxes size={28} color="var(--siemens-teal)" />
              <strong>数字孪生模型 `{props.id}` 正在接入中</strong>
              <Link to="/models" className="btn btn-sm btn-primary">
                前往数字孪生建模大厅
              </Link>
            </div>
          )}
        </div>
      </section>
    );
  }

  const entry = workflowRegistry?.[props.id];
  const Comp = entry?.Component;
  return (
    <section className="embedded-stage-card">
      <div className="embedded-stage-head">
        <div className="embedded-stage-title-wrap">
          <span className="embedded-stage-kicker">
            <GitBranch size={13} />
            原理动画
          </span>
          <span className="embedded-stage-title">
            {props.title || entry?.title || `工业工作流：${props.id}`}
          </span>
        </div>
        <Link to={`/workflows?workflow=${encodeURIComponent(props.id)}`} className="btn btn-sm">
          全屏打开
          <ExternalLink size={13} />
        </Link>
      </div>

      {props.instruction && (
        <div className="embedded-stage-instruction">
          <MousePointerClick
            size={16}
            color="var(--siemens-teal-bright)"
            style={{ flexShrink: 0, marginTop: 2 }}
          />
          <span>{props.instruction}</span>
        </div>
      )}

      <div className="embedded-stage-body">
        {Comp ? (
          <ErrorBoundary compact title="交互式工作流模块加载异常">
            <Comp embedded />
          </ErrorBoundary>
        ) : (
          <div className="embedded-stage-fallback">
            <GitBranch size={28} color="var(--siemens-teal)" />
            <strong>工作流 `{props.id}` 正在接入中</strong>
            <Link to="/workflows" className="btn btn-sm btn-primary">
              前往工作流解剖大厅
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};
