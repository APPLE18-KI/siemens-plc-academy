import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  BookOpen,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Download,
  Flame,
  FolderKanban,
  GitBranch,
  Home,
  LayoutGrid,
  Library,
  Menu,
  MessagesSquare,
  Moon,
  Repeat2,
  RotateCcw,
  Search,
  ShieldAlert,
  Star,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import { lessons } from '../../content/curriculum';
import { useBackDismiss } from '../native/overlay';
import {
  exportArchiveToJsonFile,
  getLocalArchiveSummary,
  validateAndRestoreArchiveJson,
} from '../store/archiveBackup';
import {
  CAPSTONE_MILESTONE_CATALOG,
  invalidateProgressStorageCache,
  useProgress,
} from '../store/progressStore';
import { CommandPalette } from './CommandPalette';
import { preloadRoute } from './routePreload';
import { OPEN_COMMAND_PALETTE_EVENT, subscribeShortcut } from './shortcuts';
import { runViewTransition } from './viewTransition';

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

function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { state, toggleTheme, getStats, toggleCapstoneMilestone, resetAllProgress } = useProgress();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteInitialQuery, setPaletteInitialQuery] = useState('');
  const [archiveNotice, setArchiveNotice] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const toolsRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isMac = useMemo(() => isApplePlatform(), []);

  const safeLessons = Array.isArray(lessons) ? lessons : [];
  const totalLessons = safeLessons.length || 1;
  const stats = getStats(totalLessons);

  const archiveSummary = popoverOpen ? getLocalArchiveSummary() : null;

  // Scroll to top & close drawers on route navigation
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    setMobileOpen(false);
    setPopoverOpen(false);
    setToolsOpen(false);
    setConfirmReset(false);
    setArchiveNotice(null);
  }, [location.pathname]);

  // 手机抽屉打开时锁定背景滚动
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const dismissShellOverlays = useCallback(() => {
    setMobileOpen(false);
    setPopoverOpen(false);
    setToolsOpen(false);
    setConfirmReset(false);
  }, []);

  // 全局去重快捷键：Ctrl+K / ⌘K 开关命令面板；Esc 关闭抽屉与进度弹层
  useEffect(() => {
    const unsubModK = subscribeShortcut('mod+k', (e) => {
      e.preventDefault();
      setMobileOpen(false);
      setPopoverOpen(false);
      setPaletteInitialQuery('');
      setPaletteOpen((prev) => !prev);
    });

    const unsubOpenEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ query?: string }>).detail;
      setMobileOpen(false);
      setPopoverOpen(false);
      setPaletteInitialQuery(detail?.query ?? '');
      setPaletteOpen(true);
    };

    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, unsubOpenEvent);
    return () => {
      unsubModK();
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, unsubOpenEvent);
    };
  }, []);

  useEffect(() => {
    const open = mobileOpen || popoverOpen || toolsOpen;
    if (!open) return;
    return subscribeShortcut('escape', () => {
      if (!paletteOpen) dismissShellOverlays();
    });
  }, [mobileOpen, popoverOpen, toolsOpen, paletteOpen, dismissShellOverlays]);

  useBackDismiss(mobileOpen || popoverOpen || toolsOpen, dismissShellOverlays);

  // Close progress popover or tools dropdown on outside click
  useEffect(() => {
    if (!popoverOpen && !toolsOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (popoverOpen && popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
        setConfirmReset(false);
      }
      if (toolsOpen && toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [popoverOpen, toolsOpen]);

  const primaryDesktopNav = [
    { to: '/', label: '首页', icon: Home, end: true },
    { to: '/learn', label: '课程', icon: BookOpen },
    { to: '/sim', label: '仿真台', icon: Cpu },
    { to: '/models', label: '设备模型', icon: Boxes },
    { to: '/examples', label: '工程实例', icon: FolderKanban },
  ];

  const studyToolNav = [
    { to: '/review', label: '间隔复习中心', desc: '记忆闪卡、错题本与五章薄弱点诊断', icon: Repeat2 },
    { to: '/qa', label: '新手问答库 (130题)', desc: '“停止为什么用常闭”等高频疑问离线搜', icon: MessagesSquare },
    { to: '/glossary', label: 'PLC 大白话术语表', desc: 'NPN/PNP、PII/PIQ、27648 一点就懂', icon: Library },
    { to: '/workflows', label: '底层原理动画', desc: 'CPU 扫描周期、状态机与项目交付流', icon: GitBranch },
  ];

  const isToolRouteActive = ['/review', '/qa', '/glossary', '/workflows'].some((p) =>
    location.pathname.startsWith(p),
  );

  const navItems = [
    { to: '/', label: '首页', icon: Home, end: true },
    { to: '/learn', label: '课程', icon: BookOpen },
    { to: '/sim', label: '仿真实验室', icon: Cpu },
    { to: '/models', label: '设备模型', icon: Boxes },
    { to: '/examples', label: '实例', icon: FolderKanban },
    { to: '/workflows', label: '原理动画', icon: GitBranch },
    { to: '/review', label: '复习', icon: Repeat2 },
    { to: '/glossary', label: '术语表', icon: Library },
    { to: '/qa', label: '问答库', icon: MessagesSquare },
    { to: '/capstone', label: '毕业项目', icon: Star, isCapstone: true },
  ];

  const handleTransitionNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    to: string
  ) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    if (location.pathname === to) return;
    e.preventDefault();
    preloadRoute(to);
    runViewTransition(() => {
      navigate(to);
    }, 'route');
  };

  const handleContinueLearning = () => {
    setPopoverOpen(false);
    let target = '/learn';
    if (state.lastVisitedLessonId && safeLessons.some((l) => l.id === state.lastVisitedLessonId)) {
      target = `/learn/${state.lastVisitedLessonId}`;
    } else {
      const nextUnfinished = safeLessons.find((l) => !state.completedLessonIds.includes(l.id));
      if (nextUnfinished) {
        target = `/learn/${nextUnfinished.id}`;
      }
    }
    preloadRoute(target);
    runViewTransition(() => navigate(target), 'route');
  };

  const handleExportArchive = () => {
    try {
      const result = exportArchiveToJsonFile();
      setArchiveNotice({
        tone: 'ok',
        text: `已导出 ${result.fileName}（含 ${result.keyCount} 项档案数据）`,
      });
    } catch {
      setArchiveNotice({
        tone: 'err',
        text: '导出学习档案失败，请检查浏览器下载权限后重试。',
      });
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const res = validateAndRestoreArchiveJson(text);
      if (!res.ok) {
        setArchiveNotice({ tone: 'err', text: res.message });
        return;
      }
      invalidateProgressStorageCache();
      setArchiveNotice({ tone: 'ok', text: res.message });
      window.setTimeout(() => {
        window.location.reload();
      }, 750);
    } catch {
      setArchiveNotice({
        tone: 'err',
        text: '读取备份文件失败，请确认文件未被损坏。',
      });
    }
  };

  const openCommandPalette = () => {
    setMobileOpen(false);
    setPopoverOpen(false);
    setPaletteInitialQuery('');
    setPaletteOpen(true);
  };

  return (
    <div className="app-shell">
      {/* 无障碍隐藏锚点：键盘 Tab 首个聚焦元素，直达主内容区 */}
      <a href="#main-content" className="skip-to-main">
        跳至正文内容
      </a>

      <header className="app-header">
        <div className="app-header-inner">
          <Link
            to="/"
            className="brand-link"
            aria-label="西门子 PLC 工程师实训工坊首页"
            onClick={(e) => handleTransitionNavClick(e, '/')}
          >
            <span className="brand-mark">
              <Cpu size={18} strokeWidth={2.2} />
              <span className="brand-mark-led" />
            </span>
            <span className="brand-text">
              <span className="brand-title">西门子 PLC 实训工坊</span>
              <span className="brand-sub">S7-1200 STUDIO · v3.0</span>
            </span>
          </Link>

          <nav className="nav-links" aria-label="主导航">
            {primaryDesktopNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onMouseEnter={() => preloadRoute(item.to)}
                  onFocus={() => preloadRoute(item.to)}
                  onClick={(e) => handleTransitionNavClick(e, item.to)}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}

            <div className="nav-dropdown-wrap" ref={toolsRef}>
              <button
                type="button"
                className={`nav-item nav-dropdown-trigger${isToolRouteActive || toolsOpen ? ' active' : ''}`}
                aria-expanded={toolsOpen}
                aria-haspopup="menu"
                onClick={() => setToolsOpen((v) => !v)}
              >
                <Library size={15} />
                <span>助学工具</span>
                <ChevronDown size={13} className={`nav-chevron${toolsOpen ? ' is-open' : ''}`} />
              </button>

              {toolsOpen && (
                <div className="nav-dropdown-menu" role="menu" aria-label="助学工具菜单">
                  {studyToolNav.map((tool) => {
                    const ToolIcon = tool.icon;
                    const active = location.pathname.startsWith(tool.to);
                    return (
                      <Link
                        key={tool.to}
                        to={tool.to}
                        role="menuitem"
                        onMouseEnter={() => preloadRoute(tool.to)}
                        onFocus={() => preloadRoute(tool.to)}
                        onClick={(e) => {
                          setToolsOpen(false);
                          handleTransitionNavClick(e, tool.to);
                        }}
                        className={`nav-dropdown-item${active ? ' active' : ''}`}
                      >
                        <span className="nav-dropdown-icon">
                          <ToolIcon size={16} />
                        </span>
                        <span>
                          <strong>{tool.label}</strong>
                          <small>{tool.desc}</small>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <NavLink
              to="/capstone"
              onMouseEnter={() => preloadRoute('/capstone')}
              onFocus={() => preloadRoute('/capstone')}
              onClick={(e) => handleTransitionNavClick(e, '/capstone')}
              className={({ isActive }) => `nav-item capstone-link${isActive ? ' active' : ''}`}
            >
              <Star size={15} />
              <span>毕业项目</span>
            </NavLink>
          </nav>

          <div className="header-actions" ref={popoverRef}>
            <button
              type="button"
              className="cmdk-trigger-btn"
              onClick={openCommandPalette}
              aria-label="打开全站命令面板与指令速查（快捷键 Ctrl+K 或 Command+K）"
              title={`全站速查与命令面板 (${isMac ? '⌘K' : 'Ctrl+K'})`}
            >
              <Search size={15} aria-hidden="true" />
              <span className="cmdk-trigger-label">速查</span>
              <kbd className="cmdk-trigger-kbd" aria-hidden="true">
                {isMac ? '⌘K' : 'Ctrl K'}
              </kbd>
            </button>

            <button
              type="button"
              className="progress-ring-trigger"
              onClick={() => setPopoverOpen((v) => !v)}
              aria-expanded={popoverOpen}
              aria-label="查看学习进度、掌握度与学习档案备份"
              title="查看学习进度与档案备份"
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
              aria-label={state.theme === 'dark' ? '切换为浅色主题' : '切换为深色主题'}
            >
              {state.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button
              type="button"
              className="icon-btn mobile-menu-btn"
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? '关闭导航菜单' : '展开导航菜单'}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {popoverOpen && (
              <div className="progress-popover" role="dialog" aria-label="学习档案与进度面板">
                <div className="progress-popover-head">
                  <div>
                    <div className="progress-popover-title">我的学习进度</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--teal-text, var(--siemens-teal-bright))',
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

                {/* v3.0 跨设备学习档案 JSON 一键备份与恢复 */}
                <div className="archive-sync-box">
                  <div className="archive-sync-head">
                    <span className="archive-sync-title">跨设备档案备份 (JSON)</span>
                    <span className="archive-sync-count">
                      本机 {archiveSummary?.keyCount ?? 0} 项
                    </span>
                  </div>
                  <p className="archive-sync-desc">
                    导出课程进度、复习卡片、毕业打卡与课堂笔记到本地文件，电脑 ↔ 手机一键迁移。
                  </p>
                  <div className="archive-sync-actions">
                    <button
                      type="button"
                      className="btn btn-sm archive-sync-btn"
                      onClick={handleExportArchive}
                    >
                      <Download size={13} />
                      导出备份
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm archive-sync-btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={13} />
                      导入恢复
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      className="sr-only"
                      aria-label="选择学习档案 JSON 备份文件"
                      onChange={handleImportFileChange}
                    />
                  </div>
                  {archiveNotice && (
                    <div
                      className={`archive-sync-notice is-${archiveNotice.tone}`}
                      role="status"
                      aria-live="polite"
                    >
                      {archiveNotice.tone === 'ok' ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <AlertCircle size={14} />
                      )}
                      <span>{archiveNotice.text}</span>
                    </div>
                  )}
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
            <div className="mobile-drawer-title">全部功能</div>
            <button
              type="button"
              className="nav-item mobile-drawer-search"
              onClick={openCommandPalette}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                <Search size={16} />
                全站指令与课程速查
              </span>
              <kbd className="cmdk-trigger-kbd">⌘K</kbd>
            </button>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onMouseEnter={() => preloadRoute(item.to)}
                  onFocus={() => preloadRoute(item.to)}
                  onClick={(e) => handleTransitionNavClick(e, item.to)}
                  className={({ isActive }) =>
                    `nav-item${item.isCapstone ? ' capstone-link' : ''}${isActive ? ' active' : ''}`
                  }
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                    <Icon size={16} />
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
          </div>
        </div>
      )}

      <main id="main-content" className="app-main" tabIndex={-1}>
        {children}
      </main>

      <footer className="app-footer">
        <div className="spa-container app-footer-inner">
          <div className="footer-notes">
            <p className="footer-brand">
              <span className="telemetry-dot" />
              西门子 PLC 实训工坊 v3.0 · 面向零基础到在职进阶的 S7-1200 互动实训台
            </p>
            <p>
              <ShieldAlert size={13} />
              安全提示：本站仿真不能代替真实设备的安全措施。实际接线、改线前请务必断电并验电，220V/380V 电压可致命，请勿独自带电操作。
            </p>
            <p>本站为个人学习项目，非西门子官方；SIEMENS、SIMATIC、TIA Portal 为西门子公司商标。</p>
          </div>
          <div className="footer-links">
            <Link to="/glossary" onMouseEnter={() => preloadRoute('/glossary')}>
              术语表
            </Link>
            <Link to="/qa" onMouseEnter={() => preloadRoute('/qa')}>
              问答库
            </Link>
            <Link to="/glossary?section=faq">常见问题</Link>
            <Link to="/learn/l00-before-you-start" onMouseEnter={() => preloadRoute('/learn/l00-before-you-start')}>
              新手准备
            </Link>
            <Link to="/about" onMouseEnter={() => preloadRoute('/about')}>
              关于与开源许可
            </Link>
          </div>
        </div>
      </footer>

      {/* 手机底部导航（≤768px）：4 个常用入口 + “更多”打开完整菜单 */}
      <nav className="mobile-bottom-nav" aria-label="手机底部导航">
        {[
          { to: '/', label: '首页', icon: Home, end: true },
          { to: '/learn', label: '课程', icon: BookOpen },
          { to: '/sim', label: '仿真', icon: Cpu },
          { to: '/review', label: '复习', icon: Repeat2 },
        ].map((tab) => {
          const TabIcon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              onClick={(e) => handleTransitionNavClick(e, tab.to)}
              className={({ isActive }) => `mobile-bottom-tab${isActive ? ' active' : ''}`}
            >
              <TabIcon size={20} strokeWidth={2.1} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          className={`mobile-bottom-tab${mobileOpen ? ' active' : ''}`}
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label="更多功能"
        >
          <LayoutGrid size={20} strokeWidth={2.1} />
          <span>更多</span>
        </button>
      </nav>

      <CommandPalette
        open={paletteOpen}
        initialQuery={paletteInitialQuery}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
};
