import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { haptic, isNativeApp } from './platform';
import { dismissTopOverlay } from './overlay';

/**
 * Android 硬件返回键（Capacitor App 插件的 backButton 事件）：
 * 1. 有打开的抽屉/弹层/术语解释/全屏模型：先关闭最上层的那个（见 overlay.ts）；
 * 2. 不在首页：返回上一页；没有上一页（例如直接打开的深层页面）时回到首页；
 * 3. 已在首页：2 秒内再按一次才退出（先提示“再按一次退出”）。
 * 另外负责：状态栏/导航栏图标颜色随深浅主题切换、启动页在首屏渲染后淡出。
 * 网页端不注册原生监听。window.__plcHandleBack 同时暴露给自动化测试使用。
 */
declare global {
  interface Window {
    __plcHandleBack?: () => boolean;
    __plcOverlayOpen?: number;
  }
}

const EXIT_WINDOW_MS = 2000;
const THEME_BG: Record<string, string> = { dark: '#0a0f14', light: '#f2f4f7' };

/** 轻量 Toast（不依赖 React 树，返回键逻辑在任何页面都能用） */
export function showToast(text: string, ms = 1800): void {
  let el = document.getElementById('plc-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'plc-toast';
    el.className = 'plc-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('is-visible');
  window.clearTimeout(Number(el.dataset.timer ?? 0));
  el.dataset.timer = String(
    window.setTimeout(() => el?.classList.remove('is-visible'), ms),
  );
}

function syncSystemBars(): void {
  const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BG[theme]);
  if (!isNativeApp()) return;
  // Dark = 浅色图标（深色背景）；Light = 深色图标（浅色背景）
  SystemBars.setStyle({ style: theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark }).catch(
    () => undefined,
  );
}

export function useNativeBridge(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const lastBackAtHome = useRef(0);

  /* v2.2：所有可点控件按下时轻触感（按钮、链接、选项、标签）。
     组件自己的“成功/错误”触感在 click 时触发，比 pointerdown 晚 >50ms，不会被节流吞掉 */
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.('button:not(:disabled), a[href], [role="button"], summary, label.press');
      if (el && !el.closest('[data-no-haptic]')) haptic('tap');
    };
    document.addEventListener('pointerdown', onDown, { passive: true, capture: true });
    return () => document.removeEventListener('pointerdown', onDown, { capture: true } as EventListenerOptions);
  }, []);

  useEffect(() => {
    window.__plcHandleBack = () => {
      if (dismissTopOverlay()) return true;
      const p = pathRef.current;
      if (p === '/' || p === '') {
        const now = Date.now();
        if (now - lastBackAtHome.current < EXIT_WINDOW_MS) return false;
        lastBackAtHome.current = now;
        haptic('tap');
        showToast('再按一次退出', EXIT_WINDOW_MS);
        return true;
      }
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (idx > 0) navigate(-1);
      else navigate('/', { replace: true });
      return true;
    };
    return () => {
      delete window.__plcHandleBack;
    };
  }, [navigate]);

  // 主题 → 状态栏/导航栏图标颜色 + theme-color
  useEffect(() => {
    syncSystemBars();
    const mo = new MutationObserver(syncSystemBars);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.classList.add('is-native-app');
    // 首屏已渲染：淡出启动页（配置里 launchAutoHide=false，避免白屏闪烁）
    requestAnimationFrame(() => {
      SplashScreen.hide({ fadeOutDuration: 220 }).catch(() => undefined);
    });
    const sub = CapApp.addListener('backButton', () => {
      const handled = window.__plcHandleBack?.() ?? false;
      if (!handled) CapApp.exitApp();
    });
    return () => {
      sub.then((h) => h.remove()).catch(() => undefined);
    };
  }, []);
}
