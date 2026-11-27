import { useSyncExternalStore } from 'react';

export const QA_BOOKMARKS_KEY = 'plc_qa_bookmarks_v3';

function loadBookmarks(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QA_BOOKMARKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((x): x is string => typeof x === 'string'))];
  } catch {
    return [];
  }
}

let bookmarks: string[] = loadBookmarks();
const listeners = new Set<() => void>();

function commit(next: string[]) {
  bookmarks = next;
  try {
    localStorage.setItem(QA_BOOKMARKS_KEY, JSON.stringify(bookmarks));
  } catch {
    /* 隐私模式或空间满时保留在内存 */
  }
  listeners.forEach((cb) => cb());
}

export function qaBookmarkKey(lessonId: string, idx: number): string {
  return `${lessonId}#${idx}`;
}

export function toggleQaBookmark(key: string): boolean {
  const exists = bookmarks.includes(key);
  const next = exists ? bookmarks.filter((k) => k !== key) : [...bookmarks, key];
  commit(next);
  return !exists;
}

export function useQaBookmarks(): string[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => bookmarks,
    () => bookmarks,
  );
}
