import type { BoardDefinition } from '../domain/boards/definition';
import type { BoardHoldAssignment } from '../board-renderer/types';
import type { ScreenshotImportCandidate, ScreenshotImportWarning } from './types';

interface WarningReconciliationInput {
  readonly candidate: ScreenshotImportCandidate;
  readonly definition: BoardDefinition;
  readonly name: string;
  readonly assignments: readonly BoardHoldAssignment[];
}

function placementForCell(definition: BoardDefinition, column: number, row: number): string | null {
  const x = -40 + column * 4;
  const y = 140 - row * 4;
  const matches = definition.placements.filter(
    (placement) => placement.position.x === x && placement.position.y === y,
  );
  return matches.length === 1 ? matches[0]!.id : null;
}

function assignmentKey(assignment: BoardHoldAssignment | undefined): string {
  if (!assignment) return '';
  const appearance =
    assignment.appearance.kind === 'role'
      ? `role:${assignment.appearance.role}`
      : `custom:${assignment.appearance.color}`;
  return `${assignment.placementId}:${appearance}:${assignment.effectGroupId ?? ''}`;
}

function assignmentAt(
  assignments: readonly BoardHoldAssignment[],
  placementId: string,
): BoardHoldAssignment | undefined {
  return assignments.find((assignment) => assignment.placementId === placementId);
}

function cellWarningWasCorrected(
  warning: Extract<ScreenshotImportWarning, { readonly code: 'low-confidence' | 'duplicate-cell' }>,
  input: WarningReconciliationInput,
): boolean {
  const placementId = placementForCell(input.definition, warning.column, warning.row);
  if (!placementId) return false;
  return (
    assignmentKey(assignmentAt(input.candidate.assignments, placementId)) !==
    assignmentKey(assignmentAt(input.assignments, placementId))
  );
}

function warningIsUnresolved(
  warning: ScreenshotImportWarning,
  input: WarningReconciliationInput,
): boolean {
  if (warning.code === 'title-required') return input.name.trim().length === 0;
  if (warning.code === 'low-confidence' || warning.code === 'duplicate-cell') {
    return !cellWarningWasCorrected(warning, input);
  }
  // Off-grid and unsupported/unresolved-cell warnings have no safe, stable
  // mapping to a board placement. They remain explicit review evidence and are
  // cleared only by the existing reviewed/accepted checkbox.
  return true;
}

/**
 * Keeps recognition warnings immutable while deriving which ones still block
 * import after title and hold corrections.
 */
export function reconcileScreenshotImportWarnings(
  input: WarningReconciliationInput,
): readonly ScreenshotImportWarning[] {
  return Object.freeze(
    input.candidate.warnings.filter((warning) => warningIsUnresolved(warning, input)),
  );
}
