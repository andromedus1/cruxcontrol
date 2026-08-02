import { createAssignmentIndex } from '../board-renderer/scene';
import type { BoardHoldAssignment } from '../board-renderer/types';
import type { BoardDefinition } from '../domain/boards/definition';
import type { LightScene } from '../domain/boards/light-scene';

export function lightSceneFromAssignments(
  definition: BoardDefinition,
  assignments: readonly BoardHoldAssignment[],
): LightScene {
  createAssignmentIndex(definition, assignments);
  return Object.freeze(
    assignments.map(({ placementId, appearance }) =>
      Object.freeze({
        placementId,
        color:
          appearance.kind === 'custom'
            ? appearance.color
            : definition.rolePresets[appearance.role].lightColor,
      }),
    ),
  );
}
