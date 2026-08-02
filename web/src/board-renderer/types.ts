import type { ApiLevel3Color, BoardPlacementId, Brand } from '../domain/boards/types';
import type { ClimbRole } from '../domain/boards/definition';

export type BoardHoldAppearance =
  | { readonly kind: 'role'; readonly role: ClimbRole }
  | { readonly kind: 'custom'; readonly color: ApiLevel3Color };

export type LightEffectKind = 'pulse' | 'color-cycle' | 'wave' | 'twinkle' | 'alternate';
export type LightEffectGroupId = Brand<string, 'LightEffectGroupId'>;

export interface LightEffectGroup {
  readonly id: LightEffectGroupId;
  readonly kind: LightEffectKind;
  readonly palette: readonly ApiLevel3Color[];
  readonly periodMs: number;
  readonly intensity: number;
}

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
