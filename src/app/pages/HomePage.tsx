import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Briefcase,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  FolderKanban,
  Play,
  Search,
  Sliders,
  Star,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { chapters, formatDuration, lessons, totalLessonMinutes } from '../../content/curriculum';
import { FaqSection } from '../../components/FaqSection';
import { Term } from '../../components/Term';
import { HomeStudyStrip } from '../../features/study/HomeStudyStrip';
import { loadOnboardingProfile, OnboardingQuiz } from '../../features/study/OnboardingQuiz';
import { preloadRoute } from '../layout/routePreload';
import { triggerCommandPaletteOpen } from '../layout/shortcuts';
import { useProgress } from '../store/progressStore';
import { HeroMiniPlcBox } from './HeroMiniPlcBox';

interface PipelineNode {
  id: string;
  step: string;
  name: string;
  summary: string;
  desc: string;
  route: string;
  cta: string;
}

interface CustomTrack {
  id: 'beginner' | 'pro-upgrade' | 'interview';
  index: string;
  tabLabel: string;
  shortTag: string;
  duration: string;
  headline: string;
  whoFor: string;
  outcome: string;
  lessonIds: string[];
  workbenches: Array<{
    label: string;
    detail: string;
    to: string;
    tag: string;
  }>;
  Icon: LucideIcon;
}

const PIPELINE_NODES: PipelineNode[] = [
  {
    id: 'plc',
    step: '第 1 步',
    name: '认识 PLC',
    summary: '按钮、指示灯怎么接到 PLC 上',
    desc: '从零认识 S7-1200 的外观和接线端子，弄懂按钮、传感器、指示灯分别接在哪里，以及常开/常闭是什么意思。',
    route: '/learn',
    cta: '查看课程目录',
  },
  {
    id: 'pn',
    step: '第 2 步',
    name: '写程序、看效果',
    summary: '在网页上运行梯形图',
    desc: '在浏览器里直接运行梯形图：按下按钮，能看到哪条线通电、哪个输出亮起，还能单步慢放、查交叉引用与双线圈。',
    route: '/sim',
    cta: '打开仿真实验室',
  },
  {
    id: 'twin',
    step: '第 3 步',
    name: '控制一台设备',
    summary: '传送带、水箱、红绿灯模型',
    desc: '用程序去控制会动的设备模型：分拣传送带、恒压供水水箱、十字路口红绿灯，还可以抽取盲测故障工单练习排查。',
    route: '/models',
    cta: '查看设备模型',
  },
  {
    id: 'capstone',
    step: '第 4 步',
    name: '完成一个项目',
    summary: '综合练习 + 可导入博途的源码',
    desc: '把前面学的串起来，完成分拣 + 热压温控工作站综合项目，含 PROFINET 1号报文实验台、可下载 .scl 源码与面试模拟。',
    route: '/capstone',
    cta: '了解毕业项目',
  },
];

const CUSTOM_TRACKS: CustomTrack[] = [
  {
    id: 'beginner',
    index: '路线一',
    tabLabel: '零基础电工 / 转行入门',
    shortTag: '零基础起步',
    duration: '建议 10–14 天 · 每日 45 分钟',
    headline: '先打通“接线 → 梯形图通电 → 启保停与定时”基本功',
    whoFor: '平时只接过继电器、空开，或完全没碰过 TIA Portal，想在不买硬件的情况下快速看懂梯形图并写出电机控制程序。',
    outcome: '学完能独立判断 NPN/PNP 与 1M 公共端接线、写出带急停和互锁的启保停/星三角程序，并在网页仿真与接线台里调通。',
    lessonIds: [
      'l00-before-you-start',
      'l01-what-is-plc',
      'l02-wiring-npn-pnp',
      'l05-seal-in-jog',
      'l07-iec-timers',
    ],
    workbenches: [
      {
        tag: '仿真直达',
        label: '三相电机起保停自锁 + 点动仿真',
        detail: '边按现场按钮边看绿色能流、停止优先与自锁支路',
        to: '/sim?preset=seal-in-motor',
      },
      {
        tag: '接线实训',
        label: 'S7-1200 CPU 1214C 接线与 1M 极性模型',
        detail: '动手切换 PNP/NPN 传感器与 1M 公共端，直观验证光耦导通',
        to: '/models?model=s7-1200-wiring',
      },
    ],
    Icon: Wrench,
  },
  {
    id: 'pro-upgrade',
    index: '路线二',
    tabLabel: '在职电气技术员补齐 SCL / PID',
    shortTag: '进阶补强',
    duration: '建议 5–7 天 · 聚焦模块化与闭环',
    headline: '从“堆梯形图”升级为 FB/UDT 模块化、SCL 状态机与 PID 闭环',
    whoFor: '已经会画常规启停、定时计数，但在大项目里变量散乱、模拟量 4–20mA 换算发怵、SCL 状态机和 PID 调参缺少系统章法。',
    outcome: '掌握一套设备写一个 FB + UDT 复用的工程范式，熟练完成 NORM_X/SCALE_X 断线保护、SCL CASE 状态机与 PID_Compact 恒压温控。',
    lessonIds: [
      'l10-fc-fb-instance-db',
      'l11-udt-global-db',
      'l12-scl-state-machine',
      'l13-analog-norm-scale',
      'l14-pid-compact-process',
    ],
    workbenches: [
      {
        tag: '模拟量实训',
        label: '4–20mA (0..27648) NORM_X / SCALE_X 仿真',
        detail: '拖动模拟量通道 %IW64，验证工程量缩放与迟滞补水保护',
        to: '/sim?preset=analog-scale-pid',
      },
      {
        tag: '闭环孪生',
        label: '双泵恒压供水与热工 PID 闭环模型',
        detail: '注入变送器断线故障，在三曲线趋势图里调试 PID 响应',
        to: '/models?model=tank-pressure-pid',
      },
    ],
    Icon: Sliders,
  },
  {
    id: 'interview',
    index: '路线三',
    tabLabel: '自动化应届 / 社招面试冲刺',
    shortTag: '求职冲刺',
    duration: '建议 3–5 天 · 高频追问与简历定稿',
    headline: '吃透扫描周期双线圈、PROFINET 1号报文与简历项目深挖题',
    whoFor: '正在准备 PLC 电气自动化 / 非标控制岗位面试，需要快速把简历项目讲出工程细节、防住面试官在急停、报文、排错上的连环追问。',
    outcome: '能清晰复述 PII/PIQ 与双线圈原理、STW1 047E→047F 上升沿使能逻辑，完成 15 道高频面试采分点自测并拿到可复用的 STAR 简历描述。',
    lessonIds: [
      'l03-scan-cycle-pii-piq',
      'l06b-troubleshooting-safety',
      'l12-scl-state-machine',
      'l15-profinet-project-delivery',
    ],
    workbenches: [
      {
        tag: '面试冲刺',
        label: '毕业大项目 · STAR 简历与 15 道面试自测',
        detail: '隐藏答案先自述、勾选采分点复盘，导出纯文本/Markdown 简历',
        to: '/capstone?tab=resume',
      },
      {
        tag: '报文实验',
        label: 'PROFINET 标准 1 号报文 (047E→047F) 实验台',
        detail: '逐位点击 STW1 控制字与 16#4000 转速给定，彻底搞懂驱动通讯',
        to: '/capstone?tab=arch',
      },
    ],
    Icon: Briefcase,
  },
];

const FALLBACK_STAGES = [
  {
    id: 'ch1',
    order: 1,
    badge: '阶段 01',
    title: '电气认知与 S7-1200 硬件接线',
    subtitle: '零基础入门 PLC 结构、漏型/源型接线与 TIA Portal 工程建立',
  },
  {
    id: 'ch2',
    order: 2,
    badge: '阶段 02',
    title: '扫描周期与经典位逻辑控制',
    subtitle: '起保停自锁、正反转双互锁、上升沿检测与置位复位规范',
  },
  {
    id: 'ch3',
    order: 3,
    badge: '阶段 03',
    title: 'IEC 定时器、计数器与顺序控制',
    subtitle: 'TON/TOF/TP、星三角降压启动、CTU 批次包装与状态机思想',
  },
  {
    id: 'ch4',
    order: 4,
    badge: '阶段 04',
    title: '模拟量标定、SCL 编程与 PID 闭环',
    subtitle: 'NORM_X/SCALE_X 工程量转换、FB/UDT 模块化与恒压温控',
  },
  {
    id: 'ch5',
    order: 5,
    badge: '阶段 05',
    title: 'PROFINET 通讯与工程交付实战',
    subtitle: '工业以太网组态、故障诊断、FAT/SAT 调试与简历项目冲刺',
  },
];

const SIM_PRESET_COUNT = 6;
const DIGITAL_TWIN_COUNT = 4;
const EXAMPLE_CASE_COUNT = 6;
const WORKFLOW_ANIM_COUNT = 3;

export const HomePage: React.FC = () => {
  const { state, getStats } = useProgress();
  const [activePipeIdx, setActivePipeIdx] = useState(0);
  const [activeTrackId, setActiveTrackId] = useState<CustomTrack['id']>(
    () => loadOnboardingProfile()?.trackId ?? 'beginner',
  );

  const safeChapters = Array.isArray(chapters) && chapters.length > 0 ? chapters : FALLBACK_STAGES;
  const safeLessons = useMemo(
    () => (Array.isArray(lessons) ? [...lessons].sort((a, b) => a.order - b.order) : []),
    []
  );
  const lessonById = useMemo(() => {
    const map = new Map<string, (typeof safeLessons)[number]>();
    safeLessons.forEach((l) => map.set(l.id, l));
    return map;
  }, [safeLessons]);

  const totalHours = Math.round(totalLessonMinutes(safeLessons) / 60);
  const stats = getStats(safeLessons.length);
  const activePipe = PIPELINE_NODES[activePipeIdx];
  const firstLesson = safeLessons[0];

  const activeTrack =
    CUSTOM_TRACKS.find((t) => t.id === activeTrackId) ?? CUSTOM_TRACKS[0];

  const activeTrackLessons = useMemo(
    () =>
      activeTrack.lessonIds
        .map((id) => lessonById.get(id))
        .filter((item): item is (typeof safeLessons)[number] => Boolean(item)),
    [activeTrack.lessonIds, lessonById]
  );

  const trackCompletedCount = activeTrackLessons.filter((l) =>
    state.completedLessonIds.includes(l.id)
  ).length;
  const trackNextLesson =
    activeTrackLessons.find((l) => !state.completedLessonIds.includes(l.id)) ??
    activeTrackLessons[0];

  const continueTarget = useMemo(() => {
    if (!state.lastVisitedLessonId) return null;
    const found = safeLessons.find((l) => l.id === state.lastVisitedLessonId);
    if (!found || found.id === firstLesson?.id) return null;
    return found;
  }, [safeLessons, state.lastVisitedLessonId, firstLesson]);

  const pillars = [
    {
      title: '分步课程',
      tag: '01 · 课程',
      desc: `${safeLessons.length} 讲，从“PLC 是什么”讲到完整项目。每讲都有动手练习、讲课模式、随堂笔记与测验解析。`,
      to: '/learn',
      cta: '查看课程目录',
      metric: `已完成 ${stats.completedLessons}/${safeLessons.length}`,
      Icon: BookOpen,
    },
    {
      title: '仿真实验室',
      tag: '02 · 仿真',
      desc: `${SIM_PRESET_COUNT} 个经典梯形图预设 + 自由沙盒。支持博途监控视图、交叉引用 F11、双线圈体检与示波器导出。`,
      to: '/sim',
      cta: '打开仿真器',
      metric: '无需硬件',
      Icon: Cpu,
    },
    {
      title: '设备模型',
      tag: '03 · 孪生',
      desc: `${DIGITAL_TWIN_COUNT} 套会动的 2.5D 设备：硬件接线台、视觉分拣带、恒压 PID 水箱、十字路口，含 12 道盲测故障排故。`,
      to: '/models',
      cta: '查看模型',
      metric: '可注入故障',
      Icon: Boxes,
    },
    {
      title: '工程实例',
      tag: '04 · 实例',
      desc: `${EXAMPLE_CASE_COUNT} 个常见工业案例，配备标准 I/O 表 .csv 与博途 .scl 源码下载、FAT 五步上电点检表。`,
      to: '/examples',
      cta: '浏览实例',
      metric: `已看 ${stats.examplesStudied} 个`,
      Icon: FolderKanban,
    },
  ];

  return (
    <div className="home-page">
      {/* ==================== 首屏 ==================== */}
      <section className="hero-section">
        <div className="spa-container hero-grid">
          <div>
            <div className="telemetry-eyebrow">
              <span className="telemetry-dot" />
              西门子 S7-1200 · 互动实训与数字孪生 v3.0
            </div>

            <h1 className="hero-title">
              从按下第一个按钮开始，
              <br />
              <span className="hero-title-accent">学会西门子 PLC</span>
            </h1>

            <p className="hero-desc">
              不需要买硬件，打开浏览器就能练。跟着 {safeLessons.length} 讲互动课程一步步学，学完后你能：
            </p>
            <ul className="hero-outcomes">
              <li>
                <CheckCircle2 size={16} />
                <span>
                  看懂按钮、传感器、指示灯是怎么接到<Term name="PLC">PLC</Term>上的
                </span>
              </li>
              <li>
                <CheckCircle2 size={16} />
                <span>
                  在<Term name="TIA Portal">博途</Term>里写出电机启停、延时、模拟量与 PID 闭环程序
                </span>
              </li>
              <li>
                <CheckCircle2 size={16} />
                <span>先在仿真器和 2.5D 设备模型里调通排错，再放心地上真实设备</span>
              </li>
            </ul>

            <div className="hero-cta-row">
              <Link
                to={firstLesson ? `/learn/${firstLesson.id}` : '/learn'}
                onMouseEnter={() => preloadRoute('/learn/l00-before-you-start')}
                onFocus={() => preloadRoute('/learn/l00-before-you-start')}
                className="btn btn-primary btn-lg hero-cta-main"
              >
                <Play size={16} fill="currentColor" />
                新手从这里开始
              </Link>
              {continueTarget && (
                <Link
                  to={`/learn/${continueTarget.id}`}
                  onMouseEnter={() => preloadRoute(`/learn/${continueTarget.id}`)}
                  onFocus={() => preloadRoute(`/learn/${continueTarget.id}`)}
                  className="btn btn-lg"
                >
                  继续第 {continueTarget.order} 讲
                  <ArrowRight size={15} />
                </Link>
              )}
            </div>
            <div className="hero-secondary-links">
              <Link
                to="/sim"
                onMouseEnter={() => preloadRoute('/sim')}
                onFocus={() => preloadRoute('/sim')}
              >
                先玩一下仿真器
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                to="/learn"
                onMouseEnter={() => preloadRoute('/learn')}
                onFocus={() => preloadRoute('/learn')}
              >
                查看全部课程
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                to="/glossary"
                onMouseEnter={() => preloadRoute('/glossary')}
                onFocus={() => preloadRoute('/glossary')}
              >
                术语表
              </Link>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                className="hero-cmdk-link"
                onClick={() => triggerCommandPaletteOpen()}
              >
                <Search size={13} aria-hidden="true" />
                全站速查 (Ctrl+K)
              </button>
            </div>

            <div className="hero-metrics-bar">
              <div className="hero-metric">
                <span className="hero-metric-val">{safeLessons.length}</span>
                <span className="hero-metric-lbl">讲互动课程</span>
              </div>
              <div className="hero-metric">
                <span className="hero-metric-val">约 {totalHours}</span>
                <span className="hero-metric-lbl">小时学完</span>
              </div>
              <div className="hero-metric">
                <span className="hero-metric-val">{SIM_PRESET_COUNT}</span>
                <span className="hero-metric-lbl">个仿真预设</span>
              </div>
              <div className="hero-metric">
                <span className="hero-metric-val" style={{ color: 'var(--green-text, var(--power-green))' }}>
                  {stats.lessonPct}%
                </span>
                <span className="hero-metric-lbl">你的课程进度</span>
              </div>
            </div>
          </div>

          {/* 首屏右侧：30 秒真交互微电柜 + 4 步成长全貌 */}
          <div className="hero-right-stack">
            <HeroMiniPlcBox />

            <div className="hero-rack-card is-compact-pipeline">
              <div className="hero-rack-bar">
                <span>从零到做出项目的 4 个阶段</span>
                <span className="hero-rack-status">
                  <span className="hero-rack-led" />
                  循序渐进
                </span>
              </div>

              <div className="hero-pipeline-tabs" role="tablist" aria-label="学习路线步骤">
                {PIPELINE_NODES.map((node, idx) => (
                  <button
                    key={node.id}
                    type="button"
                    role="tab"
                    aria-selected={activePipeIdx === idx}
                    className={`hero-pipe-btn${activePipeIdx === idx ? ' active' : ''}`}
                    onClick={() => setActivePipeIdx(idx)}
                  >
                    <div className="hero-pipe-step">{node.step}</div>
                    <div className="hero-pipe-name">{node.name}</div>
                  </button>
                ))}
              </div>

              <div className="hero-pipe-readout" role="tabpanel">
                <div>
                  <div className="hero-pipe-summary">{activePipe.summary}</div>
                  <div>{activePipe.desc}</div>
                </div>
                <Link
                  to={activePipe.route}
                  onMouseEnter={() => preloadRoute(activePipe.route)}
                  onFocus={() => preloadRoute(activePipe.route)}
                  className="btn btn-sm hero-pipe-cta"
                >
                  {activePipe.cta}
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <HomeStudyStrip />

      {/* ==================== v3.0 起点自测与定制学习路线 ==================== */}
      <section className="home-section track-planner-section" aria-labelledby="track-planner-heading">
        <div className="spa-container">
          <div className="section-header">
            <div>
              <div className="telemetry-eyebrow">
                <Compass size={14} />
                起点自测 · 定制学习路线
              </div>
              <h2 id="track-planner-heading" className="section-title">
                按你的当前基础，直接进入最合适的课程序列
              </h2>
              <p className="section-sub">
                不必从头盲刷：选一个最贴近你现状的身份，立即拿到精选课程顺序与对应实训台直达入口。
              </p>
            </div>
          </div>

          <OnboardingQuiz onResult={(trackId) => setActiveTrackId(trackId)} />

          <div className="track-planner-shell">
            <div className="track-switcher" role="tablist" aria-label="选择你的学习起点">
              {CUSTOM_TRACKS.map((track) => {
                const Icon = track.Icon;
                const isSelected = track.id === activeTrack.id;
                return (
                  <button
                    key={track.id}
                    type="button"
                    role="tab"
                    id={`track-tab-${track.id}`}
                    aria-selected={isSelected}
                    aria-controls={`track-panel-${track.id}`}
                    className={`track-tab${isSelected ? ' is-active' : ''}`}
                    onClick={() => setActiveTrackId(track.id)}
                  >
                    <span className="track-tab-top">
                      <span className="track-tab-index">{track.index}</span>
                      <span className="track-tab-icon" aria-hidden="true">
                        <Icon size={16} />
                      </span>
                    </span>
                    <span className="track-tab-title">{track.tabLabel}</span>
                    <span className="track-tab-meta">{track.duration}</span>
                  </button>
                );
              })}
            </div>

            <div
              id={`track-panel-${activeTrack.id}`}
              role="tabpanel"
              aria-labelledby={`track-tab-${activeTrack.id}`}
              className="track-panel"
            >
              <div className="track-panel-overview">
                <div className="track-panel-head">
                  <div>
                    <span className="badge badge-teal badge-mono">{activeTrack.shortTag}</span>
                    <h3 className="track-panel-title">{activeTrack.headline}</h3>
                  </div>
                  <div className="track-progress-chip">
                    <span>本路线进度</span>
                    <strong>
                      {trackCompletedCount} / {activeTrackLessons.length} 讲
                    </strong>
                  </div>
                </div>

                <div className="track-brief-grid">
                  <div className="track-brief-cell">
                    <span className="track-brief-label">适合谁</span>
                    <p>{activeTrack.whoFor}</p>
                  </div>
                  <div className="track-brief-cell">
                    <span className="track-brief-label">达成目标</span>
                    <p>{activeTrack.outcome}</p>
                  </div>
                </div>

                <div className="track-cta-bar">
                  {trackNextLesson && (
                    <Link
                      to={`/learn/${trackNextLesson.id}`}
                      onMouseEnter={() => preloadRoute(`/learn/${trackNextLesson.id}`)}
                      onFocus={() => preloadRoute(`/learn/${trackNextLesson.id}`)}
                      className="btn btn-primary"
                    >
                      <Play size={15} fill="currentColor" />
                      {trackCompletedCount > 0 && trackCompletedCount < activeTrackLessons.length
                        ? `继续本路线：第 ${trackNextLesson.order} 讲`
                        : `从第 ${trackNextLesson.order} 讲开始本路线`}
                    </Link>
                  )}
                  <Link
                    to={activeTrack.workbenches[0].to}
                    onMouseEnter={() => preloadRoute(activeTrack.workbenches[0].to)}
                    onFocus={() => preloadRoute(activeTrack.workbenches[0].to)}
                    className="btn"
                  >
                    直达主推实训台
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>

              <div className="track-panel-columns">
                <div className="track-lessons-col">
                  <div className="track-col-heading">
                    <span>推荐学习顺序</span>
                    <span className="track-col-mono">
                      精选必学 · 共 {activeTrackLessons.length} 讲
                    </span>
                  </div>
                  <ol className="track-lesson-list">
                    {activeTrackLessons.map((lesson, idx) => {
                      const done = state.completedLessonIds.includes(lesson.id);
                      return (
                        <li key={lesson.id}>
                          <Link
                            to={`/learn/${lesson.id}`}
                            onMouseEnter={() => preloadRoute(`/learn/${lesson.id}`)}
                            onFocus={() => preloadRoute(`/learn/${lesson.id}`)}
                            className={`track-lesson-item${done ? ' is-done' : ''}`}
                          >
                            <span className="track-lesson-step">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="track-lesson-info">
                              <span className="track-lesson-name">
                                第 {lesson.order} 讲 · {lesson.title}
                              </span>
                              <span className="track-lesson-recap">
                                {lesson.recap || lesson.subtitle}
                              </span>
                            </span>
                            <span className="track-lesson-end">
                              {done ? (
                                <CheckCircle2
                                  size={16}
                                  color="var(--green-text, var(--power-green))"
                                  aria-label="已掌握"
                                />
                              ) : (
                                <ArrowRight size={14} aria-hidden="true" />
                              )}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                </div>

                <div className="track-workbenches-col">
                  <div className="track-col-heading">
                    <span>直达配套实训台</span>
                    <span className="track-col-mono">边学边练</span>
                  </div>
                  <div className="track-wb-list">
                    {activeTrack.workbenches.map((wb) => (
                      <Link
                        key={wb.to}
                        to={wb.to}
                        onMouseEnter={() => preloadRoute(wb.to)}
                        onFocus={() => preloadRoute(wb.to)}
                        className="track-wb-card"
                      >
                        <div className="track-wb-top">
                          <span className="badge badge-mono">{wb.tag}</span>
                          <ArrowRight size={14} aria-hidden="true" />
                        </div>
                        <div className="track-wb-title">{wb.label}</div>
                        <p className="track-wb-detail">{wb.detail}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 网站里有什么 ==================== */}
      <section className="home-section">
        <div className="spa-container">
          <div className="section-header">
            <div>
              <div className="telemetry-eyebrow">
                <span className="telemetry-dot teal" />
                网站里有什么
              </div>
              <h2 className="section-title">课程、仿真、设备模型和实例，都在一个地方</h2>
              <p className="section-sub">
                它们用的是同一套变量和仿真引擎，课程里学到的，马上能在仿真器和模型里试。
              </p>
            </div>
          </div>

          <div className="pillars-grid">
            {pillars.map((p) => {
              const Icon = p.Icon;
              return (
                <Link
                  key={p.to}
                  to={p.to}
                  onMouseEnter={() => preloadRoute(p.to)}
                  onFocus={() => preloadRoute(p.to)}
                  className="pillar-card"
                >
                  <div className="pillar-top">
                    <span className="pillar-icon">
                      <Icon size={20} />
                    </span>
                    <span className="pillar-index">{p.tag}</span>
                  </div>
                  <h3 className="pillar-title">{p.title}</h3>
                  <p className="pillar-desc">{p.desc}</p>
                  <div className="pillar-foot">
                    <span>{p.cta}</span>
                    <span className="pillar-metric">
                      {p.metric}
                      <ArrowRight size={14} color="var(--teal-text, var(--siemens-teal-bright))" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
          <p className="section-footnote">
            还有 {WORKFLOW_ANIM_COUNT} 个原理动画（扫描周期、状态机、项目流程），在课程里会直接用到，也可以在
            <Link
              to="/workflows"
              onMouseEnter={() => preloadRoute('/workflows')}
              onFocus={() => preloadRoute('/workflows')}
            >
              {' '}
              工作流{' '}
            </Link>
            页单独查看。
          </p>
        </div>
      </section>

      {/* ==================== 学习路线 ==================== */}
      <section className="home-section">
        <div className="spa-container">
          <div className="section-header">
            <div>
              <div className="telemetry-eyebrow">
                <span className="telemetry-dot" />
                学习路线
              </div>
              <h2 className="section-title">5 个阶段，从零基础到能独立完成一个小项目</h2>
            </div>
          </div>

          <div className="roadmap-grid">
            {safeChapters.map((ch) => {
              const chapterLessons = safeLessons.filter((l) => l.chapterId === ch.id);
              const doneInCh = chapterLessons.filter((l) =>
                state.completedLessonIds.includes(l.id)
              ).length;
              const chTotal = chapterLessons.length;
              const chMinutes = totalLessonMinutes(chapterLessons);
              const pct = chTotal > 0 ? Math.round((doneInCh / chTotal) * 100) : 0;
              const firstTarget = chapterLessons[0]
                ? `/learn/${chapterLessons[0].id}`
                : `/learn?chapter=${encodeURIComponent(ch.id)}`;

              return (
                <Link
                  key={ch.id}
                  to={firstTarget}
                  onMouseEnter={() => preloadRoute(firstTarget)}
                  onFocus={() => preloadRoute(firstTarget)}
                  className="roadmap-card"
                >
                  <div className="roadmap-stage-row">
                    <span className="roadmap-num">
                      阶段 {ch.order} · {ch.badge}
                    </span>
                    {chTotal > 0 && doneInCh === chTotal && (
                      <CheckCircle2 size={16} color="var(--power-green)" />
                    )}
                  </div>
                  <h3 className="roadmap-title">{ch.title.replace(/^第 \d+ 章：/, '')}</h3>
                  <p className="roadmap-sub">{ch.subtitle}</p>
                  <div className="roadmap-progress-track">
                    <div className="roadmap-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="roadmap-meta">
                    <span>
                      {chTotal} 讲 · <Clock size={11} /> 约 {formatDuration(chMinutes)}
                    </span>
                    <span>
                      {doneInCh}/{chTotal}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== 毕业项目 ==================== */}
      <section className="home-section">
        <div className="spa-container">
          <div className="capstone-spotlight">
            <div>
              <div className="telemetry-eyebrow" style={{ color: 'var(--alarm-amber)' }}>
                <Star size={14} />
                毕业项目 · 建议学完第 4 阶段再挑战
              </div>
              <h2>综合练习：锂电模组分拣、热压温控与入库工作站</h2>
              <p>
                把前面学的内容串成一个完整项目：需求说明、PROFINET 1号报文实验台、I/O 分配表、多模式状态机、PID
                温度控制和监控画面。附带可一键下载并导入 TIA Portal 的 .scl 源文件，以及 STAR 简历模板与 15
                道面试官模拟追问。
              </p>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <Link
                  to="/capstone"
                  onMouseEnter={() => preloadRoute('/capstone')}
                  onFocus={() => preloadRoute('/capstone')}
                  className="btn btn-lg"
                >
                  <Star size={16} />
                  了解毕业项目
                  <ArrowRight size={15} />
                </Link>
                <span className="badge badge-amber badge-mono" style={{ padding: '7px 12px' }}>
                  里程碑：{stats.capstoneDone} / {stats.capstoneTotal}
                </span>
              </div>
            </div>

            <div className="capstone-deliverables">
              <div className="capstone-deliv-item">
                <strong>可导入博途的 .scl 源文件</strong>
                <span>包含自定义数据类型、设备功能块、状态机与温控程序，支持一键下载</span>
              </div>
              <div className="capstone-deliv-item">
                <strong>模拟监控画面与报文台</strong>
                <span>在网页上试启停、急停复位、报警确认，实操 047E→047F 控制字</span>
              </div>
              <div className="capstone-deliv-item">
                <strong>项目经历写法参考</strong>
                <span>按应届、转行、在职等不同背景给出纯文本与 Markdown 双格式描述</span>
              </div>
              <div className="capstone-deliv-item">
                <strong>15 道面试官模拟抽题自测</strong>
                <span>通讯故障、PID 振荡、双线圈、急停回路，先自述采分点再看解析</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 常见问题 ==================== */}
      <section className="home-section">
        <div className="spa-container">
          <FaqSection id="home-faq" compact />
        </div>
      </section>
    </div>
  );
};
