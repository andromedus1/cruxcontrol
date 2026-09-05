import { describe, expect, it } from 'vitest';
import type { SpatialLightEffectGroup } from '../board-renderer/types';
import { kilterFullride7x10Definition as definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { createSpatialPreset, SPATIAL_PRESETS } from './preset-library';
import { renderSpatialGroup, BOARD_ANIMATION_FRAME_MS } from './spatial-frame';
import { spatialLoopClock } from './spatial-frame-v2';
import { prepareSpatialGeometry } from './spatial-geometry';

describe('version 2 spatial loops', () => {
  it('uses the designed long default for every new preset', () => {
    expect(Object.fromEntries(SPATIAL_PRESETS.map(({ kind, periodMs }) => [kind, periodMs]))).toEqual({
      'ocean-tide': 120_000,
      'tie-dye-spiral': 120_000,
      'matrix-rain': 90_000,
      snake: 150_000,
      'beach-ball': 90_000,
      'pac-man': 150_000,
      pong: 90_000,
      'bird-flock': 120_000,
      frogger: 120_000,
      pentagram: 120_000,
    });
  });

  it('uses a positive 2 FPS clock that closes for negative elapsed time', () => {
    const clock = spatialLoopClock(1_001, -1);
    expect(clock.frameCount).toBe(2);
    expect(clock.effectivePeriodMs).toBe(1_000);
    expect(clock.frame).toBe(1);
    expect(clock.phase).toBe(.5);
  });

  it.each(SPATIAL_PRESETS.map(({ kind }) => kind))('%s has a deterministic complete cycle and state join', (kind) => {
    for (const seed of [0, 7, 42]) {
      for (const periodMs of [createSpatialPreset(kind, seed).periodMs, 61_000]) {
        const group = { ...createSpatialPreset(kind, seed), periodMs };
        expect(group.recipeVersion).toBe(2);
        const first = renderSpatialGroup(definition, [], group, 0);
        const repeat = renderSpatialGroup(definition, [], group, periodMs);
        expect(repeat).toEqual(first);
        expect(first.length).toBeLessThanOrEqual(group.footprint);
        expect(new Set(first.map(({ placementId }) => placementId)).size).toBe(first.length);
      }
    }
  });

  it.each(['snake', 'pac-man'] as const)('%s keeps head frames on prepared graph edges, including the join', (kind) => {
    const geometry = prepareSpatialGeometry(definition);
    for (const seed of [0, 7, 42]) {
      const group = { ...createSpatialPreset(kind, seed), periodMs: 61_000 };
      const frames = Math.round(group.periodMs / BOARD_ANIMATION_FRAME_MS);
      const heads = Array.from({ length: frames }, (_, frame) => renderSpatialGroup(definition, [], group, frame * BOARD_ANIMATION_FRAME_MS)[0]?.placementId);
      for (let index = 0; index < heads.length; index += 1) {
        const before = heads[index]!;
        const after = heads[(index + 1) % heads.length]!;
        expect(before).toBeDefined();
        expect(after).toBeDefined();
        expect(geometry.neighbors.get(before)?.some((neighbor) => neighbor.id === after)).toBe(true);
      }
    }
  });

  it('keeps spatial intensity at zero dark and preserves route roles in composition', () => {
    const group = { ...createSpatialPreset('ocean-tide', 1), intensity: 0 as const };
    expect(renderSpatialGroup(definition, [], group, 0)).toEqual([]);
    const role = definition.placements[0]!;
    const scene = renderSpatialGroup(definition, [{ placementId: role.id, appearance: { kind: 'role', role: 'start' } }], group, 0);
    expect(scene).toEqual([]);
  });

  it('memoizes an immutable held scene and invalidates on replacement inputs', () => {
    const group = createSpatialPreset('snake', 3);
    const assignments: readonly never[] = [];
    const first = renderSpatialGroup(definition, assignments, group, 1);
    expect(renderSpatialGroup(definition, assignments, group, 499)).toBe(first);
    const changed = Object.freeze({ ...group, seed: group.seed + 1 });
    expect(renderSpatialGroup(definition, assignments, changed, 1)).not.toBe(first);
  });

  it('honors directional controls in reflected ball and Pong trajectories', () => {
    const ball = createSpatialPreset('beach-ball', 12);
    const reverseBall = Object.freeze({
      ...ball,
      recipe: Object.freeze({
        ...ball.recipe,
        velocityX: -Math.abs(ball.recipe.kind === 'beach-ball' ? ball.recipe.velocityX : 1),
      }),
    }) as SpatialLightEffectGroup;
    const pong = createSpatialPreset('pong', 12);
    const reversePong = Object.freeze({
      ...pong,
      recipe: Object.freeze({ ...pong.recipe, direction: 'reverse' as const }),
    }) as SpatialLightEffectGroup;
    expect(renderSpatialGroup(definition, [], ball, ball.periodMs * .17)).not.toEqual(renderSpatialGroup(definition, [], reverseBall, reverseBall.periodMs * .17));
    expect(renderSpatialGroup(definition, [], pong, pong.periodMs * .17)).not.toEqual(renderSpatialGroup(definition, [], reversePong, reversePong.periodMs * .17));
  });

  it('keeps Pong paddles symmetric within a small reserve and distributes Matrix streams', () => {
    const positions = new Map(definition.placements.map(({ id, position }) => [id, position]));
    const pong = Object.freeze({ ...createSpatialPreset('pong', 5), footprint: 3, recipe: Object.freeze({ kind: 'pong' as const, direction: 'forward' as const, paddleSize: 2 }) });
    const pongScene = renderSpatialGroup(definition, [], pong, pong.periodMs * .2);
    const pongX = pongScene.map(({ placementId }) => (positions.get(placementId)!.x - definition.bounds.left) / (definition.bounds.right - definition.bounds.left));
    expect(pongScene).toHaveLength(3);
    expect(pongX.filter((x) => x < .15).length).toBe(1);
    expect(pongX.filter((x) => x > .85).length).toBe(1);
    const matrix = createSpatialPreset('matrix-rain', 5);
    const matrixCounts: number[] = [];
    for (const frame of [0, 17, 41, 83]) {
      const scene = renderSpatialGroup(definition, [], matrix, frame * BOARD_ANIMATION_FRAME_MS);
      matrixCounts.push(new Set(scene.map(({ placementId }) => positions.get(placementId)!.x)).size);
    }
    expect(matrixCounts.some((count) => count >= 3)).toBe(true);
  });

  it('clips each bird member at the board edge and leaves quiet frames empty', () => {
    const birds = createSpatialPreset('bird-flock', 9);
    const open = Object.freeze({ ...birds, recipe: Object.freeze({ ...birds.recipe, quietFraction: 0 }) }) as SpatialLightEffectGroup;
    expect(renderSpatialGroup(definition, [], open, 0)).toEqual([]);
    const entering = renderSpatialGroup(definition, [], open, open.periodMs * .2);
    expect(entering.length).toBeGreaterThan(0);
    expect(entering.length).toBeLessThanOrEqual(3);
    expect(renderSpatialGroup(definition, [], birds, birds.periodMs * .99)).toEqual([]);
  });

  it('makes each shape control observable within the light reserve', () => {
    for (const preset of SPATIAL_PRESETS) {
      const base = createSpatialPreset(preset.kind, 11);
      const recipe = { ...base.recipe } as Record<string, unknown>;
      const field = preset.kind === 'ocean-tide' ? 'foam' : preset.kind === 'tie-dye-spiral' ? 'arms' : preset.kind === 'matrix-rain' ? 'columns' : preset.kind === 'snake' ? 'bodyLength' : preset.kind === 'beach-ball' ? 'size' : preset.kind === 'pac-man' ? 'mouthBeat' : preset.kind === 'pong' ? 'paddleSize' : preset.kind === 'bird-flock' ? 'quietFraction' : preset.kind === 'frogger' ? 'lanes' : 'fadeRate';
      const value = recipe[field];
      const alternate = typeof value === 'number' ? (field === 'quietFraction' ? Math.min(.9, (value as number) + .25) : field === 'bodyLength' ? 3 : (value as number) + 1) : value;
      const changed = Object.freeze({ ...base, recipe: Object.freeze({ ...recipe, [field]: alternate }) }) as typeof base;
      const baseFrames = Array.from({ length: 120 }, (_, frame) => JSON.stringify(renderSpatialGroup(definition, [], base, frame * 500)));
      const changedFrames = Array.from({ length: 120 }, (_, frame) => JSON.stringify(renderSpatialGroup(definition, [], changed, frame * 500)));
      expect(changedFrames.some((value, index) => value !== baseFrames[index])).toBe(true);
    }
  });
});
