import type { ChapterMeta, Lesson } from '../types/content';
import { lesson0 } from './lessons/lesson0';
import {
  lessonCompareMoveMath,
  lessonDataTypes,
  lessonHmiBasics,
  lessonTiaFirstProject,
  lessonTroubleshootSafety,
} from './lessons/extra';
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

/** 每讲末尾的一句话小结（新增课程在各自文件中直接填写 recap） */
const RECAPS: Record<string, string> = {
  'l00-before-you-start': '不用买硬件也能开始：先在仿真里学会逻辑，接线前永远先断电。',
  'l01-what-is-plc': 'PLC = 输入端子 + 程序 + 输出端子；型号后缀 DC/DC/DC 依次是供电/输入/输出类型。',
  'l02-wiring-npn-pnp': '传感器类型要和输入公共端接法匹配；急停物理接常闭，程序里用常开触点检测。',
  'l03-scan-cycle-pii-piq': 'PLC 一轮轮地“读输入 → 算程序 → 写输出”；同一个输出只在一处赋值，避免双线圈。',
  'l04-s7-addressing-tags': '%MW10 = %MB10 + %MB11，字和双字地址要留够间隔；程序里尽量用符号名。',
  'l05-seal-in-jog': '起保停 = 启动并联自锁 + 串联停止，停止优先；点动不能触发自锁。',
  'l06-interlock-edge': '正反转要软件互锁加硬件互锁；“按一下只算一次”用边沿检测。',
  'l07-iec-timers': 'TON 接通延时、TOF 断开延时、TP 固定脉冲；SCL 里定时器要每个周期都调用。',
  'l08-iec-counters': '计数器数的是上升沿，到达 PV 输出 Q；复位要有明确条件。',
  'l09-sequence-traffic-sorting': '顺序控制的核心是“步”：每一步只做一件事，满足条件才进入下一步。',
  'l10-fc-fb-instance-db': 'FC 没有记忆，FB 靠背景 DB 记住状态；同一种设备写一个 FB、调用多次。',
  'l11-udt-global-db': '用 UDT 把一台设备的数据打包，配合全局 DB 管理配方和参数。',
  'l12-scl-state-machine': '用 CASE 写状态机：一个状态变量 + 每个状态的动作和跳转条件。',
  'l13-analog-norm-scale': '模拟量先 NORM_X 归一化（0~27648 → 0~1），再 SCALE_X 换算成工程量。',
  'l14-pid-compact-process': 'PID 让实际值追着设定值走；先确认测量和执行机构正常，再调参数。',
  'l15-profinet-project-delivery': 'PROFINET 设备要有设备名和 IP；项目交付靠清单逐项验收。',
};

/**
 * 课程顺序：第 0 讲 + 原有 15 讲 + 5 讲新增补充课（插入到相关章节中）。
 * order 由数组位置自动生成（0、1、2…），课程正文里不写死“第 N 讲”，避免插课后编号错乱。
 */
const ORDERED: Lesson[] = [
  lesson0,
  ch1Lessons[0],
  lessonTiaFirstProject,
  ...ch1Lessons.slice(1),
  lessonDataTypes,
  ...ch2Lessons,
  lessonTroubleshootSafety,
  ...ch3Lessons.slice(0, 2),
  lessonCompareMoveMath,
  ...ch3Lessons.slice(2),
  ...ch4Lessons,
  ...ch5Lessons.slice(0, 2),
  lessonHmiBasics,
  ...ch5Lessons.slice(2),
];

export const lessons: Lesson[] = ORDERED.map((l, idx) => ({
  ...l,
  order: idx,
  recap: l.recap ?? RECAPS[l.id],
}));

/** 难度星级（1~4），由 Lesson.level 推导，用于目录与课程页展示 */
export const LEVEL_STARS: Record<Lesson['level'], number> = {
  入门: 1,
  基础: 2,
  进阶: 3,
  实战: 4,
};

/** 把分钟数格式化为“约 X 小时 Y 分钟”式的简短中文 */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} 小时` : `${h} 小时 ${rest} 分钟`;
}

/** 课程总时长（分钟） */
export function totalLessonMinutes(list: Lesson[] = lessons): number {
  return list.reduce((acc, l) => acc + (l.minutes || 0), 0);
}
