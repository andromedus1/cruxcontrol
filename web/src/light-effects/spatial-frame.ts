import type { BoardHoldAssignment, SpatialLightEffectGroup } from '../board-renderer/types';
import type { BoardDefinition } from '../domain/boards/definition';
import type { LightScene } from '../domain/boards/light-scene';
import { BOARD_ANIMATION_FRAME_MS, renderSpatialGroupV1 } from './spatial-frame-v1';
import { renderSpatialGroupV2 } from './spatial-frame-v2';

/**
 * Version dispatch is the compatibility boundary for authored effect recipes.
 * Version one remains available until a group is explicitly upgraded.
 */
export function renderSpatialGroup(
  definition: BoardDefinition,
  assignments: readonly BoardHoldAssignment[],
  group: SpatialLightEffectGroup,
  elapsedMs: number,
): LightScene {
  return group.recipeVersion === 2
    ? renderSpatialGroupV2(definition, assignments, group, elapsedMs)
    : renderSpatialGroupV1(definition, assignments, group, elapsedMs);
}

export { BOARD_ANIMATION_FRAME_MS, renderSpatialGroupV1 };
