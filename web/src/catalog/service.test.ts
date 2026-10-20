import { afterEach, describe, expect, it, vi } from 'vitest';
import { kilterFullride7x10Definition as definition } from '../domain/boards/definitions/kilter-fullride-7x10.ts';
import type { CatalogBootstrapPort, CatalogInstallResult, CatalogStorageStatus } from '../data/catalog/bootstrap-port.ts';
import type { BoardseshCatalogManifest, CatalogManifest } from '../data/catalog/manifest.ts';
import type { CatalogPort } from '../data/port.ts';
import type { CatalogReceipt } from '../data/sqlite/catalog-receipt.ts';
import { createCatalogService } from './service.ts';
import {
  CatalogUpdateError,
  memoryCatalogUpdatePreferences,
  noCatalogUpdates,
  type CatalogUpdateCheck,
  type CatalogUpdateSource,
} from './update-source.ts';

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

const boardseshManifest: CatalogManifest = Object.freeze({
  schemaVersion: 3,
  version: 2,
  board: 'kilter-fullride-7x10',
  file: 'kilter-7x10.v2.db.gz',
  compression: 'gzip',
  sha256: 'c'.repeat(64),
  bytesGzipped: 4,
  bytesRaw: 64,
  generatedOn: '2026-10-19',
  source: 'boardsesh-kilter',
  sourceBuiltAt: '2026-10-19T18:38:11.515Z',
  sourceWatermarks: Object.freeze({ board_climbs: '2026-10-19T18:31:55.490105Z' }),
  layoutRevision: 'kilter:7:8:17:f0d70b3db9a6',
  qualityScale: Object.freeze({ min: 0, max: 5 }),
  climbCount: 13299,
  removedUpstreamCount: null,
  changes: null,
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
    expect(snapshot.queries?.ratingScale).toEqual({ min: 0, max: 3 });
    expect(service.getSnapshot().queries).toBe(snapshot.queries);
    expect(fetcher).not.toHaveBeenCalled();
    expect(port.catalogStatus).toHaveBeenCalledOnce();
    await service.close();
  });

  it('binds a Boardsesh receipt to community provenance and its declared rating scale', async () => {
    const port = portFor({ status: async () => statusReady(receipt(boardseshManifest)) });
    const service = serviceFor({ port, fetcher: vi.fn() as typeof fetch });
    await service.start();

    const queries = service.getSnapshot().queries;
    expect(queries?.provenance).toEqual({
      source: 'Kilter community climbs via Boardsesh',
      snapshotId: boardseshManifest.sha256,
      retrievedAt: '2026-10-19T18:38:11.515Z',
      coverage: 'Community catalog derived from Boardsesh snapshots; not official Kilter data',
    });
    expect(queries?.ratingScale).toEqual({ min: 0, max: 5 });
    await service.close();
  });

  it('offers a schema-3 catalog but refuses one built for another layout revision', async () => {
    const offered = { ...boardseshManifest };
    const fetcher = vi.fn(async () => bodyResponse(JSON.stringify(offered))) as typeof fetch;
    const service = serviceFor({ fetcher });
    await service.loadOffer();
    expect(service.getSnapshot()).toMatchObject({ offer: boardseshManifest, error: null });
    await service.close();

    offered.layoutRevision = 'kilter:7:8:17:000000000000';
    const mismatched = serviceFor({ fetcher });
    await mismatched.loadOffer();
    expect(mismatched.getSnapshot()).toMatchObject({
      offer: null,
      error: { code: 'manifest', message: 'This catalog was built for a different board layout revision.' },
    });
    await mismatched.close();
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

describe('signed-in catalog updates', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const installedLegacy = statusReady(receipt(manifest, 'a'));

  function remote(version: number, extra: Partial<BoardseshCatalogManifest> = {}): BoardseshCatalogManifest {
    return Object.freeze({
      ...(boardseshManifest as BoardseshCatalogManifest),
      version,
      file: `kilter-7x10.v${version}.db.gz`,
      changes: Object.freeze({ added: 1261, removed: 23, restored: 0 }),
      ...extra,
    });
  }

  function source(result: () => Promise<CatalogUpdateCheck>) {
    return {
      check: vi.fn(result),
      prepare: vi.fn(async (_version: number) => undefined),
    };
  }

  function updateFetcher(staged: () => CatalogManifest | null) {
    return vi.fn(async (input) => {
      const url = String(input);
      if (url.endsWith('/catalog/private/manifest.json')) {
        const value = staged();
        return value ? bodyResponse(JSON.stringify(value)) : new Response('missing', { status: 404 });
      }
      if (url.endsWith('/catalog/manifest.json')) return bodyResponse(JSON.stringify(manifest));
      return bodyResponse(new Uint8Array([1, 2, 3, 4]));
    }) as typeof fetch;
  }

  function updatingService(options: {
    updates: CatalogUpdateSource;
    port?: CatalogPort & CatalogBootstrapPort;
    fetcher?: typeof fetch;
    preferences?: ReturnType<typeof memoryCatalogUpdatePreferences>;
    now?: () => number;
  }) {
    const preferences = options.preferences ?? memoryCatalogUpdatePreferences();
    const port = options.port ?? portFor({ status: async () => installedLegacy });
    const service = createCatalogService(definition, {
      createPort: () => port,
      fetcher: options.fetcher ?? updateFetcher(() => remote(3)),
      updates: options.updates,
      updatePreferences: preferences,
      now: options.now ?? (() => Date.parse('2026-10-20T12:00:00.000Z')),
    });
    return { service, port, preferences };
  }

  it('reports the web/PWA default as unconfigured without fetching or recording a check', async () => {
    const fetcher = vi.fn() as typeof fetch;
    const preferences = memoryCatalogUpdatePreferences();
    const service = createCatalogService(definition, {
      createPort: () => portFor({ status: async () => installedLegacy }),
      fetcher,
      updatePreferences: preferences,
    });
    await service.start();
    await service.checkForUpdate({ force: true });
    expect(service.getSnapshot().update).toMatchObject({ availability: 'unconfigured', offer: null, error: null });
    expect(fetcher).not.toHaveBeenCalled();
    expect(preferences.read().lastCheckedAt).toBeNull();
    await expect(noCatalogUpdates.prepare(2)).rejects.toMatchObject({ code: 'unavailable' });
    await service.close();
  });

  it('never opens storage for a check when the catalog has not been opened', async () => {
    const updates = source(async () => ({ status: 'available', version: 3 }));
    const createPort = vi.fn(() => portFor({ status: async () => installedLegacy }));
    const service = createCatalogService(definition, {
      createPort, fetcher: updateFetcher(() => remote(3)), updates, updatePreferences: memoryCatalogUpdatePreferences(),
    });
    await service.checkForUpdate({ force: true });
    expect(createPort).not.toHaveBeenCalled();
    expect(updates.check).not.toHaveBeenCalled();
    await service.close();
  });

  it('checks at most every 3.5 days unless forced and offers newer schema-3 versions with change counts', async () => {
    let now = Date.parse('2026-10-20T12:00:00.000Z');
    const updates = source(async () => ({ status: 'available', version: 3 }));
    const { service, preferences } = updatingService({ updates, now: () => now });
    await service.start();

    await service.checkForUpdate();
    expect(updates.check).toHaveBeenCalledOnce();
    expect(service.getSnapshot().update).toMatchObject({
      availability: 'available',
      offer: { version: 3, schemaVersion: 3 },
      changes: { added: 1261, removed: 23, restored: 0 },
      dismissed: false,
      lastCheckedAt: now,
      error: null,
    });
    expect(preferences.read()).toMatchObject({ lastCheckedAt: now, stagedVersion: 3 });

    now += 3.5 * DAY - 1;
    await service.checkForUpdate();
    expect(updates.check).toHaveBeenCalledOnce();
    await service.checkForUpdate({ force: true });
    expect(updates.check).toHaveBeenCalledTimes(2);
    now += 3.5 * DAY;
    await service.checkForUpdate();
    expect(updates.check).toHaveBeenCalledTimes(3);
    await service.close();
  });

  it('hides a dismissed version until a newer one is offered', async () => {
    let offered = 3;
    const updates = source(async () => ({ status: 'available', version: offered }));
    const { service, preferences } = updatingService({ updates, fetcher: updateFetcher(() => remote(offered)) });
    await service.start();
    await service.checkForUpdate({ force: true });
    service.dismissUpdate();
    expect(service.getSnapshot().update).toMatchObject({ offer: { version: 3 }, dismissed: true });
    expect(preferences.read().dismissedVersion).toBe(3);

    await service.checkForUpdate({ force: true });
    expect(service.getSnapshot().update).toMatchObject({ offer: { version: 3 }, dismissed: true });
    offered = 4;
    await service.checkForUpdate({ force: true });
    expect(service.getSnapshot().update).toMatchObject({ offer: { version: 4 }, dismissed: false });
    await service.close();
  });

  it('never offers a version at or below the installed receipt', async () => {
    const installed = statusReady(receipt(remote(5), 'b'));
    for (const version of [5, 4]) {
      const updates = source(async () => ({ status: 'available', version }));
      const fetcher = updateFetcher(() => remote(version));
      const { service } = updatingService({ updates, fetcher, port: portFor({ status: async () => installed }) });
      await service.start();
      await service.checkForUpdate({ force: true });
      expect(service.getSnapshot().update).toMatchObject({ availability: 'current', offer: null });
      expect(fetcher).not.toHaveBeenCalled();
      await service.close();
    }
  });

  it('refuses a staged manifest for another layout revision or a different version', async () => {
    for (const staged of [remote(3, { layoutRevision: 'kilter:7:8:17:000000000000' }), remote(4)]) {
      const updates = source(async () => ({ status: 'available', version: 3 }));
      const { service } = updatingService({ updates, fetcher: updateFetcher(() => staged) });
      await service.start();
      await service.checkForUpdate({ force: true });
      expect(service.getSnapshot().update).toMatchObject({ offer: null, error: { code: 'manifest' } });
      await service.close();
    }
  });

  it('reports signed-out and failed checks without recording the cadence', async () => {
    const signedOut = updatingService({ updates: source(async () => ({ status: 'signed-out' })) });
    await signedOut.service.start();
    await signedOut.service.checkForUpdate();
    expect(signedOut.service.getSnapshot().update).toMatchObject({ availability: 'signed-out', offer: null });
    expect(signedOut.preferences.read().lastCheckedAt).toBeNull();
    await signedOut.service.close();

    const failing = updatingService({ updates: source(async () => { throw new CatalogUpdateError('network'); }) });
    await failing.service.start();
    await failing.service.checkForUpdate();
    expect(failing.service.getSnapshot().update).toMatchObject({
      availability: 'unknown',
      checking: false,
      error: { code: 'network', message: expect.stringMatching(/could not be reached/) },
    });
    expect(failing.preferences.read().lastCheckedAt).toBeNull();
    expect(failing.service.getSnapshot().storage).toMatchObject({ status: 'ready' });
    await failing.service.close();
  });

  it('re-offers a version staged by an earlier check without contacting the endpoint', async () => {
    const now = Date.parse('2026-10-20T12:00:00.000Z');
    const updates = source(async () => ({ status: 'available', version: 3 }));
    const preferences = memoryCatalogUpdatePreferences({ lastCheckedAt: now - DAY, stagedVersion: 3, dismissedVersion: 2 });
    const { service } = updatingService({ updates, preferences, now: () => now });
    await service.start();
    await service.checkForUpdate();
    expect(updates.check).not.toHaveBeenCalled();
    expect(service.getSnapshot().update).toMatchObject({ availability: 'available', offer: { version: 3 }, dismissed: false });
    await service.close();
  });

  it('prepares natively, installs the staged artifact from the private path and becomes current', async () => {
    const updates = source(async () => ({ status: 'available', version: 3 }));
    const fetcher = updateFetcher(() => remote(3));
    const { service, port } = updatingService({ updates, fetcher });
    await service.start();
    await service.checkForUpdate({ force: true });
    const offer = service.getSnapshot().update.offer;
    await service.installUpdate();

    expect(updates.prepare).toHaveBeenCalledWith(3);
    expect(vi.mocked(fetcher).mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
      '/catalog/private/manifest.json',
      '/catalog/private/kilter-7x10.v3.db.gz',
    ]);
    expect(port.installCatalog).toHaveBeenCalledWith(offer, expect.any(ArrayBuffer));
    expect(service.getSnapshot()).toMatchObject({
      storage: { status: 'ready', receipt: { manifest: { version: 3 } } },
      operation: 'idle',
      error: null,
      update: { availability: 'current', offer: null, error: null },
    });
    expect(service.getSnapshot().queries?.provenance.source).toBe('Kilter community climbs via Boardsesh');
    await service.close();
  });

  it('keeps the installed catalog active when preparation or installation fails', async () => {
    const updates = source(async () => ({ status: 'available', version: 3 }));
    updates.prepare.mockRejectedValueOnce(new CatalogUpdateError('integrity'));
    const retained = receipt(manifest, 'a');
    const port = portFor({
      status: async () => statusReady(retained),
      install: async () => ({ ok: false, code: 'digest', message: 'Catalog snapshot digest does not match its manifest', retained }),
    });
    const { service } = updatingService({ updates, port });
    await service.start();
    const queries = service.getSnapshot().queries;
    await service.checkForUpdate({ force: true });

    await service.installUpdate();
    expect(port.installCatalog).not.toHaveBeenCalled();
    expect(service.getSnapshot()).toMatchObject({
      storage: { status: 'ready', receipt: retained },
      operation: 'idle',
      error: null,
      update: { availability: 'available', offer: { version: 3 }, error: { code: 'integrity' } },
    });
    expect(service.getSnapshot().queries).toBe(queries);

    await service.installUpdate();
    expect(port.installCatalog).toHaveBeenCalledOnce();
    expect(service.getSnapshot()).toMatchObject({
      storage: { status: 'ready', receipt: retained },
      error: null,
      update: { offer: { version: 3 }, error: { code: 'digest' } },
    });
    expect(service.getSnapshot().queries?.provenance.snapshotId).toBe(retained.manifest.sha256);
    await service.close();
  });

  it('cancels an update download before activation and keeps the installed catalog', async () => {
    const preparing = deferred<undefined>();
    const updates = source(async () => ({ status: 'available', version: 3 }));
    updates.prepare.mockImplementationOnce(() => preparing.promise);
    const { service, port } = updatingService({ updates });
    await service.start();
    await service.checkForUpdate({ force: true });
    const installing = service.installUpdate();
    expect(service.getSnapshot().operation).toBe('downloading');
    service.cancelDownload();
    preparing.resolve(undefined);
    await installing;
    expect(port.installCatalog).not.toHaveBeenCalled();
    expect(service.getSnapshot()).toMatchObject({
      storage: { status: 'ready' },
      operation: 'idle',
      update: { error: { code: 'aborted' } },
    });
    await service.close();
  });

  it('offers the signed-in remote catalog for a first install and installs it through preparation', async () => {
    const updates = source(async () => ({ status: 'available', version: 3 }));
    const fetcher = updateFetcher(() => remote(3));
    const { service, port } = updatingService({ updates, fetcher, port: portFor() });
    await service.loadOffer();
    expect(service.getSnapshot().offer).toMatchObject({ schemaVersion: 3, version: 3 });
    await service.installOffer();
    expect(updates.prepare).toHaveBeenCalledWith(3);
    expect(String(vi.mocked(fetcher).mock.calls.at(-1)?.[0])).toMatch(/\/catalog\/private\/kilter-7x10\.v3\.db\.gz$/);
    expect(port.installCatalog).toHaveBeenCalledOnce();
    expect(service.getSnapshot().storage).toMatchObject({ status: 'ready', receipt: { manifest: { version: 3 } } });
    await service.close();
  });

  it.each([
    ['signed out', async (): Promise<CatalogUpdateCheck> => ({ status: 'signed-out' })],
    ['offline', async (): Promise<CatalogUpdateCheck> => { throw new CatalogUpdateError('network'); }],
    ['unpublished', async (): Promise<CatalogUpdateCheck> => ({ status: 'none' })],
  ])('falls back to the bundled first-install offer when %s', async (_label, check) => {
    const updates = source(check);
    const fetcher = updateFetcher(() => remote(3));
    const { service } = updatingService({ updates, fetcher, port: portFor() });
    await service.loadOffer();
    expect(service.getSnapshot().offer).toEqual(manifest);
    await service.installOffer();
    expect(updates.prepare).not.toHaveBeenCalled();
    expect(String(vi.mocked(fetcher).mock.calls.at(-1)?.[0])).toMatch(/\/catalog\/kilter-7x10\.v1\.db\.gz$/);
    await service.close();
  });

  it('drops a remote first-install offer the account can no longer prepare', async () => {
    const updates = source(async () => ({ status: 'available', version: 3 }));
    updates.prepare.mockRejectedValueOnce(new CatalogUpdateError('signed-out'));
    const { service } = updatingService({ updates, port: portFor() });
    await service.loadOffer();
    await service.installOffer();
    expect(service.getSnapshot()).toMatchObject({
      storage: { status: 'empty' },
      offer: null,
      error: { code: 'network', message: 'Sign in to get catalog updates.' },
      update: { availability: 'signed-out' },
    });
    await service.close();
  });
});
