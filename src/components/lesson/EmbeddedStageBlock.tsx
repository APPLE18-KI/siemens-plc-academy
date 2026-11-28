import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, CheckCircle2, Cpu, ExternalLink, GitBranch, HelpCircle, Maximize2, Minimize2, MousePointerClick } from 'lucide-react';
import type { ModelId, SimPresetId, WorkflowId } from '../../types/content';
import { modelRegistry, simPresets, workflowRegistry } from '../../registry';
import { ErrorBoundary } from '../ErrorBoundary';
import { haptic } from '../../app/native/platform';

interface QuickBetDef {
  question: string;
  options: [string, string, string];
  answer: number;
  explain: string;
}

const SIM_QUICK_BETS: Record<SimPresetId, QuickBetDef> = {
  'wiring-basics': {
    question: '通电前先猜：现场红色常闭急停按钮的电线突然断了，PLC 读到的 %I0.0 会变成？',
    options: ['变成 0，安全停机', '保持 1，继续运行', '随机闪烁'],
    answer: 0,
    explain: '物理常闭按钮平时送 24V (=1)，一旦断线失电立刻变 0，程序检测到 0 自动切停设备——这就是“断线安全”。马上点下方仿真器验证！',
  },
  'seal-in-motor': {
    question: '通电前先猜：点一下绿色启动 SB1 马上松手，下方运行灯 HL1 会怎样？',
    options: ['闪一下就熄灭', '一直保持常亮（自锁）', '根本不会亮'],
    answer: 1,
    explain: '因为下方并联了 %Q0.0 自己的常开触点：一旦通电吸合，松开 SB1 后电流改走自锁支路继续供电！快去下面按 SB1 亲眼看看。',
  },
  'reversing-interlock': {
    question: '通电前先猜：电机正转运行中，如果手误直接点“反转启动”，正常互锁程序会怎样？',
    options: ['正反转同时吸合烧保险', '拒绝反转，必须先按停止', '自动切到反转'],
    answer: 1,
    explain: '反转支路里串联了“正转接触器常闭触点”，只要正转在运行，反转支路就锁死不通！下面仿真器里可以亲自点点看。',
  },
  'ton-star-delta': {
    question: '通电前先猜：星三角启动刚计时到 1.5 秒时按了一下停止，再重新启动会从几秒开始计？',
    options: ['接着从 1.5 秒继续算', '立即清零，从 0 秒重算', '直接跳到三角运行'],
    answer: 1,
    explain: 'IEC 的 TON 定时器只要 IN 中途变 0，当前时间 ET 就会立刻清零复位，绝不累加！去下面按停止试试。',
  },
  'ctu-batch-pack': {
    question: '通电前先猜：如果一个工件停在光电开关前一直遮挡不动，CTU 计数器会一直往上加吗？',
    options: ['会，每个扫描周期疯狂加 1', '不会，只在刚遮挡那一瞬间加 1', '会倒扣减 1'],
    answer: 1,
    explain: '因为前面有上升沿检测（0→1 只触发 1 个周期），所以遮挡不动时计数值稳稳保持不变！去下面挡住光电看看。',
  },
  'analog-scale-pid': {
    question: '通电前先猜：把模拟量 %IW64 拉到西门子 100% 满量程时，对应的整数值是多少？',
    options: ['10000', '27648', '65535'],
    answer: 1,
    explain: '西门子 S7-1200 规定 10V / 20mA 额定满量程统一对应 27648（预留超量程缓冲到 32511）。去下面拖动滑块观察 NORM_X 输出！',
  },
};

const SimQuickBetStrip: React.FC<{ preset: SimPresetId }> = ({ preset }) => {
  const def = SIM_QUICK_BETS[preset];
  const [picked, setPicked] = useState<number | null>(null);
  if (!def) return null;
  const revealed = picked !== null;
  const ok = picked === def.answer;

  return (
    <div className={`v32-quickbet${revealed ? (ok ? ' is-ok' : ' is-nudge') : ''}`}>
      <div className="v32-quickbet-q">
        <HelpCircle size={14} />
        <span>{def.question}</span>
      </div>
      <div className="v32-quickbet-opts">
        {def.options.map((opt, idx) => (
          <button
            key={opt}
            type="button"
            disabled={revealed}
            className={`v32-quickbet-btn${
              revealed
                ? idx === def.answer
                  ? ' is-correct'
                  : picked === idx
                    ? ' is-wrong'
                    : ''
                : ''
            }`}
            onClick={() => {
              haptic(idx === def.answer ? 'success' : 'tap');
              setPicked(idx);
            }}
          >
            {opt}
          </button>
        ))}
      </div>
      {revealed && (
        <div className="v32-quickbet-explain" role="status">
          <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            <strong>{ok ? '猜对了！' : '直觉小陷阱！'}</strong>
            {def.explain}
          </span>
        </div>
      )}
    </div>
  );
};

type StageProps =
  | { kind: 'sim'; preset: SimPresetId; title?: string; instruction?: string }
  | { kind: 'model'; id: ModelId; title?: string; instruction?: string }
  | { kind: 'workflow'; id: WorkflowId; title?: string; instruction?: string };

export const EmbeddedStageBlock: React.FC<StageProps> = (props) => {
  const [focusWide, setFocusWide] = useState(false);

  useEffect(() => {
    if (!focusWide) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusWide(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusWide]);

  if (props.kind === 'sim') {
    const entry = simPresets?.[props.preset];
    const Comp = entry?.Component;
    return (
      <section className={`embedded-stage-card${focusWide ? ' is-focus-wide' : ''}`}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn btn-sm${focusWide ? ' btn-primary' : ''}`}
              onClick={() => setFocusWide((v) => !v)}
              title={focusWide ? '退出宽屏专注模式 (Esc)' : '宽屏专注展开：看清完整梯形图，不用左右滑动'}
            >
              {focusWide ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              {focusWide ? '退出宽屏' : '宽屏专注'}
            </button>
            <Link to={`/sim?preset=${encodeURIComponent(props.preset)}`} className="btn btn-sm">
              全屏打开
              <ExternalLink size={13} />
            </Link>
          </div>
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

        <SimQuickBetStrip preset={props.preset} />

        <div className="embedded-stage-body">
          {Comp ? (
            <ErrorBoundary compact title="内嵌 PLC 仿真器暂时无法加载">
              <Comp embedded={!focusWide} />
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
        <Link to={`/workflows?wf=${encodeURIComponent(props.id)}`} className="btn btn-sm">
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
