import React, { useEffect, useRef, useState } from 'react';
import { Flame, Trophy } from 'lucide-react';
import { useProgress } from '../../app/store/progressStore';
import { lessons } from '../../content/curriculum';
import { streak as studyStreak, useStudy } from '../study/studyStore';

/**
 * 完成一讲时的庆祝卡片：只在“未完成 → 完成”的那一刻出现约 3 秒（页面初次打开时已完成不弹）。
 * 显示连续学习天数与总进度。减少动态效果时不做动画。
 */
export const LessonCelebration: React.FC<{ lessonId: string; order: number; completed: boolean }> = ({ lessonId, order, completed }) => {
  const { state } = useProgress();
  const st = useStudy();
  const prev = useRef<{ id: string; c: boolean }>({ id: lessonId, c: completed });
  const [show, setShow] = useState(false);

  useEffect(() => {
    const p = prev.current;
    if (p.id === lessonId && !p.c && completed) {
      setShow(true);
      const t = window.setTimeout(() => setShow(false), 3200);
      prev.current = { id: lessonId, c: completed };
      return () => window.clearTimeout(t);
    }
    prev.current = { id: lessonId, c: completed };
    if (p.id !== lessonId) setShow(false);
    return undefined;
  }, [lessonId, completed]);

  if (!show) return null;
  const done = state.completedLessonIds.filter((id) => lessons.some((l) => l.id === id)).length;
  const streak = Math.max(1, state.studyStreakDays, studyStreak(st.days));
  return (
    <div className="celebrate" role="status" aria-live="polite" onClick={() => setShow(false)}>
      <div className="celebrate-card">
        <div className="celebrate-burst" aria-hidden>
          {Array.from({ length: 10 }).map((_, i) => (
            <i key={i} style={{ ['--i' as string]: i } as React.CSSProperties} />
          ))}
        </div>
        <Trophy size={30} className="celebrate-icon" aria-hidden />
        <b>第 {order} 讲完成！</b>
        <span className="celebrate-meta">
          <Flame size={15} aria-hidden /> 连续学习 {streak} 天 · 已完成 {done}/{lessons.length} 讲
        </span>
        <div className="celebrate-bar" aria-hidden>
          <span style={{ width: `${Math.round((done / lessons.length) * 100)}%` }} />
        </div>
      </div>
    </div>
  );
};
