import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftRevision, localDraftId } from '../drafts/codec';
import { DraftConflictError } from '../drafts/errors';
import type { LocalDraftRepository } from '../drafts/repository';
import { draftContent } from '../drafts/test-fixtures';
import type { DraftContent, LocalClimbDraft } from '../drafts/types';
import { layoutRevisionId } from '../domain/boards/identity';
import { playlistId, playlistRevision } from '../playlists/codec';
import { encodePlaylistFragment } from '../playlists/portable-codec';
import type { PortablePlaylistV1 } from '../playlists/portable-types';
import type { LocalPlaylistRepository } from '../playlists/repository';
import type { LocalPlaylist } from '../playlists/types';
import type { CruxControlRuntime } from './create-runtime';
import { CruxControlWorkspace } from './CruxControlWorkspace';
import { activeInstallationId, createAppInstallationRegistry } from './installations';
import type { AppUpdateService, AppUpdateSnapshot } from '../pwa/update-service.ts';

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

    fireEvent.click(screen.getByRole('button', { name: /My Climbs.*1 climb/ }));
    fireEvent.click(screen.getByRole('button', { name: /Original/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Move to trash' }));
    await waitFor(() => expect(trash).toHaveBeenCalledWith(original.id, draftRevision(2)));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('delete it forever'));

    fireEvent.click(screen.getByRole('button', { name: /Trash.*1 climb/ }));
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
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('saved'));

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Recovered copy v2' } });
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[1]?.[0]).toBe(copyId);
    expect(update.mock.calls[1]?.[2].name).toBe('Recovered copy v2');
  });
});
