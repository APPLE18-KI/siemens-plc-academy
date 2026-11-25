import React from 'react';
import type { LessonBlock } from '../../types/content';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { CodeViewer } from '../CodeViewer';
import { IoTable } from '../IoTable';
import { CalloutBlock } from './CalloutBlock';
import { EmbeddedStageBlock } from './EmbeddedStageBlock';
import { PracticeTaskBlock } from './PracticeTaskBlock';
import { QuizBlock } from './QuizBlock';
import { DemoBlock } from './DemoBlock';

interface LessonBlockRendererProps {
  lessonId: string;
  block: LessonBlock;
  index: number;
}

export const LessonBlockRenderer: React.FC<LessonBlockRendererProps> = ({
  lessonId,
  block,
  index,
}) => {
  switch (block.kind) {
    case 'text':
      return (
        <section className="lesson-text-block">
          {block.title && <h2 className="lesson-text-block-title">{block.title}</h2>}
          <MarkdownRenderer content={block.md} />
        </section>
      );

    case 'callout':
      return <CalloutBlock tone={block.tone} title={block.title} md={block.md} />;

    case 'code':
      return (
        <CodeViewer
          mode="single"
          lang={block.lang}
          title={block.title}
          code={block.code}
          caption={block.caption}
        />
      );

    case 'dual-code':
      return (
        <CodeViewer
          mode="dual"
          title={block.title}
          lad={block.lad}
          scl={block.scl}
          caption={block.caption}
        />
      );

    case 'io-table':
      return <IoTable title={block.title} tags={block.tags} />;

    case 'sim':
      return (
        <EmbeddedStageBlock
          kind="sim"
          preset={block.preset}
          title={block.title}
          instruction={block.instruction}
        />
      );

    case 'model':
      return (
        <EmbeddedStageBlock
          kind="model"
          id={block.id}
          title={block.title}
          instruction={block.instruction}
        />
      );

    case 'workflow':
      return (
        <EmbeddedStageBlock
          kind="workflow"
          id={block.id}
          title={block.title}
          instruction={block.instruction}
        />
      );

    case 'demo':
      return <DemoBlock id={block.id} title={block.title} instruction={block.instruction} />;

    case 'practice-task':
      return (
        <PracticeTaskBlock
          taskKey={`${lessonId}:practice:${index}`}
          title={block.title}
          scenario={block.scenario}
          steps={block.steps}
          checkPoints={block.checkPoints}
        />
      );

    case 'quiz':
      return <QuizBlock lessonId={lessonId} title={block.title} items={block.items} />;

    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
};
