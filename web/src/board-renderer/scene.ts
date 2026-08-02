import type { BoardDefinition } from '../domain/boards/definition';
import type { BoardPlacementId } from '../domain/boards/types';
import type { BoardHoldAppearance, BoardHoldAssignment } from './types';

export function createAssignmentIndex(
  definition: BoardDefinition,
  assignments: readonly BoardHoldAssignment[],
): ReadonlyMap<BoardPlacementId, BoardHoldAppearance> {
  const known = new Set(definition.placements.map(({ id }) => id));
  const index = new Map<BoardPlacementId, BoardHoldAppearance>();
  assignments.forEach((assignment, assignmentIndex) => {
    if (!known.has(assignment.placementId)) {
      throw new RangeError(
        `Assignment ${assignmentIndex} references unknown placement ${assignment.placementId}`,
      );
    }
    if (index.has(assignment.placementId)) {
      throw new RangeError(
        `Assignment ${assignmentIndex} duplicates placement ${assignment.placementId}`,
      );
    }
    index.set(assignment.placementId, assignment.appearance);
  });
  return index;
}
