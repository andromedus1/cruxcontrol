import { fetchCatalogManifest, fetchCatalogSnapshot } from '../../../src/data/catalog/bootstrap.ts';
import type { CatalogStorageStatus, CatalogInstallResult } from '../../../src/data/catalog/bootstrap-port.ts';
import type { CatalogManifest } from '../../../src/data/catalog/manifest.ts';
import type { CatalogReceipt } from '../../../src/data/sqlite/catalog-receipt.ts';
import {
  CATALOG_RECEIPT_DATABASE,
  CATALOG_RECEIPT_KEY,
  CATALOG_RECEIPT_STORE,
} from '../../../src/data/sqlite/catalog-config.ts';
import { SqliteCatalogPort } from '../../../src/data/sqlite/sqlite-catalog-port.ts';

type Fault = 'none' | 'before-receipt' | 'after-receipt' | 'pool-init-busy';
type AuthoredRecords = {
  climbs: Array<{ id: string; name: string }>;
  playlists: Array<{ id: string; name: string }>;
  memberships: Array<{ playlistId: string; climbId: string; position: number }>;
};

interface CatalogHarness {
  status(): Promise<CatalogStorageStatus>;
  install(): Promise<CatalogInstallResult>;
  queryName(): Promise<string | null>;
  authored(): Promise<AuthoredRecords>;
  receipt(): Promise<CatalogReceipt | null>;
  mutateReceiptBytesRaw(): Promise<void>;
  restoreReceipt(receipt: CatalogReceipt): Promise<void>;
  close(): Promise<void>;
  restart(fault?: Fault): Promise<CatalogStorageStatus>;
}

declare global {
  interface Window { catalogHarness: CatalogHarness }
}

const authoredDatabase = 'catalog-bootstrap-authored-fixture';

function openAuthoredDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(authoredDatabase, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore('climbs', { keyPath: 'id' });
      database.createObjectStore('playlists', { keyPath: 'id' });
      database.createObjectStore('memberships', { keyPath: ['playlistId', 'position'] });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function seedAuthoredFixture(): Promise<void> {
  const database = await openAuthoredDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(['climbs', 'playlists', 'memberships'], 'readwrite');
    const climbs = transaction.objectStore('climbs');
    const playlists = transaction.objectStore('playlists');
    const memberships = transaction.objectStore('memberships');
    const check = climbs.get('authored-climb-1');
    check.onsuccess = () => {
      if (check.result !== undefined) return;
      climbs.put({ id: 'authored-climb-1', name: 'Saved draft' });
      climbs.put({ id: 'authored-climb-2', name: 'Finished climb' });
      playlists.put({ id: 'authored-playlist-1', name: 'My warmups' });
      memberships.put({ playlistId: 'authored-playlist-1', climbId: 'authored-climb-2', position: 0 });
      memberships.put({ playlistId: 'authored-playlist-1', climbId: 'authored-climb-1', position: 1 });
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}

function readAll<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

async function readAuthoredFixture(): Promise<AuthoredRecords> {
  const database = await openAuthoredDatabase();
  const transaction = database.transaction(['climbs', 'playlists', 'memberships'], 'readonly');
  const [climbs, playlists, memberships] = await Promise.all([
    readAll<AuthoredRecords['climbs'][number]>(transaction.objectStore('climbs')),
    readAll<AuthoredRecords['playlists'][number]>(transaction.objectStore('playlists')),
    readAll<AuthoredRecords['memberships'][number]>(transaction.objectStore('memberships')),
  ]);
  database.close();
  return { climbs, playlists, memberships: memberships.sort((a, b) => a.position - b.position) };
}

function openCatalogMetadata(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CATALOG_RECEIPT_DATABASE);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(CATALOG_RECEIPT_STORE)) {
        request.transaction?.abort();
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function updateStoredReceipt(
  update: (receipt: CatalogReceipt) => CatalogReceipt,
): Promise<void> {
  const database = await openCatalogMetadata();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(CATALOG_RECEIPT_STORE, 'readwrite');
      const store = transaction.objectStore(CATALOG_RECEIPT_STORE);
      const read = store.get(CATALOG_RECEIPT_KEY);
      let failed = false;
      read.onsuccess = () => {
        try {
          if (read.result === undefined) throw new Error('Expected a stored synthetic catalog receipt');
          store.put(update(structuredClone(read.result) as CatalogReceipt), CATALOG_RECEIPT_KEY);
        } catch (cause) {
          failed = true;
          try { transaction.abort(); } catch { /* Keep the receipt update error. */ }
          reject(cause);
        }
      };
      read.onerror = () => {
        failed = true;
        reject(read.error ?? new Error('Could not read the synthetic catalog receipt'));
      };
      transaction.oncomplete = () => { if (!failed) resolve(); };
      transaction.onerror = () => {
        if (failed) return;
        failed = true;
        reject(transaction.error ?? new Error('Could not update the synthetic catalog receipt'));
      };
      transaction.onabort = () => {
        if (failed) return;
        failed = true;
        reject(transaction.error ?? new Error('Synthetic catalog receipt update was aborted'));
      };
    });
  } finally {
    database.close();
  }
}

let port: SqliteCatalogPort;
let currentFault: Fault = 'none';
let currentStatus: CatalogStorageStatus = { status: 'empty' };

function workerForFault(fault: Fault): Worker {
  const worker = new Worker(new URL('../../../src/data/sqlite/catalog.worker.ts', import.meta.url), { type: 'module' });
  if (fault !== 'none') worker.postMessage({ type: 'catalog-test-config', fault });
  worker.addEventListener('message', (event: MessageEvent) => {
    const value = event.data as { type?: string; boundary?: string };
    if (value?.type === 'catalog-test-boundary') {
      document.body.dataset.catalogBoundary = value.boundary;
      window.dispatchEvent(new CustomEvent('catalog-test-boundary', { detail: value.boundary }));
    }
  });
  return worker;
}

async function openPort(fault: Fault): Promise<CatalogStorageStatus> {
  currentFault = fault;
  port = SqliteCatalogPort.create(() => workerForFault(currentFault));
  currentStatus = await port.catalogStatus();
  return currentStatus;
}

await seedAuthoredFixture();
let initialStatus: CatalogStorageStatus;
try {
  initialStatus = await openPort('none');
  document.querySelector('#status')!.textContent = initialStatus.status;
} catch (cause) {
  initialStatus = { status: 'unavailable', code: 'storage', message: String(cause) };
  document.querySelector('#status')!.textContent = initialStatus.message;
}

window.catalogHarness = {
  async status() {
    try {
      currentStatus = await port.catalogStatus();
    } catch (cause) {
      if (currentStatus.status !== 'unavailable' || currentStatus.code !== 'busy') throw cause;
    }
    return currentStatus;
  },
  async install() {
    const manifest = await fetchCatalogManifest(fetch);
    const compressed = await fetchCatalogSnapshot(manifest, fetch, () => undefined);
    const result = await port.installCatalog(manifest, compressed);
    if (result.ok) currentStatus = { status: 'ready', receipt: result.receipt };
    return result;
  },
  async queryName() {
    const rows = await port.query<{ name: string }>(
      'SELECT name FROM climbs WHERE uuid = ?', ['synthetic-valid'],
    );
    return rows[0]?.name ?? null;
  },
  authored: readAuthoredFixture,
  async receipt() {
    const status = await port.catalogStatus();
    return status.status === 'ready' ? status.receipt : null;
  },
  mutateReceiptBytesRaw() {
    return updateStoredReceipt((receipt) => ({
      ...receipt,
      manifest: { ...receipt.manifest, bytesRaw: receipt.manifest.bytesRaw + 1 },
    }));
  },
  restoreReceipt(receipt) {
    return updateStoredReceipt(() => structuredClone(receipt));
  },
  close() { return port.close(); },
  async restart(fault: Fault = 'none') {
    try { await port.close(); } catch { /* A poisoned worker is already terminated. */ }
    return openPort(fault);
  },
};

export type { CatalogManifest };
