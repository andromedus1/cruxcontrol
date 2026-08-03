import type {
  BoardHoldAssignment,
  LightEffectGroup,
  LightEffectGroupId,
} from '../board-renderer/types';
import { packApiLevel3Color, unpackApiLevel3Color } from '../domain/boards/colors';
import type { BoardDefinition } from '../domain/boards/definition';
import type { LightScene } from '../domain/boards/light-scene';
import type { ApiLevel3Color, BoardPlacementId } from '../domain/boards/types';
import { renderSpatialGroup } from './spatial-frame';

export interface RenderAnimationFrameOptions {
  readonly definition: BoardDefinition;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly effectGroups: readonly LightEffectGroup[];
  readonly elapsedMs: number;
}

function positiveFraction(value: number): number {
  return ((value % 1) + 1) % 1;
}

function baseColor(definition: BoardDefinition, assignment: BoardHoldAssignment): ApiLevel3Color {
  return assignment.appearance.kind === 'custom'
    ? assignment.appearance.color
    : definition.rolePresets[assignment.appearance.role].lightColor;
}

function blend(
  from: ApiLevel3Color,
  to: ApiLevel3Color,
  amount: number,
): ApiLevel3Color {
  const start = unpackApiLevel3Color(from);
  const end = unpackApiLevel3Color(to);
  return packApiLevel3Color({
    red: Math.round(start.red + (end.red - start.red) * amount),
    green: Math.round(start.green + (end.green - start.green) * amount),
    blue: Math.round(start.blue + (end.blue - start.blue) * amount),
  });
}

function brightness(color: ApiLevel3Color, amount: number): ApiLevel3Color {
  const rgb = unpackApiLevel3Color(color);
  return packApiLevel3Color({
    red: Math.round(rgb.red * amount),
    green: Math.round(rgb.green * amount),
    blue: Math.round(rgb.blue * amount),
  });
}

function paletteColor(
  palette: readonly ApiLevel3Color[],
  phase: number,
): ApiLevel3Color | undefined {
  if (palette.length === 0) return undefined;
  if (palette.length === 1) return palette[0];
  const scaled = positiveFraction(phase) * palette.length;
  const index = Math.floor(scaled);
  const next = (index + 1) % palette.length;
  return blend(palette[index]!, palette[next]!, scaled - index);
}

function triangle(phase: number): number {
  return Math.abs(positiveFraction(phase) * 2 - 1);
}

function stablePhase(placementId: BoardPlacementId): number {
  let hash = 2166136261;
  for (const codePoint of placementId) {
    hash ^= codePoint.codePointAt(0)!;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

function effectColor(options: {
  readonly definition: BoardDefinition;
  readonly assignment: BoardHoldAssignment;
  readonly group: Exclude<LightEffectGroup, { readonly model: 'spatial' }>;
  readonly elapsedMs: number;
  readonly placementOrder: ReadonlyMap<BoardPlacementId, number>;
}): ApiLevel3Color {
  const { definition, assignment, group, elapsedMs, placementOrder } = options;
  const base = baseColor(definition, assignment);
  if (!Number.isFinite(group.periodMs) || group.periodMs <= 0) return base;
  const phase = positiveFraction(elapsedMs / group.periodMs);
  switch (group.kind) {
    case 'pulse':
      return brightness(base, 1 - group.intensity * (1 - triangle(phase)));
    case 'twinkle': {
      const twinklePhase = phase * 3 + stablePhase(assignment.placementId);
      return brightness(base, 1 - group.intensity * (1 - triangle(twinklePhase)));
    }
    case 'alternate': {
      const order = placementOrder.get(assignment.placementId) ?? 0;
      const alternatingPhase = phase + (order % 2 === 0 ? 0 : 0.5);
      return brightness(base, 1 - group.intensity * (1 - triangle(alternatingPhase)));
    }
    case 'color-cycle': {
      const animated = paletteColor(group.palette, phase);
      return animated === undefined ? base : blend(base, animated, group.intensity);
    }
    case 'wave': {
      const placement = definition.placements[placementOrder.get(assignment.placementId) ?? -1];
      const width = definition.bounds.right - definition.bounds.left;
      const positionPhase = placement && width > 0
        ? (placement.position.x - definition.bounds.left) / width
        : 0;
      const animated = paletteColor(group.palette, phase + positionPhase);
      return animated === undefined ? base : blend(base, animated, group.intensity);
    }
  }
}

export function renderAnimationFrame(options: RenderAnimationFrameOptions): LightScene {
  if (!Number.isFinite(options.elapsedMs)) {
    throw new RangeError('Animation elapsed time must be finite');
  }
  const groups = new Map<LightEffectGroupId, LightEffectGroup>(
    options.effectGroups.map((group) => [group.id, group]),
  );
  const placementOrder = new Map(
    options.definition.placements.map((placement, index) => [placement.id, index]),
  );
  const assigned = options.assignments.map((assignment) => {
      const candidate = assignment.effectGroupId === undefined
        ? undefined
        : groups.get(assignment.effectGroupId);
      const group = candidate?.model === 'spatial' ? undefined : candidate;
      return Object.freeze({
        placementId: assignment.placementId,
        color: group
          ? effectColor({
              definition: options.definition,
              assignment,
              group,
              elapsedMs: options.elapsedMs,
              placementOrder,
            })
          : baseColor(options.definition, assignment),
      });
    });
  const composed = new Map(assigned.map((light) => [light.placementId, light]));
  for (const group of options.effectGroups) {
    if (group.model !== 'spatial') continue;
    for (const light of renderSpatialGroup(options.definition, options.assignments, group, options.elapsedMs)) composed.set(light.placementId, light);
  }
  // Semantic route roles are exact and topmost regardless of spatial layer order.
  for (const assignment of options.assignments) if (assignment.appearance.kind === 'role') composed.set(assignment.placementId, Object.freeze({ placementId: assignment.placementId, color: baseColor(options.definition, assignment) }));
  return Object.freeze([...composed.values()]);
}
