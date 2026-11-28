import React from 'react';
import { ArrowRight, CheckCircle2, Sparkles, X } from 'lucide-react';

export interface SpotlightStepDef {
  target: 'cpu' | 'field' | 'ladder';
  badge: string;
  title: string;
  body: string;
  autoHint?: string;
}

export const SIM_SPOTLIGHT_STEPS: SpotlightStepDef[] = [
  {
    target: 'cpu',
    badge: '第 1 步 / 共 3 步',
    title: '先看左上角 CPU：确认是绿色 RUN 运行状态',
    body: '真实西门子 PLC 只有处于绿色 RUN 模式才会循环算程序；点 STOP 停机时所有输出会立刻安全切断。',
  },
  {
    target: 'field',
    badge: '第 2 步 / 共 3 步',
    title: '现在亲手点一下高亮区域的现场按钮！',
    body: '试着按住绿色启动按钮（或先打开“点一下锁住”再轻点）。红色常闭按钮平时是 1、按下才变 0，这是工业断线安全设计。',
    autoHint: '只要你点按任意一个现场按钮，导览就会自动跳到下一步！',
  },
  {
    target: 'ladder',
    badge: '第 3 步 / 共 3 步',
    title: '盯紧梯形图里的“绿色实线”与指示灯',
    body: '绿色实线 = 有能流通过（1），蓝色虚线 = 没导通（0）。学会基础逻辑后，随时点顶部切换「博途完整模式」体验强制表、交叉引用和诊断缓冲区！',
  },
];

interface SimulatorSpotlightProps {
  stepIndex: number | null;
  onNext: () => void;
  onClose: () => void;
}

export const SimulatorSpotlight: React.FC<SimulatorSpotlightProps> = ({
  stepIndex,
  onNext,
  onClose,
}) => {
  if (stepIndex === null || stepIndex < 0 || stepIndex >= SIM_SPOTLIGHT_STEPS.length) {
    return null;
  }
  const step = SIM_SPOTLIGHT_STEPS[stepIndex];
  const isLast = stepIndex === SIM_SPOTLIGHT_STEPS.length - 1;

  return (
    <aside className="v32-spotlight-dock" role="dialog" aria-label="仿真台 3 步交互导览">
      <div className="v32-sp-head">
        <span className="v32-sp-badge">
          <Sparkles size={13} />
          {step.badge}
        </span>
        <div className="v32-sp-dots" aria-hidden="true">
          {SIM_SPOTLIGHT_STEPS.map((_, i) => (
            <span key={i} className={i === stepIndex ? 'active' : i < stepIndex ? 'done' : ''} />
          ))}
        </div>
        <button type="button" className="v32-sp-close" onClick={onClose} aria-label="关闭导览">
          <X size={15} />
        </button>
      </div>

      <h4 className="v32-sp-title">{step.title}</h4>
      <p className="v32-sp-body">{step.body}</p>
      {step.autoHint && <p className="v32-sp-auto">{step.autoHint}</p>}

      <div className="v32-sp-actions">
        <button type="button" className="v32-sp-skip" onClick={onClose}>
          跳过导览
        </button>
        <button type="button" className="v32-sp-next" onClick={onNext}>
          {isLast ? (
            <>
              <CheckCircle2 size={14} /> 我学会了，完成导览
            </>
          ) : (
            <>
              下一步 <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
