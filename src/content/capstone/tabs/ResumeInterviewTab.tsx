import React, { useMemo, useState } from 'react';
import {
  Award,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  HelpCircle,
  Search,
  Sparkles,
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
  const [format, setFormat] = useState<'markdown' | 'plain'>('markdown');
  const [copiedResume, setCopiedResume] = useState<boolean>(false);

  // Interview Bank States
  const [qaCat, setQaCat] = useState<'全部' | InterviewQuestion['category']>('全部');
  const [qaSearch, setQaSearch] = useState<string>('');
  const [openQaIds, setOpenQaIds] = useState<number[]>([1, 2, 3]);

  const resumeText = useMemo(
    () =>
      generateStarResume({
        role,
        level,
        includeProfinet,
        includePackml,
        includePid,
        includeRetain,
        format,
      }),
    [role, level, includeProfinet, includePackml, includePid, includeRetain, format]
  );

  const handleCopyResume = async () => {
    try {
      await navigator.clipboard.writeText(resumeText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = resumeText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedResume(true);
    window.setTimeout(() => setCopiedResume(false), 2000);
  };

  const filteredQuestions = useMemo(() => {
    const q = qaSearch.trim().toLowerCase();
    return INTERVIEW_QUESTIONS.filter((item) => {
      const catOk = qaCat === '全部' || item.category === qaCat;
      const textOk =
        !q ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.intent.toLowerCase().includes(q);
      return catOk && textOk;
    });
  }, [qaCat, qaSearch]);

  const toggleOpenQa = (id: number) => {
    setOpenQaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const expandAll = () => setOpenQaIds(filteredQuestions.map((q) => q.id));
  const collapseAll = () => setOpenQaIds([]);

  return (
    <div>
      {/* Part 1: STAR Method Resume Project Description Generator */}
      <section className="cap-panel">
        <div className="cap-panel-head">
          <h2 className="cap-panel-title">
            <Sparkles size={18} color="#14b8a6" /> STAR 法则简历「项目经历」黄金三段式生成器
          </h2>
          <span className="cap-badge green">一键定制 · 直接粘贴进简历作品集</span>
        </div>

        <div className="cap-resume-grid">
          {/* Left Configuration Form */}
          <div
            style={{
              background: 'var(--cap-bg)',
              border: '1px solid var(--cap-border)',
              borderRadius: 12,
              padding: 15,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Briefcase size={14} color="#14b8a6" /> 1. 选择你的目标求职岗位：
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
                2. 选择你的个人掌握深度（实事求是匹配面试追问强度）：
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
                3. 勾选你要写入简历的核心技术卖点：
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, fontSize: 12.5 }}>
                {[
                  { label: 'PROFINET + G120/V90 报文', checked: includeProfinet, toggle: () => setIncludeProfinet((v) => !v) },
                  { label: 'PackML + GRAFCET + 多重背景 FB', checked: includePackml, toggle: () => setIncludePackml((v) => !v) },
                  { label: 'OB30 PID 温控 + 超温回差联锁', checked: includePid, toggle: () => setIncludePid((v) => !v) },
                  { label: 'RETAIN 掉电保持 + WinCC SCADA', checked: includeRetain, toggle: () => setIncludeRetain((v) => !v) },
                ].map((item) => (
                  <label
                    key={item.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '7px 9px',
                      borderRadius: 8,
                      background: 'var(--cap-panel)',
                      border: '1px solid var(--cap-border)',
                      cursor: 'pointer',
                    }}
                  >
                    <input type="checkbox" checked={item.checked} onChange={item.toggle} />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right Live Generated STAR Resume Preview */}
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className={`cap-btn ${format === 'markdown' ? 'primary' : ''}`}
                  onClick={() => setFormat('markdown')}
                >
                  <FileText size={13} /> Markdown 格式
                </button>
                <button
                  type="button"
                  className={`cap-btn ${format === 'plain' ? 'primary' : ''}`}
                  onClick={() => setFormat('plain')}
                >
                  纯文本格式 (Word/BOSS直聘)
                </button>
              </div>
              <button type="button" className="cap-btn success" onClick={handleCopyResume}>
                {copiedResume ? <Check size={14} /> : <Copy size={14} />}
                {copiedResume ? '已复制到剪贴板！' : '一键复制进简历'}
              </button>
            </div>

            <div className="cap-resume-preview">{resumeText}</div>
          </div>
        </div>
      </section>

      {/* Part 2: 15 High-Frequency Technical Interview Questions */}
      <section className="cap-panel">
        <div className="cap-panel-head">
          <h2 className="cap-panel-title">
            <HelpCircle size={18} color="#14b8a6" /> 15 道面试官针对本项目必追问灵魂拷问题库（含考察意图与满分话术）
          </h2>
          <span className={`cap-badge ${masteredQaIds.length === 15 ? 'green' : 'amber'}`}>
            <Award size={13} /> 已吃透背熟：{masteredQaIds.length} / {INTERVIEW_QUESTIONS.length} 题
          </span>
        </div>

        {/* Category Filter & Search */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {QA_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`cap-btn ${qaCat === cat ? 'primary' : ''}`}
                style={{ padding: '5px 10px', fontSize: 12 }}
                onClick={() => setQaCat(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: 9, color: '#94a3b8' }} />
              <input
                type="text"
                className="cap-input"
                style={{ paddingLeft: 28, width: 200 }}
                placeholder="搜关键词 (如 OB30/报文/急停)..."
                value={qaSearch}
                onChange={(e) => setQaSearch(e.target.value)}
              />
            </div>
            <button type="button" className="cap-btn" style={{ padding: '5px 10px', fontSize: 12 }} onClick={expandAll}>
              全部展开
            </button>
            <button type="button" className="cap-btn" style={{ padding: '5px 10px', fontSize: 12 }} onClick={collapseAll}>
              全部收起
            </button>
          </div>
        </div>

        {/* Q&A Accordion List */}
        <div>
          {filteredQuestions.map((qa) => {
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
                      <strong>🎯 面试官考察意图：</strong>
                      {renderInline(qa.intent, `qai-${qa.id}`)}
                    </div>
                    <div className="cap-answer-box">
                      <strong>🏆 满分回答话术（建议结合源码自然复述）：</strong>
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
      </section>
    </div>
  );
};
