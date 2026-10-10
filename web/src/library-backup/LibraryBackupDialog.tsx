import { useEffect, useRef, useState } from 'react';
import { decodeLibraryBackup, LIBRARY_BACKUP_LIMITS } from './codec.ts';
import type { BackupReview, DecodedLibraryBackup } from './types.ts';
import { browserLibraryBackupDelivery, type LibraryBackupDelivery } from './delivery.ts';
import { LibraryBackupService, type LibraryRestoreOutcome } from './service.ts';
import './library-backup.css';

export interface LibraryBackupDialogProps {
  readonly service: LibraryBackupService;
  readonly onClose: () => void;
  readonly onRestored: () => Promise<void>;
  readonly readFileText?: (file: File) => Promise<string>;
  readonly delivery?: LibraryBackupDelivery;
}

type Phase = 'idle' | 'exporting' | 'export-failed' | 'reading' | 'review' | 'restoring' | 'complete' | 'blocked' | 'failed' | 'refresh-failed' | 'refreshing';

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

const readBrowserFile = (file: File) => file.text();

export function LibraryBackupDialog({
  service,
  onClose,
  onRestored,
  readFileText = readBrowserFile,
  delivery = browserLibraryBackupDelivery,
}: LibraryBackupDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  const operationPending = useRef(false);
  const deliveryAbort = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [backup, setBackup] = useState<DecodedLibraryBackup | null>(null);
  const [review, setReview] = useState<BackupReview | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileDate, setFileDate] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<LibraryRestoreOutcome | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      generation.current += 1;
      deliveryAbort.current?.abort();
    };
  }, []);

  function close(): void {
    if (operationPending.current) return;
    generation.current += 1;
    onClose();
  }

  async function chooseFile(file: File): Promise<void> {
    if (operationPending.current) return;
    const currentGeneration = ++generation.current;
    setBackup(null);
    setReview(null);
    setResult(null);
    setError('');
    setStatus('');
    if (file.size > LIBRARY_BACKUP_LIMITS.bytes) {
      setError('This backup is larger than the supported 25 MiB limit.');
      setPhase('idle');
      return;
    }
    setPhase('reading');
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

  // Both callers hold the operation guard until this promise settles. Storage
  // completion remains recorded even if refreshing the view fails afterward.
  async function refreshAfterRestore(currentGeneration: number): Promise<void> {
    setPhase('refreshing');
    setError('');
    setStatus('Refreshing your library…');
    try {
      await onRestored();
      if (currentGeneration !== generation.current) return;
      setPhase('complete');
      setStatus('');
    } catch (cause) {
      if (currentGeneration !== generation.current) return;
      setPhase('refresh-failed');
      setError(errorMessage(cause));
      setStatus('');
    }
  }

  async function retryRefresh(): Promise<void> {
    if (operationPending.current || phase !== 'refresh-failed') return;
    operationPending.current = true;
    try {
      await refreshAfterRestore(generation.current);
    } finally {
      operationPending.current = false;
    }
  }

  async function restore(): Promise<void> {
    if (operationPending.current || !backup || phase !== 'review' || !review || review.conflicts.length > 0) return;
    operationPending.current = true;
    const currentGeneration = ++generation.current;
    setPhase('restoring');
    setError('');
    setResult(null);
    setStatus('Saving recovery…');
    try {
      const outcome = await service.restore(backup);
      if (currentGeneration !== generation.current) return;
      setResult(outcome);
      if (outcome.status === 'blocked') {
        setReview(outcome.review);
        setPhase('blocked');
        setStatus('');
      } else if (outcome.status === 'failed') {
        setError(outcome.error.message);
        setPhase('failed');
        setStatus('');
      } else {
        await refreshAfterRestore(currentGeneration);
      }
    } catch (cause) {
      if (currentGeneration !== generation.current) return;
      setError(errorMessage(cause));
      setPhase('failed');
      setStatus('');
    } finally {
      operationPending.current = false;
    }
  }

  async function retryReview(): Promise<void> {
    if (!backup || operationPending.current || phase === 'reading') return;
    const currentGeneration = ++generation.current;
    setPhase('reading');
    setError('');
    setStatus('Reviewing current library…');
    try {
      const nextReview = await service.review(backup);
      if (currentGeneration !== generation.current) return;
      setReview(nextReview);
      setResult(null);
      setPhase('review');
      setStatus('');
    } catch (cause) {
      if (currentGeneration !== generation.current) return;
      setError(errorMessage(cause));
      setPhase('failed');
      setStatus('');
    }
  }

  async function download(): Promise<void> {
    if (operationPending.current || phase === 'reading' || backup) return;
    operationPending.current = true;
    const currentGeneration = ++generation.current;
    setPhase('exporting');
    setError('');
    setStatus(delivery.kind === 'share'
      ? 'Preparing backup and opening share options…'
      : delivery.kind === 'save'
        ? 'Preparing backup and opening the file picker…'
        : 'Preparing backup…');
    try {
      const file = await service.exportFile();
      if (currentGeneration !== generation.current) return;
      const controller = new AbortController();
      deliveryAbort.current = controller;
      const outcome = await delivery.deliver(file, controller.signal);
      if (currentGeneration !== generation.current) return;
      setPhase('idle');
      const message = outcome.status === 'saved'
        ? 'Backup file saved to the chosen location. Confirm it is available there; remote retention is not verified.'
        : outcome.status === 'shared'
          ? 'Backup handed off to the chosen destination. Check that it retained the file.'
          : outcome.status === 'cancelled'
            ? 'Backup export canceled.'
            : 'Backup download started';
      setStatus(outcome.warning ? `${message} ${outcome.warning}` : message);
    } catch (cause) {
      if (currentGeneration !== generation.current) return;
      setPhase('export-failed');
      setStatus('');
      setError(errorMessage(cause));
    } finally {
      deliveryAbort.current = null;
      operationPending.current = false;
    }
  }

  const busy = phase === 'exporting' || phase === 'restoring' || phase === 'refreshing';
  const nativeDelivery = delivery.kind !== 'download';
  const saveFile = delivery.kind === 'save';

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
        <h3>{nativeDelivery ? 'Save a backup' : 'Download a backup'}</h3>
        <p>Keep an independent copy of saved climbs, Trash, playlists, memberships and animation settings.</p>
        {delivery.kind === 'share' && <p className="library-backup-help">Choose a destination in the share sheet. Check that it received the file before relying on an off-device copy.</p>}
        {saveFile && <p className="library-backup-help">Choose where to save the file. CruxControl cannot verify that a cloud destination retained it.</p>}
        <button className="button button--primary" type="button" disabled={busy || phase === 'reading' || Boolean(backup)} onClick={() => void download()}>{saveFile ? 'Save library backup file' : nativeDelivery ? 'Save or share library backup' : 'Download library backup'}</button>
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
      {error && phase !== 'refresh-failed' && phase !== 'failed' && <div className="library-backup-error" role="alert"><strong>Backup and restore needs attention.</strong><p>{error}</p>{phase === 'export-failed'
        ? <button type="button" disabled={busy} onClick={() => void download()}>Try export again</button>
        : <button type="button" disabled={busy} onClick={() => { generation.current += 1; setError(''); setStatus(''); setReview(null); setResult(null); setBackup(null); setPhase('idle'); }}>Choose another file</button>}</div>}
      {review && (phase === 'review' || phase === 'blocked' || phase === 'restoring') && (
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
      {result?.status === 'complete' && <section className="library-backup-result">
        <h3>{phase === 'complete' ? 'Recovery complete' : 'Recovery saved'}</h3>
        <p>{result.drafts.added} climbs and {result.playlists.added} playlists were added. {result.drafts.unchanged} climbs and {result.playlists.unchanged} playlists were already here, unchanged.</p>
        {phase === 'complete' && <p>Your saved records, memberships, recipes and Trash dates are preserved.</p>}
        {(phase === 'refresh-failed' || phase === 'refreshing') && <>
          <p>{phase === 'refreshing' ? 'Refreshing the library view…' : 'The library view could not refresh.'}</p>
          {error && <p role="alert">{error}</p>}
          <button className="button button--secondary" type="button" disabled={busy} onClick={() => void retryRefresh()}>Retry refresh</button>
        </>}
      </section>}
      {phase === 'failed' && backup && <section className="library-backup-result">
        <h3>Recovery needs another step</h3>
        {result?.status === 'failed' ? <p>{result.phase === 'preflight'
          ? 'Recovery could not start. No records were added.'
          : result.phase === 'drafts'
            ? 'No records were added. Climb recovery failed before committing; playlists were not changed.'
            : `${result.drafts?.added ?? 0} climbs were added and ${result.drafts?.unchanged ?? 0} existing climbs were unchanged. No playlists were added.`}</p>
          : <p>Recovery did not finish. Review this file again to check the current library.</p>}
        {error && <p role="alert">{error}</p>}
        <p>Keep this file. Review and retry after checking device storage or other tabs; records already recovered will be recognized.</p>
        <button className="button button--primary" type="button" disabled={busy} onClick={() => void retryReview()}>Review and retry</button>
      </section>}
      <footer><button className="button button--secondary" type="button" onClick={close} disabled={busy}>Close</button></footer>
    </dialog>
  );
}
