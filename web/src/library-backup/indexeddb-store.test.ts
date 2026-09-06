import { IDBFactory, IDBObjectStore as FakeIDBObjectStore } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createSpatialPreset } from '../light-effects/preset-library.ts';
import { boardInstallationId } from '../installations/contracts.ts';
import { draftRevision, encodeStoredDraft, localDraftId } from '../drafts/codec.ts';
import { draftContent } from '../drafts/test-fixtures.ts';
import type { LocalClimbDraft } from '../drafts/types.ts';
import { encodeStoredPlaylist, playlistId, playlistRevision } from '../playlists/codec.ts';
import type { LocalPlaylist } from '../playlists/types.ts';
import { openDraftDatabase, DRAFT_STORE_NAME } from '../drafts/open-draft-database.ts';
import { openPlaylistDatabase, PLAYLIST_STORE_NAME } from '../playlists/open-playlist-database.ts';
import { BackupConflictError, LibraryBackupStorageError } from './types.ts';
import { IndexedDbLibraryBackupStore } from './indexeddb-store.ts';

function draftId(index: number) {
  return localDraftId(`00000000-0000-4000-8000-${(0x401 + index).toString(16).padStart(12, '0')}`);
}

function listId(index: number) {
  return playlistId(`00000000-0000-4000-8000-${(0x501 + index).toString(16).padStart(12, '0')}`);
}

function draft(index = 0, overrides: Partial<LocalClimbDraft> = {}): LocalClimbDraft {
  const timestamp = `2026-08-0${Math.min(index + 1, 9)}T00:00:00.000Z`;
  return {
    ...draftContent({ name: `Climb ${index}` }),
    schemaVersion: 4,
    id: draftId(index),
    revision: draftRevision(index + 1),
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: { grade: '6A', description: 'Preserve this metadata.' },
    effectGroups: index === 0
      ? [{ ...createSpatialPreset('bumblebee', 17), id: 'indexeddb-bee' as never }]
      : [],
    ...overrides,
  };
}

function playlist(index = 0, overrides: Partial<LocalPlaylist> = {}): LocalPlaylist {
  const timestamp = `2026-08-0${Math.min(index + 1, 9)}T00:00:00.000Z`;
  return {
    schemaVersion: 1,
    id: listId(index),
    revision: playlistRevision(index + 1),
    name: `List ${index}`,
    notes: 'Preserve this note.',
    entries: [{ kind: 'local', id: draftId(index) }],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

async function databases() {
  const factory = new IDBFactory();
  return {
    factory,
    drafts: await openDraftDatabase(factory),
    playlists: await openPlaylistDatabase(factory),
  };
}

function requestValue(request: IDBRequest<unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function rawValue(database: IDBDatabase, storeName: string, id: string): Promise<unknown> {
  return requestValue(database.transaction(storeName, 'readonly').objectStore(storeName).get(id));
}

function putRaw(database: IDBDatabase, storeName: string, value: unknown): Promise<void> {
  const transaction = database.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).put(value);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

function rawJson(value: unknown): string {
  return JSON.stringify(value);
}

function reverseKeys(value: unknown): unknown {
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(record).reverse());
}

function oldRawDraft(value: LocalClimbDraft, version: 1 | 2 | 3 | 4): Record<string, unknown> {
  const raw = structuredClone(encodeStoredDraft(value)) as unknown as Record<string, unknown>;
  raw.schemaVersion = version;
  if (version === 1) {
    delete raw.status;
    delete raw.trashedAt;
    delete raw.effectGroups;
  } else if (version === 2) {
    delete raw.status;
    delete raw.trashedAt;
  }
  return raw;
}

async function closeAll(value: Awaited<ReturnType<typeof databases>>) {
  value.drafts.close();
  value.playlists.close();
}

describe('IndexedDbLibraryBackupStore', () => {
  it('reads every raw row, including all historical schemas and Trash, without rewriting storage', async () => {
    const dbs = await databases();
    const trashed = draft(3, { status: 'finished', trashedAt: '2024-01-01T00:00:00.000Z' });
    const rawDraftRows = [
      oldRawDraft(draft(0), 1),
      oldRawDraft(draft(1), 2),
      oldRawDraft(draft(2, { status: 'finished', trashedAt: '2025-01-01T00:00:00.000Z', installationId: boardInstallationId('second-board') }), 3),
      oldRawDraft(trashed, 4),
    ];
    const rawList = encodeStoredPlaylist(playlist(0, {
      entries: [
        { kind: 'local', id: draftId(0) },
        { kind: 'provider', id: {
          provider: 'kilter' as never,
          sourceId: 'remote-1' as never,
          layoutRevision: 'kilter-fullride-7x10-v1' as never,
        } },
      ],
    }));
    for (const row of rawDraftRows) await putRaw(dbs.drafts, DRAFT_STORE_NAME, row);
    await putRaw(dbs.playlists, PLAYLIST_STORE_NAME, rawList);
    const beforeDrafts = await Promise.all(rawDraftRows.map((row) => rawValue(dbs.drafts, DRAFT_STORE_NAME, row.id as string)));
    const beforeList = await rawValue(dbs.playlists, PLAYLIST_STORE_NAME, rawList.id);
    const store = new IndexedDbLibraryBackupStore(dbs.drafts, dbs.playlists);

    const decodedDrafts = await store.readDrafts();
    const decodedPlaylists = await store.readPlaylists();
    expect(decodedDrafts).toHaveLength(4);
    expect(decodedDrafts.map(({ schemaVersion }) => schemaVersion)).toEqual([4, 4, 4, 4]);
    expect(decodedDrafts.find(({ id }) => id === trashed.id)).toMatchObject({ status: 'finished', trashedAt: trashed.trashedAt });
    expect(decodedDrafts.find(({ id }) => id === draftId(2))).toMatchObject({ installationId: 'second-board', status: 'finished' });
    expect(decodedPlaylists).toHaveLength(1);
    expect(decodedPlaylists[0]!.entries[1]).toMatchObject({ kind: 'provider', id: { provider: 'kilter' } });
    const afterDrafts = await Promise.all(rawDraftRows.map((row) => rawValue(dbs.drafts, DRAFT_STORE_NAME, row.id as string)));
    const afterList = await rawValue(dbs.playlists, PLAYLIST_STORE_NAME, rawList.id);
    expect(afterDrafts.map(rawJson)).toEqual(beforeDrafts.map(rawJson));
    expect(rawJson(afterList)).toBe(rawJson(beforeList));
    await closeAll(dbs);
  });

  it.each(['drafts', 'playlists'] as const)('commits absent %s exactly and skips an identical existing record', async (storeKind) => {
    const dbs = await databases();
    const store = new IndexedDbLibraryBackupStore(dbs.drafts, dbs.playlists);
    if (storeKind === 'drafts') {
      const existing = reverseKeys(encodeStoredDraft(draft(0)));
      await putRaw(dbs.drafts, DRAFT_STORE_NAME, existing);
      const before = rawJson(await rawValue(dbs.drafts, DRAFT_STORE_NAME, draftId(0)));
      const result = await store.restoreMissingDrafts([draft(0), draft(1)]);
      expect(result).toEqual({ added: 1, unchanged: 1 });
      expect(rawJson(await rawValue(dbs.drafts, DRAFT_STORE_NAME, draftId(0)))).toBe(before);
      expect(await rawValue(dbs.drafts, DRAFT_STORE_NAME, draftId(1))).toEqual(encodeStoredDraft(draft(1)));
    } else {
      const existing = reverseKeys(encodeStoredPlaylist(playlist(0)));
      await putRaw(dbs.playlists, PLAYLIST_STORE_NAME, existing);
      const before = rawJson(await rawValue(dbs.playlists, PLAYLIST_STORE_NAME, listId(0)));
      const result = await store.restoreMissingPlaylists([playlist(0), playlist(1)]);
      expect(result).toEqual({ added: 1, unchanged: 1 });
      expect(rawJson(await rawValue(dbs.playlists, PLAYLIST_STORE_NAME, listId(0)))).toBe(before);
      expect(await rawValue(dbs.playlists, PLAYLIST_STORE_NAME, listId(1))).toEqual(encodeStoredPlaylist(playlist(1)));
    }
    await closeAll(dbs);
  });

  it.each(['drafts', 'playlists'] as const)('rejects a differing ID and rolls back every queued add in %s', async (storeKind) => {
    const dbs = await databases();
    const store = new IndexedDbLibraryBackupStore(dbs.drafts, dbs.playlists);
    if (storeKind === 'drafts') {
      const existing = draft(0, { name: 'Current value' });
      const absent = draft(1, { name: 'Would roll back' });
      await putRaw(dbs.drafts, DRAFT_STORE_NAME, encodeStoredDraft(existing));
      await expect(store.restoreMissingDrafts([absent, { ...existing, name: 'Edited elsewhere' }])).rejects.toBeInstanceOf(BackupConflictError);
      expect(await rawValue(dbs.drafts, DRAFT_STORE_NAME, draftId(1))).toBeUndefined();
      expect(await rawValue(dbs.drafts, DRAFT_STORE_NAME, draftId(0))).toEqual(encodeStoredDraft(existing));
    } else {
      const existing = playlist(0, { name: 'Current value' });
      const absent = playlist(1, { name: 'Would roll back' });
      await putRaw(dbs.playlists, PLAYLIST_STORE_NAME, encodeStoredPlaylist(existing));
      await expect(store.restoreMissingPlaylists([absent, { ...existing, name: 'Edited elsewhere' }])).rejects.toBeInstanceOf(BackupConflictError);
      expect(await rawValue(dbs.playlists, PLAYLIST_STORE_NAME, listId(1))).toBeUndefined();
      expect(await rawValue(dbs.playlists, PLAYLIST_STORE_NAME, listId(0))).toEqual(encodeStoredPlaylist(existing));
    }
    await closeAll(dbs);
  });

  it.each(['drafts', 'playlists'] as const)('aborts after one queued add on a quota-style error in %s', async (storeKind) => {
    const dbs = await databases();
    const store = new IndexedDbLibraryBackupStore(dbs.drafts, dbs.playlists);
    const originalAdd = FakeIDBObjectStore.prototype.add;
    let calls = 0;
    Object.defineProperty(FakeIDBObjectStore.prototype, 'add', {
      configurable: true,
      value: function (value: unknown, key?: IDBValidKey) {
        calls += 1;
        if (calls === 2) throw new DOMException('Quota exceeded', 'QuotaExceededError');
        return key === undefined ? originalAdd.call(this, value) : originalAdd.call(this, value, key);
      },
    });
    try {
      if (storeKind === 'drafts') {
        await expect(store.restoreMissingDrafts([draft(0), draft(1)])).rejects.toMatchObject({ name: 'QuotaExceededError' });
        expect(await rawValue(dbs.drafts, DRAFT_STORE_NAME, draftId(0))).toBeUndefined();
        expect(await rawValue(dbs.drafts, DRAFT_STORE_NAME, draftId(1))).toBeUndefined();
      } else {
        await expect(store.restoreMissingPlaylists([playlist(0), playlist(1)])).rejects.toMatchObject({ name: 'QuotaExceededError' });
        expect(await rawValue(dbs.playlists, PLAYLIST_STORE_NAME, listId(0))).toBeUndefined();
        expect(await rawValue(dbs.playlists, PLAYLIST_STORE_NAME, listId(1))).toBeUndefined();
      }
    } finally {
      Object.defineProperty(FakeIDBObjectStore.prototype, 'add', { configurable: true, value: originalAdd });
      await closeAll(dbs);
    }
  });

  it('does not open a transaction for invalid later records and leaves both stores untouched', async () => {
    const dbs = await databases();
    const store = new IndexedDbLibraryBackupStore(dbs.drafts, dbs.playlists);
    const invalid = { ...draft(1), effectGroups: 'not an array' } as unknown as LocalClimbDraft;
    await expect(store.restoreMissingDrafts([draft(0), invalid])).rejects.toThrow();
    expect(await rawValue(dbs.drafts, DRAFT_STORE_NAME, draftId(0))).toBeUndefined();
    expect(await rawValue(dbs.drafts, DRAFT_STORE_NAME, draftId(1))).toBeUndefined();
    await expect(store.restoreMissingDrafts([draft(0), draft(0)])).rejects.toThrow(/Duplicate/);
    expect(await store.readDrafts()).toEqual([]);
    const invalidPlaylist = { ...playlist(1), entries: 'not an array' } as unknown as LocalPlaylist;
    await expect(store.restoreMissingPlaylists([playlist(0), invalidPlaylist])).rejects.toThrow();
    expect(await rawValue(dbs.playlists, PLAYLIST_STORE_NAME, listId(0))).toBeUndefined();
    expect(await rawValue(dbs.playlists, PLAYLIST_STORE_NAME, listId(1))).toBeUndefined();
    await closeAll(dbs);
  });

  it.each(['drafts', 'playlists'] as const)('rejects a corrupt raw %s read and performs no writes', async (storeKind) => {
    const dbs = await databases();
    const store = new IndexedDbLibraryBackupStore(dbs.drafts, dbs.playlists);
    if (storeKind === 'drafts') {
      const corrupt = { id: draftId(0), schemaVersion: 999, updatedOrder: ['2026-08-01T00:00:00.000Z', draftId(0)] };
      await putRaw(dbs.drafts, DRAFT_STORE_NAME, corrupt);
      const before = await rawValue(dbs.drafts, DRAFT_STORE_NAME, draftId(0));
      await expect(store.readDrafts()).rejects.toThrow(/Unsupported local draft schema version/);
      expect(rawJson(await rawValue(dbs.drafts, DRAFT_STORE_NAME, draftId(0)))).toBe(rawJson(before));
    } else {
      const corrupt = { id: listId(0), schemaVersion: 2, updatedOrder: ['2026-08-01T00:00:00.000Z', listId(0)] };
      await putRaw(dbs.playlists, PLAYLIST_STORE_NAME, corrupt);
      const before = await rawValue(dbs.playlists, PLAYLIST_STORE_NAME, listId(0));
      await expect(store.readPlaylists()).rejects.toThrow(/Unsupported local playlist schema version/);
      expect(rawJson(await rawValue(dbs.playlists, PLAYLIST_STORE_NAME, listId(0)))).toBe(rawJson(before));
    }
    await closeAll(dbs);
  });

  it('rechecks a second connection insert: identical values skip and edited values conflict', async () => {
    const dbs = await databases();
    const secondConnection = await openDraftDatabase(dbs.factory);
    const store = new IndexedDbLibraryBackupStore(dbs.drafts, dbs.playlists);
    const inserted = draft(0);
    await putRaw(secondConnection, DRAFT_STORE_NAME, encodeStoredDraft(inserted));
    await expect(store.restoreMissingDrafts([{ ...inserted, name: 'Different' }])).rejects.toBeInstanceOf(BackupConflictError);
    expect(await rawValue(dbs.drafts, DRAFT_STORE_NAME, draftId(0))).toEqual(encodeStoredDraft(inserted));
    secondConnection.close();

    const identicalConnection = await openDraftDatabase(dbs.factory);
    const next = draft(1);
    await putRaw(identicalConnection, DRAFT_STORE_NAME, encodeStoredDraft(next));
    await expect(store.restoreMissingDrafts([next])).resolves.toEqual({ added: 0, unchanged: 1 });
    expect(await rawValue(dbs.drafts, DRAFT_STORE_NAME, draftId(1))).toEqual(encodeStoredDraft(next));
    identicalConnection.close();
    await closeAll(dbs);
  });

  it('rechecks second connection playlist inserts: identical values skip and edited values conflict', async () => {
    const dbs = await databases();
    const secondConnection = await openPlaylistDatabase(dbs.factory);
    const store = new IndexedDbLibraryBackupStore(dbs.drafts, dbs.playlists);
    const inserted = playlist(0);
    await putRaw(secondConnection, PLAYLIST_STORE_NAME, encodeStoredPlaylist(inserted));
    await expect(store.restoreMissingPlaylists([{ ...inserted, name: 'Different' }])).rejects.toBeInstanceOf(BackupConflictError);
    expect(await rawValue(dbs.playlists, PLAYLIST_STORE_NAME, listId(0))).toEqual(encodeStoredPlaylist(inserted));
    secondConnection.close();

    const identicalConnection = await openPlaylistDatabase(dbs.factory);
    const next = playlist(1);
    await putRaw(identicalConnection, PLAYLIST_STORE_NAME, encodeStoredPlaylist(next));
    await expect(store.restoreMissingPlaylists([next])).resolves.toEqual({ added: 0, unchanged: 1 });
    expect(await rawValue(dbs.playlists, PLAYLIST_STORE_NAME, listId(1))).toEqual(encodeStoredPlaylist(next));
    identicalConnection.close();
    await closeAll(dbs);
  });

  it('reports closed databases honestly', async () => {
    const dbs = await databases();
    const store = new IndexedDbLibraryBackupStore(dbs.drafts, dbs.playlists);
    dbs.drafts.close();
    await expect(store.readDrafts()).rejects.toBeInstanceOf(LibraryBackupStorageError);
    await expect(store.restoreMissingDrafts([draft(0)])).rejects.toBeInstanceOf(LibraryBackupStorageError);
    dbs.playlists.close();
    await expect(store.readPlaylists()).rejects.toBeInstanceOf(LibraryBackupStorageError);
    await expect(store.restoreMissingPlaylists([playlist(0)])).rejects.toBeInstanceOf(LibraryBackupStorageError);
  });
});
