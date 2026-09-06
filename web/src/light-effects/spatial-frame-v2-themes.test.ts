import { describe, expect, it } from 'vitest';
import type { SpatialLightEffectGroup } from '../board-renderer/types';
import { apiLevel3Color, unpackApiLevel3Color } from '../domain/boards/colors';
import { kilterFullride7x10Definition as definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import type { LightScene } from '../domain/boards/light-scene';
import { createSpatialPreset } from './preset-library';
import { renderSpatialGroup } from './spatial-frame';

const assignments = Object.freeze([]);
const positions = new Map(
  definition.placements.map(({ id, position }) => [
    id,
    {
      x: (position.x - definition.bounds.left) / (definition.bounds.right - definition.bounds.left),
      y:
        (position.y - definition.bounds.bottom) /
        (definition.bounds.top - definition.bounds.bottom),
    },
  ]),
);
const point = (light: LightScene[number]) => positions.get(light.placementId)!;
const distance = (a: LightScene[number], b: LightScene[number]) =>
  Math.hypot(point(a).x - point(b).x, point(a).y - point(b).y);
const sceneAt = (group: SpatialLightEffectGroup, frame: number) =>
  renderSpatialGroup(definition, assignments, group, frame * 500);
const nearest = (light: LightScene[number], scene: LightScene) =>
  scene.reduce((best, next) => (distance(light, next) < distance(light, best) ? next : best));
const center = (scene: LightScene) => ({
  x: scene.reduce((sum, light) => sum + point(light).x, 0) / scene.length,
  y: scene.reduce((sum, light) => sum + point(light).y, 0) / scene.length,
});

// These inspect the actual neighboring held poses around the wrap, rather than
// comparing two identical modulo-clock inputs. Actor/trail and Pong/Frogger
// contracts have their own full-cycle tests in the adjacent focused test files.
describe('v2 thematic joins and movement', () => {
  it.each([0, 7, 42])(
    'carries tide color bands and nearby geometry through the join for seed %s',
    (seed) => {
      for (const periodMs of [61000, 120000]) {
        const group = { ...createSpatialPreset('ocean-tide', seed), periodMs };
        const frames = [-2, -1, 0, 1].map((frame) => sceneAt(group, frame));
        for (let i = 1; i < frames.length; i += 1)
          for (const light of frames[i - 1]!) {
            const next = nearest(light, frames[i]!);
            expect(distance(light, next)).toBeLessThan(0.14);
            const beforeRgb = unpackApiLevel3Color(light.color),
              nextRgb = unpackApiLevel3Color(next.color);
            // Allow sparse-grid displacement and coarse RGB332 steps, but not a
            // palette-rank reset that changes an almost-stationary band to another hue.
            for (const channel of ['red', 'green', 'blue'] as const)
              expect(Math.abs(beforeRgb[channel] - nextRgb[channel])).toBeLessThanOrEqual(110);
          }
      }
    },
  );

  it('joins the spiral pattern and fixed pentagram outline without a geometry reset', () => {
    for (const periodMs of [61000, 120000]) {
      const spiral = { ...createSpatialPreset('tie-dye-spiral', 42), periodMs };
      const frames = [-2, -1, 0, 1].map((frame) => sceneAt(spiral, frame));
      for (let i = 1; i < frames.length; i += 1)
        for (const light of frames[i - 1]!)
          expect(distance(light, nearest(light, frames[i]!))).toBeLessThan(0.25);
      const star = {
        ...createSpatialPreset('pentagram', 42),
        periodMs,
        palette: [apiLevel3Color(0xe0)],
      };
      const anchors = sceneAt(star, 0).map((light) => light.placementId);
      const colors = new Set<number>();
      for (let frame = -2; frame <= periodMs / 500 + 1; frame += 1) {
        const scene = sceneAt(star, frame);
        expect(scene.map((light) => light.placementId)).toEqual(anchors);
        expect(new Set(scene.map((light) => light.color)).size).toBe(1);
        colors.add(scene[0]!.color);
      }
      expect(anchors).toHaveLength(20);
      expect(colors.size).toBeGreaterThan(2);
      expect(
        anchors.some(
          (id) => Math.hypot(positions.get(id)!.x - 0.5, positions.get(id)!.y - 0.1) < 0.05,
        ),
      ).toBe(true);
    }
  });

  it.each(['left', 'right'] as const)(
    'lets each %s-bound bird pass leave before the next enters',
    (direction) => {
      for (const seed of [0, 7, 42])
        for (const periodMs of [61000, 120000]) {
          const group: SpatialLightEffectGroup = {
            ...createSpatialPreset('bird-flock', seed),
            periodMs,
            palette: [apiLevel3Color(0xbf)],
            recipe: { kind: 'bird-flock', direction, quietFraction: 0 },
          };
          const frames = Array.from({ length: periodMs / 500 }, (_, frame) =>
            sceneAt(group, frame),
          );
          let entries = 0;
          for (let frame = 0; frame < frames.length; frame += 1) {
            const previous = frames[(frame + frames.length - 1) % frames.length]!,
              current = frames[frame]!;
            if (!previous.length && current.length) {
              entries += 1;
              expect(
                direction === 'left' ? center(current).x : 1 - center(current).x,
              ).toBeGreaterThan(0.85);
            }
            if (previous.length && !current.length)
              expect(
                direction === 'left' ? center(previous).x : 1 - center(previous).x,
              ).toBeLessThan(0.15);
            if (previous.length && current.length) {
              const delta =
                (center(current).x - center(previous).x) * (direction === 'left' ? -1 : 1);
              // The visible centroid may shift backward when an edge member exits.
              expect(Math.abs(delta)).toBeLessThan(0.16);
            }
          }
          expect(entries).toBe(3);
        }
    },
  );

  it.each(['down', 'up'] as const)(
    'keeps rain moving %s with a dark off-board wrap',
    (direction) => {
      for (const seed of [0, 7, 42]) {
        const group: SpatialLightEffectGroup = {
          ...createSpatialPreset('matrix-rain', seed),
          periodMs: 61000,
          footprint: 1,
          palette: [apiLevel3Color(0x1c)],
          recipe: { kind: 'matrix-rain', columns: 1, direction },
        };
        const frames = Array.from({ length: 122 }, (_, frame) => sceneAt(group, frame));
        let entries = 0;
        for (let frame = 0; frame < frames.length; frame += 1) {
          const previous = frames[(frame + frames.length - 1) % frames.length]!,
            current = frames[frame]!;
          if (!previous.length && current.length) {
            entries += 1;
            expect(
              direction === 'down' ? point(current[0]!).y : 1 - point(current[0]!).y,
            ).toBeGreaterThan(0.85);
          }
          if (previous.length && !current.length)
            expect(
              direction === 'down' ? point(previous[0]!).y : 1 - point(previous[0]!).y,
            ).toBeLessThan(0.15);
          if (previous.length && current.length) {
            const delta =
              (point(current[0]!).y - point(previous[0]!).y) * (direction === 'down' ? -1 : 1);
            // Six approved falls can advance two physical rows in a custom 61-second loop.
            expect(delta).toBeGreaterThanOrEqual(0);
            expect(delta).toBeLessThan(.15);
          }
        }
        expect(entries).toBe(6);
      }
    },
  );

  it('keeps the beach-ball cluster local through both sides of the join', () => {
    for (const seed of [0, 7, 42])
      for (const periodMs of [61000, 90000]) {
        const group = { ...createSpatialPreset('beach-ball', seed), periodMs };
        const frames = [-2, -1, 0, 1].map((frame) => sceneAt(group, frame));
        for (const scene of frames) {
          expect(scene).toHaveLength(4);
          for (const light of scene)
            expect(
              Math.hypot(point(light).x - center(scene).x, point(light).y - center(scene).y),
            ).toBeLessThan(0.12);
        }
        for (let i = 1; i < frames.length; i += 1)
          expect(
            Math.hypot(
              center(frames[i]!).x - center(frames[i - 1]!).x,
              center(frames[i]!).y - center(frames[i - 1]!).y,
            ),
          ).toBeLessThan(0.1);
      }
  });
});
