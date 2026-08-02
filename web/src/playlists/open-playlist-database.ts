import { PlaylistRepositoryError, translatePlaylistStorageError } from './errors.ts';

export const PLAYLIST_DATABASE_NAME = 'cruxcontrol-local-playlists';
export const PLAYLIST_DATABASE_VERSION = 1;
export const PLAYLIST_STORE_NAME = 'playlists';
export const PLAYLIST_UPDATED_ORDER_INDEX = 'updatedOrder';

export interface PlaylistDatabaseFactory {
  open(name: string, version?: number): IDBOpenDBRequest;
}

export function openPlaylistDatabase(factory?: PlaylistDatabaseFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let request: IDBOpenDBRequest;
    try {
      const databaseFactory = factory ?? globalThis.indexedDB;
      if (!databaseFactory) throw new DOMException('IndexedDB is unavailable', 'NotSupportedError');
      request = databaseFactory.open(PLAYLIST_DATABASE_NAME, PLAYLIST_DATABASE_VERSION);
    } catch (cause) {
      reject(translatePlaylistStorageError(cause, 'Local playlist storage is unavailable'));
      return;
    }
    request.onupgradeneeded = (event) => {
      if (event.oldVersion === 0) {
        const store = request.result.createObjectStore(PLAYLIST_STORE_NAME, { keyPath: 'id' });
        store.createIndex(PLAYLIST_UPDATED_ORDER_INDEX, 'updatedOrder', { unique: true });
      }
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(
        new PlaylistRepositoryError(
          'unavailable',
          'Local playlist storage upgrade is blocked; close other CruxControl tabs and reload',
        ),
      );
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(translatePlaylistStorageError(request.error, 'Could not open local playlist storage'));
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      if (settled) {
        database.close();
        return;
      }
      settled = true;
      resolve(database);
    };
  });
}
