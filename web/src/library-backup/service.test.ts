import { describe, expect, it, vi } from 'vitest';
import { createSpatialPreset } from '../light-effects/preset-library.ts';
import { draftRevision, localDraftId } from '../drafts/codec.ts';
import { draftContent } from '../drafts/test-fixtures.ts';
import type { LocalClimbDraft } from '../drafts/types.ts';
import { playlistId, playlistRevision } from '../playlists/codec.ts';
import type { LocalPlaylist } from '../playlists/types.ts';
import { encodeLibraryBackup, decodeLibraryBackup } from './codec.ts';
import { LibraryBackupService } from './service.ts';
import type { LibraryBackupStore, LibrarySnapshot } from './types.ts';

const climbId = localDraftId('00000000-0000-4000-8000-000000000301');
const playlistIdValue = playlistId('00000000-0000-4000-8000-000000000302');
function climb(): LocalClimbDraft {
  return { ...draftContent({ name: 'Service climb' }), schemaVersion: 4, id: climbId, revision: draftRevision(1), createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', metadata: {}, effectGroups: [createSpatialPreset('bumblebee', 3)] };
}
function playlist(): LocalPlaylist {
  return { schemaVersion: 1, id: playlistIdValue, revision: playlistRevision(1), name: 'Service list', notes: '', entries: [{ kind: 'local', id: climbId }], createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' };
}
function memoryStore(initial: LibrarySnapshot = { drafts: [], playlists: [] }): LibraryBackupStore & { value: LibrarySnapshot } {
  const value = { drafts: [...initial.drafts], playlists: [...initial.playlists] };
  return {
    get value() { return value; },
    readDrafts: vi.fn(async () => value.drafts),
    readPlaylists: vi.fn(async () => value.playlists),
    restoreMissingDrafts: vi.fn(async (records) => {
      let added = 0; let unchanged = 0;
      for (const record of records) {
        const existing = value.drafts.find(({ id }) => id === record.id);
        if (existing) unchanged += 1; else { value.drafts.push(record); added += 1; }
      }
      return { added, unchanged };
    }),
    restoreMissingPlaylists: vi.fn(async (records) => {
      let added = 0; let unchanged = 0;
      for (const record of records) {
        const existing = value.playlists.find(({ id }) => id === record.id);
        if (existing) unchanged += 1; else { value.playlists.push(record); added += 1; }
      }
      return { added, unchanged };
    }),
  };
}

function backup(): ReturnType<typeof decodeLibraryBackup> {
  return decodeLibraryBackup(encodeLibraryBackup({ drafts: [climb()], playlists: [playlist()] }, new Date('2026-09-05T00:00:00.000Z')));
}

describe('LibraryBackupService', () => {
  it('bounds export stability retries and reports changed libraries', async () => {
    const store = memoryStore();
    let sequence = 0;
    store.readDrafts = vi.fn(async () => {
      sequence += 1;
      return sequence % 2 === 0 ? [climb()] : [];
    });
    const service = new LibraryBackupService(store, () => new Date('2026-09-05T00:00:00.000Z'));
    await expect(service.exportFile()).rejects.toThrow('Library changed while preparing the backup');
    expect(store.readDrafts).toHaveBeenCalledTimes(4);
  });

  it('commits drafts before playlists and reports a playlist failure without rollback', async () => {
    const store = memoryStore();
    store.restoreMissingPlaylists = vi.fn().mockRejectedValue(new Error('quota'));
    const outcome = await new LibraryBackupService(store).restore(backup());
    expect(outcome).toMatchObject({ status: 'failed', phase: 'playlists', drafts: { added: 1 } });
    expect(store.restoreMissingDrafts).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: climbId })]));
  });

  it('blocks preflight conflicts without opening either write boundary', async () => {
    const store = memoryStore({ drafts: [{ ...climb(), metadata: { grade: '6B' } }], playlists: [] });
    const outcome = await new LibraryBackupService(store).restore(backup());
    expect(outcome.status).toBe('blocked');
    expect(store.restoreMissingDrafts).not.toHaveBeenCalled();
    expect(store.restoreMissingPlaylists).not.toHaveBeenCalled();
  });
});
