import { describe, expect, it } from 'vitest';
import { prepareFroggerPlan, sampleFroggerPlan } from './spatial-frogger';

describe('planned Frogger crossings', () => {
  it.each([0, 7, 42])('crosses out and back through safe traffic gaps for seed %s', (seed) => {
    for (const lanes of [1, 4, 8])
      for (const budget of [0, 1, 8, 18]) {
        const plan = prepareFroggerPlan(lanes, seed, budget);
        const frames = Array.from({ length: 2401 }, (_, frame) =>
          sampleFroggerPlan(plan, frame / 2400),
        );
        expect(frames.at(-1)).toEqual(frames[0]);
        expect(Math.max(...frames.map(({ frog }) => frog.y))).toBeCloseTo(0.94);
        expect(frames[1200]!.frog.y).toBeCloseTo(0.94);
        expect(frames[2300]!.frog.y).toBeCloseTo(0.06);
        let waits = 0;
        for (let frame = 1; frame < frames.length; frame += 1) {
          const before = frames[frame - 1]!;
          const current = frames[frame]!;
          // At this sample interval even the fastest smooth-ended hop is continuous.
          expect(Math.abs(current.frog.y - before.frog.y)).toBeLessThan(0.012);
          if (current.frog.y === before.frog.y && current.frog.y > 0.07 && current.frog.y < 0.93)
            waits += 1;
          expect(current.traffic.length).toBeLessThanOrEqual(budget);
          for (const car of current.traffic) {
            if (Math.abs(current.frog.y - car.y) < (0.4 * 0.88) / lanes) {
              expect(Math.abs(current.frog.x - car.x)).toBeGreaterThan(0.17);
            }
          }
        }
        if (lanes > 1) expect(waits).toBeGreaterThan(5);
      }
  });

  it('uses distinct seeded waits and repeats traffic only after an off-board interval', () => {
    const plan = prepareFroggerPlan(4, 42, 8);
    expect(sampleFroggerPlan(prepareFroggerPlan(4, 7, 8), 0.2)).not.toEqual(
      sampleFroggerPlan(plan, 0.2),
    );
    const frames = Array.from({ length: 240 }, (_, frame) => sampleFroggerPlan(plan, frame / 240));
    for (const vehicle of plan.vehicles) {
      let appearances = 0;
      for (let frame = 0; frame < frames.length; frame += 1) {
        const before = frames[(frame + frames.length - 1) % frames.length]!.traffic.find(
          ({ id }) => id === vehicle.id,
        );
        const after = frames[frame]!.traffic.find(({ id }) => id === vehicle.id);
        if (!before && after) {
          appearances += 1;
          expect(vehicle.direction > 0 ? after.x : 1 - after.x).toBeLessThan(0.03);
        }
        if (before && !after)
          expect(vehicle.direction > 0 ? before.x : 1 - before.x).toBeGreaterThan(0.97);
        if (before && after) expect((after.x - before.x) * vehicle.direction).toBeGreaterThan(0);
      }
      expect(appearances).toBe(2);
    }
  });

  it('holds both banks at the loop join and lands each hop without a velocity jump', () => {
    const plan = prepareFroggerPlan(4, 0, 8);
    expect(sampleFroggerPlan(plan, 1 - 1 / 240).frog).toEqual(sampleFroggerPlan(plan, 0).frog);
    for (const hop of plan.hops) {
      const start = sampleFroggerPlan(plan, hop.start).frog;
      const next = sampleFroggerPlan(plan, hop.start + 1e-6).frog;
      const end = sampleFroggerPlan(plan, hop.end).frog;
      const previous = sampleFroggerPlan(plan, hop.end - 1e-6).frog;
      expect(Math.abs(next.y - start.y)).toBeLessThan(1e-7);
      expect(Math.abs(end.y - previous.y)).toBeLessThan(1e-7);
    }
  });
});
