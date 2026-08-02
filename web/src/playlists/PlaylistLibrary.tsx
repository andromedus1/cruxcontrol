import { useEffect, useRef, useState } from 'react';
import type { BoardLightController } from '../board-control/light-controller.ts';
import type { LocalClimbDraft, LocalDraftId } from '../drafts/types.ts';
import type { BoardDefinition } from '../domain/boards/definition.ts';
import { playlistReferenceKey } from './codec.ts';
import { PlaylistPlayThrough } from './PlaylistPlayThrough.tsx';
import type { LocalPlaylistRepository } from './repository.ts';
import { resolvePlaylistEntries, type ResolvedPlaylistEntry } from './resolve.ts';
import type { LocalPlaylist, PlaylistId } from './types.ts';
import './playlists.css';

interface RetryState {
  readonly message: string;
  readonly label: string;
  readonly run: () => Promise<void>;
}

export interface PlaylistLibraryProps {
  readonly playlists: readonly LocalPlaylist[];
  readonly localClimbs: readonly LocalClimbDraft[];
  readonly repository: LocalPlaylistRepository;
  readonly definition: BoardDefinition;
  readonly controller?: BoardLightController | null;
  readonly compatibilityIssue: (draft: LocalClimbDraft) => string | null;
  readonly onChanged: (playlist: LocalPlaylist | null) => void;
  readonly onRefresh: () => Promise<void>;
  readonly onOpenLocalClimb: (id: LocalDraftId) => void;
}

function entryLabel(entry: ResolvedPlaylistEntry): string {
  const name = entry.climb?.name.trim();
  if (name) return name;
  if (entry.reference.kind === 'local') return `Missing local climb ${entry.reference.id}`;
  return `${entry.reference.id.provider} climb ${entry.reference.id.sourceId}`;
}

export function PlaylistLibrary({
  playlists,
  localClimbs,
  repository,
  definition,
  controller,
  compatibilityIssue,
  onChanged,
  onRefresh,
  onOpenLocalClimb,
}: PlaylistLibraryProps) {
  const playlistsRef = useRef(playlists);
  const [selectedId, setSelectedId] = useState<PlaylistId | null>(playlists[0]?.id ?? null);
  const [newName, setNewName] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [playingId, setPlayingId] = useState<PlaylistId | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<RetryState | null>(null);
  playlistsRef.current = playlists;

  const selected = playlists.find(({ id }) => id === selectedId) ?? null;
  useEffect(() => {
    if (!selectedId || !playlists.some(({ id }) => id === selectedId)) {
      setSelectedId(playlists[0]?.id ?? null);
    }
  }, [playlists, selectedId]);
  useEffect(() => {
    setName(selected?.name ?? '');
    setNotes(selected?.notes ?? '');
    setStatus('');
  }, [selected?.id, selected?.name, selected?.notes]);
  useEffect(() => {
    if (playingId && (!selected || selected.id !== playingId || selected.entries.length === 0)) {
      setPlayingId(null);
    }
  }, [playingId, selected]);

  async function refreshTruth() {
    try {
      await onRefresh();
    } catch {
      // The owning workspace exposes loading failures in its global error banner.
    }
  }

  async function mutate(label: string, action: () => Promise<void>) {
    setStatus(`${label}…`);
    setError(null);
    try {
      await action();
      await refreshTruth();
      setStatus('Saved');
    } catch (cause) {
      await refreshTruth();
      setStatus('');
      setError({
        message: cause instanceof Error ? cause.message : `Could not ${label.toLowerCase()}.`,
        label: `Retry ${label.toLowerCase()}`,
        run: () => mutate(label, action),
      });
    }
  }

  function currentPlaylist(id: PlaylistId): LocalPlaylist {
    const playlist = playlistsRef.current.find((candidate) => candidate.id === id);
    if (!playlist) throw new Error('This list is no longer available.');
    return playlist;
  }

  async function createList() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError({ message: 'Enter a list name.', label: 'Retry create list', run: createList });
      return;
    }
    await mutate('Create list', async () => {
      const created = await repository.create({ name: trimmed, notes: '', entries: [] });
      onChanged(created);
      setSelectedId(created.id);
      setNewName('');
    });
  }

  function saveMetadata(id: PlaylistId, nextName: string, nextNotes: string) {
    const trimmed = nextName.trim();
    if (!trimmed) {
      setError({
        message: 'List name cannot be empty.',
        label: 'Retry save list',
        run: () => saveMetadata(id, nextName, nextNotes),
      });
      return Promise.resolve();
    }
    return mutate('Save list', async () => {
      const playlist = currentPlaylist(id);
      onChanged(
        await repository.update(playlist.id, playlist.revision, {
          name: trimmed,
          notes: nextNotes,
          entries: playlist.entries,
        }),
      );
    });
  }

  function moveEntry(id: PlaylistId, entryKey: string, delta: -1 | 1) {
    return mutate(delta < 0 ? 'Move entry up' : 'Move entry down', async () => {
      const playlist = currentPlaylist(id);
      const index = playlist.entries.findIndex((entry) => playlistReferenceKey(entry) === entryKey);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= playlist.entries.length) return;
      const entries = [...playlist.entries];
      [entries[index], entries[target]] = [entries[target]!, entries[index]!];
      onChanged(
        await repository.update(playlist.id, playlist.revision, {
          name: playlist.name,
          notes: playlist.notes,
          entries,
        }),
      );
    });
  }

  function removeEntry(id: PlaylistId, entryKey: string) {
    return mutate('Remove entry', async () => {
      const playlist = currentPlaylist(id);
      onChanged(
        await repository.update(playlist.id, playlist.revision, {
          name: playlist.name,
          notes: playlist.notes,
          entries: playlist.entries.filter((entry) => playlistReferenceKey(entry) !== entryKey),
        }),
      );
    });
  }

  function deleteList(id: PlaylistId, listName: string) {
    if (!window.confirm(`Delete “${listName}” permanently? Member climbs will not be deleted.`)) {
      return;
    }
    void mutate('Delete list', async () => {
      const playlist = currentPlaylist(id);
      await repository.delete(playlist.id, playlist.revision);
      onChanged(null);
    });
  }

  const resolved = selected ? resolvePlaylistEntries(selected, localClimbs) : [];
  const localById = new Map(localClimbs.map((climb) => [climb.id, climb]));
  const resolvedCompatibilityIssue = (entry: ResolvedPlaylistEntry) => {
    if (entry.availability !== 'available' || entry.reference.kind !== 'local') return null;
    const local = localById.get(entry.reference.id);
    return local ? compatibilityIssue(local) : null;
  };
  const playing = Boolean(selected && selected.id === playingId && resolved.length > 0);

  return (
    <section
      className={`playlist-library${playing ? ' playlist-library--playing' : ''}`}
      aria-labelledby="playlist-library-heading"
    >
      <aside className="playlist-selector">
        <header>
          <div>
            <p className="eyebrow">Fullride 7×10</p>
            <h1 id="playlist-library-heading">Lists</h1>
          </div>
        </header>
        <form
          className="playlist-create"
          onSubmit={(event) => {
            event.preventDefault();
            void createList();
          }}
        >
          <label htmlFor="playlist-new-name">New list</label>
          <div>
            <input
              id="playlist-new-name"
              value={newName}
              onChange={(event) => setNewName(event.currentTarget.value)}
              placeholder="Weekend projects"
            />
            <button className="button button--primary" type="submit">
              Create list
            </button>
          </div>
        </form>
        {playlists.length === 0 ? (
          <section className="playlist-empty">
            <p aria-hidden="true">≡</p>
            <h2>No lists yet</h2>
            <p>Create a list, then add Draft or Finished climbs from climb details.</p>
          </section>
        ) : (
          <ul className="playlist-selector-list">
            {playlists.map((playlist) => (
              <li key={playlist.id}>
                <button
                  type="button"
                  aria-current={selected?.id === playlist.id ? 'true' : undefined}
                  onClick={() => {
                    setPlayingId(null);
                    setSelectedId(playlist.id);
                  }}
                >
                  <strong>{playlist.name}</strong>
                  <span>
                    {playlist.entries.length} {playlist.entries.length === 1 ? 'climb' : 'climbs'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <div className="playlist-editor">
        {error && (
          <div className="playlist-error" role="alert">
            <p>{error.message}</p>
            <button type="button" onClick={() => void error.run()}>
              {error.label}
            </button>
          </div>
        )}
        {selected && playing ? (
          <PlaylistPlayThrough
            playlist={selected}
            entries={resolved}
            definition={definition}
            controller={controller}
            compatibilityIssue={resolvedCompatibilityIssue}
            onExit={() => setPlayingId(null)}
          />
        ) : selected ? (
          <>
            <form
              className="playlist-metadata"
              onSubmit={(event) => {
                event.preventDefault();
                void saveMetadata(selected.id, name, notes);
              }}
            >
              <label htmlFor="playlist-name">List name</label>
              <input
                id="playlist-name"
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
              />
              <label htmlFor="playlist-notes">Notes</label>
              <textarea
                id="playlist-notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.currentTarget.value)}
              />
              <div className="playlist-metadata-actions">
                <span role="status" aria-live="polite">
                  {status}
                </span>
                <button className="button button--secondary" type="submit">
                  Save changes
                </button>
                <button
                  className="button button--primary"
                  type="button"
                  disabled={resolved.length === 0}
                  onClick={() => setPlayingId(selected.id)}
                >
                  Play list
                </button>
                <button
                  className="button button--destructive"
                  type="button"
                  onClick={() => deleteList(selected.id, selected.name)}
                >
                  Delete list
                </button>
              </div>
            </form>
            <section className="playlist-entries" aria-labelledby="playlist-entries-heading">
              <header>
                <h2 id="playlist-entries-heading">Climbs</h2>
                <span>{resolved.length}</span>
              </header>
              {resolved.length === 0 ? (
                <p className="playlist-muted">
                  This list is empty. Open a Draft or Finished climb and choose Add to lists.
                </p>
              ) : (
                <ol>
                  {resolved.map((entry, index) => {
                    const label = entryLabel(entry);
                    const local =
                      entry.reference.kind === 'local'
                        ? localById.get(entry.reference.id)
                        : undefined;
                    const localId = entry.reference.kind === 'local' ? entry.reference.id : null;
                    const issue = local ? compatibilityIssue(local) : null;
                    const unavailable = entry.availability !== 'available' || issue !== null;
                    const availability =
                      entry.availability === 'trashed'
                        ? 'In Trash'
                        : entry.availability === 'missing'
                          ? 'Missing'
                          : issue
                            ? 'Unavailable here'
                            : 'Available';
                    return (
                      <li key={entry.key}>
                        <div className="playlist-entry-copy">
                          <strong>{label}</strong>
                          <span
                            className={`playlist-availability playlist-availability--${unavailable ? 'unavailable' : 'available'}`}
                          >
                            {availability}
                          </span>
                          {issue && <span className="playlist-entry-detail">{issue}.</span>}
                          {!entry.climb && (
                            <span className="playlist-entry-detail">Reference: {entry.key}</span>
                          )}
                        </div>
                        <div className="playlist-entry-actions">
                          {localId && (
                            <button
                              type="button"
                              disabled={unavailable}
                              onClick={() => onOpenLocalClimb(localId)}
                            >
                              View {label}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => void moveEntry(selected.id, entry.key, -1)}
                          >
                            Move up {label}
                          </button>
                          <button
                            type="button"
                            disabled={index === resolved.length - 1}
                            onClick={() => void moveEntry(selected.id, entry.key, 1)}
                          >
                            Move down {label}
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeEntry(selected.id, entry.key)}
                          >
                            Remove {label} from list
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </>
        ) : (
          <section className="playlist-no-selection">
            <p>Create a list to collect climbs for a project, circuit, or session.</p>
          </section>
        )}
      </div>
    </section>
  );
}
