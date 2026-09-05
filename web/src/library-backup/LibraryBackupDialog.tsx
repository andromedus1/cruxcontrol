import { useEffect, useRef, useState } from 'react';
import { decodeLibraryBackup, LIBRARY_BACKUP_LIMITS } from './codec.ts';
import type { BackupReview, DecodedLibraryBackup } from './types.ts';
import { LibraryBackupService } from './service.ts';
import './library-backup.css';

export interface LibraryBackupDialogProps {
  readonly service: LibraryBackupService;
  readonly onClose: () => void;
  readonly onRestored: () => Promise<void>;
  readonly readFileText?: (file: File) => Promise<string>;
  readonly createObjectUrl?: (blob: Blob) => string;
  readonly revokeObjectUrl?: (url: string) => void;
}

type Phase = 'idle' | 'exporting' | 'reading' | 'review' | 'restoring' | 'complete' | 'blocked' | 'failed' | 'refresh-failed';

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

const readBrowserFile = (file: File) => file.text();
const createBrowserObjectUrl = (blob: Blob) => URL.createObjectURL(blob);
const revokeBrowserObjectUrl = (url: string) => URL.revokeObjectURL(url);

export function LibraryBackupDialog({
  service,
  onClose,
  onRestored,
  readFileText = readBrowserFile,
  createObjectUrl = createBrowserObjectUrl,
  revokeObjectUrl = revokeBrowserObjectUrl,
}: LibraryBackupDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [backup, setBackup] = useState<DecodedLibraryBackup | null>(null);
  const [review, setReview] = useState<BackupReview | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileDate, setFileDate] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      generation.current += 1;
    };
  }, []);

  function close(): void {
    if (phase === 'reading' || phase === 'restoring') return;
    generation.current += 1;
    onClose();
  }

  async function chooseFile(file: File): Promise<void> {
    if (phase === 'reading' || phase === 'restoring') return;
    if (file.size > LIBRARY_BACKUP_LIMITS.bytes) {
      setError(`This backup is larger than the supported ${Math.round(LIBRARY_BACKUP_LIMITS.bytes / (1024 * 1024))} MiB limit.`);
      setPhase('idle');
      return;
    }
    const currentGeneration = ++generation.current;
    setPhase('reading');
    setError('');
    setStatus('Reading backup…');
    try {
      const text = await readFileText(file);
      if (currentGeneration !== generation.current) return;
      const decoded = decodeLibraryBackup(text);
      const nextReview = await service.review(decoded);
      if (currentGeneration !== generation.current) return;
      setBackup(decoded);
      setReview(nextReview);
      setFileName(file.name);
      setFileDate(decoded.exportedAt);
      setStatus('');
      setPhase('review');
    } catch (cause) {
      if (currentGeneration !== generation.current) return;
      setStatus('');
      setError(errorMessage(cause));
      setPhase('idle');
    }
  }

  async function refreshAfterRestore(): Promise<void> {
    try {
      await onRestored();
      setPhase('complete');
      setStatus('');
    } catch (cause) {
      setPhase('refresh-failed');
      setError(errorMessage(cause));
      setStatus('');
    }
  }

  async function restore(): Promise<void> {
    if (!backup || phase !== 'review' || !review || review.conflicts.length > 0) return;
    setPhase('restoring');
    setError('');
    setStatus('Saving recovery…');
    try {
      const outcome = await service.restore(backup);
      if (outcome.status === 'blocked') {
        setReview(outcome.review);
        setPhase('blocked');
        setStatus('');
        return;
      }
      if (outcome.status === 'failed') {
        setError(outcome.error.message);
        setPhase('failed');
        setStatus('');
        return;
      }
      setStatus(
        `${outcome.drafts.added} climbs and ${outcome.playlists.added} playlists saved.`,
      );
      await refreshAfterRestore();
    } catch (cause) {
      setError(errorMessage(cause));
      setPhase('failed');
      setStatus('');
    }
  }

  async function retryReview(): Promise<void> {
    if (!backup || phase === 'restoring' || phase === 'reading') return;
    setPhase('reading');
    setError('');
    setStatus('Reviewing current library…');
    try {
      const nextReview = await service.review(backup);
      setReview(nextReview);
      setPhase('review');
      setStatus('');
    } catch (cause) {
      setError(errorMessage(cause));
      setPhase('failed');
      setStatus('');
    }
  }

  function download(): void {
    if (busy || backup) return;
    const currentGeneration = generation.current;
    setPhase('exporting');
    setError('');
    setStatus('Preparing backup…');
    try {
      const file = service.exportFile();
      void file.then(({ filename, text }) => {
        const url = createObjectUrl(new Blob([text], { type: 'application/json' }));
        try {
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.click();
          if (currentGeneration === generation.current) {
            setPhase('idle');
            setStatus('Backup download started');
          }
        } finally {
          revokeObjectUrl(url);
        }
      }).catch((cause) => {
        if (currentGeneration === generation.current) {
          setPhase('idle');
          setStatus('');
          setError(errorMessage(cause));
        }
      });
    } catch (cause) {
      setPhase('idle');
      setStatus('');
      setError(errorMessage(cause));
    }
  }

  const busy = phase === 'exporting' || phase === 'reading' || phase === 'restoring';
  const noOp = Boolean(review && review.add.climbs === 0 && review.add.playlists === 0 && review.conflicts.length === 0);

  return (
    <dialog
      ref={dialogRef}
      className="library-backup-dialog"
      aria-labelledby="library-backup-heading"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={close}
    >
      <header>
        <div>
          <p className="eyebrow">Your local library</p>
          <h2 id="library-backup-heading">Back up &amp; restore</h2>
        </div>
        <button type="button" aria-label="Close backup and restore" onClick={close} disabled={busy}>×</button>
      </header>
      <section className="library-backup-section">
        <h3>Download a backup</h3>
        <p>Keep an independent copy of saved climbs, Trash, playlists, memberships and animation settings.</p>
        <button className="button button--primary" type="button" disabled={busy || Boolean(backup)} onClick={download}>Download library backup</button>
      </section>
      <section className="library-backup-section">
        <h3>Recover from a file</h3>
        <p>Review the contents first. Recovery adds missing records and keeps their original identities.</p>
        <label className="library-backup-file" htmlFor="library-backup-file">Library backup file</label>
        <input
          id="library-backup-file"
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) void chooseFile(file);
          }}
        />
        <p className="library-backup-help">Up to 25 MiB. Finish edits in other tabs before downloading. Only saved library contents are included.</p>
      </section>
      {status && <p className="library-backup-status" role="status" aria-live="polite">{status}</p>}
      {error && phase !== 'refresh-failed' && <div className="library-backup-error" role="alert"><strong>Backup and restore needs attention.</strong><p>{error}</p><button type="button" disabled={busy} onClick={() => { setError(''); setReview(null); setBackup(null); setPhase('idle'); }}>Choose another file</button></div>}
      {review && (phase === 'review' || phase === 'blocked' || phase === 'failed' || phase === 'restoring') && (
        <section className="library-backup-review" aria-labelledby="library-backup-review-heading">
          <h3 id="library-backup-review-heading">Review recovery</h3>
          {fileName && <p className="library-backup-file-name">{fileName}</p>}
          {fileDate && <p>Saved {new Date(fileDate).toLocaleString()}</p>}
          <dl>
            <div><dt>Climbs in backup</dt><dd>{backup?.drafts.length ?? 0}</dd></div>
            <div><dt>Climbs in Trash</dt><dd>{review.trashClimbs}</dd></div>
            <div><dt>Playlists in backup</dt><dd>{backup?.playlists.length ?? 0}</dd></div>
            <div><dt>Climbs to add</dt><dd>{review.add.climbs}</dd></div>
            <div><dt>Playlists to add</dt><dd>{review.add.playlists}</dd></div>
            <div><dt>Already here, unchanged</dt><dd>{review.unchanged.climbs} climbs · {review.unchanged.playlists} playlists</dd></div>
          </dl>
          {review.unavailableLocalReferences > 0 && <p className="library-backup-notice">{review.unavailableLocalReferences} local playlist reference{review.unavailableLocalReferences === 1 ? '' : 's'} is unavailable. It will be preserved.</p>}
          {review.conflicts.length > 0 && <div className="library-backup-conflicts"><strong>Recovery is paused. Nothing was added.</strong><p>These identities exist here with different contents. Your current records and backup remain intact.</p><ul>{review.conflicts.map((conflict) => <li key={`${conflict.kind}:${conflict.id}`}><strong>{conflict.name}</strong><span>{conflict.kind === 'climb' ? 'Climb' : 'Playlist'} · saved version differs</span><details><summary>Show identity</summary><code>{conflict.id}</code></details></li>)}</ul></div>}
          {noOp && <p className="library-backup-notice">Everything in this backup is already here.</p>}
          {phase === 'review' && <div className="library-backup-actions"><button className="button button--secondary" type="button" disabled={busy} onClick={() => void retryReview()}>Review again</button>{!noOp && review.conflicts.length === 0 && <button className="button button--primary" type="button" onClick={() => void restore()}>Add {review.add.climbs} climbs &amp; {review.add.playlists} playlists</button>}</div>}
          {phase === 'blocked' && <div className="library-backup-actions"><button className="button button--secondary" type="button" onClick={() => void retryReview()}>Review and retry</button></div>}
        </section>
      )}
      {phase === 'complete' && <section className="library-backup-result"><h3>Recovery complete</h3><p>Recovery saved. Your saved records, memberships, recipes and Trash dates are preserved.</p></section>}
      {phase === 'refresh-failed' && <section className="library-backup-result"><h3>Recovery saved</h3><p>The library view could not refresh.</p>{error && <p role="alert">{error}</p>}<button className="button button--secondary" type="button" onClick={() => void refreshAfterRestore()}>Retry refresh</button></section>}
      {phase === 'failed' && backup && <section className="library-backup-result"><h3>Recovery needs another step</h3><p>Some records may have been saved. Keep this file and review it again after checking device storage or other tabs.</p><button className="button button--primary" type="button" disabled={busy} onClick={() => void retryReview()}>Review and retry</button></section>}
      <footer><button className="button button--secondary" type="button" onClick={close} disabled={busy}>Close</button></footer>
    </dialog>
  );
}
