import { DraftRepositoryError, translateDraftStorageError } from './errors.ts';

export const DRAFT_DATABASE_NAME = 'cruxcontrol-local-drafts';
export const DRAFT_DATABASE_VERSION = 1;
export const DRAFT_STORE_NAME = 'drafts';
export const DRAFT_UPDATED_ORDER_INDEX = 'updatedOrder';
export const DRAFT_INSTALLATION_INDEX = 'installationId';

export interface DraftDatabaseFactory {
  open(name: string, version?: number): IDBOpenDBRequest;
}

export function openDraftDatabase(factory?: DraftDatabaseFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let request: IDBOpenDBRequest;
    try {
      const databaseFactory = factory ?? globalThis.indexedDB;
      if (!databaseFactory) throw new DOMException('IndexedDB is unavailable', 'NotSupportedError');
      request = databaseFactory.open(DRAFT_DATABASE_NAME, DRAFT_DATABASE_VERSION);
    } catch (cause) {
      reject(translateDraftStorageError(cause, 'Local draft storage is unavailable'));
      return;
    }
    request.onupgradeneeded = (event) => {
      if (event.oldVersion === 0) {
        const store = request.result.createObjectStore(DRAFT_STORE_NAME, { keyPath: 'id' });
        store.createIndex(DRAFT_UPDATED_ORDER_INDEX, 'updatedOrder', { unique: true });
        store.createIndex(DRAFT_INSTALLATION_INDEX, 'installationId', { unique: false });
      }
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(
        new DraftRepositoryError(
          'unavailable',
          'Local draft storage upgrade is blocked; close other CruxControl tabs and reload',
        ),
      );
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(translateDraftStorageError(request.error, 'Could not open local draft storage'));
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
