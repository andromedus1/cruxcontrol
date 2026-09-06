import { decodeStoredDraft, encodeStoredDraft } from '../drafts/codec.ts';
import { DRAFT_STORE_NAME } from '../drafts/open-draft-database.ts';
import { decodeStoredPlaylist, encodeStoredPlaylist } from '../playlists/codec.ts';
import { PLAYLIST_STORE_NAME } from '../playlists/open-playlist-database.ts';
import type { LocalClimbDraft } from '../drafts/types.ts';
import type { LocalPlaylist } from '../playlists/types.ts';
import { canonicalDraft, canonicalPlaylist } from './codec.ts';
import {
  BackupConflictError,
  LibraryBackupStorageError,
  type BackupConflict,
  type LibraryBackupStore,
  type RestoreBatchResult,
} from './types.ts';

function storageError(message: string, cause: unknown): LibraryBackupStorageError {
  return cause instanceof LibraryBackupStorageError
    ? cause
    : new LibraryBackupStorageError(message, { cause });
}

type RecordWithId = Readonly<{ id: string }>;

function readAll<T>(
  database: IDBDatabase,
  storeName: string,
  decode: (value: unknown) => T,
  label: string,
): Promise<readonly T[]> {
  let transaction: IDBTransaction;
  let request: IDBRequest<IDBCursorWithValue | null>;
  try {
    transaction = database.transaction(storeName, 'readonly');
    request = transaction.objectStore(storeName).openCursor();
  } catch (cause) {
    return Promise.reject(storageError(`Could not read ${label}`, cause));
  }
  const values: T[] = [];
  let semanticError: unknown;
  let settled = false;
  return new Promise((resolve, reject) => {
    const abort = (cause: unknown) => {
      if (semanticError === undefined) semanticError = cause;
      try {
        transaction.abort();
      } catch {
        // An IDB request can abort the transaction before this callback runs.
      }
    };
    request.onerror = () => abort(storageError(`Could not read ${label}`, request.error));
    request.onsuccess = () => {
      if (settled) return;
      const cursor = request.result;
      if (!cursor) return;
      try {
        values.push(decode(cursor.value));
        cursor.continue();
      } catch (cause) {
        abort(cause);
      }
    };
    transaction.oncomplete = () => {
      settled = true;
      resolve(Object.freeze(values));
    };
    transaction.onabort = () => {
      settled = true;
      reject(semanticError ?? storageError(`Could not read ${label}`, transaction.error));
    };
    transaction.onerror = () => {
      // The request handler owns semantic errors; transaction.onerror is only
      // useful when an implementation aborts without a request callback.
      if (semanticError === undefined && transaction.error) {
        semanticError = storageError(`Could not read ${label}`, transaction.error);
      }
    };
  });
}

function restoreAll<T extends RecordWithId>(
  database: IDBDatabase,
  storeName: string,
  records: readonly T[],
  encode: (record: T) => unknown,
  decode: (value: unknown) => T,
  canonical: (record: T) => string,
  kind: BackupConflict['kind'],
  label: string,
): Promise<RestoreBatchResult> {
  const encoded: unknown[] = [];
  const ids = new Set<string>();
  try {
    records.forEach((record) => {
      if (ids.has(record.id)) throw new Error(`Duplicate ${kind} ID ${record.id}`);
      ids.add(record.id);
      // Validate the full payload before opening a write transaction.
      encoded.push(encode(decode(encode(record))));
    });
  } catch (cause) {
    return Promise.reject(cause instanceof Error ? cause : new Error(String(cause)));
  }

  let transaction: IDBTransaction;
  let store: IDBObjectStore;
  try {
    transaction = database.transaction(storeName, 'readwrite');
    store = transaction.objectStore(storeName);
  } catch (cause) {
    return Promise.reject(storageError(`Could not restore ${label}`, cause));
  }
  let added = 0;
  let unchanged = 0;
  let semanticError: unknown;
  let settled = false;
  return new Promise((resolve, reject) => {
    const abort = (cause: unknown) => {
      if (semanticError === undefined) semanticError = cause;
      try {
        transaction.abort();
      } catch {
        // The transaction may already have been aborted by IndexedDB.
      }
    };

    // Queue every read before processing any result. All reads and adds are
    // part of this one transaction; no unrelated promise is awaited inside it.
    records.forEach((record, index) => {
      let request: IDBRequest<unknown>;
      try {
        request = store.get(record.id);
      } catch (cause) {
        abort(storageError(`Could not restore ${label}`, cause));
        return;
      }
      request.onerror = (event) => {
        event.preventDefault();
        abort(storageError(`Could not restore ${label}`, request.error));
      };
      request.onsuccess = () => {
        if (settled || semanticError !== undefined) return;
        try {
          if (request.result === undefined) {
            const addRequest = store.add(encoded[index]!);
            addRequest.onerror = (event) => {
              event.preventDefault();
              abort(storageError(`Could not restore ${label}`, addRequest.error));
            };
            added += 1;
            return;
          }
          const current = decode(request.result);
          if (canonical(current) === canonical(record)) {
            unchanged += 1;
            return;
          }
          abort(
            new BackupConflictError([
              { kind, id: record.id as never, name: recordName(record) },
            ]),
          );
        } catch (cause) {
          abort(cause);
        }
      };
    });
    transaction.oncomplete = () => {
      settled = true;
      resolve({ added, unchanged });
    };
    transaction.onabort = () => {
      settled = true;
      reject(semanticError ?? storageError(`Could not restore ${label}`, transaction.error));
    };
    transaction.onerror = () => {
      if (semanticError === undefined && transaction.error) {
        semanticError = storageError(`Could not restore ${label}`, transaction.error);
      }
    };
  });
}

function recordName(record: RecordWithId): string {
  const value = record as Record<string, unknown>;
  return typeof value.name === 'string' && value.name.trim() ? value.name : 'Untitled record';
}

export class IndexedDbLibraryBackupStore implements LibraryBackupStore {
  readonly #drafts: IDBDatabase;
  readonly #playlists: IDBDatabase;

  constructor(drafts: IDBDatabase, playlists: IDBDatabase) {
    this.#drafts = drafts;
    this.#playlists = playlists;
  }

  readDrafts(): Promise<readonly LocalClimbDraft[]> {
    return readAll(this.#drafts, DRAFT_STORE_NAME, decodeStoredDraft, 'local climbs');
  }

  readPlaylists(): Promise<readonly LocalPlaylist[]> {
    return readAll(this.#playlists, PLAYLIST_STORE_NAME, decodeStoredPlaylist, 'playlists');
  }

  restoreMissingDrafts(records: readonly LocalClimbDraft[]): Promise<RestoreBatchResult> {
    return restoreAll(
      this.#drafts,
      DRAFT_STORE_NAME,
      records,
      encodeStoredDraft,
      decodeStoredDraft,
      canonicalDraft,
      'climb',
      'local climbs',
    );
  }

  restoreMissingPlaylists(records: readonly LocalPlaylist[]): Promise<RestoreBatchResult> {
    return restoreAll(
      this.#playlists,
      PLAYLIST_STORE_NAME,
      records,
      encodeStoredPlaylist,
      decodeStoredPlaylist,
      canonicalPlaylist,
      'playlist',
      'playlists',
    );
  }
}
