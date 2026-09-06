import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppUpdateService, type AppUpdateServiceDependencies } from './update-service.ts';

class FakeWorker extends EventTarget {
  state: ServiceWorkerState = 'installed';
  readonly messages: unknown[] = [];
  postMessage(message: unknown): void {
    this.messages.push(message);
  }
}

class FakeRegistration extends EventTarget {
  active: ServiceWorker | null = null;
  waiting: ServiceWorker | null = null;
  installing: ServiceWorker | null = null;
}

class FakeContainer extends EventTarget {
  controller: ServiceWorker | null = null;
  register = vi.fn<NonNullable<AppUpdateServiceDependencies['register']>>();
}

interface ControlledRequest {
  mode: 'shared' | 'exclusive';
  callback: (lock: Lock | null) => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (cause: unknown) => void;
  releaseOuter: () => void;
  callbackValue?: unknown;
  callbackSettled: boolean;
  outerReleased: boolean;
}

function controlledLocks() {
  const requests: ControlledRequest[] = [];
  const locks = {
    request: vi.fn((_name: string, options: LockOptions, callback: (lock: Lock | null) => Promise<unknown>) => {
      let resolve!: (value: unknown) => void;
      let reject!: (cause: unknown) => void;
      let releaseOuter!: () => void;
      const entry: ControlledRequest = {
        mode: options.mode ?? 'exclusive',
        callback,
        resolve: () => undefined,
        reject: () => undefined,
        releaseOuter: () => undefined,
        callbackSettled: false,
        outerReleased: false,
      };
      const request = new Promise<unknown>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
        releaseOuter = () => {
          entry.outerReleased = true;
          if (entry.callbackSettled) resolve(entry.callbackValue);
        };
      });
      entry.resolve = resolve;
      entry.reject = reject;
      entry.releaseOuter = releaseOuter;
      requests.push(entry);
      return request;
    }),
  } as unknown as LockManager;

  const grant = (index: number, lock: Lock | null = { name: 'cruxcontrol-app', mode: 'shared' } as Lock) => {
    const entry = requests[index];
    if (!entry) throw new Error(`No lock request at index ${index}`);
    void Promise.resolve(entry.callback(entry.mode === 'exclusive' ? lock : { name: 'cruxcontrol-app', mode: 'shared' } as Lock)).then(
      (value) => {
        entry.callbackValue = value;
        entry.callbackSettled = true;
        if (entry.mode === 'exclusive' || entry.outerReleased) entry.resolve(value);
      },
      (cause) => entry.reject(cause),
    );
  };

  return { locks, requests, grant };
}

function setup() {
  const container = new FakeContainer();
  const registration = new FakeRegistration();
  const current = new FakeWorker();
  const next = new FakeWorker();
  registration.active = current as unknown as ServiceWorker;
  registration.waiting = next as unknown as ServiceWorker;
  container.controller = current as unknown as ServiceWorker;
  container.register.mockResolvedValue(registration as unknown as ServiceWorkerRegistration);
  const requests: Array<{
    mode: 'shared' | 'exclusive';
    callback: (lock: Lock | null) => Promise<unknown>;
    ifAvailable?: boolean;
  }> = [];
  const held = new Set<Promise<void>>();
  const locks = {
    request: vi.fn(async (_name: string, options: LockOptions, callback: (lock: Lock | null) => Promise<unknown>) => {
      requests.push({ mode: options.mode ?? 'exclusive', callback, ifAvailable: options.ifAvailable });
      if (options.mode === 'shared') {
        const hold = callback({ name: 'cruxcontrol-app', mode: 'shared' } as Lock);
        held.add(hold.then(() => undefined));
        return hold;
      }
      return callback({ name: 'cruxcontrol-app', mode: 'exclusive' } as Lock);
    }),
  } as unknown as LockManager;
  return { container, registration, current, next, locks, requests, held };
}

afterEach(() => vi.useRealTimers());

describe('createAppUpdateService', () => {
  it('does not admit the workspace until the shared lock callback is granted', async () => {
    const { container } = setup();
    let resolveLock!: () => void;
    const gatedLocks = {
      request: vi.fn((_name: string, options: LockOptions, callback: (lock: Lock | null) => Promise<unknown>) => {
        if (options.mode === 'shared') {
          return new Promise((resolve, reject) => {
            resolveLock = () => void callback({ name: 'cruxcontrol-app', mode: 'shared' } as Lock).then(resolve, reject);
          });
        }
        return callback({ name: 'cruxcontrol-app', mode: 'exclusive' } as Lock);
      }),
    } as unknown as LockManager;
    const service = createAppUpdateService({ container: container as unknown as ServiceWorkerContainer, locks: gatedLocks });
    const admission = service.start();
    await vi.waitFor(() => expect(container.register).toHaveBeenCalled());
    let admitted = false;
    void admission.then(() => { admitted = true; });
    await Promise.resolve();
    expect(admitted).toBe(false);
    resolveLock();
    await admission;
    expect(service.getSnapshot().status).toBe('waiting');
    service.dispose();
  });

  it('reacquires shared admission when another tab owns the exclusive lease', async () => {
    const { container, next } = setup();
    const modes: Array<'shared' | 'exclusive'> = [];
    const locks = {
      request: vi.fn((_name: string, options: LockOptions, callback: (lock: Lock | null) => Promise<unknown>) => {
        const mode = options.mode ?? 'exclusive';
        modes.push(mode);
        return callback(mode === 'exclusive' ? null : { name: 'cruxcontrol-app', mode } as Lock);
      }),
    } as unknown as LockManager;
    const service = createAppUpdateService({
      container: container as unknown as ServiceWorkerContainer,
      locks,
    });

    await service.start();
    await service.apply();

    expect(modes).toEqual(['shared', 'exclusive', 'shared']);
    expect(next.messages).toEqual([]);
    expect(service.getSnapshot()).toMatchObject({ status: 'waiting', canApply: true });
    service.dispose();
  });

  it('keeps admission blocked when the available lock API rejects', async () => {
    const { container } = setup();
    const locks = {
      request: vi.fn(async () => {
        throw new Error('lock service unavailable');
      }),
    } as unknown as LockManager;
    const service = createAppUpdateService({
      container: container as unknown as ServiceWorkerContainer,
      locks,
    });

    await expect(service.start()).rejects.toThrow('lock service unavailable');
    expect(service.getSnapshot()).toMatchObject({
      status: 'error',
      message: 'lock service unavailable',
      canApply: false,
    });
    service.dispose();
  });

  it('opens under shared admission when registration fails and retries registration in place', async () => {
    const { container, registration, locks } = setup();
    container.register
      .mockRejectedValueOnce(new Error('Service worker script unavailable.'))
      .mockResolvedValueOnce(registration as unknown as ServiceWorkerRegistration);
    const service = createAppUpdateService({
      container: container as unknown as ServiceWorkerContainer,
      locks,
    });

    await expect(service.start()).resolves.toBeUndefined();
    expect(service.getSnapshot()).toMatchObject({
      status: 'error',
      message: 'Service worker script unavailable.',
      canApply: false,
    });
    await service.retry?.();
    expect(container.register).toHaveBeenCalledTimes(2);
    expect(service.getSnapshot().status).toBe('waiting');
    service.dispose();
  });

  it('requires an explicit reload when the controller changes during admission', async () => {
    const { container } = setup();
    let resolveLock!: () => void;
    const locks = {
      request: vi.fn((_name: string, options: LockOptions, callback: (lock: Lock | null) => Promise<unknown>) => {
        if (options.mode === 'shared') {
          return new Promise((resolve, reject) => {
            resolveLock = () => void callback({ name: 'cruxcontrol-app', mode: 'shared' } as Lock).then(resolve, reject);
          });
        }
        return callback({ name: 'cruxcontrol-app', mode: 'exclusive' } as Lock);
      }),
    } as unknown as LockManager;
    const service = createAppUpdateService({
      container: container as unknown as ServiceWorkerContainer,
      locks,
    });
    const admission = service.start();
    await vi.waitFor(() => expect(container.register).toHaveBeenCalled());
    await vi.waitFor(() => expect(locks.request).toHaveBeenCalled());
    container.controller = new FakeWorker() as unknown as ServiceWorker;
    container.dispatchEvent(new Event('controllerchange'));
    expect(service.getSnapshot().status).toBe('reload-required');
    resolveLock();
    await expect(admission).rejects.toThrow('Reload to continue');
    service.dispose();
  });

  it('keeps the workspace blocked while reacquiring shared admission after a pre-post blocker', async () => {
    const { container, next } = setup();
    const controlled = controlledLocks();
    const service = createAppUpdateService({
      container: container as unknown as ServiceWorkerContainer,
      locks: controlled.locks,
    });
    const admission = service.start();
    await vi.waitFor(() => expect(controlled.requests).toHaveLength(1));
    controlled.grant(0);
    await admission;

    const applying = service.apply();
    await vi.waitFor(() => expect(service.getSnapshot().status).toBe('applying'));
    service.setBlocked('A playlist write is still settling.');
    controlled.requests[0]?.releaseOuter();
    await vi.waitFor(() => expect(controlled.requests).toHaveLength(2));
    controlled.grant(1);
    await vi.waitFor(() => expect(controlled.requests).toHaveLength(3));

    expect(service.getSnapshot()).toMatchObject({
      status: 'applying',
      blockedReason: 'A playlist write is still settling.',
      canApply: false,
    });
    expect(next.messages).toEqual([]);
    controlled.grant(2);
    await applying;
    expect(service.getSnapshot()).toMatchObject({
      status: 'waiting',
      blockedReason: 'A playlist write is still settling.',
      canApply: false,
    });
    service.dispose();
  });

  it('applies only the captured waiting worker and reloads on its controllerchange', async () => {
    const { container, current, next, locks } = setup();
    const reload = vi.fn();
    const service = createAppUpdateService({
      container: container as unknown as ServiceWorkerContainer,
      locks,
      reload,
    });
    await service.start();
    const applying = service.apply();
    await vi.waitFor(() => expect(next.messages).toEqual([{ type: 'SKIP_WAITING' }]));
    container.controller = next as unknown as ServiceWorker;
    container.dispatchEvent(new Event('controllerchange'));
    await applying;
    expect(reload).toHaveBeenCalledTimes(1);
    expect(current.messages).toEqual([]);
    service.dispose();
  });

  it('does not apply while the requester is hidden', async () => {
    const { container, next, locks } = setup();
    const service = createAppUpdateService({
      container: container as unknown as ServiceWorkerContainer,
      locks,
      visible: () => false,
    });
    await service.start();
    await service.apply();
    expect(next.messages).toEqual([]);
    expect(service.getSnapshot()).toMatchObject({
      status: 'waiting',
      message: 'Keep this tab visible while updating.',
      canApply: false,
    });
    service.dispose();
  });

  it('discovers a newly installed worker and reopens a dismissed prompt', async () => {
    const { container, registration, locks, current } = setup();
    const service = createAppUpdateService({
      container: container as unknown as ServiceWorkerContainer,
      locks,
    });
    await service.start();
    service.dismiss?.();
    expect(service.getSnapshot().dismissed).toBe(true);

    const incoming = new FakeWorker();
    registration.installing = incoming as unknown as ServiceWorker;
    registration.dispatchEvent(new Event('updatefound'));
    expect(service.getSnapshot()).toMatchObject({
      status: 'waiting',
      updateAvailable: true,
      dismissed: false,
    });
    expect(service.getSnapshot().blockedReason).toBeNull();
    expect(current.messages).toEqual([]);
    service.dispose();
  });

  it('keeps the old tab protected after activation timeout', async () => {
    vi.useFakeTimers();
    const { container, registration, next, locks } = setup();
    const reload = vi.fn();
    const service = createAppUpdateService({
      container: container as unknown as ServiceWorkerContainer,
      locks,
      reload,
      activationTimeoutMs: 10,
    });
    await service.start();
    const applying = service.apply();
    await vi.waitFor(() => expect(next.messages).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(11);
    await applying;
    expect(service.getSnapshot().status).toBe('reload-required');
    const incoming = new FakeWorker();
    registration.installing = incoming as unknown as ServiceWorker;
    registration.dispatchEvent(new Event('updatefound'));
    expect(service.getSnapshot().status).toBe('reload-required');
    container.controller = next as unknown as ServiceWorker;
    container.dispatchEvent(new Event('controllerchange'));
    expect(reload).not.toHaveBeenCalled();
    // dispose is the explicit close/recovery action that releases the lease.
    service.dispose();
  });

  it('restores shared admission after activation posting fails and exposes retry', async () => {
    const { container, next, locks, requests } = setup();
    const reload = vi.fn();
    next.postMessage = () => {
      throw new Error('worker is gone');
    };
    const service = createAppUpdateService({
      container: container as unknown as ServiceWorkerContainer,
      locks,
      reload,
    });
    await service.start();
    await service.apply();
    expect(service.getSnapshot()).toMatchObject({
      status: 'error',
      message: 'worker is gone',
      updateAvailable: true,
      canApply: false,
    });
    expect(requests.map(({ mode }) => mode)).toEqual(['shared', 'exclusive', 'shared']);

    next.postMessage = FakeWorker.prototype.postMessage;
    const retrying = service.retry?.();
    await vi.waitFor(() => expect(next.messages).toHaveLength(1));
    container.controller = next as unknown as ServiceWorker;
    container.dispatchEvent(new Event('controllerchange'));
    await retrying;
    expect(service.getSnapshot().status).toBe('applying');
    service.dispose();
  });

  it('restores normal waiting after the target becomes redundant without activation', async () => {
    const { container, next, locks } = setup();
    const reload = vi.fn();
    const service = createAppUpdateService({
      container: container as unknown as ServiceWorkerContainer,
      locks,
      reload,
    });
    await service.start();
    const applying = service.apply();
    await vi.waitFor(() => expect(next.messages).toHaveLength(1));
    next.state = 'redundant';
    next.dispatchEvent(new Event('statechange'));
    await applying;
    expect(service.getSnapshot()).toMatchObject({ status: 'waiting', canApply: true });
    expect(reload).not.toHaveBeenCalled();
    service.dispose();
  });

  it('blocks after an unexpected controller change during activation without reloading', async () => {
    const { container, next, locks } = setup();
    const reload = vi.fn();
    const service = createAppUpdateService({
      container: container as unknown as ServiceWorkerContainer,
      locks,
      reload,
    });
    await service.start();
    const applying = service.apply();
    await vi.waitFor(() => expect(next.messages).toHaveLength(1));
    container.controller = new FakeWorker() as unknown as ServiceWorker;
    container.dispatchEvent(new Event('controllerchange'));
    expect(service.getSnapshot()).toMatchObject({ status: 'reload-required', canApply: false });
    service.dispose();
    await applying;
    expect(reload).not.toHaveBeenCalled();
  });

  it('leaves the worker waiting when Web Locks are unavailable', async () => {
    const { container, next } = setup();
    const service = createAppUpdateService({
      container: container as unknown as ServiceWorkerContainer,
      locks: null,
    });
    await service.start();
    await service.apply();
    expect(next.messages).toEqual([]);
    expect(service.getSnapshot().message).toContain('Close all CruxControl tabs and windows');
    service.dispose();
  });
});
