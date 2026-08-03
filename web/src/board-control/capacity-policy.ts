import type { AuroraApiLevel } from './api-level-2-codec';
import { encodedSceneCost, type EncodedSceneCost } from './capacity-model';

export interface BoardCapacityProfile {
  readonly apiLevel: AuroraApiLevel;
  readonly safeStaticLights: number;
  readonly safeInterChunkDelayMs: 0 | 5 | 10 | 20;
  readonly animationPoints: readonly Readonly<{
    maxLights: number;
    maxFps: number;
    p95BatchMs: number;
  }>[];
  readonly omittedLightsPersist: boolean;
}

export interface AnimationSchedule {
  readonly fps: number;
  readonly interChunkDelayMs: 0 | 5 | 10 | 20;
  readonly strategy: 'full-scene';
  readonly warning?: string;
}

/** The only product profile backed by the recorded Fullride/Android campaign. */
export const FULLRIDE_API2_MEASURED_PROFILE: BoardCapacityProfile = Object.freeze({
  apiLevel: 2,
  safeStaticLights: 127,
  safeInterChunkDelayMs: 20,
  animationPoints: Object.freeze([
    Object.freeze({ maxLights: 20, maxFps: 2, p95BatchMs: 448.4 }),
  ]),
  omittedLightsPersist: false,
});

export function measuredCapacityProfile(
  apiLevel: AuroraApiLevel,
): BoardCapacityProfile | null {
  return apiLevel === FULLRIDE_API2_MEASURED_PROFILE.apiLevel
    ? FULLRIDE_API2_MEASURED_PROFILE
    : null;
}

export function chooseAnimationSchedule(
  profile: BoardCapacityProfile,
  lightCount: number,
  recentBatchMs: readonly number[],
): AnimationSchedule {
  assertLightCount(lightCount);
  const point = [...profile.animationPoints]
    .sort((left, right) => left.maxLights - right.maxLights)
    .find(({ maxLights }) => lightCount <= maxLights);
  if (!point) {
    return Object.freeze({
      fps: 0,
      interChunkDelayMs: profile.safeInterChunkDelayMs,
      strategy: 'full-scene',
      warning: `${lightCount} lights exceed the measured animation limit of ${maximumAnimationLights(profile)}. The design is still saved, but board animation is not started.`,
    });
  }

  const recentP95 = percentile95(recentBatchMs);
  if (recentP95 !== null && recentP95 > 1_000) {
    return Object.freeze({
      fps: 0,
      interChunkDelayMs: profile.safeInterChunkDelayMs,
      strategy: 'full-scene',
      warning: `Recent board frames took ${formatMs(recentP95)} p95, so animation is paused before the controller queue can grow. The design is unchanged.`,
    });
  }
  if (recentP95 !== null && recentP95 > 1_000 / point.maxFps) {
    return Object.freeze({
      fps: 1,
      interChunkDelayMs: profile.safeInterChunkDelayMs,
      strategy: 'full-scene',
      warning: `Animation was reduced to 1 FPS because recent board frames took ${formatMs(recentP95)} p95.`,
    });
  }
  return Object.freeze({
    fps: point.maxFps,
    interChunkDelayMs: profile.safeInterChunkDelayMs,
    strategy: 'full-scene',
  });
}

export function assessStaticScene(
  profile: BoardCapacityProfile,
  lightCount: number,
): Readonly<{ accepted: boolean; cost: EncodedSceneCost; warning?: string }> {
  const cost = encodedSceneCost(profile.apiLevel, lightCount);
  if (lightCount <= profile.safeStaticLights) return Object.freeze({ accepted: true, cost });
  return Object.freeze({
    accepted: false,
    cost,
    warning: `${lightCount} lights require ${cost.packetCount} packets / ${cost.writeCount} writes and exceed the measured static limit of ${profile.safeStaticLights}. The design is still saved, but it was not sent to the board.`,
  });
}

export function capacityCostLabel(cost: EncodedSceneCost): string {
  return `${cost.lightCount} lights · ${cost.packetCount} ${cost.packetCount === 1 ? 'packet' : 'packets'} · ${cost.writeCount} ${cost.writeCount === 1 ? 'write' : 'writes'}`;
}

function maximumAnimationLights(profile: BoardCapacityProfile): number {
  return Math.max(0, ...profile.animationPoints.map(({ maxLights }) => maxLights));
}

function percentile95(values: readonly number[]): number | null {
  const finite = values.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (finite.length === 0) return null;
  return finite[Math.ceil(finite.length * 0.95) - 1]!;
}

function assertLightCount(lightCount: number): void {
  if (!Number.isInteger(lightCount) || lightCount < 0) {
    throw new RangeError('Light count must be a non-negative integer.');
  }
}

function formatMs(value: number): string {
  return `${Math.round(value)} ms`;
}
