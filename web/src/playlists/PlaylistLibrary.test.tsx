import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { draftRevision, localDraftId } from '../drafts/codec.ts';
import type { LocalDraftRepository } from '../drafts/repository.ts';
import { draftContent } from '../drafts/test-fixtures.ts';
import type { LocalClimbDraft } from '../drafts/types.ts';
import { kilterFullride7x10Definition as definition } from '../domain/boards/definitions/kilter-fullride-7x10.ts';
import { activeInstallationId, createAppInstallationRegistry } from '../app/installations.ts';
import { playlistId, playlistRevision } from './codec.ts';
import { PlaylistLibrary } from './PlaylistLibrary.tsx';
import type { LocalPlaylistRepository } from './repository.ts';
import type { LocalPlaylist, PlaylistContent } from './types.ts';

const ACTIVE_ID = localDraftId('00000000-0000-4000-8000-000000000051');
const TRASHED_ID = localDraftId('00000000-0000-4000-8000-000000000052');
const MISSING_ID = localDraftId('00000000-0000-4000-8000-000000000053');
const installation = createAppInstallationRegistry().require(activeInstallationId);

function climb(id: typeof ACTIVE_ID, name: string, trashed = false): LocalClimbDraft {
  return {
    ...draftContent({ name }),
    schemaVersion: 3,
    id,
    revision: draftRevision(1),
    ...(trashed ? { trashedAt: '2026-08-02T12:00:00.000Z' } : {}),
    createdAt: '2026-08-02T12:00:00.000Z',
    updatedAt: '2026-08-02T12:00:00.000Z',
    metadata: {},
  };
}

function storedPlaylist(
  content: PlaylistContent,
  revision = 1,
  id = '00000000-0000-4000-8000-000000000061',
): LocalPlaylist {
  return {
    ...content,
    schemaVersion: 1,
    id: playlistId(id),
    revision: playlistRevision(revision),
    createdAt: '2026-08-02T12:00:00.000Z',
    updatedAt: `2026-08-02T12:00:${String(revision).padStart(2, '0')}.000Z`,
  };
}

function renderLibrary(initial: readonly LocalPlaylist[], localClimbs: readonly LocalClimbDraft[]) {
  let stored = [...initial];
  let nextId = 70;
  const repository: LocalPlaylistRepository = {
    create: vi.fn(async (content) => {
      const created = storedPlaylist(content, 1, `00000000-0000-4000-8000-0000000000${nextId++}`);
      stored = [created, ...stored];
      return created;
    }),
    get: vi.fn(async (id) => stored.find((playlist) => playlist.id === id) ?? null),
    list: vi.fn(async () => stored),
    update: vi.fn(async (id, revision, content) => {
      const current = stored.find((playlist) => playlist.id === id);
      if (!current || current.revision !== revision) throw new Error('List changed elsewhere.');
      const updated = storedPlaylist(content, Number(revision) + 1, id);
      stored = [updated, ...stored.filter((playlist) => playlist.id !== id)];
      return updated;
    }),
    delete: vi.fn(async (id, revision) => {
      const current = stored.find((playlist) => playlist.id === id);
      if (!current || current.revision !== revision) throw new Error('List changed elsewhere.');
      stored = stored.filter((playlist) => playlist.id !== id);
    }),
  };
  const draftRepository: LocalDraftRepository = {
    create: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    trash: vi.fn(),
    restore: vi.fn(),
    deletePermanently: vi.fn(),
    purgeExpiredTrash: vi.fn(),
  };

  function Harness() {
    const [playlists, setPlaylists] = useState(initial);
    const refresh = async () => setPlaylists(await repository.list());
    return (
      <PlaylistLibrary
        playlists={playlists}
        localClimbs={localClimbs}
        repository={repository}
        draftRepository={draftRepository}
        installation={installation}
        definition={definition}
        compatibilityIssue={() => null}
        onChanged={(playlist) => {
          if (playlist)
            setPlaylists((values) => [
              playlist,
              ...values.filter((candidate) => candidate.id !== playlist.id),
            ]);
        }}
        onRefresh={refresh}
        onOpenLocalClimb={vi.fn()}
      />
    );
  }

  render(<Harness />);
  return { repository, getStored: () => stored };
}

describe('PlaylistLibrary', () => {
  it('creates, renames, annotates, and permanently deletes a list after confirmation', async () => {
    const { repository } = renderLibrary([], []);
    fireEvent.change(screen.getByLabelText('New list'), { target: { value: 'Weekend projects' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }));
    expect(
      await screen.findByRole('button', { name: /Weekend projects.*0 climbs/ }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('List name'), {
      target: { value: 'Saturday projects' },
    });
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Warm up first.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(repository.update).toHaveBeenCalledOnce());
    expect(repository.update).toHaveBeenCalledWith(
      expect.any(String),
      1,
      expect.objectContaining({ name: 'Saturday projects', notes: 'Warm up first.' }),
    );

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete list' }));
    await waitFor(() => expect(repository.delete).toHaveBeenCalledOnce());
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Member climbs will not be deleted'),
    );
    expect(await screen.findByRole('heading', { name: 'No lists yet' })).toBeInTheDocument();
  });

  it('preserves unavailable entries and exposes named ordering boundaries and removal', async () => {
    const active = climb(ACTIVE_ID, 'Active climb');
    const trashed = climb(TRASHED_ID, 'Trashed climb', true);
    const playlist = storedPlaylist({
      name: 'Mixed list',
      notes: '',
      entries: [
        { kind: 'local', id: ACTIVE_ID },
        { kind: 'local', id: TRASHED_ID },
        { kind: 'local', id: MISSING_ID },
      ],
    });
    const { repository, getStored } = renderLibrary([playlist], [active, trashed]);

    const entries = await screen.findByRole('region', { name: 'Climbs' });
    expect(within(entries).getByText('In Trash')).toBeInTheDocument();
    expect(within(entries).getByText('Missing')).toBeInTheDocument();
    expect(within(entries).getByRole('button', { name: 'View Trashed climb' })).toBeDisabled();
    expect(
      within(entries).getByRole('button', { name: `View Missing local climb ${MISSING_ID}` }),
    ).toBeDisabled();
    expect(within(entries).getByRole('button', { name: 'Move up Active climb' })).toBeDisabled();
    expect(
      within(entries).getByRole('button', { name: `Move down Missing local climb ${MISSING_ID}` }),
    ).toBeDisabled();

    fireEvent.click(within(entries).getByRole('button', { name: 'Move up Trashed climb' }));
    await waitFor(() => expect(repository.update).toHaveBeenCalledOnce());
    expect(getStored()[0]?.entries.map((entry) => entry.kind === 'local' && entry.id)).toEqual([
      TRASHED_ID,
      ACTIVE_ID,
      MISSING_ID,
    ]);

    fireEvent.click(within(entries).getByRole('button', { name: /Remove Missing local climb/ }));
    await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(2));
    expect(getStored()[0]?.entries).toHaveLength(2);
  });

  it('refreshes repository truth and offers retry after a failed mutation', async () => {
    const playlist = storedPlaylist({ name: 'Retry list', notes: '', entries: [] });
    const { repository } = renderLibrary([playlist], []);
    vi.mocked(repository.update)
      .mockRejectedValueOnce(new Error('Storage is busy.'))
      .mockImplementationOnce(async (id, revision, content) =>
        storedPlaylist(content, Number(revision) + 1, id),
      );

    fireEvent.change(await screen.findByLabelText('Notes'), { target: { value: 'Retry me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage is busy.');
    expect(repository.list).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry save list' }));
    await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(2));
  });

  it('disables empty play-through and enters, navigates, switches, and exits without writes', async () => {
    const active = climb(ACTIVE_ID, 'Active climb');
    const trashed = climb(TRASHED_ID, 'Trashed climb', true);
    const empty = storedPlaylist(
      { name: 'Empty list', notes: '', entries: [] },
      1,
      '00000000-0000-4000-8000-000000000062',
    );
    const mixed = storedPlaylist({
      name: 'Mixed list',
      notes: 'Keep the order.',
      entries: [
        { kind: 'local', id: ACTIVE_ID },
        { kind: 'local', id: TRASHED_ID },
      ],
    });
    const { repository } = renderLibrary([mixed, empty], [active, trashed]);

    fireEvent.click(await screen.findByRole('button', { name: 'Play list' }));
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Active climb' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trashed climb' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Empty list.*0 climbs/ }));
    expect(screen.getByLabelText('List name')).toHaveValue('Empty list');
    expect(screen.getByRole('button', { name: 'Play list' })).toBeDisabled();
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Mixed list.*2 climbs/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Play list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exit play-through' }));
    expect(screen.getByLabelText('List name')).toHaveValue('Mixed list');
    expect(screen.getByLabelText('Notes')).toHaveValue('Keep the order.');
  });

  it('opens portable dialogs and restores focus to their triggers when they close', async () => {
    const active = climb(ACTIVE_ID, 'Active climb');
    const playlist = storedPlaylist({
      name: 'Portable list',
      notes: '',
      entries: [{ kind: 'local', id: ACTIVE_ID }],
    });
    renderLibrary([playlist], [active]);

    const share = await screen.findByRole('button', { name: 'Share list' });
    fireEvent.click(share);
    expect(screen.getByRole('heading', { name: 'Share list' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close sharing' }));
    await waitFor(() => expect(share).toHaveFocus());

    const importList = screen.getByRole('button', { name: 'Import list' });
    fireEvent.click(importList);
    expect(screen.getByRole('heading', { name: 'Import list' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close import' }));
    await waitFor(() => expect(importList).toHaveFocus());
  });
});
