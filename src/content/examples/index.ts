import type { ExampleCase } from '../../types/content';
import { motorControlExamples } from './motorExamples';
import { processAndSystemExamples } from './processExamples';

export const examples: ExampleCase[] = [
  ...motorControlExamples,
  ...processAndSystemExamples,
];

export { motorControlExamples, processAndSystemExamples };
