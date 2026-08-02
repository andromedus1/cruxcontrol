import { describe, expect, it } from 'vitest';
import { summarizeCapacityTrace, type CapacityTraceEvent } from './capacity-trace';

describe('summarizeCapacityTrace', () => {
  it('summarizes completed batch durations without payload identity', () => {
    const trace: CapacityTraceEvent[] = [
      { atMs: 0, stage: 'scheduled', frameIndex: 0 },
      { atMs: 1, stage: 'batch-started', frameIndex: 0 },
      { atMs: 11, stage: 'batch-settled', frameIndex: 0 },
      { atMs: 100, stage: 'scheduled', frameIndex: 1 },
      { atMs: 101, stage: 'batch-started', frameIndex: 1 },
      { atMs: 131, stage: 'batch-settled', frameIndex: 1 },
    ];
    expect(summarizeCapacityTrace(trace, 10)).toMatchObject({
      requestedFps: 10,
      effectiveFps: 10,
      attemptedFrames: 2,
      appliedFrames: 2,
      p50BatchMs: 10,
      p95BatchMs: 30,
      maxBatchMs: 30,
    });
  });
});
