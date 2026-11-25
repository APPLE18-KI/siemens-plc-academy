import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Boxes,
  CheckCircle2,
  Clock,
  Cpu,
  FolderKanban,
  GitBranch,
  Play,
  Star,
  TerminalSquare,
} from 'lucide-react';
import { chapters, examples, lessons, modelRegistry, simPresets, workflowRegistry } from '../../registry';
import { formatDuration, totalLessonMinutes } from '../../content/curriculum';
import { useProgress } from '../store/progressStore';
import { Term } from '../../components/Term';
import { FaqSection } from '../../components/FaqSection';

interface PipelineNode {
  id: string;
  step: string;
  name: string;
  summary: string;
  desc: string;
  route: string;
  cta: string;
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
    desc: '在浏览器里直接运行梯形图：按下按钮，能看到哪条线通电、哪个输出亮起，还能单步慢放，一步步看清 PLC 是怎么执行的。',
    route: '/sim',
    cta: '打开仿真实验室',
  },
  {
    id: 'twin',
    step: '第 3 步',
    name: '控制一台设备',
    summary: '传送带、水箱、红绿灯模型',
    desc: '用程序去控制会动的设备模型：分拣传送带、恒压供水水箱、十字路口红绿灯，还可以人为制造故障，练习排查。',
    route: '/models',
    cta: '查看设备模型',
  },
  {
    id: 'capstone',
    step: '第 4 步',
    name: '完成一个项目',
    summary: '综合练习 + 可导入博途的源码',
    desc: '把前面学的串起来，完成一个分拣 + 温控的小型工作站综合练习，附带可以导入 TIA Portal 的 .scl 源文件和项目说明。',
    route: '/capstone',
    cta: '了解毕业项目',
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

export const HomePage: React.FC = () => {
  const { state, getStats } = useProgress();
  const [activePipeIdx, setActivePipeIdx] = useState(0);

  const safeChapters = Array.isArray(chapters) && chapters.length > 0 ? chapters : FALLBACK_STAGES;
  const safeLessons = useMemo(
    () => (Array.isArray(lessons) ? [...lessons].sort((a, b) => a.order - b.order) : []),
    []
  );
  const safeExamples = Array.isArray(examples) ? examples : [];
  const simCount = simPresets ? Object.keys(simPresets).length : 6;
  const modelCount = modelRegistry ? Object.keys(modelRegistry).length : 4;
  const workflowCount = workflowRegistry ? Object.keys(workflowRegistry).length : 3;
  const totalHours = Math.round(totalLessonMinutes(safeLessons) / 60);

  const stats = getStats(safeLessons.length);
  const activePipe = PIPELINE_NODES[activePipeIdx];
  const firstLesson = safeLessons[0];

  const continueTarget = useMemo(() => {
    if (!state.lastVisitedLessonId) return null;
    const found = safeLessons.find((l) => l.id === state.lastVisitedLessonId);
    if (!found || found.id === firstLesson?.id) return null;
    return found;
  }, [safeLessons, state.lastVisitedLessonId, firstLesson]);

  const pillars = [
    {
      title: '分步课程',
      tag: '课程',
      desc: `${safeLessons.length} 讲，从“PLC 是什么”讲到完整项目。每讲都有动手练习、小测验和答案解析。`,
      to: '/learn',
      cta: '查看课程目录',
      metric: `已完成 ${stats.completedLessons}/${safeLessons.length}`,
      Icon: BookOpen,
    },
    {
      title: '仿真实验室',
      tag: '仿真',
      desc: `${simCount} 个现成的梯形图练习，外加一个可以自己搭程序的沙盒。按按钮、看通电、单步慢放。`,
      to: '/sim',
      cta: '打开仿真器',
      metric: '无需硬件',
      Icon: Cpu,
    },
    {
      title: '设备模型',
      tag: '模型',
      desc: `${modelCount} 套会动的设备：传送带分拣、恒压供水、十字路口红绿灯等，可以模拟故障来练习排查。`,
      to: '/models',
      cta: '查看模型',
      metric: '可注入故障',
      Icon: Boxes,
    },
    {
      title: '工程实例',
      tag: '实例',
      desc: `${safeExamples.length || 6} 个常见控制案例，每个都有 I/O 表、梯形图与 SCL 代码，以及调试时容易踩的坑。`,
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
              西门子 S7-1200 · 零基础入门
            </div>

            <h1 className="hero-title">
              从按下第一个按钮开始，
              <br />
              <span className="hero-title-accent">学会西门子 PLC</span>
            </h1>

            <p className="hero-desc">
              不需要买硬件，打开浏览器就能练。跟着 {safeLessons.length} 讲课程一步步学，学完后你能：
            </p>
            <ul className="hero-outcomes">
              <li>
                <CheckCircle2 size={16} />
                看懂按钮、传感器、指示灯是怎么接到<Term name="PLC">PLC</Term>上的
              </li>
              <li>
                <CheckCircle2 size={16} />
                在<Term name="TIA Portal">博途</Term>里写出电机启停、延时、计数等常见程序
              </li>
              <li>
                <CheckCircle2 size={16} />
                先在电脑上仿真调通，再放心地上真实设备
              </li>
            </ul>

            <div className="hero-cta-row">
              <Link
                to={firstLesson ? `/learn/${firstLesson.id}` : '/learn'}
                className="btn btn-primary btn-lg hero-cta-main"
              >
                <Play size={16} fill="currentColor" />
                新手从这里开始
              </Link>
              <Link
                to="/ide"
                className="btn btn-lg"
                style={{
                  borderColor: 'var(--siemens-teal-border)',
                  background: 'var(--siemens-teal-soft)',
                }}
              >
                <TerminalSquare size={16} />
                博途在线编程台
              </Link>
              {continueTarget && (
                <Link to={`/learn/${continueTarget.id}`} className="btn btn-lg">
                  继续第 {continueTarget.order} 讲
                  <ArrowRight size={15} />
                </Link>
              )}
            </div>
            <div className="hero-secondary-links">
              <Link to="/ide">亲手写 SCL 控产线</Link>
              <span aria-hidden="true">·</span>
              <Link to="/sim">先玩梯形图仿真器</Link>
              <span aria-hidden="true">·</span>
              <Link to="/learn">查看全部课程</Link>
              <span aria-hidden="true">·</span>
              <Link to="/glossary">术语表</Link>
            </div>

            <div className="hero-metrics-bar">
              <div className="hero-metric">
                <span className="hero-metric-val">{safeLessons.length}</span>
                <span className="hero-metric-lbl">讲课程</span>
              </div>
              <div className="hero-metric">
                <span className="hero-metric-val">约 {totalHours}</span>
                <span className="hero-metric-lbl">小时学完</span>
              </div>
              <div className="hero-metric">
                <span className="hero-metric-val">{simCount}</span>
                <span className="hero-metric-lbl">个仿真练习</span>
              </div>
              <div className="hero-metric">
                <span className="hero-metric-val" style={{ color: 'var(--power-green)' }}>
                  {stats.lessonPct}%
                </span>
                <span className="hero-metric-lbl">你的课程进度</span>
              </div>
            </div>
          </div>

          {/* 学习路线示意 */}
          <div className="hero-rack-card">
            <div className="hero-rack-bar">
              <span>学习路线 · 4 步</span>
              <span className="hero-rack-status">
                <span className="hero-rack-led" />
                运行中
              </span>
            </div>

            <div className="hero-rack-svg-wrap">
              <svg
                viewBox="0 0 540 228"
                width="100%"
                style={{ height: 'auto', display: 'block' }}
                role="img"
                aria-label="学习路线示意：认识 PLC、写程序看效果、控制设备模型、完成项目"
              >
                <defs>
                  <linearGradient id="plcFace" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1c2735" />
                    <stop offset="100%" stopColor="#121a24" />
                  </linearGradient>
                  <linearGradient id="busLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#009999" />
                    <stop offset="50%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>

                {/* DIN Rail */}
                <rect x="14" y="96" width="512" height="14" rx="3" fill="#18222e" stroke="#2a3a4d" />

                {/* Connecting Animated PROFINET / Closed-Loop Bus */}
                <path
                  d="M 118 103 L 222 103 M 272 103 L 368 103 M 418 103 L 495 103"
                  stroke="url(#busLine)"
                  strokeWidth="2.5"
                  strokeDasharray="6 6"
                  style={{ animation: 'dash-flow 1.4s linear infinite' }}
                />

                {/* Module 1: S7-1200 CPU Hardware */}
                <g
                  transform="translate(18, 22)"
                  onClick={() => setActivePipeIdx(0)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    width="116"
                    height="156"
                    rx="10"
                    fill="url(#plcFace)"
                    stroke={activePipeIdx === 0 ? '#14d4d4' : '#2d3f54'}
                    strokeWidth={activePipeIdx === 0 ? '2' : '1.2'}
                  />
                  <rect x="0" y="0" width="116" height="24" rx="10" fill="#007d7d" />
                  <rect x="0" y="14" width="116" height="10" fill="#007d7d" />
                  <text x="10" y="16" fill="#ffffff" fontSize="11" fontWeight="700" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                    SIEMENS S7-1200
                  </text>

                  {/* Status LEDs */}
                  <circle cx="18" cy="40" r="3.5" fill="#10b981" />
                  <text x="27" y="43" fill="#9fb4c8" fontSize="10.4" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                    RUN/STOP
                  </text>
                  <circle cx="18" cy="54" r="3.5" fill="#334155" />
                  <text x="27" y="57" fill="#94a3b8" fontSize="10.4" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                    ERROR
                  </text>
                  <circle cx="18" cy="68" r="3.5" fill="#f59e0b" opacity="0.85" />
                  <text x="27" y="71" fill="#9fb4c8" fontSize="10.4" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                    MAINT
                  </text>

                  {/* DI / DQ LED Strip */}
                  <text x="12" y="92" fill="#6d839a" fontSize="9.8" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                    DI %I0.0–0.7
                  </text>
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((ch) => (
                    <rect
                      key={`di-${ch}`}
                      x={12 + ch * 12}
                      y="97"
                      width="8"
                      height="6"
                      rx="1.5"
                      fill={ch === 0 || ch === 2 || ch === 5 ? '#38bdf8' : '#223142'}
                    />
                  ))}
                  <text x="12" y="117" fill="#6d839a" fontSize="9.8" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                    DQ %Q0.0–0.5
                  </text>
                  {[0, 1, 2, 3, 4, 5].map((ch) => (
                    <rect
                      key={`dq-${ch}`}
                      x={12 + ch * 12}
                      y="122"
                      width="8"
                      height="6"
                      rx="1.5"
                      fill={ch === 0 || ch === 1 || ch === 3 ? '#10b981' : '#223142'}
                    />
                  ))}
                  {/* RJ45 Port */}
                  <rect x="42" y="136" width="32" height="13" rx="2.5" fill="#091017" stroke="#39506a" />
                  <circle cx="48" cy="142.5" r="2" fill="#10b981" />
                  <circle cx="68" cy="142.5" r="2" fill="#f59e0b" />
                </g>

                {/* Module 2: PROFINET & Live LAD Engine */}
                <g
                  transform="translate(154, 42)"
                  onClick={() => setActivePipeIdx(1)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    width="112"
                    height="120"
                    rx="10"
                    fill="#121c27"
                    stroke={activePipeIdx === 1 ? '#14d4d4' : '#2b3e52'}
                    strokeWidth={activePipeIdx === 1 ? '2' : '1.2'}
                  />
                  <text x="12" y="22" fill="#2dd4bf" fontSize="11" fontWeight="700" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                    梯形图仿真
                  </text>
                  {/* Mini Energized Ladder Rung */}
                  <line x1="14" y1="42" x2="14" y2="90" stroke="#00b8b8" strokeWidth="2.5" />
                  <line x1="14" y1="54" x2="34" y2="54" stroke="#10b981" strokeWidth="2" />
                  <text x="34" y="57" fill="#10b981" fontSize="11" fontWeight="700" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                    | |
                  </text>
                  <line x1="53" y1="54" x2="74" y2="54" stroke="#10b981" strokeWidth="2" />
                  <text x="74" y="57" fill="#f59e0b" fontSize="11" fontWeight="700" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                    ( )
                  </text>
                  <line x1="92" y1="54" x2="100" y2="54" stroke="#00b8b8" strokeWidth="2" />
                  {/* Seal-in branch */}
                  <path d="M 24 54 L 24 76 L 34 76 M 53 76 L 62 76 L 62 54" fill="none" stroke="#10b981" strokeWidth="1.8" />
                  <text x="34" y="79" fill="#10b981" fontSize="11" fontWeight="700" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                    | |
                  </text>
                  <text x="12" y="106" fill="#8ca3ba" fontSize="10.4" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                    看见“通电”
                  </text>
                </g>

                {/* Module 3: 2.5D Digital Twin */}
                <g
                  transform="translate(286, 42)"
                  onClick={() => setActivePipeIdx(2)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    width="112"
                    height="120"
                    rx="10"
                    fill="#121c27"
                    stroke={activePipeIdx === 2 ? '#14d4d4' : '#2b3e52'}
                    strokeWidth={activePipeIdx === 2 ? '2' : '1.2'}
                  />
                  <text x="12" y="22" fill="#38bdf8" fontSize="11" fontWeight="700" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                    设备模型
                  </text>
                  {/* Conveyor + Workpiece Icon */}
                  <rect x="14" y="70" width="84" height="14" rx="7" fill="#1e2d3d" stroke="#38bdf8" strokeWidth="1.2" />
                  <circle cx="24" cy="77" r="4" fill="#38bdf8" />
                  <circle cx="56" cy="77" r="4" fill="#38bdf8" />
                  <circle cx="88" cy="77" r="4" fill="#38bdf8" />
                  <rect x="44" y="47" width="24" height="20" rx="3" fill="#009999" stroke="#2dd4bf" />
                  <line x1="56" y1="32" x2="56" y2="46" stroke="#10b981" strokeWidth="1.6" strokeDasharray="3 2" />
                  <text x="12" y="106" fill="#8ca3ba" fontSize="10.4" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                    4 套设备模型
                  </text>
                </g>

                {/* Module 4: Capstone Job Project */}
                <g
                  transform="translate(418, 42)"
                  onClick={() => setActivePipeIdx(3)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    width="104"
                    height="120"
                    rx="10"
                    fill="#181915"
                    stroke={activePipeIdx === 3 ? '#f59e0b' : '#4a3d22'}
                    strokeWidth={activePipeIdx === 3 ? '2' : '1.2'}
                  />
                  <text x="11" y="22" fill="#f59e0b" fontSize="11" fontWeight="700" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                    毕业项目 ★
                  </text>
                  {/* Mini SCADA Trend */}
                  <polyline
                    points="12,78 28,68 42,72 58,48 74,52 92,38"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="92" cy="38" r="3.5" fill="#f59e0b" />
                  <text x="11" y="94" fill="#e5d5b3" fontSize="10.4" fontWeight="600">
                    锂电视觉热压站
                  </text>
                  <text x="11" y="108" fill="#a89b7e" fontSize="10.4" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                    含博途源码
                  </text>
                </g>

                {/* Bottom closed-loop return line */}
                <path
                  d="M 470 164 L 470 198 L 76 198 L 76 180"
                  fill="none"
                  stroke="#009999"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.7"
                />
                <text x="184" y="213" fill="#6f879e" fontSize="11" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                  学习路线：认识硬件 → 仿真调试 → 控制设备 → 完成项目
                </text>
              </svg>
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
              <Link to={activePipe.route} className="btn btn-sm hero-pipe-cta">
                {activePipe.cta}
                <ArrowRight size={13} />
              </Link>
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
              <p className="section-sub">它们用的是同一套变量和仿真引擎，课程里学到的，马上能在仿真器和模型里试。</p>
            </div>
          </div>

          <div className="pillars-grid">
            {pillars.map((p) => {
              const Icon = p.Icon;
              return (
                <Link key={p.to} to={p.to} className="pillar-card">
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
                      <ArrowRight size={14} color="var(--siemens-teal-bright)" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
          <p className="section-footnote">
            还有 {workflowCount} 个原理动画（扫描周期、状态机、项目流程），在课程里会直接用到，也可以在
            <Link to="/workflows"> 工作流 </Link>页单独查看。
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
                <Link key={ch.id} to={firstTarget} className="roadmap-card">
                  <div className="roadmap-stage-row">
                    <span className="roadmap-num">阶段 {ch.order} · {ch.badge}</span>
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
              <div className="telemetry-eyebrow" style={{ color: '#fbbf24' }}>
                <Star size={14} />
                毕业项目 · 建议学完第 4 阶段再挑战
              </div>
              <h2>综合练习：锂电模组分拣、热压温控与入库工作站</h2>
              <p>
                把前面学的内容串成一个完整项目：需求说明、I/O 分配表、多模式状态机、PID 温度控制和监控画面。附带可以导入
                TIA Portal 的 .scl 源文件，以及项目经历的写法参考和常见面试问题解析，适合放进作品集。
              </p>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <Link to="/capstone" className="btn btn-lg">
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
                <span>包含自定义数据类型、设备功能块、状态机与温控程序</span>
              </div>
              <div className="capstone-deliv-item">
                <strong>模拟监控画面</strong>
                <span>在网页上试启停、急停复位，查看温度曲线和报警记录</span>
              </div>
              <div className="capstone-deliv-item">
                <strong>项目经历写法参考</strong>
                <span>按应届、转行、在职等不同背景给出描述示例</span>
              </div>
              <div className="capstone-deliv-item">
                <strong>15 道常见面试问题解析</strong>
                <span>通讯故障、PID 振荡、双线圈、急停回路等</span>
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
