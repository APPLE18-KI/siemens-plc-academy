import React from 'react';
import { MousePointerClick, Sparkles } from 'lucide-react';
import type { DemoId } from '../../types/content';
import { demoRegistry } from '../../features/demos';
import { ErrorBoundary } from '../ErrorBoundary';

export const DemoBlock: React.FC<{ id: DemoId; title?: string; instruction?: string }> = ({ id, title, instruction }) => {
  const entry = demoRegistry[id];
  if (!entry) return null;
  const Comp = entry.Component;
  return (
    <section className="embedded-stage-card demo-card">
      <div className="embedded-stage-head">
        <div className="embedded-stage-title-wrap">
          <span className="embedded-stage-kicker">
            <Sparkles size={13} />
            {entry.kicker}
          </span>
          <span className="embedded-stage-title">{title || entry.title}</span>
        </div>
      </div>
      {instruction && (
        <div className="embedded-stage-instruction">
          <MousePointerClick size={16} color="var(--siemens-teal-bright)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{instruction}</span>
        </div>
      )}
      <div className="embedded-stage-body demo-body">
        <ErrorBoundary compact title="互动演示暂时无法加载">
          <Comp />
        </ErrorBoundary>
      </div>
    </section>
  );
};
