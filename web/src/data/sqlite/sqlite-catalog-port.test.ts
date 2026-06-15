import { afterEach, describe, expect, it, vi } from 'vitest';
import { expose } from 'comlink';
import type { CatalogDbApi } from './catalog-db-api.ts';
import { SqliteCatalogPort, UnsupportedEnvironmentError } from './sqlite-catalog-port.ts';

// The real Worker + OPFS path cannot run in jsdom (no OPFS, no module Worker),
// so this suite covers exactly what IS testable on the main thread:
//  - the fail-fast unsupported-environment gate, and
//  - delegation/termination, using a fake "Worker" that is really a Comlink
//    endpoint backed by a MessageChannel with a recording API exposed on it.
// The OPFS persistence + real Worker wiring is verified manually / by e2e.

/** Make OPFS detection report supported so create() proceeds past the gate. */
function stubOpfsSupported(): void {
  vi.stubGlobal('navigator', { storage: { getDirectory: () => {} } });
  vi.stubGlobal('FileSystemFileHandle', {
    prototype: { createSyncAccessHandle: () => {} },
  });
}

/**
 * Build a fake Worker (a MessageChannel port with a `terminate` spy) and expose
 * `api` on the opposite port via Comlink, so `SqliteCatalogPort` wraps a real
 * Comlink proxy without a real Worker.
 */
function fakeWorkerFor(api: CatalogDbApi): {
  worker: Worker;
  terminate: ReturnType<typeof vi.fn>;
} {
  const channel = new MessageChannel();
  expose(api, channel.port2);
  const terminate = vi.fn(() => {
    channel.port1.close();
    channel.port2.close();
  });
  // Comlink only needs postMessage/addEventListener/removeEventListener, which
  // MessagePort provides; attach a terminate() to satisfy the Worker shape.
  const worker = Object.assign(channel.port1, { terminate }) as unknown as Worker;
  channel.port1.start();
  return { worker, terminate };
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
      close: async () => {},
    };
    const { worker } = fakeWorkerFor(api);

    const port = SqliteCatalogPort.create(() => worker);
    const result = await port.query('SELECT uuid, angle FROM climb_stats WHERE angle = ?', [40]);

    expect(result).toEqual(rows);
    expect(query).toHaveBeenCalledWith('SELECT uuid, angle FROM climb_stats WHERE angle = ?', [40]);
  });

  it('delegates isReady to the worker', async () => {
    stubOpfsSupported();
    const api: CatalogDbApi = {
      query: async () => [],
      isReady: async () => true,
      close: async () => {},
    };
    const { worker } = fakeWorkerFor(api);
    const port = SqliteCatalogPort.create(() => worker);
    expect(await port.isReady()).toBe(true);
  });

  it('close() calls worker.close() then terminates the worker', async () => {
    stubOpfsSupported();
    const close = vi.fn(async () => {});
    const api: CatalogDbApi = {
      query: async () => [],
      isReady: async () => true,
      close,
    };
    const { worker, terminate } = fakeWorkerFor(api);
    const port = SqliteCatalogPort.create(() => worker);

    await port.close();
    expect(close).toHaveBeenCalledOnce();
    expect(terminate).toHaveBeenCalledOnce();
  });
});
