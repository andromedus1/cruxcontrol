export type CapacityTraceStage =
  | 'scheduled'
  | 'rendered'
  | 'batch-queued'
  | 'batch-started'
  | 'chunk-called'
  | 'chunk-settled'
  | 'batch-settled'
  | 'timeout'
  | 'cancelled'
  | 'error'
  | 'disconnect'
  | 'reconnect'
  | 'clear';

export type CapacityTraceEvent = Readonly<{
  atMs: number;
  stage: CapacityTraceStage;
  frameIndex?: number;
  chunkIndex?: number;
  byteLength?: number;
  errorCode?: string;
}>;

export interface CapacityTraceSummary {
  readonly requestedFps: number;
  readonly effectiveFps: number;
  readonly attemptedFrames: number;
  readonly appliedFrames: number;
  readonly missedDueFrames: number;
  readonly p50BatchMs: number;
  readonly p95BatchMs: number;
  readonly maxBatchMs: number;
}

export function summarizeCapacityTrace(
  trace: readonly CapacityTraceEvent[],
  requestedFps: number,
): CapacityTraceSummary {
  const renderedFrames = new Set(
    trace
      .filter(
        (event): event is CapacityTraceEvent & { frameIndex: number } =>
          event.stage === 'rendered' && event.frameIndex !== undefined,
      )
      .map(({ frameIndex }) => frameIndex),
  );
  const starts = new Map<number, number>();
  const durations: number[] = [];
  for (const event of trace) {
    if (event.frameIndex === undefined || !renderedFrames.has(event.frameIndex)) continue;
    if (event.stage === 'batch-started') starts.set(event.frameIndex, event.atMs);
    if (event.stage === 'batch-settled') {
      const start = starts.get(event.frameIndex);
      if (start !== undefined) durations.push(event.atMs - start);
    }
  }
  durations.sort((a, b) => a - b);
  const scheduled = trace.filter(({ stage }) => stage === 'scheduled');
  const appliedFrames = durations.length;
  const elapsed =
    scheduled.length > 1 ? scheduled[scheduled.length - 1]!.atMs - scheduled[0]!.atMs : 0;
  return Object.freeze({
    requestedFps,
    effectiveFps: elapsed > 0 ? ((appliedFrames - 1) * 1000) / elapsed : appliedFrames,
    attemptedFrames: trace.filter(
      ({ stage, frameIndex }) =>
        stage === 'batch-started' && frameIndex !== undefined && renderedFrames.has(frameIndex),
    ).length,
    appliedFrames,
    missedDueFrames: Math.max(0, scheduled.length - appliedFrames),
    p50BatchMs: percentile(durations, 0.5),
    p95BatchMs: percentile(durations, 0.95),
    maxBatchMs: durations.at(-1) ?? 0,
  });
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  return values[Math.ceil(values.length * fraction) - 1] ?? 0;
}
