import { IDBFactory } from 'fake-indexeddb';
import { IndexedDbLocalPlaylistRepository } from './indexeddb-repository.ts';
import { openPlaylistDatabase } from './open-playlist-database.ts';
import {
  FIRST_PLAYLIST_ID,
  LOCAL_CLIMB_ID,
  playlistContent,
  providerReference,
  SECOND_PLAYLIST_ID,
} from './test-fixtures.ts';

function controlledRepository(
  factory: IDBFactory,
  ids: string[],
  times: string[] = ['2026-08-02T12:00:00.000Z'],
) {
  return openPlaylistDatabase(factory).then((database) => ({
    database,
    repository: new IndexedDbLocalPlaylistRepository(database, {
      createId: () => ids.shift()!,
      now: () => new Date(times.length > 1 ? times.shift()! : times[0]!),
    }),
  }));
}

describe('IndexedDB local playlist repository', () => {
  it('creates, reads, updates, and deletes with stable identity and optimistic revisions', async () => {
    const factory = new IDBFactory();
    const { repository } = await controlledRepository(
      factory,
      [FIRST_PLAYLIST_ID],
      ['2026-08-02T12:00:00.000Z', '2026-08-02T12:01:00.000Z'],
    );
    const created = await repository.create(
      playlistContent({
        entries: [{ kind: 'local', id: LOCAL_CLIMB_ID }, providerReference],
      }),
    );
    expect(created).toMatchObject({ id: FIRST_PLAYLIST_ID, revision: 1 });
    expect(await repository.get(created.id)).toEqual(created);
    expect(await repository.list()).toEqual([created]);

    const updated = await repository.update(created.id, created.revision, {
      name: 'Renamed projects',
      notes: 'New notes',
      entries: [providerReference, created.entries[0]!],
    });
    expect(updated).toMatchObject({
      id: created.id,
      revision: 2,
      createdAt: created.createdAt,
      updatedAt: '2026-08-02T12:01:00.000Z',
      name: 'Renamed projects',
    });
    expect(updated.entries).toEqual([providerReference, created.entries[0]]);
    await expect(
      repository.update(created.id, created.revision, playlistContent()),
    ).rejects.toMatchObject({ code: 'conflict', expectedRevision: 1, actualRevision: 2 });
    await expect(repository.delete(updated.id, created.revision)).rejects.toMatchObject({
      code: 'conflict',
    });

    await repository.delete(updated.id, updated.revision);
    expect(await repository.get(updated.id)).toBeNull();
    repository.close();
  });

  it('uses deterministic newest-updated-first ordering across timestamp ties', async () => {
    const factory = new IDBFactory();
    const { repository } = await controlledRepository(
      factory,
      [FIRST_PLAYLIST_ID, SECOND_PLAYLIST_ID],
      ['2026-08-02T12:00:00.000Z', '2026-08-02T12:00:00.000Z', '2026-08-02T12:02:00.000Z'],
    );
    const first = await repository.create(playlistContent({ name: 'First' }));
    const second = await repository.create(playlistContent({ name: 'Second' }));
    expect((await repository.list()).map(({ id }) => id)).toEqual([second.id, first.id]);
    await repository.update(first.id, first.revision, playlistContent({ name: 'First updated' }));
    expect((await repository.list()).map(({ id }) => id)).toEqual([first.id, second.id]);
    repository.close();
  });

  it('preserves records when the separate playlist database is reopened', async () => {
    const factory = new IDBFactory();
    const firstConnection = await controlledRepository(factory, [FIRST_PLAYLIST_ID]);
    const created = await firstConnection.repository.create(playlistContent());
    firstConnection.repository.close();

    const database = await openPlaylistDatabase(factory);
    const reopened = new IndexedDbLocalPlaylistRepository(database);
    expect(await reopened.list()).toEqual([created]);
    reopened.close();
  });

  it('reports not-found and duplicate-ID conflicts without partial writes', async () => {
    const factory = new IDBFactory();
    const { repository } = await controlledRepository(factory, [
      FIRST_PLAYLIST_ID,
      FIRST_PLAYLIST_ID,
    ]);
    const created = await repository.create(playlistContent());
    await expect(repository.create(playlistContent({ name: 'Collision' }))).rejects.toMatchObject({
      code: 'conflict',
    });
    await expect(
      repository.update(
        '00000000-0000-4000-8000-000000000099' as typeof created.id,
        created.revision,
        playlistContent(),
      ),
    ).rejects.toMatchObject({ code: 'not-found' });
    expect(await repository.list()).toEqual([created]);
    repository.close();
  });
});
