import type { ApiLevel3Color, BoardPlacementId } from '../domain/boards/types';
import type { ClimbRole } from '../domain/boards/definition';

export type BoardHoldAppearance =
  | { readonly kind: 'role'; readonly role: ClimbRole }
  | { readonly kind: 'custom'; readonly color: ApiLevel3Color };

export interface BoardHoldAssignment {
  readonly placementId: BoardPlacementId;
  readonly appearance: BoardHoldAppearance;
}

export type BoardDirection = 'up' | 'right' | 'down' | 'left';
