import type { ChapterMeta, Lesson } from '../types/content';
import { ch1Lessons, ch1Meta } from './lessons/ch1';
import { ch2Lessons, ch2Meta } from './lessons/ch2';
import { ch3Lessons, ch3Meta } from './lessons/ch3';
import { ch4Lessons, ch4Meta } from './lessons/ch4';
import { ch5Lessons, ch5Meta } from './lessons/ch5';

export const chapters: ChapterMeta[] = [
  ch1Meta,
  ch2Meta,
  ch3Meta,
  ch4Meta,
  ch5Meta,
];

export const lessons: Lesson[] = [
  ...ch1Lessons,
  ...ch2Lessons,
  ...ch3Lessons,
  ...ch4Lessons,
  ...ch5Lessons,
];
