import { useEffect, useRef } from 'react';

/**
 * 可被“返回键”关闭的弹层栈（抽屉、进度弹窗、术语解释、全屏设备模型……）。
 * 安卓返回键 / 测试钩子 window.__plcHandleBack 会先关闭最上层的弹层，而不是离开页面。
 */
const stack: Array<{ close: () => void }> = [];

function syncCount(): void {
  window.__plcOverlayOpen = stack.length;
}

/** 关闭最上层弹层；没有弹层时返回 false */
export function dismissTopOverlay(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

/** open 为 true 时把弹层压栈，关闭或卸载时出栈 */
export function useBackDismiss(open: boolean, close: () => void): void {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const entry = { close: () => closeRef.current() };
    stack.push(entry);
    syncCount();
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      syncCount();
    };
  }, [open]);
}
