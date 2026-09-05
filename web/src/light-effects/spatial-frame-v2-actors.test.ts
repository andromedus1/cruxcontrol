import { describe, expect, it } from 'vitest';
import type { SpatialLightEffectGroup } from '../board-renderer/types';
import { kilterFullride7x10Definition as definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { createSpatialPreset } from './preset-library';
import { renderSpatialGroup } from './spatial-frame';
import { spatialDisplayColor } from './spatial-colors';
import { samplePongPose } from './spatial-pong';

const assignments = Object.freeze([]);
const modulo = (value: number, count: number) => ((value % count) + count) % count;
const sceneAt = (group: SpatialLightEffectGroup, frame: number) =>
  renderSpatialGroup(definition, assignments, group, frame * 500);
const position = (id: string) => {
  const { x, y } = definition.placements.find((hold) => hold.id === id)!.position;
  return {
    x: (x - definition.bounds.left) / (definition.bounds.right - definition.bounds.left),
    y: (y - definition.bounds.bottom) / (definition.bounds.top - definition.bounds.bottom),
  };
};

describe('v2 actor ordering, identity and contacts', () => {
  it.each(['forward', 'reverse'] as const)(
    'keeps Snake body on recent cyclic head positions when going %s',
    (direction) => {
      for (const seed of [0, 7, 42]) {
        // 122 frames permit a 61-edge DFS tour: one graph step per frame.
        const group: SpatialLightEffectGroup = {
          ...createSpatialPreset('snake', seed),
          periodMs: 61000,
          recipe: { kind: 'snake', bodyLength: 7, direction },
        };
        const heads = Array.from(
          { length: 122 },
          (_, frame) => sceneAt(group, frame)[0]!.placementId,
        );
        for (let frame = -2; frame < heads.length + 2; frame += 1) {
          const recent = Array.from(
            { length: 7 },
            (_, offset) => heads[modulo(frame - offset, heads.length)]!,
          );
          expect(sceneAt(group, frame).map((light) => light.placementId)).toEqual([
            ...new Set(recent),
          ]);
        }
      }
    },
  );

  it.each(['forward', 'reverse'] as const)(
    'keeps Pac-Man colors and forward pellets/trailing ghost when going %s',
    (direction) => {
      for (const seed of [0, 7, 42]) {
        const group: SpatialLightEffectGroup = {
          ...createSpatialPreset('pac-man', seed),
          periodMs: 61000,
          recipe: { kind: 'pac-man', mouthBeat: 2, direction },
        };
        const heads = Array.from(
          { length: 122 },
          (_, frame) => sceneAt(group, frame)[0]!.placementId,
        );
        const protagonist = spatialDisplayColor(definition, group.palette[0]!);
        const ghostColor = spatialDisplayColor(definition, group.palette[1]!);
        let ghosts = 0;
        for (let frame = -2; frame < heads.length + 2; frame += 1) {
          const scene = sceneAt(group, frame);
          expect(scene[0]!.color).toBe(protagonist);
          const allowed = new Set(
            [0, 1, 2, 3, 4, -3].map((offset) => heads[modulo(frame + offset, heads.length)]!),
          );
          expect(scene.every((light) => allowed.has(light.placementId))).toBe(true);
          const ghost = scene.find((light) => light.color === ghostColor);
          if (ghost) {
            ghosts += 1;
            expect(ghost.placementId).toBe(heads[modulo(frame - 3, heads.length)]);
          }
        }
        expect(ghosts).toBeGreaterThan(10);
      }
    },
  );

  it('projects each Pong paddle at its own planned contact height, including the join', () => {
    const group: SpatialLightEffectGroup = {
      ...createSpatialPreset('pong', 5),
      footprint: 3,
      recipe: { kind: 'pong', paddleSize: 1, direction: 'forward' },
    };
    for (let frame = -2; frame < 182; frame += 1) {
      const pose = samplePongPose(group.seed, group.periodMs, frame / 180, 'forward');
      const scene = sceneAt(group, frame);
      expect(scene).toHaveLength(3);
      const left = position(scene[1]!.placementId);
      const right = position(scene[2]!.placementId);
      expect(Math.hypot(left.x - 0.06, left.y - pose.leftPaddleY)).toBeLessThan(0.07);
      expect(Math.hypot(right.x - 0.94, right.y - pose.rightPaddleY)).toBeLessThan(0.07);
    }
  });
});
