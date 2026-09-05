import type { LocalClimbDraft, LocalDraftId } from '../drafts/types.ts';
import type { StoredDraftV4 } from '../drafts/types.ts';
import type { LocalPlaylist, PlaylistId } from '../playlists/types.ts';
import type { StoredPlaylistV1 } from '../playlists/types.ts';

export interface LibrarySnapshot {
  readonly drafts: readonly LocalClimbDraft[];
  readonly playlists: readonly LocalPlaylist[];
}

export interface RestoreBatchResult {
  readonly added: number;
  readonly unchanged: number;
}

export interface LibraryBackupStore {
  readDrafts(): Promise<readonly LocalClimbDraft[]>;
  readPlaylists(): Promise<readonly LocalPlaylist[]>;
  restoreMissingDrafts(records: readonly LocalClimbDraft[]): Promise<RestoreBatchResult>;
  restoreMissingPlaylists(records: readonly LocalPlaylist[]): Promise<RestoreBatchResult>;
}

export type BackupConflict =
  | Readonly<{ kind: 'climb'; id: LocalDraftId; name: string }>
  | Readonly<{ kind: 'playlist'; id: PlaylistId; name: string }>;

export class BackupConflictError extends Error {
  readonly conflicts: readonly BackupConflict[];

  constructor(conflicts: readonly BackupConflict[]) {
    super(
      conflicts.length === 1
        ? `A saved ${conflicts[0]!.kind} conflicts with the backup`
        : `${conflicts.length} saved records conflict with the backup`,
    );
    this.name = 'BackupConflictError';
    this.conflicts = conflicts;
  }
}

export class LibraryBackupStorageError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = 'LibraryBackupStorageError';
    this.cause = options?.cause;
  }
}

export interface LibraryBackupV1 {
  readonly format: 'cruxcontrol-library-backup';
  readonly version: 1;
  readonly exportedAt: string;
  readonly drafts: readonly StoredDraftV4[];
  readonly playlists: readonly StoredPlaylistV1[];
}

export interface DecodedLibraryBackup extends LibrarySnapshot {
  readonly exportedAt: string;
}

export interface BackupReview {
  readonly add: Readonly<{ climbs: number; playlists: number }>;
  readonly unchanged: Readonly<{ climbs: number; playlists: number }>;
  readonly conflicts: readonly BackupConflict[];
  readonly trashClimbs: number;
  readonly unavailableLocalReferences: number;
}
