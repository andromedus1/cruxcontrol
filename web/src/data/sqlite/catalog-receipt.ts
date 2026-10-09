import { CatalogBootstrapError } from '../catalog/errors.ts';
import { parseCatalogManifest, type CatalogManifest } from '../catalog/manifest.ts';
import {
  CATALOG_RECEIPT_DATABASE,
  CATALOG_RECEIPT_KEY,
  CATALOG_RECEIPT_STORE,
  type CatalogSlot,
} from './catalog-config.ts';

export interface CatalogReceipt {
  schemaVersion: 1;
  slot: CatalogSlot;
  manifest: CatalogManifest;
  installedAt: string;
}

export interface CatalogReceiptStore {
  read(): Promise<CatalogReceipt | null>;
  write(receipt: CatalogReceipt): Promise<void>;
  close(): void;
}

function parseReceipt(value: unknown): CatalogReceipt {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CatalogBootstrapError('storage', 'Catalog receipt is not a valid record');
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1 || (record.slot !== 'a' && record.slot !== 'b')
    || typeof record.installedAt !== 'string'
    || !Number.isFinite(Date.parse(record.installedAt))
    || new Date(record.installedAt).toISOString() !== record.installedAt) {
    throw new CatalogBootstrapError('storage', 'Catalog receipt is not a valid record');
  }
  try {
    return Object.freeze({
      schemaVersion: 1,
      slot: record.slot as CatalogSlot,
      manifest: parseCatalogManifest(record.manifest),
      installedAt: record.installedAt,
    });
  } catch (cause) {
    throw new CatalogBootstrapError('storage', 'Catalog receipt provenance is invalid', { cause });
  }
}

function requestError<T>(request: IDBRequest<T>): Error {
  return request.error ?? new Error('IndexedDB request failed');
}

export class IndexedDbCatalogReceiptStore implements CatalogReceiptStore {
  private closed = false;

  private constructor(private database: IDBDatabase) {
    database.onversionchange = () => this.close();
  }

  static open(factory: IDBFactory = indexedDB): Promise<IndexedDbCatalogReceiptStore> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const request = factory.open(CATALOG_RECEIPT_DATABASE, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(CATALOG_RECEIPT_STORE)) {
          database.createObjectStore(CATALOG_RECEIPT_STORE);
        }
      };
      request.onerror = () => {
        if (settled) return;
        settled = true;
        reject(new CatalogBootstrapError('storage', 'Could not open catalog metadata', { cause: requestError(request) }));
      };
      request.onblocked = () => {
        if (settled) return;
        settled = true;
        reject(new CatalogBootstrapError('storage', 'Catalog metadata upgrade is blocked'));
      };
      request.onsuccess = () => {
        const database = request.result;
        if (settled) {
          database.close();
          return;
        }
        settled = true;
        resolve(new IndexedDbCatalogReceiptStore(database));
      };
    });
  }

  read(): Promise<CatalogReceipt | null> {
    const database = this.requireDatabase();
    return new Promise((resolve, reject) => {
      let raw: unknown;
      let hasValue = false;
      let failed = false;
      const transaction = database.transaction(CATALOG_RECEIPT_STORE, 'readonly');
      const request = transaction.objectStore(CATALOG_RECEIPT_STORE).get(CATALOG_RECEIPT_KEY);
      request.onsuccess = () => {
        raw = request.result;
        hasValue = raw !== undefined;
      };
      request.onerror = () => {
        failed = true;
        reject(new CatalogBootstrapError('storage', 'Could not read catalog metadata', { cause: requestError(request) }));
      };
      transaction.onabort = () => {
        if (failed) return;
        failed = true;
        reject(new CatalogBootstrapError('storage', 'Catalog metadata read was aborted', { cause: transaction.error ?? undefined }));
      };
      transaction.onerror = () => {
        if (failed) return;
        failed = true;
        reject(new CatalogBootstrapError('storage', 'Catalog metadata read failed', { cause: transaction.error ?? undefined }));
      };
      transaction.oncomplete = () => {
        if (failed) return;
        try {
          resolve(hasValue ? parseReceipt(raw) : null);
        } catch (cause) {
          reject(cause);
        }
      };
    });
  }

  write(receipt: CatalogReceipt): Promise<void> {
    const database = this.requireDatabase();
    return new Promise((resolve, reject) => {
      let failed = false;
      let transaction: IDBTransaction;
      try {
        transaction = database.transaction(CATALOG_RECEIPT_STORE, 'readwrite', { durability: 'strict' });
      } catch (cause) {
        reject(new CatalogBootstrapError('storage', 'Could not begin durable catalog metadata transaction', { cause }));
        return;
      }
      let request: IDBRequest<IDBValidKey>;
      try {
        request = transaction.objectStore(CATALOG_RECEIPT_STORE).put(receipt, CATALOG_RECEIPT_KEY);
      } catch (cause) {
        try { transaction.abort(); } catch { /* The synchronous put error is authoritative. */ }
        reject(new CatalogBootstrapError('storage', 'Could not queue catalog metadata write', { cause }));
        return;
      }
      request.onerror = () => {
        if (failed) return;
        failed = true;
        reject(new CatalogBootstrapError('storage', 'Could not write catalog metadata', { cause: requestError(request) }));
      };
      transaction.onabort = () => {
        if (failed) return;
        failed = true;
        reject(new CatalogBootstrapError('storage', 'Catalog metadata transaction was aborted', { cause: transaction.error ?? undefined }));
      };
      transaction.onerror = () => {
        if (failed) return;
        failed = true;
        reject(new CatalogBootstrapError('storage', 'Catalog metadata transaction failed', { cause: transaction.error ?? undefined }));
      };
      transaction.oncomplete = () => {
        if (failed) return;
        resolve();
      };
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.database.close();
  }

  private requireDatabase(): IDBDatabase {
    if (this.closed) throw new CatalogBootstrapError('closed', 'Catalog metadata store is closed');
    return this.database;
  }
}
