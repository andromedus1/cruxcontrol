import { useEffect, useMemo, useRef, useState } from 'react';
import type { LocalClimbDraft } from '../drafts/types.ts';
import {
  createPortablePlaylist,
  playlistFile,
  playlistShareUrl,
} from './portable-export.ts';
import {
  browserPlaylistTransportAdapters,
  canSharePlaylist,
  copyPlaylistLink,
  downloadPlaylistFile,
  sharePlaylist,
  type PlaylistTransportAdapters,
} from './portable-transports.ts';
import type { LocalPlaylist } from './types.ts';
import './playlists.css';

export interface PlaylistShareDialogProps {
  readonly playlist: LocalPlaylist;
  readonly localClimbs: readonly LocalClimbDraft[];
  readonly baseUrl?: URL;
  readonly transports?: PlaylistTransportAdapters;
  readonly onClose: () => void;
}

interface ShareStatus {
  readonly kind: 'progress' | 'success' | 'cancelled' | 'error';
  readonly message: string;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function PlaylistShareDialog({
  playlist,
  localClimbs,
  baseUrl,
  transports,
  onClose,
}: PlaylistShareDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const adapters = useMemo(
    () => transports ?? browserPlaylistTransportAdapters(),
    [transports],
  );
  const prepared = useMemo(() => {
    try {
      const portable = createPortablePlaylist(playlist, localClimbs);
      const file = playlistFile(portable);
      const url = playlistShareUrl(
        baseUrl ?? new URL(globalThis.location?.href ?? 'https://cruxcontrol.local/'),
        portable,
      );
      const linkShare: ShareData | null = url
        ? { title: playlist.name, text: `CruxControl list: ${playlist.name}`, url: url.href }
        : null;
      const fileShare: ShareData = {
        title: playlist.name,
        text: `CruxControl list: ${playlist.name}`,
        files: [file],
      };
      let webShare: ShareData | null = null;
      try {
        if (linkShare && canSharePlaylist(linkShare, adapters)) webShare = linkShare;
        else if (canSharePlaylist(fileShare, adapters)) webShare = fileShare;
      } catch {
        webShare = null;
      }
      return { portable, file, url, webShare, error: null };
    } catch (error) {
      return { portable: null, file: null, url: null, webShare: null, error };
    }
  }, [adapters, baseUrl, localClimbs, playlist]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  async function run(
    progress: string,
    success: string,
    action: () => Promise<void>,
    cancellationMessage?: string,
  ): Promise<void> {
    setStatus({ kind: 'progress', message: progress });
    try {
      await action();
      setStatus({ kind: 'success', message: success });
    } catch (error) {
      if (cancellationMessage && (error instanceof Error || error instanceof DOMException) && error.name === 'AbortError') {
        setStatus({ kind: 'cancelled', message: cancellationMessage });
      } else {
        setStatus({ kind: 'error', message: message(error) });
      }
    }
  }

  const localCount =
    prepared.portable?.playlist.entries.filter(({ kind }) => kind === 'local-snapshot').length ?? 0;
  const providerCount =
    prepared.portable?.playlist.entries.filter(({ kind }) => kind === 'provider').length ?? 0;

  return (
    <dialog
      ref={dialogRef}
      className="playlist-portable-dialog"
      aria-labelledby="playlist-share-heading"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <header>
        <div>
          <p className="eyebrow">{playlist.name}</p>
          <h2 id="playlist-share-heading">Share list</h2>
        </div>
        <button
          className="playlist-dialog-close"
          type="button"
          aria-label="Close sharing"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      {prepared.error ? (
        <div className="playlist-portable-error" role="alert">
          <strong>This list cannot be exported yet.</strong>
          <p>{message(prepared.error)}</p>
        </div>
      ) : (
        <>
          <p className="playlist-muted">
            The shared payload contains {localCount} local climb{' '}
            {localCount === 1 ? 'copy' : 'copies'} and {providerCount} provider{' '}
            {providerCount === 1 ? 'reference' : 'references'}. It does not contain your local IDs,
            revisions, installation, or Trash state.
          </p>
          {prepared.url ? (
            <label className="playlist-portable-link">
              Share link
              <textarea
                readOnly
                rows={3}
                value={prepared.url.href}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
          ) : (
            <p className="playlist-portable-notice">
              This list is too large for a reliable link. Download or share the complete file.
            </p>
          )}
          <div className="playlist-portable-actions">
            {prepared.url && (
              <button
                className="button button--secondary"
                type="button"
                onClick={() =>
                  void run('Copying link…', 'Link copied', () =>
                    copyPlaylistLink(prepared.url!, adapters),
                  )
                }
              >
                Copy link
              </button>
            )}
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                try {
                  downloadPlaylistFile(prepared.file!, adapters);
                  setStatus({ kind: 'success', message: 'Download started' });
                } catch (error) {
                  setStatus({ kind: 'error', message: message(error) });
                }
              }}
            >
              Download file
            </button>
            {prepared.webShare && (
              <button
                className="button button--primary"
                type="button"
                onClick={() =>
                  void run('Opening share…', 'Share completed',
                    () => sharePlaylist(prepared.webShare!, adapters),
                    'Sharing cancelled',
                  )
                }
              >
                Share with another app
              </button>
            )}
          </div>
          <p
            className={status?.kind === 'error' ? 'playlist-inline-error' : 'playlist-save-state'}
            role={status?.kind === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {status?.message}
          </p>
        </>
      )}
    </dialog>
  );
}
