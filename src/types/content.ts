import type React from 'react';
import type { PlcRuntime, TagDef } from './plc';

/** 仿真预设标准 ID（plc-sim-engine 实现，curriculum-tutor 在课程中引用） */
export type SimPresetId =
  | 'wiring-basics'
  | 'seal-in-motor'
  | 'reversing-interlock'
  | 'ton-star-delta'
  | 'ctu-batch-pack'
  | 'analog-scale-pid';

/** 数字孪生被控对象模型标准 ID（twin-modeling 实现，curriculum-tutor / examples 引用） */
export type ModelId =
  | 's7-1200-wiring'
  | 'sorting-conveyor'
  | 'tank-pressure-pid'
  | 'traffic-intersection';

/** 工作流可视化标准 ID（workflow-capstone 实现，curriculum-tutor 引用） */
export type WorkflowId =
  | 'scan-cycle'
  | 'grafcet-packml'
  | 'project-lifecycle';

/** 课内交互演示组件 ID（src/features/demos 实现） */
export type DemoId =
  | 'tia-first-project'
  | 'tia-download-monitor'
  | 'data-type-explorer'
  | 'instruction-lab'
  | 'troubleshoot-guide'
  | 'hmi-first-screen'
  | 'timer-diagram';

export interface QuizQuestion {
  question: string;
  options: string[];
  /** 正确选项下标（单选为 number） */
  answer: number;
  explain: string;
}

export type LessonBlock =
  | { kind: 'text'; title?: string; md: string }
  | { kind: 'callout'; tone: 'tip' | 'warn' | 'info' | 'danger'; title?: string; md: string }
  | {
      kind: 'code';
      lang: 'scl' | 'lad' | 'stl' | 'text';
      title?: string;
      code: string;
      caption?: string;
    }
  | {
      kind: 'dual-code';
      title?: string;
      lad: string;
      scl: string;
      caption?: string;
    }
  | {
      kind: 'io-table';
      title?: string;
      tags: TagDef[];
    }
  | { kind: 'quiz'; title?: string; items: QuizQuestion[] }
  | { kind: 'sim'; preset: SimPresetId; title?: string; instruction?: string }
  | { kind: 'model'; id: ModelId; title?: string; instruction?: string }
  | { kind: 'workflow'; id: WorkflowId; title?: string; instruction?: string }
  | { kind: 'demo'; id: DemoId; title?: string; instruction?: string }
  | {
      kind: 'practice-task';
      title: string;
      scenario: string;
      steps: string[];
      checkPoints: string[];
    };

export type LessonLevel = '入门' | '基础' | '进阶' | '实战';

export interface ChapterMeta {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  badge: string;
}

export interface Lesson {
  id: string;
  chapterId: string;
  order: number;
  title: string;
  subtitle: string;
  level: LessonLevel;
  minutes: number;
  tags: string[];
  objectives: string[];
  interviewTip?: string;
  /** 一句话小结，显示在课程末尾 */
  recap?: string;
  blocks: LessonBlock[];
}

export interface ExampleCase {
  id: string;
  title: string;
  subtitle: string;
  difficulty: '基础' | '进阶' | '工业综合';
  industry: string;
  hardware: string;
  summary: string;
  highlights: string[];
  linkedModelId?: ModelId;
  linkedSimPreset?: SimPresetId;
  ioTags: TagDef[];
  controlRequirements: string[];
  ladDiagramText: string;
  sclCode: string;
  pitfalls: string[];
  interviewPoints: string[];
}

export interface RegistryEntry<P = Record<string, unknown>> {
  id: string;
  title: string;
  subtitle: string;
  tags?: string[];
  Component: React.ComponentType<P>;
}

export type SimPresetEntry = RegistryEntry<{ embedded?: boolean }>;
export type ModelEntry = RegistryEntry<{ runtime?: PlcRuntime; embedded?: boolean }>;
export type WorkflowEntry = RegistryEntry<{ embedded?: boolean }>;
