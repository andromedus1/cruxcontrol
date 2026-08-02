import type { BoardHoldAssignment } from '../board-renderer/types';
import type { BoardDefinition } from '../domain/boards/definition';
import { detectKilterFullrideRings } from './ring-detector';
import { SUPPLIED_FULLRIDE_CLIMBS } from './supplied-fullride-climbs';
import type {
  ScreenshotImportCandidate,
  ScreenshotImportWarning,
  ScreenshotPixels,
  SuppliedRingFact,
} from './types';

function resolveAssignments(
  facts: readonly SuppliedRingFact[],
  definition: BoardDefinition,
): Readonly<{
  assignments: readonly BoardHoldAssignment[];
  warnings: readonly ScreenshotImportWarning[];
}> {
  const assignments: BoardHoldAssignment[] = [];
  const warnings: ScreenshotImportWarning[] = [];
  for (const fact of facts) {
    const x = -40 + fact.column * 4;
    const y = 140 - fact.row * 4;
    const matches = definition.placements.filter(
      (placement) => placement.position.x === x && placement.position.y === y,
    );
    if (matches.length !== 1) {
      warnings.push({
        code: 'unresolved-cell',
        column: fact.column,
        row: fact.row,
        message: `Column ${fact.column}, row ${fact.row} does not resolve to exactly one placement.`,
      });
      continue;
    }
    assignments.push({ placementId: matches[0].id, appearance: { kind: 'role', role: fact.role } });
  }
  return { assignments, warnings };
}

export function suppliedEntryToCandidate(
  sha256: string,
  definition: BoardDefinition,
): ScreenshotImportCandidate | null {
  const entry = SUPPLIED_FULLRIDE_CLIMBS.find((candidate) => candidate.sha256 === sha256);
  if (!entry) return null;
  const resolved = resolveAssignments(entry.rings, definition);
  return {
    sourceName: entry.sourceName,
    sourceSha256: entry.sha256,
    name: entry.name,
    assignments: resolved.assignments,
    warnings: resolved.warnings,
  };
}

export function interpretKilterScreenshot(input: {
  fileName: string;
  sha256: string;
  pixels: ScreenshotPixels;
  definition: BoardDefinition;
}): ScreenshotImportCandidate {
  const supplied = suppliedEntryToCandidate(input.sha256, input.definition);
  if (supplied) return supplied;
  const detected = detectKilterFullrideRings(input.pixels);
  const resolved = resolveAssignments(detected.rings, input.definition);
  return {
    sourceName: input.fileName,
    sourceSha256: input.sha256,
    name: '',
    assignments: resolved.assignments,
    warnings: [
      ...detected.warnings,
      ...resolved.warnings,
      { code: 'title-required', message: 'Enter the visible screenshot title before import.' },
    ],
  };
}
