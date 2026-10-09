import type { BoardDefinition } from '../../domain/boards/definition.ts';
import { KILTER_PROVIDER_ID } from '../../domain/boards/definitions/kilter-fullride-7x10.ts';
import { providerClimbViewKey } from '../../climb-browser/types.ts';
import type { CatalogClimb } from '../../catalog/types.ts';
import type { BoardHoldAssignment } from '../../board-renderer/types.ts';
import { providerSourceId } from '../../domain/boards/identity.ts';
import type { Row } from '../port.ts';

const MAX_FRAME_LENGTH = 16_384;

function text(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

function number(row: Row, key: string): number | null {
  const value = row[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function validNonnegative(value: number | null): value is number {
  return value !== null && value >= 0;
}

export function projectKilterClimb(
  row: Row,
  definition: BoardDefinition,
): CatalogClimb | null {
  const uuid = text(row, 'source_uuid');
  const name = text(row, 'source_name');
  const frames = text(row, 'source_frames');
  const setter = text(row, 'source_setter');
  const description = text(row, 'source_description');
  const layoutId = number(row, 'source_layout_id');
  const framesCount = number(row, 'source_frames_count');
  const isDraft = number(row, 'source_is_draft');
  const isListed = number(row, 'source_is_listed');
  const angle = number(row, 'stat_angle');
  const display = number(row, 'stat_display_difficulty');
  const community = number(row, 'stat_difficulty_average');
  const benchmarkValue = row.stat_benchmark_difficulty;
  const benchmark = benchmarkValue === null
    ? null
    : (typeof benchmarkValue === 'number' && Number.isFinite(benchmarkValue) ? benchmarkValue : NaN);
  const ascentCount = number(row, 'stat_ascensionist_count');
  const quality = number(row, 'stat_quality_average');

  if (!uuid?.trim() || !name?.trim() || frames === null || setter === null || description === null
    || layoutId !== 8 || framesCount !== 1 || isDraft !== 0 || isListed !== 1
    || angle === null || !definition.supportedAngles.includes(angle)
    || !validNonnegative(display) || !validNonnegative(community)
    || (benchmark !== null && !validNonnegative(benchmark))
    || !validNonnegative(ascentCount) || !Number.isInteger(ascentCount)
    || !validNonnegative(quality) || frames.length === 0 || frames.length > MAX_FRAME_LENGTH) {
    return null;
  }

  const placements = new Map(definition.placements.map((placement) =>
    [String(placement.native.placementId), placement.id] as const));
  const roles = new Map(Object.values(definition.rolePresets).map((preset) =>
    [String(preset.sourceRoleId), preset.role] as const));
  const assignments: BoardHoldAssignment[] = [];
  const seen = new Set<string>();
  const token = /p([1-9][0-9]*)r([1-9][0-9]*)/y;
  let offset = 0;
  while (offset < frames.length) {
    token.lastIndex = offset;
    const match = token.exec(frames);
    if (!match) return null;
    const placementId = match[1]!;
    const roleId = match[2]!;
    const domainPlacementId = placements.get(placementId);
    const role = roles.get(roleId);
    if (!domainPlacementId || !role || seen.has(placementId) || assignments.length >= definition.placements.length) {
      return null;
    }
    seen.add(placementId);
    assignments.push(Object.freeze({
      placementId: domainPlacementId,
      appearance: Object.freeze({ kind: 'role', role }),
    }));
    offset = token.lastIndex;
  }

  const rawLabel = text(row, 'grade_label');
  const gradeValue = Math.round(display);
  const providerClimbId = Object.freeze({
    provider: KILTER_PROVIDER_ID,
    sourceId: providerSourceId(uuid),
    layoutRevision: definition.layoutRevision,
  });
  const nativeGrades = Object.freeze({
    scale: 'kilter-difficulty', display, community, benchmark,
  });
  const statistics = Object.freeze({ ascentCount, quality });
  return Object.freeze({
    key: providerClimbViewKey(providerClimbId),
    name,
    angle,
    assignments: Object.freeze(assignments),
    origin: 'provider',
    ...(rawLabel?.trim() ? { grade: rawLabel } : {}),
    setter,
    description,
    providerClimbId,
    gradeValue,
    nativeGrades,
    statistics,
  });
}
