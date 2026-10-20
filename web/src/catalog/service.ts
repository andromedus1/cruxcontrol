import type { BoardDefinition } from '../domain/boards/definition.ts';
import {
  fetchCatalogManifest,
  fetchCatalogSnapshot,
  BUNDLED_CATALOG_PATH,
  PRIVATE_CATALOG_PATH,
  type CatalogBasePath,
} from '../data/catalog/bootstrap.ts';
import type { CatalogBootstrapPort, CatalogInstallResult, CatalogStorageStatus } from '../data/catalog/bootstrap-port.ts';
import { CatalogBootstrapError, type CatalogFailureCode } from '../data/catalog/errors.ts';
import type {
  BoardseshCatalogManifest,
  CatalogChangeSummary,
  CatalogDownloadProgress,
  CatalogManifest,
} from '../data/catalog/manifest.ts';
import type { CatalogPort } from '../data/port.ts';
import type { CatalogReceipt } from '../data/sqlite/catalog-receipt.ts';
import { createKilterCatalog } from '../data/catalog/kilter-catalog.ts';
import type { CatalogQueryPort } from './types.ts';
import { catalogProvenance, catalogRatingScale } from './presentation.ts';
import {
  CATALOG_UPDATE_CHECK_INTERVAL_MS,
  CatalogUpdateError,
  localCatalogUpdatePreferences,
  noCatalogUpdates,
  type CatalogUpdateCheck,
  type CatalogUpdateErrorCode,
  type CatalogUpdatePreferenceStore,
  type CatalogUpdateSource,
} from './update-source.ts';

export type CatalogOperation =
  | 'idle'
  | 'opening'
  | 'checking-offer'
  | 'downloading'
  | 'installing';

/**
 * What this device knows about a newer signed-in catalog: `unknown` until the first check of
 * this session, `current` when the endpoint offers nothing newer than the installed receipt.
 */
export type CatalogUpdateAvailability = 'unknown' | 'unconfigured' | 'signed-out' | 'current' | 'available';

export type CatalogUpdateFailureCode = CatalogUpdateErrorCode | CatalogFailureCode;

export interface CatalogUpdateState {
  readonly availability: CatalogUpdateAvailability;
  readonly checking: boolean;
  /** A newer schema-3 catalog for this board's layout revision; never a downgrade. */
  readonly offer: BoardseshCatalogManifest | null;
  readonly changes: CatalogChangeSummary | null;
  /** "Later" hid this version; Manage still offers it. */
  readonly dismissed: boolean;
  /** Epoch milliseconds of the last completed endpoint check on this device. */
  readonly lastCheckedAt: number | null;
  /** Last check or update-install failure; the installed catalog stays active. */
  readonly error: Readonly<{ code: CatalogUpdateFailureCode; message: string }> | null;
}

export interface CatalogServiceSnapshot {
  readonly storage: CatalogStorageStatus | null;
  readonly operation: CatalogOperation;
  readonly offer: CatalogManifest | null;
  readonly progress: CatalogDownloadProgress | null;
  readonly error: Readonly<{ code: CatalogFailureCode; message: string }> | null;
  readonly queries: CatalogQueryPort | null;
  readonly update: CatalogUpdateState;
}

export interface CatalogService {
  getSnapshot(): CatalogServiceSnapshot;
  subscribe(listener: () => void): () => void;
  start(): Promise<void>;
  loadOffer(): Promise<void>;
  installOffer(): Promise<void>;
  cancelDownload(): void;
  retryOpen(): Promise<void>;
  /** Checks the signed-in endpoint when due (3.5 days) or forced; never opens storage. */
  checkForUpdate(options?: Readonly<{ force?: boolean }>): Promise<void>;
  /** Prepares, verifies and atomically installs the displayed update offer. */
  installUpdate(): Promise<void>;
  /** Hides the banner until a newer version is offered. */
  dismissUpdate(): void;
  close(): Promise<void>;
}

export interface CatalogServiceDependencies {
  readonly createPort: () => CatalogPort & CatalogBootstrapPort;
  readonly fetcher: typeof fetch;
  readonly updates?: CatalogUpdateSource;
  readonly updatePreferences?: CatalogUpdatePreferenceStore;
  readonly now?: () => number;
}

export const INITIAL_CATALOG_UPDATE: CatalogUpdateState = Object.freeze({
  availability: 'unknown',
  checking: false,
  offer: null,
  changes: null,
  dismissed: false,
  lastCheckedAt: null,
  error: null,
});

const INITIAL: CatalogServiceSnapshot = Object.freeze({
  storage: null,
  operation: 'idle',
  offer: null,
  progress: null,
  error: null,
  queries: null,
  update: INITIAL_CATALOG_UPDATE,
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

function updateFailureOf(
  cause: unknown,
  fallbackCode: CatalogFailureCode,
  fallbackMessage: string,
): Readonly<{ code: CatalogUpdateFailureCode; message: string }> {
  if (cause instanceof CatalogUpdateError) return Object.freeze({ code: cause.code, message: cause.message });
  return failureOf(cause, fallbackCode, fallbackMessage);
}

/** First-install errors keep the bootstrap code set; native preparation failures map onto it. */
function firstInstallCode(code: CatalogUpdateFailureCode): CatalogFailureCode {
  if (FAILURE_CODES.has(code as CatalogFailureCode)) return code as CatalogFailureCode;
  return code === 'integrity' ? 'digest' : 'network';
}

function queryForReceipt(
  port: CatalogPort,
  definition: BoardDefinition,
  receipt: CatalogReceipt,
): CatalogQueryPort {
  return createKilterCatalog(
    port,
    definition,
    catalogProvenance(receipt.manifest),
    catalogRatingScale(receipt.manifest),
  );
}

function installError(result: Extract<CatalogInstallResult, { ok: false }>) {
  return Object.freeze({ code: result.code, message: result.message });
}

type InstallTarget = 'offer' | 'update';

export function createCatalogService(
  definition: BoardDefinition,
  dependencies: CatalogServiceDependencies,
): CatalogService {
  const updates = dependencies.updates ?? noCatalogUpdates;
  const preferences = dependencies.updatePreferences ?? localCatalogUpdatePreferences();
  const clock = dependencies.now ?? (() => Date.now());
  const listeners = new Set<() => void>();
  let snapshot: CatalogServiceSnapshot = Object.freeze({
    ...INITIAL,
    update: Object.freeze({ ...INITIAL_CATALOG_UPDATE, lastCheckedAt: preferences.read().lastCheckedAt }),
  });
  let port: (CatalogPort & CatalogBootstrapPort) | null = null;
  let lastReceipt: CatalogReceipt | null = null;
  let lastQueries: CatalogQueryPort | null = null;
  let startPromise: Promise<void> | null = null;
  let operationPromise: Promise<void> | null = null;
  let retryPromise: Promise<void> | null = null;
  let checkPromise: Promise<void> | null = null;
  let closePromise: Promise<void> | null = null;
  let downloadAbort: AbortController | null = null;
  let metadataAbort: AbortController | null = null;
  let checkAbort: AbortController | null = null;
  /** The first-install offer that came from the signed-in endpoint rather than the bundle. */
  let remoteOffer: CatalogManifest | null = null;
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
      && snapshot.update === next.update
    ) return;
    snapshot = Object.freeze(next);
    for (const listener of [...listeners]) listener();
  };

  const update = (changes: Partial<CatalogServiceSnapshot>) => publish({ ...snapshot, ...changes });

  const updateState = (changes: Partial<CatalogUpdateState>, extra: Partial<CatalogServiceSnapshot> = {}) => {
    update({ ...extra, update: Object.freeze({ ...snapshot.update, ...changes }) });
  };

  const queriesFor = (activePort: CatalogPort, receipt: CatalogReceipt): CatalogQueryPort => {
    if (lastReceipt?.manifest.sha256 === receipt.manifest.sha256 && lastQueries) return lastQueries;
    lastReceipt = receipt;
    lastQueries = queryForReceipt(activePort, definition, receipt);
    return lastQueries;
  };

  const installedVersion = (): number | null => (
    snapshot.storage?.status === 'ready' ? snapshot.storage.receipt.manifest.version : null
  );

  const isDismissed = (version: number): boolean => {
    const dismissedVersion = preferences.read().dismissedVersion;
    return dismissedVersion !== null && version <= dismissedVersion;
  };

  const recordCheck = (result: CatalogUpdateCheck) => {
    if (result.status !== 'available' && result.status !== 'none') return;
    const lastCheckedAt = clock();
    preferences.write({
      ...preferences.read(),
      lastCheckedAt,
      stagedVersion: result.status === 'available' ? result.version : null,
    });
    updateState({ lastCheckedAt });
  };

  /** Reads the natively staged manifest and holds it to the update contract. */
  const stagedManifest = async (version: number, signal: AbortSignal): Promise<BoardseshCatalogManifest> => {
    const manifest = await fetchCatalogManifest(dependencies.fetcher, signal, PRIVATE_CATALOG_PATH);
    if (manifest.schemaVersion !== 3 || manifest.version !== version) {
      throw new CatalogBootstrapError('manifest', 'The staged catalog update does not match the checked version.');
    }
    if (manifest.layoutRevision !== definition.layoutRevision) {
      throw new CatalogBootstrapError('manifest', 'This catalog was built for a different board layout revision.');
    }
    return manifest;
  };

  /** Publishes an offer only when it is newer than the installed receipt (never a downgrade). */
  const offerUpdate = (manifest: BoardseshCatalogManifest) => {
    const installed = installedVersion();
    if (installed === null || manifest.version <= installed) {
      updateState({ availability: 'current', offer: null, changes: null, dismissed: false, error: null });
      return;
    }
    updateState({
      availability: 'available',
      offer: manifest,
      changes: manifest.changes,
      dismissed: isDismissed(manifest.version),
      error: null,
    });
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

  /** Signed in with a published catalog: prefer it over the bundled legacy snapshot. */
  const remoteFirstOffer = async (signal: AbortSignal): Promise<BoardseshCatalogManifest | null> => {
    let result: CatalogUpdateCheck;
    try {
      result = await updates.check();
    } catch {
      return null;
    }
    if (disposed || signal.aborted) return null;
    recordCheck(result);
    if (result.status !== 'available') {
      updateState({ availability: result.status === 'none' ? 'current' : result.status });
      return null;
    }
    try {
      const manifest = await stagedManifest(result.version, signal);
      updateState({ availability: 'current' });
      return manifest;
    } catch {
      return null;
    }
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
        const remote = await remoteFirstOffer(controller.signal);
        if (disposed || currentGeneration !== generation) return;
        if (remote) {
          remoteOffer = remote;
          update({ offer: remote, operation: 'idle', error: null });
          return;
        }
        remoteOffer = null;
        const offer = await fetchCatalogManifest(dependencies.fetcher, controller.signal);
        if (disposed || currentGeneration !== generation) return;
        if (offer.schemaVersion === 3 && offer.layoutRevision !== definition.layoutRevision) {
          throw new CatalogBootstrapError('manifest', 'This catalog was built for a different board layout revision.');
        }
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

  /**
   * Shared verified install: optional native preparation, same-origin hash-checked download,
   * then the A/B slot install. `update` failures leave the active catalog and report through
   * the update state; `offer` failures keep the first-install behavior.
   */
  const install = async (
    approved: CatalogManifest,
    target: InstallTarget,
    basePath: CatalogBasePath,
  ): Promise<void> => {
    if (!port) return;
    const activePort = port;
    const currentGeneration = generation;
    const controller = new AbortController();
    downloadAbort = controller;
    const remote = basePath === PRIVATE_CATALOG_PATH;
    const stale = () => disposed || currentGeneration !== generation;
    if (target === 'update') updateState({ error: null }, { operation: 'downloading', progress: null, error: null });
    else update({ operation: 'downloading', progress: null, error: null });

    const reportFailure = (error: Readonly<{ code: CatalogUpdateFailureCode; message: string }>, clearOffer: boolean) => {
      if (target === 'update') {
        updateState({ error }, { operation: 'idle', progress: null });
      } else {
        update({
          operation: 'idle',
          progress: null,
          error: Object.freeze({ code: firstInstallCode(error.code), message: error.message }),
          ...(clearOffer ? { offer: null } : {}),
        });
      }
    };

    const pending = (async () => {
      try {
        if (remote) await updates.prepare(approved.version);
        if (stale()) return;
        if (controller.signal.aborted) throw new CatalogBootstrapError('aborted', 'Catalog download was cancelled');
        const compressed = await fetchCatalogSnapshot(
          approved,
          dependencies.fetcher,
          (progress) => {
            if (!stale() && !controller.signal.aborted) {
              update({ progress: Object.freeze(progress) });
            }
          },
          controller.signal,
          basePath,
        );
        if (stale()) return;
        if (controller.signal.aborted) {
          reportFailure(failureOf(new CatalogBootstrapError('aborted', 'Catalog download was cancelled'), 'aborted', 'Catalog download was cancelled.'), false);
          return;
        }
        downloadAbort = null;
        update({ operation: 'installing', progress: null, error: null, queries: null });
        const result = await activePort.installCatalog(approved, compressed);
        if (stale()) return;
        if (result.ok) {
          const storage: CatalogStorageStatus = { status: 'ready', receipt: result.receipt };
          const changes: Partial<CatalogServiceSnapshot> = {
            storage,
            operation: 'idle',
            progress: null,
            error: null,
            queries: queriesFor(activePort, result.receipt),
          };
          if (target === 'update' || remote) {
            updateState({ availability: 'current', offer: null, changes: null, dismissed: false, error: null }, changes);
          } else {
            update(changes);
          }
        } else if (result.code === 'closed' || result.code === 'busy') {
          const error = installError(result);
          if (port === activePort) port = null;
          lastQueries = null;
          lastReceipt = null;
          await activePort.close().catch(() => undefined);
          if (stale()) return;
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
          const restored: Partial<CatalogServiceSnapshot> = {
            storage,
            operation: 'idle',
            progress: null,
            queries: result.retained ? queriesFor(activePort, result.retained) : null,
          };
          if (target === 'update' && result.retained) {
            updateState({ error: installError(result) }, { ...restored, error: null });
          } else {
            update({ ...restored, error: installError(result) });
          }
        }
      } catch (cause) {
        if (stale()) return;
        const fallbackCode = controller.signal.aborted
          ? 'aborted'
          : snapshot.operation === 'installing' ? 'storage' : 'network';
        const error = updateFailureOf(cause, fallbackCode,
          controller.signal.aborted ? 'Catalog download was cancelled.' : 'The catalog could not be installed.');
        if (snapshot.operation === 'installing') {
          port = null;
          lastQueries = null;
          lastReceipt = null;
          await activePort.close().catch(() => undefined);
          if (!stale()) {
            const storageError = failureOf(cause, fallbackCode, error.message);
            update({
              storage: { status: 'unavailable', code: storageError.code, message: storageError.message },
              operation: 'idle',
              progress: null,
              error: storageError,
              queries: null,
            });
          }
        } else {
          if (cause instanceof CatalogUpdateError && cause.code === 'signed-out') {
            updateState({ availability: 'signed-out' });
          }
          // A remote first-install offer that this account can no longer prepare falls back
          // to "Check again", which re-checks and can offer the bundled snapshot instead.
          const clearOffer = target === 'offer' && remote && cause instanceof CatalogUpdateError
            && (cause.code === 'signed-out' || cause.code === 'not-admitted');
          if (clearOffer) remoteOffer = null;
          reportFailure(error, clearOffer);
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

  const installOffer = async (): Promise<void> => {
    if (
      disposed
      || snapshot.operation !== 'idle'
      || !snapshot.offer
      || (snapshot.storage?.status !== 'empty' && snapshot.storage?.status !== 'ready')
      || !port
    ) return;
    const approved = snapshot.offer;
    await install(approved, 'offer', approved === remoteOffer ? PRIVATE_CATALOG_PATH : BUNDLED_CATALOG_PATH);
  };

  const installUpdate = async (): Promise<void> => {
    const approved = snapshot.update.offer;
    if (
      disposed
      || snapshot.operation !== 'idle'
      || snapshot.update.checking
      || !approved
      || snapshot.storage?.status !== 'ready'
      || !port
    ) return;
    const installed = snapshot.storage.receipt.manifest;
    if (approved.version <= installed.version || approved.layoutRevision !== definition.layoutRevision) {
      updateState({ availability: 'current', offer: null, changes: null, dismissed: false });
      return;
    }
    await install(approved, 'update', PRIVATE_CATALOG_PATH);
  };

  const dismissUpdate = () => {
    const offer = snapshot.update.offer;
    if (disposed || !offer) return;
    const current = preferences.read();
    preferences.write({
      ...current,
      dismissedVersion: Math.max(current.dismissedVersion ?? 0, offer.version),
    });
    updateState({ dismissed: true });
  };

  /** Offline re-offer of a version an earlier check already staged natively. */
  const restoreStagedOffer = async (signal: AbortSignal, stale: () => boolean) => {
    if (snapshot.update.offer) return;
    const { stagedVersion, lastCheckedAt } = preferences.read();
    const installed = installedVersion();
    if (installed === null) return;
    if (stagedVersion === null || stagedVersion <= installed) {
      if (lastCheckedAt !== null && snapshot.update.availability === 'unknown') updateState({ availability: 'current' });
      return;
    }
    try {
      const manifest = await stagedManifest(stagedVersion, signal);
      if (!stale()) offerUpdate(manifest);
    } catch {
      // Nothing staged any more; the next due check asks the endpoint again.
    }
  };

  const checkForUpdate = (options: Readonly<{ force?: boolean }> = {}): Promise<void> => {
    if (checkPromise) return checkPromise;
    if (disposed || snapshot.operation !== 'idle' || snapshot.storage?.status !== 'ready') return Promise.resolve();
    const { lastCheckedAt } = preferences.read();
    const now = clock();
    const due = options.force === true || lastCheckedAt === null
      || now < lastCheckedAt || now - lastCheckedAt >= CATALOG_UPDATE_CHECK_INTERVAL_MS;
    const currentGeneration = generation;
    const controller = new AbortController();
    checkAbort = controller;
    const stale = () => disposed || currentGeneration !== generation || controller.signal.aborted;

    const pending = (async () => {
      if (!due) {
        await restoreStagedOffer(controller.signal, stale);
        return;
      }
      updateState({ checking: true, error: null });
      try {
        const result = await updates.check();
        if (stale()) return;
        recordCheck(result);
        if (result.status !== 'available' || (installedVersion() ?? Infinity) >= result.version) {
          const availability = result.status === 'unconfigured' || result.status === 'signed-out'
            ? result.status : 'current';
          updateState({ availability, checking: false, offer: null, changes: null, dismissed: false });
          return;
        }
        const manifest = await stagedManifest(result.version, controller.signal);
        if (stale()) return;
        offerUpdate(manifest);
        updateState({ checking: false });
      } catch (cause) {
        if (stale()) return;
        const error = updateFailureOf(cause, 'network', 'Catalog updates could not be checked.');
        updateState({
          checking: false,
          error,
          ...(error.code === 'signed-out' ? { availability: 'signed-out' as const, offer: null, changes: null } : {}),
        });
      }
    })();
    checkPromise = pending.finally(() => {
      if (checkAbort === controller) checkAbort = null;
      if (checkPromise === wrapped) checkPromise = null;
    });
    const wrapped = checkPromise;
    return wrapped;
  };

  const retryOpen = (): Promise<void> => {
    if (retryPromise) return retryPromise;
    if (disposed || snapshot.operation !== 'idle' || snapshot.storage?.status !== 'unavailable') return Promise.resolve();
    const oldPort = port;
    port = null;
    lastQueries = null;
    lastReceipt = null;
    remoteOffer = null;
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
    checkAbort?.abort();
    const currentStart = startPromise;
    const currentOperation = operationPromise;
    const currentRetry = retryPromise;
    const currentCheck = checkPromise;
    closePromise = (async () => {
      await Promise.allSettled(
        [currentStart, currentOperation, currentRetry, currentCheck].filter(Boolean) as Promise<void>[],
      );
      const activePort = port;
      port = null;
      if (activePort) {
        try { await activePort.close(); } catch { /* Port close always terminates its worker. */ }
      }
      listeners.clear();
      lastQueries = null;
      lastReceipt = null;
      remoteOffer = null;
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
    checkForUpdate,
    installUpdate,
    dismissUpdate,
    close,
  });
}
