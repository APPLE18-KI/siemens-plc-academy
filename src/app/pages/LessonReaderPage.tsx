import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Copy,
  ListTree,
  NotebookPen,
  PlayCircle,
  Star,
  Target,
} from 'lucide-react';
import { chapters, lessons } from '../../registry';
import { useProgress } from '../store/progressStore';
import { LessonBlockRenderer } from '../../components/lesson/LessonBlockRenderer';
import { MarkdownRenderer, renderInline } from '../../components/MarkdownRenderer';
const renderInlineSafe = (t: string, i: number) => renderInline(t, `sk-${i}`);
import { DifficultyStars } from '../../components/DifficultyStars';
import { formatDuration, LEVEL_STARS } from '../../content/curriculum';
import { haptic } from '../native/platform';
import { FoldContext, FoldSwitch, hasExplicitMarks, type FoldLevel } from '../../components/fold';
import { LECTURES } from '../../content/lectures';
import { LecturePlayer } from '../../features/lecture/LecturePlayer';
import { LessonQaSection } from '../../features/qa/LessonQa';
import { LessonCelebration } from '../../features/qa/LessonCelebration';
import type { BoardItem } from '../../features/lecture/types';
import { ExplainBack } from '../../features/study/ExplainBack';
import { LessonNotesPanel } from '../../features/study/LessonNotesPanel';
import {
  buildLessonCheatSheetMarkdown,
  copyTextToClipboard,
  useLessonNotes,
} from '../../features/study/lessonNotes';
import '../../features/study/study-v3.css';

const FOLD_KEY = 'plc-fold-level';
const stripLv = (t: string) => t.replace(/\[\[[\w-]+\|([^\]]+)\]\]/g, '$1');
function boardText(b: BoardItem): string | null {
  switch (b.kind) {
    case 'title':
    case 'line':
    case 'formula':
      return stripLv(b.text);
    case 'pairs':
      return b.rows.map(([a, c]) => `${stripLv(a)}：${stripLv(c)}`).join('；');
    default:
      return null;
  }
}

export const LessonReaderPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { isLessonCompleted, toggleLessonComplete, setLastVisitedLesson } = useProgress();
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [foldLevel, setFoldLevelState] = useState<FoldLevel>(() => {
    try {
      const v = localStorage.getItem(FOLD_KEY) as FoldLevel | null;
      return v && ['full', 'read', 'points', 'statements'].includes(v) ? v : 'read';
    } catch {
      return 'read';
    }
  });
  const setFoldLevel = (l: FoldLevel) => {
    setFoldLevelState(l);
    try {
      localStorage.setItem(FOLD_KEY, l);
    } catch {
      /* ignore */
    }
  };
  const [lectureOpen, setLectureOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [copiedCard, setCopiedCard] = useState(false);
  const [copyToast, setCopyToast] = useState('');
  const progressBarRef = useRef<HTMLSpanElement>(null);
  const progressWrapRef = useRef<HTMLDivElement>(null);
  const allNotes = useLessonNotes();

  const safeChapters = useMemo(
    () => (Array.isArray(chapters) ? [...chapters].sort((a, b) => a.order - b.order) : []),
    []
  );
  const safeLessons = useMemo(
    () => (Array.isArray(lessons) ? [...lessons].sort((a, b) => a.order - b.order) : []),
    []
  );

  const currentIndex = useMemo(
    () => safeLessons.findIndex((l) => l.id === lessonId),
    [safeLessons, lessonId]
  );
  const lesson = currentIndex >= 0 ? safeLessons[currentIndex] : null;
  const prevLesson = currentIndex > 0 ? safeLessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex >= 0 && currentIndex < safeLessons.length - 1
      ? safeLessons[currentIndex + 1]
      : null;

  const currentChapter = useMemo(
    () => (lesson ? safeChapters.find((c) => c.id === lesson.chapterId) ?? null : null),
    [safeChapters, lesson]
  );

  useEffect(() => {
    if (lesson) {
      setLastVisitedLesson(lesson.id);
    }
    setMobileTocOpen(false);
    setLectureOpen(false);
    setCopiedCard(false);
  }, [lesson, setLastVisitedLesson]);

  // 顶部平滑阅读进度指示条（rAF 节流 + GPU scaleX）
  useEffect(() => {
    let raf = 0;
    const sync = () => {
      raf = 0;
      const doc = document.documentElement;
      const scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
      const ratio = Math.min(1, Math.max(0, window.scrollY / scrollable));
      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${ratio.toFixed(4)})`;
      }
      if (progressWrapRef.current) {
        progressWrapRef.current.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
      }
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(sync);
    };
    sync();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [lessonId, foldLevel]);

  const currentNote = lesson ? allNotes[lesson.id] : undefined;

  const handleCopyCheatSheet = useCallback(async () => {
    if (!lesson) return;
    const md = buildLessonCheatSheetMarkdown(lesson, currentChapter, currentNote?.text ?? '');
    const ok = await copyTextToClipboard(md);
    if (ok) {
      haptic('success');
      setCopiedCard(true);
      setCopyToast('已复制本讲 Markdown 速查卡，可直接粘贴到飞书、Notion 或 Obsidian。');
      window.setTimeout(() => setCopiedCard(false), 2400);
    } else {
      haptic('error');
      setCopyToast('复制失败，请检查浏览器剪贴板权限。');
    }
  }, [lesson, currentChapter, currentNote]);

  if (!lesson) {
    return (
      <div className="spa-container" style={{ padding: '48px 24px' }}>
        <div className="empty-state-card">
          <BookOpen size={32} color="var(--siemens-teal)" />
          <h3>{safeLessons.length === 0 ? '课程数据正在初始化' : '未找到该课时'}</h3>
          <p>
            {safeLessons.length === 0
              ? '当前课程目录尚未填充内容，请稍后刷新或先体验仿真实验室。'
              : `未在课程库中找到标识为 "${lessonId}" 的课程，请返回课程总目录选择。`}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/learn" className="btn btn-primary btn-sm">
              返回课程目录
            </Link>
            <Link to="/sim" className="btn btn-sm">
              前往仿真台
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const completed = isLessonCompleted(lesson.id);
  const script = LECTURES[lesson.id];
  const explicitMarks = lesson.blocks.some((b) => 'md' in b && hasExplicitMarks(b.md));
  const skeleton = (script?.beats ?? [])
    .filter((b) => b.board && (foldLevel === 'points' ? b.board.kind !== 'rung' : b.board.kind === 'line' && b.board.key))
    .map((b) => boardText(b.board as BoardItem))
    .filter((t): t is string => Boolean(t));
  const closeLecture = (goTo?: 'read' | 'try') => {
    setLectureOpen(false);
    if (!goTo) return;
    setFoldLevel('read');
    window.setTimeout(() => {
      const target =
        goTo === 'try'
          ? document.querySelector('.reader-main .embedded-stage-card, .reader-main .demo-block, .reader-main .walk-root')
          : document.querySelector('.reader-main .reader-fold-bar');
      (target as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  };

  // Group sidebar outline by chapters
  const sidebarGroups =
    safeChapters.length > 0
      ? safeChapters
          .map((ch) => ({
            id: ch.id,
            label: ch.title,
            items: safeLessons.filter((l) => l.chapterId === ch.id),
          }))
          .filter((g) => g.items.length > 0)
      : [{ id: 'all', label: '全部课程', items: safeLessons }];

  return (
    <div className="reader-layout">
      {/* 顶部轻量平滑阅读进度条 */}
      <div
        ref={progressWrapRef}
        className="v3-read-progress"
        role="progressbar"
        aria-label="本讲阅读进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
      >
        <span ref={progressBarRef} className="v3-read-progress-fill" />
      </div>
      <div className="v3-sr-only" role="status" aria-live="polite">
        {copyToast}
      </div>

      {/* Mobile Outline Toggle */}
      <button
        type="button"
        className="btn btn-sm reader-mobile-toc-btn"
        aria-expanded={mobileTocOpen}
        onClick={() => setMobileTocOpen((v) => !v)}
      >
        <ListTree size={15} />
        {mobileTocOpen ? '收起课程大纲' : `课程大纲（第 ${lesson.order} 讲 / 共 ${safeLessons.length} 讲）`}
      </button>

      {/* Left Sticky Outline Sidebar */}
      <aside
        className={`reader-sidebar${mobileTocOpen ? '' : ' collapsed-mobile'}`}
        aria-label="课程章节导航"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '2px 8px 10px',
            marginBottom: 8,
            borderBottom: '1px solid var(--border-hairline)',
          }}
        >
          <Link
            to="/learn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--siemens-teal-bright)',
            }}
          >
            <ArrowLeft size={13} />
            返回课程目录
          </Link>
          <span className="badge badge-mono" style={{ fontSize: 10.5 }}>
            {currentIndex + 1}/{safeLessons.length}
          </span>
        </div>

        {sidebarGroups.map((group) => (
          <div key={group.id} className="sidebar-chapter-group">
            <div className="sidebar-chapter-label">{group.label}</div>
            {group.items.map((item) => {
              const isActive = item.id === lesson.id;
              const isDone = isLessonCompleted(item.id);
              return (
                <Link
                  key={item.id}
                  to={`/learn/${item.id}`}
                  className={`sidebar-lesson-link${isActive ? ' active' : ''}`}
                >
                  {isDone ? (
                    <CheckCircle2
                      size={14}
                      color="var(--power-green)"
                      style={{ flexShrink: 0, marginTop: 2 }}
                    />
                  ) : (
                    <Circle
                      size={14}
                      color={isActive ? 'var(--siemens-teal-bright)' : 'var(--ink-muted)'}
                      style={{ flexShrink: 0, marginTop: 2 }}
                    />
                  )}
                  <span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        opacity: 0.75,
                        marginRight: 5,
                      }}
                    >
                      {String(item.order).padStart(2, '0')}
                    </span>
                    {item.title}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </aside>

      {/* Main Immersive Lesson Column */}
      <article className="reader-main">
        <nav className="reader-breadcrumb" aria-label="面包屑">
          <Link to="/learn">课程</Link>
          <ChevronRight size={14} />
          {currentChapter && (
            <>
              <Link to={`/learn?chapter=${encodeURIComponent(currentChapter.id)}`}>
                {currentChapter.title.replace(/：.*$/, '')}
              </Link>
              <ChevronRight size={14} />
            </>
          )}
          <span style={{ color: 'var(--ink-primary)', fontWeight: 600 }}>
            第 {lesson.order} 讲
          </span>
        </nav>

        <header className="reader-header-card">
          <div className="reader-header-meta">
            <span className="badge badge-teal">第 {lesson.order} 讲</span>
            <span className="badge" title="难度">
              <DifficultyStars level={LEVEL_STARS[lesson.level]} />
              难度：{lesson.level}
            </span>
            <span className="badge">
              <Clock size={12} />
              预计 {formatDuration(lesson.minutes)}
            </span>
            {completed && (
              <span className="badge badge-green">
                <CheckCircle2 size={12} />
                已完成
              </span>
            )}
          </div>

          <h1 className="reader-title">{lesson.title}</h1>
          <p className="reader-subtitle">{lesson.subtitle}</p>

          {lesson.tags && lesson.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
              {lesson.tags.map((t) => (
                <span key={t} className="badge" style={{ fontSize: 11.5 }}>
                  #{t}
                </span>
              ))}
            </div>
          )}

          {script && (
            <button
              type="button"
              className="btn btn-primary lecture-start-btn"
              onClick={() => {
                haptic('tap');
                setLectureOpen(true);
              }}
            >
              <PlayCircle size={18} />
              讲课模式：{script.beats.length} 步像老师写板书一样带你过一遍
            </button>
          )}

          {lesson.objectives && lesson.objectives.length > 0 && (
            <div className="objectives-panel">
              <div className="objectives-panel-title">
                <Target size={15} color="var(--siemens-teal-bright)" />
                学完这一讲，你能
              </div>
              <ul className="objectives-list">
                {lesson.objectives.map((obj, idx) => (
                  <li key={idx}>
                    <CheckCircle2
                      size={14}
                      color="var(--siemens-teal-bright)"
                      style={{ flexShrink: 0, marginTop: 3 }}
                    />
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </header>

        <FoldContext.Provider value={{ level: foldLevel, setLevel: setFoldLevel, explicitMarks }}>
        <div className="reader-fold-bar">
          <span className="reader-fold-label" title="第一次学推荐保持默认「精读」；考前快速过一遍可切「要点」或「结论」">
            阅读详略
          </span>
          <FoldSwitch />
          <div className="v3-fold-actions">
            <button
              type="button"
              className={`v3-fold-tool press${notesOpen ? ' is-active' : ''}`}
              aria-expanded={notesOpen}
              onClick={() => {
                haptic('tap');
                setNotesOpen((v) => !v);
              }}
            >
              <NotebookPen size={14} aria-hidden />
              <span>随堂笔记</span>
              {currentNote && <span className="v3-dot" aria-label="已有笔记" />}
            </button>
            <button
              type="button"
              className={`v3-fold-tool press${copiedCard ? ' is-done' : ''}`}
              onClick={handleCopyCheatSheet}
            >
              {copiedCard ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              <span>{copiedCard ? '已复制' : '速查卡'}</span>
            </button>
          </div>
        </div>

        {(foldLevel === 'points' || foldLevel === 'statements') && skeleton.length > 0 && (
          <section className="fold-skeleton" aria-label="本讲骨架">
            <div className="fold-skeleton-head">
              {foldLevel === 'points' ? '本讲骨架（与讲课板书一致）' : '本讲结论'}
            </div>
            <ol>
              {skeleton.map((t, i) => (
                <li key={i}>{renderInlineSafe(t, i)}</li>
              ))}
            </ol>
          </section>
        )}

        {/* Render ALL LessonBlock Variants */}
          <div className={`reader-blocks fold-${foldLevel}`}>
            {lesson.blocks.map((block, idx) => (
              <LessonBlockRenderer key={`${lesson.id}-b-${idx}`} lessonId={lesson.id} block={block} index={idx} />
            ))}
          </div>
        </FoldContext.Provider>

        {/* High-Frequency Interview Tip */}
        {lesson.interviewTip && (foldLevel === 'full' || foldLevel === 'read') && (
          <section className="interview-tip-card">
            <div className="interview-tip-head">
              <BriefcaseBusiness size={17} />
              面试常问（进阶参考）
            </div>
            <MarkdownRenderer content={lesson.interviewTip} />
          </section>
        )}

        {lesson.recap && (
          <section className="lesson-recap" aria-label="本讲小结">
            <span className="lesson-recap-tag">一句话小结</span>
            <p>{lesson.recap}</p>
          </section>
        )}

        <section className="v3-inline-note-card" aria-label="本讲随堂笔记与速查卡">
          <div className="v3-inline-note-preview">
            <strong>{currentNote ? '我的本讲随堂笔记' : '记下本讲关键地址或坑点'}</strong>
            <p>
              {currentNote
                ? currentNote.text
                : '点右边打开笔记抽屉，可一键插入时间戳与 %I0.0 / %Q0.0 / TON 模板，并合入 Markdown 速查卡。'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-sm press"
              onClick={() => {
                haptic('tap');
                setNotesOpen(true);
              }}
            >
              <NotebookPen size={14} aria-hidden />
              {currentNote ? '继续编辑笔记' : '记一条笔记'}
            </button>
            <button
              type="button"
              className={`btn btn-sm press${copiedCard ? ' btn-success' : ' btn-primary'}`}
              onClick={handleCopyCheatSheet}
            >
              {copiedCard ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              {copiedCard ? '已复制 Markdown' : '复制速查卡'}
            </button>
          </div>
        </section>

        <LessonQaSection lessonId={lesson.id} />

        {(foldLevel === 'full' || foldLevel === 'read') && (
          <ExplainBack key={lesson.id} lessonId={lesson.id} lessonTitle={lesson.title} compact />
        )}

        <LessonNotesPanel
          lessonId={lesson.id}
          lessonOrder={lesson.order}
          lessonTitle={lesson.title}
          open={notesOpen}
          onClose={() => setNotesOpen(false)}
          onCopyCheatSheet={handleCopyCheatSheet}
          copied={copiedCard}
        />

        {lectureOpen && script && (
          <LecturePlayer script={script} lessonTitle={lesson.title} onClose={closeLecture} />
        )}

        <LessonCelebration lessonId={lesson.id} order={lesson.order} completed={completed} />

        {/* Lesson Completion Check-in Bar */}
        <section className={`lesson-complete-bar${completed ? ' done' : ''}`}>
          <div>
            <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 3 }}>
              {completed ? '这一讲已完成！' : '学完这一讲了吗？'}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-secondary)' }}>
              {completed
                ? '可以继续下一讲，也可以随时回来复习。'
                : '点右边按钮标记完成；小测验全部答对也会自动标记。'}
            </div>
          </div>

          <button
            type="button"
            className={`btn ${completed ? 'btn-success' : 'btn-primary'}`}
            aria-pressed={completed}
            onClick={() => {
              haptic(completed ? 'tap' : 'success');
              toggleLessonComplete(lesson.id);
            }}
          >
            <CheckCircle2 size={16} />
            {completed ? '已完成（点击取消）' : '标记为已完成'}
          </button>
          {completed && nextLesson && (
            <Link to={`/learn/${nextLesson.id}`} className="btn btn-primary lesson-complete-next">
              继续下一讲
              <ArrowRight size={16} />
            </Link>
          )}
        </section>

        {/* Prev / Next Smooth Lesson Navigation */}
        <nav className="lesson-nav-grid" aria-label="课时切换">
          {prevLesson ? (
            <Link to={`/learn/${prevLesson.id}`} className="lesson-nav-card">
              <span className="lesson-nav-dir">
                <ArrowLeft size={13} />
                上一讲 · 第 {prevLesson.order} 讲
              </span>
              <span className="lesson-nav-name">{prevLesson.title}</span>
            </Link>
          ) : (
            <Link to="/learn" className="lesson-nav-card">
              <span className="lesson-nav-dir">
                <ArrowLeft size={13} />
                返回总览
              </span>
              <span className="lesson-nav-name">查看全部课程目录</span>
            </Link>
          )}

          {nextLesson ? (
            <Link to={`/learn/${nextLesson.id}`} className="lesson-nav-card next">
              <span className="lesson-nav-dir">
                下一讲 · 第 {nextLesson.order} 讲
                <ArrowRight size={13} />
              </span>
              <span className="lesson-nav-name">{nextLesson.title}</span>
            </Link>
          ) : (
            <Link
              to="/capstone"
              className="lesson-nav-card next"
              style={{ borderColor: 'var(--alarm-amber-border)' }}
            >
              <span className="lesson-nav-dir" style={{ color: 'var(--alarm-amber)' }}>
                <Star size={13} />
                全部课程学完了
                <ArrowRight size={13} />
              </span>
              <span className="lesson-nav-name">挑战毕业项目 ★</span>
            </Link>
          )}
        </nav>
      </article>
    </div>
  );
};
