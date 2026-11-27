import { flushSync } from 'react-dom';

type ViewTransitionLike = {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
};

type DocumentWithVT = Document & {
  startViewTransition?: (callback: () => void) => ViewTransitionLike;
};

export type ViewTransitionKind = 'route' | 'theme';

/**
 * 渐进增强原生 document.startViewTransition：
 * - 仅在浏览器支持且未开启 prefers-reduced-motion 时触发
 * - 使用 flushSync 让 React 同步提交新帧，再交由浏览器做平滑交叉过渡
 * - 不支持的浏览器（或过渡被并发打断）自动无感回退为即时更新
 */
export function runViewTransition(
  update: () => void,
  kind: ViewTransitionKind = 'route'
): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    update();
    return;
  }

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const doc = document as DocumentWithVT;

  if (reducedMotion || typeof doc.startViewTransition !== 'function') {
    update();
    return;
  }

  const root = document.documentElement;
  const cls = kind === 'theme' ? 'vt-theme' : 'vt-route';
  root.classList.add(cls);

  try {
    const transition = doc.startViewTransition(() => {
      flushSync(() => {
        update();
      });
    });

    transition.finished
      .catch(() => undefined)
      .finally(() => {
        root.classList.remove(cls);
      });
  } catch {
    root.classList.remove(cls);
    update();
  }
}
