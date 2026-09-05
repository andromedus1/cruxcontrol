import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { draftRevision, localDraftId } from '../drafts/codec.ts';
import { IndexedDbLocalDraftRepository } from '../drafts/indexeddb-repository.ts';
import { openDraftDatabase, DRAFT_STORE_NAME } from '../drafts/open-draft-database.ts';
import { draftContent } from '../drafts/test-fixtures.ts';
import { playlistId } from '../playlists/codec.ts';
import { IndexedDbLocalPlaylistRepository } from '../playlists/indexeddb-repository.ts';
import { openPlaylistDatabase } from '../playlists/open-playlist-database.ts';
import { PLAYLIST_STORE_NAME } from '../playlists/open-playlist-database.ts';
import { IndexedDbLibraryBackupStore } from './indexeddb-store.ts';
import type { LocalClimbDraft } from '../drafts/types.ts';

const firstId = localDraftId('00000000-0000-4000-8000-000000000401');
const secondId = localDraftId('00000000-0000-4000-8000-000000000402');

function rawValue(database: IDBDatabase, storeName: string, id: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName).objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe('IndexedDbLibraryBackupStore', () => {
  it('reads every raw row, including Trash, and restores absent rows with exact identity', async () => {
    const factory = new IDBFactory();
    const draftsDb = await openDraftDatabase(factory);
    const playlistsDb = await openPlaylistDatabase(factory);
    const draftRepository = new IndexedDbLocalDraftRepository(draftsDb, { createId: () => firstId });
    const playlistRepository = new IndexedDbLocalPlaylistRepository(playlistsDb, { createId: () => playlistId('00000000-0000-4000-8000-000000000403') });
    const created = await draftRepository.create(draftContent({ name: 'Saved' }));
    const trashed = await draftRepository.trash(created.id, created.revision);
    const list = await playlistRepository.create({ name: 'List', notes: '', entries: [{ kind: 'local', id: trashed.id }] });
    const store = new IndexedDbLibraryBackupStore(draftsDb, playlistsDb);
    expect(await store.readDrafts()).toEqual([trashed]);
    expect(await store.readPlaylists()).toEqual([list]);
    const absent: LocalClimbDraft = { ...draftContent({ name: 'Recovered' }), schemaVersion: 4, id: secondId, revision: draftRevision(9), createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-02T00:00:00.000Z', metadata: {} };
    await expect(store.restoreMissingDrafts([trashed, absent])).resolves.toEqual({ added: 1, unchanged: 1 });
    expect(await store.readDrafts()).toHaveLength(2);
    expect(await rawValue(draftsDb, DRAFT_STORE_NAME, secondId)).toMatchObject({ id: secondId, revision: 9, createdAt: absent.createdAt });
    expect(await rawValue(playlistsDb, PLAYLIST_STORE_NAME, list.id)).toMatchObject({ id: list.id, entries: [{ kind: 'local', id: trashed.id }] });
    draftsDb.close(); playlistsDb.close();
  });

  it('aborts all queued adds when a later existing ID conflicts', async () => {
    const factory = new IDBFactory();
    const draftsDb = await openDraftDatabase(factory);
    const playlistsDb = await openPlaylistDatabase(factory);
    const repository = new IndexedDbLocalDraftRepository(draftsDb, { createId: () => firstId });
    const existing = await repository.create(draftContent({ name: 'Current' }));
    const store = new IndexedDbLibraryBackupStore(draftsDb, playlistsDb);
    const absent: LocalClimbDraft = { ...draftContent({ name: 'Would rollback' }), schemaVersion: 4, id: secondId, revision: draftRevision(1), createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z', metadata: {} };
    const conflicting = { ...existing, metadata: { description: 'Edited elsewhere' } };
    await expect(store.restoreMissingDrafts([absent, conflicting])).rejects.toMatchObject({ name: 'BackupConflictError' });
    expect(await rawValue(draftsDb, DRAFT_STORE_NAME, secondId)).toBeUndefined();
    expect(await repository.get(existing.id)).toEqual(existing);
    draftsDb.close(); playlistsDb.close();
  });
});
