import React, { useMemo, useState } from 'react';
import {
  Award,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  Copy,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  ListChecks,
  Search,
  Shuffle,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  INTERVIEW_QUESTIONS,
  generateStarResume,
  type InterviewQuestion,
  type MasteryLevel,
  type TargetRole,
} from '../data/projectData';
import { MarkdownRenderer, renderInline } from '../../../components/MarkdownRenderer';

interface ResumeInterviewTabProps {
  masteredQaIds: number[];
  onToggleMasteredQa: (id: number) => void;
}

const ROLE_OPTIONS: Array<{ id: TargetRole; label: string; desc: string }> = [
  { id: 'plc-engineer', label: 'PLC 电气自动化工程师', desc: '博途模块化 / 驱动报文 / PID 与现场联调' },
  { id: 'nonstandard-control', label: '非标设备控制工程师', desc: 'URS 节拍 / PackML 框架 / 快速复用交付' },
  { id: 'smart-mfg-trainee', label: '智能制造 / 产线自动化管培生', desc: 'OT/IT 条码追溯 / WinCC 看板 / OEE 与 FDS' },
];

const LEVEL_OPTIONS: Array<{ id: MasteryLevel; label: string }> = [
  { id: 'solid', label: '独立完成核心模块' },
  { id: 'proficient', label: '主导整站设计与联调' },
  { id: 'lead', label: '统筹标准化架构落地' },
];

const QA_CATEGORIES: Array<'全部' | InterviewQuestion['category']> = [
  '全部',
  'PLC架构与FB',
  'PROFINET与伺服',
  'PID温控与中断',
  '安全联锁与排错',
  '数据保持与交付',
];

function shuffleNumbers(ids: number[]): number[] {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function copyTextSafe(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

export const ResumeInterviewTab: React.FC<ResumeInterviewTabProps> = ({
  masteredQaIds,
  onToggleMasteredQa,
}) => {
  // Resume Generator States
  const [role, setRole] = useState<TargetRole>('plc-engineer');
  const [level, setLevel] = useState<MasteryLevel>('proficient');
  const [includeProfinet, setIncludeProfinet] = useState<boolean>(true);
  const [includePackml, setIncludePackml] = useState<boolean>(true);
  const [includePid, setIncludePid] = useState<boolean>(true);
  const [includeRetain, setIncludeRetain] = useState<boolean>(true);
  const [previewFormat, setPreviewFormat] = useState<'markdown' | 'plain'>('markdown');
  const [copiedFormat, setCopiedFormat] = useState<'markdown' | 'plain' | null>(null);

  // Interview Section Mode ('mock' self-test vs 'bank' full catalog)
  const [qaMode, setQaMode] = useState<'mock' | 'bank'>('mock');
  const [qaCat, setQaCat] = useState<'全部' | InterviewQuestion['category']>('全部');
  const [qaSearch, setQaSearch] = useState<string>('');
  const [openQaIds, setOpenQaIds] = useState<number[]>([1, 2]);

  // Mock Technical Interview Self-Test States
  const [drawMode, setDrawMode] = useState<'sequential' | 'random'>('sequential');
  const [deckIds, setDeckIds] = useState<number[]>(() => INTERVIEW_QUESTIONS.map((q) => q.id));
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [revealedMap, setRevealedMap] = useState<Record<number, boolean>>({});
  const [checkedPointsMap, setCheckedPointsMap] = useState<Record<number, boolean[]>>({});
  const [draftNotesMap, setDraftNotesMap] = useState<Record<number, string>>({});
  const [showKeywordHints, setShowKeywordHints] = useState<boolean>(true);

  const resumeMarkdown = useMemo(
    () =>
      generateStarResume({
        role,
        level,
        includeProfinet,
        includePackml,
        includePid,
        includeRetain,
        format: 'markdown',
      }),
    [role, level, includeProfinet, includePackml, includePid, includeRetain]
  );

  const resumePlain = useMemo(
    () =>
      generateStarResume({
        role,
        level,
        includeProfinet,
        includePackml,
        includePid,
        includeRetain,
        format: 'plain',
      }),
    [role, level, includeProfinet, includePackml, includePid, includeRetain]
  );

  const handleCopyResumeFormat = async (fmt: 'markdown' | 'plain') => {
    const content = fmt === 'markdown' ? resumeMarkdown : resumePlain;
    await copyTextSafe(content);
    setPreviewFormat(fmt);
    setCopiedFormat(fmt);
    window.setTimeout(() => setCopiedFormat((curr) => (curr === fmt ? null : curr)), 2200);
  };

  // Filtered questions for Bank view & Mock deck generation
  const categoryQuestions = useMemo(
    () => INTERVIEW_QUESTIONS.filter((q) => qaCat === '全部' || q.category === qaCat),
    [qaCat]
  );

  const filteredBankQuestions = useMemo(() => {
    const q = qaSearch.trim().toLowerCase();
    return categoryQuestions.filter((item) => {
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.intent.toLowerCase().includes(q) ||
        item.scoringPoints.some(
          (sp) => sp.point.toLowerCase().includes(q) || sp.keywordHint.toLowerCase().includes(q)
        )
      );
    });
  }, [categoryQuestions, qaSearch]);

  // Rebuild mock deck when category or draw mode changes
  const rebuildDeck = (
    nextCat: '全部' | InterviewQuestion['category'],
    nextDraw: 'sequential' | 'random'
  ) => {
    const ids = INTERVIEW_QUESTIONS.filter((q) => nextCat === '全部' || q.category === nextCat).map(
      (q) => q.id
    );
    setDeckIds(nextDraw === 'random' ? shuffleNumbers(ids) : ids);
    setCurrentIdx(0);
  };

  const handleSelectCategory = (cat: '全部' | InterviewQuestion['category']) => {
    setQaCat(cat);
    rebuildDeck(cat, drawMode);
  };

  const handleSelectDrawMode = (mode: 'sequential' | 'random') => {
    setDrawMode(mode);
    rebuildDeck(qaCat, mode);
  };

  const handleReshuffle = () => {
    const ids = categoryQuestions.map((q) => q.id);
    setDrawMode('random');
    setDeckIds(shuffleNumbers(ids));
    setCurrentIdx(0);
  };

  const activeMockQuestion: InterviewQuestion = useMemo(() => {
    const safeIdx = Math.min(currentIdx, Math.max(0, deckIds.length - 1));
    const qid = deckIds[safeIdx];
    return INTERVIEW_QUESTIONS.find((q) => q.id === qid) ?? INTERVIEW_QUESTIONS[0];
  }, [deckIds, currentIdx]);

  const activeChecked = checkedPointsMap[activeMockQuestion.id] ?? [false, false, false];
  const activeHitCount = activeChecked.filter(Boolean).length;
  const activeRevealed = Boolean(revealedMap[activeMockQuestion.id]);
  const activeIsMastered = masteredQaIds.includes(activeMockQuestion.id);

  const toggleScoringPoint = (qid: number, idx: number) => {
    setCheckedPointsMap((prev) => {
      const curr = prev[qid] ? [...prev[qid]] : [false, false, false];
      curr[idx] = !curr[idx];
      return { ...prev, [qid]: curr };
    });
  };

  const toggleRevealAnswer = (qid: number) => {
    setRevealedMap((prev) => ({ ...prev, [qid]: !prev[qid] }));
  };

  // Session self-test summary stats
  const sessionStats = useMemo(() => {
    const reviewedIds = Object.keys(revealedMap)
      .map(Number)
      .filter((id) => revealedMap[id]);
    const totalChecked = reviewedIds.reduce((sum, id) => {
      const arr = checkedPointsMap[id] ?? [false, false, false];
      return sum + arr.filter(Boolean).length;
    }, 0);
    const maxPossible = reviewedIds.length * 3;
    const hitRatePct = maxPossible > 0 ? Math.round((totalChecked / maxPossible) * 100) : 0;
    return {
      reviewedCount: reviewedIds.length,
      hitRatePct,
    };
  }, [revealedMap, checkedPointsMap]);

  const toggleOpenQa = (id: number) => {
    setOpenQaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const expandAll = () => setOpenQaIds(filteredBankQuestions.map((q) => q.id));
  const collapseAll = () => setOpenQaIds([]);

  return (
    <div>
      {/* Part 1: STAR Method Resume Project Description Generator */}
      <section className="cap-panel">
        <div className="cap-panel-head">
          <h2 className="cap-panel-title">
            <Sparkles size={18} color="#14b8a6" /> STAR 简历项目经历生成器（工程实话版）
          </h2>
          <span className="cap-badge green">支持纯文本 + Markdown 双格式一键复制</span>
        </div>

        <div className="cap-resume-grid">
          {/* Left Configuration Form */}
          <div className="cap-resume-config">
            <div>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Briefcase size={14} color="#14b8a6" /> 1. 目标求职岗位：
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`cap-challenge-item ${role === opt.id ? 'active' : ''}`}
                    style={{ padding: '9px 12px' }}
                    onClick={() => setRole(opt.id)}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{opt.label}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--cap-text-muted)', marginTop: 2 }}>
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
                2. 项目参与深度（按实际掌握情况选择，匹配面试追问深度）：
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {LEVEL_OPTIONS.map((lv) => (
                  <button
                    key={lv.id}
                    type="button"
                    className={`cap-btn ${level === lv.id ? 'primary' : ''}`}
                    onClick={() => setLevel(lv.id)}
                  >
                    {lv.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
                3. 写入简历的技术模块：
              </div>
              <div className="cap-resume-checks">
                {[
                  {
                    label: 'PROFINET + G120/V90 报文',
                    checked: includeProfinet,
                    toggle: () => setIncludeProfinet((v) => !v),
                  },
                  {
                    label: 'PackML + GRAFCET + 多重背景 FB',
                    checked: includePackml,
                    toggle: () => setIncludePackml((v) => !v),
                  },
                  {
                    label: 'OB30 PID 温控 + 超温回差联锁',
                    checked: includePid,
                    toggle: () => setIncludePid((v) => !v),
                  },
                  {
                    label: 'RETAIN 掉电保持 + WinCC 监控',
                    checked: includeRetain,
                    toggle: () => setIncludeRetain((v) => !v),
                  },
                ].map((item) => (
                  <label key={item.label} className="cap-check-tile">
                    <input type="checkbox" checked={item.checked} onChange={item.toggle} />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right Live Generated STAR Resume Preview + Dual-Format One-Click Copy */}
          <div style={{ minWidth: 0 }}>
            <div className="cap-resume-toolbar">
              <div className="cap-seg" role="tablist" aria-label="切换预览格式">
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewFormat === 'markdown'}
                  className={`cap-seg-btn ${previewFormat === 'markdown' ? 'active' : ''}`}
                  onClick={() => setPreviewFormat('markdown')}
                >
                  <FileText size={13} /> Markdown 预览
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewFormat === 'plain'}
                  className={`cap-seg-btn ${previewFormat === 'plain' ? 'active' : ''}`}
                  onClick={() => setPreviewFormat('plain')}
                >
                  纯文本预览
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                <button
                  type="button"
                  className={`cap-btn ${copiedFormat === 'markdown' ? 'success' : 'primary'}`}
                  onClick={() => handleCopyResumeFormat('markdown')}
                >
                  {copiedFormat === 'markdown' ? <Check size={14} /> : <Copy size={14} />}
                  {copiedFormat === 'markdown' ? '已复制 Markdown' : '复制 Markdown'}
                </button>
                <button
                  type="button"
                  className={`cap-btn ${copiedFormat === 'plain' ? 'success' : ''}`}
                  onClick={() => handleCopyResumeFormat('plain')}
                >
                  {copiedFormat === 'plain' ? <Check size={14} /> : <Copy size={14} />}
                  {copiedFormat === 'plain' ? '已复制纯文本' : '复制纯文本 (Word/直聘)'}
                </button>
              </div>
            </div>

            <div className="cap-resume-preview">
              {previewFormat === 'markdown' ? resumeMarkdown : resumePlain}
            </div>
          </div>
        </div>
      </section>

      {/* Part 2: Mock Technical Interview Self-Test Mode + 15-Question Bank */}
      <section className="cap-panel">
        <div className="cap-panel-head">
          <h2 className="cap-panel-title">
            <HelpCircle size={18} color="#14b8a6" /> 15 道工程高频追问 · 模拟面试自测与题库
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <div className="cap-seg" role="tablist" aria-label="面试练习模式">
              <button
                type="button"
                role="tab"
                aria-selected={qaMode === 'mock'}
                className={`cap-seg-btn ${qaMode === 'mock' ? 'active' : ''}`}
                onClick={() => setQaMode('mock')}
              >
                <ClipboardCheck size={14} /> 模拟技术面试自测
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={qaMode === 'bank'}
                className={`cap-seg-btn ${qaMode === 'bank' ? 'active' : ''}`}
                onClick={() => setQaMode('bank')}
              >
                <ListChecks size={14} /> 15 题完整题库
              </button>
            </div>
            <span className={`cap-badge ${masteredQaIds.length === 15 ? 'green' : 'amber'}`}>
              <Award size={13} /> 已掌握：{masteredQaIds.length} / {INTERVIEW_QUESTIONS.length}
            </span>
          </div>
        </div>

        {/* Shared Category Filter */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {QA_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`cap-btn ${qaCat === cat ? 'primary' : ''}`}
                style={{ padding: '5px 10px', fontSize: 12 }}
                onClick={() => handleSelectCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {qaMode === 'mock' ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <button
                type="button"
                className={`cap-btn ${drawMode === 'sequential' ? 'primary' : ''}`}
                style={{ padding: '5px 10px', fontSize: 12 }}
                onClick={() => handleSelectDrawMode('sequential')}
              >
                按序抽题
              </button>
              <button
                type="button"
                className={`cap-btn ${drawMode === 'random' ? 'primary' : ''}`}
                style={{ padding: '5px 10px', fontSize: 12 }}
                onClick={handleReshuffle}
              >
                <Shuffle size={13} /> 随机洗牌抽题
              </button>
              <button
                type="button"
                className="cap-btn"
                style={{ padding: '5px 10px', fontSize: 12 }}
                onClick={() => setShowKeywordHints((v) => !v)}
              >
                {showKeywordHints ? <EyeOff size={13} /> : <Eye size={13} />}
                {showKeywordHints ? '隐藏指令提示' : '显示指令提示'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <Search size={14} style={{ position: 'absolute', left: 9, color: '#94a3b8' }} />
                <input
                  type="text"
                  className="cap-input"
                  style={{ paddingLeft: 28, width: 200 }}
                  placeholder="搜关键词 (OB30/报文/急停)..."
                  value={qaSearch}
                  onChange={(e) => setQaSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="cap-btn"
                style={{ padding: '5px 10px', fontSize: 12 }}
                onClick={expandAll}
              >
                全部展开
              </button>
              <button
                type="button"
                className="cap-btn"
                style={{ padding: '5px 10px', fontSize: 12 }}
                onClick={collapseAll}
              >
                全部收起
              </button>
            </div>
          )}
        </div>

        {/* MODE 1: Mock Technical Interview Self-Test Workbench */}
        {qaMode === 'mock' ? (
          <div className="cap-mock-shell">
            {/* Session Telemetry Strip */}
            <div className="cap-mock-telemetry cap-mono">
              <span>
                当前进度: {Math.min(currentIdx + 1, deckIds.length)} / {deckIds.length}
              </span>
              <span>本轮已复盘: {sessionStats.reviewedCount} 题</span>
              <span>
                采分点平均命中:{' '}
                {sessionStats.reviewedCount > 0 ? `${sessionStats.hitRatePct}%` : '待自评'}
              </span>
              <span>抽题方式: {drawMode === 'random' ? '随机不重复' : '按序 Q01→Q15'}</span>
            </div>

            {/* Active Mock Question Card */}
            <div className="cap-mock-card">
              <div className="cap-mock-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="cap-badge teal">
                    Q{String(activeMockQuestion.id).padStart(2, '0')}
                  </span>
                  <span className="cap-badge blue">{activeMockQuestion.category}</span>
                  <span
                    className={`cap-badge ${
                      activeMockQuestion.difficulty === '架构压轴'
                        ? 'red'
                        : activeMockQuestion.difficulty === '深度追问'
                          ? 'amber'
                          : 'green'
                    }`}
                  >
                    {activeMockQuestion.difficulty}
                  </span>
                  {activeIsMastered && <span className="cap-badge green">已掌握</span>}
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="cap-btn"
                    disabled={currentIdx <= 0}
                    onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  >
                    <ChevronLeft size={14} /> 上一题
                  </button>
                  <button
                    type="button"
                    className="cap-btn primary"
                    disabled={currentIdx >= deckIds.length - 1}
                    onClick={() => setCurrentIdx((i) => Math.min(deckIds.length - 1, i + 1))}
                  >
                    下一题 <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <h3 className="cap-mock-question">
                {renderInline(activeMockQuestion.question, `mock-q-${activeMockQuestion.id}`)}
              </h3>

              <div className="cap-intent-box" style={{ marginTop: 10 }}>
                <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Target size={14} /> 面试官考察意图：
                </strong>
                {renderInline(activeMockQuestion.intent, `mock-i-${activeMockQuestion.id}`)}
              </div>

              {/* Self-Answer Notepad */}
              <div style={{ marginTop: 14 }}>
                <label
                  htmlFor={`mock-draft-${activeMockQuestion.id}`}
                  style={{
                    display: 'block',
                    fontSize: 12.5,
                    fontWeight: 700,
                    marginBottom: 6,
                    color: 'var(--cap-text)',
                  }}
                >
                  第一步：先在脑海口述或在此列出你的答题要点（默认隐藏参考答案）：
                </label>
                <textarea
                  id={`mock-draft-${activeMockQuestion.id}`}
                  className="cap-mock-textarea"
                  rows={3}
                  placeholder="例如写下你要提的报文号、寄存器地址、中断 OB 或安全联锁步骤..."
                  value={draftNotesMap[activeMockQuestion.id] ?? ''}
                  onChange={(e) =>
                    setDraftNotesMap((prev) => ({
                      ...prev,
                      [activeMockQuestion.id]: e.target.value,
                    }))
                  }
                />
              </div>

              {/* 3 Scoring Points Self-Checklist */}
              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <strong style={{ fontSize: 12.5 }}>
                    第二步：对照 3 个得分采分点勾选你答出的要点
                  </strong>
                  <span
                    className={`cap-badge ${
                      activeHitCount === 3 ? 'green' : activeHitCount === 2 ? 'teal' : 'amber'
                    }`}
                  >
                    命中 {activeHitCount} / 3 个采分点
                  </span>
                </div>

                <div className="cap-scoring-grid">
                  {activeMockQuestion.scoringPoints.map((sp, spIdx) => {
                    const checked = activeChecked[spIdx];
                    return (
                      <label
                        key={spIdx}
                        className={`cap-scoring-item ${checked ? 'checked' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleScoringPoint(activeMockQuestion.id, spIdx)}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.45 }}>
                            采分点 {spIdx + 1}：{sp.point}
                          </div>
                          {showKeywordHints && (
                            <div className="cap-scoring-hint cap-mono">
                              关键提示：{sp.keywordHint}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Reveal Reference Answer & Mastery Controls */}
              <div className="cap-mock-actions">
                <button
                  type="button"
                  className={`cap-btn ${activeRevealed ? '' : 'primary'}`}
                  onClick={() => toggleRevealAnswer(activeMockQuestion.id)}
                >
                  {activeRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                  {activeRevealed ? '收起参考话术' : '第三步：展开参考话术对照复盘'}
                </button>

                <button
                  type="button"
                  className={`cap-btn ${activeIsMastered ? 'success' : ''}`}
                  onClick={() => onToggleMasteredQa(activeMockQuestion.id)}
                >
                  <CheckCircle2 size={14} />
                  {activeIsMastered ? '已掌握本题（点击取消）' : '标记本题已吃透'}
                </button>
              </div>

              {/* Revealed Reference Answer Panel */}
              {activeRevealed && (
                <div className="cap-answer-box" style={{ marginTop: 14 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircle2 size={15} color="#10b981" /> 参考回答话术（建议结合博途源码自然复述）：
                    </strong>
                    <span
                      className={`cap-badge ${
                        activeHitCount === 3 ? 'green' : activeHitCount === 2 ? 'blue' : 'amber'
                      }`}
                    >
                      {activeHitCount === 3
                        ? '自评：3/3 表达完整，可直接过关'
                        : activeHitCount === 2
                          ? '自评：2/3 基本达标，补齐漏项即可'
                          : `自评：${activeHitCount}/3 建议对照源码再复述一遍`}
                    </span>
                  </div>
                  <MarkdownRenderer content={activeMockQuestion.answer} />
                </div>
              )}
            </div>

            {/* Compact Deck Quick-Jump Matrix */}
            <div className="cap-mock-deck-nav" aria-label="抽题队列导航">
              {deckIds.map((qid, idx) => {
                const isCur = idx === currentIdx;
                const isRev = Boolean(revealedMap[qid]);
                const isMast = masteredQaIds.includes(qid);
                return (
                  <button
                    key={qid}
                    type="button"
                    className={`cap-deck-dot cap-mono ${isCur ? 'current' : ''} ${
                      isMast ? 'mastered' : isRev ? 'reviewed' : ''
                    }`}
                    onClick={() => setCurrentIdx(idx)}
                    title={`跳转至第 ${idx + 1} 题 (Q${String(qid).padStart(2, '0')})`}
                  >
                    Q{String(qid).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* MODE 2: Full 15-Question Accordion Bank */
          <div>
            {filteredBankQuestions.map((qa) => {
              const isOpen = openQaIds.includes(qa.id);
              const isMastered = masteredQaIds.includes(qa.id);
              return (
                <div key={qa.id} className={`cap-qa-card ${isMastered ? 'mastered' : ''}`}>
                  <button
                    type="button"
                    className="cap-qa-header"
                    onClick={() => toggleOpenQa(qa.id)}
                    aria-expanded={isOpen}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="cap-badge teal">Q{String(qa.id).padStart(2, '0')}</span>
                      <span className="cap-badge blue">{qa.category}</span>
                      <span
                        className={`cap-badge ${
                          qa.difficulty === '架构压轴'
                            ? 'red'
                            : qa.difficulty === '深度追问'
                              ? 'amber'
                              : 'green'
                        }`}
                      >
                        {qa.difficulty}
                      </span>
                      <strong style={{ fontSize: 14, lineHeight: 1.4 }}>
                        {renderInline(qa.question, `qaq-${qa.id}`)}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {isMastered && <CheckCircle2 size={16} color="#10b981" />}
                      {isOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="cap-qa-body">
                      <div className="cap-intent-box">
                        <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Target size={14} /> 考察意图：
                        </strong>
                        {renderInline(qa.intent, `qai-${qa.id}`)}
                      </div>
                      <div className="cap-bank-rubric">
                        {qa.scoringPoints.map((sp, i) => (
                          <div key={i} className="cap-bank-rubric-chip">
                            <span style={{ fontWeight: 600 }}>采分点 {i + 1}：</span>
                            <span>{sp.point}</span>
                            <code className="cap-mono" style={{ color: 'var(--cap-blue)', marginLeft: 6 }}>
                              {sp.keywordHint}
                            </code>
                          </div>
                        ))}
                      </div>
                      <div className="cap-answer-box">
                        <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <CheckCircle2 size={14} color="#10b981" /> 参考回答话术：
                        </strong>
                        <div style={{ marginTop: 6 }}>
                          <MarkdownRenderer content={qa.answer} />
                        </div>
                      </div>
                      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className={`cap-btn ${isMastered ? 'success' : ''}`}
                          onClick={() => onToggleMasteredQa(qa.id)}
                        >
                          <CheckCircle2 size={14} />
                          {isMastered ? '已掌握本题（点击取消）' : '标记本题已吃透'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
