import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { activeInstallationId, createAppInstallationRegistry } from '../app/installations.ts';
import { draftRevision, localDraftId } from '../drafts/codec.ts';
import type { LocalDraftRepository } from '../drafts/repository.ts';
import type { DraftContent, LocalClimbDraft } from '../drafts/types.ts';
import { playlistId, playlistRevision } from './codec.ts';
import { encodePlaylistFragment, encodePortablePlaylist } from './portable-codec.ts';
import { PlaylistImportDialog } from './PlaylistImportDialog.tsx';
import type { PlaylistImportResult } from './portable-import.ts';
import type { PlaylistHistoryAdapter } from './portable-history.ts';
import { MAX_PORTABLE_PLAYLIST_BYTES, type PortablePlaylistV1 } from './portable-types.ts';
import type { LocalPlaylistRepository } from './repository.ts';
import { decodePortablePlaylist } from './portable-codec.ts';

const installation = createAppInstallationRegistry().require(activeInstallationId);
const placement = installation.definition.placements[0]!.id;

function source(overrides: Partial<PortablePlaylistV1['playlist']> = {}): PortablePlaylistV1 {
  return decodePortablePlaylist({
    format: 'cruxcontrol-playlist',
    schemaVersion: 1,
    exportedAt: '2026-08-02T18:00:00.000Z',
    playlist: {
      name: 'Imported projects',
      notes: 'Preview this first.',
      entries: [
        {
          kind: 'local-snapshot',
          snapshot: {
            status: 'finished',
            definitionId: installation.definition.id,
            layoutRevision: installation.definition.layoutRevision,
            name: 'Copied climb',
            angle: 40,
            assignments: [{ placementId: placement, appearance: { kind: 'role', role: 'start' } }],
            effectGroups: [],
            metadata: {},
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
      ],
      ...overrides,
    },
  });
}

function created(content: DraftContent): LocalClimbDraft {
  return {
    ...content,
    schemaVersion: 3,
    id: localDraftId('00000000-0000-4000-8000-000000000501'),
    revision: draftRevision(1),
    createdAt: '2026-08-02T19:00:00.000Z',
    updatedAt: '2026-08-02T19:00:00.000Z',
    metadata: content.metadata ?? {},
  };
}

function harness() {
  const drafts: LocalDraftRepository = {
    create: vi.fn(async (content) => created(content)),
    get: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    trash: vi.fn(),
    restore: vi.fn(),
    deletePermanently: vi.fn(async () => undefined),
    purgeExpiredTrash: vi.fn(),
  };
  const playlists: LocalPlaylistRepository = {
    create: vi.fn(async (content) => ({
      ...content,
      schemaVersion: 1,
      id: playlistId('00000000-0000-4000-8000-000000000502'),
      revision: playlistRevision(1),
      createdAt: '2026-08-02T19:00:00.000Z',
      updatedAt: '2026-08-02T19:00:00.000Z',
    })),
    get: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const onImported = vi.fn(async (_result: PlaylistImportResult) => undefined);
  const onRefresh = vi.fn(async () => undefined);
  const onClose = vi.fn();
  return { drafts, playlists, onImported, onRefresh, onClose };
}

function history(fragment: string): PlaylistHistoryAdapter & { replaceWithoutHash: ReturnType<typeof vi.fn> } {
  return {
    currentHash: () => fragment,
    replaceWithoutHash: vi.fn(),
  };
}

describe('PlaylistImportDialog', () => {
  it('uses file and URL inputs through the same write-free preview before confirmation', async () => {
    const state = harness();
    const value = source();
    render(
      <PlaylistImportDialog
        installation={installation}
        drafts={state.drafts}
        playlists={state.playlists}
        readFileText={async () => encodePortablePlaylist(value)}
        onImported={state.onImported}
        onRefresh={state.onRefresh}
        onClose={state.onClose}
      />,
    );

    const file = new File(['placeholder'], 'shared.cruxplaylist.json', {
      type: 'application/json',
    });
    fireEvent.change(screen.getByLabelText('Playlist file'), { target: { files: [file] } });
    expect(await screen.findByRole('heading', { name: 'Imported projects' })).toBeInTheDocument();
    expect(screen.getByText('New local climb copies').nextSibling).toHaveTextContent('1');
    expect(screen.getByText('Provider references').nextSibling).toHaveTextContent('1');
    expect(state.drafts.create).not.toHaveBeenCalled();
    expect(state.playlists.create).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Import as new list' }));
    await waitFor(() => expect(state.onImported).toHaveBeenCalledOnce());
    expect(state.drafts.create).toHaveBeenCalledOnce();
    expect(state.playlists.create).toHaveBeenCalledOnce();
    expect(state.drafts.update).not.toHaveBeenCalled();
    expect(state.playlists.update).not.toHaveBeenCalled();
  });

  it('previews a startup hash, clears only that hash on cancel, and writes nothing', async () => {
    const state = harness();
    const fragment = encodePlaylistFragment(source());
    const historyAdapter = history(fragment);
    render(
      <PlaylistImportDialog
        installation={installation}
        drafts={state.drafts}
        playlists={state.playlists}
        initialFragment={fragment}
        history={historyAdapter}
        onImported={state.onImported}
        onRefresh={state.onRefresh}
        onClose={state.onClose}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Imported projects' })).toBeInTheDocument();
    expect(state.drafts.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(historyAdapter.replaceWithoutHash).toHaveBeenCalledOnce();
    expect(state.onClose).toHaveBeenCalledOnce();

    const changedHistory = {
      currentHash: () => '#climb=newer-navigation',
      replaceWithoutHash: vi.fn(),
    };
    const changed = harness();
    render(
      <PlaylistImportDialog
        installation={installation}
        drafts={changed.drafts}
        playlists={changed.playlists}
        initialFragment={fragment}
        history={changedHistory}
        onImported={changed.onImported}
        onRefresh={changed.onRefresh}
        onClose={changed.onClose}
      />,
    );
    fireEvent.click((await screen.findAllByRole('button', { name: 'Cancel' }))[1]!);
    expect(changedHistory.replaceWithoutHash).not.toHaveBeenCalled();
  });

  it('rejects an oversized file before reading and recovers with a valid file', async () => {
    const state = harness();
    const readFileText = vi.fn(async () => encodePortablePlaylist(source()));
    render(
      <PlaylistImportDialog
        installation={installation}
        drafts={state.drafts}
        playlists={state.playlists}
        readFileText={readFileText}
        onImported={state.onImported}
        onRefresh={state.onRefresh}
        onClose={state.onClose}
      />,
    );

    const oversized = new File(['x'.repeat(MAX_PORTABLE_PLAYLIST_BYTES + 1)], 'oversized.json');
    fireEvent.change(screen.getByLabelText('Playlist file'), {
      target: { files: [oversized] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('must not exceed');
    expect(readFileText).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Playlist file'), {
      target: { files: [new File(['ok'], 'valid.cruxplaylist.json')] },
    });
    expect(await screen.findByRole('heading', { name: 'Imported projects' })).toBeInTheDocument();
    expect(readFileText).toHaveBeenCalledOnce();
  });

  it('retains a failed preview for retry and never retries execution after success', async () => {
    const state = harness();
    const root = new Error('Storage temporarily unavailable');
    vi.mocked(state.drafts.create).mockRejectedValueOnce(root);
    const value = source();
    render(
      <PlaylistImportDialog
        installation={installation}
        drafts={state.drafts}
        playlists={state.playlists}
        readFileText={async () => encodePortablePlaylist(value)}
        onImported={state.onImported}
        onRefresh={state.onRefresh}
        onClose={state.onClose}
      />,
    );
    fireEvent.change(screen.getByLabelText('Playlist file'), {
      target: { files: [new File(['ok'], 'retry.cruxplaylist.json')] },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Import as new list' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage temporarily unavailable');
    expect(screen.getByRole('heading', { name: 'Imported projects' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry import' }));
    await waitFor(() => expect(state.onImported).toHaveBeenCalledOnce());
    expect(state.drafts.create).toHaveBeenCalledTimes(2);
    expect(state.playlists.create).toHaveBeenCalledOnce();
  });

  it('blocks incompatible content during preview with no repository writes', async () => {
    const state = harness();
    const incompatible = source({
      entries: [
        {
          kind: 'local-snapshot',
          snapshot: {
            status: 'draft',
            definitionId: installation.definition.id,
            layoutRevision: installation.definition.layoutRevision,
            name: 'Wrong angle',
            angle: 13,
            assignments: [],
            effectGroups: [],
            metadata: {},
          },
        },
      ],
    });
    render(
      <PlaylistImportDialog
        installation={installation}
        drafts={state.drafts}
        playlists={state.playlists}
        readFileText={async () => encodePortablePlaylist(incompatible)}
        onImported={state.onImported}
        onRefresh={state.onRefresh}
        onClose={state.onClose}
      />,
    );
    fireEvent.change(screen.getByLabelText('Playlist file'), {
      target: { files: [new File(['ok'], 'incompatible.cruxplaylist.json')] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('13° is not supported');
    expect(state.drafts.create).not.toHaveBeenCalled();
    expect(state.playlists.create).not.toHaveBeenCalled();
  });
});
