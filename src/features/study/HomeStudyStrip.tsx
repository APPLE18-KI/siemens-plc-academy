import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Compass,
  Flame,
  PlayCircle,
  Search,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { lessons } from '../../registry';
import { buildDeck } from './deck';
import { streak, today, useStudy } from './studyStore';
import { useProgress } from '../../app/store/progressStore';
import { triggerCommandPaletteOpen } from '../../app/layout/shortcuts';
import { loadTodayDrillProgress } from './InteractiveDrills';
import { loadPassedLadChallenges, LADDER_CHALLENGES } from '../simulator/sandboxChallenges';
import { loadOnboardingProfile } from './OnboardingQuiz';

/**
 * 首页「今日 5 分钟微任务」：
 * 消除新手“入口太多不知从哪点”的选择焦虑，把每天要做的事收拢成 3 个清晰、有进度反馈的小任务。
 */
export const HomeStudyStrip: React.FC = () => {
  const st = useStudy();
  const { state } = useProgress();
  const deck = useMemo(() => buildDeck(), []);
  const d = today();
  const due = deck.filter((c) => st.cards[c.id] && st.cards[c.id].due <= d).length;
  const newLeft = Math.max(0, st.dailyNew - (st.newToday.date === d ? st.newToday.n : 0));
  const mistakes = Object.values(st.mistakes).filter((m) => !m.resolved).length;
  const s = streak(st.days);
  const drillToday = loadTodayDrillProgress();
  const passedLad = loadPassedLadChallenges();
  const profile = loadOnboardingProfile();

  const sortedLessons = useMemo(() => [...lessons].sort((a, b) => a.order - b.order), []);
  const nextLesson = useMemo(() => {
    if (state.lastVisitedLessonId) {
      const last = sortedLessons.find((l) => l.id === state.lastVisitedLessonId);
      if (last && !state.completedLessonIds.includes(last.id)) return last;
    }
    return sortedLessons.find((l) => !state.completedLessonIds.includes(l.id)) ?? sortedLessons[0];
  }, [sortedLessons, state.lastVisitedLessonId, state.completedLessonIds]);

  const isBrandNewLearner =
    state.completedLessonIds.length === 0 &&
    st.days.length === 0 &&
    Object.keys(st.cards).length === 0 &&
    mistakes === 0 &&
    drillToday.doneIds.length === 0 &&
    passedLad.length === 0;

  const mission1Done = state.completedLessonIds.length > 0 && st.days.includes(d);
  const mission2Done = drillToday.doneIds.length >= 3;
  const mission3Done = passedLad.length > 0;
  const missionCount = [mission1Done, mission2Done, mission3Done].filter(Boolean).length;

  return (
    <section className="home-section home-study" aria-label="今日 5 分钟微任务">
      <div className="spa-container">
        <div className="v32-mission-strip">
          <div className="v32-mission-head">
            <div className="v32-mission-title">
              <span className="v32-mission-badge">
                {s > 0 ? (
                  <>
                    <Flame size={13} /> 连续打卡 {s} 天
                  </>
                ) : (
                  <>
                    <Clock size={13} /> 今日 5 分钟微任务
                  </>
                )}
              </span>
              <strong>
                {isBrandNewLearner
                  ? '不用买硬件、不用注册账号：跟着这 3 个小任务轻松上手！'
                  : `今天只做这 3 件小事就够了（已完成 ${missionCount} / 3）`}
              </strong>
            </div>

            <button
              type="button"
              className="v32-quick-decode-btn"
              onClick={() => triggerCommandPaletteOpen('%IW64')}
            >
              <Search size={13} />
              看不懂 %IW64 / 16#047F？点此速查
            </button>
          </div>

          <div className="v32-mission-grid">
            {/* Mission 1: Guided Lesson */}
            <Link
              to={profile && isBrandNewLearner ? profile.firstStepTo : `/learn/${nextLesson?.id ?? 'l00-before-you-start'}`}
              className={`v32-mission-card${mission1Done ? ' is-done' : ''}`}
            >
              <div className="v32-mc-top">
                <span className="v32-mc-step">
                  {mission1Done ? <CheckCircle2 size={15} /> : <PlayCircle size={15} />}
                  任务 1 · 3 分钟讲课
                </span>
                <span className="v32-mc-pill">
                  {state.completedLessonIds.length}/{sortedLessons.length} 讲
                </span>
              </div>
              <b>
                {isBrandNewLearner
                  ? '先读「第 0 讲」零基础准备'
                  : `继续第 ${nextLesson?.order ?? 0} 讲：${nextLesson?.title ?? ''}`}
              </b>
              <span>点顶部「讲课模式」像听黑板课一样过一遍，中途自带小提问</span>
            </Link>

            {/* Mission 2: 15-sec Active Drills */}
            <Link
              to="/review?tab=drills"
              className={`v32-mission-card${mission2Done ? ' is-done' : ''}`}
            >
              <div className="v32-mc-top">
                <span className="v32-mc-step">
                  {mission2Done ? <CheckCircle2 size={15} /> : <Zap size={15} />}
                  任务 2 · 15 秒互动微练
                </span>
                <span className="v32-mc-pill">
                  今日 {Math.min(3, drillToday.doneIds.length)} / 3 题
                </span>
              </div>
              <b>刷 3 道读图速判 / 接线挑刺题</b>
              <span>
                比纯背概念更练直觉；另待复习卡片 {due + newLeft} 张、错题 {mistakes} 道
              </span>
            </Link>

            {/* Mission 3: Auto-Verified Ladder Challenge */}
            <Link
              to="/sim?preset=sandbox"
              className={`v32-mission-card${mission3Done ? ' is-done' : ''}`}
            >
              <div className="v32-mc-top">
                <span className="v32-mc-step">
                  {mission3Done ? <CheckCircle2 size={15} /> : <Trophy size={15} />}
                  任务 3 · 亲手搭电路验收
                </span>
                <span className="v32-mc-pill">
                  已通 {passedLad.length} / {LADDER_CHALLENGES.length} 关
                </span>
              </div>
              <b>挑战 1 关梯形图自动验收闯关</b>
              <span>
                像刷题一样搭出起保停/互锁/TON 延时，一键跑波形自动验收！
              </span>
            </Link>
          </div>

          {isBrandNewLearner && (
            <div className="v32-mission-tip">
              <Sparkles size={13} />
              <span>小贴士：下面还有 30 秒分班小测，测完会自动帮你跳过已经会的基础内容。</span>
              <a href="#track-planner-heading" className="v32-mission-anchor">
                <Compass size={13} /> 去测起点
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
