import { useEffect, useMemo, useRef, useState } from 'react';
import type { LocalDraftRepository } from '../drafts/repository.ts';
import type { ConfiguredBoardInstallation } from '../installations/contracts.ts';
import { decodePlaylistFragment, decodePortablePlaylist } from './portable-codec.ts';
import {
  executePlaylistImport,
  planPlaylistImport,
  type PlaylistImportPlan,
  type PlaylistImportResult,
} from './portable-import.ts';
import { MAX_PORTABLE_PLAYLIST_BYTES } from './portable-types.ts';
import type { LocalPlaylistRepository } from './repository.ts';
import './playlists.css';
import {
  browserPlaylistHistoryAdapter,
  clearImportedPlaylistHash,
  type PlaylistHistoryAdapter,
} from './portable-history.ts';

export interface PlaylistImportDialogProps {
  readonly installation: ConfiguredBoardInstallation;
  readonly drafts: LocalDraftRepository;
  readonly playlists: LocalPlaylistRepository;
  readonly initialFragment?: string | null;
  readonly history?: PlaylistHistoryAdapter;
  readonly readFileText?: (file: File) => Promise<string>;
  readonly onImported: (result: PlaylistImportResult) => Promise<void>;
  readonly onRefresh: () => Promise<void>;
  readonly onOperationStart?: () => void;
  readonly onOperationEnd?: () => void;
  readonly onClose: () => void;
}

interface ImportStatus {
  readonly kind: 'progress' | 'success' | 'error';
  readonly message: string;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function browserReadFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the playlist file.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(file);
  });
}

export function PlaylistImportDialog({
  installation,
  drafts,
  playlists,
  initialFragment = null,
  history,
  readFileText = browserReadFileText,
  onImported,
  onRefresh,
  onOperationStart,
  onOperationEnd,
  onClose,
}: PlaylistImportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const handledInitialFragment = useRef(false);
  const importRunning = useRef(false);
  const importCompleted = useRef(false);
  const [plan, setPlan] = useState<PlaylistImportPlan | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [phase, setPhase] = useState<'preview' | 'importing' | 'complete'>('preview');
  const historyAdapter = useMemo(
    () => history ?? browserPlaylistHistoryAdapter(),
    [history],
  );

  function acceptSource(source: unknown, label: string): void {
    const decoded = decodePortablePlaylist(source);
    setPlan(planPlaylistImport(decoded, installation));
    setSourceLabel(label);
    setStatus(null);
    setPhase('preview');
    importCompleted.current = false;
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    if (!initialFragment || handledInitialFragment.current) return;
    handledInitialFragment.current = true;
    try {
      const source = decodePlaylistFragment(initialFragment);
      if (!source) throw new Error('The URL does not contain a playlist payload.');
      const decoded = decodePortablePlaylist(source);
      setPlan(planPlaylistImport(decoded, installation));
      setSourceLabel('Shared link');
      setStatus(null);
      setPhase('preview');
      importCompleted.current = false;
    } catch (error) {
      setPlan(null);
      setSourceLabel('Shared link');
      setStatus({ kind: 'error', message: message(error) });
    }
  }, [initialFragment, installation]);

  function close(): void {
    try {
      clearImportedPlaylistHash(initialFragment, historyAdapter);
    } finally {
      onClose();
    }
  }

  async function chooseFile(file: File): Promise<void> {
    setPlan(null);
    setSourceLabel(file.name);
    setStatus({ kind: 'progress', message: 'Reading playlist file…' });
    onOperationStart?.();
    if (file.size > MAX_PORTABLE_PLAYLIST_BYTES) {
      setStatus({
        kind: 'error',
        message: `Playlist files must not exceed ${MAX_PORTABLE_PLAYLIST_BYTES} bytes.`,
      });
      onOperationEnd?.();
      return;
    }
    try {
      const text = await readFileText(file);
      if (new TextEncoder().encode(text).length > MAX_PORTABLE_PLAYLIST_BYTES) {
        throw new Error(`Playlist files must not exceed ${MAX_PORTABLE_PLAYLIST_BYTES} bytes.`);
      }
      acceptSource(JSON.parse(text) as unknown, file.name);
    } catch (error) {
      setPlan(null);
      setStatus({ kind: 'error', message: message(error) });
    } finally {
      onOperationEnd?.();
    }
  }

  async function confirmImport(): Promise<void> {
    if (!plan || importRunning.current || importCompleted.current) return;
    importRunning.current = true;
    onOperationStart?.();
    setPhase('importing');
    setStatus({ kind: 'progress', message: 'Creating climb copies and list…' });
    let result: PlaylistImportResult;
    try {
      result = await executePlaylistImport(plan, drafts, playlists);
    } catch (error) {
      try {
        await onRefresh();
      } catch {
        // Preserve the complete executor error; the owning workspace reports refresh failure.
      }
      setPhase('preview');
      setStatus({ kind: 'error', message: message(error) });
      importRunning.current = false;
      onOperationEnd?.();
      return;
    }

    importCompleted.current = true;
    setPhase('complete');
    setStatus({ kind: 'success', message: 'List imported' });
    try {
      await onImported(result);
      clearImportedPlaylistHash(initialFragment, historyAdapter);
      onClose();
    } catch (error) {
      clearImportedPlaylistHash(initialFragment, historyAdapter);
      setStatus({
        kind: 'error',
        message: `The list was imported, but the workspace could not refresh: ${message(error)}`,
      });
    } finally {
      importRunning.current = false;
      onOperationEnd?.();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="playlist-portable-dialog"
      aria-labelledby="playlist-import-heading"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={close}
    >
      <header>
        <div>
          <p className="eyebrow">Portable list</p>
          <h2 id="playlist-import-heading">Import list</h2>
        </div>
        <button
          className="playlist-dialog-close"
          type="button"
          aria-label="Close import"
          onClick={close}
        >
          ×
        </button>
      </header>
      <label className="playlist-portable-file">
        Playlist file
        <input
          type="file"
          accept=".cruxplaylist.json,application/json"
          disabled={phase === 'importing' || phase === 'complete'}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) void chooseFile(file);
          }}
        />
      </label>
      <p className="playlist-muted">
        Choose a CruxControl playlist file, or preview the playlist supplied by this page’s share
        link. Nothing is written until you confirm.
      </p>
      {status && (
        <div
          className={status.kind === 'error' ? 'playlist-portable-error' : 'playlist-portable-status'}
          role={status.kind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {status.message}
        </div>
      )}
      {plan && (
        <section className="playlist-import-preview" aria-labelledby="playlist-import-preview-name">
          <p className="eyebrow">Preview · {sourceLabel}</p>
          <h3 id="playlist-import-preview-name">{plan.source.playlist.name}</h3>
          {plan.source.playlist.notes && <p>{plan.source.playlist.notes}</p>}
          <dl>
            <div>
              <dt>New local climb copies</dt>
              <dd>{plan.localCopyCount}</dd>
            </div>
            <div>
              <dt>Provider references</dt>
              <dd>{plan.providerReferenceCount}</dd>
            </div>
            <div>
              <dt>Unresolved here</dt>
              <dd>{plan.unresolvedProviderCount}</dd>
            </div>
          </dl>
          {plan.warnings.length > 0 && (
            <ul className="playlist-import-warnings">
              {plan.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          <p className="playlist-portable-notice">
            Confirming creates a new list and new IDs for every local climb copy. Existing climbs
            and lists are never overwritten.
          </p>
          <div className="playlist-portable-actions">
            {phase === 'complete' ? (
              <button className="button button--primary" type="button" onClick={close}>
                Close imported list
              </button>
            ) : (
              <button
                className="button button--primary"
                type="button"
                disabled={phase === 'importing'}
                onClick={() => void confirmImport()}
              >
                {status?.kind === 'error' ? 'Retry import' : 'Import as new list'}
              </button>
            )}
            <button
              className="button button--secondary"
              type="button"
              disabled={phase === 'importing'}
              onClick={close}
            >
              Cancel
            </button>
          </div>
        </section>
      )}
    </dialog>
  );
}
