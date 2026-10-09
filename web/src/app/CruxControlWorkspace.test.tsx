import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftRevision, localDraftId } from '../drafts/codec';
import { DraftConflictError } from '../drafts/errors';
import type { LocalDraftRepository } from '../drafts/repository';
import { draftContent } from '../drafts/test-fixtures';
import type { DraftContent, LocalClimbDraft } from '../drafts/types';
import { boardPlacementId, layoutRevisionId } from '../domain/boards/identity';
import { createSpatialPreset } from '../light-effects/preset-library';
import { playlistId, playlistRevision } from '../playlists/codec';
import { encodePlaylistFragment } from '../playlists/portable-codec';
import type { PortablePlaylistV1 } from '../playlists/portable-types';
import type { LocalPlaylistRepository } from '../playlists/repository';
import type { LocalPlaylist } from '../playlists/types';
import type { CruxControlRuntime } from './create-runtime';
import { CruxControlWorkspace } from './CruxControlWorkspace';
import { activeInstallationId, createAppInstallationRegistry } from './installations';
import type { AppUpdateService, AppUpdateSnapshot } from '../pwa/update-service.ts';
import { MockBoardByteTransport } from '../board-control/mock-byte-transport';
import { createFullrideLightController } from '../board-control/light-controller';
import { LibraryBackupService } from '../library-backup/service';
import type { LibraryBackupDelivery } from '../library-backup/delivery';

const original: LocalClimbDraft = {
  ...draftContent({ name: 'Original', installationId: activeInstallationId }),
  schemaVersion: 3,
  id: localDraftId('11111111-1111-4111-8111-111111111111'),
  revision: draftRevision(1),
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
  metadata: {},
};

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

function persisted(
  id: LocalClimbDraft['id'],
  revision: number,
  content: DraftContent,
): LocalClimbDraft {
  return {
    ...content,
    installationId: activeInstallationId,
    schemaVersion: 3,
    id,
    revision: draftRevision(revision),
    createdAt: original.createdAt,
    updatedAt: `2026-08-02T00:00:${String(revision).padStart(2, '0')}.000Z`,
    metadata: content.metadata ?? {},
  };
}

function listCollections(active: readonly LocalClimbDraft[], trash: readonly LocalClimbDraft[]) {
  return vi.fn<LocalDraftRepository['list']>(async (options) =>
    options?.collection === 'trash' ? trash : active,
  );
}

function runtimeWith(
  overrides: Partial<LocalDraftRepository> = {},
  playlistOverrides: Partial<LocalPlaylistRepository> = {},
): CruxControlRuntime {
  return {
    installation: createAppInstallationRegistry().require(activeInstallationId),
    drafts: {
      create: vi.fn(),
      get: vi.fn(),
      list: listCollections([], []),
      update: vi.fn(),
      trash: vi.fn(),
      restore: vi.fn(),
      deletePermanently: vi.fn(),
      ...overrides,
    },
    playlists: {
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      delete: vi.fn(),
      ...playlistOverrides,
    },
    controller: null,
    close: vi.fn(),
  };
}

function playlist(name: string, entries: LocalPlaylist['entries'] = []): LocalPlaylist {
  return {
    schemaVersion: 1,
    id: playlistId('44444444-4444-4444-8444-444444444444'),
    revision: playlistRevision(1),
    name,
    notes: '',
    entries,
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
  };
}

function updateServiceFor(snapshot: AppUpdateSnapshot): AppUpdateService {
  const current = snapshot;
  const listeners = new Set<(next: AppUpdateSnapshot) => void>();
  return {
    getSnapshot: () => current,
    subscribe(listener) {
      listeners.add(listener);
      listener(current);
      return () => listeners.delete(listener);
    },
    start: vi.fn(() => Promise.resolve()),
    apply: vi.fn(() => Promise.resolve()),
    setBlocked: vi.fn(),
    reload: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('CruxControlWorkspace', () => {
  it('passes the runtime backup delivery into the backup dialog', async () => {
    const runtime = runtimeWith();
    const delivery: LibraryBackupDelivery = { kind: 'share', deliver: vi.fn(async () => ({ status: 'shared' as const })) };
    const backup = new LibraryBackupService({
      readDrafts: async () => [],
      readPlaylists: async () => [],
      restoreMissingDrafts: async () => ({ added: 0, unchanged: 0 }),
      restoreMissingPlaylists: async () => ({ added: 0, unchanged: 0 }),
    });
    const service = updateServiceFor({ status: 'current', phase: 'current', message: '', updateAvailable: false, blockedReason: null, canApply: false, dismissed: false });
    render(<CruxControlWorkspace runtime={{ ...runtime, backup, backupDelivery: delivery }} updateService={service} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back up & restore' }));
    expect(await screen.findByRole('heading', { name: 'Save a backup' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save or share library backup' })).toBeInTheDocument();
  });

  it('preserves an unsaved new-list name and its update blocker after an empty snapshot fails to refresh', async () => {
    const runtime = runtimeWith();
    const service = updateServiceFor({ status: 'current', phase: 'current', message: '', updateAvailable: false, blockedReason: null, canApply: false, dismissed: false });
    const view = render(<CruxControlWorkspace runtime={runtime} updateService={service} />);
    fireEvent.click(screen.getByRole('button', { name: /Lists/ }));
    fireEvent.change(await screen.findByLabelText('New list'), { target: { value: 'Not saved yet' } });
    await waitFor(() => expect(service.setBlocked).toHaveBeenLastCalledWith('Save your list changes before updating.'));
    view.rerender(<CruxControlWorkspace runtime={{ ...runtime, playlists: { ...runtime.playlists, list: vi.fn().mockRejectedValue(new Error('Empty cache refresh failed')) } }} updateService={service} />);
    expect(await screen.findByText('Empty cache refresh failed')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Not saved yet')).toBeInTheDocument();
    expect(service.setBlocked).toHaveBeenLastCalledWith('Save your list changes before updating.');
  });

  it('loads climbs without waiting for a pending playlist read', async () => {
    const runtime = runtimeWith({ list: listCollections([original], []) }, {
      list: vi.fn(() => new Promise<readonly LocalPlaylist[]>(() => undefined)),
    });
    render(<CruxControlWorkspace runtime={runtime} />);
    fireEvent.click(screen.getByRole('button', { name: /Drafts/ }));
    expect(await screen.findByText('Original')).toBeInTheDocument();
  });

  it('retains cached lists and unsaved list edits when a later refresh fails', async () => {
    const runtime = runtimeWith({}, { list: vi.fn().mockResolvedValue([playlist('Saved list')]) });
    const view = render(<CruxControlWorkspace runtime={runtime} />);
    fireEvent.click(screen.getByRole('button', { name: /Lists/ }));
    const name = await screen.findByDisplayValue('Saved list');
    fireEvent.change(name, { target: { value: 'Unsaved list name' } });
    view.rerender(<CruxControlWorkspace runtime={{ ...runtime, playlists: { ...runtime.playlists, list: vi.fn().mockRejectedValue(new Error('Temporary read failure')) } }} />);
    expect(await screen.findByText('Temporary read failure')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Unsaved list name')).toBeInTheDocument();
  });

  it('keeps climbs and Trash usable when playlist reads fail, and retries Lists independently', async () => {
    const trash = { ...original, id: localDraftId('22222222-2222-4222-8222-222222222222'), name: 'Recover me', trashedAt: original.updatedAt };
    const lists = vi.fn().mockRejectedValue(new Error('Playlist store unavailable'));
    const runtime = runtimeWith({ list: listCollections([original], [trash]) }, { list: lists });
    render(<CruxControlWorkspace runtime={runtime} />);
    fireEvent.click(screen.getByRole('button', { name: /Drafts/ }));
    expect(await screen.findByText('Original')).toBeInTheDocument();
    expect(screen.queryByText('Playlist store unavailable')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Trash/ }));
    expect(await screen.findByText('Recover me')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Lists/ }));
    expect(await screen.findByText('Playlist store unavailable')).toBeInTheDocument();
    lists.mockResolvedValue([playlist('Recovered list')]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading lists' }));
    expect(await screen.findByText('Recovered list')).toBeInTheDocument();
    expect(screen.queryByText('Playlist store unavailable')).not.toBeInTheDocument();
  });

  it('shows preserved unreadable-row diagnostics alongside healthy climbs without duplicate notices', async () => {
    const list = vi.fn<LocalDraftRepository['list']>(async (options) => {
      options?.onUnreadableRecord?.({ key: 'broken-row', message: 'Unsupported stored climb version' });
      return options?.collection === 'trash' ? [] : [original];
    });
    render(<CruxControlWorkspace runtime={runtimeWith({ list })} />);
    fireEvent.click(screen.getByRole('button', { name: /Drafts/ }));
    expect(await screen.findByText('Original')).toBeInTheDocument();
    expect(screen.getAllByText(/broken-row/)).toHaveLength(1);
    expect(screen.getByText(/stored records are unchanged/i)).toBeInTheDocument();
  });

  it('pairs from lists, edits a playlist climb, and returns to the selected entry with saved changes', async () => {
    const second = { ...original, id: localDraftId('22222222-2222-4222-8222-222222222222'), name: 'Second climb' };
    let climbs = [original, second];
    const storedList = playlist('Circuit', climbs.map(({ id }) => ({ kind: 'local', id })));
    const runtime = runtimeWith({
      list: vi.fn(async (options) => options?.collection === 'trash' ? [] : climbs),
      update: vi.fn(async (id, revision, content) => {
        const saved = persisted(id, Number(revision) + 1, content);
        climbs = climbs.map((climb) => climb.id === id ? saved : climb);
        return saved;
      }),
    }, { list: vi.fn().mockResolvedValue([storedList]) });
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({ definition: runtime.installation.definition, transport });
    render(<CruxControlWorkspace runtime={{ ...runtime, controller }} />);
    fireEvent.click(await screen.findByRole('button', { name: /Lists.*1 list/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await screen.findByText(/Connected ·/);
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Play list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Edit climb' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Second climb');
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Edited in circuit' } });
    await waitFor(() => expect(document.querySelector('.save-chip')).toHaveTextContent('saved'));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Circuit' })).toBeInTheDocument();
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edited in circuit' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Exit play-through' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Original' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Original');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: 'Play list' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('keeps editing inert until an explicit reload resolves a controller mismatch', async () => {
    const runtime = runtimeWith();
    const updateService = updateServiceFor({
      status: 'reload-required',
      phase: 'reload-required',
      message: 'The update finished while this tab was opening. Reload to continue with the new version.',
      updateAvailable: true,
      blockedReason: null,
      canApply: false,
      dismissed: false,
    });
    render(<CruxControlWorkspace runtime={runtime} updateService={updateService} />);

    await screen.findByRole('heading', { name: 'My Climbs' });
    const workspace = document.querySelector('main.climb-workspace');
    expect(workspace).not.toBeNull();
    expect(workspace).toHaveAttribute('inert');
    expect(workspace).toHaveAttribute('aria-busy', 'true');
    const banner = screen.getByRole('complementary', { name: 'Application update' });
    expect(banner.closest('main')).toBeNull();
    expect(screen.getByRole('button', { name: 'Reload to continue' })).toBeInTheDocument();
  });

  it('opens a write-free Kilter screenshot chooser from the climb workspace', async () => {
    const runtime = runtimeWith();
    render(<CruxControlWorkspace runtime={runtime} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Import Kilter screenshots' }));
    expect(screen.getByRole('heading', { name: 'Import Kilter screenshots' })).toBeInTheDocument();
    expect(runtime.drafts.create).not.toHaveBeenCalled();
  });

  it('routes a startup share hash straight to a write-free import preview and clears it on cancel', async () => {
    const portable: PortablePlaylistV1 = {
      format: 'cruxcontrol-playlist',
      schemaVersion: 1,
      exportedAt: '2026-08-02T00:00:00.000Z',
      playlist: {
        name: 'Shared from URL',
        notes: 'Review before importing.',
        entries: [],
      },
    };
    const fragment = encodePlaylistFragment(portable);
    window.history.replaceState(null, '', fragment);
    const runtime = runtimeWith();

    render(<CruxControlWorkspace runtime={runtime} />);

    expect(await screen.findByRole('heading', { name: 'Shared from URL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lists.*0 lists/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(runtime.drafts.create).not.toHaveBeenCalled();
    expect(runtime.playlists.create).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(window.location.hash).toBe('');
  });

  it('partitions finished climbs, Drafts, and Trash with visible counts', async () => {
    const finished = persisted(
      localDraftId('22222222-2222-4222-8222-222222222222'),
      1,
      draftContent({ name: 'Finished line', status: 'finished' }),
    );
    const trashed = {
      ...persisted(
        localDraftId('33333333-3333-4333-8333-333333333333'),
        2,
        draftContent({ name: 'Deleted experiment' }),
      ),
      trashedAt: '2026-08-02T00:00:02.000Z',
    };
    const runtime = runtimeWith({ list: listCollections([finished, original], [trashed]) });

    render(<CruxControlWorkspace runtime={runtime} />);

    expect(await screen.findByRole('button', { name: /Finished line/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /My Climbs.*1 climb/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /Drafts.*1 climb/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trash.*1 climb/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Original/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Drafts.*1 climb/ }));
    expect(screen.getByRole('button', { name: /Original/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Finished line/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Trash.*1 climb/ }));
    expect(screen.getByRole('button', { name: /Deleted experiment/ })).toBeInTheDocument();
  });

  it('creates new climbs as Drafts and opens the editor immediately', async () => {
    const create = vi.fn(async (content: DraftContent) => persisted(original.id, 1, content));
    const runtime = runtimeWith({ create });

    render(<CruxControlWorkspace runtime={runtime} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Create climb' }));
    expect(await screen.findByRole('heading', { name: 'Untitled climb' })).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }));
    expect(screen.getByText('Draft · Fullride 7×10')).toBeInTheDocument();
  });

  it('moves climbs through lifecycle collections without changing identity or content', async () => {
    let current = original;
    const update = vi.fn<LocalDraftRepository['update']>(async (id, revision, content) => {
      current = persisted(id, Number(revision) + 1, content);
      return current;
    });
    const trash = vi.fn<LocalDraftRepository['trash']>(async (id, revision) => {
      current = {
        ...current,
        id,
        revision: draftRevision(Number(revision) + 1),
        trashedAt: '2026-08-02T00:00:03.000Z',
      };
      return current;
    });
    const restore = vi.fn<LocalDraftRepository['restore']>(async (id, revision) => {
      const { trashedAt: _trashedAt, ...active } = current;
      current = { ...active, id, revision: draftRevision(Number(revision) + 1) };
      return current;
    });
    const runtime = runtimeWith({
      list: listCollections([original], []),
      update,
      trash,
      restore,
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CruxControlWorkspace runtime={runtime} />);
    fireEvent.click(await screen.findByRole('button', { name: /Drafts.*1 climb/ }));
    fireEvent.click(screen.getByRole('button', { name: /Original/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark finished' }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update.mock.calls[0]?.[2]).toMatchObject({
      status: 'finished',
      name: original.name,
      assignments: original.assignments,
      effectGroups: original.effectGroups,
      metadata: original.metadata,
    });

    fireEvent.click(await screen.findByRole('button', { name: /My Climbs.*1 climb/ }));
    fireEvent.click(screen.getByRole('button', { name: /Original/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Move to trash' }));
    await waitFor(() => expect(trash).toHaveBeenCalledWith(original.id, draftRevision(2)));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('delete it forever'));

    fireEvent.click(await screen.findByRole('button', { name: /Trash.*1 climb/ }));
    fireEvent.click(screen.getByRole('button', { name: /Original/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(restore).toHaveBeenCalledWith(original.id, draftRevision(3)));
    expect(current).toMatchObject({ id: original.id, status: 'finished', revision: 4 });
    expect(current).not.toHaveProperty('trashedAt');
  });

  it('adds one climb to multiple lists through independent detail checkboxes', async () => {
    const first = playlist('Projects');
    const second: LocalPlaylist = {
      ...playlist('Warmups'),
      id: playlistId('55555555-5555-4555-8555-555555555555'),
    };
    let stored = [first, second];
    const list = vi.fn<LocalPlaylistRepository['list']>(async () => stored);
    const update = vi.fn<LocalPlaylistRepository['update']>(async (id, revision, content) => {
      const current = stored.find((candidate) => candidate.id === id)!;
      const changed = { ...current, ...content, revision: playlistRevision(Number(revision) + 1) };
      stored = stored.map((candidate) => (candidate.id === id ? changed : candidate));
      return changed;
    });
    const runtime = runtimeWith({ list: listCollections([original], []) }, { list, update });

    render(<CruxControlWorkspace runtime={runtime} />);
    fireEvent.click(await screen.findByRole('button', { name: /Drafts.*1 climb/ }));
    fireEvent.click(screen.getByRole('button', { name: /Original/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to lists' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Projects' }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Warmups' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));

    expect(stored.map(({ entries }) => entries)).toEqual([
      [{ kind: 'local', id: original.id }],
      [{ kind: 'local', id: original.id }],
    ]);
  });

  it('keeps a direct playlist write blocking updates across navigation and remount', async () => {
    const stored = playlist('Projects', [{ kind: 'local', id: original.id }]);
    let resolveUpdate!: (value: LocalPlaylist) => void;
    const pendingUpdate = new Promise<LocalPlaylist>((resolve) => {
      resolveUpdate = resolve;
    });
    const update = vi.fn<LocalPlaylistRepository['update']>(async () => pendingUpdate);
    const runtime = runtimeWith(
      { list: listCollections([original], []) },
      { list: vi.fn().mockResolvedValue([stored]), update },
    );
    const updateService = updateServiceFor({
      status: 'current',
      phase: 'current',
      message: 'CruxControl is up to date.',
      updateAvailable: false,
      blockedReason: null,
      canApply: false,
      dismissed: false,
    });
    const blocked = vi.mocked(updateService.setBlocked);

    render(<CruxControlWorkspace runtime={runtime} updateService={updateService} />);
    fireEvent.click(await screen.findByRole('button', { name: /Lists.*1 list/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Original from list' }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(blocked).toHaveBeenCalledWith('Wait for the current library change to finish before updating.'),
    );

    fireEvent.click(screen.getByRole('button', { name: /Drafts.*1 climb/ }));
    fireEvent.click(screen.getByRole('button', { name: /Lists.*1 list/ }));
    await waitFor(() =>
      expect(blocked).toHaveBeenLastCalledWith(
        'Wait for the current library change to finish before updating.',
      ),
    );

    resolveUpdate({ ...stored, entries: [], revision: playlistRevision(2) });
    await waitFor(() => expect(blocked).toHaveBeenLastCalledWith(null));
  });

  it('leaves playlist rows untouched while Trash and restore change runtime availability', async () => {
    let current = original;
    const listDrafts = vi.fn<LocalDraftRepository['list']>(async (options) => {
      if (options?.collection === 'trash') return current.trashedAt ? [current] : [];
      return current.trashedAt ? [] : [current];
    });
    const trash = vi.fn<LocalDraftRepository['trash']>(async (_id, revision) => {
      current = {
        ...current,
        revision: draftRevision(Number(revision) + 1),
        trashedAt: '2026-08-02T00:00:03.000Z',
      };
      return current;
    });
    const restore = vi.fn<LocalDraftRepository['restore']>(async (_id, revision) => {
      const { trashedAt: _trashedAt, ...active } = current;
      current = { ...active, revision: draftRevision(Number(revision) + 1) };
      return current;
    });
    const stored = playlist('Projects', [{ kind: 'local', id: original.id }]);
    const playlistUpdate = vi.fn<LocalPlaylistRepository['update']>();
    const playlistDelete = vi.fn<LocalPlaylistRepository['delete']>();
    const runtime = runtimeWith(
      { list: listDrafts, trash, restore },
      { list: vi.fn().mockResolvedValue([stored]), update: playlistUpdate, delete: playlistDelete },
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CruxControlWorkspace runtime={runtime} />);
    fireEvent.click(await screen.findByRole('button', { name: /Drafts.*1 climb/ }));
    fireEvent.click(screen.getByRole('button', { name: /Original/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Move to trash' }));
    await waitFor(() => expect(trash).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: /Lists.*1 list/ }));
    expect(await screen.findByText('In Trash')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Original' })).toBeDisabled();
    expect(playlistUpdate).not.toHaveBeenCalled();
    expect(playlistDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Trash.*1 climb/ }));
    fireEvent.click(screen.getByRole('button', { name: /Original/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(restore).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: /Lists.*1 list/ }));
    expect(await screen.findByText('Available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Original' })).toBeEnabled();
    expect(stored.entries).toEqual([{ kind: 'local', id: original.id }]);
  });

  it('confirms Delete forever and makes destructive failures retryable', async () => {
    const trashed = {
      ...original,
      revision: draftRevision(2),
      trashedAt: '2026-08-02T00:00:02.000Z',
    };
    const deletePermanently = vi
      .fn<LocalDraftRepository['deletePermanently']>()
      .mockRejectedValueOnce(new Error('Storage is busy.'))
      .mockResolvedValueOnce(undefined);
    const runtime = runtimeWith({
      list: listCollections([], [trashed]),
      deletePermanently,
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CruxControlWorkspace runtime={runtime} />);
    fireEvent.click(await screen.findByRole('button', { name: /Trash.*1 climb/ }));
    fireEvent.click(screen.getByRole('button', { name: /Original/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Storage is busy.');
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('cannot be undone'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry delete forever' }));
    await waitFor(() => expect(deletePermanently).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('heading', { name: 'Trash is empty' })).toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalledOnce();
  });

  it.each(['include', 'exclude'] as const)('preserves climbs with unavailable spatial %s targets for recovery', async (targetKind) => {
    const group = createSpatialPreset('snake', 17);
    const incompatible: LocalClimbDraft = {
      ...original,
      schemaVersion: 4,
      effectGroups: [{ ...group, target: { ...group.target, [targetKind]: [boardPlacementId('missing-target')] } }],
    };
    const before = JSON.stringify(incompatible);
    const runtime = runtimeWith({ list: listCollections([incompatible], []) });
    render(<CruxControlWorkspace runtime={runtime} />);
    fireEvent.click(await screen.findByRole('button', { name: /Drafts.*1 climb/ }));
    expect(screen.getByRole('region', { name: 'Recovery needed' })).toHaveTextContent('references unavailable hold missing-target');
    expect(screen.getByRole('button', { name: 'Move Original to Trash' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit climb' })).not.toBeInTheDocument();
    expect(runtime.drafts.update).not.toHaveBeenCalled();
    expect(JSON.stringify(incompatible)).toBe(before);
  });

  it('keeps incompatible climbs visible with only safe recovery actions', async () => {
    const incompatible = {
      ...original,
      layoutRevision: layoutRevisionId('fullride-stale-layout'),
    };
    const incompatibleTrash = {
      ...persisted(
        localDraftId('22222222-2222-4222-8222-222222222222'),
        2,
        draftContent({ name: 'Stale trash', status: 'finished' }),
      ),
      layoutRevision: layoutRevisionId('fullride-stale-layout'),
      trashedAt: '2026-08-02T00:00:02.000Z',
    };
    const runtime = runtimeWith({
      list: listCollections([incompatible], [incompatibleTrash]),
    });

    render(<CruxControlWorkspace runtime={runtime} />);
    fireEvent.click(await screen.findByRole('button', { name: /Drafts.*1 climb/ }));
    const recovery = screen.getByRole('region', { name: 'Recovery needed' });
    expect(recovery).toHaveTextContent('Original');
    expect(recovery).toHaveTextContent('uses a different layout revision');
    expect(screen.getByRole('button', { name: 'Move Original to Trash' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark finished' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Trash.*1 climb/ }));
    expect(screen.getByRole('button', { name: 'Restore Stale trash' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Stale trash forever' })).toBeInTheDocument();
  });

  it('keeps old Trash rows under explicit Delete forever control during refresh', async () => {
    const trashed = {
      ...persisted(original.id, 1, draftContent({ name: 'Old Trash' })),
      trashedAt: '2026-07-01T00:00:00.000Z',
    };
    const runtime = runtimeWith({ list: listCollections([], [trashed]) });
    render(<CruxControlWorkspace runtime={runtime} />);
    fireEvent.click(await screen.findByRole('button', { name: /Trash.*1 climb/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Old Trash/ }));
    expect(screen.getByRole('button', { name: 'Delete forever' })).toBeInTheDocument();
  });

  it('adopts Save-a-copy identity so later saves target the copy', async () => {
    const copyId = localDraftId('22222222-2222-4222-8222-222222222222');
    const conflict = new DraftConflictError(original.id, draftRevision(1), draftRevision(2));
    const update = vi
      .fn<LocalDraftRepository['update']>()
      .mockRejectedValueOnce(conflict)
      .mockImplementation(async (id, revision, content) =>
        persisted(id, Number(revision) + 1, content),
      );
    const create = vi.fn(async (content: DraftContent) => persisted(copyId, 1, content));
    const runtime = runtimeWith({
      create,
      list: listCollections([original], []),
      update,
    });
    render(<CruxControlWorkspace runtime={runtime} />);

    fireEvent.click(await screen.findByRole('button', { name: /Drafts.*1 climb/ }));
    fireEvent.click(screen.getByRole('button', { name: /Original/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit climb' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Recovered copy' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Save a copy' }));
    await waitFor(() => expect(document.querySelector('.save-chip')).toHaveTextContent('saved'));

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Recovered copy v2' } });
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[1]?.[0]).toBe(copyId);
    expect(update.mock.calls[1]?.[2].name).toBe('Recovered copy v2');
  });
});
