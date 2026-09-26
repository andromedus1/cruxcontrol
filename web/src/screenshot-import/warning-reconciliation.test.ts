import { describe, expect, it } from 'vitest';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import type { BoardHoldAssignment } from '../board-renderer/types';
import { boardPlacementId } from '../domain/boards/identity';
import { reconcileScreenshotImportWarnings } from './warning-reconciliation';
import type { ScreenshotImportCandidate, ScreenshotImportWarning } from './types';

const firstPlacement = kilterFullride7x10Definition.placements[0]!;

function candidate(
  warnings: readonly ScreenshotImportWarning[],
  assignments: readonly BoardHoldAssignment[] = [],
): ScreenshotImportCandidate {
  return {
    sourceName: 'unknown.png',
    sourceSha256: 'f'.repeat(64),
    name: '',
    assignments,
    warnings,
  };
}

function roleAssignment(role: 'start' | 'middle' | 'finish' | 'foot-only'): BoardHoldAssignment {
  return { placementId: firstPlacement.id, appearance: { kind: 'role', role } };
}

function input(
  warnings: readonly ScreenshotImportWarning[],
  name: string,
  candidateAssignments: readonly BoardHoldAssignment[] = [],
  assignments = candidateAssignments,
) {
  return {
    candidate: candidate(warnings, candidateAssignments),
    definition: kilterFullride7x10Definition,
    name,
    assignments,
  };
}

describe('reconcileScreenshotImportWarnings', () => {
  it('resolves title-required evidence when the title is filled without mutating the candidate', () => {
    const warning: ScreenshotImportWarning = {
      code: 'title-required',
      message: 'Enter the visible screenshot title before import.',
    };
    const original = candidate([warning]);
    const result = reconcileScreenshotImportWarnings({
      ...input([warning], 'Corrected title'),
      candidate: original,
    });

    expect(result).toEqual([]);
    expect(original.warnings).toEqual([warning]);
  });

  it('resolves a cell warning only after that cell assignment changes', () => {
    const warning: ScreenshotImportWarning = {
      code: 'low-confidence',
      column: 0,
      row: 28,
      role: 'start',
      message: 'The start ring requires confirmation.',
    };
    const initial = [roleAssignment('start')];

    expect(reconcileScreenshotImportWarnings(input([warning], 'Title', initial))).toEqual([
      warning,
    ]);
    expect(
      reconcileScreenshotImportWarnings(
        input([warning], 'Title', initial, [roleAssignment('finish')]),
      ),
    ).toEqual([]);
  });

  it('does not resolve a cell warning after an unrelated assignment changes', () => {
    const warning: ScreenshotImportWarning = {
      code: 'duplicate-cell',
      column: 0,
      row: 28,
      message: 'Multiple ring candidates mapped to the cell.',
    };
    const initial = [roleAssignment('start')];
    const unrelated = {
      placementId: boardPlacementId('kilter:generated:placement:4118'),
      appearance: { kind: 'role' as const, role: 'finish' as const },
    };

    expect(
      reconcileScreenshotImportWarnings(
        input([warning], 'Title', initial, [...initial, unrelated]),
      ),
    ).toEqual([warning]);
  });

  it('keeps off-grid evidence unresolved after arbitrary board edits', () => {
    const warning: ScreenshotImportWarning = {
      code: 'off-grid',
      role: 'middle',
      centroid: { x: 12, y: 34 },
      message: 'Ignored an off-grid middle ring candidate.',
    };

    expect(
      reconcileScreenshotImportWarnings(input([warning], 'Title', [], [roleAssignment('start')])),
    ).toEqual([warning]);
  });
});
