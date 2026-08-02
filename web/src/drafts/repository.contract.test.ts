import type { LocalDraftRepository } from './repository.ts';
import { draftContent, FIRST_DRAFT_ID, SECOND_DRAFT_ID } from './test-fixtures.ts';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDbLocalDraftRepository } from './indexeddb-repository.ts';
import { openDraftDatabase } from './open-draft-database.ts';
import { apiLevel3Color } from '../domain/boards/colors.ts';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10.ts';
import { lightEffectGroupId } from '../board-renderer/types.ts';

export interface DraftRepositoryContractContext {
  readonly repository: LocalDraftRepository;
  close(): void;
}

export function runLocalDraftRepositoryContract(
  name: string,
  create: (ids: readonly string[]) => Promise<DraftRepositoryContractContext>,
): void {
  describe(`${name} local draft repository contract`, () => {
    it('creates, lists, updates, trashes, restores, and permanently deletes unrestricted climbs', async () => {
      const context = await create([FIRST_DRAFT_ID]);
      const created = await context.repository.create(draftContent());
      expect(created).toMatchObject({
        id: FIRST_DRAFT_ID,
        revision: 1,
        status: 'draft',
        name: '',
        assignments: [],
      });
      expect(await context.repository.list()).toEqual([created]);
      const updated = await context.repository.update(
        created.id,
        created.revision,
        draftContent({
          status: 'finished',
          name: 'unconventional',
          metadata: { setterNotes: '' },
        }),
      );
      expect(updated).toMatchObject({
        revision: 2,
        createdAt: created.createdAt,
        status: 'finished',
        name: 'unconventional',
      });
      expect(await context.repository.list({ collection: 'drafts' })).toEqual([]);
      expect(await context.repository.list({ collection: 'finished' })).toEqual([updated]);

      const trashed = await context.repository.trash(updated.id, updated.revision);
      expect(trashed).toMatchObject({ id: created.id, revision: 3, status: 'finished' });
      expect(trashed.trashedAt).toBeDefined();
      expect(await context.repository.list()).toEqual([]);
      expect(await context.repository.list({ collection: 'trash' })).toEqual([trashed]);

      const restored = await context.repository.restore(trashed.id, trashed.revision);
      expect(restored).toMatchObject({ id: created.id, revision: 4, status: 'finished' });
      expect(restored).not.toHaveProperty('trashedAt');
      expect(await context.repository.list({ collection: 'finished' })).toEqual([restored]);

      await context.repository.deletePermanently(restored.id, restored.revision);
      expect(await context.repository.get(restored.id)).toBeNull();
      context.close();
    });

    it('keeps records distinct when timestamps collide', async () => {
      const context = await create([FIRST_DRAFT_ID, SECOND_DRAFT_ID]);
      const first = await context.repository.create(draftContent({ name: 'first' }));
      const second = await context.repository.create(draftContent({ name: 'second' }));
      expect((await context.repository.list()).map(({ id }) => id)).toEqual([second.id, first.id]);
      context.close();
    });

    it('persists normalized effect groups and membership through create and update', async () => {
      const context = await create([FIRST_DRAFT_ID]);
      const placementId = kilterFullride7x10Definition.placements[0]!.id;
      const content = draftContent({
        assignments: [
          {
            placementId,
            appearance: { kind: 'custom', color: apiLevel3Color(42) },
            effectGroupId: lightEffectGroupId('pulse-a'),
          },
        ],
        effectGroups: [
          {
            id: lightEffectGroupId('pulse-a'),
            kind: 'pulse',
            palette: [apiLevel3Color(42)],
            periodMs: 1000,
            intensity: 0.5,
          },
        ],
      });
      const created = await context.repository.create(content);
      expect(created.effectGroups).toEqual(content.effectGroups);
      expect(created.assignments).toEqual(content.assignments);
      const updated = await context.repository.update(created.id, created.revision, {
        ...content,
        effectGroups: [],
        assignments: content.assignments.map(({ placementId, appearance }) => ({
          placementId,
          appearance,
        })),
      });
      expect(updated.effectGroups).toEqual([]);
      expect(updated.assignments[0]).not.toHaveProperty('effectGroupId');
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
