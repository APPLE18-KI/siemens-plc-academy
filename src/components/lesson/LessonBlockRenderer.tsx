import React from 'react';
import type { LessonBlock } from '../../types/content';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { CodeViewer } from '../CodeViewer';
import { IoTable } from '../IoTable';
import { CalloutBlock } from './CalloutBlock';
import { EmbeddedStageBlock } from './EmbeddedStageBlock';
import { PracticeTaskBlock } from './PracticeTaskBlock';
import { PredictCard } from './PredictCard';
import { QuizBlock } from './QuizBlock';
import { DemoBlock } from './DemoBlock';
import { pickKeys, useFold } from '../fold';
import { renderInline } from '../MarkdownRenderer';
import { Layers } from 'lucide-react';

const KeyList: React.FC<{ title?: string; keys: string[]; tone?: string }> = ({ title, keys, tone }) => {
  if (!keys.length) return null;
  return (
    <section className={`fold-keys${tone ? ` tone-${tone}` : ''}`}>
      {title && <h3 className="fold-keys-title">{title}</h3>}
      <ul>
        {keys.map((k, i) => (
          <li key={i}>{renderInline(k, `fk-${i}`)}</li>
        ))}
      </ul>
    </section>
  );
};

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
  const { level, setLevel, explicitMarks } = useFold();
  if (level === 'points' || level === 'statements') {
    const mode = level;
    switch (block.kind) {
      case 'text':
        return <KeyList title={block.title} keys={pickKeys(block.md, mode, explicitMarks)} />;
      case 'callout':
        return <KeyList title={block.title} keys={pickKeys(block.md, mode, explicitMarks)} tone={block.tone} />;
      case 'code':
      case 'dual-code':
        if (mode === 'statements') return null;
        break;
      case 'sim':
      case 'model':
      case 'workflow':
      case 'demo':
        if (mode === 'statements') return null;
        return (
          <button type="button" className="fold-demo-chip" onClick={() => setLevel('read')}>
            <Layers size={14} /> 互动演示：{block.title ?? '动手试一试'}（切到“精读”查看）
          </button>
        );
      default:
        return null;
    }
  }
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
          lessonId={lessonId}
          title={block.title}
          scenario={block.scenario}
          steps={block.steps}
          checkPoints={block.checkPoints}
        />
      );

    case 'quiz':
      return <QuizBlock lessonId={lessonId} title={block.title} items={block.items} />;

    case 'predict':
      return (
        <PredictCard
          title={block.title}
          scenario={block.scenario}
          ladSnippet={block.ladSnippet}
          question={block.question}
          options={block.options}
          answer={block.answer}
          explain={block.explain}
          simHint={block.simHint}
        />
      );

    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
};
