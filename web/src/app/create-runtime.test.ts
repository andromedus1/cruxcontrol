import { describe, expect, it, vi } from 'vitest';
import { createCruxControlRuntime } from './create-runtime.ts';
import { activeInstallationId, createAppInstallationRegistry } from './installations.ts';
import { browserLibraryBackupDelivery, type LibraryBackupDelivery } from '../library-backup/delivery.ts';

function database() {
  return { close: vi.fn() } as unknown as IDBDatabase;
}

describe('createCruxControlRuntime', () => {
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
    const delivery: LibraryBackupDelivery = { kind: 'share', deliver: vi.fn(async () => ({ status: 'shared' as const })) };
    const runtime = await createCruxControlRuntime({
      openDrafts: async () => drafts,
      openPlaylists: async () => playlists,
      getInstallation: () => createAppInstallationRegistry().require(activeInstallationId),
      backupDelivery: delivery,
    });
    expect(runtime.backupDelivery).toBe(delivery);
    runtime.close();
  });
});
