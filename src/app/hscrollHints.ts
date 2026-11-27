/**
 * 横向滚动提示（v2.1）
 * 自动找出所有 overflow-x:auto/scroll 且内容确实比容器宽的元素（梯形图、宽表格、代码块等），
 * 打上 data-hscroll 标记：右侧渐隐 + 块级容器顶部一行“← 左右滑动查看 →”；滑到最右边时去掉渐隐。
 * 只改属性，不增删 React 管理的节点。
 */
let overflowCache = new WeakMap<Element, boolean>();
const marked = new Set<HTMLElement>();
let timer = 0;

function isScroller(el: Element): boolean {
  let v = overflowCache.get(el);
  if (v === undefined) {
    const ox = getComputedStyle(el).overflowX;
    v = ox === 'auto' || ox === 'scroll';
    overflowCache.set(el, v);
  }
  return v;
}

function hasSiblingHint(el: HTMLElement): boolean {
  const prev = el.previousElementSibling as HTMLElement | null;
  return !!prev && /滑动/.test(prev.textContent || '') && (prev.textContent || '').length < 80;
}

function updateEnd(el: HTMLElement) {
  const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
  if (atEnd) el.setAttribute('data-hscroll-end', '');
  else el.removeAttribute('data-hscroll-end');
}

function scan() {
  timer = 0;
  const all = document.body.getElementsByTagName('*');
  const seen = new Set<HTMLElement>();
  for (let i = 0; i < all.length; i++) {
    const el = all[i] as HTMLElement;
    if (!(el instanceof HTMLElement)) continue;
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || tag === 'svg') continue;
    if (!isScroller(el)) continue;
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      seen.add(el);
      const display = getComputedStyle(el).display;
      const block = display === 'block' || display === 'flow-root';
      const mode = !block || hasSiblingHint(el) || el.clientHeight < 40 ? 'edge' : '1';
      if (el.getAttribute('data-hscroll') !== mode) el.setAttribute('data-hscroll', mode);
      if (!marked.has(el)) {
        marked.add(el);
        el.addEventListener('scroll', () => updateEnd(el), { passive: true });
      }
      updateEnd(el);
    }
  }
  for (const el of marked) {
    if (!seen.has(el)) {
      el.removeAttribute('data-hscroll');
      el.removeAttribute('data-hscroll-end');
      if (!el.isConnected) marked.delete(el);
    }
  }
}

function schedule(delay = 250) {
  if (!timer) timer = window.setTimeout(scan, delay);
}

export function installHScrollHints() {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;
  const start = () => {
    schedule(50);
    new MutationObserver(() => schedule()).observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", () => { overflowCache = new WeakMap(); schedule(120); });
    window.addEventListener('hashchange', () => schedule(300));
    // 字体加载、懒加载内容后再扫一次
    window.setTimeout(() => schedule(0), 1200);
  };
  if (document.body) start();
  else window.addEventListener('DOMContentLoaded', start);
}
