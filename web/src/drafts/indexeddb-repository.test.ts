import { IDBFactory } from 'fake-indexeddb';
import { apiLevel3Color } from '../domain/boards/colors.ts';
import { boardInstallationId } from '../installations/contracts.ts';
import { draftRevision, localDraftId } from './codec.ts';
import { DraftConflictError, DraftNotFoundError } from './errors.ts';
import { IndexedDbLocalDraftRepository } from './indexeddb-repository.ts';
import { DRAFT_STORE_NAME, openDraftDatabase } from './open-draft-database.ts';
import {
  draftContent,
  FIRST_DRAFT_ID,
  SECOND_DRAFT_ID,
  TEST_INSTALLATION_ID,
} from './test-fixtures.ts';

async function repository(options: { now?: () => Date; createId?: () => string } = {}) {
  const factory = new IDBFactory();
  const database = await openDraftDatabase(factory);
  return { factory, repository: new IndexedDbLocalDraftRepository(database, options) };
}

describe('IndexedDbLocalDraftRepository', () => {
  it('supports unrestricted CRUD, exact revisions, and immutable snapshots', async () => {
    const times = ['2026-08-02T12:00:00.000Z', '2026-08-02T13:00:00.000Z'];
    const context = await repository({
      createId: () => FIRST_DRAFT_ID,
      now: () => new Date(times.shift()!),
    });
    const placementId = (await import('../domain/boards/definitions/kilter-fullride-7x10.ts'))
      .kilterFullride7x10Definition.placements[0].id;
    const created = await context.repository.create(draftContent());
    expect(created).toMatchObject({ id: FIRST_DRAFT_ID, revision: 1, assignments: [] });
    expect(await context.repository.get(created.id)).toEqual(created);

    const content = draftContent({
      assignments: [{ placementId, appearance: { kind: 'custom', color: apiLevel3Color(255) } }],
    });
    const updated = await context.repository.update(created.id, created.revision, content);
    expect(updated).toMatchObject({
      revision: 2,
      createdAt: created.createdAt,
      updatedAt: '2026-08-02T13:00:00.000Z',
    });
    expect(Object.isFrozen(updated.assignments)).toBe(true);
    await context.repository.delete(updated.id, updated.revision);
    expect(await context.repository.get(updated.id)).toBeNull();
  });

  it('prevents stale updates and deletes and distinguishes missing records', async () => {
    const context = await repository({ createId: () => FIRST_DRAFT_ID });
    const first = await context.repository.create(draftContent());
    const second = await context.repository.update(
      first.id,
      first.revision,
      draftContent({ name: 'newer' }),
    );
    await expect(
      context.repository.update(first.id, first.revision, draftContent()),
    ).rejects.toBeInstanceOf(DraftConflictError);
    await expect(context.repository.delete(first.id, first.revision)).rejects.toBeInstanceOf(
      DraftConflictError,
    );
    expect(await context.repository.get(first.id)).toEqual(second);
    const missing = localDraftId(SECOND_DRAFT_ID);
    await expect(
      context.repository.update(missing, first.revision, draftContent()),
    ).rejects.toBeInstanceOf(DraftNotFoundError);
    await expect(context.repository.delete(missing, first.revision)).rejects.toBeInstanceOf(
      DraftNotFoundError,
    );
  });

  it('aborts invalid replacements atomically and preserves the prior aggregate', async () => {
    const context = await repository({ createId: () => FIRST_DRAFT_ID });
    const created = await context.repository.create(draftContent({ name: 'safe' }));
    await expect(
      context.repository.update(created.id, created.revision, {
        ...draftContent(),
        angle: Number.NaN,
      }),
    ).rejects.toMatchObject({ code: 'corrupt-record', path: 'angle' });
    expect(await context.repository.get(created.id)).toEqual(created);
  });

  it('sorts newest first with a stable descending ID tie-break and filters installations', async () => {
    const ids = [FIRST_DRAFT_ID, SECOND_DRAFT_ID];
    const context = await repository({
      createId: () => ids.shift()!,
      now: () => new Date('2026-08-02T12:00:00.000Z'),
    });
    const first = await context.repository.create(draftContent({ name: 'first' }));
    const otherInstallation = boardInstallationId('other');
    const second = await context.repository.create(
      draftContent({ name: 'second', installationId: otherInstallation }),
    );
    expect((await context.repository.list()).map((draft) => draft.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(await context.repository.list({ installationId: TEST_INSTALLATION_ID })).toEqual([
      first,
    ]);
  });

  it('never overwrites on an injected ID collision', async () => {
    const context = await repository({ createId: () => FIRST_DRAFT_ID });
    const original = await context.repository.create(draftContent({ name: 'original' }));
    await expect(
      context.repository.create(draftContent({ name: 'replacement' })),
    ).rejects.toBeInstanceOf(DraftConflictError);
    expect(await context.repository.get(original.id)).toEqual(original);
  });

  it('survives close/reopen and serializes optimistic updates across connections', async () => {
    const factory = new IDBFactory();
    const firstDb = await openDraftDatabase(factory);
    const first = new IndexedDbLocalDraftRepository(firstDb, { createId: () => FIRST_DRAFT_ID });
    const created = await first.create(draftContent());
    first.close();

    const secondDb = await openDraftDatabase(factory);
    const thirdDb = await openDraftDatabase(factory);
    const second = new IndexedDbLocalDraftRepository(secondDb);
    const third = new IndexedDbLocalDraftRepository(thirdDb);
    expect(await second.get(created.id)).toEqual(created);
    const results = await Promise.allSettled([
      second.update(created.id, created.revision, draftContent({ name: 'A' })),
      third.update(created.id, created.revision, draftContent({ name: 'B' })),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const failure = results.find(({ status }) => status === 'rejected');
    expect(failure).toMatchObject({ status: 'rejected', reason: expect.any(DraftConflictError) });
  });

  it('serializes a concurrent update and delete from the same revision', async () => {
    const factory = new IDBFactory();
    const createDatabase = await openDraftDatabase(factory);
    const creator = new IndexedDbLocalDraftRepository(createDatabase, {
      createId: () => FIRST_DRAFT_ID,
    });
    const created = await creator.create(draftContent());

    const updateRepository = new IndexedDbLocalDraftRepository(await openDraftDatabase(factory));
    const deleteRepository = new IndexedDbLocalDraftRepository(await openDraftDatabase(factory));
    const results = await Promise.allSettled([
      updateRepository.update(created.id, created.revision, draftContent({ name: 'updated' })),
      deleteRepository.delete(created.id, created.revision),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    if (results[0].status === 'fulfilled') {
      expect(await creator.get(created.id)).toEqual(results[0].value);
    } else {
      expect(await creator.get(created.id)).toBeNull();
    }
    creator.close();
    updateRepository.close();
    deleteRepository.close();
  });

  it('surfaces corrupt rows without deleting them', async () => {
    const context = await repository({ createId: () => FIRST_DRAFT_ID });
    const created = await context.repository.create(draftContent());
    const database = await openDraftDatabase(context.factory);
    const transaction = database.transaction(DRAFT_STORE_NAME, 'readwrite');
    const wireRequest = transaction.objectStore(DRAFT_STORE_NAME).get(created.id);
    await new Promise<void>((resolve, reject) => {
      wireRequest.onsuccess = () => {
        transaction.objectStore(DRAFT_STORE_NAME).put({ ...wireRequest.result, angle: 'bad' });
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    await expect(context.repository.list()).rejects.toMatchObject({
      code: 'corrupt-record',
      path: 'angle',
    });
    expect(
      await new Promise((resolve, reject) => {
        const request = database
          .transaction(DRAFT_STORE_NAME)
          .objectStore(DRAFT_STORE_NAME)
          .get(created.id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
    ).toMatchObject({ angle: 'bad' });
  });

  it('normalizes closed-database failures for every repository operation', async () => {
    const context = await repository({ createId: () => FIRST_DRAFT_ID });
    const database = await openDraftDatabase(context.factory);
    const closed = new IndexedDbLocalDraftRepository(database, {
      createId: () => SECOND_DRAFT_ID,
    });
    database.close();
    const id = localDraftId(FIRST_DRAFT_ID);
    const revision = draftRevision(1);

    await expect(closed.create(draftContent())).rejects.toMatchObject({ code: 'unavailable' });
    await expect(closed.get(id)).rejects.toMatchObject({ code: 'unavailable' });
    await expect(closed.list()).rejects.toMatchObject({ code: 'unavailable' });
    await expect(closed.update(id, revision, draftContent())).rejects.toMatchObject({
      code: 'unavailable',
    });
    await expect(closed.delete(id, revision)).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('waits for transaction abort before classifying quota failures', async () => {
    let requestError: DOMException | null = null;
    let transactionErrorValue: DOMException | null = null;
    const request = {
      get error() {
        return requestError;
      },
      onerror: null,
    } as unknown as IDBRequest<IDBValidKey>;
    const transaction = {
      get error() {
        return transactionErrorValue;
      },
      objectStore: () => ({ add: () => request }),
      oncomplete: null,
      onabort: null,
      onerror: null,
    } as unknown as IDBTransaction;
    const database = { transaction: () => transaction } as unknown as IDBDatabase;
    const quota = new DOMException('full', 'QuotaExceededError');
    const draftRepository = new IndexedDbLocalDraftRepository(database, {
      createId: () => FIRST_DRAFT_ID,
    });

    const create = draftRepository.create(draftContent());
    requestError = quota;
    request.onerror?.call(request, new Event('error', { cancelable: true }));
    transaction.onerror?.call(transaction, new Event('error'));
    transactionErrorValue = quota;
    transaction.onabort?.call(transaction, new Event('abort'));

    await expect(create).rejects.toMatchObject({ code: 'quota-exceeded', cause: quota });
  });
});
