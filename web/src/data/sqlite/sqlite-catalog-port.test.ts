import { afterEach, describe, expect, it, vi } from 'vitest';
import { expose } from 'comlink';
import type { CatalogDbApi } from './catalog-db-api.ts';
import { SqliteCatalogPort, UnsupportedEnvironmentError } from './sqlite-catalog-port.ts';
import type { CatalogManifest } from '../catalog/manifest.ts';

const manifest: CatalogManifest = {
  schemaVersion: 2,
  version: 1,
  board: 'kilter-fullride-7x10',
  file: 'kilter-7x10.v1.db.gz',
  compression: 'gzip',
  sha256: 'a'.repeat(64),
  bytesGzipped: 10,
  bytesRaw: 4096,
  generatedOn: '2026-06-14',
  source: 'legacy-aurora-kilter',
  sourceDataThrough: null,
  generatedFrom: 'synthetic test fixture',
  filter: 'layout_id=8',
};

const readyStatus = {
  status: 'ready' as const,
  receipt: { schemaVersion: 1 as const, slot: 'a' as const, manifest, installedAt: '2026-06-14T00:00:00.000Z' },
};

// The real Worker + OPFS path cannot run in jsdom (no OPFS, no module Worker),
// so this suite covers exactly what IS testable on the main thread:
//  - the fail-fast unsupported-environment gate, and
//  - delegation/termination, using a fake "Worker" that is really a Comlink
//    endpoint backed by a MessageChannel with a recording API exposed on it.
// OPFS persistence and bundled Worker wiring are verified by the dedicated Playwright suite.

/** Make OPFS detection report supported so create() proceeds past the gate. */
function stubOpfsSupported(): void {
  vi.stubGlobal('navigator', { storage: { getDirectory: () => {} }, locks: { request: () => {} } });
}

/**
 * Build a fake Worker (a MessageChannel port with a `terminate` spy) and expose
 * `api` on the opposite port via Comlink, so `SqliteCatalogPort` wraps a real
 * Comlink proxy without a real Worker.
 */
function fakeWorkerFor(api: CatalogDbApi): {
  worker: Worker;
  terminate: ReturnType<typeof vi.fn>;
  emitError: (type: 'error' | 'messageerror') => void;
} {
  const channel = new MessageChannel();
  expose(api, channel.port2);
  const terminate = vi.fn(() => {
    channel.port1.close();
    channel.port2.close();
  });
  const errorListeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const addEventListener = channel.port1.addEventListener.bind(channel.port1);
  const removeEventListener = channel.port1.removeEventListener.bind(channel.port1);
  // Comlink only needs postMessage/addEventListener/removeEventListener, which
  // MessagePort provides; attach a terminate() to satisfy the Worker shape.
  const worker = Object.assign(channel.port1, {
    terminate,
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
      if (type === 'error' || type === 'messageerror') {
        const listeners = errorListeners.get(type) ?? new Set();
        listeners.add(listener);
        errorListeners.set(type, listeners);
      } else {
        addEventListener(type, listener, options);
      }
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) {
      if (type === 'error' || type === 'messageerror') errorListeners.get(type)?.delete(listener);
      else removeEventListener(type, listener, options);
    },
  }) as unknown as Worker;
  channel.port1.start();
  return {
    worker,
    terminate,
    emitError(type) {
      const event = { preventDefault() {} } as Event;
      for (const listener of errorListeners.get(type) ?? []) {
        if (typeof listener === 'function') listener(event);
        else listener.handleEvent(event);
      }
    },
  };
}

describe('SqliteCatalogPort', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('create() throws UnsupportedEnvironmentError in jsdom', () => {
    expect(() => SqliteCatalogPort.create()).toThrow(UnsupportedEnvironmentError);
  });

  it('does not spawn a Worker when the environment is unsupported', () => {
    const factory = vi.fn();
    expect(() => SqliteCatalogPort.create(factory)).toThrow(UnsupportedEnvironmentError);
    expect(factory).not.toHaveBeenCalled();
  });

  it('delegates query args verbatim and returns the worker rows', async () => {
    stubOpfsSupported();
    const rows = [{ uuid: 'climb-a', angle: 40 }];
    const query = vi.fn(async () => rows);
    const api: CatalogDbApi = {
      query: query as unknown as CatalogDbApi['query'],
      isReady: async () => true,
      catalogStatus: async () => readyStatus,
      installCatalog: async () => ({ ok: true, receipt: readyStatus.receipt, unchanged: false }),
      close: async () => {},
    };
    const { worker } = fakeWorkerFor(api);

    const port = SqliteCatalogPort.create(() => worker);
    const result = await port.query('SELECT uuid, angle FROM climb_stats WHERE angle = ?', [40]);

    expect(result).toEqual(rows);
    expect(query).toHaveBeenCalledWith('SELECT uuid, angle FROM climb_stats WHERE angle = ?', [40]);
  });

  it('uses the worker status to answer isReady', async () => {
    stubOpfsSupported();
    const api: CatalogDbApi = {
      query: async () => [],
      isReady: async () => true,
      catalogStatus: async () => readyStatus,
      installCatalog: async () => ({ ok: true, receipt: readyStatus.receipt, unchanged: false }),
      close: async () => {},
    };
    const { worker } = fakeWorkerFor(api);
    const port = SqliteCatalogPort.create(() => worker);
    expect(await port.isReady()).toBe(true);
  });

  it('transfers the compressed buffer and returns the typed installation result', async () => {
    stubOpfsSupported();
    const installCatalog = vi.fn(async (_manifest: CatalogManifest, compressed: ArrayBuffer) => ({
      ok: true as const,
      receipt: readyStatus.receipt,
      unchanged: compressed.byteLength === 4,
    }));
    const api: CatalogDbApi = {
      query: async () => [],
      isReady: async () => true,
      catalogStatus: async () => readyStatus,
      installCatalog,
      close: async () => {},
    };
    const { worker } = fakeWorkerFor(api);
    const port = SqliteCatalogPort.create(() => worker);
    const result = await port.installCatalog(manifest, new Uint8Array([1, 2, 3, 4]).buffer);
    expect(result).toMatchObject({ ok: true, unchanged: true });
    expect(installCatalog).toHaveBeenCalledOnce();
  });

  it('reports busy status and retires the worker so a caller can create a fresh one', async () => {
    stubOpfsSupported();
    const api: CatalogDbApi = {
      query: async () => [],
      isReady: async () => false,
      catalogStatus: async () => ({ status: 'unavailable', code: 'busy', message: 'busy' }),
      installCatalog: async () => ({ ok: false, code: 'busy', message: 'busy', retained: null }),
      close: async () => {},
    };
    const { worker, terminate } = fakeWorkerFor(api);
    const port = SqliteCatalogPort.create(() => worker);
    await expect(port.catalogStatus()).resolves.toMatchObject({ status: 'unavailable', code: 'busy' });
    expect(terminate).toHaveBeenCalledOnce();
    await expect(port.catalogStatus()).rejects.toMatchObject({ code: 'closed' });
  });

  it('rejects pending and future calls after a Worker error', async () => {
    stubOpfsSupported();
    let markStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const api: CatalogDbApi = {
      query: async () => { markStarted(); return new Promise(() => {}); },
      isReady: async () => false,
      catalogStatus: async () => readyStatus,
      installCatalog: async () => ({ ok: true, receipt: readyStatus.receipt, unchanged: false }),
      close: async () => {},
    };
    const { worker, terminate, emitError } = fakeWorkerFor(api);
    const port = SqliteCatalogPort.create(() => worker);
    const pending = port.query('SELECT 1');
    await started;
    emitError('error');
    await expect(pending).rejects.toMatchObject({ code: 'closed' });
    await expect(port.query('SELECT 2')).rejects.toMatchObject({ code: 'closed' });
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('rejects a pending install after Worker messageerror', async () => {
    stubOpfsSupported();
    let markStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const api: CatalogDbApi = {
      query: async () => [],
      isReady: async () => true,
      catalogStatus: async () => readyStatus,
      installCatalog: async () => {
        markStarted();
        return new Promise(() => {});
      },
      close: async () => {},
    };
    const { worker, terminate, emitError } = fakeWorkerFor(api);
    const port = SqliteCatalogPort.create(() => worker);
    const pending = port.installCatalog(manifest, new Uint8Array([1, 2]).buffer);
    await started;
    emitError('messageerror');
    await expect(pending).rejects.toMatchObject({ code: 'closed' });
    await expect(port.installCatalog(manifest, new ArrayBuffer(0))).rejects.toMatchObject({ code: 'closed' });
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('terminates a Worker whose RPC does not answer before its deadline', async () => {
    stubOpfsSupported();
    const api: CatalogDbApi = {
      query: async () => new Promise(() => {}),
      isReady: async () => false,
      catalogStatus: async () => readyStatus,
      installCatalog: async () => ({ ok: true, receipt: readyStatus.receipt, unchanged: false }),
      close: async () => {},
    };
    const { worker, terminate } = fakeWorkerFor(api);
    const port = SqliteCatalogPort.create(() => worker, { rpcMs: 20, closeMs: 20 });
    await expect(port.query('SELECT 1')).rejects.toMatchObject({ code: 'closed' });
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('terminates a Worker whose close RPC exceeds its shorter deadline', async () => {
    stubOpfsSupported();
    const api: CatalogDbApi = {
      query: async () => [],
      isReady: async () => true,
      catalogStatus: async () => readyStatus,
      installCatalog: async () => ({ ok: true, receipt: readyStatus.receipt, unchanged: false }),
      close: async () => new Promise(() => {}),
    };
    const { worker, terminate } = fakeWorkerFor(api);
    const port = SqliteCatalogPort.create(() => worker, { rpcMs: 1000, closeMs: 20 });
    await expect(port.close()).rejects.toMatchObject({ code: 'closed' });
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('serializes query, install, and close in call order', async () => {
    stubOpfsSupported();
    const calls: string[] = [];
    const api: CatalogDbApi = {
      query: async () => {
        calls.push('query-start');
        await new Promise((resolve) => setTimeout(resolve, 20));
        calls.push('query-end');
        return [];
      },
      isReady: async () => true,
      catalogStatus: async () => readyStatus,
      installCatalog: async () => {
        calls.push('install');
        return { ok: true, receipt: readyStatus.receipt, unchanged: false };
      },
      close: async () => { calls.push('close'); },
    };
    const { worker } = fakeWorkerFor(api);
    const port = SqliteCatalogPort.create(() => worker);
    const query = port.query('SELECT 1');
    const install = port.installCatalog(manifest, new Uint8Array([1]).buffer);
    const close = port.close();
    await Promise.all([query, install, close]);
    expect(calls).toEqual(['query-start', 'query-end', 'install', 'close']);
  });

  it('close() calls worker.close() then terminates the worker', async () => {
    stubOpfsSupported();
    const close = vi.fn(async () => {});
    const api: CatalogDbApi = {
      query: async () => [],
      isReady: async () => true,
      catalogStatus: async () => readyStatus,
      installCatalog: async () => ({ ok: true, receipt: readyStatus.receipt, unchanged: false }),
      close,
    };
    const { worker, terminate } = fakeWorkerFor(api);
    const port = SqliteCatalogPort.create(() => worker);

    await port.close();
    expect(close).toHaveBeenCalledOnce();
    expect(terminate).toHaveBeenCalledOnce();
  });
});
