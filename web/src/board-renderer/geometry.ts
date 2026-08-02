import type { BoardDefinition, BoardPoint } from '../domain/boards/definition';
import type { BoardPlacementId } from '../domain/boards/types';
import type { BoardDirection } from './types';

export interface BoardTransform {
  readonly viewBox: Readonly<{ x: number; y: number; width: number; height: number }>;
  toSvg(point: BoardPoint): BoardPoint;
  toBoard(point: BoardPoint): BoardPoint;
}

const spacingCache = new WeakMap<BoardDefinition, number>();

export function createBoardTransform(definition: BoardDefinition, gutter = 4): BoardTransform {
  if (!Number.isFinite(gutter) || gutter < 0) {
    throw new RangeError('Board gutter must be a finite non-negative number');
  }
  const { left, right, bottom, top } = definition.bounds;
  const width = right - left;
  const height = top - bottom;
  const viewBox = { x: 0, y: 0, width: width + gutter * 2, height: height + gutter * 2 };
  return {
    viewBox,
    toSvg: ({ x, y }) => ({ x: x - left + gutter, y: top - y + gutter }),
    toBoard: ({ x, y }) => ({ x: x + left - gutter, y: top + gutter - y }),
  };
}

function minimumSpacing(definition: BoardDefinition): number {
  const cached = spacingCache.get(definition);
  if (cached !== undefined) return cached;
  let minimum = Number.POSITIVE_INFINITY;
  for (let a = 0; a < definition.placements.length; a += 1) {
    for (let b = a + 1; b < definition.placements.length; b += 1) {
      const first = definition.placements[a].position;
      const second = definition.placements[b].position;
      minimum = Math.min(minimum, Math.hypot(first.x - second.x, first.y - second.y));
    }
  }
  spacingCache.set(definition, minimum);
  return minimum;
}

export function nearestPlacement(
  definition: BoardDefinition,
  point: BoardPoint,
): BoardPlacementId | null {
  let nearest: BoardPlacementId | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const placement of definition.placements) {
    const candidate = Math.hypot(placement.position.x - point.x, placement.position.y - point.y);
    if (candidate < distance) {
      nearest = placement.id;
      distance = candidate;
    }
  }
  return distance <= minimumSpacing(definition) * 0.52 ? nearest : null;
}

export function placementInDirection(
  definition: BoardDefinition,
  from: BoardPlacementId,
  direction: BoardDirection,
): BoardPlacementId {
  const origin = definition.placements.find((placement) => placement.id === from);
  if (!origin) throw new RangeError(`Unknown placement: ${from}`);
  const axis = direction === 'left' || direction === 'right' ? 'x' : 'y';
  const sign = direction === 'left' || direction === 'down' ? -1 : 1;
  const candidates = definition.placements
    .filter((placement) => (placement.position[axis] - origin.position[axis]) * sign > 0)
    .map((placement) => {
      const dx = placement.position.x - origin.position.x;
      const dy = placement.position.y - origin.position.y;
      const forward = axis === 'x' ? Math.abs(dx) : Math.abs(dy);
      const perpendicular = axis === 'x' ? Math.abs(dy) : Math.abs(dx);
      return { placement, alignment: perpendicular / forward, distance: Math.hypot(dx, dy) };
    })
    .sort((a, b) => a.alignment - b.alignment || a.distance - b.distance);
  return candidates[0]?.placement.id ?? from;
}
