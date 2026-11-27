import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Cpu,
  ExternalLink,
  FileCode2,
  FileSpreadsheet,
  FolderKanban,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { examples, modelRegistry, simPresets } from '../../registry';
import { useProgress } from '../store/progressStore';
import { IoTable } from '../../components/IoTable';
import { CodeViewer } from '../../components/CodeViewer';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { renderInline } from '../../components/MarkdownRenderer';
import {
  buildTiaIoCsvFile,
  buildTiaSclFile,
  EXAMPLE_META_MAP,
  FAT_STEP_TITLES,
  loadFatChecklistMap,
  saveFatChecklistForExample,
  triggerTextDownload,
} from '../../content/examples/engineeringPack';
import './examples-v3.css';

const EMPTY_FAT: boolean[] = [false, false, false, false, false];

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
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const [fatChecks, setFatChecks] = useState<boolean[]>(EMPTY_FAT);

  useEffect(() => {
    if (example) {
      markExampleVisited(example.id);
      setRightStage(hasModel ? 'model' : 'sim');
      const saved = loadFatChecklistMap()[example.id];
      setFatChecks(
        Array.isArray(saved) && saved.length === FAT_STEP_TITLES.length ? saved : EMPTY_FAT
      );
      setDownloadToast(null);
    }
  }, [example, hasModel, markExampleVisited]);

  useEffect(() => {
    if (!downloadToast) return;
    const t = window.setTimeout(() => setDownloadToast(null), 4500);
    return () => window.clearTimeout(t);
  }, [downloadToast]);

  const handleDownloadScl = useCallback(() => {
    if (!example) return;
    const { filename, content } = buildTiaSclFile(example);
    triggerTextDownload(filename, content, 'text/plain;charset=utf-8');
    setDownloadToast(`已下载博途外部源文件 ${filename}（在 TIA Portal 外部源文件导入即可生成块）`);
  }, [example]);

  const handleDownloadCsv = useCallback(() => {
    if (!example) return;
    const { filename, content } = buildTiaIoCsvFile(example);
    triggerTextDownload(filename, content, 'text/csv;charset=utf-8');
    setDownloadToast(`已下载标准 I/O 变量表 ${filename}（含 UTF-8 BOM，Excel 与博途打开中文零乱码）`);
  }, [example]);

  const toggleFatStep = useCallback(
    (stepIdx: number) => {
      if (!example) return;
      setFatChecks((prev) => {
        const next = prev.map((v, i) => (i === stepIdx ? !v : v));
        saveFatChecklistForExample(example.id, next);
        return next;
      });
    },
    [example]
  );

  const resetFatSteps = useCallback(() => {
    if (!example) return;
    setFatChecks(EMPTY_FAT);
    saveFatChecklistForExample(example.id, EMPTY_FAT);
  }, [example]);

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

  const fatFocus = EXAMPLE_META_MAP[example.id]?.fatFocus;
  const fatDoneCount = fatChecks.filter(Boolean).length;
  const fatPct = Math.round((fatDoneCount / FAT_STEP_TITLES.length) * 100);
  const safetySkippedWarn =
    (fatChecks[3] || fatChecks[4]) && (!fatChecks[0] || !fatChecks[1] || !fatChecks[2]);

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
            <span className="badge badge-teal badge-mono">工程实例工作台</span>
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

        {/* v3.0 TIA Portal Engineering Delivery Pack */}
        <div className="ex3-delivery-bar" aria-label="博途工程文件一键下载">
          <div className="ex3-delivery-info">
            <span className="ex3-delivery-kicker">
              TIA PORTAL DELIVERY PACK · 工程源文件与标准变量表一键导出
            </span>
            <span className="ex3-delivery-hint">
              支持直接导入西门子博途外部源文件，CSV 内置 UTF-8 BOM 防止 Excel 与 TIA 打开中文注释乱码。
            </span>
          </div>

          <div className="ex3-delivery-actions">
            <button
              type="button"
              className="ex3-dl-btn ex3-dl-btn--primary"
              onClick={handleDownloadScl}
            >
              <FileCode2 size={15} />
              一键下载博途 .scl 源文件
            </button>
            <button type="button" className="ex3-dl-btn" onClick={handleDownloadCsv}>
              <FileSpreadsheet size={15} />
              一键下载 I/O 变量表 .csv (BOM)
            </button>
          </div>

          {downloadToast ? (
            <div className="ex3-dl-toast" role="status" aria-live="polite">
              <CheckCircle2 size={15} />
              <span>{downloadToast}</span>
            </div>
          ) : null}
        </div>
      </header>

      {/* Dual-Column Industrial Workbench */}
      <div className="example-detail-grid">
        {/* LEFT COLUMN: Process Requirements, I/O Allocation, FAT Checklist, Pitfalls, Interview Points */}
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

          {/* v3.0 Interactive 5-Step FAT Commissioning Safety Checklist */}
          <section className="workbench-panel" aria-label="现场上电调试五步安全点检表">
            <div className="ex3-fat-head">
              <h2 className="workbench-panel-title" style={{ margin: 0 }}>
                <ShieldCheck size={17} color="var(--power-green)" />
                现场上电调试五步安全点检表 (FAT Checklist)
              </h2>
              <div className="ex3-fat-meta">
                <span className="ex3-fat-count">
                  {fatDoneCount} / {FAT_STEP_TITLES.length} 步
                </span>
                {fatDoneCount > 0 ? (
                  <button type="button" className="ex3-fat-reset" onClick={resetFatSteps}>
                    <RotateCcw size={12} />
                    重置
                  </button>
                ) : null}
              </div>
            </div>

            <div className="ex3-fat-bar" aria-hidden="true">
              <div className="ex3-fat-bar-fill" style={{ width: `${fatPct}%` }} />
            </div>

            <div className="ex3-fat-list">
              {FAT_STEP_TITLES.map((step, idx) => {
                const done = Boolean(fatChecks[idx]);
                const detail = fatFocus?.[idx] ?? '按标准西门子现场调试规程逐项验电、核对信号与安全联锁。';
                return (
                  <button
                    key={step.code}
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    className={`ex3-fat-item ${done ? 'is-done' : ''}`}
                    onClick={() => toggleFatStep(idx)}
                  >
                    <span className="ex3-fat-check" aria-hidden="true">
                      <Check size={14} strokeWidth={3} />
                    </span>
                    <div className="ex3-fat-body">
                      <div className="ex3-fat-row-top">
                        <span className="ex3-fat-code">{step.code}</span>
                        <span className="ex3-fat-name">{step.name}</span>
                        {step.safetyCritical ? (
                          <span className="ex3-fat-safety-tag">安全必检</span>
                        ) : null}
                      </div>
                      <span className="ex3-fat-desc">{detail}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {safetySkippedWarn ? (
              <div className="ex3-fat-warn" role="alert">
                <AlertTriangle size={15} color="var(--alarm-amber)" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  安全规程提示：现场上电调试必须先完成 Step 01~03（绝缘/极性、I/O 对点、急停与硬互锁验证），严禁跳过安全前置项直接空载或带载试车！
                </span>
              </div>
            ) : null}

            {fatDoneCount === FAT_STEP_TITLES.length ? (
              <div className="ex3-fat-pass" role="status">
                <CheckCircle2 size={16} />
                <span>FAT 五步安全点检已全部通过（进度已自动保存至本机）</span>
              </div>
            ) : null}
          </section>

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
