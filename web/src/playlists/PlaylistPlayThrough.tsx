import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BoardLightController } from '../board-control/light-controller.ts';
import { ClimbDetail } from '../climb-browser/ClimbDetail.tsx';
import type { LocalDraftId } from '../drafts/types.ts';
import type { BoardDefinition } from '../domain/boards/definition.ts';
import type { ResolvedPlaylistEntry } from './resolve.ts';
import type { LocalPlaylist, PlaylistId } from './types.ts';
import '../climb-browser/LocalClimbViewer.css';
import './playlists.css';
import { useBackAction } from '../app/use-back-action.ts';

export interface PlaylistPlayThroughProps {
  readonly playlist: LocalPlaylist;
  readonly entries: readonly ResolvedPlaylistEntry[];
  readonly definition: BoardDefinition;
  readonly controller?: BoardLightController | null;
  readonly compatibilityIssue: (entry: ResolvedPlaylistEntry) => string | null;
  readonly onExit: () => void;
  readonly initialEntryKey?: string;
  readonly onEditLocalClimb?: (id: LocalDraftId, entryKey: string) => void;
}

interface PlayThroughPosition {
  readonly playlistId: PlaylistId;
  readonly key: string | null;
  readonly index: number;
}

function entryLabel(entry: ResolvedPlaylistEntry): string {
  const name = entry.climb?.name.trim();
  if (name) return name;
  if (entry.reference.kind === 'local') return `Missing local climb ${entry.reference.id}`;
  return `${entry.reference.id.provider} climb ${entry.reference.id.sourceId}`;
}

function unavailableReason(entry: ResolvedPlaylistEntry, issue: string | null): string {
  if (entry.availability === 'trashed') {
    return 'This climb is in Trash. Restore it before viewing or lighting it.';
  }
  if (entry.availability === 'missing') {
    return entry.reference.kind === 'local'
      ? 'This local climb is missing. Its list position is preserved until you remove it.'
      : 'This provider climb is not installed or could not be resolved on this device.';
  }
  return issue ? `This climb ${issue}.` : 'This climb is unavailable on the active board.';
}

export function PlaylistPlayThrough({
  playlist,
  entries,
  definition,
  controller,
  compatibilityIssue,
  onExit,
  initialEntryKey,
  onEditLocalClimb,
}: PlaylistPlayThroughProps) {
  useBackAction(onExit, true, 20);
  const previousRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const pendingFocus = useRef<'previous' | 'next' | null>(null);
  const [position, setPosition] = useState<PlayThroughPosition>(() => ({
    playlistId: playlist.id,
    key: initialEntryKey ?? entries[0]?.key ?? null,
    index: 0,
  }));

  const playlistChanged = position.playlistId !== playlist.id;
  const keyedIndex = playlistChanged ? -1 : entries.findIndex(({ key }) => key === position.key);
  const currentIndex =
    entries.length === 0
      ? -1
      : playlistChanged
        ? 0
        : keyedIndex >= 0
          ? keyedIndex
          : Math.min(position.index, entries.length - 1);
  const current = currentIndex >= 0 ? (entries[currentIndex] ?? null) : null;

  useEffect(() => {
    const key = current?.key ?? null;
    if (
      position.playlistId !== playlist.id ||
      position.key !== key ||
      position.index !== Math.max(currentIndex, 0)
    ) {
      setPosition({ playlistId: playlist.id, key, index: Math.max(currentIndex, 0) });
    }
  }, [current?.key, currentIndex, playlist.id, position]);

  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    const target = pendingFocus.current === 'previous' ? previousRef.current : nextRef.current;
    pendingFocus.current = null;
    if (target && !target.disabled) target.focus();
    else statusRef.current?.focus();
  }, [currentIndex, entries.length]);

  const move = (index: number, source: HTMLButtonElement) => {
    const entry = entries[index];
    if (!entry) return;
    if (document.activeElement === source) {
      if (index === 0) pendingFocus.current = 'next';
      else if (index === entries.length - 1) pendingFocus.current = 'previous';
    }
    setPosition({ playlistId: playlist.id, key: entry.key, index });
  };

  const issue = current?.availability === 'available' ? compatibilityIssue(current) : null;
  const available = Boolean(current?.climb && current.availability === 'available' && !issue);
  const headingId = `playlist-play-through-${playlist.id}`;

  return (
    <section className="playlist-play-through" aria-labelledby={headingId}>
      <header className="playlist-play-through__header">
        <div>
          <p className="eyebrow">Playing list</p>
          <h1 id={headingId}>{playlist.name}</h1>
        </div>
        <button className="button button--secondary" type="button" onClick={onExit}>
          Exit play-through
        </button>
      </header>
      {current ? (
        <>
          <nav className="playlist-play-through__navigation" aria-label="Playlist navigation">
            <p ref={statusRef} tabIndex={-1} role="status" aria-live="polite" aria-atomic="true">
              <span>{currentIndex + 1} of {entries.length}</span> — {entryLabel(current)}
            </p>
            <button
              ref={previousRef}
              className="button button--secondary"
              type="button"
              disabled={currentIndex === 0}
              onClick={(event) => move(currentIndex - 1, event.currentTarget)}
            >
              Previous
            </button>
            <button
              ref={nextRef}
              className="button button--secondary"
              type="button"
              disabled={currentIndex === entries.length - 1}
              onClick={(event) => move(currentIndex + 1, event.currentTarget)}
            >
              Next
            </button>
          </nav>
          {available && current.climb ? (
            <div className="playlist-play-through__climb" key={current.key}>
              <ClimbDetail
                definition={definition}
                climb={current.climb}
                controller={controller}
                showBoardControls={false}
                headingLevel={2}
                onEdit={current.reference.kind === 'local' && onEditLocalClimb
                  ? () => {
                      if (current.reference.kind === 'local') onEditLocalClimb(current.reference.id, current.key);
                    }
                  : undefined}
              />
            </div>
          ) : (
            <article className="playlist-play-through__unavailable" key={current.key}>
              <p className="eyebrow">Unavailable climb</p>
              <h2>{entryLabel(current)}</h2>
              <p className="playlist-play-through__reference">Reference: {current.key}</p>
              <p>{unavailableReason(current, issue)}</p>
            </article>
          )}
        </>
      ) : (
        <div className="playlist-play-through__unavailable">
          <h2>This list is empty</h2>
          <p>Exit play-through to add a climb.</p>
        </div>
      )}
    </section>
  );
}
