import type { LectureScript } from '../../features/lecture/types';
import * as p1 from './part1';
import * as p2 from './part2';

const ALL: LectureScript[] = [...Object.values(p1), ...Object.values(p2)];

/** 课程 id → 讲课脚本（全部 21 讲） */
export const LECTURES: Record<string, LectureScript> = Object.fromEntries(ALL.map((s) => [s.lessonId, s]));
