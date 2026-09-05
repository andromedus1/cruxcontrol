import { describe, expect, it } from 'vitest';
import type { SpatialLightEffectGroup } from '../board-renderer/types';
import { createSpatialPreset } from './preset-library';
import { sampleBumblebeePose, spatialLoopClock } from './spatial-frame-v2';

const poseAt = (group: SpatialLightEffectGroup, phase: number) =>
  sampleBumblebeePose(group, { phase, frame: 0, frameCount: 240 });

describe('bee orientation through the complete tour', () => {
  it.each([0, 7, 17, 42])('turns continuously at all six waypoints for seed %s', (seed) => {
    for (const hoverFraction of [0, .01, .4, .8]) {
      const group: SpatialLightEffectGroup = {
        ...createSpatialPreset('bumblebee', seed),
        recipe: { kind: 'bumblebee', hoverFraction },
      };
      // Find segment transitions from the public sampler, independently of its
      // private duration weights; then inspect each side of the actual boundary.
      const boundaries = [0];
      for (let step = 1; step < 1000; step += 1) {
        let left = (step - 1) / 1000, right = step / 1000;
        const segment = poseAt(group, left).segment;
        if (segment === poseAt(group, right).segment) continue;
        for (let iteration = 0; iteration < 35; iteration += 1) {
          const middle = (left + right) / 2;
          if (poseAt(group, middle).segment === segment) left = middle;
          else right = middle;
        }
        boundaries.push(right);
      }
      expect(boundaries).toHaveLength(6);
      for (const boundary of boundaries) {
        const before = poseAt(group, boundary - 1e-7), after = poseAt(group, boundary + 1e-7);
        expect(Math.hypot(before.center.x - after.center.x, before.center.y - after.center.y)).toBeLessThan(1e-4);
        expect(Math.hypot(before.heading.x - after.heading.x, before.heading.y - after.heading.y)).toBeLessThan(1e-4);
        expect(Math.hypot(after.heading.x, after.heading.y)).toBeCloseTo(1, 10);
      }
      for (const periodMs of [61000, 120000, 179999]) {
        const count = spatialLoopClock(periodMs, 0).frameCount;
        for (let frame = 0; frame < count; frame += 1) {
          const before = sampleBumblebeePose(group, spatialLoopClock(periodMs, (frame - 1) * 500));
          const after = sampleBumblebeePose(group, spatialLoopClock(periodMs, frame * 500));
          // Minute-plus tours turn in several held poses, including zero-hover
          // departures. A roughly 70-degree instantaneous waypoint turn fails.
          expect(Math.hypot(before.heading.x - after.heading.x, before.heading.y - after.heading.y)).toBeLessThan(.8);
        }
      }
    }
  });
});
