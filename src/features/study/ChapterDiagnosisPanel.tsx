import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, NotebookPen } from 'lucide-react';
import { chapters, lessons } from '../../registry';
import { useProgress } from '../../app/store/progressStore';
import { useStudy } from './studyStore';

interface ChapterDiag {
  id: string;
  order: number;
  title: string;
  shortTitle: string;
  totalLessons: number;
  doneLessons: number;
  completionPct: number;
  avgQuizPct: number | null;
  quizzedCount: number;
  openMistakes: number;
  masteryPct: number;
  status: 'weak' | 'solid' | 'active' | 'idle';
  statusLabel: string;
  targetLessonId: string;
  reason: string;
}

export const ChapterDiagnosisPanel: React.FC<{
  onJumpMistakes: (chapterId: string) => void;
  onJumpCards: () => void;
}> = ({ onJumpMistakes, onJumpCards }) => {
  const { isLessonCompleted, state: progress } = useProgress();
  const study = useStudy();

  const diags = useMemo<ChapterDiag[]>(() => {
    const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);
    const openMistakeList = Object.values(study.mistakes).filter((m) => !m.resolved);

    return sortedChapters.map((ch) => {
      const chLessons = lessons
        .filter((l) => l.chapterId === ch.id)
        .sort((a, b) => a.order - b.order);
      const idSet = new Set(chLessons.map((l) => l.id));
      const totalLessons = chLessons.length;
      const doneLessons = chLessons.filter((l) => isLessonCompleted(l.id)).length;
      const completionPct = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;

      const quizScores = chLessons
        .map((l) => progress.quizHighScores[l.id])
        .filter((q): q is NonNullable<typeof q> => Boolean(q));
      const avgQuizPct =
        quizScores.length > 0
          ? Math.round(quizScores.reduce((acc, q) => acc + q.bestPct, 0) / quizScores.length)
          : null;

      const openMistakes = openMistakeList.filter((m) => idSet.has(m.lessonId)).length;

      // 综合掌握度：课时完成 60% + 随堂测验 40% - 未解决错题扣分
      const quizPart = avgQuizPct !== null ? avgQuizPct : Math.round(completionPct * 0.55);
      const penalty = Math.min(30, openMistakes * 8);
      const rawMastery =
        doneLessons === 0 && quizScores.length === 0 && openMistakes === 0
          ? 0
          : Math.max(0, Math.min(100, Math.round(completionPct * 0.6 + quizPart * 0.4 - penalty)));

      let status: ChapterDiag['status'] = 'active';
      let statusLabel = '学习中';
      if (doneLessons === 0 && quizScores.length === 0 && openMistakes === 0) {
        status = 'idle';
        statusLabel = '未开始';
      } else if (openMistakes > 0 || (avgQuizPct !== null && avgQuizPct < 80)) {
        status = 'weak';
        statusLabel = '待补强';
      } else if (completionPct === 100 && (avgQuizPct === null || avgQuizPct >= 85)) {
        status = 'solid';
        statusLabel = '已掌握';
      }

      // 最需回看的课时：优先找有未解决错题的课时 -> 测验最低分课时 -> 第一个未完成课时 -> 第一讲
      const mistakeLesson = chLessons.find((l) => openMistakeList.some((m) => m.lessonId === l.id));
      const lowQuizLesson = [...chLessons]
        .filter((l) => progress.quizHighScores[l.id] && progress.quizHighScores[l.id].bestPct < 80)
        .sort((a, b) => progress.quizHighScores[a.id].bestPct - progress.quizHighScores[b.id].bestPct)[0];
      const nextTodo = chLessons.find((l) => !isLessonCompleted(l.id));
      const targetLesson = mistakeLesson ?? lowQuizLesson ?? nextTodo ?? chLessons[0];

      const shortTitle = ch.title.replace(/^第\s*\d+\s*章[：:]\s*/, '');
      const reasonParts: string[] = [];
      if (openMistakes > 0) reasonParts.push(`${openMistakes} 道错题未过关`);
      if (avgQuizPct !== null && avgQuizPct < 80) reasonParts.push(`测验均分 ${avgQuizPct}%`);
      if (doneLessons < totalLessons) reasonParts.push(`还有 ${totalLessons - doneLessons} 讲未完成`);
      const reason = reasonParts.length > 0 ? reasonParts.join('，') : '本章课时与测验均已达标';

      return {
        id: ch.id,
        order: ch.order,
        title: ch.title,
        shortTitle,
        totalLessons,
        doneLessons,
        completionPct,
        avgQuizPct,
        quizzedCount: quizScores.length,
        openMistakes,
        masteryPct: rawMastery,
        status,
        statusLabel,
        targetLessonId: targetLesson?.id ?? '',
        reason,
      };
    });
  }, [isLessonCompleted, progress.quizHighScores, study.mistakes]);

  // 找出当前最需要补强的一章
  const priority = useMemo(() => {
    const withMistakes = diags
      .filter((d) => d.openMistakes > 0)
      .sort((a, b) => b.openMistakes - a.openMistakes || a.masteryPct - b.masteryPct);
    if (withMistakes[0]) return withMistakes[0];

    const weakOrActive = diags
      .filter((d) => d.status === 'weak' || d.status === 'active')
      .sort((a, b) => a.masteryPct - b.masteryPct || a.order - b.order);
    if (weakOrActive[0]) return weakOrActive[0];

    const firstIdle = diags.find((d) => d.status === 'idle');
    if (firstIdle) return firstIdle;

    return null;
  }, [diags]);

  return (
    <section className="v3-diag" aria-labelledby="v3-diag-title">
      <div className="v3-diag-head">
        <div>
          <h2 id="v3-diag-title">
            <Activity size={17} color="var(--siemens-teal-bright)" aria-hidden />
            五章掌握度与薄弱环节诊断
          </h2>
          <p>按每章课时完成率、随堂测验得分和未解决错题综合计算。</p>
        </div>
      </div>

      {priority ? (
        <div className={`v3-diag-focus${priority.status === 'weak' ? '' : ' is-solid'}`}>
          <div className="v3-diag-focus-text">
            <b>
              {priority.status === 'weak' ? (
                <>
                  <AlertTriangle size={14} style={{ verticalAlign: -2, marginRight: 5 }} aria-hidden />
                  建议优先补强：第 {priority.order} 章 · {priority.shortTitle}
                </>
              ) : priority.status === 'idle' ? (
                `下一阶段推进：第 ${priority.order} 章 · ${priority.shortTitle}`
              ) : (
                `当前推进中：第 ${priority.order} 章 · ${priority.shortTitle}`
              )}
            </b>
            <span>{priority.reason}</span>
          </div>
          <div className="v3-diag-focus-actions">
            {priority.openMistakes > 0 && (
              <button
                type="button"
                className="btn btn-primary btn-sm press"
                onClick={() => onJumpMistakes(priority.id)}
              >
                <NotebookPen size={14} aria-hidden />
                重做本章错题（{priority.openMistakes}）
              </button>
            )}
            {priority.targetLessonId && (
              <Link
                to={`/learn/${priority.targetLessonId}`}
                className={`btn btn-sm press${priority.openMistakes === 0 ? ' btn-primary' : ''}`}
              >
                {priority.openMistakes > 0 ? '回看待补课时' : '继续本章学习'}
                <ArrowRight size={14} aria-hidden />
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="v3-diag-focus is-solid">
          <div className="v3-diag-focus-text">
            <b>
              <CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 5 }} aria-hidden />
              五章掌握扎实，没有未过关错题
            </b>
            <span>可以继续刷记忆卡片巩固，或去毕业项目做完整产线联调。</span>
          </div>
          <div className="v3-diag-focus-actions">
            <button type="button" className="btn btn-sm press" onClick={onJumpCards}>
              刷记忆卡片
            </button>
            <Link to="/capstone" className="btn btn-primary btn-sm press">
              毕业项目
            </Link>
          </div>
        </div>
      )}

      <div className="v3-diag-list">
        {diags.map((d) => (
          <div key={d.id} className={`v3-diag-row${d.status === 'weak' ? ' is-weak' : ''}`}>
            <div>
              <div className="v3-diag-row-top">
                <span className="v3-diag-ch">
                  第 {d.order} 章 · {d.shortTitle}
                </span>
                <span className={`v3-diag-status ${d.status}`}>{d.statusLabel}</span>
              </div>
              <div className="v3-diag-bar-wrap">
                <div
                  className="v3-diag-bar"
                  role="progressbar"
                  aria-label={`第 ${d.order} 章掌握度`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={d.masteryPct}
                >
                  <span className={d.status} style={{ width: `${d.masteryPct}%` }} />
                </div>
                <span className="v3-diag-pct">{d.masteryPct}%</span>
              </div>
              <div className="v3-diag-metrics">
                <span>
                  课时 {d.doneLessons}/{d.totalLessons}（{d.completionPct}%）
                </span>
                <span>测验 {d.avgQuizPct !== null ? `均分 ${d.avgQuizPct}%` : '暂未作答'}</span>
                <span className={d.openMistakes > 0 ? 'is-alert' : ''}>
                  错题 {d.openMistakes > 0 ? `${d.openMistakes} 道待巩固` : '0 道'}
                </span>
              </div>
            </div>

            {d.openMistakes > 0 ? (
              <button
                type="button"
                className="btn btn-sm press"
                onClick={() => onJumpMistakes(d.id)}
              >
                去改错
              </button>
            ) : d.targetLessonId ? (
              <Link to={`/learn/${d.targetLessonId}`} className="btn btn-sm press">
                {d.doneLessons === d.totalLessons ? '复盘' : '去学'}
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
};
