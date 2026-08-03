import type { BoardHoldAssignment, LightEffectGroup } from '../board-renderer/types.ts';
import type { BoardDefinitionId, Brand, LayoutRevisionId } from '../domain/boards/types.ts';
import type { BoardInstallationId } from '../installations/contracts.ts';

export type LocalDraftId = Brand<string, 'LocalDraftId'>;
export type DraftRevision = Brand<number, 'DraftRevision'>;
export type LocalClimbStatus = 'draft' | 'finished';
export const LOCAL_DRAFT_SCHEMA_VERSION = 4 as const;

export interface DraftMetadata {
  readonly grade?: string;
  readonly description?: string;
  readonly setterNotes?: string;
}

export interface LocalClimbDraft {
  /** Repositories/codecs normalize persisted records to v4; older literals remain readable. */
  readonly schemaVersion: 1 | 2 | 3 | typeof LOCAL_DRAFT_SCHEMA_VERSION;
  readonly id: LocalDraftId;
  readonly revision: DraftRevision;
  readonly status: LocalClimbStatus;
  readonly trashedAt?: string;
  readonly installationId: BoardInstallationId;
  readonly definitionId: BoardDefinitionId;
  readonly layoutRevision: LayoutRevisionId;
  readonly name: string;
  readonly angle: number;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly effectGroups: readonly LightEffectGroup[];
  readonly metadata: Readonly<DraftMetadata>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DraftContent {
  readonly status: LocalClimbStatus;
  readonly installationId: BoardInstallationId;
  readonly definitionId: BoardDefinitionId;
  readonly layoutRevision: LayoutRevisionId;
  readonly name: string;
  readonly angle: number;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly effectGroups: readonly LightEffectGroup[];
  readonly metadata?: Readonly<DraftMetadata>;
}

export interface StoredDraftV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly revision: number;
  readonly installationId: string;
  readonly definitionId: string;
  readonly layoutRevision: string;
  readonly name: string;
  readonly angle: number;
  readonly assignments: readonly {
    readonly placementId: string;
    readonly appearance:
      | { readonly kind: 'role'; readonly role: 'start' | 'middle' | 'finish' | 'foot-only' }
      | { readonly kind: 'custom'; readonly color: number };
  }[];
  readonly metadata: {
    readonly grade?: string;
    readonly description?: string;
    readonly setterNotes?: string;
  };
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updatedOrder: readonly [string, string];
}

export interface StoredDraftV2 {
  readonly schemaVersion: 2;
  readonly id: string;
  readonly revision: number;
  readonly installationId: string;
  readonly definitionId: string;
  readonly layoutRevision: string;
  readonly name: string;
  readonly angle: number;
  readonly assignments: readonly {
    readonly placementId: string;
    readonly appearance:
      | { readonly kind: 'role'; readonly role: 'start' | 'middle' | 'finish' | 'foot-only' }
      | { readonly kind: 'custom'; readonly color: number };
    readonly effectGroupId?: string;
  }[];
  readonly effectGroups: readonly {
    readonly id: string;
    readonly kind: 'pulse' | 'color-cycle' | 'wave' | 'twinkle' | 'alternate';
    readonly palette: readonly number[];
    readonly periodMs: number;
    readonly intensity: number;
  }[];
  readonly metadata: StoredDraftV1['metadata'];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updatedOrder: readonly [string, string];
}

export interface StoredDraftV3 extends Omit<StoredDraftV2, 'schemaVersion'> {
  readonly schemaVersion: 3;
  readonly status: LocalClimbStatus;
  readonly trashedAt?: string;
}

export interface StoredDraftV4 extends Omit<StoredDraftV3, 'schemaVersion' | 'effectGroups'> {
  readonly schemaVersion: 4;
  readonly effectGroups: readonly unknown[];
}
