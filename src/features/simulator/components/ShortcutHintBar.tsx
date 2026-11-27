import React, { memo } from 'react';
import { Keyboard } from 'lucide-react';

export interface ShortcutItem {
  keys: string;
  label: string;
  onTrigger?: () => void;
}

interface ShortcutHintBarProps {
  items: ShortcutItem[];
  variant?: 'tia' | 'instrument';
}

export const ShortcutHintBar = memo<ShortcutHintBarProps>(function ShortcutHintBar({
  items,
  variant = 'instrument',
}) {
  if (items.length === 0) return null;

  return (
    <div
      className={`plc-sim-kbd-bar variant-${variant}`}
      role="region"
      aria-label="仿真快捷键"
    >
      <span className="plc-sim-kbd-title">
        <Keyboard size={13} aria-hidden />
        <span>快捷操作</span>
      </span>
      <div className="plc-sim-kbd-list">
        {items.map((item) =>
          item.onTrigger ? (
            <button
              key={item.keys}
              type="button"
              className="plc-sim-kbd-chip is-interactive"
              onClick={item.onTrigger}
              title={`快捷键 ${item.keys}：${item.label}`}
            >
              <kbd>{item.keys}</kbd>
              <span>{item.label}</span>
            </button>
          ) : (
            <span key={item.keys} className="plc-sim-kbd-chip">
              <kbd>{item.keys}</kbd>
              <span>{item.label}</span>
            </span>
          ),
        )}
      </div>
    </div>
  );
});
