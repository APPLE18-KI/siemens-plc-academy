import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  BriefcaseBusiness,
  ChevronRight,
  ClipboardList,
  Cpu,
  ExternalLink,
  FolderKanban,
  Sparkles,
} from 'lucide-react';
import { examples, modelRegistry, simPresets } from '../../registry';
import { useProgress } from '../store/progressStore';
import { IoTable } from '../../components/IoTable';
import { CodeViewer } from '../../components/CodeViewer';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { renderInline } from '../../components/MarkdownRenderer';

export const ExampleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { markExampleVisited } = useProgress();

  const safeExamples = useMemo(() => (Array.isArray(examples) ? examples : []), []);
  const currentIndex = useMemo(
    () => safeExamples.findIndex((ex) => ex.id === id),
    [safeExamples, id]
  );
  const example = currentIndex >= 0 ? safeExamples[currentIndex] : null;
  const prevEx = currentIndex > 0 ? safeExamples[currentIndex - 1] : null;
  const nextEx =
    currentIndex >= 0 && currentIndex < safeExamples.length - 1
      ? safeExamples[currentIndex + 1]
      : null;

  const hasModel = Boolean(example?.linkedModelId && modelRegistry?.[example.linkedModelId]);
  const hasSim = Boolean(example?.linkedSimPreset && simPresets?.[example.linkedSimPreset]);

  const [rightStage, setRightStage] = useState<'model' | 'sim'>('model');

  useEffect(() => {
    if (example) {
      markExampleVisited(example.id);
      setRightStage(hasModel ? 'model' : 'sim');
    }
  }, [example, hasModel, markExampleVisited]);

  if (!example) {
    return (
      <div className="spa-container" style={{ padding: '48px 24px' }}>
        <div className="empty-state-card">
          <FolderKanban size={32} color="var(--siemens-teal)" />
          <h3>{safeExamples.length === 0 ? '工业实例正在装配中' : '未找到该工业实例'}</h3>
          <p>
            {safeExamples.length === 0
              ? '工业实例数据尚未填入，请稍后刷新或先探索数字孪生与 PLC 仿真台。'
              : `未找到标识为 "${id}" 的工业工程案例。`}
          </p>
          <Link to="/examples" className="btn btn-primary btn-sm">
            返回工业实例大厅
          </Link>
        </div>
      </div>
    );
  }

  const modelEntry = example.linkedModelId ? modelRegistry?.[example.linkedModelId] : undefined;
  const simEntry = example.linkedSimPreset ? simPresets?.[example.linkedSimPreset] : undefined;
  const ModelComp = modelEntry?.Component;
  const SimComp = simEntry?.Component;
  const activeStage: 'model' | 'sim' =
    rightStage === 'model' && ModelComp ? 'model' : SimComp ? 'sim' : 'model';

  return (
    <div className="example-workbench-page">
      <nav className="reader-breadcrumb" aria-label="面包屑">
        <Link to="/examples">工业实例大厅</Link>
        <ChevronRight size={14} />
        <span>{example.industry}</span>
        <ChevronRight size={14} />
        <span style={{ color: 'var(--ink-primary)', fontWeight: 600 }}>{example.title}</span>
      </nav>

      {/* Top Engineering Case Header */}
      <header className="example-detail-header">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span className="badge badge-teal badge-mono">INDUSTRIAL WORKBENCH</span>
            <span className="badge badge-amber">{example.difficulty}</span>
            <span className="badge">{example.industry}</span>
            <span className="badge badge-mono" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
              {example.hardware}
            </span>
          </div>
          <Link to="/examples" className="btn btn-sm">
            <ArrowLeft size={14} />
            返回全部实例
          </Link>
        </div>

        <h1 className="reader-title" style={{ marginBottom: 6 }}>
          {example.title}
        </h1>
        <p className="reader-subtitle" style={{ marginBottom: 14 }}>
          {example.subtitle} — {example.summary}
        </p>

        {example.highlights && example.highlights.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {example.highlights.map((hl, idx) => (
              <span key={idx} className="badge badge-teal">
                <Sparkles size={11} />
                {hl}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Dual-Column Industrial Workbench */}
      <div className="example-detail-grid">
        {/* LEFT COLUMN: Process Requirements, I/O Allocation, Pitfalls, Interview Points */}
        <div style={{ minWidth: 0 }}>
          <section className="workbench-panel">
            <h2 className="workbench-panel-title">
              <ClipboardList size={17} color="var(--siemens-teal-bright)" />
              控制工艺要求 (Control Specification)
            </h2>
            <ol className="spec-list">
              {(example.controlRequirements || []).map((req, idx) => (
                <li key={idx}>
                  <span className="spec-num">{String(idx + 1).padStart(2, '0')}</span>
                  <span>{renderInline(req, `req-${idx}`)}</span>
                </li>
              ))}
            </ol>
          </section>

          <IoTable title="标准 PLC I/O 分配表 (TIA Portal PLC Tags)" tags={example.ioTags} />

          {example.pitfalls && example.pitfalls.length > 0 && (
            <section className="workbench-panel">
              <h2 className="workbench-panel-title">
                <AlertTriangle size={17} color="var(--alarm-amber)" />
                现场调试踩坑警示 ({example.pitfalls.length} 条实战教训)
              </h2>
              <div className="pitfall-list">
                {example.pitfalls.map((pit, idx) => (
                  <div key={idx} className="pitfall-item">
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--alarm-amber)',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      WARN {idx + 1}
                    </span>
                    <span>{renderInline(pit, `pit-${idx}`)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {example.interviewPoints && example.interviewPoints.length > 0 && (
            <section className="workbench-panel">
              <h2 className="workbench-panel-title">
                <BriefcaseBusiness size={17} color="var(--siemens-teal-bright)" />
                面试高频追问考点 ({example.interviewPoints.length} 题)
              </h2>
              <div className="pitfall-list">
                {example.interviewPoints.map((pt, idx) => (
                  <div key={idx} className="interview-point-item">
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--siemens-teal-bright)',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      Q{idx + 1}
                    </span>
                    <span>{renderInline(pt, `qa-${idx}`)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT COLUMN: Live Digital Twin / Sim Stage + Complete LAD/SCL Source Reader */}
        <div style={{ minWidth: 0 }}>
          {(hasModel || hasSim) && (
            <section className="embedded-stage-card" style={{ marginTop: 0 }}>
              <div className="embedded-stage-head">
                <div className="embedded-stage-title-wrap">
                  <span className="embedded-stage-kicker">
                    {activeStage === 'model' ? <Boxes size={13} /> : <Cpu size={13} />}
                    {activeStage === 'model'
                      ? `实时数字孪生联调 · ${example.linkedModelId}`
                      : `实时 PLC 仿真预设 · ${example.linkedSimPreset}`}
                  </span>
                  <span className="embedded-stage-title">
                    {activeStage === 'model'
                      ? modelEntry?.title || '2.5D 工业数字孪生模型'
                      : simEntry?.title || 'PLC 实时扫描仿真器'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {hasModel && hasSim && (
                    <div className="code-mode-tabs">
                      <button
                        type="button"
                        className={`code-mode-tab${activeStage === 'model' ? ' active' : ''}`}
                        onClick={() => setRightStage('model')}
                      >
                        数字孪生
                      </button>
                      <button
                        type="button"
                        className={`code-mode-tab${activeStage === 'sim' ? ' active' : ''}`}
                        onClick={() => setRightStage('sim')}
                      >
                        PLC 仿真
                      </button>
                    </div>
                  )}

                  {activeStage === 'model' && example.linkedModelId ? (
                    <Link
                      to={`/models?model=${encodeURIComponent(example.linkedModelId)}`}
                      className="btn btn-sm"
                    >
                      全屏模型
                      <ExternalLink size={13} />
                    </Link>
                  ) : example.linkedSimPreset ? (
                    <Link
                      to={`/sim?preset=${encodeURIComponent(example.linkedSimPreset)}`}
                      className="btn btn-sm"
                    >
                      全屏仿真
                      <ExternalLink size={13} />
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="embedded-stage-body">
                {activeStage === 'model' && ModelComp ? (
                  <ErrorBoundary compact title="内嵌数字孪生模型运行异常">
                    <ModelComp embedded />
                  </ErrorBoundary>
                ) : SimComp ? (
                  <ErrorBoundary compact title="内嵌 PLC 仿真器运行异常">
                    <SimComp embedded />
                  </ErrorBoundary>
                ) : null}
              </div>
            </section>
          )}

          {/* LAD / SCL Dual Source Code Reader */}
          <CodeViewer
            mode="dual"
            title="完整工程控制源码（LAD 梯形图 ⇄ SCL 结构化语言）"
            lad={example.ladDiagramText}
            scl={example.sclCode}
            defaultView="lad"
            caption="提示：可点击右上角切换 LAD / SCL 单栏精读或并排对照视图，并一键复制至 TIA Portal。"
          />
        </div>
      </div>

      {/* Prev / Next Example Navigation */}
      <nav className="lesson-nav-grid" style={{ marginTop: 28 }} aria-label="切换工业实例">
        {prevEx ? (
          <Link to={`/examples/${prevEx.id}`} className="lesson-nav-card">
            <span className="lesson-nav-dir">
              <ArrowLeft size={13} />
              上一个实例 · {prevEx.industry}
            </span>
            <span className="lesson-nav-name">{prevEx.title}</span>
          </Link>
        ) : (
          <Link to="/examples" className="lesson-nav-card">
            <span className="lesson-nav-dir">
              <ArrowLeft size={13} />
              实例大厅
            </span>
            <span className="lesson-nav-name">返回全部工业实例</span>
          </Link>
        )}

        {nextEx ? (
          <Link to={`/examples/${nextEx.id}`} className="lesson-nav-card next">
            <span className="lesson-nav-dir">
              下一个实例 · {nextEx.industry}
              <ArrowRight size={13} />
            </span>
            <span className="lesson-nav-name">{nextEx.title}</span>
          </Link>
        ) : (
          <Link
            to="/capstone"
            className="lesson-nav-card next"
            style={{ borderColor: 'var(--alarm-amber-border)' }}
          >
            <span className="lesson-nav-dir" style={{ color: 'var(--alarm-amber)' }}>
              综合实战升级
              <ArrowRight size={13} />
            </span>
            <span className="lesson-nav-name">挑战简历毕业大项目 ★</span>
          </Link>
        )}
      </nav>
    </div>
  );
};
