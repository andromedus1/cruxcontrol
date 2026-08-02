import {
  decodeStoredPlaylist,
  encodeStoredPlaylist,
  playlistId,
  playlistRevision,
} from './codec.ts';
import {
  PlaylistConflictError,
  PlaylistNotFoundError,
  PlaylistRepositoryError,
  translatePlaylistStorageError,
} from './errors.ts';
import { PLAYLIST_STORE_NAME, PLAYLIST_UPDATED_ORDER_INDEX } from './open-playlist-database.ts';
import type { LocalPlaylistRepository, PlaylistRepositoryOptions } from './repository.ts';
import {
  LOCAL_PLAYLIST_SCHEMA_VERSION,
  type LocalPlaylist,
  type PlaylistContent,
  type PlaylistId,
  type PlaylistRevision,
} from './types.ts';

function transactionError(transaction: IDBTransaction, message: string): PlaylistRepositoryError {
  return translatePlaylistStorageError(transaction.error, message);
}

function requestResult<T>(request: IDBRequest<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(translatePlaylistStorageError(request.error, message));
  });
}

function playlistFrom(
  content: PlaylistContent,
  identity: Readonly<{
    id: PlaylistId;
    revision: PlaylistRevision;
    createdAt: string;
    updatedAt: string;
  }>,
): LocalPlaylist {
  return decodeStoredPlaylist({
    schemaVersion: LOCAL_PLAYLIST_SCHEMA_VERSION,
    id: identity.id,
    revision: identity.revision,
    name: content.name,
    notes: content.notes,
    entries: content.entries,
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
    updatedOrder: [identity.updatedAt, identity.id],
  });
}

export class IndexedDbLocalPlaylistRepository implements LocalPlaylistRepository {
  readonly #database: IDBDatabase;
  readonly #now: () => Date;
  readonly #createId: () => string;
  readonly #usesDefaultIdSource: boolean;

  constructor(database: IDBDatabase, options: PlaylistRepositoryOptions = {}) {
    this.#database = database;
    this.#now = options.now ?? (() => new Date());
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#usesDefaultIdSource = options.createId === undefined;
  }

  async create(content: PlaylistContent): Promise<LocalPlaylist> {
    const attempts = this.#usesDefaultIdSource ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const timestamp = this.#now().toISOString();
      const id = playlistId(this.#createId());
      const playlist = playlistFrom(content, {
        id,
        revision: playlistRevision(1),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      try {
        await this.#add(playlist);
        return playlist;
      } catch (error) {
        if (!(error instanceof PlaylistConflictError) || attempt === attempts - 1) throw error;
      }
    }
    throw new PlaylistRepositoryError('unavailable', 'Could not allocate a local playlist ID');
  }

  #add(playlist: LocalPlaylist): Promise<void> {
    let transaction: IDBTransaction;
    let request: IDBRequest<IDBValidKey>;
    try {
      transaction = this.#database.transaction(PLAYLIST_STORE_NAME, 'readwrite');
      request = transaction.objectStore(PLAYLIST_STORE_NAME).add(encodeStoredPlaylist(playlist));
    } catch (cause) {
      return Promise.reject(
        translatePlaylistStorageError(cause, 'Could not create local playlist'),
      );
    }
    return new Promise((resolve, reject) => {
      let collision = false;
      request.onerror = (event) => {
        if (request.error?.name === 'ConstraintError') {
          collision = true;
          event.preventDefault();
        }
      };
      transaction.oncomplete = () =>
        collision
          ? reject(new PlaylistConflictError(playlist.id, playlist.revision, playlist.revision))
          : resolve();
      transaction.onabort = () =>
        reject(
          collision
            ? new PlaylistConflictError(playlist.id, playlist.revision, playlist.revision)
            : transactionError(transaction, 'Could not create local playlist'),
        );
    });
  }

  async get(id: PlaylistId): Promise<LocalPlaylist | null> {
    let request: IDBRequest<unknown>;
    try {
      const transaction = this.#database.transaction(PLAYLIST_STORE_NAME, 'readonly');
      request = transaction.objectStore(PLAYLIST_STORE_NAME).get(id);
    } catch (cause) {
      throw translatePlaylistStorageError(cause, 'Could not read local playlist');
    }
    const value = await requestResult(request, 'Could not read local playlist');
    return value === undefined ? null : decodeStoredPlaylist(value);
  }

  list(): Promise<readonly LocalPlaylist[]> {
    let request: IDBRequest<IDBCursorWithValue | null>;
    try {
      const transaction = this.#database.transaction(PLAYLIST_STORE_NAME, 'readonly');
      request = transaction
        .objectStore(PLAYLIST_STORE_NAME)
        .index(PLAYLIST_UPDATED_ORDER_INDEX)
        .openCursor(null, 'prev');
    } catch (cause) {
      return Promise.reject(translatePlaylistStorageError(cause, 'Could not list local playlists'));
    }
    return new Promise((resolve, reject) => {
      const playlists: LocalPlaylist[] = [];
      request.onerror = () =>
        reject(translatePlaylistStorageError(request.error, 'Could not list local playlists'));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(Object.freeze(playlists));
          return;
        }
        try {
          playlists.push(decodeStoredPlaylist(cursor.value));
          cursor.continue();
        } catch (error) {
          reject(error);
        }
      };
    });
  }

  update(
    id: PlaylistId,
    expectedRevision: PlaylistRevision,
    content: PlaylistContent,
  ): Promise<LocalPlaylist> {
    const updatedAt = this.#now().toISOString();
    let transaction: IDBTransaction;
    let store: IDBObjectStore;
    let request: IDBRequest<unknown>;
    try {
      transaction = this.#database.transaction(PLAYLIST_STORE_NAME, 'readwrite');
      store = transaction.objectStore(PLAYLIST_STORE_NAME);
      request = store.get(id);
    } catch (cause) {
      return Promise.reject(
        translatePlaylistStorageError(cause, 'Could not update local playlist'),
      );
    }
    let result: LocalPlaylist | undefined;
    let semanticError: unknown;
    request.onsuccess = () => {
      try {
        if (request.result === undefined) throw new PlaylistNotFoundError(id);
        const current = decodeStoredPlaylist(request.result);
        if (current.revision !== expectedRevision) {
          throw new PlaylistConflictError(id, expectedRevision, current.revision);
        }
        result = playlistFrom(content, {
          id,
          revision: playlistRevision(current.revision + 1),
          createdAt: current.createdAt,
          updatedAt,
        });
        store.put(encodeStoredPlaylist(result));
      } catch (error) {
        semanticError = error;
        transaction.abort();
      }
    };
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () =>
        result
          ? resolve(result)
          : reject(
              new PlaylistRepositoryError(
                'unavailable',
                'Playlist update completed without a result',
              ),
            );
      transaction.onabort = () =>
        reject(semanticError ?? transactionError(transaction, 'Could not update local playlist'));
    });
  }

  delete(id: PlaylistId, expectedRevision: PlaylistRevision): Promise<void> {
    let transaction: IDBTransaction;
    let store: IDBObjectStore;
    let request: IDBRequest<unknown>;
    try {
      transaction = this.#database.transaction(PLAYLIST_STORE_NAME, 'readwrite');
      store = transaction.objectStore(PLAYLIST_STORE_NAME);
      request = store.get(id);
    } catch (cause) {
      return Promise.reject(
        translatePlaylistStorageError(cause, 'Could not delete local playlist'),
      );
    }
    let semanticError: unknown;
    request.onsuccess = () => {
      try {
        if (request.result === undefined) throw new PlaylistNotFoundError(id);
        const current = decodeStoredPlaylist(request.result);
        if (current.revision !== expectedRevision) {
          throw new PlaylistConflictError(id, expectedRevision, current.revision);
        }
        store.delete(id);
      } catch (error) {
        semanticError = error;
        transaction.abort();
      }
    };
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(semanticError ?? transactionError(transaction, 'Could not delete local playlist'));
    });
  }

  close(): void {
    this.#database.close();
  }
}
