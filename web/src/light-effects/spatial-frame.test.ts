import { describe, expect, it } from 'vitest';
import type { BoardHoldAssignment, SpatialLightEffectGroup } from '../board-renderer/types';
import { apiLevel3Color, unpackApiLevel3Color } from '../domain/boards/colors';
import { kilterFullride7x10Definition as definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { spatialCapacityPlan } from './capacity-plan';
import { renderAnimationFrame } from './frame';
import { createSpatialPreset, SPATIAL_PRESETS } from './preset-library';
import { BOARD_ANIMATION_FRAME_MS, renderSpatialGroup } from './spatial-frame';

const preset = (kind: Parameters<typeof createSpatialPreset>[0], seed = 42) => createSpatialPreset(kind, seed);

describe('spatial effect rendering', () => {
  it('holds one discrete pose for each measured two-FPS board frame', () => {
    const snake = preset('snake');
    const first = renderSpatialGroup(definition, [], snake, 0);
    expect(renderSpatialGroup(definition, [], snake, BOARD_ANIMATION_FRAME_MS - 1)).toEqual(first);
    expect(renderSpatialGroup(definition, [], snake, BOARD_ANIMATION_FRAME_MS)).not.toEqual(first);
  });

  it('gives physical traversal presets enough board frames to move legibly', () => {
    const periods = new Map(SPATIAL_PRESETS.map(({ kind, periodMs }) => [kind, periodMs]));
    expect(periods.get('snake')).toBeGreaterThanOrEqual(120_000);
    expect(periods.get('pac-man')).toBeGreaterThanOrEqual(120_000);
    for (const { periodMs } of SPATIAL_PRESETS) {
      expect(periodMs).toBeGreaterThanOrEqual(30_000);
      expect(periodMs % BOARD_ANIMATION_FRAME_MS).toBe(0);
    }
  });

  it.each(SPATIAL_PRESETS.map(({ kind, footprint }) => [kind, footprint] as const))('%s is deterministic, unique, role-color-safe, and within its %i-light reserve', (kind, footprint) => {
    const group = preset(kind);
    const reserved = new Set(Object.values(definition.rolePresets).map(({ lightColor }) => lightColor));
    for (let elapsedMs = 0; elapsedMs <= group.periodMs; elapsedMs += group.periodMs / 40) {
      const first = renderSpatialGroup(definition, [], group, elapsedMs);
      expect(renderSpatialGroup(definition, [], group, elapsedMs)).toEqual(first);
      expect(first.length).toBeLessThanOrEqual(footprint);
      expect(new Set(first.map(({ placementId }) => placementId)).size).toBe(first.length);
      expect(first.every(({ color }) => color !== apiLevel3Color(0) && !reserved.has(color))).toBe(true);
    }
  });

  it('evaluates unused dynamically, allows explicit background custom overlays, and always protects roles', () => {
    const [rolePlacement, customPlacement] = definition.placements;
    const assignments: BoardHoldAssignment[] = [
      { placementId: rolePlacement!.id, appearance: { kind:'role', role:'start' } },
      { placementId: customPlacement!.id, appearance: { kind:'custom', color:apiLevel3Color(9) } },
    ];
    const selected: SpatialLightEffectGroup = { ...preset('snake'), footprint:2, target:{scope:'selected',include:[rolePlacement!.id, customPlacement!.id],exclude:[]} };
    expect(renderSpatialGroup(definition, assignments, selected, 0).map(({placementId})=>placementId)).toEqual([customPlacement!.id]);
    const background: SpatialLightEffectGroup = { ...selected, target:{...selected.target,scope:'background-board'} };
    const frame = renderAnimationFrame({ definition, assignments, effectGroups:[background], elapsedMs:0 });
    expect(frame.find(({placementId})=>placementId===rolePlacement!.id)?.color).toBe(definition.rolePresets.start.lightColor);
  });

  it('uses later spatial groups above earlier groups and conservatively sums reserves', () => {
    const placementId = definition.placements[5]!.id;
    const first: SpatialLightEffectGroup = { ...preset('snake',1), footprint:1, target:{scope:'selected',include:[placementId],exclude:[]} };
    const second: SpatialLightEffectGroup = { ...preset('beach-ball',2), footprint:1, target:{scope:'selected',include:[placementId],exclude:[]} };
    const frame = renderAnimationFrame({definition,assignments:[],effectGroups:[first,second],elapsedMs:500});
    expect(frame).toEqual(renderSpatialGroup(definition,[],second,500));
    expect(spatialCapacityPlan([], [first,second])).toMatchObject({ assignmentLights:0, worstCaseLights:2, intendedFps:2 });
  });

  it('preserves seeded bird quiet intervals and changes directional game poses', () => {
    const birds = preset('bird-flock', 7);
    expect(renderSpatialGroup(definition,[],birds,0)).toEqual([]);
    expect(renderSpatialGroup(definition,[],birds,birds.periodMs*.75).length).toBeGreaterThan(0);
    for (const kind of ['snake','pac-man','pong'] as const) {
      const forward = preset(kind,9);
      const reverse = { ...forward, recipe:{...forward.recipe,direction:'reverse'} } as SpatialLightEffectGroup;
      expect(renderSpatialGroup(definition,[],forward,forward.periodMs*.2)).not.toEqual(renderSpatialGroup(definition,[],reverse,reverse.periodMs*.2));
    }
  });

  it('varies the seeded bird flight path across consecutive cycles', () => {
    const birds = preset('bird-flock', 7);
    const paths = Array.from({ length: 4 }, (_, cycle) =>
      renderSpatialGroup(definition, [], birds, birds.periodMs * (cycle + 0.75))
        .map(({ placementId }) => placementId),
    );
    expect(new Set(paths.map((path) => path.join('|'))).size).toBeGreaterThanOrEqual(3);
    expect(
      renderSpatialGroup(definition, [], birds, birds.periodMs * 2.75).map(({ placementId }) => placementId),
    ).toEqual(paths[2]);
    expect(paths.every((path) => path.length <= birds.footprint)).toBe(true);
  });

  it('varies snake weave orientation across consecutive circuits', () => {
    const snake = preset('snake', 11);
    const paths = Array.from({ length: 4 }, (_, cycle) =>
      renderSpatialGroup(definition, [], snake, snake.periodMs * (cycle + 0.25))
        .map(({ placementId }) => placementId),
    );
    expect(new Set(paths.map((path) => path.join('|'))).size).toBeGreaterThanOrEqual(3);
    expect(
      renderSpatialGroup(definition, [], snake, snake.periodMs * 3.25).map(({ placementId }) => placementId),
    ).toEqual(paths[3]);
    expect(paths.every((path) => path.length <= snake.footprint)).toBe(true);
  });

  it('moves the Snake head only along orthogonal taxicab edges', () => {
    const snake = preset('snake', 11);
    const positions = new Map(definition.placements.map((placement) => [placement.id, placement.position]));
    const heads = Array.from({ length: 80 }, (_, frame) =>
      renderSpatialGroup(definition, [], snake, frame * BOARD_ANIMATION_FRAME_MS)[0]!.placementId,
    );
    for (let index = 1; index < heads.length; index += 1) {
      const before = positions.get(heads[index - 1]!)!;
      const after = positions.get(heads[index]!)!;
      const dx = Math.abs(after.x - before.x);
      const dy = Math.abs(after.y - before.y);
      expect(dx === 0 || dy === 0, `Snake moved diagonally from ${before.x},${before.y} to ${after.x},${after.y}`).toBe(true);
    }
  });

  it('varies Pac-Man maze orientation across consecutive circuits', () => {
    const pacMan = preset('pac-man', 19);
    const paths = Array.from({ length: 4 }, (_, cycle) =>
      renderSpatialGroup(definition, [], pacMan, pacMan.periodMs * (cycle + 0.25))
        .map(({ placementId }) => placementId),
    );
    expect(new Set(paths.map((path) => path.join('|'))).size).toBeGreaterThanOrEqual(3);
    expect(
      renderSpatialGroup(definition, [], pacMan, pacMan.periodMs * 1.25).map(({ placementId }) => placementId),
    ).toEqual(paths[1]);
    expect(paths.every((path) => path.length <= pacMan.footprint)).toBe(true);
  });

  it('moves Pac-Man only along orthogonal maze edges', () => {
    const pacMan = preset('pac-man', 19);
    const positions = new Map(definition.placements.map((placement) => [placement.id, placement.position]));
    const heads = Array.from({ length: 80 }, (_, frame) =>
      renderSpatialGroup(definition, [], pacMan, frame * BOARD_ANIMATION_FRAME_MS)[0]!.placementId,
    );
    for (let index = 1; index < heads.length; index += 1) {
      const before = positions.get(heads[index - 1]!)!;
      const after = positions.get(heads[index]!)!;
      const dx = Math.abs(after.x - before.x);
      const dy = Math.abs(after.y - before.y);
      expect(dx === 0 || dy === 0, `Pac-Man moved diagonally from ${before.x},${before.y} to ${after.x},${after.y}`).toBe(true);
    }
  });

  it.each(['matrix-rain', 'beach-ball', 'pong'] as const)('varies %s motion across consecutive cycles', (kind) => {
    const group = preset(kind, 23);
    const paths = Array.from({ length: 4 }, (_, cycle) =>
      renderSpatialGroup(definition, [], group, group.periodMs * (cycle + 0.4))
        .map(({ placementId }) => placementId),
    );
    expect(new Set(paths.map((path) => path.join('|'))).size).toBeGreaterThanOrEqual(3);
    expect(
      renderSpatialGroup(definition, [], group, group.periodMs * 2.4).map(({ placementId }) => placementId),
    ).toEqual(paths[2]);
    expect(paths.every((path) => path.length <= group.footprint)).toBe(true);
  });

  it('renders Frogger with a green frog, red traffic, and a bounded crossing', () => {
    const frogger = preset('frogger', 31);
    const first = renderSpatialGroup(definition, [], frogger, 8_000);
    const later = renderSpatialGroup(definition, [], frogger, 28_000);
    expect(first).toHaveLength(frogger.footprint);
    expect(new Set(first.map(({ placementId }) => placementId)).size).toBe(first.length);
    expect(first.slice(0, 2).every(({ color }) => {
      const rgb = unpackApiLevel3Color(color);
      return rgb.green > rgb.red && rgb.green > rgb.blue;
    })).toBe(true);
    expect(first.slice(2).every(({ color }) => {
      const rgb = unpackApiLevel3Color(color);
      return rgb.red > rgb.green && rgb.red > rgb.blue;
    })).toBe(true);
    expect(later.map(({ placementId }) => placementId)).not.toEqual(first.map(({ placementId }) => placementId));
  });

  it('keeps a stable pentagram outline while fading every red light together', () => {
    const pentagram = preset('pentagram', 37);
    const bright = renderSpatialGroup(definition, [], pentagram, 0);
    const dim = renderSpatialGroup(definition, [], pentagram, pentagram.periodMs / 2);
    expect(bright).toHaveLength(20);
    expect(dim.map(({ placementId }) => placementId)).toEqual(bright.map(({ placementId }) => placementId));
    expect(new Set(bright.map(({ color }) => color)).size).toBe(1);
    expect(new Set(dim.map(({ color }) => color)).size).toBe(1);
    expect(dim[0]!.color).not.toBe(bright[0]!.color);
    for (const scene of [bright, dim]) {
      const rgb = unpackApiLevel3Color(scene[0]!.color);
      expect(rgb.red).toBeGreaterThan(0);
      expect(rgb.green).toBe(0);
      expect(rgb.blue).toBe(0);
    }
  });

  it('distributes a full 20-light pentagram across its circle and all five star strokes', () => {
    const pentagram = preset('pentagram', 37);
    const scene = renderSpatialGroup(definition, [], pentagram, 0);
    const vertices = Array.from({ length: 5 }, (_, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
      return { x: .5 + Math.cos(angle) * .4, y: .5 + Math.sin(angle) * .4 };
    });
    const starOrder = [0, 2, 4, 1, 3, 0];
    const anchors = [
      ...Array.from({ length: 10 }, (_, index) => {
        const angle = -Math.PI / 2 + Math.PI / 10 + index * Math.PI * 2 / 10;
        return { x: .5 + Math.cos(angle) * .4, y: .5 + Math.sin(angle) * .4 };
      }),
      ...starOrder.slice(0, -1).map((vertex) => vertices[vertex]!),
      ...Array.from({ length: 5 }, (_, stroke) => {
        const from = vertices[starOrder[stroke]!]!;
        const to = vertices[starOrder[stroke + 1]!]!;
        const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
        const dx = midpoint.x - .5; const dy = midpoint.y - .5;
        return Math.abs(dx) > Math.abs(dy)
          ? { x: midpoint.x + Math.sign(dx) * 8 / (definition.bounds.right - definition.bounds.left), y: midpoint.y }
          : { x: midpoint.x, y: midpoint.y + Math.sign(dy) * 8 / (definition.bounds.top - definition.bounds.bottom) };
      }),
    ];
    const positions = new Map(definition.placements.map(({ id, position }) => [id, {
      x: (position.x - definition.bounds.left) / (definition.bounds.right - definition.bounds.left),
      y: (position.y - definition.bounds.bottom) / (definition.bounds.top - definition.bounds.bottom),
    }]));
    expect(pentagram.footprint).toBe(20);
    expect(scene).toHaveLength(20);
    scene.forEach(({ placementId }, index) => {
      const position = positions.get(placementId)!;
      const anchor = anchors[index]!;
      expect(Math.hypot(position.x - anchor.x, position.y - anchor.y)).toBeLessThan(.13);
      expect(position.x).toBeGreaterThan(.08);
      expect(position.x).toBeLessThan(.92);
      expect(position.y).toBeGreaterThan(.08);
      expect(position.y).toBeLessThan(.92);
    });
    const downwardPoint = positions.get(scene[10]!.placementId)!;
    expect(downwardPoint.y).toBeGreaterThan(.08);
    expect(downwardPoint.y).toBeLessThan(.18);
    expect(Math.abs(downwardPoint.x - .5)).toBeLessThan(.08);
    expect(scene.slice(15).map(({ placementId }) => {
      const placement = definition.placements.find(({ id }) => id === placementId)!;
      return [placement.position.x, placement.position.y];
    })).toEqual([[20, 80], [-4, 104], [0, 60], [4, 104], [-20, 80]]);
  });
});
