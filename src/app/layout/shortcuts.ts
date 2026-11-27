/**
 * 全局键盘快捷键去重订阅器（遵循 vercel-react-best-practices: client-event-listeners）。
 * 无论挂载多少个组件，window 上始终只注册 1 个 keydown 监听器。
 */

export type ShortcutCombo = 'mod+k' | 'escape';

type ShortcutCallback = (event: KeyboardEvent) => void;

const registry = new Map<ShortcutCombo, Set<ShortcutCallback>>();
let listenerAttached = false;

function handleGlobalKeydown(event: KeyboardEvent): void {
  const key = event.key.toLowerCase();

  if ((event.metaKey || event.ctrlKey) && !event.altKey && key === 'k') {
    const handlers = registry.get('mod+k');
    if (handlers && handlers.size > 0) {
      handlers.forEach((cb) => cb(event));
    }
    return;
  }

  if (key === 'escape') {
    const handlers = registry.get('escape');
    if (handlers && handlers.size > 0) {
      handlers.forEach((cb) => cb(event));
    }
  }
}

function syncListener(): void {
  if (typeof window === 'undefined') return;
  let total = 0;
  registry.forEach((set) => {
    total += set.size;
  });

  if (total > 0 && !listenerAttached) {
    window.addEventListener('keydown', handleGlobalKeydown);
    listenerAttached = true;
  } else if (total === 0 && listenerAttached) {
    window.removeEventListener('keydown', handleGlobalKeydown);
    listenerAttached = false;
  }
}

export function subscribeShortcut(combo: ShortcutCombo, callback: ShortcutCallback): () => void {
  let set = registry.get(combo);
  if (!set) {
    set = new Set();
    registry.set(combo, set);
  }
  set.add(callback);
  syncListener();

  return () => {
    const current = registry.get(combo);
    if (current) {
      current.delete(callback);
      if (current.size === 0) {
        registry.delete(combo);
      }
    }
    syncListener();
  };
}

/** 轻量跨组件事件：允许首页等位置唤醒全局命令面板，无需增加全局状态耦合 */
export const OPEN_COMMAND_PALETTE_EVENT = 'plc:open-command-palette';

export function triggerCommandPaletteOpen(initialQuery?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<{ query?: string }>(OPEN_COMMAND_PALETTE_EVENT, {
      detail: { query: initialQuery },
    })
  );
}
