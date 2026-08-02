import type { BoardHoldAppearance, BoardHoldAssignment } from '../board-renderer/types';
import type { ClimbRole } from '../domain/boards/definition';
import type { BoardPlacementId } from '../domain/boards/types';
import type { EditorTool } from './types';

const roles: readonly ClimbRole[] = ['start', 'middle', 'finish', 'foot-only'];

function sameAppearance(left: BoardHoldAppearance, right: BoardHoldAppearance): boolean {
  if (left.kind !== right.kind) return false;
  return left.kind === 'role'
    ? left.role === (right as Extract<BoardHoldAppearance, { kind: 'role' }>).role
    : left.color === (right as Extract<BoardHoldAppearance, { kind: 'custom' }>).color;
}

export function cycleAppearance(current?: BoardHoldAppearance): BoardHoldAppearance | null {
  if (!current || current.kind === 'custom') return { kind: 'role', role: 'start' };
  const next = roles.indexOf(current.role) + 1;
  return next < roles.length ? { kind: 'role', role: roles[next]! } : null;
}

export function applyEditorTool(
  assignments: readonly BoardHoldAssignment[],
  placementId: BoardPlacementId,
  tool: EditorTool,
): readonly BoardHoldAssignment[] {
  if (tool.kind === 'eyedropper') return assignments;
  const currentAssignment = assignments.find((value) => value.placementId === placementId);
  const current = currentAssignment?.appearance;
  if (tool.kind === 'apply-effect') {
    if (!currentAssignment || currentAssignment.effectGroupId === tool.effectGroupId)
      return assignments;
    return Object.freeze(
      assignments.map((assignment) =>
        assignment.placementId === placementId
          ? Object.freeze({ ...assignment, effectGroupId: tool.effectGroupId })
          : assignment,
      ),
    );
  }
  if (tool.kind === 'remove-effect') {
    if (!currentAssignment?.effectGroupId) return assignments;
    return Object.freeze(
      assignments.map((assignment) => {
        if (assignment.placementId !== placementId) return assignment;
        const { effectGroupId: _removed, ...base } = assignment;
        return Object.freeze(base);
      }),
    );
  }
  const appearance =
    tool.kind === 'cycle'
      ? cycleAppearance(current)
      : tool.kind === 'erase'
        ? null
        : { kind: 'custom' as const, color: tool.color };
  if (!current && !appearance) return assignments;
  if (current && appearance && sameAppearance(current, appearance)) return assignments;
  const without = assignments.filter((value) => value.placementId !== placementId);
  if (!appearance) return Object.freeze(without);
  return Object.freeze([
    ...without,
    Object.freeze({
      placementId,
      appearance,
      ...(currentAssignment?.effectGroupId === undefined
        ? {}
        : { effectGroupId: currentAssignment.effectGroupId }),
    }),
  ]);
}
