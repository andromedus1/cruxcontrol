import { describe, expect, it } from 'vitest';
import { apiLevel3Color, unpackApiLevel3Color } from '../domain/boards/colors';
import { kilterFullride7x10Definition as definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { createSpatialPreset, SPATIAL_PRESETS } from './preset-library';
import { renderSpatialGroup, BOARD_ANIMATION_FRAME_MS } from './spatial-frame';
import { spatialDisplayColor } from './spatial-colors';
import { spatialLoopClock } from './spatial-frame-v2';
import { quantizeApiLevel3ColorForApiLevel2 } from '../board-control/api-level-2-codec';

describe('version 2 spatial loops', () => {
  it('uses a positive 2 FPS clock that closes for negative elapsed time', () => {
    const clock = spatialLoopClock(1_001, -1);
    expect(clock.frameCount).toBe(2);
    expect(clock.effectivePeriodMs).toBe(1_000);
    expect(clock.frame).toBe(1);
    expect(clock.phase).toBe(.5);
  });

  it.each(SPATIAL_PRESETS.map(({ kind }) => kind))('%s has a deterministic complete cycle and state join', (kind) => {
    const group = createSpatialPreset(kind, 42);
    expect(group.recipeVersion).toBe(2);
    const first = renderSpatialGroup(definition, [], group, 0);
    const repeat = renderSpatialGroup(definition, [], group, group.periodMs);
    expect(repeat).toEqual(first);
    expect(first.length).toBeLessThanOrEqual(group.footprint);
    expect(new Set(first.map(({ placementId }) => placementId)).size).toBe(first.length);
  });

  it.each(['snake', 'pac-man'] as const)('%s keeps head frames on orthogonal graph edges, including the join', (kind) => {
    const group = createSpatialPreset(kind, 7);
    const positions = new Map(definition.placements.map(({ id, position }) => [id, position]));
    const frames = Math.round(group.periodMs / BOARD_ANIMATION_FRAME_MS);
    const heads = Array.from({ length: frames }, (_, frame) => renderSpatialGroup(definition, [], group, frame * BOARD_ANIMATION_FRAME_MS)[0]?.placementId);
    for (let index = 0; index < heads.length; index += 1) {
      const before = positions.get(heads[index]!)!;
      const after = positions.get(heads[(index + 1) % heads.length]!)!;
      expect(before).toBeDefined();
      expect(after).toBeDefined();
      expect(before.x === after.x || before.y === after.y).toBe(true);
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

describe('API-2 spatial color protection', () => {
  it('keeps every nonblack source byte away from encoded role colors', () => {
    const roleBytes = new Set(Object.values(definition.rolePresets).map(({ lightColor }) => quantizeApiLevel3ColorForApiLevel2(lightColor)));
    roleBytes.add(quantizeApiLevel3ColorForApiLevel2(0));
    for (let source = 1; source < 256; source += 1) {
      const adjusted = spatialDisplayColor(definition, apiLevel3Color(source));
      expect(adjusted).not.toBe(apiLevel3Color(0));
      expect(roleBytes.has(quantizeApiLevel3ColorForApiLevel2(adjusted))).toBe(false);
    }
  });

  it('keeps black black and returns a nearby packed color', () => {
    expect(spatialDisplayColor(definition, apiLevel3Color(0))).toBe(apiLevel3Color(0));
    const source = apiLevel3Color(0x1c);
    const adjusted = spatialDisplayColor(definition, source);
    const from = unpackApiLevel3Color(source);
    const to = unpackApiLevel3Color(adjusted);
    expect((to.red - from.red) ** 2 + (to.green - from.green) ** 2 + (to.blue - from.blue) ** 2).toBeLessThan(255 ** 2 * 3);
  });
});
