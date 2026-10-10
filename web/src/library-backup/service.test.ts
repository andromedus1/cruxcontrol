import { describe, expect, it, vi } from 'vitest';
import { createSpatialPreset } from '../light-effects/preset-library.ts';
import { draftRevision, localDraftId } from '../drafts/codec.ts';
import { draftContent } from '../drafts/test-fixtures.ts';
import type { LocalClimbDraft } from '../drafts/types.ts';
import { playlistId, playlistRevision } from '../playlists/codec.ts';
import type { LocalPlaylist } from '../playlists/types.ts';
import { decodeLibraryBackup, encodeLibraryBackup } from './codec.ts';
import { LibraryBackupService } from './service.ts';
import { BackupConflictError } from './types.ts';
import type { LibraryBackupStore, LibrarySnapshot, RestoreBatchResult } from './types.ts';

const climbId = localDraftId('00000000-0000-4000-8000-000000000301');
const playlistIdValue = playlistId('00000000-0000-4000-8000-000000000303');
const exportedAt = new Date('2026-09-05T00:00:00.000Z');

function climb(id = climbId, name = 'Service climb'): LocalClimbDraft {
  const bee = createSpatialPreset('bumblebee', 3);
  return {
    ...draftContent({ name }),
    schemaVersion: 4,
    id,
    revision: draftRevision(1),
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    metadata: {},
    effectGroups: [{ ...bee, id: 'service-bee' as never }],
  };
}

function playlist(): LocalPlaylist {
  return {
    schemaVersion: 1,
    id: playlistIdValue,
    revision: playlistRevision(1),
    name: 'Service list',
    notes: '',
    entries: [{ kind: 'local', id: climbId }],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

function backupFor(snapshot: LibrarySnapshot = { drafts: [climb()], playlists: [playlist()] }) {
  return decodeLibraryBackup(encodeLibraryBackup(snapshot, exportedAt));
}

function memoryStore(
  initial: LibrarySnapshot = { drafts: [], playlists: [] },
): LibraryBackupStore & { value: LibrarySnapshot } {
  const value: LibrarySnapshot = { drafts: [...initial.drafts], playlists: [...initial.playlists] };
  const restore = <T extends LocalClimbDraft | LocalPlaylist>(
    records: readonly T[],
    target: T[],
  ): RestoreBatchResult => {
    let added = 0;
    let unchanged = 0;
    for (const record of records) {
      if (target.some(({ id }) => id === record.id)) unchanged += 1;
      else {
        target.push(record);
        added += 1;
      }
    }
    return { added, unchanged };
  };
  return {
    get value() {
      return value;
    },
    readDrafts: vi.fn(async () => value.drafts),
    readPlaylists: vi.fn(async () => value.playlists),
    restoreMissingDrafts: vi.fn(async (records) =>
      restore(records, value.drafts as LocalClimbDraft[]),
    ),
    restoreMissingPlaylists: vi.fn(async (records) =>
      restore(records, value.playlists as LocalPlaylist[]),
    ),
  };
}

describe('LibraryBackupService', () => {
  it('uses one strong native snapshot for export and review without independent reads', async () => {
    const store = memoryStore();
    store.readSnapshot = vi.fn(async () => ({ drafts: [climb()], playlists: [playlist()] }));
    const service = new LibraryBackupService(store, () => exportedAt);
    expect(decodeLibraryBackup((await service.exportFile()).text).drafts).toEqual([climb()]);
    expect(store.readSnapshot).toHaveBeenCalledOnce();
    expect((await service.review(backupFor())).unchanged).toEqual({ climbs: 1, playlists: 1 });
    expect(store.readSnapshot).toHaveBeenCalledTimes(2);
    expect(store.readDrafts).not.toHaveBeenCalled();
    expect(store.readPlaylists).not.toHaveBeenCalled();
  });

  it('bounds export stability retries and reports a persistently changing library', async () => {
    const store = memoryStore();
    let sequence = 0;
    store.readDrafts = vi.fn(async () => {
      sequence += 1;
      return sequence % 2 === 0 ? [climb()] : [];
    });
    const service = new LibraryBackupService(store, () => exportedAt);
    await expect(service.exportFile()).rejects.toThrow(
      'Library changed while preparing the backup',
    );
    expect(store.readDrafts).toHaveBeenCalledTimes(4);
    expect(store.restoreMissingDrafts).not.toHaveBeenCalled();
  });

  it('retries one unstable export pair and emits the stable snapshot', async () => {
    const store = memoryStore();
    const stable = climb();
    let sequence = 0;
    store.readDrafts = vi.fn(async () => {
      sequence += 1;
      return sequence === 1 ? [] : [stable];
    });
    const service = new LibraryBackupService(store, () => exportedAt);
    const result = await service.exportFile();
    expect(result.filename).toBe('cruxcontrol-library-2026-09-05T00-00-00.000Z.json');
    expect(decodeLibraryBackup(result.text).drafts).toEqual([stable]);
    expect(store.readDrafts).toHaveBeenCalledTimes(4);
  });

  it('names exports at millisecond resolution and disambiguates same-clock deliveries', async () => {
    const service = new LibraryBackupService(memoryStore(), () => exportedAt);
    const first = await service.exportFile();
    const second = await service.exportFile();

    expect(first.filename).toBe('cruxcontrol-library-2026-09-05T00-00-00.000Z.json');
    expect(second.filename).toBe('cruxcontrol-library-2026-09-05T00-00-00.000Z-2.json');
    expect(second.filename).not.toBe(first.filename);
    expect(decodeLibraryBackup(first.text).exportedAt).toBe(exportedAt.toISOString());
    expect(decodeLibraryBackup(second.text).exportedAt).toBe(exportedAt.toISOString());
  });

  it('blocks a draft or playlist preflight conflict before either write boundary', async () => {
    for (const initial of [
      { drafts: [{ ...climb(), metadata: { grade: '6B' } }], playlists: [] },
      { drafts: [], playlists: [{ ...playlist(), notes: 'Edited locally' }] },
    ]) {
      const store = memoryStore(initial);
      const outcome = await new LibraryBackupService(store).restore(backupFor());
      expect(outcome.status).toBe('blocked');
      expect(store.restoreMissingDrafts).not.toHaveBeenCalled();
      expect(store.restoreMissingPlaylists).not.toHaveBeenCalled();
    }
  });

  it('prevents playlist writes when the draft transaction fails and reports no committed drafts', async () => {
    const store = memoryStore();
    store.restoreMissingDrafts = vi.fn().mockRejectedValue(new Error('draft quota'));
    const outcome = await new LibraryBackupService(store).restore(backupFor());
    expect(outcome).toMatchObject({
      status: 'failed',
      phase: 'drafts',
      drafts: null,
      error: new Error('draft quota'),
    });
    expect(store.restoreMissingPlaylists).not.toHaveBeenCalled();
    expect(store.value).toEqual({ drafts: [], playlists: [] });
  });

  it('reports committed drafts when the playlist stage fails, without rollback or inflated counts', async () => {
    const store = memoryStore();
    store.restoreMissingPlaylists = vi.fn().mockRejectedValue(new Error('playlist quota'));
    const outcome = await new LibraryBackupService(store).restore(backupFor());
    expect(outcome).toMatchObject({
      status: 'failed',
      phase: 'playlists',
      drafts: { added: 1, unchanged: 0 },
    });
    expect(store.value.drafts).toHaveLength(1);
    expect(store.value.playlists).toHaveLength(0);
    expect(store.restoreMissingDrafts).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: climbId })]),
    );
  });

  it('retries a partial import idempotently, retaining stable IDs and shared membership', async () => {
    const store = memoryStore();
    let playlistAttempt = 0;
    store.restoreMissingPlaylists = vi.fn(async (records) => {
      playlistAttempt += 1;
      if (playlistAttempt === 1) throw new Error('temporary playlist quota');
      for (const record of records) (store.value.playlists as LocalPlaylist[]).push(record);
      return { added: records.length, unchanged: 0 };
    });
    const service = new LibraryBackupService(store);
    const file = backupFor({ drafts: [climb()], playlists: [playlist()] });
    const first = await service.restore(file);
    expect(first).toMatchObject({ status: 'failed', phase: 'playlists', drafts: { added: 1 } });

    // The injected retry adapter now commits the same playlist once; the draft
    // is still present under the original ID and is passed through preflight.
    const second = await service.restore(file);
    expect(second).toMatchObject({
      status: 'complete',
      drafts: { added: 0, unchanged: 1 },
      playlists: { added: 1, unchanged: 0 },
    });
    expect(store.value.drafts.map(({ id }) => id)).toEqual([climbId]);
    expect(store.value.playlists).toHaveLength(1);
    expect(store.restoreMissingDrafts).toHaveBeenCalledTimes(2);
  });

  it('makes a full retry a no-op with exact unchanged counts and no duplicate IDs', async () => {
    const store = memoryStore();
    const service = new LibraryBackupService(store);
    const file = backupFor();
    await expect(service.restore(file)).resolves.toMatchObject({
      status: 'complete',
      drafts: { added: 1, unchanged: 0 },
      playlists: { added: 1, unchanged: 0 },
    });
    await expect(service.restore(file)).resolves.toMatchObject({
      status: 'complete',
      drafts: { added: 0, unchanged: 1 },
      playlists: { added: 0, unchanged: 1 },
    });
    expect(store.value.drafts.map(({ id }) => id)).toEqual([climbId]);
    expect(store.value.playlists.map(({ id }) => id)).toEqual([playlistIdValue]);
  });

  it('blocks a retry after someone edits a previously recovered record', async () => {
    const store = memoryStore();
    const service = new LibraryBackupService(store);
    const file = backupFor();
    await expect(service.restore(file)).resolves.toMatchObject({ status: 'complete' });
    (store.value.drafts as LocalClimbDraft[])[0] = {
      ...store.value.drafts[0]!,
      metadata: { description: 'Edited after recovery' },
    };
    const retry = await service.restore(file);
    expect(retry.status).toBe('blocked');
    expect(store.restoreMissingDrafts).toHaveBeenCalledTimes(1);
    expect(store.restoreMissingPlaylists).toHaveBeenCalledTimes(1);
  });

  it('reports the draft commit when a late playlist conflict occurs and never rolls it back', async () => {
    const store = memoryStore();
    store.restoreMissingPlaylists = vi
      .fn()
      .mockRejectedValue(
        new BackupConflictError([
          { kind: 'playlist', id: playlistIdValue, name: 'Changed between stages' },
        ]),
      );
    const outcome = await new LibraryBackupService(store).restore(backupFor());
    expect(outcome).toMatchObject({
      status: 'failed',
      phase: 'playlists',
      drafts: { added: 1, unchanged: 0 },
    });
    expect(store.value.drafts).toHaveLength(1);
    expect(store.value.playlists).toHaveLength(0);
  });

  it('converts non-Error failures to an honest failed outcome', async () => {
    const store = memoryStore();
    store.restoreMissingDrafts = vi.fn().mockRejectedValue('unavailable');
    const outcome = await new LibraryBackupService(store).restore(backupFor());
    expect(outcome).toMatchObject({
      status: 'failed',
      phase: 'drafts',
      drafts: null,
      error: new Error('unavailable'),
    });
  });
});
