import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { localDraftId } from '../drafts/codec.ts';
import { playlistId, playlistRevision } from './codec.ts';
import { PlaylistMembershipDialog } from './PlaylistMembershipDialog.tsx';
import type { LocalPlaylistRepository } from './repository.ts';
import type { LocalPlaylist } from './types.ts';
import { BackNavigationProvider } from '../app/BackNavigation.tsx';
import { createBackNavigation } from '../app/back-navigation.ts';

const CLIMB_ID = localDraftId('00000000-0000-4000-8000-000000000081');

function playlist(id: string, name: string): LocalPlaylist {
  return {
    schemaVersion: 1,
    id: playlistId(id),
    revision: playlistRevision(1),
    name,
    notes: '',
    entries: [],
    createdAt: '2026-08-02T12:00:00.000Z',
    updatedAt: '2026-08-02T12:00:00.000Z',
  };
}

function renderDialog(initial: readonly LocalPlaylist[]) {
  let stored = [...initial];
  const repository: LocalPlaylistRepository = {
    create: vi.fn(async (content) => {
      const created = {
        ...playlist('00000000-0000-4000-8000-000000000084', content.name),
        ...content,
      };
      stored = [created, ...stored];
      return created;
    }),
    get: vi.fn(),
    list: vi.fn(async () => stored),
    update: vi.fn(async (id, revision, content) => {
      const current = stored.find((candidate) => candidate.id === id)!;
      const updated = {
        ...current,
        ...content,
        revision: playlistRevision(Number(revision) + 1),
      };
      stored = stored.map((candidate) => (candidate.id === id ? updated : candidate));
      return updated;
    }),
    delete: vi.fn(),
  };

  function Harness() {
    const [playlists, setPlaylists] = useState(initial);
    return (
      <PlaylistMembershipDialog
        climbName="Tidal Wave"
        reference={{ kind: 'local', id: CLIMB_ID }}
        playlists={playlists}
        repository={repository}
        onChanged={(changed) =>
          setPlaylists((values) => [
            changed,
            ...values.filter((candidate) => candidate.id !== changed.id),
          ])
        }
        onRefresh={async () => setPlaylists(await repository.list())}
        onClose={vi.fn()}
      />
    );
  }
  render(<Harness />);
  return { repository, getStored: () => stored };
}

describe('PlaylistMembershipDialog', () => {
  it('consumes native Back and visible close until membership write and refresh settle', async () => {
    const first = playlist('00000000-0000-4000-8000-000000000082', 'Projects');
    let finishWrite!: (value: LocalPlaylist) => void;
    let finishRefresh!: () => void;
    const update = vi.fn(() => new Promise<LocalPlaylist>(resolve => { finishWrite = resolve; }));
    const onRefresh = vi.fn(() => new Promise<void>(resolve => { finishRefresh = resolve; }));
    const onClose = vi.fn(), back = createBackNavigation();
    render(<BackNavigationProvider port={back}><PlaylistMembershipDialog climbName="Synthetic" reference={{ kind: 'local', id: CLIMB_ID }} playlists={[first]} repository={{ create: vi.fn(), get: vi.fn(), list: vi.fn(), update, delete: vi.fn() }} onChanged={vi.fn()} onRefresh={onRefresh} onClose={onClose} /></BackNavigationProvider>);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Projects' }));
    fireEvent.click(screen.getByLabelText('Close lists'));
    expect(back.dispatch()).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { finishWrite({ ...first, entries: [{ kind: 'local', id: CLIMB_ID }] }); });
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(back.dispatch()).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { finishRefresh(); });
    expect(back.dispatch()).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('mutates each list independently and permits one climb in multiple lists', async () => {
    const first = playlist('00000000-0000-4000-8000-000000000082', 'Projects');
    const second = playlist('00000000-0000-4000-8000-000000000083', 'Warmups');
    const { repository, getStored } = renderDialog([first, second]);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Projects' }));
    await waitFor(() => expect(repository.update).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Warmups' }));
    await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(2));

    expect(getStored().map((value) => value.entries)).toEqual([
      [{ kind: 'local', id: CLIMB_ID }],
      [{ kind: 'local', id: CLIMB_ID }],
    ]);
    const update = vi.mocked(repository.update);
    expect(update.mock.calls[0]?.[0]).not.toBe(update.mock.calls[1]?.[0]);
  });

  it('creates a list inline with the current climb already included', async () => {
    const { repository, getStored } = renderDialog([]);
    fireEvent.change(screen.getByLabelText('Create list'), { target: { value: 'New circuit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create and add' }));
    await waitFor(() => expect(repository.create).toHaveBeenCalledOnce());
    expect(getStored()[0]).toMatchObject({
      name: 'New circuit',
      entries: [{ kind: 'local', id: CLIMB_ID }],
    });
  });

  it('keeps a failed checkbox mutation local and retryable', async () => {
    const first = playlist('00000000-0000-4000-8000-000000000082', 'Projects');
    const { repository } = renderDialog([first]);
    vi.mocked(repository.update).mockRejectedValueOnce(new Error('Could not save membership.'));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Projects' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save membership.');
    expect(screen.getByRole('checkbox', { name: 'Projects' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Retry adding Projects' }));
    await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('checkbox', { name: 'Projects' })).toBeChecked();
  });
});
