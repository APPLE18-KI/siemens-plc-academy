import { useSyncExternalStore } from 'react';
import type { QuizQuestion } from '../../types/content';

/**
 * 复习中心的本地数据（只存在本机 localStorage，不上传）：
 * - 间隔复习卡片的 SM-2 状态
 * - 错题本（来自随堂测验的错题）
 * - “用自己的话解释”的草稿与自查结果
 * - 每日学习记录（连续学习天数）
 */

export interface CardState {
  ef: number;
  interval: number;
  reps: number;
  due: string; // YYYY-MM-DD
  lapses: number;
}

export interface Mistake {
  key: string;
  lessonId: string;
  qIndex: number;
  question: string;
  options: string[];
  answer: number;
  explain: string;
  picked: number;
  wrongCount: number;
  lastAt: number;
  resolved: boolean;
}

export interface ExplainEntry {
  text: string;
  at: number;
  selfChecked: string[];
}

export interface StudyState {
  version: 1;
  cards: Record<string, CardState>;
  mistakes: Record<string, Mistake>;
  explains: Record<string, ExplainEntry>;
  /** 有学习行为的日期（YYYY-MM-DD） */
  days: string[];
  /** 今天新学的卡片数（每日上限） */
  newToday: { date: string; n: number };
  dailyNew: number;
}

const KEY = 'plc-study-v1';

export function today(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function empty(): StudyState {
  return { version: 1, cards: {}, mistakes: {}, explains: {}, days: [], newToday: { date: today(), n: 0 }, dailyNew: 8 };
}

function load(): StudyState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const v = JSON.parse(raw) as StudyState;
    if (v.version !== 1) return empty();
    return { ...empty(), ...v };
  } catch {
    return empty();
  }
}

let state: StudyState = typeof window === 'undefined' ? empty() : load();
const listeners = new Set<() => void>();

function commit(next: StudyState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 存储满或隐私模式：只在内存里保留 */
  }
  listeners.forEach((l) => l());
}

function markActive(s: StudyState): StudyState {
  const d = today();
  return s.days.includes(d) ? s : { ...s, days: [...s.days, d].slice(-400) };
}

export function useStudy(): StudyState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

/* ───────── SM-2 ───────── */

/** 评分：1 忘了 / 3 模糊 / 4 记得 / 5 很熟（SM-2 的 q 值） */
export function reviewCard(id: string, q: 1 | 3 | 4 | 5): CardState {
  const prev = state.cards[id];
  const isNew = !prev;
  let { ef, interval, reps, lapses } = prev ?? { ef: 2.5, interval: 0, reps: 0, lapses: 0 };
  if (q < 3) {
    reps = 0;
    interval = 0; // 今天再来一次
    lapses += 1;
  } else {
    reps += 1;
    interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(interval * ef);
  }
  ef = Math.max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  const next: CardState = { ef: Number(ef.toFixed(2)), interval, reps, lapses, due: today(interval) };
  let s = { ...state, cards: { ...state.cards, [id]: next } };
  if (isNew) {
    const d = today();
    s.newToday = s.newToday.date === d ? { date: d, n: s.newToday.n + 1 } : { date: d, n: 1 };
  }
  s = markActive(s);
  commit(s);
  return next;
}

export function setDailyNew(n: number) {
  commit({ ...state, dailyNew: Math.max(0, Math.min(30, n)) });
}

/* ───────── 错题本 ───────── */

export function recordQuizAttempt(lessonId: string, items: QuizQuestion[], picked: Record<number, number>) {
  const mistakes = { ...state.mistakes };
  items.forEach((q, i) => {
    const key = `${lessonId}#${i}`;
    const p = picked[i];
    if (p === undefined) return;
    if (p !== q.answer) {
      const old = mistakes[key];
      mistakes[key] = {
        key,
        lessonId,
        qIndex: i,
        question: q.question,
        options: q.options,
        answer: q.answer,
        explain: q.explain,
        picked: p,
        wrongCount: (old?.wrongCount ?? 0) + 1,
        lastAt: Date.now(),
        resolved: false,
      };
    }
  });
  commit(markActive({ ...state, mistakes }));
}

export function retryMistake(key: string, pickedIdx: number): boolean {
  const m = state.mistakes[key];
  if (!m) return false;
  const ok = pickedIdx === m.answer;
  commit(
    markActive({
      ...state,
      mistakes: {
        ...state.mistakes,
        [key]: { ...m, resolved: ok, picked: pickedIdx, wrongCount: ok ? m.wrongCount : m.wrongCount + 1, lastAt: Date.now() },
      },
    }),
  );
  return ok;
}

export function removeMistake(key: string) {
  const mistakes = { ...state.mistakes };
  delete mistakes[key];
  commit({ ...state, mistakes });
}

/* ───────── 用自己的话解释 ───────── */

export function saveExplain(lessonId: string, text: string, selfChecked: string[]) {
  commit(markActive({ ...state, explains: { ...state.explains, [lessonId]: { text, at: Date.now(), selfChecked } } }));
}

export function noteActivity() {
  commit(markActive(state));
}

/** 连续学习天数（今天或昨天有记录才算连续） */
export function streak(days: string[]): number {
  const set = new Set(days);
  let n = 0;
  let off = set.has(today()) ? 0 : -1;
  while (set.has(today(off))) {
    n += 1;
    off -= 1;
  }
  return n;
}
