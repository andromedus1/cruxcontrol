import type { LocalDraftId } from '../drafts/types.ts';
import type { Brand, ProviderClimbId } from '../domain/boards/types.ts';

export type PlaylistId = Brand<string, 'PlaylistId'>;
export type PlaylistRevision = Brand<number, 'PlaylistRevision'>;
export const LOCAL_PLAYLIST_SCHEMA_VERSION = 1 as const;

export type PlaylistClimbReference =
  | Readonly<{ kind: 'local'; id: LocalDraftId }>
  | Readonly<{ kind: 'provider'; id: ProviderClimbId }>;

export interface PlaylistContent {
  readonly name: string;
  readonly notes: string;
  readonly entries: readonly PlaylistClimbReference[];
}

export interface LocalPlaylist extends PlaylistContent {
  readonly schemaVersion: typeof LOCAL_PLAYLIST_SCHEMA_VERSION;
  readonly id: PlaylistId;
  readonly revision: PlaylistRevision;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StoredPlaylistV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly revision: number;
  readonly name: string;
  readonly notes: string;
  readonly entries: readonly (
    | Readonly<{ kind: 'local'; id: string }>
    | Readonly<{
        kind: 'provider';
        id: Readonly<{ provider: string; sourceId: string; layoutRevision: string }>;
      }>
  )[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updatedOrder: readonly [string, string];
}
