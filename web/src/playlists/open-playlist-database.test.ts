import { IDBFactory } from 'fake-indexeddb';
import { PlaylistRepositoryError, translatePlaylistStorageError } from './errors.ts';
import {
  PLAYLIST_DATABASE_NAME,
  PLAYLIST_DATABASE_VERSION,
  PLAYLIST_STORE_NAME,
  openPlaylistDatabase,
} from './open-playlist-database.ts';

function requestResult(request: IDBOpenDBRequest): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe('playlist storage startup and failures', () => {
  it('translates unavailable factories and quota failures to retryable stable codes', async () => {
    const unavailable = new DOMException('denied', 'SecurityError');
    await expect(
      openPlaylistDatabase({
        open: () => {
          throw unavailable;
        },
      }),
    ).rejects.toMatchObject({ code: 'unavailable', cause: unavailable });

    const quota = new DOMException('full', 'QuotaExceededError');
    expect(translatePlaylistStorageError(quota, 'write failed')).toMatchObject({
      code: 'quota-exceeded',
      cause: quota,
    });
    const typed = new PlaylistRepositoryError('conflict', 'already typed');
    expect(translatePlaylistStorageError(typed, 'ignored')).toBe(typed);
  });

  it('reports missing IndexedDB explicitly', async () => {
    vi.stubGlobal('indexedDB', undefined);
    try {
      await expect(openPlaylistDatabase()).rejects.toMatchObject({ code: 'unavailable' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('surfaces blocked upgrades and closes connections on version changes', async () => {
    const blockedFactory = new IDBFactory();
    const legacy = await openPlaylistDatabase(blockedFactory);
    legacy.onversionchange = () => undefined;
    await expect(
      openPlaylistDatabase({
        open: (name) => blockedFactory.open(name, PLAYLIST_DATABASE_VERSION + 1),
      }),
    ).rejects.toMatchObject({ code: 'unavailable', message: expect.stringContaining('blocked') });
    legacy.close();
    (
      await requestResult(
        blockedFactory.open(PLAYLIST_DATABASE_NAME, PLAYLIST_DATABASE_VERSION + 1),
      )
    ).close();

    const versionChangeFactory = new IDBFactory();
    const current = await openPlaylistDatabase(versionChangeFactory);
    const next = await requestResult(
      versionChangeFactory.open(PLAYLIST_DATABASE_NAME, PLAYLIST_DATABASE_VERSION + 1),
    );
    expect(() => current.transaction(PLAYLIST_STORE_NAME)).toThrow();
    next.close();
  });
});
