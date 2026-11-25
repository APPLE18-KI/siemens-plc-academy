import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Boxes,
  CheckCircle2,
  Clock,
  Cpu,
  GitBranch,
  Play,
  RotateCcw,
  Search,
} from 'lucide-react';
import { chapters, lessons } from '../../registry';
import type { Lesson, LessonLevel } from '../../types/content';
import { useProgress } from '../store/progressStore';
import { formatDuration, LEVEL_STARS } from '../../content/curriculum';
import { DifficultyStars } from '../../components/DifficultyStars';

const LEVELS: Array<'全部' | LessonLevel> = ['全部', '入门', '基础', '进阶', '实战'];

function levelBadgeClass(level: LessonLevel): string {
  switch (level) {
    case '入门':
      return 'badge-cyan';
    case '基础':
      return 'badge-teal';
    case '进阶':
      return 'badge-amber';
    case '实战':
      return 'badge-green';
    default:
      return '';
  }
}

function summarizeInteractiveBlocks(lesson: Lesson) {
  let sim = 0;
  let model = 0;
  let workflow = 0;
  let quiz = 0;
  for (const b of lesson.blocks) {
    if (b.kind === 'sim') sim++;
    else if (b.kind === 'model') model++;
    else if (b.kind === 'workflow' || b.kind === 'demo') workflow++;
    else if (b.kind === 'quiz') quiz++;
  }
  return { sim, model, workflow, quiz };
}

export const LearnCatalogPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { state, isLessonCompleted, getStats } = useProgress();

  const [query, setQuery] = useState('');
  const [chapterFilter, setChapterFilter] = useState<string>(
    () => searchParams.get('chapter') || 'all'
  );
  const [levelFilter, setLevelFilter] = useState<'全部' | LessonLevel>('全部');
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'done'>('all');

  const safeChapters = useMemo(
    () => (Array.isArray(chapters) ? [...chapters].sort((a, b) => a.order - b.order) : []),
    []
  );
  const safeLessons = useMemo(
    () => (Array.isArray(lessons) ? [...lessons].sort((a, b) => a.order - b.order) : []),
    []
  );

  const stats = getStats(safeLessons.length);
  const totalMinutes = useMemo(
    () => safeLessons.reduce((acc, l) => acc + (l.minutes || 0), 0),
    [safeLessons]
  );

  const filteredLessons = useMemo(() => {
    const q = query.trim().toLowerCase();
    return safeLessons.filter((lesson) => {
      if (chapterFilter !== 'all' && lesson.chapterId !== chapterFilter) return false;
      if (levelFilter !== '全部' && lesson.level !== levelFilter) return false;
      const done = isLessonCompleted(lesson.id);
      if (statusFilter === 'done' && !done) return false;
      if (statusFilter === 'todo' && done) return false;
      if (q) {
        const haystack = [
          lesson.title,
          lesson.subtitle,
          ...(lesson.tags || []),
          ...(lesson.objectives || []),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [safeLessons, chapterFilter, levelFilter, statusFilter, query, isLessonCompleted]);

  const groupedByChapter = useMemo(() => {
    if (safeChapters.length === 0) {
      return filteredLessons.length > 0
        ? [
            {
              chapter: {
                id: 'default',
                order: 1,
                title: '全部课程',
                subtitle: '西门子 S7-1200 核心实训课程',
                badge: '课程',
              },
              items: filteredLessons,
            },
          ]
        : [];
    }

    const mapped = safeChapters
      .map((ch) => ({
        chapter: ch,
        items: filteredLessons.filter((l) => l.chapterId === ch.id),
      }))
      .filter((g) => g.items.length > 0);

    // Include any orphan lessons whose chapterId is not in chapters
    const knownChapterIds = new Set(safeChapters.map((c) => c.id));
    const orphans = filteredLessons.filter((l) => !knownChapterIds.has(l.chapterId));
    if (orphans.length > 0) {
      mapped.push({
        chapter: {
          id: 'other',
          order: 99,
          title: '拓展实战专题',
          subtitle: '其他专项课程内容',
          badge: '拓展',
        },
        items: orphans,
      });
    }
    return mapped;
  }, [safeChapters, filteredLessons]);

  const nextLesson = useMemo(() => {
    if (state.lastVisitedLessonId) {
      const found = safeLessons.find((l) => l.id === state.lastVisitedLessonId);
      if (found) return found;
    }
    return safeLessons.find((l) => !isLessonCompleted(l.id)) ?? safeLessons[0] ?? null;
  }, [safeLessons, state.lastVisitedLessonId, isLessonCompleted]);

  const resetFilters = () => {
    setQuery('');
    setChapterFilter('all');
    setLevelFilter('全部');
    setStatusFilter('all');
  };

  return (
    <div className="catalog-page">
      <div className="spa-container">
        <div className="page-hero-bar">
          <div>
            <div className="telemetry-eyebrow">
              <span className="telemetry-dot" />
              课程目录 · {safeChapters.length} 个阶段
            </div>
            <h1>西门子 S7-1200 入门课程</h1>
            <p>
              共 {safeLessons.length} 讲，预计总学习时长约 <strong>{formatDuration(totalMinutes)}</strong>
              （含动手练习和小测验）。建议按顺序学习，每次 1 讲即可；第 0 讲会告诉你需要准备什么。
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div
              style={{
                padding: '10px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-hairline)',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700 }}>
                  {stats.completedLessons} / {safeLessons.length}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>已完成课程</div>
              </div>
              <div
                style={{
                  width: 1,
                  height: 28,
                  background: 'var(--border-hairline)',
                }}
              />
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--power-green)',
                  }}
                >
                  {stats.lessonPct}%
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>课程完成率</div>
              </div>
            </div>

            {nextLesson && (
              <Link to={`/learn/${nextLesson.id}`} className="btn btn-primary">
                <Play size={15} fill="currentColor" />
                {state.lastVisitedLessonId ? `继续第 ${nextLesson.order} 讲` : `从第 ${nextLesson.order} 讲开始`}
              </Link>
            )}
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="filter-toolbar">
          <div className="filter-row">
            <div className="search-input-wrap">
              <Search size={15} className="search-input-icon" />
              <input
                type="search"
                className="search-input"
                placeholder="搜索课程，如 定时器、自锁、HMI、PID…"
                aria-label="搜索课程"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="filter-pills" role="group" aria-label="按难度筛选">
              {LEVELS.map((lv) => (
                <button
                  key={lv}
                  type="button"
                  className={`filter-pill${levelFilter === lv ? ' active' : ''}`}
                  onClick={() => setLevelFilter(lv)}
                >
                  {lv === '全部' ? '全部难度' : lv}
                </button>
              ))}
            </div>

            <div className="filter-pills" role="group" aria-label="按完成状态筛选">
              {[
                { key: 'all', label: '全部状态' },
                { key: 'todo', label: '未完成' },
                { key: 'done', label: '已完成' },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  className={`filter-pill${statusFilter === st.key ? ' active' : ''}`}
                  onClick={() => setStatusFilter(st.key as 'all' | 'todo' | 'done')}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {safeChapters.length > 0 && (
            <div className="filter-pills" role="group" aria-label="按阶段筛选">
              <button
                type="button"
                className={`filter-pill${chapterFilter === 'all' ? ' active' : ''}`}
                onClick={() => setChapterFilter('all')}
              >
                全部阶段 ({safeLessons.length})
              </button>
              {safeChapters.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  className={`filter-pill${chapterFilter === ch.id ? ' active' : ''}`}
                  onClick={() => setChapterFilter(ch.id)}
                >
                  {ch.title.replace(/^第 (\d+) 章：.*$/, '第 $1 章')} · {ch.badge}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Empty / Fallback States */}
        {safeLessons.length === 0 ? (
          <div className="empty-state-card">
            <BookOpen size={32} color="var(--siemens-teal)" />
            <h3>课程内容正在编排载入中</h3>
            <p>
              当课程数据写入 <code>src/content/curriculum.ts</code> 后，这里会自动按 5
              大阶段完整呈现 15 讲互动课程。你也可以先体验 PLC 仿真实验室。
            </p>
            <Link to="/sim" className="btn btn-primary btn-sm">
              前往 PLC 仿真实验室
            </Link>
          </div>
        ) : groupedByChapter.length === 0 ? (
          <div className="empty-state-card">
            <Search size={30} color="var(--ink-muted)" />
            <h3>没有找到匹配的课程</h3>
            <p>尝试更换关键词，或重置阶段与难度筛选条件。</p>
            <button type="button" className="btn btn-sm" onClick={resetFilters}>
              <RotateCcw size={14} />
              清除全部筛选
            </button>
          </div>
        ) : (
          groupedByChapter.map(({ chapter, items }) => {
            const chapterAll = safeLessons.filter((l) => l.chapterId === chapter.id);
            const chapterDone = chapterAll.filter((l) => isLessonCompleted(l.id)).length;

            return (
              <section key={chapter.id} className="chapter-block">
                <div className="chapter-block-head">
                  <div className="chapter-head-left">
                    <span className="badge badge-teal">{chapter.badge}</span>
                    <div>
                      <h2 className="chapter-block-title">{chapter.title}</h2>
                      <p className="chapter-block-sub">{chapter.subtitle}</p>
                    </div>
                  </div>
                  <span className="badge badge-mono">
                    {chapterDone}/{chapterAll.length || items.length} 已完成 · 约 {formatDuration(chapterAll.reduce((acc, l) => acc + l.minutes, 0))}
                  </span>
                </div>

                <div className="lessons-grid">
                  {items.map((lesson) => {
                    const done = isLessonCompleted(lesson.id);
                    const quizBest = state.quizHighScores[lesson.id];
                    const counts = summarizeInteractiveBlocks(lesson);

                    return (
                      <Link
                        key={lesson.id}
                        to={`/learn/${lesson.id}`}
                        className={`lesson-card${done ? ' is-done' : ''}`}
                        aria-label={`第 ${lesson.order} 讲：${lesson.title}，难度${lesson.level}，约 ${lesson.minutes} 分钟${done ? '，已完成' : ''}`}
                      >
                        <div className="lesson-card-top">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span className="badge badge-mono">第 {lesson.order} 讲</span>
                            <span className={`badge ${levelBadgeClass(lesson.level)}`}>
                              <DifficultyStars level={LEVEL_STARS[lesson.level]} />
                              {lesson.level}
                            </span>
                          </div>
                          {done ? (
                            <span className="badge badge-green">
                              <CheckCircle2 size={12} />
                              已完成
                            </span>
                          ) : null}
                        </div>
                        <div className="lesson-card-meta">
                          <Clock size={12} />
                          约 {formatDuration(lesson.minutes)}
                        </div>

                        <h3 className="lesson-card-title">{lesson.title}</h3>
                        <p className="lesson-card-sub">{lesson.subtitle}</p>

                        <div className="lesson-card-tags">
                          {(lesson.tags || []).slice(0, 4).map((tag) => (
                            <span key={tag} className="badge" style={{ fontSize: 11 }}>
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div className="lesson-card-foot">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {counts.sim > 0 && (
                              <span
                                title="内嵌实时仿真器"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
                              >
                                <Cpu size={13} color="var(--siemens-teal-bright)" />
                                仿真
                              </span>
                            )}
                            {counts.model > 0 && (
                              <span
                                title="内嵌设备模型"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
                              >
                                <Boxes size={13} color="var(--info-cyan)" />
                                模型
                              </span>
                            )}
                            {counts.workflow > 0 && (
                              <span
                                title="内嵌原理动画或互动演示"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
                              >
                                <GitBranch size={13} color="var(--alarm-amber)" />
                                演示
                              </span>
                            )}
                            {quizBest && (
                              <span className="badge badge-mono" style={{ fontSize: 10.5 }}>
                                测验 {quizBest.bestPct}%
                              </span>
                            )}
                          </div>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              color: 'var(--siemens-teal-bright)',
                              fontWeight: 600,
                            }}
                          >
                            进入学习
                            <ArrowRight size={13} />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
};
