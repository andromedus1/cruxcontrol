import type {
  ApiLevel3Color,
  BoardDefinitionId,
  BoardPlacementId,
  LayoutRevisionId,
  ProviderId,
  ProviderSourceId,
} from './types';

export type ClimbRole = 'start' | 'middle' | 'finish' | 'foot-only';
export interface BoardPoint {
  readonly x: number;
  readonly y: number;
}
export interface BoardBounds {
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly top: number;
}
export interface NativePlacementIdentity {
  readonly provider: ProviderId;
  readonly productId: ProviderSourceId;
  readonly layoutId: ProviderSourceId;
  readonly productSizeId: ProviderSourceId;
  readonly setId: ProviderSourceId;
  readonly placementId: ProviderSourceId;
  readonly holeId: ProviderSourceId;
  readonly ledPosition: number;
}
export interface BoardPlacementDefinition {
  readonly id: BoardPlacementId;
  readonly position: BoardPoint;
  readonly native: NativePlacementIdentity;
}
export interface RolePreset {
  readonly role: ClimbRole;
  readonly label: string;
  readonly sourceRoleId: ProviderSourceId;
  readonly lightColor: ApiLevel3Color;
  readonly screenColor: `#${string}`;
}
export interface BoardDefinition {
  readonly id: BoardDefinitionId;
  readonly layoutRevision: LayoutRevisionId;
  readonly manufacturer: string;
  readonly model: string;
  readonly layout: string;
  readonly size: string;
  readonly bounds: BoardBounds;
  readonly supportedAngles: readonly number[];
  readonly placements: readonly BoardPlacementDefinition[];
  readonly rolePresets: Readonly<Record<ClimbRole, RolePreset>>;
}
export type DefinitionValidationCode =
  | 'invalid-bounds'
  | 'invalid-coordinate'
  | 'invalid-angle'
  | 'duplicate-angle'
  | 'duplicate-domain-placement-id'
  | 'duplicate-placement-id'
  | 'duplicate-hole-id'
  | 'duplicate-led-position'
  | 'native-scope-mismatch'
  | 'missing-role'
  | 'unknown-source-role'
  | 'duplicate-source-role';
export interface DefinitionValidationIssue {
  readonly path: string;
  readonly code: DefinitionValidationCode;
  readonly message: string;
}
