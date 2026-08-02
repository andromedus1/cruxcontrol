import { apiLevel3Color } from '../domain/boards/colors.ts';
import { boardDefinitionId, boardPlacementId, layoutRevisionId } from '../domain/boards/identity.ts';
import { draftRevision, localDraftId } from '../drafts/codec.ts';
import type { LocalDraftRepository } from '../drafts/repository.ts';
import type { DraftContent, LocalClimbDraft } from '../drafts/types.ts';
import type { LocalPlaylistRepository } from './repository.ts';
import { playlistId, playlistRevision } from './codec.ts';
import { decodePortablePlaylist } from './portable-codec.ts';
import {
  executePlaylistImport,
  planPlaylistImport,
  PlaylistImportCompatibilityError,
  PlaylistImportExecutionError,
} from './portable-import.ts';
import type { PortablePlaylistV1 } from './portable-types.ts';
import type { LocalPlaylist } from './types.ts';
import { activeInstallationId, createAppInstallationRegistry } from '../app/installations.ts';

const installation = createAppInstallationRegistry().require(activeInstallationId);
const placements = installation.definition.placements;

function source(): PortablePlaylistV1 {
  return decodePortablePlaylist({
    format: 'cruxcontrol-playlist',
    schemaVersion: 1,
    exportedAt: '2026-08-02T18:00:00.000Z',
    playlist: {
      name: 'Shared projects',
      notes: 'Keep this order.',
      entries: [
        {
          kind: 'local-snapshot',
          snapshot: {
            status: 'finished',
            definitionId: installation.definition.id,
            layoutRevision: installation.definition.layoutRevision,
            name: 'First local',
            angle: 40,
            assignments: [
              {
                placementId: placements[0]!.id,
                appearance: { kind: 'role', role: 'start' },
              },
            ],
            effectGroups: [],
            metadata: { grade: 'V4' },
          },
        },
        {
          kind: 'provider',
          id: {
            provider: 'kilter',
            sourceId: '12345',
            layoutRevision: installation.definition.layoutRevision,
          },
        },
        {
          kind: 'local-snapshot',
          snapshot: {
            status: 'draft',
            definitionId: installation.definition.id,
            layoutRevision: installation.definition.layoutRevision,
            name: 'Second local',
            angle: 40,
            assignments: [
              {
                placementId: placements[1]!.id,
                appearance: { kind: 'custom', color: apiLevel3Color(181) },
              },
            ],
            effectGroups: [],
            metadata: { description: 'Unicode 🌊' },
          },
        },
      ],
    },
  });
}

function createdDraft(id: number, content: DraftContent): LocalClimbDraft {
  return {
    ...content,
    schemaVersion: 3,
    id: localDraftId(`00000000-0000-4000-8000-${String(id).padStart(12, '0')}`),
    revision: draftRevision(1),
    createdAt: '2026-08-02T19:00:00.000Z',
    updatedAt: '2026-08-02T19:00:00.000Z',
    metadata: content.metadata ?? {},
  };
}

function repositories() {
  let draftNumber = 101;
  let capturedPlaylist: LocalPlaylist['entries'] = [];
  const drafts: LocalDraftRepository = {
    create: vi.fn(async (content) => createdDraft(draftNumber++, content)),
    get: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    trash: vi.fn(),
    restore: vi.fn(),
    deletePermanently: vi.fn(async () => undefined),
    purgeExpiredTrash: vi.fn(),
  };
  const playlists: LocalPlaylistRepository = {
    create: vi.fn(async (content) => {
      capturedPlaylist = content.entries;
      return {
        ...content,
        schemaVersion: 1,
        id: playlistId('00000000-0000-4000-8000-000000000201'),
        revision: playlistRevision(1),
        createdAt: '2026-08-02T19:00:00.000Z',
        updatedAt: '2026-08-02T19:00:00.000Z',
      };
    }),
    get: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return { drafts, playlists, capturedPlaylist: () => capturedPlaylist };
}

describe('portable playlist import', () => {
  it('plans a write-free compatibility preview with truthful unresolved provider counts', () => {
    const value = source();
    const plan = planPlaylistImport(value, installation);

    expect(plan).toMatchObject({
      source: value,
      installationId: activeInstallationId,
      localCopyCount: 2,
      providerReferenceCount: 1,
      unresolvedProviderCount: 1,
    });
    expect(plan.warnings).toEqual([
      '1 provider reference is retained in order but unresolved until matching catalog climbs are available.',
    ]);
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it.each([
    [
      'definition-mismatch',
      'playlist.entries[0].snapshot.definitionId',
      (value: PortablePlaylistV1) => ({
        ...value,
        playlist: {
          ...value.playlist,
          entries: value.playlist.entries.map((entry, index) =>
            index === 0 && entry.kind === 'local-snapshot'
              ? {
                  ...entry,
                  snapshot: { ...entry.snapshot, definitionId: boardDefinitionId('other-board') },
                }
              : entry,
          ),
        },
      }),
    ],
    [
      'layout-mismatch',
      'playlist.entries[0].snapshot.layoutRevision',
      (value: PortablePlaylistV1) => ({
        ...value,
        playlist: {
          ...value.playlist,
          entries: value.playlist.entries.map((entry, index) =>
            index === 0 && entry.kind === 'local-snapshot'
              ? {
                  ...entry,
                  snapshot: {
                    ...entry.snapshot,
                    layoutRevision: layoutRevisionId('other-layout'),
                  },
                }
              : entry,
          ),
        },
      }),
    ],
    [
      'unsupported-angle',
      'playlist.entries[0].snapshot.angle',
      (value: PortablePlaylistV1) => ({
        ...value,
        playlist: {
          ...value.playlist,
          entries: value.playlist.entries.map((entry, index) =>
            index === 0 && entry.kind === 'local-snapshot'
              ? { ...entry, snapshot: { ...entry.snapshot, angle: 13 } }
              : entry,
          ),
        },
      }),
    ],
    [
      'unknown-placement',
      'playlist.entries[0].snapshot.assignments[0].placementId',
      (value: PortablePlaylistV1) => ({
        ...value,
        playlist: {
          ...value.playlist,
          entries: value.playlist.entries.map((entry, index) =>
            index === 0 && entry.kind === 'local-snapshot'
              ? {
                  ...entry,
                  snapshot: {
                    ...entry.snapshot,
                    assignments: [
                      {
                        placementId: boardPlacementId('missing-placement'),
                        appearance: { kind: 'role' as const, role: 'start' as const },
                      },
                    ],
                  },
                }
              : entry,
          ),
        },
      }),
    ],
  ] as const)('rejects %s before execution at %s', (code, path, change) => {
    expect(() => planPlaylistImport(change(source()), installation)).toThrowError(
      expect.objectContaining<Partial<PlaylistImportCompatibilityError>>({ code, path }),
    );
  });

  it('creates fresh climbs then the playlist with exact mixed order and no updates', async () => {
    const plan = planPlaylistImport(source(), installation);
    const { drafts, playlists, capturedPlaylist } = repositories();
    const result = await executePlaylistImport(plan, drafts, playlists);

    expect(drafts.create).toHaveBeenCalledTimes(2);
    expect(drafts.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        installationId: activeInstallationId,
        status: 'finished',
        name: 'First local',
        assignments: plan.source.playlist.entries[0]!.kind === 'local-snapshot'
          ? plan.source.playlist.entries[0].snapshot.assignments
          : [],
      }),
    );
    expect(drafts.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: 'draft', name: 'Second local' }),
    );
    expect(capturedPlaylist()).toEqual([
      { kind: 'local', id: result.createdClimbs[0]!.id },
      plan.source.playlist.entries[1],
      { kind: 'local', id: result.createdClimbs[1]!.id },
    ]);
    expect(playlists.create).toHaveBeenCalledWith({
      name: 'Shared projects',
      notes: 'Keep this order.',
      entries: capturedPlaylist(),
    });
    expect(drafts.update).not.toHaveBeenCalled();
    expect(playlists.update).not.toHaveBeenCalled();
    expect(drafts.deletePermanently).not.toHaveBeenCalled();
  });

  it('compensates partial climb creation in reverse order after the root failure', async () => {
    const plan = planPlaylistImport(source(), installation);
    const { drafts, playlists } = repositories();
    const first = createdDraft(301, {
      ...(plan.source.playlist.entries[0] as Extract<
        PortablePlaylistV1['playlist']['entries'][number],
        { kind: 'local-snapshot' }
      >).snapshot,
      installationId: activeInstallationId,
    });
    const root = new Error('Second create failed');
    vi.mocked(drafts.create).mockResolvedValueOnce(first).mockRejectedValueOnce(root);

    await expect(executePlaylistImport(plan, drafts, playlists)).rejects.toEqual(
      expect.objectContaining<Partial<PlaylistImportExecutionError>>({
        code: 'import-failed',
        cause: root,
        cleanupFailures: [],
      }),
    );
    expect(drafts.deletePermanently).toHaveBeenCalledWith(first.id, first.revision);
    expect(playlists.create).not.toHaveBeenCalled();
  });

  it('reports the root and every reverse-order cleanup failure with orphan IDs', async () => {
    const plan = planPlaylistImport(source(), installation);
    const { drafts, playlists } = repositories();
    const root = new Error('Playlist create failed');
    const cleanup = new Error('First cleanup failed');
    vi.mocked(playlists.create).mockRejectedValueOnce(root);
    vi.mocked(drafts.deletePermanently)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(cleanup);

    let thrown: unknown;
    try {
      await executePlaylistImport(plan, drafts, playlists);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toEqual(
      expect.objectContaining<Partial<PlaylistImportExecutionError>>({
        code: 'import-failed',
        cause: root,
        cleanupFailures: [expect.objectContaining({ error: cleanup })],
      }),
    );
    const created = vi.mocked(drafts.create).mock.results.map(({ value }) => value);
    const resolved = await Promise.all(created);
    expect(vi.mocked(drafts.deletePermanently).mock.calls.map(([id]) => id)).toEqual([
      resolved[1]!.id,
      resolved[0]!.id,
    ]);
    expect((thrown as PlaylistImportExecutionError).orphanedClimbIds).toEqual([
      resolved[0]!.id,
    ]);
    expect((thrown as Error).message).toContain('Playlist create failed');
    expect((thrown as Error).message).toContain('First cleanup failed');
  });
});
