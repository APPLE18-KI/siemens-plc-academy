/**
 * v2.2 讲解课问答（Q&A）数据结构。
 * - 设计参考：learn-anything-skill（learn-quiz / learn-tutor：干扰项来自真实误区、提示分级 → 再给答案）、
 *   janestreet/agent_skills socratic-tutor（先让学习者预测、解释“为什么”）。
 * - 答案文字支持行内 Markdown：[[术语]] 可点开术语表，[^出处id] 显示西门子手册原文出处。
 */

/** 一条“新手问答” */
export interface QaItem {
  q: string;
  a: string;
  /** 相关跳转（仿真、模型、复习、其他课） */
  see?: { label: string; to: string }[];
}

/** 讲课模式中的“停一停”检查题：在第 after 步讲完后出现 */
export interface Checkpoint {
  after: number;
  q: string;
  options: string[];
  answer: number;
  /** 解析：为什么对、错的选项错在哪 */
  why: string;
  /** 答错时先给的一句提示（苏格拉底式：不直接给答案） */
  nudge?: string;
}

/** 动手练习的“想一想”：提问 → 提示 1 → 提示 2 → 答案 */
export interface PracticeHint {
  think: string;
  hints: [string, string];
  answer: string;
}
