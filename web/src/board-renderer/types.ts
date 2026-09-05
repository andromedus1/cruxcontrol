import type { ApiLevel3Color, BoardPlacementId, Brand } from '../domain/boards/types';
import type { ClimbRole } from '../domain/boards/definition';

export type BoardHoldAppearance =
  | { readonly kind: 'role'; readonly role: ClimbRole }
  | { readonly kind: 'custom'; readonly color: ApiLevel3Color };

export type LightEffectKind = 'pulse' | 'color-cycle' | 'wave' | 'twinkle' | 'alternate';
export type LightEffectGroupId = Brand<string, 'LightEffectGroupId'>;
export const LIGHT_EFFECT_PERIOD_MIN_MS = 250;
export const LIGHT_EFFECT_PERIOD_MAX_MS = 180_000;

export interface AssignedLightEffectGroup {
  /** Omitted only by in-memory legacy callers; codecs always materialize `assigned`. */
  readonly model?: 'assigned';
  readonly id: LightEffectGroupId;
  readonly kind: LightEffectKind;
  readonly palette: readonly ApiLevel3Color[];
  readonly periodMs: number;
  readonly intensity: number;
}

export type SpatialEffectKind =
  | 'ocean-tide' | 'tie-dye-spiral' | 'matrix-rain' | 'snake'
  | 'beach-ball' | 'pac-man' | 'pong' | 'bird-flock' | 'frogger' | 'pentagram';

export type SpatialRecipe =
  | { readonly kind: 'ocean-tide'; readonly direction: 'in' | 'out'; readonly foam: number }
  | { readonly kind: 'tie-dye-spiral'; readonly direction: 'clockwise' | 'counterclockwise'; readonly arms: 2 | 3 | 4 }
  | { readonly kind: 'matrix-rain'; readonly direction: 'down' | 'up'; readonly columns: number }
  | { readonly kind: 'snake'; readonly direction: 'forward' | 'reverse'; readonly bodyLength: number }
  | { readonly kind: 'beach-ball'; readonly velocityX: number; readonly velocityY: number; readonly size: number }
  | { readonly kind: 'pac-man'; readonly direction: 'forward' | 'reverse'; readonly mouthBeat: number }
  | { readonly kind: 'pong'; readonly direction: 'forward' | 'reverse'; readonly paddleSize: number }
  | { readonly kind: 'bird-flock'; readonly direction: 'left' | 'right'; readonly quietFraction: number }
  | { readonly kind: 'frogger'; readonly lanes: number }
  | { readonly kind: 'pentagram'; readonly fadeRate: number };

export interface SpatialEffectTarget {
  readonly scope: 'unused' | 'background-board' | 'selected';
  readonly include: readonly BoardPlacementId[];
  readonly exclude: readonly BoardPlacementId[];
}

export interface SpatialLightEffectGroup {
  readonly model: 'spatial';
  readonly id: LightEffectGroupId;
  /** Version 1 is the historical renderer; version 2 is the explicit seamless-loop upgrade. */
  readonly recipeVersion: 1 | 2;
  readonly recipe: SpatialRecipe;
  readonly seed: number;
  readonly palette: readonly ApiLevel3Color[];
  readonly periodMs: number;
  readonly intensity: number;
  readonly footprint: number;
  readonly target: SpatialEffectTarget;
}

export type LightEffectGroup = AssignedLightEffectGroup | SpatialLightEffectGroup;

export function lightEffectGroupId(value: string): LightEffectGroupId {
  if (value.length === 0) throw new TypeError('Light effect group ID must not be empty');
  return value as LightEffectGroupId;
}

export interface BoardHoldAssignment {
  readonly placementId: BoardPlacementId;
  readonly appearance: BoardHoldAppearance;
  readonly effectGroupId?: LightEffectGroupId;
}

export type BoardDirection = 'up' | 'right' | 'down' | 'left';
