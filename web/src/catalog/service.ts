import type { BoardDefinition } from '../domain/boards/definition.ts';
import { fetchCatalogManifest, fetchCatalogSnapshot } from '../data/catalog/bootstrap.ts';
import type { CatalogBootstrapPort, CatalogInstallResult, CatalogStorageStatus } from '../data/catalog/bootstrap-port.ts';
import { CatalogBootstrapError, type CatalogFailureCode } from '../data/catalog/errors.ts';
import type { CatalogManifest } from '../data/catalog/manifest.ts';
import type { CatalogDownloadProgress } from '../data/catalog/manifest.ts';
import type { CatalogPort } from '../data/port.ts';
import type { CatalogReceipt } from '../data/sqlite/catalog-receipt.ts';
import { createKilterCatalog } from '../data/catalog/kilter-catalog.ts';
import type { CatalogQueryPort } from './types.ts';

export type CatalogOperation =
  | 'idle'
  | 'opening'
  | 'checking-offer'
  | 'downloading'
  | 'installing';

export interface CatalogServiceSnapshot {
  readonly storage: CatalogStorageStatus | null;
  readonly operation: CatalogOperation;
  readonly offer: CatalogManifest | null;
  readonly progress: CatalogDownloadProgress | null;
  readonly error: Readonly<{ code: CatalogFailureCode; message: string }> | null;
  readonly queries: CatalogQueryPort | null;
}

export interface CatalogService {
  getSnapshot(): CatalogServiceSnapshot;
  subscribe(listener: () => void): () => void;
  start(): Promise<void>;
  loadOffer(): Promise<void>;
  installOffer(): Promise<void>;
  cancelDownload(): void;
  retryOpen(): Promise<void>;
  close(): Promise<void>;
}

export interface CatalogServiceDependencies {
  readonly createPort: () => CatalogPort & CatalogBootstrapPort;
  readonly fetcher: typeof fetch;
}

const LEGACY_COVERAGE = 'Older offline snapshot; current first-party coverage is unknown; no live updates';
const INITIAL: CatalogServiceSnapshot = Object.freeze({
  storage: null,
  operation: 'idle',
  offer: null,
  progress: null,
  error: null,
  queries: null,
});

const FAILURE_CODES = new Set<CatalogFailureCode>([
  'unsupported', 'busy', 'closed', 'manifest', 'network', 'aborted', 'digest',
  'size', 'decompression', 'schema', 'storage',
]);

function failureOf(
  cause: unknown,
  fallbackCode: CatalogFailureCode,
  fallbackMessage: string,
): Readonly<{ code: CatalogFailureCode; message: string }> {
  if (cause instanceof CatalogBootstrapError) {
    return Object.freeze({ code: cause.code, message: cause.message });
  }
  if (typeof cause === 'object' && cause !== null) {
    const candidate = cause as { code?: unknown; message?: unknown };
    if (typeof candidate.code === 'string' && FAILURE_CODES.has(candidate.code as CatalogFailureCode)) {
      return Object.freeze({
        code: candidate.code as CatalogFailureCode,
        message: typeof candidate.message === 'string' && candidate.message
          ? candidate.message
          : fallbackMessage,
      });
    }
  }
  return Object.freeze({
    code: fallbackCode,
    message: cause instanceof Error && cause.message ? cause.message : fallbackMessage,
  });
}

function queryForReceipt(
  port: CatalogPort,
  definition: BoardDefinition,
  receipt: CatalogReceipt,
): CatalogQueryPort {
  return createKilterCatalog(port, definition, {
    source: 'Legacy Kilter (Aurora)',
    snapshotId: receipt.manifest.sha256,
    retrievedAt: null,
    coverage: LEGACY_COVERAGE,
  });
}

function installError(result: Extract<CatalogInstallResult, { ok: false }>) {
  return Object.freeze({ code: result.code, message: result.message });
}

export function createCatalogService(
  definition: BoardDefinition,
  dependencies: CatalogServiceDependencies,
): CatalogService {
  const listeners = new Set<() => void>();
  let snapshot = INITIAL;
  let port: (CatalogPort & CatalogBootstrapPort) | null = null;
  let lastReceipt: CatalogReceipt | null = null;
  let lastQueries: CatalogQueryPort | null = null;
  let startPromise: Promise<void> | null = null;
  let operationPromise: Promise<void> | null = null;
  let retryPromise: Promise<void> | null = null;
  let closePromise: Promise<void> | null = null;
  let downloadAbort: AbortController | null = null;
  let metadataAbort: AbortController | null = null;
  let disposed = false;
  let generation = 0;

  const publish = (next: CatalogServiceSnapshot) => {
    if (disposed) return;
    if (
      snapshot.storage === next.storage
      && snapshot.operation === next.operation
      && snapshot.offer === next.offer
      && snapshot.progress === next.progress
      && snapshot.error === next.error
      && snapshot.queries === next.queries
    ) return;
    snapshot = Object.freeze(next);
    for (const listener of [...listeners]) listener();
  };

  const update = (changes: Partial<CatalogServiceSnapshot>) => publish({ ...snapshot, ...changes });

  const queriesFor = (activePort: CatalogPort, receipt: CatalogReceipt): CatalogQueryPort => {
    if (lastReceipt?.manifest.sha256 === receipt.manifest.sha256 && lastQueries) return lastQueries;
    lastReceipt = receipt;
    lastQueries = queryForReceipt(activePort, definition, receipt);
    return lastQueries;
  };

  const open = (): Promise<void> => {
    if (disposed || snapshot.storage !== null) return Promise.resolve();
    if (startPromise) return startPromise;

    const currentGeneration = generation;
    const pending = Promise.resolve().then(async () => {
      let activePort: CatalogPort & CatalogBootstrapPort;
      try {
        activePort = port ?? dependencies.createPort();
        port = activePort;
        const status = await activePort.catalogStatus();
        if (disposed || currentGeneration !== generation) {
          await activePort.close().catch(() => undefined);
          if (port === activePort) port = null;
          return;
        }
        if (status.status === 'ready') {
          update({
            storage: status,
            operation: 'idle',
            error: null,
            queries: queriesFor(activePort, status.receipt),
          });
          return;
        }
        if (status.status === 'unavailable') {
          update({
            storage: status,
            operation: 'idle',
            error: Object.freeze({ code: status.code, message: status.message }),
            queries: null,
          });
          return;
        }
        update({ storage: status, operation: 'idle', error: null, queries: null });
      } catch (cause) {
        if (disposed || currentGeneration !== generation) return;
        const error = failureOf(cause, 'storage', 'The local catalog could not be opened.');
        update({
          storage: { status: 'unavailable', ...error },
          operation: 'idle',
          error,
          queries: null,
        });
      }
    });
    startPromise = pending.finally(() => {
      if (startPromise === wrapped) startPromise = null;
    });
    const wrapped = startPromise;
    update({ operation: 'opening', error: null });
    return wrapped;
  };

  const start = (): Promise<void> => {
    if (disposed || snapshot.storage !== null) return Promise.resolve();
    const activeRetry = retryPromise;
    if (activeRetry) {
      return activeRetry.then(() => {
        if (disposed || snapshot.storage !== null) return;
        return start();
      });
    }
    return open();
  };

  const loadOffer = async (): Promise<void> => {
    await start();
    if (disposed || snapshot.operation !== 'idle' || snapshot.storage?.status !== 'empty') return;
    const currentGeneration = generation;
    const controller = new AbortController();
    metadataAbort = controller;
    update({ operation: 'checking-offer', error: null });
    const pending = (async () => {
      try {
        const offer = await fetchCatalogManifest(dependencies.fetcher, controller.signal);
        if (disposed || currentGeneration !== generation) return;
        update({ offer, operation: 'idle', error: null });
      } catch (cause) {
        if (disposed || currentGeneration !== generation) return;
        const error = failureOf(cause, 'manifest', 'Catalog details could not be loaded.');
        update({ operation: 'idle', error });
      } finally {
        if (metadataAbort === controller) metadataAbort = null;
      }
    })();
    operationPromise = pending;
    try {
      await pending;
    } finally {
      if (operationPromise === pending) operationPromise = null;
    }
  };

  const installOffer = async (): Promise<void> => {
    if (
      disposed
      || snapshot.operation !== 'idle'
      || !snapshot.offer
      || (snapshot.storage?.status !== 'empty' && snapshot.storage?.status !== 'ready')
      || !port
    ) return;
    const approvedOffer = snapshot.offer;
    const activePort = port;
    const currentGeneration = generation;
    const controller = new AbortController();
    downloadAbort = controller;
    update({ operation: 'downloading', progress: null, error: null });

    const pending = (async () => {
      try {
        const compressed = await fetchCatalogSnapshot(
          approvedOffer,
          dependencies.fetcher,
          (progress) => {
            if (!disposed && currentGeneration === generation && !controller.signal.aborted) {
              update({ progress: Object.freeze(progress) });
            }
          },
          controller.signal,
        );
        if (disposed || currentGeneration !== generation) return;
        if (controller.signal.aborted) {
          const error = failureOf(new CatalogBootstrapError('aborted', 'Catalog download was cancelled'), 'aborted', 'Catalog download was cancelled.');
          update({ operation: 'idle', progress: null, error });
          return;
        }
        downloadAbort = null;
        update({ operation: 'installing', progress: null, error: null, queries: null });
        const result = await activePort.installCatalog(approvedOffer, compressed);
        if (disposed || currentGeneration !== generation) return;
        if (result.ok) {
          const storage: CatalogStorageStatus = { status: 'ready', receipt: result.receipt };
          update({
            storage,
            operation: 'idle',
            progress: null,
            error: null,
            queries: queriesFor(activePort, result.receipt),
          });
        } else if (result.code === 'closed' || result.code === 'busy') {
          const error = installError(result);
          if (port === activePort) port = null;
          lastQueries = null;
          lastReceipt = null;
          await activePort.close().catch(() => undefined);
          if (disposed || currentGeneration !== generation) return;
          const storage: CatalogStorageStatus = {
            status: 'unavailable',
            code: result.code,
            message: result.message,
          };
          update({
            storage,
            operation: 'idle',
            progress: null,
            error,
            offer: null,
            queries: null,
          });
        } else {
          const storage: CatalogStorageStatus = result.retained
            ? { status: 'ready', receipt: result.retained }
            : { status: 'empty' };
          update({
            storage,
            operation: 'idle',
            progress: null,
            error: installError(result),
            queries: result.retained ? queriesFor(activePort, result.retained) : null,
          });
        }
      } catch (cause) {
        if (disposed || currentGeneration !== generation) return;
        const fallbackCode = controller.signal.aborted
          ? 'aborted'
          : snapshot.operation === 'installing' ? 'storage' : 'network';
        const error = failureOf(cause, fallbackCode,
          controller.signal.aborted ? 'Catalog download was cancelled.' : 'The catalog could not be installed.');
        if (snapshot.operation === 'installing') {
          port = null;
          lastQueries = null;
          lastReceipt = null;
          await activePort.close().catch(() => undefined);
          if (!disposed && currentGeneration === generation) {
            update({
              storage: { status: 'unavailable', code: error.code, message: error.message },
              operation: 'idle',
              progress: null,
              error,
              queries: null,
            });
          }
        } else {
          update({ operation: 'idle', progress: null, error });
        }
      } finally {
        if (downloadAbort === controller) downloadAbort = null;
      }
    })();
    operationPromise = pending;
    try {
      await pending;
    } finally {
      if (operationPromise === pending) operationPromise = null;
    }
  };

  const retryOpen = (): Promise<void> => {
    if (retryPromise) return retryPromise;
    if (disposed || snapshot.operation !== 'idle' || snapshot.storage?.status !== 'unavailable') return Promise.resolve();
    const oldPort = port;
    port = null;
    lastQueries = null;
    lastReceipt = null;
    const currentGeneration = ++generation;
    const pending = Promise.resolve().then(async () => {
      if (oldPort) {
        try {
          await oldPort.close();
        } catch (cause) {
          if (!disposed && currentGeneration === generation) {
            const error = failureOf(cause, 'closed', 'The previous catalog worker could not be closed.');
            update({ storage: { status: 'unavailable', ...error }, operation: 'idle', error });
          }
          return;
        }
      }
      if (!disposed && currentGeneration === generation) await open();
    });
    retryPromise = pending.finally(() => {
      if (retryPromise === wrapped) retryPromise = null;
    });
    const wrapped = retryPromise;
    update({ storage: null, operation: 'opening', error: null, offer: null, queries: null, progress: null });
    return wrapped;
  };

  const cancelDownload = () => {
    if (snapshot.operation !== 'downloading') return;
    downloadAbort?.abort();
  };

  const close = (): Promise<void> => {
    if (closePromise) return closePromise;
    disposed = true;
    generation += 1;
    metadataAbort?.abort();
    downloadAbort?.abort();
    const currentStart = startPromise;
    const currentOperation = operationPromise;
    const currentRetry = retryPromise;
    closePromise = (async () => {
      await Promise.allSettled(
        [currentStart, currentOperation, currentRetry].filter(Boolean) as Promise<void>[],
      );
      const activePort = port;
      port = null;
      if (activePort) {
        try { await activePort.close(); } catch { /* Port close always terminates its worker. */ }
      }
      listeners.clear();
      lastQueries = null;
      lastReceipt = null;
      snapshot = INITIAL;
    })();
    return closePromise;
  };

  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start,
    loadOffer,
    installOffer,
    cancelDownload,
    retryOpen,
    close,
  });
}
