import type { LocalDraftRepository } from './repository.ts';
import { draftContent, FIRST_DRAFT_ID, SECOND_DRAFT_ID } from './test-fixtures.ts';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDbLocalDraftRepository } from './indexeddb-repository.ts';
import { openDraftDatabase } from './open-draft-database.ts';

export interface DraftRepositoryContractContext {
  readonly repository: LocalDraftRepository;
  close(): void;
}

export function runLocalDraftRepositoryContract(
  name: string,
  create: (ids: readonly string[]) => Promise<DraftRepositoryContractContext>,
): void {
  describe(`${name} local draft repository contract`, () => {
    it('creates, lists, updates, and deletes unrestricted drafts', async () => {
      const context = await create([FIRST_DRAFT_ID]);
      const created = await context.repository.create(draftContent());
      expect(created).toMatchObject({ id: FIRST_DRAFT_ID, revision: 1, name: '', assignments: [] });
      expect(await context.repository.list()).toEqual([created]);
      const updated = await context.repository.update(
        created.id,
        created.revision,
        draftContent({ name: 'unconventional', metadata: { setterNotes: '' } }),
      );
      expect(updated).toMatchObject({
        revision: 2,
        createdAt: created.createdAt,
        name: 'unconventional',
      });
      await context.repository.delete(updated.id, updated.revision);
      expect(await context.repository.get(updated.id)).toBeNull();
      context.close();
    });

    it('keeps records distinct when timestamps collide', async () => {
      const context = await create([FIRST_DRAFT_ID, SECOND_DRAFT_ID]);
      const first = await context.repository.create(draftContent({ name: 'first' }));
      const second = await context.repository.create(draftContent({ name: 'second' }));
      expect((await context.repository.list()).map(({ id }) => id)).toEqual([second.id, first.id]);
      context.close();
    });
  });
}

runLocalDraftRepositoryContract('IndexedDB', async (sourceIds) => {
  const ids = [...sourceIds];
  const database = await openDraftDatabase(new IDBFactory());
  const repository = new IndexedDbLocalDraftRepository(database, {
    createId: () => ids.shift()!,
    now: () => new Date('2026-08-02T12:00:00.000Z'),
  });
  return { repository, close: () => repository.close() };
});
