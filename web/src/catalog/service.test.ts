import { afterEach, describe, expect, it, vi } from 'vitest';
import { kilterFullride7x10Definition as definition } from '../domain/boards/definitions/kilter-fullride-7x10.ts';
import type { CatalogBootstrapPort, CatalogInstallResult, CatalogStorageStatus } from '../data/catalog/bootstrap-port.ts';
import type { CatalogManifest } from '../data/catalog/manifest.ts';
import type { CatalogPort } from '../data/port.ts';
import type { CatalogReceipt } from '../data/sqlite/catalog-receipt.ts';
import { createCatalogService } from './service.ts';

const manifest: CatalogManifest = Object.freeze({
  schemaVersion: 2,
  version: 1,
  board: 'kilter-fullride-7x10',
  file: 'kilter-7x10.v1.db.gz',
  compression: 'gzip',
  sha256: 'a'.repeat(64),
  bytesGzipped: 4,
  bytesRaw: 64,
  generatedOn: '2026-10-09',
  source: 'legacy-aurora-kilter',
  sourceDataThrough: null,
  generatedFrom: 'test fixture',
  filter: 'layout_id=8',
});

function receipt(value: CatalogManifest = manifest, slot: 'a' | 'b' = 'a'): CatalogReceipt {
  return {
    schemaVersion: 1,
    slot,
    manifest: value,
    installedAt: '2026-10-09T00:00:00.000Z',
  };
}

function statusReady(value = receipt()): CatalogStorageStatus {
  return { status: 'ready', receipt: value };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function bodyResponse(body: string | Uint8Array): Response {
  return new Response(typeof body === 'string' ? body : Uint8Array.from(body).buffer as ArrayBuffer, { status: 200 });
}

function portFor(options: {
  status?: () => Promise<CatalogStorageStatus>;
  install?: (value: CatalogManifest, bytes: ArrayBuffer) => Promise<CatalogInstallResult>;
  close?: () => Promise<void>;
} = {}) {
  const port: CatalogPort & CatalogBootstrapPort = {
    query: vi.fn(async () => []),
    isReady: vi.fn(async () => true),
    catalogStatus: vi.fn(options.status ?? (async () => ({ status: 'empty' as const }))),
    installCatalog: vi.fn(options.install ?? (async (value): Promise<CatalogInstallResult> => ({
      ok: true,
      unchanged: false,
      receipt: receipt(value),
    }))),
    close: vi.fn(options.close ?? (async () => undefined)),
  };
  return port;
}

function serviceFor(options: {
  port?: CatalogPort & CatalogBootstrapPort;
  createPort?: () => CatalogPort & CatalogBootstrapPort;
  fetcher?: typeof fetch;
} = {}) {
  const createPort = options.createPort ?? (() => options.port ?? portFor());
  return createCatalogService(definition, {
    createPort,
    fetcher: options.fetcher ?? vi.fn(async (input) => {
      const url = String(input);
      return url.endsWith('/manifest.json')
        ? bodyResponse(JSON.stringify(manifest))
        : bodyResponse(new Uint8Array([1, 2, 3, 4]));
    }) as typeof fetch,
  });
}

afterEach(() => vi.restoreAllMocks());

describe('createCatalogService', () => {
  it('is lazy and coalesces concurrent first opens', async () => {
    const opened = deferred<CatalogStorageStatus>();
    const port = portFor({ status: () => opened.promise });
    const createPort = vi.fn(() => port);
    const service = serviceFor({ createPort });

    expect(createPort).not.toHaveBeenCalled();
    const first = service.start();
    const second = service.start();
    await vi.waitFor(() => expect(createPort).toHaveBeenCalledOnce());
    expect(createPort).toHaveBeenCalledOnce();
    expect(service.getSnapshot().operation).toBe('opening');
    opened.resolve({ status: 'empty' });
    await Promise.all([first, second]);
    expect(service.getSnapshot()).toMatchObject({ storage: { status: 'empty' }, operation: 'idle' });
    await service.close();
  });

  it('opens an installed receipt without fetching and retains digest provenance', async () => {
    const fetcher = vi.fn() as typeof fetch;
    const port = portFor({ status: async () => statusReady() });
    const service = serviceFor({ port, fetcher });
    await service.start();

    const snapshot = service.getSnapshot();
    expect(snapshot.queries?.provenance).toEqual({
      source: 'Legacy Kilter (Aurora)',
      snapshotId: manifest.sha256,
      retrievedAt: null,
      coverage: 'Older offline snapshot; current first-party coverage is unknown; no live updates',
    });
    expect(service.getSnapshot().queries).toBe(snapshot.queries);
    expect(fetcher).not.toHaveBeenCalled();
    expect(port.catalogStatus).toHaveBeenCalledOnce();
    await service.close();
  });

  it('checks metadata without fetching a binary, then installs only the exact displayed offer', async () => {
    const fetcher = vi.fn(async (input) => String(input).endsWith('/manifest.json')
      ? bodyResponse(JSON.stringify(manifest))
      : bodyResponse(new Uint8Array([1, 2, 3, 4]))) as typeof fetch;
    const port = portFor();
    const service = serviceFor({ port, fetcher });
    await service.start();
    await service.loadOffer();

    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(vi.mocked(fetcher).mock.calls[0]?.[0])).toMatch(/\/catalog\/manifest\.json$/);
    expect(port.installCatalog).not.toHaveBeenCalled();
    const displayedOffer = service.getSnapshot().offer;
    expect(displayedOffer).toEqual(manifest);

    await service.installOffer();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(fetcher).mock.calls[1]?.[0])).toMatch(/\/catalog\/kilter-7x10\.v1\.db\.gz$/);
    expect(port.installCatalog).toHaveBeenCalledWith(displayedOffer, expect.any(ArrayBuffer));
    expect(service.getSnapshot()).toMatchObject({ storage: { status: 'ready' }, operation: 'idle' });
    await service.close();
  });

  it('guards duplicate installs and holds the installing operation until activation settles', async () => {
    const activation = deferred<CatalogInstallResult>();
    const port = portFor({ install: () => activation.promise });
    const service = serviceFor({ port });
    await service.start();
    await service.loadOffer();
    const operations: string[] = [];
    service.subscribe(() => operations.push(service.getSnapshot().operation));

    const first = service.installOffer();
    const duplicate = service.installOffer();
    expect(service.getSnapshot().operation).toBe('downloading');
    await vi.waitFor(() => expect(service.getSnapshot().operation).toBe('installing'));
    service.cancelDownload();
    expect(service.getSnapshot().operation).toBe('installing');
    expect(port.installCatalog).toHaveBeenCalledOnce();
    activation.resolve({ ok: true, unchanged: false, receipt: receipt() });
    await Promise.all([first, duplicate]);
    expect(operations).toEqual(expect.arrayContaining(['downloading', 'installing', 'idle']));
    expect(service.getSnapshot().storage).toMatchObject({ status: 'ready' });
    await service.close();
  });

  it('honors cancellation even when a fetcher resolves late after abort', async () => {
    const binary = deferred<Response>();
    const fetcher = vi.fn(async (input) => String(input).endsWith('/manifest.json')
      ? bodyResponse(JSON.stringify(manifest))
      : binary.promise) as typeof fetch;
    const port = portFor();
    const service = serviceFor({ port, fetcher });
    await service.start();
    await service.loadOffer();
    const installing = service.installOffer();
    const signal = vi.mocked(fetcher).mock.calls[1]?.[1]?.signal;
    expect(signal?.aborted).toBe(false);
    service.cancelDownload();
    expect(signal?.aborted).toBe(true);
    binary.resolve(bodyResponse(new Uint8Array([1, 2, 3, 4])));
    await installing;

    expect(port.installCatalog).not.toHaveBeenCalled();
    expect(service.getSnapshot()).toMatchObject({ operation: 'idle', error: { code: 'aborted' } });
    await service.close();
  });

  it('restores the retained receipt query after an anticipated failed replacement', async () => {
    const retained = receipt({ ...manifest, sha256: 'b'.repeat(64) });
    const port = portFor({
      status: async () => ({ status: 'empty' }),
      install: async () => ({
        ok: false,
        code: 'schema',
        message: 'Replacement rejected',
        retained,
      }),
    });
    const fetcher = vi.fn(async (input) => String(input).endsWith('/manifest.json')
      ? bodyResponse(JSON.stringify(manifest))
      : bodyResponse(new Uint8Array([1, 2, 3, 4]))) as typeof fetch;
    const service = serviceFor({ port, fetcher });
    await service.start();
    await service.loadOffer();
    await service.installOffer();

    expect(service.getSnapshot()).toMatchObject({
      storage: { status: 'ready', receipt: { manifest: { sha256: retained.manifest.sha256 } } },
      error: { code: 'schema', message: 'Replacement rejected' },
    });
    expect(service.getSnapshot().queries?.provenance.snapshotId).toBe(retained.manifest.sha256);
    await service.close();
  });

  it.each(['closed', 'busy'] as const)(
    'retires an install worker and reopens its durable receipt after a %s result',
    async (code) => {
      const reportedRetained = receipt({ ...manifest, sha256: 'b'.repeat(64) }, 'a');
      const committed = receipt({ ...manifest, sha256: 'c'.repeat(64) }, 'b');
      const first = portFor({
        install: async () => ({
          ok: false,
          code,
          message: `Install returned ${code}`,
          retained: reportedRetained,
        }),
      });
      const reopened = portFor({ status: async () => statusReady(committed) });
      const createPort = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(reopened);
      const service = serviceFor({ createPort });
      await service.start();
      await service.loadOffer();
      await service.installOffer();

      expect(service.getSnapshot()).toMatchObject({
        storage: { status: 'unavailable', code, message: `Install returned ${code}` },
        error: { code, message: `Install returned ${code}` },
        queries: null,
        offer: null,
      });
      expect(first.close).toHaveBeenCalledOnce();
      await service.retryOpen();

      expect(createPort).toHaveBeenCalledTimes(2);
      expect(reopened.catalogStatus).toHaveBeenCalledOnce();
      expect(service.getSnapshot().storage).toEqual({ status: 'ready', receipt: committed });
      expect(service.getSnapshot().queries?.provenance.snapshotId).toBe(committed.manifest.sha256);
      await service.close();
    },
  );

  it('discards an unexpectedly failed install worker and reopens from the persisted receipt', async () => {
    const error = new Error('RPC stopped after activation');
    const broken = portFor({ install: async () => { throw error; } });
    const recovered = portFor({ status: async () => statusReady(receipt(manifest, 'b')) });
    const createPort = vi.fn().mockReturnValueOnce(broken).mockReturnValueOnce(recovered);
    const service = serviceFor({ createPort });
    await service.start();
    await service.loadOffer();
    await service.installOffer();

    expect(service.getSnapshot()).toMatchObject({ storage: { status: 'unavailable' }, error: { message: error.message } });
    expect(broken.close).toHaveBeenCalledOnce();
    await service.retryOpen();
    expect(createPort).toHaveBeenCalledTimes(2);
    expect(service.getSnapshot()).toMatchObject({ storage: { status: 'ready', receipt: { slot: 'b' } } });
    await service.close();
  });

  it('closes a busy worker before retrying it', async () => {
    const busy = portFor({ status: async () => ({ status: 'unavailable', code: 'busy', message: 'Another tab owns the catalog.' }) });
    const recovered = portFor({ status: async () => statusReady() });
    const createPort = vi.fn().mockReturnValueOnce(busy).mockReturnValueOnce(recovered);
    const service = serviceFor({ createPort });
    await service.start();
    expect(service.getSnapshot()).toMatchObject({ storage: { status: 'unavailable', code: 'busy' } });

    await service.retryOpen();
    expect(busy.close).toHaveBeenCalledOnce();
    expect(createPort).toHaveBeenCalledTimes(2);
    expect(service.getSnapshot().storage?.status).toBe('ready');
    await service.close();
  });

  it('restores an actionable unavailable state when retry cannot close the old port', async () => {
    const busy = portFor({
      status: async () => ({ status: 'unavailable', code: 'busy', message: 'Another tab owns the catalog.' }),
      close: async () => { throw new Error('Worker termination failed'); },
    });
    const createPort = vi.fn(() => busy);
    const service = serviceFor({ createPort });
    await service.start();
    await service.retryOpen();

    expect(service.getSnapshot()).toMatchObject({
      storage: { status: 'unavailable', code: 'closed' },
      operation: 'idle',
      error: { code: 'closed', message: 'Worker termination failed' },
    });
    expect(createPort).toHaveBeenCalledOnce();
    await service.close();
  });

  it('waits for a worker already closing during retry before completing disposal', async () => {
    const closing = deferred<void>();
    const busy = portFor({
      status: async () => ({ status: 'unavailable', code: 'busy', message: 'Another tab owns the catalog.' }),
      close: () => closing.promise,
    });
    const createPort = vi.fn(() => busy);
    const service = serviceFor({ createPort });
    await service.start();
    const retry = service.retryOpen();
    await vi.waitFor(() => expect(busy.close).toHaveBeenCalledOnce());
    let disposed = false;
    const disposal = service.close().then(() => { disposed = true; });
    await Promise.resolve();
    expect(disposed).toBe(false);
    closing.resolve();
    await Promise.all([retry, disposal]);

    expect(disposed).toBe(true);
    expect(createPort).toHaveBeenCalledOnce();
    expect(busy.catalogStatus).toHaveBeenCalledOnce();
  });

  it('makes remounted startup await retry shutdown and receipt recovery', async () => {
    const closing = deferred<void>();
    const reopenedStatus = deferred<CatalogStorageStatus>();
    const busy = portFor({
      status: async () => ({ status: 'unavailable', code: 'busy', message: 'Another tab owns the catalog.' }),
      close: () => closing.promise,
    });
    const reopened = portFor({ status: () => reopenedStatus.promise });
    const createPort = vi.fn().mockReturnValueOnce(busy).mockReturnValueOnce(reopened);
    const service = serviceFor({ createPort });
    await service.start();

    const retry = service.retryOpen();
    expect(service.getSnapshot().operation).toBe('opening');
    await vi.waitFor(() => expect(busy.close).toHaveBeenCalledOnce());
    let remounted = false;
    const startup = service.start().then(() => { remounted = true; });
    expect(createPort).toHaveBeenCalledOnce();
    expect(remounted).toBe(false);
    expect(service.getSnapshot().operation).toBe('opening');

    closing.resolve();
    await vi.waitFor(() => expect(reopened.catalogStatus).toHaveBeenCalledOnce());
    expect(createPort).toHaveBeenCalledTimes(2);
    expect(remounted).toBe(false);
    expect(service.getSnapshot().operation).toBe('opening');
    reopenedStatus.resolve({ status: 'empty' });
    await Promise.all([retry, startup]);

    expect(remounted).toBe(true);
    expect(service.getSnapshot().storage).toEqual({ status: 'empty' });
    await service.close();
  });

  it('waits for begun activation during disposal and publishes no obsolete state', async () => {
    const activation = deferred<CatalogInstallResult>();
    const port = portFor({ install: () => activation.promise });
    const service = serviceFor({ port });
    await service.start();
    await service.loadOffer();
    const listener = vi.fn();
    service.subscribe(listener);
    const installing = service.installOffer();
    await vi.waitFor(() => expect(service.getSnapshot().operation).toBe('installing'));
    const closing = service.close();
    expect(port.close).not.toHaveBeenCalled();
    const callsAtClose = listener.mock.calls.length;
    activation.resolve({ ok: true, unchanged: false, receipt: receipt() });
    await Promise.all([installing, closing]);

    expect(port.close).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledTimes(callsAtClose);
    expect(await service.start()).toBeUndefined();
    expect(port.catalogStatus).toHaveBeenCalledOnce();
  });

  it('aborts a metadata request during disposal', async () => {
    const metadata = deferred<Response>();
    const fetcher = vi.fn(async () => metadata.promise) as typeof fetch;
    const service = serviceFor({ port: portFor(), fetcher });
    await service.start();
    const loading = service.loadOffer();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    const signal = vi.mocked(fetcher).mock.calls[0]?.[1]?.signal;
    const closing = service.close();
    expect(signal?.aborted).toBe(true);
    metadata.reject(new DOMException('Aborted', 'AbortError'));
    await Promise.all([loading, closing]);
  });
});
