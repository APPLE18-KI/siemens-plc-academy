/**
 * 讲课模式（Lecture Mode）数据结构。
 * 思路来自开源项目 unfold（MIT）的 Lecture Mode：板书只写骨架，旁白一句一句出现，红色指针指向正在讲的东西。
 * 本站为 React 原生重写，适配手机：点一下 / 左滑 = 下一步，右滑 = 上一步。
 */

export type LvValue = boolean | number | string;

export interface RungEl {
  id: string;
  /** NO 常开 / NC 常闭 / P 上升沿 / COIL 线圈 / SET / RESET / TON 等功能框 */
  t: 'NO' | 'NC' | 'P' | 'COIL' | 'SET' | 'RESET' | 'TON' | 'TOF' | 'TP' | 'CTU' | 'CMP' | 'BOX';
  /** 符号名（显示为 "Start"） */
  tag: string;
  /** 绝对地址（显示为 %I0.0） */
  addr?: string;
  /** 功能框参数，如 PT 的 T#5s、比较的 >= 50 */
  arg?: string;
}

export interface RungSpec {
  /** 程序段标题，如“程序段 1：电机起保停” */
  net: string;
  els: RungEl[];
  /** 并联支路：与主路第 from..to 个元件并联（含两端） */
  par?: { from: number; to: number; els: RungEl[] };
  coil?: RungEl;
}

export type BoardItem =
  | { kind: 'title'; text: string }
  | { kind: 'line'; text: string; key?: boolean }
  | { kind: 'formula'; text: string }
  | { kind: 'rung'; id: string; rung: RungSpec }
  | { kind: 'pairs'; rows: [string, string][] };

export interface Beat {
  /** 写到板上的内容（可选） */
  board?: BoardItem;
  /** 这一步的旁白（一句话） */
  say?: string;
  /** 指针指向的目标 id（板书中的 [[id|文字]] 或梯形图元件 id） */
  at?: string;
  ink?: 'box' | 'dot' | 'line';
  /** 给板上梯形图设置的变量值（会一直保留到后面的步骤） */
  set?: Record<string, LvValue>;
}

export interface LectureScript {
  lessonId: string;
  /** 讲完后建议去试的内容提示 */
  tryIt?: string;
  beats: Beat[];
}

/* —— 书写辅助 —— */
export const title = (text: string, say?: string): Beat => ({ board: { kind: 'title', text }, say });
export const line = (text: string, say?: string, at?: string, opt: Partial<Beat> = {}): Beat => ({
  board: { kind: 'line', text },
  say,
  at,
  ...opt,
});
export const key = (text: string, say?: string, at?: string): Beat => ({ board: { kind: 'line', text, key: true }, say, at });
export const formula = (text: string, say?: string, at?: string): Beat => ({ board: { kind: 'formula', text }, say, at });
export const pairs = (rows: [string, string][], say?: string): Beat => ({ board: { kind: 'pairs', rows }, say });
export const rung = (id: string, r: RungSpec, say?: string, set?: Record<string, LvValue>): Beat => ({
  board: { kind: 'rung', id, rung: r },
  say,
  set,
});
export const say = (text: string, at?: string, set?: Record<string, LvValue>, ink?: Beat['ink']): Beat => ({
  say: text,
  at,
  set,
  ink,
});
