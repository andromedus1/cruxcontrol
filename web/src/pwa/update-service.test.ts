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
    const { container, locks } = setup();
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
    void locks;
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

  it('keeps the old tab protected after activation timeout', async () => {
    vi.useFakeTimers();
    const { container, next, locks } = setup();
    const service = createAppUpdateService({
      container: container as unknown as ServiceWorkerContainer,
      locks,
      activationTimeoutMs: 10,
    });
    await service.start();
    const applying = service.apply();
    await vi.waitFor(() => expect(next.messages).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(11);
    await applying;
    expect(service.getSnapshot().status).toBe('reload-required');
    // dispose is the explicit close/recovery action that releases the lease.
    service.dispose();
  });
});
