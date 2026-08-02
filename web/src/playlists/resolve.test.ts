import {
  climbViewKey,
  providerClimbViewKey,
  type ClimbViewRecord,
} from '../climb-browser/types.ts';
import { draftRevision, localDraftId } from '../drafts/codec.ts';
import { draftContent } from '../drafts/test-fixtures.ts';
import type { LocalClimbDraft } from '../drafts/types.ts';
import { playlistId, playlistRevision } from './codec.ts';
import { resolvePlaylistEntries } from './resolve.ts';
import { providerReference } from './test-fixtures.ts';
import type { LocalPlaylist } from './types.ts';

function local(id: string, name: string, trashed = false): LocalClimbDraft {
  return {
    ...draftContent({ name }),
    schemaVersion: 3,
    id: localDraftId(id),
    revision: draftRevision(1),
    ...(trashed ? { trashedAt: '2026-08-02T12:00:00.000Z' } : {}),
    createdAt: '2026-08-02T12:00:00.000Z',
    updatedAt: '2026-08-02T12:00:00.000Z',
    metadata: {},
  };
}

describe('resolvePlaylistEntries', () => {
  it('resolves active, trashed, missing local, and provider entries without changing order', () => {
    const active = local('00000000-0000-4000-8000-000000000031', 'Active');
    const trashed = local('00000000-0000-4000-8000-000000000032', 'Trashed', true);
    const missingId = localDraftId('00000000-0000-4000-8000-000000000033');
    const provider: ClimbViewRecord = {
      key: providerClimbViewKey(providerReference.id),
      name: 'Provider climb',
      angle: 40,
      assignments: [],
      origin: 'provider',
    };
    const playlist: LocalPlaylist = {
      schemaVersion: 1,
      id: playlistId('00000000-0000-4000-8000-000000000041'),
      revision: playlistRevision(1),
      name: 'Mixed',
      notes: '',
      entries: [
        { kind: 'local', id: trashed.id },
        providerReference,
        { kind: 'local', id: missingId },
        { kind: 'local', id: active.id },
      ],
      createdAt: '2026-08-02T12:00:00.000Z',
      updatedAt: '2026-08-02T12:00:00.000Z',
    };

    const resolved = resolvePlaylistEntries(playlist, [active, trashed], [provider]);
    expect(resolved.map(({ availability }) => availability)).toEqual([
      'trashed',
      'available',
      'missing',
      'available',
    ]);
    expect(resolved.map(({ climb }) => climb?.name ?? null)).toEqual([
      'Trashed',
      'Provider climb',
      null,
      'Active',
    ]);
    expect(resolved.map(({ reference }) => reference)).toEqual(playlist.entries);
    expect(Object.isFrozen(resolved)).toBe(true);
  });

  it('does not resolve a provider record with a different key', () => {
    const provider: ClimbViewRecord = {
      key: climbViewKey('provider:someone-else'),
      name: 'Wrong provider climb',
      angle: 40,
      assignments: [],
      origin: 'provider',
    };
    const playlist: LocalPlaylist = {
      schemaVersion: 1,
      id: playlistId('00000000-0000-4000-8000-000000000042'),
      revision: playlistRevision(1),
      name: 'Provider only',
      notes: '',
      entries: [providerReference],
      createdAt: '2026-08-02T12:00:00.000Z',
      updatedAt: '2026-08-02T12:00:00.000Z',
    };
    expect(resolvePlaylistEntries(playlist, [], [provider])[0]).toMatchObject({
      availability: 'missing',
      climb: null,
    });
  });
});
