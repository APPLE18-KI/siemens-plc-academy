import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { runViewTransition } from '../layout/viewTransition';

export type ThemeMode = 'dark' | 'light';

export interface QuizScoreRecord {
  score: number;
  total: number;
  bestPct: number;
  attempts: number;
  lastUpdated: string;
}

export interface PracticeCheckinRecord {
  checkedSteps: number[];
  checkedPoints: number[];
  completed: boolean;
  updatedAt: string;
}

export interface ProgressState {
  version: 1;
  theme: ThemeMode;
  completedLessonIds: string[];
  quizHighScores: Record<string, QuizScoreRecord>;
  practiceCheckins: Record<string, PracticeCheckinRecord>;
  capstoneMilestones: Record<string, boolean>;
  visitedExampleIds: string[];
  lastVisitedLessonId: string | null;
  studyStreakDays: number;
  lastStudyDate: string | null;
  activeDates: string[];
}

export interface MasteryStats {
  completedLessons: number;
  totalLessons: number;
  lessonPct: number;
  quizzesPassed: number;
  averageQuizPct: number;
  practiceTasksDone: number;
  capstoneDone: number;
  capstoneTotal: number;
  capstonePct: number;
  examplesStudied: number;
  streakDays: number;
  overallMasteryPct: number;
  engineerRank: string;
}

export const CAPSTONE_MILESTONE_CATALOG = [
  { id: 'ms-io-arch', label: '阶段 1：硬件组态与 I/O 规划' },
  { id: 'ms-packml', label: '阶段 2：PackML 状态机与安全急停' },
  { id: 'ms-vision-sort', label: '阶段 3：PROFINET 视觉分拣与输送联锁' },
  { id: 'ms-pid-press', label: '阶段 4：热压站 PID 精密温控与报警' },
  { id: 'ms-scada-resume', label: '阶段 5：SCADA 联调与简历话术定稿' },
] as const;

export const PROGRESS_STORAGE_KEY = 'siemens-plc-academy-progress-v1';

/**
 * 内存级 localStorage 缓存（vercel-react-best-practices: js-cache-storage）：
 * 避免重复同步 I/O，并在跨标签页 storage 事件或页面重新可见时自动失效。
 */
const storageCache = new Map<string, string | null>();
let storageCacheListenersInstalled = false;

function ensureStorageCacheInvalidation(): void {
  if (storageCacheListenersInstalled || typeof window === 'undefined') return;
  storageCacheListenersInstalled = true;
  window.addEventListener('storage', (e) => {
    if (e.key) {
      storageCache.delete(e.key);
    } else {
      storageCache.clear();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      storageCache.clear();
    }
  });
}

export function invalidateProgressStorageCache(): void {
  storageCache.clear();
}

function cachedGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  ensureStorageCacheInvalidation();
  if (!storageCache.has(key)) {
    storageCache.set(key, window.localStorage.getItem(key));
  }
  return storageCache.get(key) ?? null;
}

function cachedSetItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
  storageCache.set(key, value);
}

function syncDocumentTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = theme === 'light' ? '#eef0f4' : '#0a0f14';
  }
}

function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getYesterdayKey(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function createDefaultState(): ProgressState {
  return {
    version: 1,
    theme: 'dark',
    completedLessonIds: [],
    quizHighScores: {},
    practiceCheckins: {},
    capstoneMilestones: {},
    visitedExampleIds: [],
    lastVisitedLessonId: null,
    studyStreakDays: 0,
    lastStudyDate: null,
    activeDates: [],
  };
}

function touchStudyActivity(state: ProgressState): ProgressState {
  const today = getTodayKey();
  if (state.lastStudyDate === today) {
    return state;
  }
  const yesterday = getYesterdayKey();
  const nextStreak =
    state.lastStudyDate === yesterday ? Math.max(1, state.studyStreakDays + 1) : 1;
  const nextDates = state.activeDates.includes(today)
    ? state.activeDates
    : [...state.activeDates.slice(-59), today];
  return {
    ...state,
    studyStreakDays: nextStreak,
    lastStudyDate: today,
    activeDates: nextDates,
  };
}

export function loadProgressState(): ProgressState {
  try {
    const raw = cachedGetItem(PROGRESS_STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    if (!parsed || typeof parsed !== 'object') return createDefaultState();
    return {
      version: 1,
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      completedLessonIds: Array.isArray(parsed.completedLessonIds)
        ? parsed.completedLessonIds.filter((x): x is string => typeof x === 'string')
        : [],
      quizHighScores:
        parsed.quizHighScores && typeof parsed.quizHighScores === 'object'
          ? parsed.quizHighScores
          : {},
      practiceCheckins:
        parsed.practiceCheckins && typeof parsed.practiceCheckins === 'object'
          ? parsed.practiceCheckins
          : {},
      capstoneMilestones:
        parsed.capstoneMilestones && typeof parsed.capstoneMilestones === 'object'
          ? parsed.capstoneMilestones
          : {},
      visitedExampleIds: Array.isArray(parsed.visitedExampleIds)
        ? parsed.visitedExampleIds.filter((x): x is string => typeof x === 'string')
        : [],
      lastVisitedLessonId:
        typeof parsed.lastVisitedLessonId === 'string' ? parsed.lastVisitedLessonId : null,
      studyStreakDays:
        typeof parsed.studyStreakDays === 'number' && parsed.studyStreakDays >= 0
          ? parsed.studyStreakDays
          : 0,
      lastStudyDate: typeof parsed.lastStudyDate === 'string' ? parsed.lastStudyDate : null,
      activeDates: Array.isArray(parsed.activeDates)
        ? parsed.activeDates.filter((x): x is string => typeof x === 'string')
        : [],
    };
  } catch {
    return createDefaultState();
  }
}

export function saveProgressState(state: ProgressState): void {
  try {
    cachedSetItem(PROGRESS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota or private mode errors gracefully
  }
}

export function computeMasteryStats(state: ProgressState, totalLessons: number): MasteryStats {
  const safeTotalLessons = Math.max(totalLessons, 1);
  const completedLessons = state.completedLessonIds.length;
  const lessonPct = Math.min(100, Math.round((completedLessons / safeTotalLessons) * 100));

  const quizEntries = Object.values(state.quizHighScores);
  const quizzesPassed = quizEntries.filter((q) => q.bestPct >= 80).length;
  const averageQuizPct =
    quizEntries.length > 0
      ? Math.round(quizEntries.reduce((acc, q) => acc + q.bestPct, 0) / quizEntries.length)
      : 0;

  const practiceTasksDone = Object.values(state.practiceCheckins).filter((p) => p.completed).length;

  const milestoneKeys = new Set<string>([
    ...CAPSTONE_MILESTONE_CATALOG.map((m) => m.id),
    ...Object.keys(state.capstoneMilestones),
  ]);
  const capstoneTotal = Math.max(milestoneKeys.size, CAPSTONE_MILESTONE_CATALOG.length);
  const capstoneDone = Array.from(milestoneKeys).filter((k) => state.capstoneMilestones[k]).length;
  const capstonePct = Math.min(100, Math.round((capstoneDone / capstoneTotal) * 100));

  const examplesStudied = state.visitedExampleIds.length;

  // Weighted competency mastery: 55% lessons, 20% quizzes, 10% practice & examples, 15% capstone
  const quizWeightPct =
    totalLessons > 0
      ? Math.min(100, Math.round((quizzesPassed / Math.max(1, totalLessons * 0.6)) * 100))
      : averageQuizPct;
  const handsOnPct = Math.min(100, Math.round(((practiceTasksDone + examplesStudied) / 10) * 100));
  const overallMasteryPct = Math.min(
    100,
    Math.round(lessonPct * 0.55 + quizWeightPct * 0.2 + handsOnPct * 0.1 + capstonePct * 0.15)
  );

  let engineerRank = '见习电气学徒';
  if (overallMasteryPct >= 85) {
    engineerRank = 'S7-1200 自动化项目工程师';
  } else if (overallMasteryPct >= 60) {
    engineerRank = 'PLC 现场调试工程师';
  } else if (overallMasteryPct >= 35) {
    engineerRank = '博途控制逻辑工程师';
  } else if (overallMasteryPct >= 12) {
    engineerRank = '工业自动化入门学员';
  }

  // Validate streak currency (if user hasn't studied today or yesterday, display 0 or keep active if today/yesterday)
  const today = getTodayKey();
  const yesterday = getYesterdayKey();
  const streakDays =
    state.lastStudyDate === today || state.lastStudyDate === yesterday
      ? state.studyStreakDays
      : 0;

  return {
    completedLessons,
    totalLessons,
    lessonPct,
    quizzesPassed,
    averageQuizPct,
    practiceTasksDone,
    capstoneDone,
    capstoneTotal,
    capstonePct,
    examplesStudied,
    streakDays,
    overallMasteryPct,
    engineerRank,
  };
}

export interface ProgressContextValue {
  state: ProgressState;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  isLessonCompleted: (lessonId: string) => boolean;
  markLessonComplete: (lessonId: string) => void;
  toggleLessonComplete: (lessonId: string) => void;
  setLastVisitedLesson: (lessonId: string) => void;
  recordQuizScore: (lessonId: string, score: number, total: number) => void;
  togglePracticeItem: (
    taskKey: string,
    kind: 'step' | 'point',
    index: number,
    totalSteps: number,
    totalPoints: number
  ) => void;
  toggleCapstoneMilestone: (milestoneId: string, forceValue?: boolean) => void;
  markExampleVisited: (exampleId: string) => void;
  resetAllProgress: () => void;
  getStats: (totalLessons: number) => MasteryStats;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export const ProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ProgressState>(() => loadProgressState());

  useEffect(() => {
    syncDocumentTheme(state.theme);
    saveProgressState(state);
  }, [state]);

  const toggleTheme = useCallback(() => {
    runViewTransition(() => {
      setState((prev) => {
        const nextTheme: ThemeMode = prev.theme === 'dark' ? 'light' : 'dark';
        syncDocumentTheme(nextTheme);
        return {
          ...prev,
          theme: nextTheme,
        };
      });
    }, 'theme');
  }, []);

  const setTheme = useCallback((theme: ThemeMode) => {
    runViewTransition(() => {
      syncDocumentTheme(theme);
      setState((prev) => (prev.theme === theme ? prev : { ...prev, theme }));
    }, 'theme');
  }, []);

  const isLessonCompleted = useCallback(
    (lessonId: string) => state.completedLessonIds.includes(lessonId),
    [state.completedLessonIds]
  );

  const markLessonComplete = useCallback((lessonId: string) => {
    setState((prev) => {
      const next = touchStudyActivity(prev);
      if (next.completedLessonIds.includes(lessonId)) return next;
      return {
        ...next,
        completedLessonIds: [...next.completedLessonIds, lessonId],
      };
    });
  }, []);

  const toggleLessonComplete = useCallback((lessonId: string) => {
    setState((prev) => {
      const next = touchStudyActivity(prev);
      const exists = next.completedLessonIds.includes(lessonId);
      return {
        ...next,
        completedLessonIds: exists
          ? next.completedLessonIds.filter((id) => id !== lessonId)
          : [...next.completedLessonIds, lessonId],
      };
    });
  }, []);

  const setLastVisitedLesson = useCallback((lessonId: string) => {
    setState((prev) => {
      if (prev.lastVisitedLessonId === lessonId && prev.lastStudyDate === getTodayKey()) {
        return prev;
      }
      const next = touchStudyActivity(prev);
      return { ...next, lastVisitedLessonId: lessonId };
    });
  }, []);

  const recordQuizScore = useCallback((lessonId: string, score: number, total: number) => {
    if (total <= 0) return;
    const pct = Math.round((score / total) * 100);
    setState((prev) => {
      const next = touchStudyActivity(prev);
      const existing = next.quizHighScores[lessonId];
      const bestPct = existing ? Math.max(existing.bestPct, pct) : pct;
      const bestScore = existing ? Math.max(existing.score, score) : score;
      const nextCompleted =
        score === total && !next.completedLessonIds.includes(lessonId)
          ? [...next.completedLessonIds, lessonId]
          : next.completedLessonIds;

      return {
        ...next,
        completedLessonIds: nextCompleted,
        quizHighScores: {
          ...next.quizHighScores,
          [lessonId]: {
            score: bestScore,
            total,
            bestPct,
            attempts: (existing?.attempts ?? 0) + 1,
            lastUpdated: new Date().toISOString(),
          },
        },
      };
    });
  }, []);

  const togglePracticeItem = useCallback(
    (
      taskKey: string,
      kind: 'step' | 'point',
      index: number,
      totalSteps: number,
      totalPoints: number
    ) => {
      setState((prev) => {
        const next = touchStudyActivity(prev);
        const existing = next.practiceCheckins[taskKey] ?? {
          checkedSteps: [],
          checkedPoints: [],
          completed: false,
          updatedAt: new Date().toISOString(),
        };
        const targetList = kind === 'step' ? existing.checkedSteps : existing.checkedPoints;
        const updatedList = targetList.includes(index)
          ? targetList.filter((i) => i !== index)
          : [...targetList, index].sort((a, b) => a - b);

        const nextSteps = kind === 'step' ? updatedList : existing.checkedSteps;
        const nextPoints = kind === 'point' ? updatedList : existing.checkedPoints;
        const completed = nextSteps.length >= totalSteps && nextPoints.length >= totalPoints;

        return {
          ...next,
          practiceCheckins: {
            ...next.practiceCheckins,
            [taskKey]: {
              checkedSteps: nextSteps,
              checkedPoints: nextPoints,
              completed,
              updatedAt: new Date().toISOString(),
            },
          },
        };
      });
    },
    []
  );

  const toggleCapstoneMilestone = useCallback((milestoneId: string, forceValue?: boolean) => {
    setState((prev) => {
      const next = touchStudyActivity(prev);
      const current = Boolean(next.capstoneMilestones[milestoneId]);
      return {
        ...next,
        capstoneMilestones: {
          ...next.capstoneMilestones,
          [milestoneId]: forceValue !== undefined ? forceValue : !current,
        },
      };
    });
  }, []);

  const markExampleVisited = useCallback((exampleId: string) => {
    setState((prev) => {
      if (prev.visitedExampleIds.includes(exampleId)) return prev;
      const next = touchStudyActivity(prev);
      return {
        ...next,
        visitedExampleIds: [...next.visitedExampleIds, exampleId],
      };
    });
  }, []);

  const resetAllProgress = useCallback(() => {
    setState((prev) => ({
      ...createDefaultState(),
      theme: prev.theme,
    }));
  }, []);

  const getStats = useCallback(
    (totalLessons: number) => computeMasteryStats(state, totalLessons),
    [state]
  );

  const value = useMemo<ProgressContextValue>(
    () => ({
      state,
      toggleTheme,
      setTheme,
      isLessonCompleted,
      markLessonComplete,
      toggleLessonComplete,
      setLastVisitedLesson,
      recordQuizScore,
      togglePracticeItem,
      toggleCapstoneMilestone,
      markExampleVisited,
      resetAllProgress,
      getStats,
    }),
    [
      state,
      toggleTheme,
      setTheme,
      isLessonCompleted,
      markLessonComplete,
      toggleLessonComplete,
      setLastVisitedLesson,
      recordQuizScore,
      togglePracticeItem,
      toggleCapstoneMilestone,
      markExampleVisited,
      resetAllProgress,
      getStats,
    ]
  );

  return React.createElement(ProgressContext.Provider, { value }, children);
};

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error('useProgress 必须在 ProgressProvider 内使用');
  }
  return ctx;
}
