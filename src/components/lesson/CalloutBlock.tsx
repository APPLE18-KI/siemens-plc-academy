import React from 'react';
import { AlertTriangle, Info, Lightbulb, ShieldAlert } from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';

interface CalloutBlockProps {
  tone: 'tip' | 'warn' | 'info' | 'danger';
  title?: string;
  md: string;
}

const TONE_CONFIG = {
  tip: {
    label: '工程技巧 · TIP',
    Icon: Lightbulb,
  },
  warn: {
    label: '调试注意 · WARN',
    Icon: AlertTriangle,
  },
  info: {
    label: '原理说明 · INFO',
    Icon: Info,
  },
  danger: {
    label: '安全红线 · DANGER',
    Icon: ShieldAlert,
  },
} as const;

export const CalloutBlock: React.FC<CalloutBlockProps> = ({ tone, title, md }) => {
  const cfg = TONE_CONFIG[tone] ?? TONE_CONFIG.info;
  const Icon = cfg.Icon;

  return (
    <div className={`callout-box tone-${tone}`}>
      <div className="callout-header">
        <Icon size={17} style={{ flexShrink: 0 }} />
        <span className="callout-tone-tag">{cfg.label}</span>
        {title && <span className="callout-title">· {title}</span>}
      </div>
      <div className="callout-body">
        <MarkdownRenderer content={md} />
      </div>
    </div>
  );
};
