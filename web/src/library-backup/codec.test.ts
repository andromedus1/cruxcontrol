import { describe, expect, it } from 'vitest';
import { createSpatialPreset } from '../light-effects/preset-library.ts';
import { draftRevision, localDraftId } from '../drafts/codec.ts';
import { draftContent } from '../drafts/test-fixtures.ts';
import type { LocalClimbDraft } from '../drafts/types.ts';
import { playlistId, playlistRevision } from '../playlists/codec.ts';
import type { LocalPlaylist } from '../playlists/types.ts';
import {
  decodeLibraryBackup,
  encodeLibraryBackup,
  reviewLibraryBackup,
} from './codec.ts';

const firstId = localDraftId('00000000-0000-4000-8000-000000000101');
const secondId = localDraftId('00000000-0000-4000-8000-000000000102');
const listId = playlistId('00000000-0000-4000-8000-000000000201');

function climb(id = firstId, name = 'Orphan') : LocalClimbDraft {
  return {
    ...draftContent({ name }),
    schemaVersion: 4,
    id,
    revision: draftRevision(3),
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    trashedAt: '2026-08-03T00:00:00.000Z',
    metadata: { grade: '6A', description: 'Keep this detail.' },
    effectGroups: [createSpatialPreset('bumblebee', 7)],
  };
}

function playlist(): LocalPlaylist {
  return {
    schemaVersion: 1,
    id: listId,
    revision: playlistRevision(2),
    name: 'Shared projects',
    notes: 'Ordered notes',
    entries: [
      { kind: 'local', id: firstId },
      { kind: 'local', id: secondId },
      { kind: 'provider', id: { provider: 'kilter' as never, sourceId: 'remote-1' as never, layoutRevision: 'kilter-fullride-7x10-v1' as never } },
    ],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
  };
}

describe('library backup codec', () => {
  it('round-trips Trash, recipes, shared and dangling references', () => {
    const source = { drafts: [climb(), climb(secondId, 'Shared')], playlists: [playlist()] };
    const decoded = decodeLibraryBackup(encodeLibraryBackup(source, new Date('2026-09-05T00:00:00.000Z')));
    expect(decoded.drafts).toEqual(source.drafts);
    expect(decoded.playlists).toEqual(source.playlists);
    expect(decoded.drafts[0]!.trashedAt).toBe('2026-08-03T00:00:00.000Z');
  });

  it('rejects duplicate identities, future versions, and malformed nested rows before review', () => {
    const text = encodeLibraryBackup({ drafts: [climb()], playlists: [] }, new Date('2026-09-05T00:00:00.000Z'));
    const value = JSON.parse(text) as Record<string, unknown>;
    value.drafts = [value.drafts, value.drafts].flat();
    expect(() => decodeLibraryBackup(JSON.stringify(value))).toThrow(/duplicate ID/);
    expect(() => decodeLibraryBackup(JSON.stringify({ ...value, version: 2 }))).toThrow(/unsupported backup version/);
    expect(() => decodeLibraryBackup(JSON.stringify({ ...value, drafts: [{ ...(value.drafts as unknown[])[0] as object, effectGroups: 'bad' }] }))).toThrow(/drafts\[0\]/);
  });

  it('counts equal records as unchanged and changed records as conflicts', () => {
    const backup = decodeLibraryBackup(encodeLibraryBackup({ drafts: [climb()], playlists: [playlist()] }, new Date('2026-09-05T00:00:00.000Z')));
    const changed = { ...climb(), metadata: { grade: '6B' } };
    const current = { drafts: [changed], playlists: [] };
    const result = reviewLibraryBackup(backup, current);
    expect(result.add).toEqual({ climbs: 0, playlists: 1 });
    expect(result.unchanged.climbs).toBe(0);
    expect(result.conflicts).toEqual([{ kind: 'climb', id: firstId, name: 'Orphan' }]);
    expect(result.unavailableLocalReferences).toBe(1);
  });

  it('allows empty backups and identifies dangling local references', () => {
    const empty = decodeLibraryBackup(encodeLibraryBackup({ drafts: [], playlists: [] }, new Date('2026-09-05T00:00:00.000Z')));
    expect(reviewLibraryBackup(empty, empty).add).toEqual({ climbs: 0, playlists: 0 });
    const dangling = { ...playlist(), entries: [{ kind: 'local' as const, id: localDraftId('00000000-0000-4000-8000-000000000999') }] };
    const backup = decodeLibraryBackup(encodeLibraryBackup({ drafts: [], playlists: [dangling] }, new Date('2026-09-05T00:00:00.000Z')));
    expect(reviewLibraryBackup(backup, empty).unavailableLocalReferences).toBe(1);
  });
});
