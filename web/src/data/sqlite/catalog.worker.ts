/** Dedicated worker that owns the catalog VFS, metadata, lease, and query queue. */

import { expose } from 'comlink';
import { AccessHandlePoolVFS } from 'wa-sqlite/src/examples/AccessHandlePoolVFS.js';
import type { CatalogManifest } from '../catalog/manifest.ts';
import type { CatalogStorageStatus } from '../catalog/bootstrap-port.ts';
import { CatalogBootstrapError as BootstrapFailure } from '../catalog/errors.ts';
import { installCatalogCandidate, inspectCatalogFile, validateCatalog } from './catalog-install.ts';
import { CatalogDb } from './catalog-db.ts';
import { CATALOG_OWNER_LOCK, CATALOG_OPFS_DIRECTORY, CATALOG_SLOT_FILENAMES } from './catalog-config.ts';
import { IndexedDbCatalogReceiptStore, type CatalogReceipt, type CatalogReceiptStore } from './catalog-receipt.ts';
import { isWorkerOpfsSyncAccessSupported } from './opfs-support.ts';
import type { CatalogDbApi } from './catalog-db-api.ts';

interface WorkerContext {
  vfs: SQLiteVFS;
  vfsName: string;
  receipts: CatalogReceiptStore;
  active: { receipt: CatalogReceipt; db: CatalogDb } | null;
  now(): string;
  onBoundary?(boundary: 'before-receipt' | 'after-receipt'): Promise<void>;
}

let testFault: string | null = null;
if (import.meta.env.MODE === 'catalog-bootstrap-test') {
  globalThis.addEventListener('message', (event: MessageEvent) => {
    const value = event.data as { type?: string; fault?: string };
    if (value?.type === 'catalog-test-config'
      && (value.fault === 'before-receipt' || value.fault === 'after-receipt'
        || value.fault === 'pool-init-busy')) {
      testFault = value.fault;
    }
  }, { once: true });
}

let context: WorkerContext | null = null;
let vfs: AccessHandlePoolVFS | null = null;
let receipts: CatalogReceiptStore | null = null;
let workerStatus: CatalogStorageStatus | null = null;
let poisoned = false;
let closed = false;
let releaseLease: (() => void) | null = null;
let queueTail: Promise<void> = Promise.resolve();

function failureStatus(cause: unknown): CatalogStorageStatus {
  if (cause instanceof BootstrapFailure) {
    return { status: 'unavailable', code: cause.code, message: cause.message };
  }
  const message = cause instanceof Error ? cause.message : String(cause);
  return { status: 'unavailable', code: 'storage', message: `Catalog storage could not be opened: ${message}` };
}

function busyFailure(cause: unknown): boolean {
  return cause instanceof DOMException
    && (cause.name === 'NoModificationAllowedError' || cause.name === 'InvalidStateError');
}

async function initializeUnderLease(): Promise<CatalogStorageStatus> {
  try {
    if (testFault === 'pool-init-busy') {
      testFault = null;
      throw new DOMException('Injected access-handle contention', 'NoModificationAllowedError');
    }
    vfs = new AccessHandlePoolVFS(CATALOG_OPFS_DIRECTORY);
    await vfs.isReady;
    receipts = await IndexedDbCatalogReceiptStore.open();
  } catch (cause) {
    try { await vfs?.close(); } catch { /* A failed VFS is retired with this worker. */ }
    vfs = null;
    receipts?.close();
    receipts = null;
    if (busyFailure(cause)) {
      return { status: 'unavailable', code: 'busy', message: 'Catalog storage is still owned by another worker. Retry shortly.' };
    }
    return failureStatus(cause);
  }

  context = {
    vfs: vfs as unknown as SQLiteVFS,
    vfsName: vfs.name,
    receipts,
    active: null,
    now: () => new Date().toISOString(),
    onBoundary: testBoundary,
  };

  let receipt: CatalogReceipt | null;
  try {
    receipt = await receipts.read();
  } catch (cause) {
    return failureStatus(cause);
  }
  if (!receipt) return { status: 'empty' };

  let db: CatalogDb | null = null;
  try {
    const filename = CATALOG_SLOT_FILENAMES[receipt.slot];
    inspectCatalogFile(vfs as unknown as SQLiteVFS, filename, receipt.manifest.bytesRaw);
    db = await CatalogDb.open(filename, { vfs: vfs as unknown as SQLiteVFS, name: vfs.name });
    await validateCatalog(db, receipt.manifest, 'quick');
    context.active = { receipt, db };
    return { status: 'ready', receipt };
  } catch (cause) {
    if (cause instanceof BootstrapFailure && cause.code === 'closed') poisoned = true;
    if (db) {
      try { await db.close(); } catch (closeCause) {
        poisoned = true;
        return failureStatus(new BootstrapFailure('closed', 'Could not close invalid active catalog', { cause: closeCause }));
      }
    }
    return failureStatus(cause);
  }
}

async function testBoundary(boundary: 'before-receipt' | 'after-receipt'): Promise<void> {
  if (testFault !== boundary) return;
  const worker = globalThis as typeof globalThis & { postMessage?: (message: unknown) => void };
  worker.postMessage?.({ type: 'catalog-test-boundary', boundary });
  await new Promise<void>(() => undefined);
}

async function initialize(): Promise<CatalogStorageStatus> {
  if (!isWorkerOpfsSyncAccessSupported()) {
    return { status: 'unavailable', code: 'unsupported', message: 'This Worker cannot use OPFS synchronous access handles.' };
  }
  if (typeof navigator.locks?.request !== 'function') {
    return { status: 'unavailable', code: 'unsupported', message: 'This browser does not support catalog storage locks.' };
  }

  const controller = new AbortController();
  let acquired = false;
  let resolveStatus!: (status: CatalogStorageStatus) => void;
  const statusPromise = new Promise<CatalogStorageStatus>((resolve) => { resolveStatus = resolve; });
  const held = new Promise<void>((resolve) => { releaseLease = resolve; });
  const timeout = setTimeout(() => controller.abort(), 3000);
  const request = navigator.locks.request(
    CATALOG_OWNER_LOCK,
    { mode: 'exclusive', signal: controller.signal },
    async () => {
      acquired = true;
      clearTimeout(timeout);
      const status = await initializeUnderLease();
      resolveStatus(status);
      if (status.status === 'unavailable' && (status.code === 'busy' || vfs === null)) {
        releaseLease?.();
        return;
      }
      await held;
    },
  );
  request.catch((cause: unknown) => {
    clearTimeout(timeout);
    if (!acquired) {
      const busy = cause instanceof Error && cause.name === 'AbortError';
      resolveStatus(busy
        ? { status: 'unavailable', code: 'busy', message: 'Catalog storage is still owned by another worker. Retry shortly.' }
        : failureStatus(cause));
    } else {
      resolveStatus(failureStatus(cause));
    }
  });
  return statusPromise;
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = queueTail.then(operation, operation);
  queueTail = result.then(() => undefined, () => undefined);
  return result;
}

async function readyStatus(): Promise<CatalogStorageStatus> {
  if (!workerStatus) workerStatus = await initialize();
  return workerStatus;
}

const api: CatalogDbApi = {
  query(sql, params) {
    return enqueue(async () => {
      const status = await readyStatus();
      if (poisoned || closed) throw new Error('Catalog worker is closed; reopen the catalog worker');
      if (status.status !== 'ready' || !context?.active) {
        throw new Error(status.status === 'unavailable' ? status.message : 'Catalog has not been installed');
      }
      return context.active.db.query(sql, params);
    });
  },

  isReady() {
    return enqueue(async () => (await readyStatus()).status === 'ready' && !poisoned && !closed);
  },

  catalogStatus() {
    return enqueue(async () => {
      const status = await readyStatus();
      if (status.status === 'ready' && context?.active) return { status: 'ready', receipt: context.active.receipt };
      if (poisoned || closed) return { status: 'unavailable', code: 'closed', message: 'Catalog worker must be restarted.' };
      return status;
    });
  },

  installCatalog(manifest: CatalogManifest, compressed: ArrayBuffer) {
    return enqueue(async () => {
      const status = await readyStatus();
      if (poisoned || closed) {
        return { ok: false, code: 'closed', message: 'Catalog worker must be restarted.', retained: null };
      }
      if (!context) {
        return {
          ok: false,
          code: status.status === 'unavailable' ? status.code : 'storage',
          message: status.status === 'unavailable' ? status.message : 'Catalog worker is not available.',
          retained: null,
        };
      }
      const result = await installCatalogCandidate(context, manifest, compressed);
      if (result.ok) workerStatus = { status: 'ready', receipt: result.receipt };
      if (!result.ok && result.code === 'closed') poisoned = true;
      return result;
    });
  },

  close() {
    return enqueue(async () => {
      if (closed) return;
      closed = true;
      try {
        await context?.active?.db.close();
      } finally {
        if (context) context.active = null;
        try {
          await vfs?.close();
        } finally {
          receipts?.close();
          releaseLease?.();
          releaseLease = null;
        }
      }
    });
  },
};

expose(api);
