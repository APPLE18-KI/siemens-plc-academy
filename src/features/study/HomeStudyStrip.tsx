import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Layers3, NotebookPen, PlayCircle, Cpu, MessagesSquare } from 'lucide-react';
import { buildDeck } from './deck';
import { streak, today, useStudy } from './studyStore';

/** 首页“今天学点什么”：连续天数、到期卡片、错题，以及 v2 新功能入口 */
export const HomeStudyStrip: React.FC = () => {
  const st = useStudy();
  const deck = useMemo(() => buildDeck(), []);
  const d = today();
  const due = deck.filter((c) => st.cards[c.id] && st.cards[c.id].due <= d).length;
  const newLeft = Math.max(0, st.dailyNew - (st.newToday.date === d ? st.newToday.n : 0));
  const mistakes = Object.values(st.mistakes).filter((m) => !m.resolved).length;
  const s = streak(st.days);
  return (
    <section className="home-section home-study" aria-label="今天学点什么">
      <div className="spa-container">
        <div className="home-study-grid">
          <Link to="/review" className="home-study-card is-streak">
            <Flame size={20} />
            <b>{s > 0 ? `连续学习 ${s} 天` : '今天开始打卡'}</b>
            <span>
              卡片 {due + newLeft} 张待复习 · 错题 {mistakes} 道
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
            <span>RUN/STOP、SIM 表、强制表、诊断缓冲区</span>
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
