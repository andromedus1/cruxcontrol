import { useEffect, useRef, useState } from 'react';
import type { LocalPlaylistRepository } from './repository.ts';
import { playlistReferenceKey } from './codec.ts';
import type { LocalPlaylist, PlaylistClimbReference } from './types.ts';
import './playlists.css';

interface MembershipState {
  readonly target: boolean;
  readonly status: 'saving' | 'saved' | 'error';
  readonly message: string;
}

export interface PlaylistMembershipDialogProps {
  readonly climbName: string;
  readonly reference: PlaylistClimbReference;
  readonly playlists: readonly LocalPlaylist[];
  readonly repository: LocalPlaylistRepository;
  readonly onChanged: (playlist: LocalPlaylist) => void;
  readonly onRefresh: () => Promise<void>;
  readonly onClose: () => void;
}

function hasReference(playlist: LocalPlaylist, reference: PlaylistClimbReference): boolean {
  const key = playlistReferenceKey(reference);
  return playlist.entries.some((entry) => playlistReferenceKey(entry) === key);
}

export function PlaylistMembershipDialog({
  climbName,
  reference,
  playlists,
  repository,
  onChanged,
  onRefresh,
  onClose,
}: PlaylistMembershipDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const playlistsRef = useRef(playlists);
  const [membership, setMembership] = useState<Record<string, MembershipState>>({});
  const [newName, setNewName] = useState('');
  const [createState, setCreateState] = useState('');
  const [createFailed, setCreateFailed] = useState(false);

  playlistsRef.current = playlists;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  async function refreshTruth() {
    try {
      await onRefresh();
    } catch {
      // The owning workspace reports refresh failures; retain the mutation error here.
    }
  }

  async function changeMembership(id: LocalPlaylist['id'], target: boolean) {
    const key = String(id);
    setMembership((state) => ({
      ...state,
      [key]: { target, status: 'saving', message: target ? 'Adding…' : 'Removing…' },
    }));
    try {
      const playlist = playlistsRef.current.find((candidate) => candidate.id === id);
      if (!playlist) throw new Error('This list is no longer available.');
      const referenceKey = playlistReferenceKey(reference);
      const entries = target
        ? hasReference(playlist, reference)
          ? playlist.entries
          : [...playlist.entries, reference]
        : playlist.entries.filter((entry) => playlistReferenceKey(entry) !== referenceKey);
      const updated = await repository.update(playlist.id, playlist.revision, {
        name: playlist.name,
        notes: playlist.notes,
        entries,
      });
      onChanged(updated);
      setMembership((state) => ({
        ...state,
        [key]: { target, status: 'saved', message: 'Saved' },
      }));
      await refreshTruth();
    } catch (cause) {
      await refreshTruth();
      setMembership((state) => ({
        ...state,
        [key]: {
          target,
          status: 'error',
          message: cause instanceof Error ? cause.message : 'Could not update this list.',
        },
      }));
    }
  }

  async function createList() {
    const name = newName.trim();
    if (!name) {
      setCreateState('Enter a list name.');
      setCreateFailed(true);
      return;
    }
    setCreateState('Creating…');
    setCreateFailed(false);
    try {
      const created = await repository.create({ name, notes: '', entries: [reference] });
      onChanged(created);
      setNewName('');
      setCreateState('Created and added');
      setCreateFailed(false);
      await refreshTruth();
    } catch (cause) {
      await refreshTruth();
      setCreateState(cause instanceof Error ? cause.message : 'Could not create the list.');
      setCreateFailed(true);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="playlist-membership-dialog"
      aria-labelledby="playlist-membership-heading"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <header>
        <div>
          <p className="eyebrow">{climbName}</p>
          <h2 id="playlist-membership-heading">Add to lists</h2>
        </div>
        <button
          className="playlist-dialog-close"
          type="button"
          aria-label="Close lists"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      {playlists.length === 0 ? (
        <p className="playlist-muted">
          No lists yet. Create one below and this climb will be added.
        </p>
      ) : (
        <ul className="membership-list">
          {playlists.map((playlist) => {
            const state = membership[String(playlist.id)];
            const checked =
              state?.status === 'saving' ? state.target : hasReference(playlist, reference);
            return (
              <li key={playlist.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={state?.status === 'saving'}
                    onChange={(event) =>
                      void changeMembership(playlist.id, event.currentTarget.checked)
                    }
                  />
                  <span>{playlist.name}</span>
                </label>
                <span
                  className={
                    state?.status === 'error' ? 'playlist-inline-error' : 'playlist-save-state'
                  }
                  role={state?.status === 'error' ? 'alert' : 'status'}
                >
                  {state?.message}
                </span>
                {state?.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => void changeMembership(playlist.id, state.target)}
                  >
                    Retry {state.target ? 'adding' : 'removing'} {playlist.name}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="playlist-inline-create"
        onSubmit={(event) => {
          event.preventDefault();
          void createList();
        }}
      >
        <label htmlFor="membership-new-list">Create list</label>
        <div>
          <input
            id="membership-new-list"
            value={newName}
            onChange={(event) => setNewName(event.currentTarget.value)}
            placeholder="List name"
          />
          <button
            className="button button--primary"
            type="submit"
            disabled={createState === 'Creating…'}
          >
            Create and add
          </button>
        </div>
        <p
          className={createFailed ? 'playlist-inline-error' : 'playlist-save-state'}
          role={createFailed ? 'alert' : 'status'}
        >
          {createState}
        </p>
        {createFailed && (
          <button type="button" onClick={() => void createList()}>
            Retry create list
          </button>
        )}
      </form>
    </dialog>
  );
}
