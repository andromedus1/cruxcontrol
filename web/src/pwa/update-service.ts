/**
 * Coordinates the service-worker lifecycle with the local editor lifecycle.
 *
 * This module intentionally uses the browser primitives directly. The PWA
 * plugin's prompt helper owns a global reload listener, which is too eager for
 * a workspace that can be driving a board or persisting local data.
 */

export type AppUpdateStatus =
  | 'unavailable'
  | 'current'
  | 'waiting'
  | 'applying'
  | 'reload-required'
  | 'error';

export interface AppUpdateSnapshot {
  readonly status: AppUpdateStatus;
  readonly phase: AppUpdateStatus;
  readonly message: string;
  readonly updateAvailable: boolean;
  readonly blockedReason: string | null;
  readonly canApply: boolean;
  readonly dismissed: boolean;
}

export type AppUpdateListener = (snapshot: AppUpdateSnapshot) => void;

export interface AppUpdateService {
  getSnapshot(): AppUpdateSnapshot;
  subscribe(listener: AppUpdateListener): () => void;
  /** Resolves only after this tab has been admitted under the current controller. */
  start(): Promise<void>;
  /** Requests a safe activation of the currently waiting worker. */
  apply(): Promise<void>;
  /** Reports workspace work that must settle before activation. */
  setBlocked(reason: string | null): void;
  /** Hides the prominent prompt while retaining the update action. */
  dismiss?(): void;
  /** Reopens a prompt previously dismissed with Later. */
  reopen?(): void;
  /** Explicitly retries a reload-required admission. */
  reload?(): void;
  /** Retries a failed registration or update request. */
  retry?(): Promise<void>;
  dispose(): void;
}

export interface AppUpdateServiceDependencies {
  readonly container?: ServiceWorkerContainer | null;
  readonly locks?: LockManager | null;
  readonly location?: Location;
  readonly document?: Document;
  readonly register?: (
    scriptURL: string,
    options?: RegistrationOptions,
  ) => Promise<ServiceWorkerRegistration>;
  readonly visible?: () => boolean;
  readonly reload?: () => void;
  readonly baseUrl?: string;
  readonly lockName?: string;
  readonly activationTimeoutMs?: number;
}

type ViteImportMeta = ImportMeta & {
  readonly env?: { readonly BASE_URL?: string };
};

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T | PromiseLike<T>) => void;
  readonly reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>['resolve'];
  let reject!: Deferred<T>['reject'];
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function isWorker(value: ServiceWorker | null | undefined): value is ServiceWorker {
  return Boolean(value && typeof value.postMessage === 'function');
}

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function updateUrl(baseUrl: string, location: Location | undefined): string {
  const href = location?.href ??
    (typeof globalThis.location !== 'undefined' ? globalThis.location.href : 'http://localhost/');
  return new URL('sw.js', new URL(baseUrl || '/', href)).href;
}

const INITIAL: AppUpdateSnapshot = Object.freeze({
  status: 'current',
  phase: 'current',
  message: 'CruxControl is up to date.',
  updateAvailable: false,
  blockedReason: null,
  canApply: false,
  dismissed: false,
});

export class UpdateAdmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpdateAdmissionError';
  }
}

export function createAppUpdateService(
  dependencies: AppUpdateServiceDependencies = {},
): AppUpdateService {
  const container = dependencies.container ??
    (typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined);
  const locks = dependencies.locks === undefined
    ? (typeof navigator !== 'undefined' ? navigator.locks : undefined)
    : dependencies.locks;
  const pageLocation = dependencies.location ??
    (typeof globalThis.location !== 'undefined' ? globalThis.location : undefined);
  const lockName = dependencies.lockName ?? 'cruxcontrol-app';
  const timeoutMs = dependencies.activationTimeoutMs ?? 15_000;
  const listeners = new Set<AppUpdateListener>();
  const cleanups: Array<() => void> = [];
  const activationWaits = new Set<() => void>();

  let snapshot: AppUpdateSnapshot = INITIAL;
  let registration: ServiceWorkerRegistration | null = null;
  let waiting: ServiceWorker | null = null;
  let startPromise: Promise<void> | null = null;
  let applyPromise: Promise<void> | null = null;
  let sharedRelease: (() => void) | null = null;
  let sharedRequest: Promise<unknown> | null = null;
  let exclusiveRelease: (() => void) | null = null;
  let capturedController: ServiceWorker | null = null;
  let disposed = false;

  const isVisible = () =>
    dependencies.visible?.() ??
    (dependencies.document?.visibilityState ??
      (typeof document !== 'undefined' ? document.visibilityState : 'visible')) === 'visible';

  const publish = (next: Omit<AppUpdateSnapshot, 'phase'>) => {
    if (disposed) return;
    snapshot = Object.freeze({ ...next, phase: next.status });
    for (const listener of [...listeners]) listener(snapshot);
  };

  const setWaiting = (worker: ServiceWorker) => {
    const isNewWorker = waiting !== worker;
    waiting = worker;
    publish({
      status: 'waiting',
      message: snapshot.blockedReason ?? 'Your library is saved. Reload when you are ready.',
      updateAvailable: true,
      blockedReason: snapshot.blockedReason,
      canApply: !snapshot.blockedReason,
      dismissed: isNewWorker ? false : snapshot.dismissed,
    });
  };

  const setCurrent = () => {
    waiting = null;
    publish({
      status: 'current',
      message: 'CruxControl is up to date.',
      updateAvailable: false,
      blockedReason: snapshot.blockedReason,
      canApply: false,
      dismissed: snapshot.dismissed,
    });
  };

  const reportError = (cause: unknown, fallback: string) => {
    publish({
      status: 'error',
      message: messageOf(cause, fallback),
      updateAvailable: Boolean(waiting),
      blockedReason: snapshot.blockedReason,
      canApply: false,
      dismissed: snapshot.dismissed,
    });
  };

  const workerState = (worker: ServiceWorker | null | undefined) => {
    if (!isWorker(worker)) return;
    if (worker.state === 'installed') {
      if (registration?.active && worker !== registration.active) setWaiting(worker);
    }
  };

  const observeWorker = (worker: ServiceWorker | null | undefined) => {
    if (!isWorker(worker)) return;
    const onState = () => workerState(worker);
    worker.addEventListener('statechange', onState);
    cleanups.push(() => worker.removeEventListener('statechange', onState));
    workerState(worker);
  };

  const observeRegistration = (next: ServiceWorkerRegistration) => {
    registration = next;
    const onUpdateFound = () => observeWorker(next.installing);
    next.addEventListener('updatefound', onUpdateFound);
    cleanups.push(() => next.removeEventListener('updatefound', onUpdateFound));
    observeWorker(next.waiting);
    observeWorker(next.installing);
    if (!next.waiting && !next.installing) setCurrent();
  };

  const releaseSharedAndWait = async () => {
    const release = sharedRelease;
    const request = sharedRequest;
    sharedRelease = null;
    sharedRequest = null;
    release?.();
    if (request) await request.catch(() => undefined);
  };

  const acquireShared = async (): Promise<void> => {
    if (!locks) return;
    if (sharedRequest && sharedRelease) return;
    const granted = deferred<void>();
    const held = deferred<void>();
    let request: Promise<unknown>;
    try {
      request = locks.request(lockName, { mode: 'shared' }, async (lock) => {
        if (!lock) {
          const error = new UpdateAdmissionError('Could not obtain shared CruxControl admission.');
          granted.reject(error);
          throw error;
        }
        sharedRelease = held.resolve;
        granted.resolve();
        await held.promise;
      });
    } catch (cause) {
      granted.reject(cause);
      throw cause;
    }
    sharedRequest = request;
    request.catch((cause: unknown) => granted.reject(cause));
    try {
      await granted.promise;
    } catch (cause) {
      sharedRelease = null;
      sharedRequest = null;
      await request.catch(() => undefined);
      throw cause;
    }
  };

  const controllerChanged = () => capturedController !== (container?.controller ?? null);

  const guardController = () => {
    if (!controllerChanged()) return true;
    publish({
      status: 'reload-required',
      message: 'The update finished while this tab was opening. Reload to continue with the new version.',
      updateAvailable: true,
      blockedReason: null,
      canApply: false,
      dismissed: false,
    });
    return false;
  };

  const start = (): Promise<void> => {
    if (startPromise) return startPromise;
    if (disposed) return Promise.reject(new UpdateAdmissionError('Update service is disposed.'));
    startPromise = (async () => {
      if (!container || typeof container.register !== 'function') {
        publish({ ...INITIAL, status: 'unavailable', message: 'Service workers are unavailable in this browser.' });
        return;
      }
      capturedController = container.controller;
      const onExternalControllerChange = () => {
        if (snapshot.status === 'applying') return;
        guardController();
      };
      container.addEventListener('controllerchange', onExternalControllerChange);
      cleanups.push(() => container.removeEventListener('controllerchange', onExternalControllerChange));
      try {
        const register = dependencies.register ?? ((url: string, options?: RegistrationOptions) => container.register(url, options));
        const baseUrl = dependencies.baseUrl ?? (import.meta as unknown as ViteImportMeta).env?.BASE_URL ?? '/';
        const next = await register(updateUrl(baseUrl, pageLocation), { scope: baseUrl });
        if (disposed) return;
        observeRegistration(next);
        await acquireShared();
        if (!guardController()) {
          await releaseSharedAndWait();
          throw new UpdateAdmissionError(snapshot.message);
        }
      } catch (cause) {
        if (cause instanceof UpdateAdmissionError && snapshot.status === 'reload-required') throw cause;
        reportError(cause, 'Could not register CruxControl updates. Retry to continue.');
        await releaseSharedAndWait();
        throw new UpdateAdmissionError(snapshot.message);
      }
    })();
    startPromise.catch(() => {
      if (!disposed) startPromise = null;
    });
    return startPromise;
  };

  const reacquireAfterExclusiveFailure = async (message: string) => {
    // Tell the requester why it is protected before waiting for the shared
    // lease. The lease cannot be reacquired until the competing tab closes.
    publish({
      status: 'waiting',
      message,
      updateAvailable: true,
      blockedReason: snapshot.blockedReason,
      canApply: false,
      dismissed: false,
    });
    await acquireShared();
    if (!guardController()) return;
    publish({
      status: 'waiting',
      message,
      updateAvailable: true,
      blockedReason: snapshot.blockedReason,
      canApply: !snapshot.blockedReason,
      dismissed: snapshot.dismissed,
    });
  };

  const apply = (): Promise<void> => {
    if (applyPromise) return applyPromise;
    applyPromise = (async () => {
      const activationOutcome = deferred<void>();
      const target = waiting;
      const oldController = container?.controller ?? null;
      if (!target || snapshot.status !== 'waiting') return;
      if (!isVisible()) {
        publish({ ...snapshot, status: 'waiting', message: 'Keep this tab visible while updating.', canApply: false });
        return;
      }
      if (snapshot.blockedReason) return;
      publish({ ...snapshot, status: 'applying', message: 'Installing update…', canApply: false, dismissed: false });
      await releaseSharedAndWait();
      if (!locks) {
        if (registration?.waiting !== target) {
          publish({ ...snapshot, status: 'waiting', message: 'The update is no longer waiting. Try again.', canApply: false });
          activationOutcome.resolve();
          return;
        }
        const activation = waitForActivation(target, oldController, false, activationOutcome);
        try {
          target.postMessage({ type: 'SKIP_WAITING' });
        } catch (cause) {
          reportError(cause, 'Could not ask the waiting update to activate.');
          for (const cancel of [...activationWaits]) cancel();
          activationOutcome.resolve();
          return;
        }
        await activation;
        return;
      }

      const acquired = deferred<boolean>();
      const held = deferred<void>();
      const request = locks.request(lockName, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
        if (!lock) {
          acquired.resolve(false);
          return;
        }
        exclusiveRelease = held.resolve;
        acquired.resolve(true);
        if (!registration || registration.waiting !== target || snapshot.blockedReason || !isVisible() || container?.controller !== oldController) {
          publish({ ...snapshot, status: 'waiting', message: snapshot.blockedReason ?? 'Finish current work before updating.', canApply: !snapshot.blockedReason });
          exclusiveRelease = null;
          held.resolve();
          activationOutcome.resolve();
          return;
        }
        const activation = waitForActivation(target, oldController, true, activationOutcome);
        try {
          target.postMessage({ type: 'SKIP_WAITING' });
        } catch (cause) {
          reportError(cause, 'Could not ask the waiting update to activate.');
          for (const cancel of [...activationWaits]) cancel();
          exclusiveRelease = null;
          held.resolve();
          activationOutcome.resolve();
          return;
        }
        await activation;
        if (snapshot.status === 'waiting') {
          exclusiveRelease = null;
          held.resolve();
        } else {
          await held.promise;
        }
      });
      request.catch((cause: unknown) => acquired.reject(cause));
      const hasLock = await acquired.promise;
      if (!hasLock) {
        await request.catch(() => undefined);
        await reacquireAfterExclusiveFailure('Close your other CruxControl tabs, then try updating again.');
        return;
      }
      // Activation timeout deliberately resolves apply while its callback keeps
      // the exclusive lease. This protects the old editor until reload or tab close.
      await activationOutcome.promise;
      if (snapshot.status === 'waiting') {
        await acquireShared();
      }
    })();
    applyPromise = applyPromise.catch((cause) => {
      if (!disposed) reportError(cause, 'Could not apply the update.');
      throw cause;
    }).finally(() => {
      applyPromise = null;
    });
    return applyPromise;

    async function waitForActivation(
      targetWorker: ServiceWorker,
      old: ServiceWorker | null,
      keepLease = false,
      outcomeToResolve = deferred<void>(),
    ): Promise<void> {
      const onControllerChange = () => {
        if (container?.controller !== targetWorker) return;
        cleanup();
        publish({ ...snapshot, status: 'applying', message: 'Update ready. Reloading…', canApply: false });
        (dependencies.reload ?? (() => pageLocation?.reload()))();
        outcomeToResolve.resolve();
      };
      const timer = setTimeout(() => {
        cleanup();
        if (targetWorker.state === 'redundant' && container?.controller === old) {
          publish({ ...snapshot, status: 'waiting', message: 'The update could not activate. Try updating again.', canApply: !snapshot.blockedReason });
        } else {
          publish({ ...snapshot, status: 'reload-required', message: 'Update activation is taking longer than expected. Reload or close this tab to finish safely.', canApply: false, dismissed: false });
        }
        outcomeToResolve.resolve();
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        container?.removeEventListener('controllerchange', onControllerChange);
        targetWorker.removeEventListener('statechange', onTargetState);
        activationWaits.delete(cancel);
      };
      const cancel = () => {
        cleanup();
        outcomeToResolve.resolve();
      };
      activationWaits.add(cancel);
      const onTargetState = () => {
        if (targetWorker.state !== 'redundant') return;
        cleanup();
        if (container?.controller === old) {
          publish({ ...snapshot, status: 'waiting', message: 'The update could not activate. Try updating again.', canApply: !snapshot.blockedReason });
        }
        outcomeToResolve.resolve();
      };
      container?.addEventListener('controllerchange', onControllerChange);
      targetWorker.addEventListener('statechange', onTargetState);
      await outcomeToResolve.promise;
      if (!keepLease) exclusiveRelease?.();
    }
  };

  const service: AppUpdateService = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot);
      return () => listeners.delete(listener);
    },
    start,
    apply,
    setBlocked(reason) {
      const blockedReason = reason || null;
      if (snapshot.status === 'applying' || snapshot.status === 'reload-required') return;
      if (snapshot.status === 'waiting' || snapshot.status === 'error') {
        publish({ ...snapshot, blockedReason, canApply: snapshot.status === 'waiting' && !blockedReason, message: blockedReason ?? 'Your library is saved. Reload when you are ready.' });
      } else {
        snapshot = Object.freeze({ ...snapshot, blockedReason });
      }
    },
    dismiss() {
      if (snapshot.status === 'waiting') publish({ ...snapshot, dismissed: true });
    },
    reopen() {
      if (snapshot.status === 'waiting') publish({ ...snapshot, dismissed: false });
    },
    reload() {
      (dependencies.reload ?? (() => pageLocation?.reload()))();
    },
    retry() {
      if (waiting) {
        publish({
          status: 'waiting',
          message: snapshot.blockedReason ?? 'Your library is saved. Reload when you are ready.',
          updateAvailable: true,
          blockedReason: snapshot.blockedReason,
          canApply: !snapshot.blockedReason,
          dismissed: false,
        });
        return apply();
      }
      return start();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const cleanup of cleanups.splice(0)) cleanup();
      for (const cancel of [...activationWaits]) cancel();
      sharedRelease?.();
      exclusiveRelease?.();
      sharedRelease = null;
      exclusiveRelease = null;
    },
  };

  return service;
}
