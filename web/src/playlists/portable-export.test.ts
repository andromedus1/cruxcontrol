import { apiLevel3Color } from '../domain/boards/colors.ts';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10.ts';
import { lightEffectGroupId } from '../board-renderer/types.ts';
import { localDraftId, draftRevision } from '../drafts/codec.ts';
import { draftContent } from '../drafts/test-fixtures.ts';
import type { LocalClimbDraft } from '../drafts/types.ts';
import { boardInstallationId } from '../installations/contracts.ts';
import { playlistId, playlistRevision } from './codec.ts';
import {
  decodePortablePlaylist,
  encodePlaylistFragment,
  encodePortablePlaylist,
} from './portable-codec.ts';
import {
  createPortablePlaylist,
  MAX_PLAYLIST_SHARE_URL_LENGTH,
  playlistFile,
  playlistShareUrl,
  PortablePlaylistExportError,
} from './portable-export.ts';
import { providerReference } from './test-fixtures.ts';
import type { LocalPlaylist } from './types.ts';

const FIRST_ID = localDraftId('11111111-1111-4111-8111-111111111111');
const SECOND_ID = localDraftId('22222222-2222-4222-8222-222222222222');

function localClimb(
  id: LocalClimbDraft['id'],
  name: string,
  overrides: Partial<LocalClimbDraft> = {},
): LocalClimbDraft {
  const content = draftContent({ name });
  return {
    schemaVersion: 3,
    id,
    revision: draftRevision(7),
    ...content,
    createdAt: '2026-08-01T18:00:00.000Z',
    updatedAt: '2026-08-02T18:00:00.000Z',
    ...overrides,
    metadata: overrides.metadata ?? content.metadata ?? {},
    effectGroups: overrides.effectGroups ?? content.effectGroups,
  };
}

function localPlaylist(overrides: Partial<LocalPlaylist> = {}): LocalPlaylist {
  return {
    schemaVersion: 1,
    id: playlistId('00000000-0000-4000-8000-000000000011'),
    revision: playlistRevision(4),
    name: 'Projects / 夜',
    notes: 'Exact order 🌊',
    entries: [{ kind: 'local', id: SECOND_ID }, providerReference, { kind: 'local', id: FIRST_ID }],
    createdAt: '2026-08-01T18:00:00.000Z',
    updatedAt: '2026-08-02T18:00:00.000Z',
    ...overrides,
  };
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(file);
  });
}

describe('portable playlist export', () => {
  it('snapshots local content losslessly in playlist order without local authority fields', () => {
    const placement = kilterFullride7x10Definition.placements[0].id;
    const first = localClimb(FIRST_ID, 'First', {
      status: 'finished',
      trashedAt: '2026-08-02T12:00:00.000Z',
      installationId: boardInstallationId('private-installation'),
      assignments: [
        {
          placementId: placement,
          appearance: { kind: 'custom', color: apiLevel3Color(181) },
          effectGroupId: lightEffectGroupId('wave'),
        },
      ],
      effectGroups: [
        {
          model: 'assigned',
          id: lightEffectGroupId('wave'),
          kind: 'wave',
          palette: [apiLevel3Color(181), apiLevel3Color(31)],
          periodMs: 2_400,
          intensity: 0.8,
        },
      ],
      metadata: { grade: 'V5', description: 'Keep me', setterNotes: 'Feet' },
    });
    const second = localClimb(SECOND_ID, 'Second');
    const result = createPortablePlaylist(
      localPlaylist(),
      [first, second],
      () => new Date('2026-08-02T20:00:00.000Z'),
    );

    expect(result.playlist.entries.map((entry) => entry.kind)).toEqual([
      'local-snapshot',
      'provider',
      'local-snapshot',
    ]);
    expect(result.playlist.entries[0]).toMatchObject({
      kind: 'local-snapshot',
      snapshot: { name: 'Second' },
    });
    expect(result.playlist.entries[2]).toEqual({
      kind: 'local-snapshot',
      snapshot: {
        status: 'finished',
        definitionId: first.definitionId,
        layoutRevision: first.layoutRevision,
        name: first.name,
        angle: first.angle,
        assignments: first.assignments,
        effectGroups: first.effectGroups,
        metadata: first.metadata,
      },
    });
    expect(result.playlist.entries[1]).toEqual(providerReference);

    const wire = encodePortablePlaylist(result);
    expect(wire).not.toContain(FIRST_ID);
    expect(wire).not.toContain(SECOND_ID);
    expect(wire).not.toContain('private-installation');
    const parsed = JSON.parse(wire) as Record<string, unknown>;
    const parsedPlaylist = parsed.playlist as Record<string, unknown>;
    const parsedEntries = parsedPlaylist.entries as Record<string, unknown>[];
    const snapshot = parsedEntries[2].snapshot as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual([
      'exportedAt',
      'format',
      'playlist',
      'schemaVersion',
    ]);
    expect(Object.keys(parsedPlaylist).sort()).toEqual(['entries', 'name', 'notes']);
    expect(Object.keys(snapshot).sort()).toEqual([
      'angle',
      'assignments',
      'definitionId',
      'effectGroups',
      'layoutRevision',
      'metadata',
      'name',
      'status',
    ]);
    expect(snapshot).not.toHaveProperty('id');
    expect(snapshot).not.toHaveProperty('revision');
    expect(snapshot).not.toHaveProperty('installationId');
    expect(snapshot).not.toHaveProperty('trashedAt');
    expect(snapshot).not.toHaveProperty('createdAt');
    expect(snapshot).not.toHaveProperty('updatedAt');
  });

  it('blocks a missing local membership at its exact list position', () => {
    const second = localClimb(SECOND_ID, 'Second');
    expect(() => createPortablePlaylist(localPlaylist(), [second])).toThrowError(
      expect.objectContaining<Partial<PortablePlaylistExportError>>({
        code: 'missing-local-climb',
        path: 'playlist.entries[2]',
        entryIndex: 2,
        localDraftId: FIRST_ID,
      }),
    );
  });

  it('uses a fragment-only URL through the exact 1,800-character boundary', () => {
    const value = createPortablePlaylist(localPlaylist({ entries: [] }), []);
    const fragment = encodePlaylistFragment(value);
    const prefix = 'https://example.test/';
    const exactBase = new URL(
      `${prefix}${'x'.repeat(MAX_PLAYLIST_SHARE_URL_LENGTH - prefix.length - fragment.length)}?old=1#old`,
    );
    const exact = playlistShareUrl(exactBase, value);

    expect(exact?.href).toHaveLength(MAX_PLAYLIST_SHARE_URL_LENGTH);
    expect(exact?.search).toBe('');
    expect(exact?.hash).toBe(fragment);
    expect(exactBase.search).toBe('?old=1');
    const overBase = new URL(
      `${prefix}${'x'.repeat(MAX_PLAYLIST_SHARE_URL_LENGTH - prefix.length - fragment.length + 1)}`,
    );
    expect(playlistShareUrl(overBase, value)).toBeNull();
  });

  it('always emits a complete named JSON file when the share URL is too long', async () => {
    const value = createPortablePlaylist(
      localPlaylist({ entries: [], notes: '🌊'.repeat(2_000) }),
      [],
    );
    expect(playlistShareUrl(new URL('https://example.test/app'), value)).toBeNull();

    const file = playlistFile(value);
    expect(file.name).toBe('Projects - 夜.cruxplaylist.json');
    expect(file.type).toBe('application/json;charset=utf-8');
    const text = await readFile(file);
    expect(text).toBe(encodePortablePlaylist(value));
    expect(decodePortablePlaylist(JSON.parse(text))).toEqual(value);
  });
});
