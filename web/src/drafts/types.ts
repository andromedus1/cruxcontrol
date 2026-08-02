import type { BoardHoldAssignment } from '../board-renderer/types.ts';
import type { BoardDefinitionId, Brand, LayoutRevisionId } from '../domain/boards/types.ts';
import type { BoardInstallationId } from '../installations/contracts.ts';

export type LocalDraftId = Brand<string, 'LocalDraftId'>;
export type DraftRevision = Brand<number, 'DraftRevision'>;
export const LOCAL_DRAFT_SCHEMA_VERSION = 1 as const;

export interface DraftMetadata {
  readonly grade?: string;
  readonly description?: string;
  readonly setterNotes?: string;
}

export interface LocalClimbDraft {
  readonly schemaVersion: typeof LOCAL_DRAFT_SCHEMA_VERSION;
  readonly id: LocalDraftId;
  readonly revision: DraftRevision;
  readonly installationId: BoardInstallationId;
  readonly definitionId: BoardDefinitionId;
  readonly layoutRevision: LayoutRevisionId;
  readonly name: string;
  readonly angle: number;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly metadata: Readonly<DraftMetadata>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DraftContent {
  readonly installationId: BoardInstallationId;
  readonly definitionId: BoardDefinitionId;
  readonly layoutRevision: LayoutRevisionId;
  readonly name: string;
  readonly angle: number;
  readonly assignments: readonly BoardHoldAssignment[];
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
