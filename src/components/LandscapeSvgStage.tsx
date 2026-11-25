import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, RotateCw, Smartphone, X } from 'lucide-react';
import { useBackDismiss } from '../app/native/overlay';
import { haptic } from '../app/native/platform';
import './landscapeSvgStage.css';

export type LandscapeZoom = 'fit' | 125 | 160;
export type LandscapeFitMode = 'contain' | 'width';

const ZOOM_OPTIONS: ReadonlyArray<{ value: LandscapeZoom; label: string }> = [
  { value: 'fit', label: '适应屏幕' },
  { value: 125, label: '125%' },
  { value: 160, label: '160%' },
];

// Reference-counted body scroll lock so closing/unmounting always restores cleanly
let bodyLockCount = 0;
let savedBodyOverflow = '';
let savedHtmlOverflow = '';

function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (bodyLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    savedHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
  bodyLockCount += 1;
}

function unlockBodyScroll(): void {
  if (typeof document === 'undefined' || bodyLockCount === 0) return;
  bodyLockCount -= 1;
  if (bodyLockCount === 0) {
    document.body.style.overflow = savedBodyOverflow;
    document.documentElement.style.overflow = savedHtmlOverflow;
  }
}

function readViewportSize(): { w: number; h: number } {
  if (typeof window === 'undefined') return { w: 1024, h: 768 };
  const w = Math.round(window.innerWidth || document.documentElement.clientWidth || 1024);
  const h = Math.round(window.innerHeight || document.documentElement.clientHeight || 768);
  return { w, h };
}

export interface LandscapeStageController {
  isOpen: boolean;
  /** True when open AND physical viewport is still portrait (winH > winW) -> apply CSS 90° rotation */
  isRotated: boolean;
  viewport: { w: number; h: number };
  zoom: LandscapeZoom;
  setZoom: (next: LandscapeZoom) => void;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
  overlayStyle: React.CSSProperties;
}

/**
 * Reusable dual-mechanism landscape viewport controller:
 * - Mechanism A: Best-effort native Fullscreen + ScreenOrientation.lock('landscape')
 * - Mechanism B: Live viewport-aware CSS 90° clockwise full-bleed rotation fallback
 *   when viewport remains portrait (winH > winW), and natural unrotated fullscreen when
 *   viewport is already landscape (winW >= winH).
 */
export function useLandscapeStage(): LandscapeStageController {
  const [isOpen, setIsOpen] = useState(false);
  const [viewport, setViewport] = useState(readViewportSize);
  const [zoom, setZoom] = useState<LandscapeZoom>('fit');
  const enteredFullscreenRef = useRef(false);
  const lockedScrollRef = useRef(false);

  const releaseNativeLocks = useCallback(() => {
    try {
      const orient = window.screen?.orientation as
        | (ScreenOrientation & { unlock?: () => void })
        | undefined;
      orient?.unlock?.();
    } catch {
      // Orientation unlock unsupported
    }
    if (enteredFullscreenRef.current && typeof document !== 'undefined' && document.fullscreenElement) {
      enteredFullscreenRef.current = false;
      document.exitFullscreen?.().catch(() => {});
    } else {
      enteredFullscreenRef.current = false;
    }
  }, []);

  const enter = useCallback(() => {
    haptic('tap');
    setViewport(readViewportSize());
    setZoom('fit');
    setIsOpen(true);

    // Mechanism A: Try native fullscreen (on portrait / mobile touch) + landscape orientation lock
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const attemptNativeLandscape = async () => {
      try {
        const isPortraitOrTouch =
          window.innerHeight > window.innerWidth ||
          Boolean(window.matchMedia?.('(pointer: coarse)').matches);
        if (isPortraitOrTouch && !document.fullscreenElement) {
          const docEl = document.documentElement as HTMLElement & {
            webkitRequestFullscreen?: () => Promise<void> | void;
          };
          const maybePromise = docEl.requestFullscreen?.() ?? docEl.webkitRequestFullscreen?.();
          if (maybePromise && typeof (maybePromise as Promise<void>).then === 'function') {
            await (maybePromise as Promise<void>)
              .then(() => {
                enteredFullscreenRef.current = true;
              })
              .catch(() => {});
          }
        }
      } catch {
        // Never interrupt landscape view if Fullscreen is rejected
      }

      try {
        const orient = window.screen?.orientation as
          | (ScreenOrientation & { lock?: (orientation: string) => Promise<void> })
          | undefined;
        if (orient && typeof orient.lock === 'function') {
          await orient.lock('landscape').catch(() => {});
        }
      } catch {
        // Fallback Mechanism B seamlessly handles rotation
      }
    };
    void attemptNativeLandscape();
  }, []);

  const exit = useCallback(() => {
    haptic('tap');
    setIsOpen(false);
    releaseNativeLocks();
  }, [releaseNativeLocks]);

  const toggle = useCallback(() => {
    if (isOpen) {
      exit();
    } else {
      enter();
    }
  }, [isOpen, enter, exit]);

  // Register Android back button / back-dismiss stack
  useBackDismiss(isOpen, exit);

  // Sync viewport dimensions live on resize, orientationchange, and visualViewport resize
  useEffect(() => {
    if (!isOpen) return;
    const sync = () => setViewport(readViewportSize());
    sync();

    let t1: number | undefined;
    let t2: number | undefined;
    const onOrientationChange = () => {
      sync();
      // iOS Safari & Android WebView sometimes update innerWidth/innerHeight asynchronously
      t1 = window.setTimeout(sync, 90);
      t2 = window.setTimeout(sync, 280);
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        enteredFullscreenRef.current = false;
      }
      sync();
      t1 = window.setTimeout(sync, 90);
    };

    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', onOrientationChange);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', sync);

    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', onOrientationChange);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      vv?.removeEventListener('resize', sync);
      if (t1 !== undefined) window.clearTimeout(t1);
      if (t2 !== undefined) window.clearTimeout(t2);
    };
  }, [isOpen]);

  // Escape key to exit landscape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        exit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, exit]);

  // Lock background page scrolling while open & guarantee cleanup on unmount
  useEffect(() => {
    if (!isOpen) return;
    lockBodyScroll();
    lockedScrollRef.current = true;
    return () => {
      if (lockedScrollRef.current) {
        unlockBodyScroll();
        lockedScrollRef.current = false;
      }
    };
  }, [isOpen]);

  // Ensure native locks are cleaned up if component unmounts while open
  useEffect(() => {
    return () => {
      releaseNativeLocks();
    };
  }, [releaseNativeLocks]);

  const isRotated = isOpen && viewport.h > viewport.w;
  const overlayStyle: React.CSSProperties = isRotated
    ? {
        width: `${viewport.h}px`,
        height: `${viewport.w}px`,
      }
    : {
        width: `${viewport.w}px`,
        height: `${viewport.h}px`,
      };

  return {
    isOpen,
    isRotated,
    viewport,
    zoom,
    setZoom,
    enter,
    exit,
    toggle,
    overlayStyle,
  };
}

export interface LandscapePortalOverlayProps {
  controller: LandscapeStageController;
  title: string;
  subtitle?: string;
  /** Optional quick interactive buttons rendered in the compact top control bar */
  controls?: React.ReactNode;
  /** Optional compact alarm/status banner directly beneath the top bar */
  banner?: {
    tone: 'danger' | 'warn' | 'ok';
    text: string;
    action?: React.ReactNode;
  };
  /** Optional collapsible bottom dock (e.g. TwinShell actionBar or quick field I/O buttons) */
  footer?: React.ReactNode;
  footerLabel?: string;
  defaultFooterOpen?: boolean;
  /** CSS scope class (e.g. 'dt-root', 'plc-sim-root', 'wf-root', 'cap-root') preserved inside portal */
  scopeClassName?: string;
  /** 'contain' fits a single SVG edge-to-edge; 'width' fits full width and scrolls vertically */
  fitMode?: LandscapeFitMode;
  children: React.ReactNode;
}

export const LandscapePortalOverlay: React.FC<LandscapePortalOverlayProps> = ({
  controller,
  title,
  subtitle,
  controls,
  banner,
  footer,
  footerLabel = '现场操作栏',
  defaultFooterOpen = true,
  scopeClassName,
  fitMode = 'contain',
  children,
}) => {
  const [footerOpen, setFooterOpen] = useState(defaultFooterOpen);

  useEffect(() => {
    if (controller.isOpen) {
      setFooterOpen(defaultFooterOpen);
    }
  }, [controller.isOpen, defaultFooterOpen]);

  if (!controller.isOpen || typeof document === 'undefined') return null;

  const { isRotated, zoom, setZoom, exit, overlayStyle } = controller;
  const isZoomed = zoom !== 'fit';

  const innerClass = [
    'lss-stage-inner',
    isZoomed ? 'lss-stage-inner--zoom' : 'lss-stage-inner--fit',
    !isZoomed ? (fitMode === 'width' ? 'lss-fit--width' : 'lss-fit--contain') : '',
  ]
    .filter(Boolean)
    .join(' ');

  const innerStyle: React.CSSProperties | undefined = isZoomed
    ? { width: `${zoom}%`, minWidth: `${zoom}%` }
    : undefined;

  return createPortal(
    <div
      className={[
        'lss-overlay',
        isRotated ? 'lss-overlay--rotated' : 'lss-overlay--natural',
        scopeClassName ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} - 横屏全屏视图`}
      data-landscape-mode={isRotated ? 'rotated' : 'natural'}
    >
      {/* Compact Floating Landscape Top Control Bar */}
      <div className="lss-topbar">
        <div className="lss-topbar-meta">
          <div className="lss-title-stack">
            <h3 className="lss-title" title={title}>
              {title}
            </h3>
            {subtitle && (
              <p className="lss-subtitle" title={subtitle}>
                {subtitle}
              </p>
            )}
          </div>
          <span className="lss-mode-tag" title={isRotated ? '已启用 90° 智能横屏旋转适配' : '物理横屏铺满模式'}>
            <RotateCw size={10} />
            {isRotated ? '90° 横屏' : '宽屏全屏'}
          </span>
        </div>

        {controls && <div className="lss-topbar-controls">{controls}</div>}

        <div className="lss-topbar-right">
          <div className="lss-zoom-group" role="group" aria-label="横屏缩放倍率">
            {ZOOM_OPTIONS.map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                className={`lss-zoom-btn ${zoom === opt.value ? 'is-active' : ''}`}
                onClick={() => {
                  haptic('tap');
                  setZoom(opt.value);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="lss-exit-btn"
            onClick={exit}
            aria-label="退出横屏"
            title="退出横屏观看 (Esc)"
          >
            <X size={14} />
            <span>退出横屏</span>
          </button>
        </div>
      </div>

      {/* Optional Compact Diagnostic Banner */}
      {banner && (
        <div className={`lss-banner lss-banner--${banner.tone}`}>
          <span>{banner.text}</span>
          {banner.action}
        </div>
      )}

      {/* Free Touch-Pan Interactive SVG Canvas */}
      <div className="lss-stage-scroll">
        <div className={innerClass} style={innerStyle}>
          {children}
        </div>
      </div>

      {/* Optional Collapsible Bottom Action Dock */}
      {footer && (
        <div className={`lss-footer ${footerOpen ? '' : 'lss-footer--collapsed'}`}>
          <button
            type="button"
            className="lss-footer-toggle"
            onClick={() => {
              haptic('tap');
              setFooterOpen((v) => !v);
            }}
            aria-expanded={footerOpen}
          >
            {footerOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            <span>{footerOpen ? '收起' : footerLabel}</span>
          </button>
          {footerOpen && <div className="lss-footer-body">{footer}</div>}
        </div>
      )}
    </div>,
    document.body
  );
};

export interface LandscapeSvgStageProps {
  title: string;
  subtitle?: string;
  /** Optional quick interactive buttons shown in the landscape top bar */
  controls?: React.ReactNode;
  /** Minimum width in inline mode on narrow screens (default 640) */
  inlineMinWidth?: number;
  /** Optional extra className */
  className?: string;
  /** Whether to use a sleek slim inline HUD without outer frame box */
  compactHud?: boolean;
  /** Optional custom hint text in the inline HUD */
  hint?: string;
  /** Optional CSS scope class applied on the portal root so scoped module tokens/buttons work */
  scopeClassName?: string;
  /** 'contain' fits a single SVG to viewport; 'width' fits full width and scrolls vertically */
  fitMode?: LandscapeFitMode;
  /** Optional collapsible bottom dock rendered inside landscape fullscreen */
  landscapeFooter?: React.ReactNode;
  landscapeFooterLabel?: string;
  /** Whether to add padding inside the inline canvas box */
  inlinePadding?: boolean;
  children: React.ReactNode;
}

export const LandscapeSvgStage: React.FC<LandscapeSvgStageProps> = ({
  title,
  subtitle,
  controls,
  inlineMinWidth,
  className,
  compactHud = false,
  hint = '⇄ 可左右滑动 · 点击元件交互',
  scopeClassName,
  fitMode = 'contain',
  landscapeFooter,
  landscapeFooterLabel = '快捷控制栏',
  inlinePadding = false,
  children,
}) => {
  const controller = useLandscapeStage();

  const canvasStyle =
    inlineMinWidth && inlineMinWidth > 0
      ? ({ '--lss-inline-min-w': `${inlineMinWidth}px` } as React.CSSProperties)
      : undefined;

  return (
    <div
      className={[
        'lss-inline-wrap',
        compactHud ? 'lss-inline-wrap--compact' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="lss-inline-hud">
        <span className="lss-inline-hint">{hint}</span>
        <div className="lss-inline-hud-right">
          <button
            type="button"
            className="lss-trigger-btn"
            onClick={controller.enter}
            title="一键切换横屏全屏大图观看（支持 90° 智能旋转与触控缩放）"
          >
            <Smartphone size={13} />
            <span>横屏观看</span>
          </button>
        </div>
      </div>

      {controller.isOpen ? (
        <div className="lss-inline-placeholder">
          <span>正在横屏全屏模式观看「{title}」</span>
          <button type="button" className="lss-trigger-btn" onClick={controller.exit}>
            恢复窗口视图
          </button>
        </div>
      ) : (
        <div className="lss-inline-scroll">
          <div
            className={`lss-inline-canvas ${inlinePadding ? 'lss-inline-canvas--padded' : ''}`}
            data-has-min-w={inlineMinWidth && inlineMinWidth > 0 ? 'true' : undefined}
            style={canvasStyle}
          >
            {children}
          </div>
        </div>
      )}

      <LandscapePortalOverlay
        controller={controller}
        title={title}
        subtitle={subtitle}
        controls={controls}
        footer={landscapeFooter}
        footerLabel={landscapeFooterLabel}
        scopeClassName={scopeClassName}
        fitMode={fitMode}
      >
        {children}
      </LandscapePortalOverlay>
    </div>
  );
};

export default LandscapeSvgStage;
