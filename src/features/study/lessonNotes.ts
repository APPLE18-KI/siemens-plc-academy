import { useSyncExternalStore } from 'react';
import type { ChapterMeta, Lesson } from '../../types/content';
import { formatDuration } from '../../content/curriculum';

export const LESSON_NOTES_KEY = 'plc_lesson_notes_v3';

export interface LessonNoteEntry {
  text: string;
  updatedAt: number;
}

export type LessonNotesMap = Record<string, LessonNoteEntry>;

function parseStore(raw: string | null): LessonNotesMap {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== 'object') return {};
    const out: LessonNotesMap = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string' && v.trim()) {
        out[k] = { text: v, updatedAt: Date.now() };
      } else if (v && typeof v === 'object') {
        const obj = v as { text?: unknown; updatedAt?: unknown };
        if (typeof obj.text === 'string' && obj.text.trim()) {
          out[k] = {
            text: obj.text,
            updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : Date.now(),
          };
        }
      }
    }
    return out;
  } catch {
    return {};
  }
}

let notesState: LessonNotesMap = typeof window === 'undefined' ? {} : parseStore(localStorage.getItem(LESSON_NOTES_KEY));
const listeners = new Set<() => void>();

function persist(next: LessonNotesMap) {
  notesState = next;
  try {
    localStorage.setItem(LESSON_NOTES_KEY, JSON.stringify(notesState));
  } catch {
    /* 隐私模式或空间已满时保留内存态 */
  }
  listeners.forEach((cb) => cb());
}

export function useLessonNotes(): LessonNotesMap {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => notesState,
    () => notesState,
  );
}

export function getLessonNote(lessonId: string): LessonNoteEntry | undefined {
  return notesState[lessonId];
}

export function saveLessonNote(lessonId: string, text: string): void {
  const next = { ...notesState };
  if (!text.trim()) {
    delete next[lessonId];
  } else {
    next[lessonId] = { text, updatedAt: Date.now() };
  }
  persist(next);
}

export function formatNoteTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function currentStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `[${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}] `;
}

function cleanInlineMarkers(md: string): string {
  return md
    .replace(/\[\^[\w-]+\]/g, '')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .trim();
}

/** 合成整洁的 Markdown 速查卡，适合直接粘贴到飞书、Notion 或 Obsidian */
export function buildLessonCheatSheetMarkdown(
  lesson: Lesson,
  chapter: ChapterMeta | null,
  noteText: string,
): string {
  const lines: string[] = [];
  lines.push(`# 第 ${lesson.order} 讲：${lesson.title}`);
  lines.push('');
  lines.push(`> ${lesson.subtitle}`);
  const metaParts = [
    chapter ? `章节：${chapter.title}` : null,
    `难度：${lesson.level}`,
    `预计时长：${formatDuration(lesson.minutes)}`,
  ].filter(Boolean);
  lines.push(`> ${metaParts.join(' | ')}`);

  if (lesson.objectives && lesson.objectives.length > 0) {
    lines.push('');
    lines.push('## 核心目标');
    for (const obj of lesson.objectives) {
      lines.push(`- ${cleanInlineMarkers(obj)}`);
    }
  }

  if (lesson.recap) {
    lines.push('');
    lines.push('## 一句话小结');
    lines.push(cleanInlineMarkers(lesson.recap));
  }

  if (lesson.interviewTip) {
    lines.push('');
    lines.push('## 面试高频提示');
    lines.push(cleanInlineMarkers(lesson.interviewTip));
  }

  lines.push('');
  lines.push('## 我的随堂笔记');
  lines.push(noteText.trim() ? noteText.trim() : '（暂未填写随堂笔记）');

  return `${lines.join('\n')}\n`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 降级到 execCommand */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
