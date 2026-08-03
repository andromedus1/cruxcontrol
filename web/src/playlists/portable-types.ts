import type { BoardHoldAssignment, LightEffectGroup } from '../board-renderer/types.ts';
import type { DraftMetadata, LocalClimbStatus } from '../drafts/types.ts';
import type {
  BoardDefinitionId,
  LayoutRevisionId,
  ProviderClimbId,
} from '../domain/boards/types.ts';

export const PORTABLE_PLAYLIST_FORMAT = 'cruxcontrol-playlist' as const;
export const PORTABLE_PLAYLIST_SCHEMA_VERSION = 2 as const;
export const MAX_PORTABLE_PLAYLIST_BYTES = 1024 * 1024;

/** Bounds applied before recursive decoding of untrusted portable payloads. */
export const PORTABLE_PLAYLIST_LIMITS = Object.freeze({
  bytes: MAX_PORTABLE_PLAYLIST_BYTES,
  entries: 2_000,
  assignmentsPerClimb: 2_048,
  effectGroupsPerClimb: 256,
  stringCodeUnits: 65_536,
});

export interface PortableClimbSnapshotV1 {
  readonly status: LocalClimbStatus;
  readonly definitionId: BoardDefinitionId;
  readonly layoutRevision: LayoutRevisionId;
  readonly name: string;
  readonly angle: number;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly effectGroups: readonly LightEffectGroup[];
  readonly metadata: Readonly<DraftMetadata>;
}

export type PortablePlaylistEntryV1 =
  | Readonly<{ kind: 'local-snapshot'; snapshot: PortableClimbSnapshotV1 }>
  | Readonly<{ kind: 'provider'; id: ProviderClimbId }>;

export interface PortablePlaylistV1 {
  readonly format: typeof PORTABLE_PLAYLIST_FORMAT;
  readonly schemaVersion: 1 | typeof PORTABLE_PLAYLIST_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly playlist: Readonly<{
    name: string;
    notes: string;
    entries: readonly PortablePlaylistEntryV1[];
  }>;
}

export type PortableClimbSnapshotV2 = PortableClimbSnapshotV1;
export type PortablePlaylistEntryV2 = PortablePlaylistEntryV1;
export type PortablePlaylistV2 = PortablePlaylistV1 & { readonly schemaVersion: 2 };
