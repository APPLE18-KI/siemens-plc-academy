import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Award,
  Code2,
  Cpu,
  FileCode2,
  MonitorPlay,
  Network,
  Sparkles,
} from 'lucide-react';
import { CODING_CHALLENGES, INTERVIEW_QUESTIONS } from './data/projectData';
import { ArchitectureTab } from './tabs/ArchitectureTab';
import { ChallengesTab } from './tabs/ChallengesTab';
import { ScadaTwinTab } from './tabs/ScadaTwinTab';
import { SourceBrowserTab } from './tabs/SourceBrowserTab';
import { ResumeInterviewTab } from './tabs/ResumeInterviewTab';
import './capstone.css';

type CapstoneTabId = 'arch' | 'challenges' | 'scada' | 'source' | 'resume';

const VALID_TAB_IDS: ReadonlySet<string> = new Set<CapstoneTabId>([
  'arch',
  'challenges',
  'scada',
  'source',
  'resume',
]);

function parseTabParam(value: string | null): CapstoneTabId {
  if (value && VALID_TAB_IDS.has(value)) {
    return value as CapstoneTabId;
  }
  return 'scada';
}

const STORAGE_KEY = 'siemens_plc_academy_capstone_v1';

interface CapstoneProgress {
  passedChallenges: string[];
  masteredQaIds: number[];
  scadaRunCompleted: boolean;
}

function loadProgress(): CapstoneProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CapstoneProgress>;
      return {
        passedChallenges: Array.isArray(parsed.passedChallenges) ? parsed.passedChallenges : [],
        masteredQaIds: Array.isArray(parsed.masteredQaIds) ? parsed.masteredQaIds : [],
        scadaRunCompleted: Boolean(parsed.scadaRunCompleted),
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return { passedChallenges: [], masteredQaIds: [], scadaRunCompleted: false };
}

const TABS: Array<{
  id: CapstoneTabId;
  num: string;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'arch', num: '第 1 部分', label: '架构拓扑与报文 1 实验台', icon: <Network size={17} /> },
  { id: 'challenges', num: '第 2 部分', label: '5 关 SCL 实战闯关台', icon: <Code2 size={17} /> },
  { id: 'scada', num: '第 3 部分', label: 'WinCC 监控画面联调', icon: <MonitorPlay size={17} /> },
  { id: 'source', num: '第 4 部分', label: 'TIA Portal 源码导出', icon: <FileCode2 size={17} /> },
  { id: 'resume', num: '第 5 部分', label: '简历写法与模拟面试', icon: <Sparkles size={17} /> },
];

export const CapstoneStudio: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: CapstoneTabId = parseTabParam(searchParams.get('tab'));
  const [progress, setProgress] = useState<CapstoneProgress>(loadProgress);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Ignore storage quota errors
    }
  }, [progress]);

  const handleSelectTab = (tabId: CapstoneTabId) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tabId);
    setSearchParams(next, { replace: true });
  };

  const handlePassChallenge = (id: string) => {
    setProgress((prev) =>
      prev.passedChallenges.includes(id)
        ? prev
        : { ...prev, passedChallenges: [...prev.passedChallenges, id] }
    );
  };

  const handleToggleMasteredQa = (id: number) => {
    setProgress((prev) => ({
      ...prev,
      masteredQaIds: prev.masteredQaIds.includes(id)
        ? prev.masteredQaIds.filter((x) => x !== id)
        : [...prev.masteredQaIds, id],
    }));
  };

  const handleScadaMilestone = () => {
    setProgress((prev) => (prev.scadaRunCompleted ? prev : { ...prev, scadaRunCompleted: true }));
  };

  // Weighted graduation readiness score (5 challenges = 50%, SCADA run = 20%, 15 QAs = 30%)
  const challengeScore = (progress.passedChallenges.length / CODING_CHALLENGES.length) * 50;
  const scadaScore = progress.scadaRunCompleted ? 20 : 0;
  const qaScore = (progress.masteredQaIds.length / INTERVIEW_QUESTIONS.length) * 30;
  const graduationPct = Math.round(challengeScore + scadaScore + qaScore);

  return (
    <div className="cap-root">
      <div className="cap-container">
        {/* Graduation Capstone Hero Banner */}
        <header className="cap-hero">
          <div style={{ minWidth: 0 }}>
            <div className="cap-kicker">
              <Cpu size={14} /> 简历级工业毕业大项目实训工坊 · SIMATIC S7-1215C + PROFINET
            </div>
            <h1>新能源锂电模组柔性视觉分拣、热压恒温固化与立体入库工作站</h1>
            <p>
              涵盖 PROFINET 实时组网（G120 标准报文 1 / V90 / ET200SP / TP700 / 智能视觉）、PackML + GRAFCET 双层状态机、
              OB30 PID 恒温闭环与超温回差联锁、4×3 立体库掉电保持算法、可一键导出导入 TIA Portal（V17+）的{' '}
              <code className="md-inline-code">.scl</code> 工程包，以及 STAR 简历生成器与 15 道模拟面试抽题自测。
            </p>
          </div>

          <div className="cap-hero-stats">
            <div className="cap-stat-pill">
              <div className="cap-stat-label">SCL 实战闯关</div>
              <div className="cap-stat-val">
                {progress.passedChallenges.length} / {CODING_CHALLENGES.length}
              </div>
            </div>
            <div className="cap-stat-pill">
              <div className="cap-stat-label">面试题掌握</div>
              <div className="cap-stat-val">
                {progress.masteredQaIds.length} / {INTERVIEW_QUESTIONS.length}
              </div>
            </div>
            <div className="cap-stat-pill">
              <div className="cap-stat-label">毕业认证达成度</div>
              <div className="cap-stat-val" style={{ color: graduationPct >= 80 ? '#10b981' : '#14b8a6' }}>
                <Award size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                {graduationPct}%
              </div>
            </div>
          </div>
        </header>

        {/* 5 Core Workbench Tabs (URL synced via ?tab=arch|challenges|scada|source|resume) */}
        <nav className="cap-tabs" role="tablist" aria-label="毕业大项目 5 大核心工作台">
          {TABS.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`cap-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleSelectTab(t.id)}
              >
                <span className="cap-tab-icon">{t.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="cap-tab-num">{t.num}</div>
                  <div className="cap-tab-name">{t.label}</div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Active Tab Workspace */}
        <main>
          {activeTab === 'arch' && <ArchitectureTab />}
          {activeTab === 'challenges' && (
            <ChallengesTab
              passedIds={progress.passedChallenges}
              onPassChallenge={handlePassChallenge}
            />
          )}
          {activeTab === 'scada' && <ScadaTwinTab onMilestoneAchieved={handleScadaMilestone} />}
          {activeTab === 'source' && <SourceBrowserTab />}
          {activeTab === 'resume' && (
            <ResumeInterviewTab
              masteredQaIds={progress.masteredQaIds}
              onToggleMasteredQa={handleToggleMasteredQa}
            />
          )}
        </main>
      </div>
    </div>
  );
};
