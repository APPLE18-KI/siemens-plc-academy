import type { TraceSample } from './types';

/**
 * Lightweight circular ring buffer storing the latest N PLC scan waveform samples.
 * Default capacity: 120 samples.
 */
export class TraceRingBuffer {
  private readonly capacity: number;
  private buffer: TraceSample[] = [];

  constructor(capacity = 120) {
    this.capacity = Math.max(16, capacity);
  }

  push(sample: TraceSample): void {
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }
    this.buffer.push(sample);
  }

  getSamples(): TraceSample[] {
    return this.buffer.slice();
  }

  clear(): void {
    this.buffer = [];
  }

  get size(): number {
    return this.buffer.length;
  }

  get maxCapacity(): number {
    return this.capacity;
  }
}
