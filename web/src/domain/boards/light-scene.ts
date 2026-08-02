import type { BoardDefinition, ClimbRole } from './definition.ts';
import type { ApiLevel3Color, BoardPlacementId } from './types.ts';

export interface PlacementLight {
  readonly placementId: BoardPlacementId;
  readonly color: ApiLevel3Color;
}

export type LightScene = readonly PlacementLight[];

export interface RolePlacement {
  readonly placementId: BoardPlacementId;
  readonly role: ClimbRole;
}

export function sceneFromRoles(
  definition: BoardDefinition,
  placements: readonly RolePlacement[],
): LightScene {
  const knownPlacements = new Set(definition.placements.map((placement) => placement.id));
  const indexes = new Map<BoardPlacementId, number>();

  return Object.freeze(
    placements.map((placement, index) => {
      if (!knownPlacements.has(placement.placementId)) {
        throw new Error(`Unknown board placement ${placement.placementId} at scene index ${index}`);
      }
      const priorIndex = indexes.get(placement.placementId);
      if (priorIndex !== undefined) {
        throw new Error(
          `Duplicate board placement ${placement.placementId} at scene indexes ${priorIndex} and ${index}`,
        );
      }
      indexes.set(placement.placementId, index);
      return Object.freeze({
        placementId: placement.placementId,
        color: definition.rolePresets[placement.role].lightColor,
      });
    }),
  );
}
