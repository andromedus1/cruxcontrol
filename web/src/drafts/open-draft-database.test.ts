import { IDBFactory } from 'fake-indexeddb';
import { DraftRepositoryError, translateDraftStorageError } from './errors.ts';
import {
  DRAFT_DATABASE_NAME,
  DRAFT_DATABASE_VERSION,
  DRAFT_STORE_NAME,
  openDraftDatabase,
} from './open-draft-database.ts';

function requestResult(request: IDBOpenDBRequest): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe('draft storage failures', () => {
  it('translates unavailable factories and quota errors to stable codes', async () => {
    const cause = new DOMException('denied', 'SecurityError');
    await expect(
      openDraftDatabase({
        open: () => {
          throw cause;
        },
      }),
    ).rejects.toMatchObject({
      code: 'unavailable',
      cause,
    });
    const quota = new DOMException('full', 'QuotaExceededError');
    expect(translateDraftStorageError(quota, 'write failed')).toMatchObject({
      code: 'quota-exceeded',
      cause: quota,
    });
  });

  it('does not erase an existing typed repository error', () => {
    const error = new DraftRepositoryError('conflict', 'already typed');
    expect(translateDraftStorageError(error, 'ignored')).toBe(error);
  });

  it('returns an unavailable error when the browser has no IndexedDB implementation', async () => {
    vi.stubGlobal('indexedDB', undefined);
    try {
      await expect(openDraftDatabase()).rejects.toMatchObject({ code: 'unavailable' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('surfaces blocked upgrades and closes connections on version changes', async () => {
    const blockedFactory = new IDBFactory();
    const legacy = await openDraftDatabase(blockedFactory);
    legacy.onversionchange = () => undefined;

    await expect(
      openDraftDatabase({
        open: (name) => blockedFactory.open(name, DRAFT_DATABASE_VERSION + 1),
      }),
    ).rejects.toMatchObject({
      code: 'unavailable',
      message: expect.stringContaining('blocked'),
    });
    legacy.close();
    const upgraded = await requestResult(
      blockedFactory.open(DRAFT_DATABASE_NAME, DRAFT_DATABASE_VERSION + 1),
    );
    upgraded.close();

    const versionChangeFactory = new IDBFactory();
    const current = await openDraftDatabase(versionChangeFactory);
    const next = await requestResult(
      versionChangeFactory.open(DRAFT_DATABASE_NAME, DRAFT_DATABASE_VERSION + 1),
    );
    expect(() => current.transaction(DRAFT_STORE_NAME)).toThrow();
    next.close();
  });
});
