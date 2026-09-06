import type { BoardDefinition } from '../domain/boards/definition';
import type { BoardPlacementId } from '../domain/boards/types';

/**
 * Normalized geometry used by spatial recipes. The definition is immutable for
 * the lifetime of a board installation, so this object is safe to retain in a
 * WeakMap keyed by the definition identity.
 */
export interface SpatialPoint {
  readonly id: BoardPlacementId;
  readonly order: number;
  readonly x: number;
  readonly y: number;
}

export interface PreparedSpatialGeometry {
  readonly points: readonly SpatialPoint[];
  readonly byId: ReadonlyMap<BoardPlacementId, SpatialPoint>;
  readonly neighbors: ReadonlyMap<BoardPlacementId, readonly SpatialPoint[]>;
}

function nearestInDirection(
  point: SpatialPoint,
  points: readonly SpatialPoint[],
  direction: 'up' | 'right' | 'down' | 'left',
): SpatialPoint | undefined {
  const matches = points.filter((candidate) => {
    if (candidate.id === point.id) return false;
    if (direction === 'up') return candidate.x === point.x && candidate.y > point.y;
    if (direction === 'right') return candidate.y === point.y && candidate.x > point.x;
    if (direction === 'down') return candidate.x === point.x && candidate.y < point.y;
    return candidate.y === point.y && candidate.x < point.x;
  });
  return matches
    .sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y) || a.order - b.order)[0];
}

export function prepareSpatialGeometry(definition: BoardDefinition): PreparedSpatialGeometry {
  const width = definition.bounds.right - definition.bounds.left || 1;
  const height = definition.bounds.top - definition.bounds.bottom || 1;
  const points = Object.freeze(definition.placements.map((placement, order) => Object.freeze({
    id: placement.id,
    order,
    x: (placement.position.x - definition.bounds.left) / width,
    y: (placement.position.y - definition.bounds.bottom) / height,
  })));
  const byId = new Map(points.map((point) => [point.id, point] as const));
  const directions: readonly ('up' | 'right' | 'down' | 'left')[] = ['up', 'right', 'down', 'left'];
  const neighbors = new Map<BoardPlacementId, readonly SpatialPoint[]>();
  for (const point of points) {
    neighbors.set(point.id, Object.freeze(directions
      .map((direction) => nearestInDirection(point, points, direction))
      .filter((neighbor): neighbor is SpatialPoint => neighbor !== undefined)));
  }
  return Object.freeze({ points, byId, neighbors });
}
