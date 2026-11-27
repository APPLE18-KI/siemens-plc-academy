import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Layers3, NotebookPen, PlayCircle, Cpu, MessagesSquare, Sparkles, Search, Compass } from 'lucide-react';
import { buildDeck } from './deck';
import { streak, today, useStudy } from './studyStore';
import { useProgress } from '../../app/store/progressStore';
import { triggerCommandPaletteOpen } from '../../app/layout/shortcuts';

/** 首页“今天学点什么”：新手零进度时展示无压力 3 步引导；开始学习后展示每日复习卡片与错题入口 */
export const HomeStudyStrip: React.FC = () => {
  const st = useStudy();
  const { state } = useProgress();
  const deck = useMemo(() => buildDeck(), []);
  const d = today();
  const due = deck.filter((c) => st.cards[c.id] && st.cards[c.id].due <= d).length;
  const newLeft = Math.max(0, st.dailyNew - (st.newToday.date === d ? st.newToday.n : 0));
  const mistakes = Object.values(st.mistakes).filter((m) => !m.resolved).length;
  const s = streak(st.days);

  const isBrandNewLearner =
    state.completedLessonIds.length === 0 &&
    st.days.length === 0 &&
    Object.keys(st.cards).length === 0 &&
    mistakes === 0;

  if (isBrandNewLearner) {
    return (
      <section className="home-section home-study" aria-label="零基础新手三步上手">
        <div className="spa-container">
          <div className="beginner-welcome-strip">
            <div className="beginner-welcome-head">
              <Sparkles size={16} />
              <strong>第一次来？不用买硬件、不用注册账号，按这 3 步轻松起步：</strong>
            </div>
            <div className="beginner-welcome-grid">
              <Link to="/learn/l00-before-you-start" className="home-study-card is-streak">
                <Compass size={20} />
                <b>第一步：先读「第 0 讲」新手准备</b>
                <span>10 分钟弄清常开/常闭、24V 安全底线，无需先装博途软件</span>
              </Link>
              <Link to="/learn/l01-what-is-plc" className="home-study-card">
                <PlayCircle size={20} />
                <b>第二步：点开每讲顶部的「讲课模式」</b>
                <span>像老师在黑板上一步步写板书，讲到关键处停下来带你做一题</span>
              </Link>
              <button
                type="button"
                className="home-study-card is-btn-card"
                onClick={() => triggerCommandPaletteOpen('%IW64')}
              >
                <Search size={20} />
                <b>第三步：看不懂符号随时点顶部「速查」</b>
                <span>点此试试输入 %IW64、%MW10 或 16#047F，秒出大白话翻译</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="home-section home-study" aria-label="今天学点什么">
      <div className="spa-container">
        <div className="home-study-grid">
          <Link to="/review" className="home-study-card is-streak">
            <Flame size={20} />
            <b>{s > 0 ? `连续学习 ${s} 天` : '今天继续打卡'}</b>
            <span>
              今日待复习卡片 {due + newLeft} 张 · 待巩固错题 {mistakes} 道
            </span>
          </Link>
          <Link to="/learn/l00-before-you-start" className="home-study-card">
            <PlayCircle size={20} />
            <b>讲课模式</b>
            <span>板书一步步写出来，讲到关键处停下来考你一题</span>
          </Link>
          <Link to="/qa" className="home-study-card">
            <MessagesSquare size={20} />
            <b>问答库</b>
            <span>130 个新手问题，离线可搜，比如“停止按钮为什么用常闭”</span>
          </Link>
          <Link to="/sim" className="home-study-card">
            <Cpu size={20} />
            <b>博途 + PLCSIM 仿真</b>
            <span>RUN/STOP、交叉引用 F11、强制表、诊断缓冲区</span>
          </Link>
          <Link to="/review?tab=cards" className="home-study-card">
            <Layers3 size={20} />
            <b>记忆卡片</b>
            <span>术语、要点、小结，按遗忘曲线安排复习</span>
          </Link>
          <Link to="/review?tab=mistakes" className="home-study-card">
            <NotebookPen size={20} />
            <b>错题本</b>
            <span>小测验答错的题自动收进来，重做到会为止</span>
          </Link>
        </div>
      </div>
    </section>
  );
};
