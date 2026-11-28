import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Compass, RotateCcw, Sparkles } from 'lucide-react';
import { haptic } from '../../app/native/platform';

export type TrackId = 'beginner' | 'pro-upgrade' | 'interview';

export interface OnboardingProfile {
  trackId: TrackId;
  summary: string;
  firstStepLabel: string;
  firstStepTo: string;
  answers: [number, number, number];
}

const PROFILE_STORAGE_KEY = 'plc_onboarding_profile_v1';

export function loadOnboardingProfile(): OnboardingProfile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingProfile>;
    if (
      parsed &&
      (parsed.trackId === 'beginner' || parsed.trackId === 'pro-upgrade' || parsed.trackId === 'interview') &&
      typeof parsed.firstStepTo === 'string'
    ) {
      return parsed as OnboardingProfile;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const QUESTIONS = [
  {
    q: '1/3 · 你目前的电工或电路基础是？',
    options: [
      { label: '纯零基础，没碰过继电器或控制柜', score: 0 },
      { label: '懂常开/常闭开关，会用万用表测通断', score: 1 },
      { label: '做过现场电工接线，或调过电机启停', score: 2 },
    ],
  },
  {
    q: '2/3 · 你之前的程序或 PLC 经验是？',
    options: [
      { label: '完全没写过梯形图或代码', score: 0 },
      { label: '懂一点 if/else，或看过几节梯形图视频', score: 1 },
      { label: '会写常规起保停/定时计数，想补 SCL/PID/工程架构', score: 2 },
    ],
  },
  {
    q: '3/3 · 你现阶段最想先达成哪个目标？',
    options: [
      { label: '从零看懂梯形图、自己动手调通电机控制', goal: 'beginner' as TrackId },
      { label: '提升现场排故能力，掌握 FB/UDT 模块化与 PID 闭环', goal: 'pro-upgrade' as TrackId },
      { label: '冲刺一份能写进简历的工业毕业项目 + 模拟面试', goal: 'interview' as TrackId },
    ],
  },
] as const;

function computeProfile(answers: [number, number, number]): OnboardingProfile {
  const [a0, a1, a2] = answers;
  const elecScore = QUESTIONS[0].options[a0].score;
  const codeScore = QUESTIONS[1].options[a1].score;
  const goal = QUESTIONS[2].options[a2].goal;

  let trackId: TrackId = 'beginner';
  if (goal === 'interview' && elecScore + codeScore >= 2) {
    trackId = 'interview';
  } else if (goal === 'pro-upgrade' && elecScore + codeScore >= 2) {
    trackId = 'pro-upgrade';
  } else if (elecScore + codeScore >= 4) {
    trackId = goal;
  } else if (elecScore + codeScore >= 3) {
    trackId = goal === 'beginner' ? 'beginner' : 'pro-upgrade';
  } else {
    trackId = 'beginner';
  }

  if (trackId === 'beginner') {
    return {
      trackId,
      summary: '已为你匹配【路线一 · 零基础入门】：先花 10 分钟通过第 0 讲建立常开/常闭与安全直觉，再直接进仿真器亲手搭起保停。',
      firstStepLabel: '立即从第 0 讲开始你的第 1 步',
      firstStepTo: '/learn/l00-before-you-start',
      answers,
    };
  }
  if (trackId === 'pro-upgrade') {
    return {
      trackId,
      summary: '已为你匹配【路线二 · 进阶补强】：可跳过最基础接线，直奔 FB/UDT 模块化封装、SCL 状态机与模拟量 PID 闭环！',
      firstStepLabel: '直达第 14 讲：FC/FB 与背景 DB',
      firstStepTo: '/learn/l10-fc-fb-instance-db',
      answers,
    };
  }
  return {
    trackId,
    summary: '已为你匹配【路线三 · 项目与面试冲刺】：聚焦 PROFINET 1 号报文、5 关 SCL 实战闯关、12 道盲测排故工单与 STAR 简历！',
    firstStepLabel: '直达简历级毕业大项目（第 1 步架构台）',
    firstStepTo: '/capstone?tab=arch',
    answers,
  };
}

interface OnboardingQuizProps {
  onResult: (trackId: TrackId) => void;
}

export const OnboardingQuiz: React.FC<OnboardingQuizProps> = ({ onResult }) => {
  const [savedProfile, setSavedProfile] = useState<OnboardingProfile | null>(() => loadOnboardingProfile());
  const [quizOpen, setQuizOpen] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [picks, setPicks] = useState<number[]>([]);

  const handleChoose = (optIdx: number) => {
    haptic('tap');
    const nextPicks = [...picks.slice(0, step), optIdx];
    setPicks(nextPicks);
    if (step < 2) {
      setStep((step + 1) as 0 | 1 | 2);
    } else {
      const profile = computeProfile([nextPicks[0], nextPicks[1], nextPicks[2]]);
      setSavedProfile(profile);
      setQuizOpen(false);
      try {
        window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      } catch {
        /* ignore */
      }
      haptic('success');
      onResult(profile.trackId);
    }
  };

  const startRetake = () => {
    haptic('tap');
    setPicks([]);
    setStep(0);
    setQuizOpen(true);
  };

  if (quizOpen) {
    const q = QUESTIONS[step];
    return (
      <div className="v32-onboard-box is-open" role="region" aria-label="30 秒起点分班小测">
        <div className="v32-ob-head">
          <span className="v32-ob-kicker">
            <Sparkles size={14} /> 30 秒互动分班 · {q.q}
          </span>
          <button type="button" className="v32-ob-close" onClick={() => setQuizOpen(false)}>
            取消
          </button>
        </div>
        <div className="v32-ob-progress" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        <div className="v32-ob-opts">
          {q.options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              className="v32-ob-opt-btn"
              onClick={() => handleChoose(idx)}
            >
              <span className="v32-ob-letter">{String.fromCharCode(65 + idx)}</span>
              <span>{opt.label}</span>
              <ArrowRight size={14} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (savedProfile) {
    return (
      <div className="v32-onboard-result" role="status">
        <div className="v32-ob-res-main">
          <CheckCircle2 size={18} color="var(--power-green)" />
          <div>
            <strong>你的专属起点已生成</strong>
            <p>{savedProfile.summary}</p>
          </div>
        </div>
        <div className="v32-ob-res-actions">
          <Link to={savedProfile.firstStepTo} className="btn btn-primary btn-sm">
            {savedProfile.firstStepLabel}
            <ArrowRight size={14} />
          </Link>
          <button type="button" className="btn btn-sm" onClick={startRetake}>
            <RotateCcw size={13} /> 重测起点
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="v32-onboard-cta">
      <div className="v32-ob-cta-text">
        <Compass size={17} color="var(--siemens-teal-bright)" />
        <div>
          <strong>不确定自己该选哪条路线？花 30 秒答 3 个小问题</strong>
          <span>不用懂任何专业词，测完直接为你高亮最适合的起点与今日第一步。</span>
        </div>
      </div>
      <button type="button" className="btn btn-primary btn-sm" onClick={startRetake}>
        <Sparkles size={14} /> 30 秒测一测我的起点
      </button>
    </div>
  );
};
