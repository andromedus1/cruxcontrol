import { fetchCatalogManifest, fetchCatalogSnapshot } from '../../../src/data/catalog/bootstrap.ts';
import type { CatalogStorageStatus, CatalogInstallResult } from '../../../src/data/catalog/bootstrap-port.ts';
import type { CatalogManifest } from '../../../src/data/catalog/manifest.ts';
import type { CatalogReceipt } from '../../../src/data/sqlite/catalog-receipt.ts';
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
  close() { return port.close(); },
  async restart(fault: Fault = 'none') {
    try { await port.close(); } catch { /* A poisoned worker is already terminated. */ }
    return openPort(fault);
  },
};

export type { CatalogManifest };
