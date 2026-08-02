import {
  decodePlaylistFragment,
  decodePortablePlaylist,
  encodePlaylistFragment,
  encodePortablePlaylist,
  PortablePlaylistSchemaError,
  PortablePlaylistValidationError,
} from './portable-codec.ts';
import {
  PORTABLE_PLAYLIST_FORMAT,
  PORTABLE_PLAYLIST_LIMITS,
  PORTABLE_PLAYLIST_SCHEMA_VERSION,
  type PortablePlaylistV1,
} from './portable-types.ts';

const raw = {
  format: PORTABLE_PLAYLIST_FORMAT,
  schemaVersion: PORTABLE_PLAYLIST_SCHEMA_VERSION,
  exportedAt: '2026-08-02T18:00:00.000Z',
  playlist: {
    name: '夜の波 🪨',
    notes: 'Départ → crux → fin 🌊',
    entries: [
      {
        kind: 'local-snapshot',
        snapshot: {
          status: 'finished',
          definitionId: 'kilter:fullride-7x10',
          layoutRevision: 'kilter-fullride-7x10-v1',
          name: '青い波',
          angle: 40,
          assignments: [
            {
              placementId: 'p-1',
              appearance: { kind: 'role', role: 'start' },
            },
            {
              placementId: 'p-2',
              appearance: { kind: 'custom', color: 181 },
              effectGroupId: 'ocean',
            },
          ],
          effectGroups: [
            {
              id: 'ocean',
              kind: 'wave',
              palette: [181, 127, 31],
              periodMs: 2_400,
              intensity: 0.75,
            },
          ],
          metadata: { grade: 'V5', description: '自由', setterNotes: '左足' },
        },
      },
      {
        kind: 'provider',
        id: {
          provider: 'kilter',
          sourceId: '12345',
          layoutRevision: 'kilter-fullride-7x10-v1',
        },
      },
    ],
  },
} as const;

function clone(): Record<string, unknown> {
  return structuredClone(raw) as unknown as Record<string, unknown>;
}

function object(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function entriesOf(value: Record<string, unknown>): unknown[] {
  return object(value.playlist).entries as unknown[];
}

function snapshotOf(value: Record<string, unknown>): Record<string, unknown> {
  return object(object(entriesOf(value)[0]).snapshot);
}

function assignmentsOf(value: Record<string, unknown>): Record<string, unknown>[] {
  return snapshotOf(value).assignments as Record<string, unknown>[];
}

function effectGroupsOf(value: Record<string, unknown>): Record<string, unknown>[] {
  return snapshotOf(value).effectGroups as Record<string, unknown>[];
}

function playlist(): PortablePlaylistV1 {
  return decodePortablePlaylist(clone());
}

describe('portable playlist codec', () => {
  it('round-trips Unicode and mixed local/provider content in canonical order', () => {
    const decoded = playlist();
    const json = encodePortablePlaylist(decoded);
    const fragment = encodePlaylistFragment(decoded);

    expect(JSON.parse(json)).toEqual(raw);
    expect(fragment).toMatch(/^#playlist=[A-Za-z0-9_-]+$/u);
    expect(fragment.slice('#playlist='.length)).not.toMatch(/[+=/]/u);
    expect(decodePlaylistFragment(fragment)).toEqual(decoded);
    expect(decoded.playlist.entries.map(({ kind }) => kind)).toEqual([
      'local-snapshot',
      'provider',
    ]);
    expect(decoded.playlist.entries[0]).toEqual(raw.playlist.entries[0]);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded.playlist.entries)).toBe(true);
    expect(Object.isFrozen(decoded.playlist.entries[0])).toBe(true);
  });

  it('preserves every role, packed custom color, and effect kind in assignment order', () => {
    const value = clone();
    const roles = ['start', 'middle', 'finish', 'foot-only'] as const;
    const effectKinds = ['pulse', 'color-cycle', 'wave', 'twinkle', 'alternate'] as const;
    snapshotOf(value).effectGroups = effectKinds.map((kind, index) => ({
      id: `effect-${index}`,
      kind,
      palette: [index, 255 - index],
      periodMs: 1_000 + index,
      intensity: index / effectKinds.length,
    }));
    snapshotOf(value).assignments = [
      ...roles.map((role, index) => ({
        placementId: `role-${index}`,
        appearance: { kind: 'role', role },
      })),
      ...Array.from({ length: 256 }, (_, color) => ({
        placementId: `custom-${color}`,
        appearance: { kind: 'custom', color },
        effectGroupId: `effect-${color % effectKinds.length}`,
      })),
    ];

    const decoded = decodePortablePlaylist(value);
    expect(JSON.parse(encodePortablePlaylist(decoded))).toEqual(value);
  });

  it.each([
    [
      'playlist.entries[0].snapshot.assignments[1].placementId',
      (value: Record<string, unknown>) => {
        assignmentsOf(value)[1].placementId = 'p-1';
      },
    ],
    [
      'playlist.entries[0].snapshot.assignments[1].appearance.color',
      (value: Record<string, unknown>) => {
        object(assignmentsOf(value)[1].appearance).color = 256;
      },
    ],
    [
      'playlist.entries[0].snapshot.effectGroups[0].kind',
      (value: Record<string, unknown>) => {
        effectGroupsOf(value)[0].kind = 'matrix';
      },
    ],
    [
      'playlist.entries[0].snapshot.assignments[1].effectGroupId',
      (value: Record<string, unknown>) => {
        assignmentsOf(value)[1].effectGroupId = 'missing';
      },
    ],
    [
      'playlist.entries[0].snapshot.id',
      (value: Record<string, unknown>) => {
        snapshotOf(value).id = '11111111-1111-4111-8111-111111111111';
      },
    ],
    [
      'playlist.entries[1].id.provider',
      (value: Record<string, unknown>) => {
        object(object(entriesOf(value)[1]).id).provider = '';
      },
    ],
  ])('rejects malformed content at %s without mutating the source', (path, change) => {
    const value = clone();
    change(value);
    const before = structuredClone(value);
    expect(() => decodePortablePlaylist(value)).toThrowError(
      expect.objectContaining<Partial<PortablePlaylistValidationError>>({
        code: 'invalid-payload',
        path,
      }),
    );
    expect(value).toEqual(before);
  });

  it('rejects unknown schema versions with a typed path-specific error', () => {
    expect(() => decodePortablePlaylist({ ...clone(), schemaVersion: 2 })).toThrowError(
      expect.objectContaining<Partial<PortablePlaylistSchemaError>>({
        code: 'unsupported-schema',
        path: 'schemaVersion',
        schemaVersion: 2,
      }),
    );
  });

  it('rejects duplicate provider identities by their complete namespaced key', () => {
    const value = clone();
    const provider = structuredClone(entriesOf(value)[1]);
    object(value.playlist).entries = [provider, structuredClone(provider)];
    expect(() => decodePortablePlaylist(value)).toThrowError(
      expect.objectContaining<Partial<PortablePlaylistValidationError>>({
        code: 'invalid-payload',
        path: 'playlist.entries[1]',
        message: expect.stringContaining('duplicate provider climb reference'),
      }),
    );
  });

  it('bounds collections before decoding their entries', () => {
    const value = clone();
    object(value.playlist).entries = Array.from(
      { length: PORTABLE_PLAYLIST_LIMITS.entries + 1 },
      () => null,
    );
    expect(() => decodePortablePlaylist(value)).toThrowError(
      expect.objectContaining<Partial<PortablePlaylistValidationError>>({
        code: 'oversized-payload',
        path: 'playlist.entries',
      }),
    );
  });

  it('rejects a structurally bounded payload whose canonical UTF-8 JSON exceeds the byte ceiling', () => {
    const value = clone();
    const long = '🌊'.repeat(PORTABLE_PLAYLIST_LIMITS.stringCodeUnits / 2);
    const local = structuredClone(entriesOf(value)[0]) as Record<string, unknown>;
    const snapshot = local.snapshot as Record<string, unknown>;
    snapshot.name = long;
    snapshot.metadata = { grade: long, description: long, setterNotes: long };
    object(value.playlist).entries = Array.from({ length: 5 }, () => structuredClone(local));
    expect(() => decodePortablePlaylist(value)).toThrowError(
      expect.objectContaining<Partial<PortablePlaylistValidationError>>({
        code: 'oversized-payload',
        path: '$',
      }),
    );
  });

  it.each([
    ['empty', '#playlist=', 'invalid-payload'],
    ['non-base64url', '#playlist=***', 'invalid-payload'],
    ['noncanonical base64url', '#playlist=AB', 'invalid-payload'],
    ['invalid UTF-8', '#playlist=_w', 'invalid-payload'],
    ['invalid JSON', '#playlist=eA', 'invalid-payload'],
    [
      'oversized',
      `#playlist=${'A'.repeat(Math.ceil(PORTABLE_PLAYLIST_LIMITS.bytes / 3) * 4 + 1)}`,
      'oversized-payload',
    ],
  ])('rejects %s fragments before schema decoding', (_case, fragment, code) => {
    expect(() => decodePlaylistFragment(fragment)).toThrowError(
      expect.objectContaining<Partial<PortablePlaylistValidationError>>({
        code: code as PortablePlaylistValidationError['code'],
        path: '#playlist',
      }),
    );
  });

  it('ignores fragments owned by other routes', () => {
    expect(decodePlaylistFragment('')).toBeNull();
    expect(decodePlaylistFragment('#climb=abc')).toBeNull();
  });
});
