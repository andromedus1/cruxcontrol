import {
  canonicalSnapshot,
  encodeLibraryBackup,
  reviewLibraryBackup,
} from './codec.ts';
import type {
  BackupReview,
  DecodedLibraryBackup,
  LibraryBackupStore,
  LibrarySnapshot,
  RestoreBatchResult,
} from './types.ts';

export type LibraryRestoreOutcome =
  | Readonly<{
      status: 'complete';
      drafts: RestoreBatchResult;
      playlists: RestoreBatchResult;
    }>
  | Readonly<{ status: 'blocked'; review: BackupReview }>
  | Readonly<{
      status: 'failed';
      phase: 'preflight' | 'drafts' | 'playlists';
      drafts: RestoreBatchResult | null;
      error: Error;
    }>;

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

function filename(date: Date): string {
  return `cruxcontrol-library-${date.toISOString().slice(0, 10)}.json`;
}

export class LibraryBackupService {
  readonly #store: LibraryBackupStore;
  readonly #now: () => Date;

  constructor(store: LibraryBackupStore, now: () => Date = () => new Date()) {
    this.#store = store;
    this.#now = now;
  }

  async #readSnapshot(): Promise<LibrarySnapshot> {
    const [drafts, playlists] = await Promise.all([
      this.#store.readDrafts(),
      this.#store.readPlaylists(),
    ]);
    return { drafts, playlists };
  }

  async exportFile(): Promise<Readonly<{ filename: string; text: string }>> {
    let stable: LibrarySnapshot | null = null;
    // Two reads of each independent store form one bounded stability attempt.
    // A second attempt is intentionally the limit: this is not a cross-DB lock.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const first = await this.#readSnapshot();
      const second = await this.#readSnapshot();
      if (canonicalSnapshot(first) === canonicalSnapshot(second)) {
        stable = second;
        break;
      }
    }
    if (!stable) {
      throw new Error(
        'Library changed while preparing the backup. Finish editing in other tabs and retry.',
      );
    }
    const exportedAt = this.#now();
    return Object.freeze({
      filename: filename(exportedAt),
      text: encodeLibraryBackup(stable, exportedAt),
    });
  }

  async review(backup: DecodedLibraryBackup): Promise<BackupReview> {
    return reviewLibraryBackup(backup, await this.#readSnapshot());
  }

  async restore(backup: DecodedLibraryBackup): Promise<LibraryRestoreOutcome> {
    let review: BackupReview;
    try {
      review = reviewLibraryBackup(backup, await this.#readSnapshot());
    } catch (cause) {
      return { status: 'failed', phase: 'preflight', drafts: null, error: asError(cause) };
    }
    if (review.conflicts.length > 0) return { status: 'blocked', review };

    let drafts: RestoreBatchResult;
    try {
      // Pass the complete batch so the transaction revalidates unchanged rows
      // and absent rows after the UI review.
      drafts = await this.#store.restoreMissingDrafts(backup.drafts);
    } catch (cause) {
      return { status: 'failed', phase: 'drafts', drafts: null, error: asError(cause) };
    }
    try {
      const playlists = await this.#store.restoreMissingPlaylists(backup.playlists);
      return { status: 'complete', drafts, playlists };
    } catch (cause) {
      return { status: 'failed', phase: 'playlists', drafts, error: asError(cause) };
    }
  }
}
