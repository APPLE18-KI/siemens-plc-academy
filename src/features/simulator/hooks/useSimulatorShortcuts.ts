import { useEffect, useRef } from 'react';

export interface SimulatorShortcutActions {
  onToggleRun?: () => void;
  onSingleScan?: () => void;
  onResetMres?: () => void;
  onOpenCrossRef?: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

/**
 * Registers non-intrusive simulator keyboard shortcuts when focus is outside editable inputs.
 * Uses latest-ref storage (advanced-event-handler-refs) so the listener attaches once even at 50Hz scan ticks.
 *
 * Supported keys:
 * - Alt+R : Toggle CPU RUN / STOP
 * - Alt+S : Execute single OB1 scan cycle
 * - Alt+M : Reset / MRES
 * - Alt+X or F11 : Open Cross-Reference (when provided)
 */
export function useSimulatorShortcuts(
  actions: SimulatorShortcutActions,
  enabled = true,
): void {
  const actionsRef = useRef<SimulatorShortcutActions>(actions);
  actionsRef.current = actions;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isEditableTarget(e.target)) return;

      // Never interfere with Ctrl/Meta shortcuts (e.g. Ctrl+K command palette, Ctrl+C)
      if (e.ctrlKey || e.metaKey) return;

      const cur = actionsRef.current;

      if (!e.altKey && !e.shiftKey && e.key === 'F11' && cur.onOpenCrossRef) {
        e.preventDefault();
        cur.onOpenCrossRef();
        return;
      }

      if (!e.altKey || e.shiftKey) return;

      const code = e.code;
      const key = e.key.toLowerCase();

      if ((code === 'KeyR' || key === 'r') && cur.onToggleRun) {
        e.preventDefault();
        cur.onToggleRun();
      } else if ((code === 'KeyS' || key === 's') && cur.onSingleScan) {
        e.preventDefault();
        cur.onSingleScan();
      } else if ((code === 'KeyM' || key === 'm') && cur.onResetMres) {
        e.preventDefault();
        cur.onResetMres();
      } else if ((code === 'KeyX' || key === 'x') && cur.onOpenCrossRef) {
        e.preventDefault();
        cur.onOpenCrossRef();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
