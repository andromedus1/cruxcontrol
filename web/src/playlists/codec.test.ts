import {
  decodeStoredPlaylist,
  encodeStoredPlaylist,
  playlistId,
  playlistRevision,
} from './codec.ts';
import { PlaylistCorruptRecordError, PlaylistSchemaError } from './errors.ts';
import { FIRST_PLAYLIST_ID, LOCAL_CLIMB_ID, providerReference } from './test-fixtures.ts';
import { LOCAL_PLAYLIST_SCHEMA_VERSION, type LocalPlaylist } from './types.ts';

const stored = {
  schemaVersion: LOCAL_PLAYLIST_SCHEMA_VERSION,
  id: FIRST_PLAYLIST_ID,
  revision: 1,
  name: 'Projects',
  notes: 'Try these next.',
  entries: [{ kind: 'local' as const, id: LOCAL_CLIMB_ID }, providerReference],
  createdAt: '2026-08-02T12:00:00.000Z',
  updatedAt: '2026-08-02T12:01:00.000Z',
  updatedOrder: ['2026-08-02T12:01:00.000Z', FIRST_PLAYLIST_ID],
};

describe('playlist codec', () => {
  it('round-trips local and provider references in exact manual order', () => {
    const decoded = decodeStoredPlaylist(stored);
    expect(decoded.entries).toEqual(stored.entries);
    expect(encodeStoredPlaylist(decoded)).toEqual(stored);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded.entries)).toBe(true);
  });

  it('validates domain-created playlists through the same strict boundary', () => {
    const playlist: LocalPlaylist = {
      schemaVersion: LOCAL_PLAYLIST_SCHEMA_VERSION,
      id: playlistId(FIRST_PLAYLIST_ID),
      revision: playlistRevision(1),
      name: 'Projects',
      notes: '',
      entries: [],
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
    };
    expect(decodeStoredPlaylist(encodeStoredPlaylist(playlist))).toEqual(playlist);
  });

  it.each([
    ['name', { ...stored, name: '  ' }],
    ['name', { ...stored, name: ' Projects ' }],
    ['id', { ...stored, id: 'not-a-uuid' }],
    ['revision', { ...stored, revision: 0 }],
    ['createdAt', { ...stored, createdAt: 'yesterday' }],
    ['updatedOrder', { ...stored, updatedOrder: [stored.updatedAt, 'wrong'] }],
    [
      'entries[1].id.provider',
      {
        ...stored,
        entries: [
          stored.entries[0],
          { ...providerReference, id: { ...providerReference.id, provider: '' } },
        ],
      },
    ],
  ])('reports a typed path-specific error at %s', (path, value) => {
    expect(() => decodeStoredPlaylist(value)).toThrowError(
      expect.objectContaining<Partial<PlaylistCorruptRecordError>>({
        code: 'corrupt-record',
        path,
      }),
    );
  });

  it('rejects duplicate references by canonical reference key', () => {
    expect(() =>
      decodeStoredPlaylist({
        ...stored,
        entries: [stored.entries[0], stored.entries[0]],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<PlaylistCorruptRecordError>>({
        path: 'entries[1]',
        message: expect.stringContaining('duplicate climb reference'),
      }),
    );
  });

  it('distinguishes unsupported schemas from corrupt records', () => {
    expect(() => decodeStoredPlaylist({ ...stored, schemaVersion: 2 })).toThrowError(
      PlaylistSchemaError,
    );
  });
});
