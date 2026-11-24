import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Boxes,
  Check,
  Cpu,
  Flame,
  FolderKanban,
  GitBranch,
  Home,
  Menu,
  Moon,
  RotateCcw,
  Star,
  Sun,
  X,
} from 'lucide-react';
import { lessons } from '../../registry';
import { CAPSTONE_MILESTONE_CATALOG, useProgress } from '../store/progressStore';

interface AppShellProps {
  children: React.ReactNode;
}

const ProgressRingSvg: React.FC<{ pct: number; size?: number }> = ({ pct, size = 28 }) => {
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border-medium)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={clamped >= 100 ? 'var(--power-green)' : 'var(--siemens-teal-bright)'}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 320ms ease' }}
      />
    </svg>
  );
};

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { state, toggleTheme, getStats, toggleCapstoneMilestone, resetAllProgress } = useProgress();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const safeLessons = Array.isArray(lessons) ? lessons : [];
  const totalLessons = safeLessons.length || 15;
  const stats = getStats(totalLessons);

  // Scroll to top & close drawers on route navigation
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setMobileOpen(false);
    setPopoverOpen(false);
    setConfirmReset(false);
  }, [location.pathname]);

  // Close progress popover on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
        setConfirmReset(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [popoverOpen]);

  const navItems = [
    { to: '/', label: '总览', icon: Home, end: true },
    {
      to: '/learn',
      label: '渐进课程',
      icon: BookOpen,
      badge: `${safeLessons.length || 15}讲`,
    },
    { to: '/sim', label: '仿真实验室', icon: Cpu },
    { to: '/models', label: '数字孪生', icon: Boxes },
    { to: '/examples', label: '工业实例', icon: FolderKanban },
    { to: '/workflows', label: '工作流', icon: GitBranch },
    { to: '/capstone', label: '毕业项目 ★', icon: Star, isCapstone: true },
  ];

  const handleContinueLearning = () => {
    setPopoverOpen(false);
    if (state.lastVisitedLessonId && safeLessons.some((l) => l.id === state.lastVisitedLessonId)) {
      navigate(`/learn/${state.lastVisitedLessonId}`);
      return;
    }
    const nextUnfinished = safeLessons.find((l) => !state.completedLessonIds.includes(l.id));
    if (nextUnfinished) {
      navigate(`/learn/${nextUnfinished.id}`);
    } else {
      navigate('/learn');
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/" className="brand-link" aria-label="西门子 PLC 工程师实训工坊首页">
            <span className="brand-mark">
              <Cpu size={18} strokeWidth={2.2} />
              <span className="brand-mark-led" />
            </span>
            <span className="brand-text">
              <span className="brand-title">西门子 PLC 实训工坊</span>
              <span className="brand-sub">S7-1200 · TIA ACADEMY</span>
            </span>
          </Link>

          <nav className="nav-links" aria-label="主导航">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `nav-item${item.isCapstone ? ' capstone-link' : ''}${isActive ? ' active' : ''}`
                  }
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                  {item.badge && <span className="nav-count-pill">{item.badge}</span>}
                </NavLink>
              );
            })}
          </nav>

          <div className="header-actions" ref={popoverRef}>
            <button
              type="button"
              className="progress-ring-trigger"
              onClick={() => setPopoverOpen((v) => !v)}
              aria-expanded={popoverOpen}
              aria-label="查看学习进度与综合掌握度"
              title="查看学习进度与掌握度"
            >
              <ProgressRingSvg pct={stats.overallMasteryPct} />
              <span className="progress-ring-meta">
                <span className="progress-ring-pct">{stats.overallMasteryPct}%</span>
                <span className="progress-ring-label">综合掌握度</span>
              </span>
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={toggleTheme}
              title={state.theme === 'dark' ? '切换浅色沉浸阅读模式' : '切换深色工业控制台模式'}
              aria-label="切换深浅主题"
            >
              {state.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button
              type="button"
              className="icon-btn mobile-menu-btn"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="展开导航菜单"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {popoverOpen && (
              <div className="progress-popover" role="dialog" aria-label="学习档案面板">
                <div className="progress-popover-head">
                  <div>
                    <div className="progress-popover-title">工程师成长档案</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--siemens-teal-bright)',
                        marginTop: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <Award size={13} />
                      {stats.engineerRank}
                    </div>
                  </div>
                  <span className="badge badge-amber badge-mono">
                    <Flame size={12} />
                    连续 {stats.streakDays} 天
                  </span>
                </div>

                <div className="roadmap-progress-track" style={{ height: 7 }}>
                  <div
                    className="roadmap-progress-fill"
                    style={{ width: `${stats.overallMasteryPct}%` }}
                  />
                </div>

                <div className="progress-stat-grid">
                  <div className="progress-stat-cell">
                    <div className="progress-stat-val">
                      {stats.completedLessons}/{stats.totalLessons}
                    </div>
                    <div className="progress-stat-lbl">已掌握课程 ({stats.lessonPct}%)</div>
                  </div>
                  <div className="progress-stat-cell">
                    <div className="progress-stat-val">
                      {stats.averageQuizPct > 0 ? `${stats.averageQuizPct}%` : '—'}
                    </div>
                    <div className="progress-stat-lbl">随堂测验均分</div>
                  </div>
                  <div className="progress-stat-cell">
                    <div className="progress-stat-val">{stats.practiceTasksDone}</div>
                    <div className="progress-stat-lbl">实训工单已验收</div>
                  </div>
                  <div className="progress-stat-cell">
                    <div className="progress-stat-val">
                      {stats.capstoneDone}/{stats.capstoneTotal}
                    </div>
                    <div className="progress-stat-lbl">毕业里程碑</div>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--ink-muted)',
                      marginBottom: 6,
                    }}
                  >
                    毕业项目里程碑打卡
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {CAPSTONE_MILESTONE_CATALOG.map((ms) => {
                      const done = Boolean(state.capstoneMilestones[ms.id]);
                      return (
                        <button
                          key={ms.id}
                          type="button"
                          onClick={() => toggleCapstoneMilestone(ms.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            textAlign: 'left',
                            padding: '6px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--border-hairline)',
                            background: done ? 'var(--power-green-soft)' : 'var(--bg-surface-2)',
                            fontSize: 12,
                            color: done ? 'var(--ink-primary)' : 'var(--ink-secondary)',
                          }}
                        >
                          <span
                            style={{
                              width: 15,
                              height: 15,
                              borderRadius: 4,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: done ? 'var(--power-green)' : 'transparent',
                              border: `1.5px solid ${done ? 'var(--power-green)' : 'var(--border-strong)'}`,
                              color: '#052014',
                              flexShrink: 0,
                            }}
                          >
                            {done && <Check size={10} strokeWidth={3} />}
                          </span>
                          <span style={{ flex: 1 }}>{ms.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="progress-popover-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleContinueLearning}
                  >
                    继续学习
                  </button>
                  {confirmReset ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        borderColor: 'var(--fault-red-border)',
                        color: 'var(--fault-red)',
                      }}
                      onClick={() => {
                        resetAllProgress();
                        setConfirmReset(false);
                      }}
                    >
                      确认清空记录
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setConfirmReset(true)}
                    >
                      <RotateCcw size={13} />
                      重置进度
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setMobileOpen(false)}
          role="presentation"
        >
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--ink-muted)',
                padding: '4px 10px 8px',
              }}
            >
              NAVIGATION · 功能模块
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `nav-item${item.isCapstone ? ' capstone-link' : ''}${isActive ? ' active' : ''}`
                  }
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                    <Icon size={16} />
                    {item.label}
                  </span>
                  {item.badge && <span className="nav-count-pill">{item.badge}</span>}
                </NavLink>
              );
            })}
          </div>
        </div>
      )}

      <main className="app-main">{children}</main>

      <footer className="app-footer">
        <div className="spa-container app-footer-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="telemetry-dot" />
            <span>
              西门子 PLC 工程师实训工坊 · 遵循 IEC 61131-3 与 TIA Portal S7-1200/1500 工程规范
            </span>
          </div>
          <div className="footer-links">
            <Link to="/learn">渐进课程</Link>
            <Link to="/sim">仿真实验室</Link>
            <Link to="/models">数字孪生</Link>
            <Link to="/examples">工业实例</Link>
            <Link to="/workflows">工作流解剖</Link>
            <Link to="/capstone">毕业大项目 ★</Link>
          </div>
        </div>
      </footer>

      {/* Mobile Native-Style Bottom Tab Navigation (<= 768px) */}
      <nav className="mobile-bottom-nav" aria-label="手机底部快捷导航">
        {[
          { to: '/', label: '总览', icon: Home, end: true },
          { to: '/learn', label: '15讲课程', icon: BookOpen },
          { to: '/sim', label: 'PLC仿真', icon: Cpu },
          { to: '/models', label: '数字孪生', icon: Boxes },
          { to: '/capstone', label: '毕业项目', icon: Star, highlight: true },
        ].map((tab) => {
          const TabIcon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `mobile-bottom-tab${tab.highlight ? ' is-highlight' : ''}${isActive ? ' active' : ''}`
              }
            >
              <TabIcon size={18} strokeWidth={2.1} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
