import { describe, expect, it } from 'vitest';
import { apiLevel3Color } from '../domain/boards/colors.ts';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10.ts';
import { lightEffectGroupId } from '../board-renderer/types.ts';
import { createSpatialPreset } from '../light-effects/preset-library.ts';
import { decodeStoredDraft, draftRevision, encodeStoredDraft, localDraftId } from '../drafts/codec.ts';
import { draftContent } from '../drafts/test-fixtures.ts';
import type { LocalClimbDraft } from '../drafts/types.ts';
import { decodeStoredPlaylist, encodeStoredPlaylist, playlistId, playlistRevision } from '../playlists/codec.ts';
import type { LocalPlaylist } from '../playlists/types.ts';
import {
  decodeLibraryBackup,
  encodeLibraryBackup,
  LIBRARY_BACKUP_LIMITS,
  LibraryBackupValidationError,
  reviewLibraryBackup,
} from './codec.ts';

const firstId = localDraftId('00000000-0000-4000-8000-000000000101');
const secondId = localDraftId('00000000-0000-4000-8000-000000000102');
const orphanId = localDraftId('00000000-0000-4000-8000-000000000103');
const danglingId = localDraftId('00000000-0000-4000-8000-000000000199');
const firstListId = playlistId('00000000-0000-4000-8000-000000000201');
const secondListId = playlistId('00000000-0000-4000-8000-000000000202');
const exportedAt = new Date('2026-09-05T00:00:00.000Z');
const firstPlacement = kilterFullride7x10Definition.placements[0]!.id;

function climb(
  id = firstId,
  name = 'Orphan',
  overrides: Partial<LocalClimbDraft> = {},
): LocalClimbDraft {
  const bee = createSpatialPreset('bumblebee', 17);
  return {
    ...draftContent({ name }),
    schemaVersion: 4,
    id,
    revision: draftRevision(3),
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    trashedAt: '2026-08-03T00:00:00.000Z',
    metadata: { grade: '6A', description: 'Keep this detail.', setterNotes: 'Use the edge.' },
    assignments: [{ placementId: firstPlacement, appearance: { kind: 'role', role: 'start' } }],
    effectGroups: [
      {
        model: 'spatial',
        id: lightEffectGroupId('legacy-snake'),
        recipeVersion: 1,
        recipe: { kind: 'snake', direction: 'forward', bodyLength: 7 },
        seed: 11,
        palette: [apiLevel3Color(28), apiLevel3Color(24)],
        periodMs: 120_000,
        intensity: 0.7,
        footprint: 7,
        target: { scope: 'selected', include: [firstPlacement], exclude: [] },
      },
      { ...bee, id: lightEffectGroupId('curious-bee') },
    ],
    ...overrides,
  };
}

function playlist(id = firstListId, name = 'Shared projects'): LocalPlaylist {
  return {
    schemaVersion: 1,
    id,
    revision: playlistRevision(2),
    name,
    notes: 'Ordered notes',
    entries: [
      { kind: 'local', id: firstId },
      { kind: 'local', id: secondId },
      {
        kind: 'provider',
        id: {
          provider: 'kilter' as never,
          sourceId: 'remote-1' as never,
          layoutRevision: 'kilter-fullride-7x10-v1' as never,
        },
      },
    ],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
  };
}

function sourceSnapshot(): { drafts: LocalClimbDraft[]; playlists: LocalPlaylist[] } {
  const shared = climb(secondId, 'Shared', { trashedAt: undefined, revision: draftRevision(4) });
  const orphan = climb(orphanId, 'Unlisted orphan', { trashedAt: undefined, revision: draftRevision(8) });
  const trash = climb(firstId, 'Old Trash');
  return {
    drafts: [trash, shared, orphan],
    playlists: [
      playlist(),
      {
        ...playlist(secondListId, 'Training list'),
        entries: [
          { kind: 'local', id: secondId },
          { kind: 'local', id: danglingId },
        ],
      },
    ],
  };
}

function rawBackup(snapshot = sourceSnapshot()): Record<string, unknown> {
  return JSON.parse(encodeLibraryBackup(snapshot, exportedAt)) as Record<string, unknown>;
}

function rawDrafts(value: Record<string, unknown>): Record<string, unknown>[] {
  return value.drafts as Record<string, unknown>[];
}

function oldRawDraft(draftValue: LocalClimbDraft, version: 1 | 2 | 3 | 4): Record<string, unknown> {
  const value = structuredClone(encodeStoredDraft(draftValue)) as unknown as Record<string, unknown>;
  value.schemaVersion = version;
  if (version === 1) {
    delete value.status;
    delete value.trashedAt;
    delete value.effectGroups;
    for (const assignment of value.assignments as Record<string, unknown>[]) delete assignment.effectGroupId;
  } else if (version === 2) {
    delete value.status;
    delete value.trashedAt;
  }
  return value;
}

describe('library backup codec', () => {
  it('round-trips orphan, shared, old Trash, metadata, recipes, provider and dangling references', () => {
    const source = sourceSnapshot();
    const decoded = decodeLibraryBackup(encodeLibraryBackup(source, exportedAt));

    expect(decoded.drafts).toEqual(source.drafts);
    expect(decoded.playlists).toEqual(source.playlists);
    expect(decoded.drafts.map(({ id }) => id)).toEqual([firstId, secondId, orphanId]);
    expect(decoded.drafts[0]!.trashedAt).toBe('2026-08-03T00:00:00.000Z');
    expect(decoded.drafts[0]!.metadata).toEqual({
      grade: '6A', description: 'Keep this detail.', setterNotes: 'Use the edge.',
    });
    expect(decoded.drafts[0]!.effectGroups.map((group) => group.model === 'spatial' ? group.recipeVersion : undefined)).toEqual([1, 2]);
    expect(decoded.playlists[0]!.entries[2]).toMatchObject({ kind: 'provider', id: { provider: 'kilter' } });
    expect(decoded.playlists[1]!.entries[1]).toEqual({ kind: 'local', id: danglingId });
    const review = reviewLibraryBackup(decoded, { drafts: [], playlists: [] });
    expect(review.trashClimbs).toBe(1);
    expect(review.unavailableLocalReferences).toBe(1);
  });

  it('accepts stored draft schema versions 1 through 4 without mutating old values', () => {
    const current = climb(firstId, 'Historical', { status: 'finished' });
    const value = rawBackup({ drafts: [current], playlists: [] });
    const fourthId = localDraftId('00000000-0000-4000-8000-000000000104');
    value.drafts = [
      oldRawDraft(current, 1),
      oldRawDraft({ ...current, id: secondId }, 2),
      oldRawDraft({ ...current, id: orphanId }, 3),
      oldRawDraft({ ...current, id: fourthId }, 4),
    ];
    const before = structuredClone(value.drafts);
    const decoded = decodeLibraryBackup(JSON.stringify(value));

    expect(decoded.drafts).toHaveLength(4);
    expect(decoded.drafts.map(({ id }) => id)).toEqual([firstId, secondId, orphanId, fourthId]);
    expect(decoded.drafts[0]!.status).toBe('draft');
    expect(decoded.drafts[1]!.status).toBe('draft');
    expect(decoded.drafts[2]!.status).toBe('finished');
    expect(decoded.drafts[2]!.trashedAt).toBe(current.trashedAt);
    expect(decoded.drafts[3]!.effectGroups).toHaveLength(2);
    expect(value.drafts).toEqual(before);
  });

  it('rejects unknown backup, record and recipe versions, including records without updatedOrder', () => {
    const value = rawBackup({ drafts: [climb()], playlists: [] });
    expect(() => decodeLibraryBackup(JSON.stringify({ ...value, version: 2 }))).toThrow(/unsupported backup version/);

    const futureRecord = structuredClone(rawDrafts(value)[0]!);
    futureRecord.schemaVersion = 99;
    expect(() => decodeLibraryBackup(JSON.stringify({ ...value, drafts: [futureRecord] }))).toThrow(/Unsupported local draft schema version/);

    const valueWithPlaylist = rawBackup();
    const futurePlaylist = structuredClone((valueWithPlaylist.playlists as Record<string, unknown>[])[0]!);
    futurePlaylist.schemaVersion = 2;
    expect(() => decodeLibraryBackup(JSON.stringify({ ...valueWithPlaylist, playlists: [futurePlaylist] }))).toThrow(/Unsupported local playlist schema version/);

    const futurePlaylistWithoutIndex = structuredClone((valueWithPlaylist.playlists as Record<string, unknown>[])[0]!);
    futurePlaylistWithoutIndex.schemaVersion = 999;
    delete futurePlaylistWithoutIndex.updatedOrder;
    expect(() => decodeLibraryBackup(JSON.stringify({ ...valueWithPlaylist, playlists: [futurePlaylistWithoutIndex] }))).toThrow(/Unsupported local playlist schema version/);

    const futureWithoutIndex = structuredClone(rawDrafts(value)[0]!);
    futureWithoutIndex.schemaVersion = 999;
    delete futureWithoutIndex.updatedOrder;
    expect(() => decodeLibraryBackup(JSON.stringify({ ...value, drafts: [futureWithoutIndex] }))).toThrow(/Unsupported local draft schema version/);

    const futureRecipe = structuredClone(rawDrafts(value)[0]!);
    const groups = futureRecipe.effectGroups as Record<string, unknown>[];
    groups[0]!.recipeVersion = 3;
    expect(() => decodeLibraryBackup(JSON.stringify({ ...value, drafts: [futureRecipe] }))).toThrow(/recipeVersion/);

    const laterInvalid = structuredClone(rawDrafts(value)[0]!);
    const laterValid = structuredClone(rawDrafts(value)[0]!);
    laterValid.id = secondId;
    laterInvalid.effectGroups = 'corrupt';
    expect(() => decodeLibraryBackup(JSON.stringify({ ...value, drafts: [laterValid, laterInvalid] }))).toThrow(/drafts\[1\]/);
  });

  it('treats canonical key order as equal while detecting semantic changes', () => {
    const backup = decodeLibraryBackup(encodeLibraryBackup({ drafts: [climb()], playlists: [playlist()] }, exportedAt));
    const currentDraft = JSON.parse(JSON.stringify(encodeStoredDraft(climb()))) as Record<string, unknown>;
    const reversedDraft = Object.fromEntries(Object.entries(currentDraft).reverse());
    const currentPlaylist = JSON.parse(JSON.stringify(encodeStoredPlaylist(playlist()))) as Record<string, unknown>;
    const reversedPlaylist = Object.fromEntries(Object.entries(currentPlaylist).reverse());
    expect(reviewLibraryBackup(backup, {
      drafts: [decodeStoredDraft(reversedDraft)],
      playlists: [decodeStoredPlaylist(reversedPlaylist)],
    })).toMatchObject({ add: { climbs: 0, playlists: 0 }, unchanged: { climbs: 1, playlists: 1 }, conflicts: [] });

    const changedNotes = { ...playlist(), notes: 'Changed note' };
    const changedOrder = { ...playlist(), entries: [...playlist().entries].reverse() };
    const changedRecipe = { ...climb(), effectGroups: [createSpatialPreset('bumblebee', 999)] };
    const changedRevision = { ...climb(), revision: draftRevision(4) };
    const changedTimestamp = { ...climb(), updatedAt: '2026-08-04T00:00:00.000Z' };
    for (const current of [
      { drafts: [changedRecipe], playlists: [] },
      { drafts: [changedRevision], playlists: [] },
      { drafts: [changedTimestamp], playlists: [] },
      { drafts: [], playlists: [changedNotes] },
      { drafts: [], playlists: [changedOrder] },
    ]) {
      expect(reviewLibraryBackup(backup, current).conflicts).toHaveLength(1);
    }
  });

  it('counts equal names with distinct IDs as additions and resolves dangling IDs from either snapshot', () => {
    const incoming = decodeLibraryBackup(encodeLibraryBackup({
      drafts: [climb(firstId, 'Same name')],
      playlists: [{ ...playlist(), entries: [{ kind: 'local', id: firstId }, { kind: 'local', id: danglingId }] }],
    }, exportedAt));
    const current = { drafts: [climb(secondId, 'Same name')], playlists: [] };
    expect(reviewLibraryBackup(incoming, current)).toMatchObject({
      add: { climbs: 1, playlists: 1 },
      unchanged: { climbs: 0, playlists: 0 },
      conflicts: [],
      unavailableLocalReferences: 1,
    });
  });

  it('allows an empty backup and empty export', () => {
    const text = encodeLibraryBackup({ drafts: [], playlists: [] }, exportedAt);
    const empty = decodeLibraryBackup(text);
    expect(JSON.parse(text)).toMatchObject({ drafts: [], playlists: [] });
    expect(reviewLibraryBackup(empty, empty)).toMatchObject({
      add: { climbs: 0, playlists: 0 }, unchanged: { climbs: 0, playlists: 0 }, conflicts: [],
    });
  });

  it('accepts supported count limits and rejects oversized arrays before walking malformed rows', () => {
    const countDrafts = Array.from({ length: LIBRARY_BACKUP_LIMITS.climbs }, (_, index) => climb(
      localDraftId(`00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`), `Climb ${index}`,
      { effectGroups: [], assignments: [], trashedAt: undefined },
    ));
    const countPlaylists = Array.from({ length: LIBRARY_BACKUP_LIMITS.playlists }, (_, index) => ({
      ...playlist(playlistId(`00000000-0000-4000-8000-${(0x20000 + index).toString(16).padStart(12, '0')}`), `List ${index}`),
      entries: Array.from({ length: 100 }, (_, entryIndex) => ({ kind: 'local' as const, id: countDrafts[entryIndex]!.id })),
    }));
    const text = encodeLibraryBackup({ drafts: countDrafts, playlists: countPlaylists }, exportedAt);
    const decoded = decodeLibraryBackup(text);
    expect(decoded.drafts).toHaveLength(LIBRARY_BACKUP_LIMITS.climbs);
    expect(decoded.playlists).toHaveLength(LIBRARY_BACKUP_LIMITS.playlists);

    const tooManyDrafts = { ...rawBackup({ drafts: [], playlists: [] }), drafts: new Array(LIBRARY_BACKUP_LIMITS.climbs + 1).fill(null) };
    expect(() => decodeLibraryBackup(JSON.stringify(tooManyDrafts))).toThrowError(expect.objectContaining<Partial<LibraryBackupValidationError>>({ code: 'oversized-payload' }));
    const tooManyPlaylists = { ...rawBackup({ drafts: [], playlists: [] }), playlists: new Array(LIBRARY_BACKUP_LIMITS.playlists + 1).fill(null) };
    expect(() => decodeLibraryBackup(JSON.stringify(tooManyPlaylists))).toThrowError(expect.objectContaining<Partial<LibraryBackupValidationError>>({ code: 'oversized-payload' }));
    const tooManyReferences = { ...rawBackup({ drafts: [], playlists: [] }), playlists: [{ entries: new Array(LIBRARY_BACKUP_LIMITS.references + 1).fill(null) }] };
    expect(() => decodeLibraryBackup(JSON.stringify(tooManyReferences))).toThrowError(expect.objectContaining<Partial<LibraryBackupValidationError>>({ code: 'oversized-payload' }));
    const malformedOversizedExport = { drafts: new Array(LIBRARY_BACKUP_LIMITS.climbs + 1).fill({}), playlists: [] } as unknown as { drafts: LocalClimbDraft[]; playlists: LocalPlaylist[] };
    expect(() => encodeLibraryBackup(malformedOversizedExport, exportedAt)).toThrowError(expect.objectContaining<Partial<LibraryBackupValidationError>>({ code: 'oversized-payload' }));
  });

  it('enforces the UTF-8 byte limit at the text boundary', () => {
    const underLimit = climb(firstId, 'UTF-8', { effectGroups: [], assignments: [], trashedAt: undefined, metadata: { description: 'é'.repeat(12_000_000) } });
    const text = encodeLibraryBackup({ drafts: [underLimit], playlists: [] }, exportedAt);
    expect(new TextEncoder().encode(text).byteLength).toBeLessThan(LIBRARY_BACKUP_LIMITS.bytes);
    expect(decodeLibraryBackup(text).drafts[0]!.metadata.description).toHaveLength(12_000_000);

    const overLimit = climb(firstId, 'UTF-8', { effectGroups: [], assignments: [], trashedAt: undefined, metadata: { description: 'é'.repeat(13_200_000) } });
    expect(() => encodeLibraryBackup({ drafts: [overLimit], playlists: [] }, exportedAt)).toThrowError(expect.objectContaining<Partial<LibraryBackupValidationError>>({ code: 'oversized-payload' }));
  });
});
