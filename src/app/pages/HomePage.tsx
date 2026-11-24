import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Boxes,
  CheckCircle2,
  Cpu,
  FolderKanban,
  GitBranch,
  Play,
  Sparkles,
  Star,
} from 'lucide-react';
import {
  chapters,
  examples,
  lessons,
  modelRegistry,
  simPresets,
  workflowRegistry,
} from '../../registry';
import { useProgress } from '../store/progressStore';

interface PipelineNode {
  id: string;
  step: string;
  name: string;
  protocol: string;
  desc: string;
  route: string;
  cta: string;
  ioHighlight: string;
}

const PIPELINE_NODES: PipelineNode[] = [
  {
    id: 'plc',
    step: '01 · CTRL',
    name: 'S7-1200 内核',
    protocol: 'OB1 扫描 · PII / PIQ · IEC 定时器',
    desc: '从零理解 CPU 1214C/1215C 硬件接线、NPN/PNP 传感器选型，到 LAD 梯形图与 SCL 结构化编程实战。',
    route: '/learn',
    cta: '进入 15 讲课程',
    ioHighlight: '%I0.0 / %Q0.0 / TON_DB',
  },
  {
    id: 'pn',
    step: '02 · COMM',
    name: 'PROFINET 联调',
    protocol: '100Mbps 实时以太网 · 梯形图能流仿真',
    desc: '在浏览器实时运行 PLC 扫描周期，在线监控触点荧光绿导通、强制 I/O 信号并查看数字时序波形。',
    route: '/sim',
    cta: '打开仿真实验室',
    ioHighlight: 'PII → OB1 → PIQ (10ms)',
  },
  {
    id: 'twin',
    step: '03 · TWIN',
    name: '2.5D 数字孪生',
    protocol: '物理动力学联动 · 现场故障注入',
    desc: '4 套高精度 SVG 工业被控对象与 6 个工程实例：视觉分拣线、双泵恒压供水、热工储罐与十字路口。',
    route: '/models',
    cta: '探索数字孪生',
    ioHighlight: '%IW64 → NORM_X → SCALE_X',
  },
  {
    id: 'capstone',
    step: '04 · JOB',
    name: '简历毕业项目',
    protocol: 'PackML + PID 温控 + WinCC SCADA',
    desc: '交付锂电模组柔性分拣热压工作站，附可导入 TIA Portal 的 .scl 源码、STAR 简历生成器与 15 问面试话术。',
    route: '/capstone',
    cta: '冲刺毕业项目',
    ioHighlight: 'S7-1215C + PROFINET',
  },
];

const FALLBACK_STAGES = [
  {
    id: 'ch1',
    order: 1,
    badge: 'STAGE 01',
    title: '电气认知与 S7-1200 硬件接线',
    subtitle: '零基础入门 PLC 结构、漏型/源型接线与 TIA Portal 工程建立',
  },
  {
    id: 'ch2',
    order: 2,
    badge: 'STAGE 02',
    title: '扫描周期与经典位逻辑控制',
    subtitle: '起保停自锁、正反转双互锁、上升沿检测与置位复位规范',
  },
  {
    id: 'ch3',
    order: 3,
    badge: 'STAGE 03',
    title: 'IEC 定时器、计数器与顺序控制',
    subtitle: 'TON/TOF/TP、星三角降压启动、CTU 批次包装与状态机思想',
  },
  {
    id: 'ch4',
    order: 4,
    badge: 'STAGE 04',
    title: '模拟量标定、SCL 编程与 PID 闭环',
    subtitle: 'NORM_X/SCALE_X 工程量转换、FB/UDT 模块化与恒压温控',
  },
  {
    id: 'ch5',
    order: 5,
    badge: 'STAGE 05',
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

  const stats = getStats(safeLessons.length || 15);
  const activePipe = PIPELINE_NODES[activePipeIdx];

  const primaryLessonTarget = useMemo(() => {
    if (safeLessons.length === 0) return { to: '/learn', label: '从零基础第一课开始' };
    if (state.lastVisitedLessonId) {
      const found = safeLessons.find((l) => l.id === state.lastVisitedLessonId);
      if (found) {
        return {
          to: `/learn/${found.id}`,
          label: `继续第 ${found.order} 讲：${found.title.slice(0, 14)}${found.title.length > 14 ? '…' : ''}`,
        };
      }
    }
    return { to: `/learn/${safeLessons[0].id}`, label: '从零基础第一课开始' };
  }, [safeLessons, state.lastVisitedLessonId]);

  const pillars = [
    {
      index: '01 / LEARN',
      title: '互动式渐进教学',
      desc: '5 大阶段 15 节实战精品课，每讲嵌入实时仿真、数字孪生、LAD/SCL 双码对照、动手工单与随堂闯关测验。',
      to: '/learn',
      cta: `浏览 ${safeLessons.length || 15} 节课程`,
      metric: `已完成 ${stats.completedLessons}/${safeLessons.length || 15}`,
      Icon: BookOpen,
    },
    {
      index: '02 / EXAMPLES',
      title: '工业实例工作台',
      desc: '6 套真实工业现场案例，覆盖起保停、星三角、分拣产线、双泵恒压供水、红绿灯与热压温控，含踩坑警示与面试考点。',
      to: '/examples',
      cta: `进入 ${safeExamples.length || 6} 个实例`,
      metric: `已研读 ${stats.examplesStudied} 个`,
      Icon: FolderKanban,
    },
    {
      index: '03 / TWIN',
      title: '2.5D 数字孪生建模',
      desc: '4 套物理规律驱动的高精度工业被控对象：S7-1200 硬件接线台、三工位分拣线、双泵储罐 PID、智能十字路口。',
      to: '/models',
      cta: `查看 ${modelCount} 套模型`,
      metric: '支持故障注入与联调',
      Icon: Boxes,
    },
    {
      index: '04 / WORKFLOW',
      title: '核心工作流解剖',
      desc: '可视化剖析 PLC 微观扫描周期与双线圈事故、GRAFCET/PackML 状态机步进，以及非标自动化工程全生命周期交付。',
      to: '/workflows',
      cta: `剖析 ${workflowCount} 大工作流`,
      metric: '从原理到工程交付',
      Icon: GitBranch,
    },
  ];

  return (
    <div className="home-page">
      {/* ==================== HERO SECTION ==================== */}
      <section className="hero-section">
        <div className="spa-container hero-grid">
          <div>
            <div className="telemetry-eyebrow">
              <span className="telemetry-dot" />
              SIEMENS S7-1200 / 1500 · TIA PORTAL · 零基础到工业现场
            </div>

            <h1 className="hero-title">
              在真实工业项目中，
              <br />
              <span className="hero-title-accent">边做边学</span> 西门子 PLC
            </h1>

            <p className="hero-desc">
              告别纯背指令的枯燥教材。这里将 <strong>博途 LAD/SCL 编程</strong>、
              <strong>实时扫描周期仿真</strong>、<strong>2.5D 产线数字孪生</strong> 与{' '}
              <strong>简历级锂电自动化毕业项目</strong> 融为一体，带你打通从电气接线到项目交付的完整闭环。
            </p>

            <div className="hero-cta-row">
              <Link to={primaryLessonTarget.to} className="btn btn-primary btn-lg">
                <Play size={16} fill="currentColor" />
                {primaryLessonTarget.label}
              </Link>
              <Link to="/sim" className="btn btn-lg">
                <Cpu size={17} />
                直达 PLC 仿真台
              </Link>
              <Link
                to="/capstone"
                className="btn btn-lg"
                style={{
                  borderColor: 'var(--alarm-amber-border)',
                  color: 'var(--alarm-amber)',
                }}
              >
                <Star size={16} />
                毕业大项目
              </Link>
            </div>

            <div className="hero-metrics-bar">
              <div className="hero-metric">
                <span className="hero-metric-val">{safeLessons.length || 15}</span>
                <span className="hero-metric-lbl">渐进式互动课程</span>
              </div>
              <div className="hero-metric">
                <span className="hero-metric-val">{simCount}</span>
                <span className="hero-metric-lbl">实时梯形图仿真预设</span>
              </div>
              <div className="hero-metric">
                <span className="hero-metric-val">{modelCount}</span>
                <span className="hero-metric-lbl">2.5D 物理数字孪生</span>
              </div>
              <div className="hero-metric">
                <span className="hero-metric-val" style={{ color: 'var(--power-green)' }}>
                  {stats.overallMasteryPct}%
                </span>
                <span className="hero-metric-lbl">你的综合掌握度</span>
              </div>
            </div>
          </div>

          {/* Focal Centerpiece: Interactive S7-1200 Closed-Loop Architecture Console */}
          <div className="hero-rack-card">
            <div className="hero-rack-bar">
              <span>SIMATIC S7-1215C DC/DC/DC · CLOSED-LOOP PIPELINE</span>
              <span className="hero-rack-status">
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 8px #10b981',
                    animation: 'led-pulse 2s infinite',
                  }}
                />
                RUN · OB1
              </span>
            </div>

            <div className="hero-rack-svg-wrap">
              <svg
                viewBox="0 0 540 228"
                width="100%"
                style={{ height: 'auto', display: 'block' }}
                role="img"
                aria-label="S7-1200 到 PROFINET 到数字孪生再到简历毕业项目的进阶闭环架构图"
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
                    PROFINET · LAD
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
                    能流实时监控
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
                    2.5D DIGITAL TWIN
                  </text>
                  {/* Conveyor + Workpiece Icon */}
                  <rect x="14" y="70" width="84" height="14" rx="7" fill="#1e2d3d" stroke="#38bdf8" strokeWidth="1.2" />
                  <circle cx="24" cy="77" r="4" fill="#38bdf8" />
                  <circle cx="56" cy="77" r="4" fill="#38bdf8" />
                  <circle cx="88" cy="77" r="4" fill="#38bdf8" />
                  <rect x="44" y="47" width="24" height="20" rx="3" fill="#009999" stroke="#2dd4bf" />
                  <line x1="56" y1="32" x2="56" y2="46" stroke="#10b981" strokeWidth="1.6" strokeDasharray="3 2" />
                  <text x="12" y="106" fill="#8ca3ba" fontSize="10.4" fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif">
                    4套产线物理建模
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
                    CAPSTONE ★
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
                    可写简历+源码
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
                  闭环实训路径：硬件认知 → 仿真调试 → 孪生建模 → 简历项目交付
                </text>
              </svg>
            </div>

            <div className="hero-pipeline-tabs" role="tablist" aria-label="进阶闭环节点">
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

            <div className="hero-pipe-readout">
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: '#2dd4bf',
                    marginBottom: 4,
                  }}
                >
                  {activePipe.protocol} · [{activePipe.ioHighlight}]
                </div>
                <div>{activePipe.desc}</div>
              </div>
              <Link to={activePipe.route} className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
                {activePipe.cta}
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FOUR CORE PILLARS ==================== */}
      <section className="home-section">
        <div className="spa-container">
          <div className="section-header">
            <div>
              <div className="telemetry-eyebrow">
                <span className="telemetry-dot teal" />
                CORE ARCHITECTURE · 四大实训支柱
              </div>
              <h2 className="section-title">交互式教学 × 工业实例 × 数字孪生 × 工作流解剖</h2>
              <p className="section-sub">
                所有模块共享同一套西门子 S7-1200 符号寻址体系与实时仿真引擎，知识点随学随练。
              </p>
            </div>
            <Link to="/sim" className="btn">
              <Cpu size={15} />
              进入独立 PLC 仿真实验室
            </Link>
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
                    <span className="pillar-index">{p.index}</span>
                  </div>
                  <h3 className="pillar-title">{p.title}</h3>
                  <p className="pillar-desc">{p.desc}</p>
                  <div className="pillar-foot">
                    <span>{p.cta}</span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11.5,
                        color: 'var(--ink-muted)',
                      }}
                    >
                      {p.metric}
                      <ArrowRight size={14} color="var(--siemens-teal-bright)" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== 5-STAGE LEARNING ROADMAP ==================== */}
      <section className="home-section">
        <div className="spa-container">
          <div className="section-header">
            <div>
              <div className="telemetry-eyebrow">
                <span className="telemetry-dot" />
                5-STAGE CURRICULUM · 阶梯式成长路线图
              </div>
              <h2 className="section-title">从零基础电工思维，进阶到博途项目架构师</h2>
            </div>
            <Link to="/learn" className="btn">
              查看全部 15 讲课表
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="roadmap-grid">
            {safeChapters.map((ch) => {
              const chapterLessons = safeLessons.filter((l) => l.chapterId === ch.id);
              const doneInCh = chapterLessons.filter((l) =>
                state.completedLessonIds.includes(l.id)
              ).length;
              const chTotal = chapterLessons.length;
              const pct = chTotal > 0 ? Math.round((doneInCh / chTotal) * 100) : 0;
              const firstTarget = chapterLessons[0]
                ? `/learn/${chapterLessons[0].id}`
                : `/learn?chapter=${encodeURIComponent(ch.id)}`;

              return (
                <Link key={ch.id} to={firstTarget} className="roadmap-card">
                  <div className="roadmap-stage-row">
                    <span className="roadmap-num">{ch.badge || `STAGE 0${ch.order}`}</span>
                    {chTotal > 0 && doneInCh === chTotal && (
                      <CheckCircle2 size={16} color="var(--power-green)" />
                    )}
                  </div>
                  <h3 className="roadmap-title">{ch.title}</h3>
                  <p className="roadmap-sub">{ch.subtitle}</p>
                  <div className="roadmap-progress-track">
                    <div className="roadmap-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="roadmap-meta">
                    <span>{chTotal > 0 ? `${doneInCh} / ${chTotal} 讲已掌握` : '3 节核心课'}</span>
                    <span>{pct}%</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== RESUME CAPSTONE SPOTLIGHT ==================== */}
      <section className="home-section">
        <div className="spa-container">
          <div className="capstone-spotlight">
            <div>
              <div className="telemetry-eyebrow" style={{ color: '#fbbf24' }}>
                <Sparkles size={14} />
                RESUME CAPSTONE · 简历加分毕业大项目
              </div>
              <h2>
                基于 S7-1215C + PROFINET 的锂电模组柔性视觉分拣、热压温控与立体入库工作站
              </h2>
              <p>
                这不是玩具 Demo，而是对标新能源产线标准的完整工程交付包：涵盖 URS 需求、I/O 分配、PackML
                多模式状态机、PID 热压闭环温控、WinCC Unified 风格联调监控台，并自带 STAR
                法则简历生成器与 15 道面试官高频追问满分话术。
              </p>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <Link to="/capstone" className="btn btn-primary btn-lg">
                  <Star size={16} />
                  进入毕业项目实训室
                  <ArrowRight size={15} />
                </Link>
                <span className="badge badge-amber badge-mono" style={{ padding: '7px 12px' }}>
                  毕业里程碑进度：{stats.capstoneDone} / {stats.capstoneTotal} ({stats.capstonePct}%)
                </span>
              </div>
            </div>

            <div className="capstone-deliverables">
              <div className="capstone-deliv-item">
                <strong>可导入 TIA Portal `.scl` 工程</strong>
                <span>包含 UDT 结构体、FB 状态机、视觉分拣与 PID 温控完整源码</span>
              </div>
              <div className="capstone-deliv-item">
                <strong>WinCC Unified 联调监控台</strong>
                <span>在线模拟启停、急停复位、温度曲线监控与报警历史追溯</span>
              </div>
              <div className="capstone-deliv-item">
                <strong>STAR 法则简历一键定制</strong>
                <span>按应届/转行/在职自动生成量化成果与专业技术关键词</span>
              </div>
              <div className="capstone-deliv-item">
                <strong>15 道面试高频追问拆解</strong>
                <span>直击 PROFINET 丢包、PID 震荡、双线圈与安全急停电路考点</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
