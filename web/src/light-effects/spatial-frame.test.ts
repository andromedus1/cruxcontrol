import { describe, expect, it } from 'vitest';
import type { BoardHoldAssignment, SpatialLightEffectGroup } from '../board-renderer/types';
import { apiLevel3Color } from '../domain/boards/colors';
import { kilterFullride7x10Definition as definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { spatialCapacityPlan } from './capacity-plan';
import { renderAnimationFrame } from './frame';
import { createSpatialPreset, SPATIAL_PRESETS } from './preset-library';
import { renderSpatialGroup } from './spatial-frame';

const preset = (kind: Parameters<typeof createSpatialPreset>[0], seed = 42) => createSpatialPreset(kind, seed);

describe('spatial effect rendering', () => {
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
});
