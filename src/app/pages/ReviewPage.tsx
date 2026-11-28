import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpenCheck, CalendarCheck2, Flame, Layers3, MessageSquareText, NotebookPen, RotateCcw, X, Zap } from 'lucide-react';
import { chapters, lessons } from '../../registry';
import { useProgress } from '../store/progressStore';
import { buildDeck, type Flashcard } from '../../features/study/deck';
import { removeMistake, retryMistake, reviewCard, setDailyNew, streak, today, useStudy } from '../../features/study/studyStore';
import { ExplainBack } from '../../features/study/ExplainBack';
import { ChapterDiagnosisPanel } from '../../features/study/ChapterDiagnosisPanel';
import { InteractiveDrills, loadTodayDrillProgress } from '../../features/study/InteractiveDrills';
import { renderInline } from '../../components/MarkdownRenderer';
import { haptic } from '../native/platform';
import '../../features/study/study-v3.css';

type Tab = 'today' | 'drills' | 'cards' | 'mistakes' | 'explain';
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'today', label: '今日', icon: CalendarCheck2 },
  { id: 'drills', label: '15 秒互动微练', icon: Zap },
  { id: 'cards', label: '记忆卡片', icon: Layers3 },
  { id: 'mistakes', label: '错题本', icon: NotebookPen },
  { id: 'explain', label: '讲给自己听', icon: MessageSquareText },
];

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function useQueue(deck: Flashcard[]) {
  const st = useStudy();
  const d = today();
  return useMemo(() => {
    const due = deck.filter((c) => st.cards[c.id] && st.cards[c.id].due <= d);
    const newLeft = Math.max(0, st.dailyNew - (st.newToday.date === d ? st.newToday.n : 0));
    const fresh = deck.filter((c) => !st.cards[c.id]).slice(0, newLeft);
    return { due, fresh, queue: [...due, ...fresh], total: deck.length, learned: Object.keys(st.cards).length };
  }, [deck, st, d]);
}

function previewIntervalLabel(prev: { ef: number; interval: number; reps: number } | undefined, q: 1 | 3 | 5): string {
  if (q === 1) return '今天再来';
  const reps = (prev?.reps ?? 0) + 1;
  if (reps === 1) return q === 3 ? '明天巩固' : '明天 · 加速';
  if (reps === 2) return '6 天后';
  const baseEf = prev?.ef ?? 2.5;
  const nextDays = Math.max(1, Math.round((prev?.interval ?? 6) * baseEf));
  return `${nextDays} 天后`;
}

const CardsTab: React.FC<{ deck: Flashcard[] }> = ({ deck }) => {
  const st = useStudy();
  const { queue, due, fresh, total, learned } = useQueue(deck);
  const [flipped, setFlipped] = useState(false);
  const [feedback, setFeedback] = useState('');
  const card = queue[0];
  const lessonMap = useMemo(() => new Map(lessons.map((l) => [l.id, l])), []);

  const grade = useCallback(
    (q: 1 | 3 | 5, label: string) => {
      if (!card) return;
      haptic(q === 1 ? 'error' : 'tap');
      const nextState = reviewCard(card.id, q);
      setFlipped(false);
      setFeedback(
        nextState.interval === 0
          ? `已标记“${label}”，这张卡今天稍后会再出现。`
          : `已标记“${label}”，下次复习：${nextState.interval} 天后（${nextState.due}）。`,
      );
    },
    [card],
  );

  // 记忆闪卡键盘快捷键：Space 翻面，1 忘了 / 2 有点熟 / 3 记牢了
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || !card) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (!flipped) {
          haptic('tap');
          setFlipped(true);
        }
        return;
      }
      if (!flipped) return;
      if (e.key === '1') {
        e.preventDefault();
        grade(1, '忘了');
      } else if (e.key === '2') {
        e.preventDefault();
        grade(3, '有点熟');
      } else if (e.key === '3') {
        e.preventDefault();
        grade(5, '记牢了');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, flipped, grade]);

  const cardState = card ? st.cards[card.id] : undefined;

  return (
    <div className="rv-cards">
      <div className="rv-stats">
        <span>
          到期 <b>{due.length}</b>
        </span>
        <span>
          今日新卡 <b>{fresh.length}</b>
        </span>
        <span>
          已学 <b>{learned}</b> / {total}
        </span>
        <label className="rv-daily">
          每天新卡
          <select value={st.dailyNew} onChange={(e) => setDailyNew(Number(e.target.value))}>
            {[0, 5, 8, 12, 20].map((n) => (
              <option key={n} value={n}>
                {n} 张
              </option>
            ))}
          </select>
        </label>
      </div>
      {card ? (
        <>
          <button
            type="button"
            className={`rv-card${flipped ? ' is-flipped' : ''}`}
            onClick={() => {
              haptic('tap');
              setFlipped((f) => !f);
            }}
            aria-label={flipped ? '卡片背面，点一下合回正面' : '卡片正面，点一下或按空格翻面'}
            aria-keyshortcuts="Space"
          >
            <span className="rv-card-kind">{card.kind}</span>
            <span className="rv-card-front">{renderInline(card.front, 'cf')}</span>
            {flipped ? (
              <span className="rv-card-back">
                {renderInline(card.back, 'cb')}
                {card.lessonId && lessonMap.get(card.lessonId) && (
                  <span className="rv-card-src">出自第 {lessonMap.get(card.lessonId)!.order} 讲</span>
                )}
              </span>
            ) : (
              <span className="rv-card-hint">先在心里回答，再点一下或按 Space 翻面</span>
            )}
          </button>
          {flipped ? (
            <div className="rv-grades v3-grades-3" role="group" aria-label="记忆熟练度评分">
              <button type="button" className="g1 press" onClick={() => grade(1, '忘了')} aria-keyshortcuts="1">
                <span className="v3-grade-top">
                  <kbd className="v3-kbd" aria-hidden>1</kbd>
                  忘了
                </span>
                <small>{previewIntervalLabel(cardState, 1)}</small>
              </button>
              <button type="button" className="g3 press" onClick={() => grade(3, '有点熟')} aria-keyshortcuts="2">
                <span className="v3-grade-top">
                  <kbd className="v3-kbd" aria-hidden>2</kbd>
                  有点熟
                </span>
                <small>{previewIntervalLabel(cardState, 3)}</small>
              </button>
              <button type="button" className="g5 press" onClick={() => grade(5, '记牢了')} aria-keyshortcuts="3">
                <span className="v3-grade-top">
                  <kbd className="v3-kbd" aria-hidden>3</kbd>
                  记牢了
                </span>
                <small>{previewIntervalLabel(cardState, 5)}</small>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary rv-flip press"
              onClick={() => {
                haptic('tap');
                setFlipped(true);
              }}
              aria-keyshortcuts="Space"
            >
              翻面看答案
              <kbd className="v3-kbd" aria-hidden>Space</kbd>
            </button>
          )}
          <p className="v3-card-feedback" role="status" aria-live="polite">
            {feedback}
          </p>
          <p className="rv-note">
            键盘快捷操作：Space 翻面，1 忘了 / 2 有点熟 / 3 记牢了。按 SM-2 间隔复习安排下次出现时间，“忘了”会在今天重新出现。
          </p>
        </>
      ) : (
        <div className="rv-empty">
          <BookOpenCheck size={28} />
          <p>今天的卡片都复习完了。明天再来，或者把“每天新卡”调多一点。</p>
        </div>
      )}
    </div>
  );
};

const MistakesTab: React.FC<{ chapterFilter: string | null; onClearChapter: () => void }> = ({
  chapterFilter,
  onClearChapter,
}) => {
  const st = useStudy();
  const [showResolved, setShowResolved] = useState(false);
  const [pick, setPick] = useState<Record<string, number>>({});
  const [result, setResult] = useState<Record<string, boolean>>({});
  const lessonMap = useMemo(() => new Map(lessons.map((l) => [l.id, l])), []);
  const activeChapter = useMemo(
    () => (chapterFilter ? chapters.find((c) => c.id === chapterFilter) ?? null : null),
    [chapterFilter],
  );
  const all = useMemo(() => {
    const items = Object.values(st.mistakes).sort((a, b) => b.lastAt - a.lastAt);
    if (!chapterFilter) return items;
    return items.filter((m) => lessonMap.get(m.lessonId)?.chapterId === chapterFilter);
  }, [st.mistakes, chapterFilter, lessonMap]);
  // 本次刚重做过的题先留在原列表里，让用户看到对错和解析
  const list = all.filter((m) => (showResolved ? m.resolved && result[m.key] === undefined : !m.resolved || result[m.key] !== undefined));

  return (
    <div className="rv-mistakes">
      {activeChapter && (
        <div className="v3-chapter-filter-banner" role="status">
          <span>
            当前只看：<strong>{activeChapter.title}</strong> 的错题
          </span>
          <button type="button" className="btn btn-sm press" onClick={onClearChapter}>
            <X size={13} aria-hidden />
            查看全部章节
          </button>
        </div>
      )}
      <div className="rv-seg" role="tablist">
        <button type="button" role="tab" aria-selected={!showResolved} className={!showResolved ? 'on' : ''} onClick={() => setShowResolved(false)}>
          待巩固 {all.filter((m) => !m.resolved).length}
        </button>
        <button type="button" role="tab" aria-selected={showResolved} className={showResolved ? 'on' : ''} onClick={() => setShowResolved(true)}>
          已掌握 {all.filter((m) => m.resolved).length}
        </button>
      </div>
      {list.length === 0 && (
        <div className="rv-empty">
          <NotebookPen size={28} />
          <p>{showResolved ? '重做答对的题会出现在这里。' : '还没有错题。每讲末尾的小测验答错的题会自动收进来。'}</p>
          {!showResolved && (
            <Link to="/learn" className="btn btn-sm">
              去做小测验
            </Link>
          )}
        </div>
      )}
      {list.map((m) => {
        const l = lessonMap.get(m.lessonId);
        const r = result[m.key];
        return (
          <article key={m.key} className={`rv-mistake${r === true ? ' ok' : r === false ? ' bad' : ''}`}>
            <div className="rv-mistake-meta">
              {l ? (
                <Link to={`/learn/${l.id}`}>
                  第 {l.order} 讲 · {l.title}
                </Link>
              ) : (
                <span>课程</span>
              )}
              <span>错 {m.wrongCount} 次</span>
            </div>
            <p className="rv-q">{m.question}</p>
            <div className="rv-opts">
              {m.options.map((o, i) => (
                <button
                  key={i}
                  type="button"
                  className={`rv-opt${pick[m.key] === i ? ' sel' : ''}${r !== undefined && i === m.answer ? ' ans' : ''}`}
                  disabled={r !== undefined || m.resolved}
                  onClick={() => {
                    haptic('tap');
                    setPick((p) => ({ ...p, [m.key]: i }));
                  }}
                >
                  <b>{LETTERS[i]}</b> {o}
                </button>
              ))}
            </div>
            {!m.resolved && r === undefined && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={pick[m.key] === undefined}
                onClick={() => {
                  const ok = retryMistake(m.key, pick[m.key]);
                  haptic(ok ? 'success' : 'error');
                  setResult((x) => ({ ...x, [m.key]: ok }));
                }}
              >
                提交重做
              </button>
            )}
            {(r !== undefined || m.resolved) && (
              <div className="rv-explain" role="status">
                <b>{r === false ? `还是不对：正确答案是 ${LETTERS[m.answer]}。` : `正确答案 ${LETTERS[m.answer]}。`}</b> {m.explain}
                <div className="rv-mistake-actions">
                  {r === false && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        setResult((x) => {
                          const n = { ...x };
                          delete n[m.key];
                          return n;
                        });
                        setPick((p) => {
                          const n = { ...p };
                          delete n[m.key];
                          return n;
                        });
                      }}
                    >
                      <RotateCcw size={14} /> 再做一次
                    </button>
                  )}
                  {m.resolved && (
                    <button type="button" className="btn btn-sm" onClick={() => removeMistake(m.key)}>
                      移出错题本
                    </button>
                  )}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
};

export const ReviewPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'today';
  const mistakeChapter = params.get('chapter');
  const setTab = (t: Tab) => {
    haptic('tap');
    setParams({ tab: t }, { replace: true });
  };
  const jumpChapterMistakes = (chapterId: string) => {
    haptic('tap');
    setParams({ tab: 'mistakes', chapter: chapterId }, { replace: true });
  };
  const clearMistakeChapter = () => {
    haptic('tap');
    setParams({ tab: 'mistakes' }, { replace: true });
  };
  const st = useStudy();
  const { isLessonCompleted, state: progress } = useProgress();
  const deck = useMemo(() => buildDeck(), []);
  const { due, fresh } = useQueue(deck);
  const sorted = useMemo(() => [...lessons].sort((a, b) => a.order - b.order), []);
  const next = sorted.find((l) => !isLessonCompleted(l.id));
  const openMistakes = Object.values(st.mistakes).filter((m) => !m.resolved).length;
  const [todayDrillCount, setTodayDrillCount] = useState<number>(
    () => loadTodayDrillProgress().doneIds.length,
  );
  const s = streak(st.days);
  const [explainId, setExplainId] = useState<string>(() => params.get('lesson') || progress.lastVisitedLessonId || sorted[0]?.id);
  const paramLesson = params.get('lesson');
  useEffect(() => {
    if (paramLesson) setExplainId(paramLesson);
  }, [paramLesson]);
  const explainLesson = sorted.find((l) => l.id === explainId) ?? sorted[0];

  // 最近 14 天打卡格
  const days = Array.from({ length: 14 }, (_, i) => today(i - 13));

  return (
    <div className="spa-container rv-page">
      <header className="rv-head">
        <h1>复习</h1>
        <p>学过的东西要“拿出来用”才记得住：翻卡片、重做错题、用自己的话讲一遍。全部保存在本机。</p>
      </header>
      <nav className="rv-tabs" role="tablist" aria-label="复习方式">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            <Icon size={15} /> {label}
            {id === 'drills' && <span className="rv-badge">{Math.min(3, todayDrillCount)}/3</span>}
            {id === 'cards' && due.length + fresh.length > 0 && <span className="rv-badge">{due.length + fresh.length}</span>}
            {id === 'mistakes' && openMistakes > 0 && <span className="rv-badge warn">{openMistakes}</span>}
          </button>
        ))}
      </nav>

      {tab === 'today' && (
        <div className="rv-today">
          <section className="rv-streak">
            <Flame size={22} />
            <div>
              <b>{s > 0 ? `连续学习 ${s} 天` : '今天开始打卡'}</b>
              <span>复习卡片、做测验、写解释，都算当天学过。</span>
            </div>
            <ol className="rv-days" aria-label="最近 14 天">
              {days.map((d) => (
                <li key={d} className={st.days.includes(d) ? 'on' : ''} title={d} aria-label={`${d}${st.days.includes(d) ? ' 学过' : ''}`} />
              ))}
            </ol>
          </section>
          <ChapterDiagnosisPanel
            onJumpMistakes={jumpChapterMistakes}
            onJumpCards={() => setTab('cards')}
          />
          <h2 className="rv-h2">今天的计划</h2>
          <ol className="rv-plan">
            <li>
              <span className="rv-plan-no">1</span>
              <div>
                <b>学一讲新课</b>
                <span>{next ? `第 ${next.order} 讲：${next.title}` : '全部课程都学完了，挑战毕业项目吧。'}</span>
              </div>
              {next ? (
                <Link className="btn btn-primary btn-sm" to={`/learn/${next.id}`}>
                  去学
                </Link>
              ) : (
                <Link className="btn btn-sm" to="/capstone">
                  毕业项目
                </Link>
              )}
            </li>
            <li>
              <span className="rv-plan-no">2</span>
              <div>
                <b>刷 3 道 15 秒互动微练（读图速判 · 看图挑刺 · 地址速译）</b>
                <span>今日已完成 {todayDrillCount} 题，比纯背卡片更练现场直觉</span>
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setTab('drills')}>
                {todayDrillCount >= 3 ? '再刷几题' : '开始速练'}
              </button>
            </li>
            <li>
              <span className="rv-plan-no">3</span>
              <div>
                <b>复习卡片</b>
                <span>
                  到期 {due.length} 张，新卡 {fresh.length} 张（约 {Math.max(1, Math.round((due.length + fresh.length) * 0.25))} 分钟）
                </span>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setTab('cards')} disabled={due.length + fresh.length === 0}>
                {due.length + fresh.length ? '开始' : '已完成'}
              </button>
            </li>
            <li>
              <span className="rv-plan-no">4</span>
              <div>
                <b>重做错题</b>
                <span>{openMistakes ? `还有 ${openMistakes} 道待巩固` : '没有待巩固的错题'}</span>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setTab('mistakes')} disabled={!openMistakes}>
                {openMistakes ? '重做' : '已清空'}
              </button>
            </li>
            <li>
              <span className="rv-plan-no">5</span>
              <div>
                <b>讲给自己听</b>
                <span>挑刚学完的一讲，用自己的话讲一遍</span>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setTab('explain')}>
                去写
              </button>
            </li>
          </ol>
        </div>
      )}

      {tab === 'drills' && <InteractiveDrills onProgressChange={setTodayDrillCount} />}
      {tab === 'cards' && <CardsTab deck={deck} />}
      {tab === 'mistakes' && (
        <MistakesTab chapterFilter={mistakeChapter} onClearChapter={clearMistakeChapter} />
      )}
      {tab === 'explain' && explainLesson && (
        <div className="rv-explain-tab">
          <label className="rv-select">
            选择一讲
            <select value={explainLesson.id} onChange={(e) => setExplainId(e.target.value)}>
              {sorted.map((l) => (
                <option key={l.id} value={l.id}>
                  {`第 ${l.order} 讲 ${l.title}${st.explains[l.id] ? ' ✓' : ''}`}
                </option>
              ))}
            </select>
          </label>
          <ExplainBack key={explainLesson.id} lessonId={explainLesson.id} lessonTitle={explainLesson.title} />
        </div>
      )}
    </div>
  );
};
