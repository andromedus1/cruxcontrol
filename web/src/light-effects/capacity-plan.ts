import type { BoardHoldAssignment, LightEffectGroup, LightEffectGroupId } from '../board-renderer/types';

export interface SpatialCapacityPlan {
  readonly assignmentLights: number;
  readonly spatialReserves: readonly Readonly<{ id: LightEffectGroupId; lights: number }>[];
  readonly worstCaseLights: number;
  readonly intendedFps: number;
}

export function spatialCapacityPlan(assignments: readonly BoardHoldAssignment[], groups: readonly LightEffectGroup[]): SpatialCapacityPlan {
  const spatialReserves = Object.freeze(groups.filter((group) => group.model === 'spatial').map((group) => Object.freeze({ id: group.id, lights: group.footprint })));
  return Object.freeze({ assignmentLights: assignments.length, spatialReserves, worstCaseLights: assignments.length + spatialReserves.reduce((sum, item) => sum + item.lights, 0), intendedFps: 2 });
}
