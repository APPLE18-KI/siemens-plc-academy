import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookA,
  BookOpen,
  Boxes,
  CheckCircle2,
  CornerDownLeft,
  Cpu,
  Download,
  FolderKanban,
  GitBranch,
  MessagesSquare,
  Moon,
  Play,
  Repeat2,
  Search,
  Sparkles,
  Star,
  Sun,
  X,
} from 'lucide-react';
import { chapters, lessons } from '../../content/curriculum';
import { GLOSSARY } from '../../content/glossary';
import { useBackDismiss } from '../native/overlay';
import { useProgress } from '../store/progressStore';
import { exportArchiveToJsonFile } from '../store/archiveBackup';
import { decodePlcToken } from './plcAddressDecoder';
import { preloadRoute } from './routePreload';
import { runViewTransition } from './viewTransition';

export type PaletteCategory =
  | 'all'
  | 'lesson'
  | 'sim'
  | 'model'
  | 'example'
  | 'workflow'
  | 'glossary'
  | 'capstone'
  | 'action';

interface PaletteItem {
  id: string;
  category: Exclude<PaletteCategory, 'all'>;
  title: string;
  subtitle: string;
  badge: string;
  keywords: string;
  to?: string;
  completed?: boolean;
  priority?: number;
  run?: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  initialQuery?: string;
  onClose: () => void;
}

const CATEGORY_TABS: Array<{ id: PaletteCategory; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'lesson', label: '课程' },
  { id: 'sim', label: '仿真' },
  { id: 'model', label: '模型' },
  { id: 'example', label: '实例' },
  { id: 'workflow', label: '原理' },
  { id: 'glossary', label: '术语' },
  { id: 'capstone', label: '毕业项目' },
  { id: 'action', label: '快捷操作' },
];

const QUICK_CHIPS = ['%I0.0', '%MW12', '%IW64', '27648', '16#047F', 'T#3s', '1M', '双线圈', '自锁'];

/** 常见工程指令、地址与口语别名补充表，保障毫秒级离线直达 */
const LESSON_EXTRA_ALIASES: Record<string, string> = {
  'l00-before-you-start': '新手 零基础 入门 准备 安装 博途 第一次点亮',
  'l01-what-is-plc': 'S7-1200 CPU 1214C DC/DC/DC RLY 型号',
  'l01b-tia-first-project': 'TIA Portal 博途 新建项目 编译 下载 PLCSIM',
  'l02-wiring-npn-pnp': '接线 24V 1M NPN PNP 源型 漏型 急停 常闭 NC NO %I0.0',
  'l03-scan-cycle-pii-piq': '扫描周期 OB1 PII PIQ 双线圈 覆盖',
  'l03b-data-types': '数据类型 Bool Byte Word DWord Int DInt Real 16# 十六进制',
  'l04-s7-addressing-tags': '地址 %I0.0 %Q0.0 %MB10 %MW10 %MD10 变量表 符号名',
  'l05-seal-in-jog': '起保停 自锁 点动 Jog 停止优先 电机启动',
  'l06-interlock-edge': '正反转 互锁 软互锁 硬互锁 上升沿 下降沿 P_TRIG N_TRIG 置位 复位 S R',
  'l06b-troubleshooting-safety': '排错 故障 ERROR 灯 监控表 强制表 诊断缓冲区 PG/PC IP',
  'l07-iec-timers': '定时器 TON TOF TP 星三角 Y-Δ 延时启动 延时停止 PT ET',
  'l08-iec-counters': '计数器 CTU CTD CTUD 满箱 计件 PV CV',
  'l08b-compare-move-math': '比较 MOVE 移动 数学运算 ADD SUB MUL DIV 灌装',
  'l09-sequence-traffic-sorting': '顺序控制 步序 红绿灯 分拣线 状态步',
  'l10-fc-fb-instance-db': 'FC FB 功能块 函数 背景数据块 Instance DB 模块化',
  'l11-udt-global-db': 'UDT 自定义数据类型 全局 DB 配方',
  'l12-scl-state-machine': 'SCL 文本编程 CASE 状态机 PackML :=',
  'l13-analog-norm-scale': '模拟量 4-20mA 0-10V %IW64 27648 NORM_X SCALE_X 标定 归一化 断线',
  'l14-pid-compact-process': 'PID PID_Compact OB30 闭环 恒温 恒压 振荡 整定',
  'l14b-hmi-basics': 'HMI WinCC KTP700 触摸屏 画面 M位 按钮',
  'l15-profinet-project-delivery': 'PROFINET 报文 047E 047F STW1 ZSW1 16384 16#4000 G120 V90 FAT SAT 验收',
};

const STATIC_SIM_ITEMS: PaletteItem[] = [
  {
    id: 'sim-wiring-basics',
    category: 'sim',
    title: '仿真预设 01 · 常开/常闭触点与急停回路',
    subtitle: '物理常闭按钮 vs 程序常闭触点，断线安全与 %I0.0 接线验证',
    badge: '仿真预设',
    keywords: 'NO NC 常开 常闭 急停 断线安全 %I0.0 wiring-basics PLCSIM',
    to: '/sim?preset=wiring-basics',
  },
  {
    id: 'sim-seal-in-motor',
    category: 'sim',
    title: '仿真预设 02 · 三相电机起保停自锁 + 点动回路',
    subtitle: '经典并联自锁支路、停止优先原则与点动防自锁设计',
    badge: '仿真预设',
    keywords: '起保停 自锁 点动 Jog 停止优先 seal-in-motor %Q0.0',
    to: '/sim?preset=seal-in-motor',
  },
  {
    id: 'sim-reversing-interlock',
    category: 'sim',
    title: '仿真预设 03 · 电机正反转软互锁 + P_TRIG 计数',
    subtitle: '防止相间短路的按钮/线圈双重软互锁与上升沿脉冲统计',
    badge: '仿真预设',
    keywords: '正反转 互锁 双重互锁 P_TRIG 上升沿 CTU 防相间短路 reversing-interlock',
    to: '/sim?preset=reversing-interlock',
  },
  {
    id: 'sim-ton-star-delta',
    category: 'sim',
    title: '仿真预设 04 · TON 星三角（Y-Δ）降压启动',
    subtitle: '两级 IEC TON 定时器与 300ms 灭弧死区自动切换',
    badge: '仿真预设',
    keywords: 'TON 定时器 星三角 Y-Δ 降压启动 死区保护 ET ton-star-delta',
    to: '/sim?preset=ton-star-delta',
  },
  {
    id: 'sim-ctu-batch-pack',
    category: 'sim',
    title: '仿真预设 05 · 光电上升沿 + CTU 满箱计数封箱',
    subtitle: '上升沿防抖计件、满 6 件暂停皮带并触发 2.5s 封箱气缸',
    badge: '仿真预设',
    keywords: 'CTU 计数器 P_TRIG 上升沿 TON 包装 产线计件 ctu-batch-pack',
    to: '/sim?preset=ctu-batch-pack',
  },
  {
    id: 'sim-analog-scale-pid',
    category: 'sim',
    title: '仿真预设 06 · 模拟量 NORM_X / SCALE_X 与液位控制',
    subtitle: '4~20mA (0..27648) 两步工程换算 + 25%/80% 迟滞补水泵与高高报警',
    badge: '仿真预设',
    keywords: '%IW64 27648 NORM_X SCALE_X 模拟量 4-20mA 迟滞 液位 PID analog-scale-pid',
    to: '/sim?preset=analog-scale-pid',
  },
  {
    id: 'sim-sandbox',
    category: 'sim',
    title: '自定义梯形图沙盒（自由搭建 + SCL 导出 + 双线圈体检）',
    subtitle: '自由拖放触点/线圈/TON/CTU，实时监测双线圈冲突与交叉引用 F11',
    badge: '自由沙盒',
    keywords: '沙盒 sandbox 自定义 梯形图 LAD SCL 导出 双线圈 交叉引用 F11',
    to: '/sim?preset=sandbox',
  },
];

const STATIC_MODEL_ITEMS: PaletteItem[] = [
  {
    id: 'model-s7-1200-wiring',
    category: 'model',
    title: '模型 01 · S7-1200 CPU 1214C 硬件拆解与接线实训台',
    subtitle: 'DC/DC/DC 端子排、1M 公共端 NPN/PNP 极性校验、KA 继电器与 KM 电机主回路',
    badge: '数字孪生',
    keywords: '1214C 接线 1M PNP NPN 漏型 源型 KA KM 急停 盲测排故 s7-1200-wiring',
    to: '/models?model=s7-1200-wiring',
  },
  {
    id: 'model-sorting-conveyor',
    category: 'model',
    title: '模型 02 · 三工位视觉检测与气动分拣传送带',
    subtitle: '对射光电 + 电感金属接近 + 工业相机 + 双气缸磁性开关超时保护',
    badge: '数字孪生',
    keywords: '分拣 传送带 视觉 气缸 磁性开关 G120 %QW80 盲测排故 sorting-conveyor',
    to: '/models?model=sorting-conveyor',
  },
  {
    id: 'model-tank-pressure-pid',
    category: 'model',
    title: '模型 03 · 双泵恒压供水与储液罐热工 PID 闭环',
    subtitle: '4-20mA 断线保护 (%IW64)、PID_Compact 调速、双泵加减泵与三曲线示波器',
    badge: '数字孪生',
    keywords: 'PID PID_Compact 4-20mA %IW64 27648 断线 恒压供水 水箱 tank-pressure-pid',
    to: '/models?model=tank-pressure-pid',
  },
  {
    id: 'model-traffic-intersection',
    category: 'model',
    title: '模型 04 · 智能十字路口四向车流与人行请求联锁',
    subtitle: '多时段 CASE 状态机、全红清空、行人优先与绿灯冲突硬件安全继电器',
    badge: '数字孪生',
    keywords: '红绿灯 交通灯 状态机 CASE 全红清空 绿灯冲突 行人优先 traffic-intersection',
    to: '/models?model=traffic-intersection',
  },
];

const STATIC_EXAMPLE_ITEMS: PaletteItem[] = [
  {
    id: 'ex-motor-jog-seal',
    category: 'example',
    title: '实例 01 · 三相异步电机启保停与点动检修双模式',
    subtitle: '故障安全常闭接线、自锁保持、检修点动与单点输出归属',
    badge: '工程实例',
    keywords: '电机 起保停 自锁 点动 接触器 KM I/O表 SCL FAT',
    to: '/examples/ex-motor-jog-seal',
  },
  {
    id: 'ex-reversing-limit',
    category: 'example',
    title: '实例 02 · 车间行车正反转双重互锁与往返限位',
    subtitle: '软硬件双重互锁防相间短路 + 换向死区延时 + 左右双级限位',
    badge: '工程实例',
    keywords: '行车 正反转 互锁 限位开关 死区 电机',
    to: '/examples/ex-reversing-limit',
  },
  {
    id: 'ex-star-delta',
    category: 'example',
    title: '实例 03 · 22kW 风机星三角（Y-Δ）降压启动',
    subtitle: '先星后主 → TON 延时加速 → 50~100ms 灭弧死区 → 三角全压运行',
    badge: '工程实例',
    keywords: '星三角 Y-Δ 风机 TON 定时器 降压启动 死区',
    to: '/examples/ex-star-delta',
  },
  {
    id: 'ex-sorting-line',
    category: 'example',
    title: '实例 04 · 三工位视觉检测与双气缸柔性分拣产线',
    subtitle: '电感金属识别 + 视觉质检 + 气缸双向磁性开关看门狗与报警',
    badge: '工程实例',
    keywords: '分拣 视觉 气缸 顺控 看门狗 报警',
    to: '/examples/ex-sorting-line',
  },
  {
    id: 'ex-constant-pressure-pid',
    category: 'example',
    title: '实例 05 · 双泵恒压供水模拟量采集与 PID 闭环调速',
    subtitle: 'NORM_X/SCALE_X 标定、4-20mA 断线防溢流、OB30 循环中断与加减泵',
    badge: '工程实例',
    keywords: '恒压供水 PID NORM_X SCALE_X 4-20mA %IW64 27648 OB30',
    to: '/examples/ex-constant-pressure-pid',
  },
  {
    id: 'ex-smart-traffic',
    category: 'example',
    title: '实例 06 · 城市十字路口多时段信号灯与行人请求联锁',
    subtitle: '全红清空保护 + 夜间黄闪 + 行人优先 + 绿灯冲突故障安全降级',
    badge: '工程实例',
    keywords: '红绿灯 交通灯 状态机 联锁 CASE 夜间黄闪',
    to: '/examples/ex-smart-traffic',
  },
];

const STATIC_WORKFLOW_ITEMS: PaletteItem[] = [
  {
    id: 'wf-scan-cycle',
    category: 'workflow',
    title: '原理动画 · PLC 扫描周期微观执行与双线圈实验室',
    subtitle: 'PII 输入锁存 → OB1 顺序求值 → PIQ 写回硬件动态追踪与双线圈排错',
    badge: '原理动画',
    keywords: '扫描周期 PII PIQ OB1 双线圈 覆写 排错 scan-cycle',
    to: '/workflows?wf=scan-cycle',
  },
  {
    id: 'wf-grafcet-packml',
    category: 'workflow',
    title: '原理动画 · GRAFCET 顺序功能图与 OMAC PackML 状态机',
    subtitle: '工业标准模式/异常联锁与 SCL CASE 状态机同步高亮',
    badge: '原理动画',
    keywords: 'GRAFCET PackML 状态机 SCL CASE 顺控 grafcet-packml',
    to: '/workflows?wf=grafcet-packml',
  },
  {
    id: 'wf-project-lifecycle',
    category: 'workflow',
    title: '原理动画 · 非标自动化项目全生命周期交付八步法',
    subtitle: 'URS → EPLAN → I/O 点表 → 博途组态 → PLCSIM 联调 → FAT/SAT',
    badge: '原理动画',
    keywords: 'URS EPLAN IO 点表 FAT SAT 交付 流程 project-lifecycle',
    to: '/workflows?wf=project-lifecycle',
  },
];

const STATIC_CAPSTONE_ITEMS: PaletteItem[] = [
  {
    id: 'cap-arch',
    category: 'capstone',
    title: '毕业项目 · 硬件拓扑 & PROFINET 1号报文 (047E → 047F) 实验台',
    subtitle: 'S7-1215C 组网架构 + SINAMICS G120/V90 STW1/ZSW1 控制字与 16#4000 转速换算',
    badge: '毕业项目',
    keywords: 'PROFINET 报文 047E 047F 16#047F STW1 ZSW1 NSOLL_A 16384 16#4000 G120 V90 1215C',
    to: '/capstone?tab=arch',
  },
  {
    id: 'cap-challenges',
    category: 'capstone',
    title: '毕业项目 · 5 关 SCL 实战闯关台',
    subtitle: '锂电模组工作站核心功能块 SCL 编程闯关与自动评测',
    badge: '毕业项目',
    keywords: 'SCL 闯关 毕业项目 锂电 编程题 FB UDT',
    to: '/capstone?tab=challenges',
  },
  {
    id: 'cap-scada',
    category: 'capstone',
    title: '毕业项目 · WinCC 监控画面联调与报警确认 (ACK)',
    subtitle: '自动/手动启停、急停复位、热压 PID 温控曲线与实时报警归档',
    badge: '毕业项目',
    keywords: 'SCADA WinCC 监控 报警 ACK 热压 温控 PID 锂电',
    to: '/capstone?tab=scada',
  },
  {
    id: 'cap-source',
    category: 'capstone',
    title: '毕业项目 · TIA Portal 博途 .scl 源码浏览器与下载',
    subtitle: '浏览并一键下载 UDT、FB、OB1、OB100 与 PLC 变量表 .csv',
    badge: '毕业项目',
    keywords: '源码 .scl .csv 博途 TIA Portal 导入 下载 OB1 OB100 UDT',
    to: '/capstone?tab=source',
  },
  {
    id: 'cap-resume',
    category: 'capstone',
    title: '毕业项目 · STAR 简历话术与 15 道高频面试自测',
    subtitle: '模拟技术面试官抽题采分点自测 + 应届/转行/在职简历描述模板',
    badge: '毕业项目',
    keywords: '简历 面试 STAR 社招 应届 15题 双线圈 PID 通讯 急停',
    to: '/capstone?tab=resume',
  },
];

function normalizeText(input: string): string {
  return input
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .trim();
}

function scoreItem(item: PaletteItem, tokens: string[], rawQuery: string): number {
  const title = normalizeText(item.title);
  const subtitle = normalizeText(item.subtitle);
  const keywords = normalizeText(item.keywords);
  const badge = normalizeText(item.badge);
  const combined = `${title} ${badge} ${keywords} ${subtitle}`;

  for (const tk of tokens) {
    if (!combined.includes(tk)) return -1;
  }

  let score = item.priority ?? 0;
  if (title === rawQuery || keywords.split(/\s+/).includes(rawQuery)) {
    score += 120;
  } else if (title.startsWith(rawQuery)) {
    score += 90;
  } else if (title.includes(rawQuery)) {
    score += 65;
  } else if (keywords.includes(rawQuery)) {
    score += 55;
  } else if (subtitle.includes(rawQuery)) {
    score += 35;
  }

  for (const tk of tokens) {
    if (title.includes(tk)) score += 18;
    if (keywords.includes(tk)) score += 14;
    if (subtitle.includes(tk)) score += 6;
  }

  return score;
}

function getCategoryIcon(category: Exclude<PaletteCategory, 'all'>, id: string, isDark: boolean) {
  switch (category) {
    case 'lesson':
      return <BookOpen size={16} />;
    case 'sim':
      return <Cpu size={16} />;
    case 'model':
      return <Boxes size={16} />;
    case 'example':
      return <FolderKanban size={16} />;
    case 'workflow':
      return <GitBranch size={16} />;
    case 'glossary':
      return <BookA size={16} />;
    case 'capstone':
      return <Star size={16} />;
    case 'action':
      if (id === 'act-theme') return isDark ? <Sun size={16} /> : <Moon size={16} />;
      if (id === 'act-continue') return <Play size={16} />;
      if (id === 'act-review' || id === 'act-mistakes') return <Repeat2 size={16} />;
      if (id === 'act-qa') return <MessagesSquare size={16} />;
      if (id === 'act-export') return <Download size={16} />;
      return <Sparkles size={16} />;
  }
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  initialQuery = '',
  onClose,
}) => {
  const navigate = useNavigate();
  const { state, toggleTheme } = useProgress();

  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState<PaletteCategory>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useBackDismiss(open, onClose);

  // 打开时记录原焦点、聚焦输入框并锁定页面滚动；关闭时归还焦点
  useEffect(() => {
    if (!open) return;

    openerRef.current = document.activeElement as HTMLElement | null;
    setQuery(initialQuery);
    setCategory('all');
    setActiveIndex(0);
    setFeedback(null);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const raf = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => {
      window.cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      const opener = openerRef.current;
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        window.requestAnimationFrame(() => opener.focus());
      }
    };
  }, [open, initialQuery]);

  const chapterMap = useMemo(() => {
    const map = new Map<string, string>();
    chapters.forEach((c) => map.set(c.id, c.badge));
    return map;
  }, []);

  const continueLesson = useMemo(() => {
    if (state.lastVisitedLessonId) {
      const found = lessons.find((l) => l.id === state.lastVisitedLessonId);
      if (found) return found;
    }
    return lessons.find((l) => !state.completedLessonIds.includes(l.id)) ?? lessons[0];
  }, [state.lastVisitedLessonId, state.completedLessonIds]);

  const allItems = useMemo<PaletteItem[]>(() => {
    const lessonItems: PaletteItem[] = lessons.map((l) => ({
      id: `lesson-${l.id}`,
      category: 'lesson',
      title: `第 ${l.order} 讲 · ${l.title}`,
      subtitle: l.recap || l.subtitle,
      badge: chapterMap.get(l.chapterId) ?? l.level,
      keywords: [
        `第${l.order}讲`,
        `l${String(l.order).padStart(2, '0')}`,
        l.id,
        l.title,
        l.subtitle,
        l.recap ?? '',
        ...(l.tags ?? []),
        LESSON_EXTRA_ALIASES[l.id] ?? '',
      ].join(' '),
      to: `/learn/${l.id}`,
      completed: state.completedLessonIds.includes(l.id),
      priority: 10,
    }));

    const glossaryItems: PaletteItem[] = GLOSSARY.map((t) => ({
      id: `glossary-${t.id}`,
      category: 'glossary',
      title: t.en ? `${t.term} (${t.en})` : t.term,
      subtitle: t.short,
      badge: `术语 · ${t.category}`,
      keywords: [t.id, t.term, t.en ?? '', ...(t.aliases ?? []), t.short, t.detail ?? ''].join(' '),
      to: `/glossary?term=${encodeURIComponent(t.id)}`,
      priority: 8,
    }));

    const actionItems: PaletteItem[] = [
      {
        id: 'act-continue',
        category: 'action',
        title: continueLesson
          ? `继续上次学习：第 ${continueLesson.order} 讲 · ${continueLesson.title}`
          : '进入课程目录继续学习',
        subtitle: state.lastVisitedLessonId
          ? '直达你上次停留的课时位置'
          : '从下一节未掌握的课程开始',
        badge: '快捷操作',
        keywords: '继续 上次 学习 课时 进度 continue resume',
        to: continueLesson ? `/learn/${continueLesson.id}` : '/learn',
        priority: 30,
      },
      {
        id: 'act-theme',
        category: 'action',
        title: state.theme === 'dark' ? '切换为浅色沉浸精读主题' : '切换为深色工业控制台主题',
        subtitle: '即时切换全站明暗极性（保留工业代码终端高对比）',
        badge: '快捷操作',
        keywords: '主题 深色 浅色 暗黑 明亮 theme dark light invert',
        priority: 24,
        run: () => {
          toggleTheme();
          onClose();
        },
      },
      {
        id: 'act-review',
        category: 'action',
        title: '打开间隔复习中心（SM-2 记忆闪卡与薄弱诊断）',
        subtitle: '复习到期卡片、查看五章掌握度与重做随堂错题',
        badge: '快捷操作',
        keywords: '复习 闪卡 SM-2 记忆 卡片 错题 review',
        to: '/review',
        priority: 22,
      },
      {
        id: 'act-mistakes',
        category: 'action',
        title: '打开我的错题本',
        subtitle: '集中重做随堂测验中答错的题目直至掌握',
        badge: '快捷操作',
        keywords: '错题本 错题 重做 测验 mistakes',
        to: '/review?tab=mistakes',
        priority: 18,
      },
      {
        id: 'act-qa',
        category: 'action',
        title: '打开 130 题新手问答库',
        subtitle: '离线搜索一线电气与博途高频疑问，支持星标收藏',
        badge: '快捷操作',
        keywords: '问答库 QA 问题 搜索 急停 双线圈 常见疑问',
        to: '/qa',
        priority: 16,
      },
      {
        id: 'act-export',
        category: 'action',
        title: '一键导出本机学习档案 (.json 备份)',
        subtitle: '备份课程进度、复习卡片、毕业打卡与课堂笔记，便于跨设备同步',
        badge: '快捷操作',
        keywords: '导出 备份 同步 json archive export backup',
        priority: 15,
        run: () => {
          const res = exportArchiveToJsonFile();
          setFeedback(`已导出 ${res.fileName}（含 ${res.keyCount} 项档案数据）`);
        },
      },
    ];

    return [
      ...actionItems,
      ...STATIC_SIM_ITEMS,
      ...STATIC_MODEL_ITEMS,
      ...STATIC_CAPSTONE_ITEMS,
      ...STATIC_WORKFLOW_ITEMS,
      ...STATIC_EXAMPLE_ITEMS,
      ...lessonItems,
      ...glossaryItems,
    ];
  }, [chapterMap, continueLesson, onClose, state.completedLessonIds, state.lastVisitedLessonId, state.theme, toggleTheme]);

  const decodedHint = useMemo(() => decodePlcToken(query), [query]);

  const filteredItems = useMemo(() => {
    const raw = normalizeText(deferredQuery);
    const pool = category === 'all' ? allItems : allItems.filter((item) => item.category === category);

    if (!raw) {
      if (category !== 'all') return pool.slice(0, 36);
      // 空查询时展示精选“快速直达”组合：快捷操作 + 核心仿真/模型/毕业项目 + 前 6 讲
      const featuredIds = new Set([
        'act-continue',
        'act-review',
        'act-theme',
        'act-export',
        'sim-seal-in-motor',
        'sim-analog-scale-pid',
        'sim-sandbox',
        'model-s7-1200-wiring',
        'model-tank-pressure-pid',
        'wf-scan-cycle',
        'cap-arch',
        'cap-resume',
      ]);
      const featured = pool.filter((i) => featuredIds.has(i.id));
      const topLessons = pool.filter((i) => i.category === 'lesson').slice(0, 4);
      return [...featured, ...topLessons];
    }

    const tokens = raw.split(/\s+/).filter(Boolean);
    const scored: Array<{ item: PaletteItem; score: number }> = [];

    for (const item of pool) {
      const sc = scoreItem(item, tokens, raw);
      if (sc >= 0) {
        scored.push({ item, score: sc });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 40).map((s) => s.item);
  }, [allItems, category, deferredQuery]);

  // 结果集变化时重置选中索引
  useEffect(() => {
    setActiveIndex(0);
  }, [deferredQuery, category]);

  // 高亮项滚入视野 + 预热目标路由分包
  useEffect(() => {
    if (!open) return;
    const current = filteredItems[activeIndex];
    if (current?.to) {
      preloadRoute(current.to);
    }
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmdk-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, filteredItems, open]);

  const executeItem = (item: PaletteItem) => {
    if (item.run) {
      item.run();
      return;
    }
    if (item.to) {
      const target = item.to;
      onClose();
      runViewTransition(() => {
        navigate(target);
      }, 'route');
    }
  };

  // 对话框焦点陷阱 + 方向键/Enter/Esc 控制
  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredItems.length > 0) {
        setActiveIndex((prev) => (prev + 1) % filteredItems.length);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredItems.length > 0) {
        setActiveIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
      }
      return;
    }

    if (e.key === 'Home') {
      if (document.activeElement !== inputRef.current && filteredItems.length > 0) {
        e.preventDefault();
        setActiveIndex(0);
      }
      return;
    }

    if (e.key === 'End') {
      if (document.activeElement !== inputRef.current && filteredItems.length > 0) {
        e.preventDefault();
        setActiveIndex(filteredItems.length - 1);
      }
      return;
    }

    if (e.key === 'Enter') {
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      // 焦点在搜索框或列表项上时执行当前高亮条目；焦点在分类胶囊按钮上让按钮自行切换分类
      if (document.activeElement === inputRef.current || activeTag !== 'BUTTON') {
        const current = filteredItems[activeIndex];
        if (current) {
          e.preventDefault();
          executeItem(current);
        }
      }
      return;
    }

    if (e.key === 'Tab' && dialogRef.current) {
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);

      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!open) return null;

  const activeOptionId = filteredItems[activeIndex]
    ? `cmdk-opt-${filteredItems[activeIndex].id}`
    : undefined;

  return (
    <div
      className="cmdk-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="cmdk-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cmdk-dialog-title"
        onKeyDown={handleDialogKeyDown}
      >
        <h2 id="cmdk-dialog-title" className="sr-only">
          全站全局命令面板与速查中心
        </h2>

        <div className="cmdk-input-bar">
          <Search size={18} className="cmdk-search-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className="cmdk-input"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-listbox"
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-label="检索全站课程、指令、地址、仿真、模型、实例与术语"
            placeholder="搜课程、仿真、模型或指令，如 TON、NORM_X、%IW64、047F、双线圈…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              className="cmdk-clear-btn"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="清空搜索词"
            >
              <X size={15} />
            </button>
          )}
          <button
            type="button"
            className="cmdk-close-btn"
            onClick={onClose}
            aria-label="关闭全局速查面板"
          >
            <kbd>ESC</kbd>
          </button>
        </div>

        <div className="cmdk-cats" role="group" aria-label="按资源分类筛选">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`cmdk-cat-pill${category === tab.id ? ' active' : ''}`}
              aria-pressed={category === tab.id}
              onClick={() => {
                setCategory(tab.id);
                inputRef.current?.focus();
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {!query.trim() && (
          <div className="cmdk-quick-strip" aria-label="高频指令与概念热搜">
            <span className="cmdk-quick-lbl">高频速查</span>
            <div className="cmdk-quick-chips">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="cmdk-quick-chip"
                  onClick={() => {
                    setQuery(chip);
                    inputRef.current?.focus();
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {feedback && (
          <div className="cmdk-feedback" role="status" aria-live="polite">
            <CheckCircle2 size={15} />
            <span>{feedback}</span>
          </div>
        )}

        {decodedHint && (
          <div className="cmdk-decoder-card" role="region" aria-label="西门子地址与常数大白话拆解">
            <div className="cmdk-decoder-head">
              <span className="cmdk-decoder-code">{decodedHint.code}</span>
              <span className="cmdk-decoder-tag">{decodedHint.tag}</span>
              <strong className="cmdk-decoder-headline">{decodedHint.headline}</strong>
            </div>
            <div className="cmdk-decoder-parts">
              {decodedHint.parts.map((p) => (
                <span key={p.token} className="cmdk-decoder-part">
                  <code>{p.token}</code>
                  <span>{p.meaning}</span>
                </span>
              ))}
            </div>
            <p className="cmdk-decoder-explain">{decodedHint.plainExplain}</p>
            {decodedHint.pitfall && <p className="cmdk-decoder-pitfall">{decodedHint.pitfall}</p>}
            {decodedHint.relatedTo && (
              <button
                type="button"
                className="cmdk-decoder-goto"
                onClick={() => {
                  const target = decodedHint.relatedTo!.to;
                  onClose();
                  preloadRoute(target);
                  runViewTransition(() => navigate(target), 'route');
                }}
              >
                <span>{decodedHint.relatedTo.label}</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        )}

        <div
          ref={listRef}
          id="cmdk-listbox"
          className="cmdk-list"
          role="listbox"
          aria-label="搜索结果列表"
        >
          {filteredItems.length === 0 ? (
            <div className="cmdk-empty">
              <Search size={24} aria-hidden="true" />
              <p>未找到与“{query}”匹配的全站资源</p>
              <span>试试搜索 TON、NORM_X、%IW64、27648、047F、双线圈 或 自锁</span>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  id={`cmdk-opt-${item.id}`}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  data-cmdk-idx={idx}
                  className={`cmdk-item${isActive ? ' is-active' : ''}`}
                  onMouseEnter={() => {
                    setActiveIndex(idx);
                    if (item.to) preloadRoute(item.to);
                  }}
                  onClick={() => executeItem(item)}
                >
                  <span className={`cmdk-item-icon cat-${item.category}`} aria-hidden="true">
                    {getCategoryIcon(item.category, item.id, state.theme === 'dark')}
                  </span>
                  <span className="cmdk-item-body">
                    <span className="cmdk-item-title-row">
                      <span className="cmdk-item-title">{item.title}</span>
                      {item.completed && (
                        <CheckCircle2
                          size={13}
                          className="cmdk-done-icon"
                          aria-label="已完成"
                        />
                      )}
                    </span>
                    <span className="cmdk-item-sub">{item.subtitle}</span>
                  </span>
                  <span className="cmdk-item-right">
                    <span className="cmdk-item-badge">{item.badge}</span>
                    {isActive && (
                      <span className="cmdk-enter-hint" aria-hidden="true">
                        <CornerDownLeft size={13} />
                      </span>
                    )}
                    {!isActive && (
                      <ArrowRight size={13} className="cmdk-item-arrow" aria-hidden="true" />
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="cmdk-footer">
          <div className="cmdk-keys-legend" aria-hidden="true">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> 选择
            </span>
            <span>
              <kbd>Enter</kbd> 打开
            </span>
            <span>
              <kbd>Esc</kbd> 关闭
            </span>
          </div>
          <div className="cmdk-status-count" role="status" aria-live="polite">
            {query.trim()
              ? `找到 ${filteredItems.length} 条结果`
              : `全站离线索引就绪 · 共 ${allItems.length} 项`}
          </div>
        </div>
      </div>
    </div>
  );
};
