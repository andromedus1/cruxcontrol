import { describe, expect, it, vi } from 'vitest';
import { createCruxControlRuntime } from './create-runtime.ts';
import { activeInstallationId, createAppInstallationRegistry } from './installations.ts';
import {
  browserLibraryBackupDelivery,
  type LibraryBackupDelivery,
} from '../library-backup/delivery.ts';
import type { AppLibrary } from './library.ts';
import type { CatalogService } from '../catalog/service.ts';

function database() {
  return { close: vi.fn() } as unknown as IDBDatabase;
}

describe('createCruxControlRuntime', () => {
  it('owns only an injected library and closes it after composition failure or repeated disposal', async () => {
    const library = {
      drafts: {},
      playlists: {},
      backupStore: {},
      close: vi.fn(),
    } as unknown as AppLibrary;
    const openDrafts = vi.fn();
    const openPlaylists = vi.fn();
    const runtime = await createCruxControlRuntime({
      openLibrary: async () => library,
      openDrafts,
      openPlaylists,
    });
    expect(runtime.drafts).toBe(library.drafts);
    expect(runtime.playlists).toBe(library.playlists);
    expect(openDrafts).not.toHaveBeenCalled();
    expect(openPlaylists).not.toHaveBeenCalled();
    runtime.close();
    runtime.close();
    expect(library.close).toHaveBeenCalledOnce();
    vi.mocked(library.close).mockClear();
    await expect(
      createCruxControlRuntime({
        openLibrary: async () => library,
        getInstallation: () => {
          throw new Error('No installation');
        },
      }),
    ).rejects.toThrow('No installation');
    expect(library.close).toHaveBeenCalledOnce();
  });

  it('closes draft storage when playlist startup fails', async () => {
    const drafts = database();
    const failure = new Error('Playlist storage unavailable');
    await expect(
      createCruxControlRuntime({
        openDrafts: async () => drafts,
        openPlaylists: async () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);
    expect(drafts.close).toHaveBeenCalledOnce();
  });

  it('closes both databases when later runtime composition fails', async () => {
    const drafts = database();
    const playlists = database();
    await expect(
      createCruxControlRuntime({
        openDrafts: async () => drafts,
        openPlaylists: async () => playlists,
        getInstallation: () => {
          throw new Error('No installation');
        },
      }),
    ).rejects.toThrow('No installation');
    expect(playlists.close).toHaveBeenCalledOnce();
    expect(drafts.close).toHaveBeenCalledOnce();
  });

  it('owns and closes both successful database connections', async () => {
    const drafts = database();
    const playlists = database();
    const runtime = await createCruxControlRuntime({
      openDrafts: async () => drafts,
      openPlaylists: async () => playlists,
      getInstallation: () => createAppInstallationRegistry().require(activeInstallationId),
    });
    runtime.close();
    expect(playlists.close).toHaveBeenCalledOnce();
    expect(drafts.close).toHaveBeenCalledOnce();
    expect(runtime.backupDelivery).toBe(browserLibraryBackupDelivery);
  });

  it('returns an injected backup delivery through runtime composition', async () => {
    const drafts = database();
    const playlists = database();
    const delivery: LibraryBackupDelivery = {
      kind: 'share',
      deliver: vi.fn(async () => ({ status: 'shared' as const })),
    };
    const runtime = await createCruxControlRuntime({
      openDrafts: async () => drafts,
      openPlaylists: async () => playlists,
      getInstallation: () => createAppInstallationRegistry().require(activeInstallationId),
      backupDelivery: delivery,
    });
    expect(runtime.backupDelivery).toBe(delivery);
    runtime.close();
  });

  it('composes the catalog service without starting its lazy storage port and retains backup delivery', async () => {
    const drafts = database();
    const playlists = database();
    const catalog: CatalogService = {
      getSnapshot: () => ({
        storage: null,
        operation: 'idle',
        offer: null,
        progress: null,
        error: null,
        queries: null,
      }),
      subscribe: () => () => undefined,
      start: vi.fn(async () => undefined),
      loadOffer: vi.fn(async () => undefined),
      installOffer: vi.fn(async () => undefined),
      cancelDownload: vi.fn(),
      retryOpen: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };
    const createCatalog = vi.fn(() => catalog);
    const delivery: LibraryBackupDelivery = {
      kind: 'share',
      deliver: vi.fn(async () => ({ status: 'shared' as const })),
    };
    const runtime = await createCruxControlRuntime({
      openDrafts: async () => drafts,
      openPlaylists: async () => playlists,
      getInstallation: () => createAppInstallationRegistry().require(activeInstallationId),
      createCatalog,
      backupDelivery: delivery,
    });

    expect(createCatalog).toHaveBeenCalledWith(runtime.installation.definition);
    expect(runtime.catalog).toBe(catalog);
    expect(catalog.start).not.toHaveBeenCalled();
    expect(runtime.backupDelivery).toBe(delivery);
    runtime.close();
    expect(catalog.close).toHaveBeenCalledOnce();
  });
});
