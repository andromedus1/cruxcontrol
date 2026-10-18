import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useBackAction } from '../app/use-back-action.ts';
import type { LibraryRestoreOutcome } from '../library-backup/service.ts';
import type { AutomaticBackup } from './coordinator.ts';
import type { OnlineBackupReview } from './types.ts';
import type { VaultListing, VaultSnapshot } from '../private-vault/types.ts';
import './automatic-backup.css';

export interface BackupManageDialogProps {
  readonly automaticBackup: AutomaticBackup;
  readonly localCounts: Readonly<{ climbs: number; lists: number }>;
  readonly recoveryBlockReason: string | null;
  readonly onClose: () => void;
  readonly onPortableBackup: () => void;
  readonly onRestored: () => Promise<void>;
  readonly onRecoveryBusyChange: (busy: boolean) => void;
}

type BusyAction = 'connect' | 'sign-out' | 'history' | 'review' | 'restore' | 'adopt' | 'retry' | 'refresh' | null;

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? date.toLocaleString() : 'Date unavailable';
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} bytes`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function copyCounts(snapshot: VaultSnapshot): string {
  const { climbs, playlists, trash } = snapshot.counts;
  return `${climbs} ${climbs === 1 ? 'climb' : 'climbs'} · ${playlists} ${playlists === 1 ? 'list' : 'lists'} · ${trash} in Trash`;
}

function restoreCounts(outcome: Extract<LibraryRestoreOutcome, { status: 'complete' }>): string {
  return `${outcome.drafts.added} climbs and ${outcome.playlists.added} lists added. `
    + `${outcome.drafts.unchanged} climbs and ${outcome.playlists.unchanged} lists were already here, unchanged.`;
}

export function BackupManageDialog({
  automaticBackup,
  localCounts,
  recoveryBlockReason,
  onClose,
  onPortableBackup,
  onRestored,
  onRecoveryBusyChange,
}: BackupManageDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  const operationPending = useRef(false);
  const recoveryCommitting = useRef(false);
  const autoLoadedAccount = useRef<string | null>(null);
  const status = useSyncExternalStore(
    automaticBackup.subscribe,
    automaticBackup.getSnapshot,
    automaticBackup.getSnapshot,
  );
  const [listing, setListing] = useState<VaultListing | null>(null);
  const [selected, setSelected] = useState<VaultSnapshot | null>(null);
  const [review, setReview] = useState<OnlineBackupReview | null>(null);
  const [outcome, setOutcome] = useState<LibraryRestoreOutcome | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [feedback, setFeedback] = useState('');
  const [refreshFailed, setRefreshFailed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      generation.current += 1;
      onRecoveryBusyChange(false);
    };
  }, [onRecoveryBusyChange]);

  const close = useCallback(() => {
    if (recoveryCommitting.current) return;
    generation.current += 1;
    onClose();
  }, [onClose]);
  useBackAction(close);

  const loadHistory = useCallback(async (announce = true) => {
    if (operationPending.current) return;
    operationPending.current = true;
    const currentGeneration = ++generation.current;
    setBusy('history');
    setFeedback('');
    try {
      const result = await automaticBackup.history();
      if (currentGeneration !== generation.current) return;
      setListing(result);
      setSelected(null);
      setReview(null);
      if (announce) setFeedback('Backup history refreshed.');
    } catch {
      if (currentGeneration !== generation.current) return;
      setFeedback('Backup history could not be loaded. Check the backup status above and try again.');
    } finally {
      if (currentGeneration === generation.current) {
        operationPending.current = false;
        setBusy(null);
      }
    }
  }, [automaticBackup]);

  useEffect(() => {
    const uid = status.account?.uid ?? null;
    if (!uid) {
      autoLoadedAccount.current = null;
      return;
    }
    if (autoLoadedAccount.current === uid || listing || busy) return;
    autoLoadedAccount.current = uid;
    void loadHistory(false);
  }, [status.account?.uid, listing, busy, loadHistory]);

  async function runSimple(action: Exclude<BusyAction, 'history' | 'review' | 'restore' | 'refresh' | null>) {
    if (operationPending.current) return;
    operationPending.current = true;
    const currentGeneration = ++generation.current;
    setBusy(action);
    setFeedback('');
    try {
      if (action === 'connect') await automaticBackup.signIn();
      else if (action === 'sign-out') await automaticBackup.signOut();
      else await automaticBackup.retry();
      if (currentGeneration !== generation.current) return;
      if (action === 'sign-out') {
        setListing(null);
        setSelected(null);
        setReview(null);
        setFeedback('Signed out. Retained backups remain saved to this account.');
      }
    } finally {
      if (currentGeneration === generation.current) {
        operationPending.current = false;
        setBusy(null);
      }
    }
  }

  async function reviewCopy(snapshot: VaultSnapshot) {
    if (operationPending.current) return;
    operationPending.current = true;
    const currentGeneration = ++generation.current;
    setBusy('review');
    setSelected(snapshot);
    setReview(null);
    setOutcome(null);
    setFeedback('Checking the retained copy…');
    try {
      const result = await automaticBackup.review(snapshot);
      if (currentGeneration !== generation.current) return;
      setReview(result);
      setFeedback('Copy checked against the library on this phone.');
    } catch {
      if (currentGeneration !== generation.current) return;
      setReview(null);
      setFeedback('This copy could not be checked. Refresh backup history and review it again.');
    } finally {
      if (currentGeneration === generation.current) {
        operationPending.current = false;
        setBusy(null);
      }
    }
  }

  async function refreshLibraryView(
    currentGeneration: number,
    restored: LibraryRestoreOutcome | null = outcome,
  ) {
    setBusy('refresh');
    setFeedback('Recovery is saved. Refreshing the library…');
    try {
      await onRestored();
      if (currentGeneration !== generation.current) return;
      setRefreshFailed(false);
      if (restored?.status === 'failed' && restored.phase === 'verification') {
        setFeedback('Recovery is saved, but verification is incomplete. Authoring and backup remain paused until it is checked.');
      } else {
        setFeedback('Recovery complete. Saved records and list order are available in the library.');
      }
    } catch {
      if (currentGeneration !== generation.current) return;
      setRefreshFailed(true);
      setFeedback('Recovery is saved, but the library view could not refresh. Retry the refresh; recovery will not be repeated.');
    }
  }

  async function restoreCopy() {
    if (operationPending.current || !review || !selected || recoveryBlockReason
      || review.review.conflicts.length > 0
      || (review.review.add.climbs === 0 && review.review.add.playlists === 0)) return;
    operationPending.current = true;
    const currentGeneration = ++generation.current;
    setBusy('restore');
    recoveryCommitting.current = true;
    onRecoveryBusyChange(true);
    setOutcome(null);
    setFeedback('Saving the reviewed copy…');
    try {
      const result = await automaticBackup.restore(review);
      if (currentGeneration !== generation.current) return;
      setOutcome(result);
      if (result.status === 'blocked') {
        setReview((current) => current ? { ...current, review: result.review } : current);
        setFeedback('Recovery paused because saved records changed. Nothing was added. Review the current library again.');
      } else if (result.status === 'failed' && result.phase === 'verification') {
        await refreshLibraryView(currentGeneration, result);
      } else if (result.status === 'complete') {
        await refreshLibraryView(currentGeneration, result);
      } else if (result.status === 'failed') {
        setFeedback(result.phase === 'preflight'
          ? 'Recovery could not start. No records were added. Check backup status and review the copy again.'
          : 'Recovery did not finish. Keep the retained copy and review it again before retrying.');
      }
    } finally {
      if (currentGeneration === generation.current) {
        operationPending.current = false;
        recoveryCommitting.current = false;
        setBusy(null);
        onRecoveryBusyChange(false);
      }
    }
  }

  async function retryRefresh() {
    if (operationPending.current || !refreshFailed) return;
    operationPending.current = true;
    const currentGeneration = ++generation.current;
    setBusy('refresh');
    await refreshLibraryView(currentGeneration);
    if (currentGeneration === generation.current) {
      operationPending.current = false;
      setBusy(null);
    }
  }

  async function adoptLocalLibrary() {
    if (operationPending.current || recoveryBlockReason) return;
    operationPending.current = true;
    const currentGeneration = ++generation.current;
    setBusy('adopt');
    setFeedback('Checking retained backup history…');
    try {
      await automaticBackup.useLocalLibrary();
      if (currentGeneration !== generation.current) return;
      let adoptedStatus = automaticBackup.getSnapshot();
      if (adoptedStatus.phase === 'discovery' || adoptedStatus.phase === 'recovery-required') {
        setFeedback(adoptedStatus.error ?? 'Backup history still needs review. This phone’s library was not admitted.');
        return;
      }
      setListing(null);
      setReview(null);
      setSelected(null);
      setFeedback('This phone’s saved library is now selected. Retained backups were kept.');
      try {
        const updated = await automaticBackup.history();
        if (currentGeneration !== generation.current) return;
        setListing(updated);
        adoptedStatus = automaticBackup.getSnapshot();
        if (adoptedStatus.phase === 'discovery' || adoptedStatus.phase === 'recovery-required') {
          setFeedback(adoptedStatus.error ?? 'Backup history changed. Review retained copies before continuing.');
        }
      } catch {
        // The coordinator publishes safe status copy; local admission remains explicit.
      }
    } catch {
      if (currentGeneration !== generation.current) return;
      setFeedback('This phone’s library was not admitted. Review backup status and retained history before trying again.');
    } finally {
      if (currentGeneration === generation.current) {
        operationPending.current = false;
        setBusy(null);
      }
    }
  }

  const locked = busy !== null;
  const dismissLocked = recoveryCommitting.current;
  const noChanges = Boolean(review && review.review.add.climbs === 0 && review.review.add.playlists === 0);
  const conflicts = review?.review.conflicts ?? [];
  const statusDetail = status.error ?? (status.phase === 'protected'
    ? 'The saved library has a verified online copy.'
    : status.phase === 'uploading'
      ? 'Checking a new online copy before marking it protected.'
      : status.phase === 'verifying-recovery'
        ? 'Backup and authoring remain paused while local records are verified.'
        : 'Saved climbs and lists remain available on this phone.');
  const capacity = listing?.capacity ?? null;
  const freeSlots = capacity ? Math.max(0, capacity.slots - listing!.snapshots.length) : null;

  return (
    <dialog
      ref={dialogRef}
      className="automatic-backup-manage"
      aria-labelledby="automatic-backup-manage-heading"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClose={close}
    >
      <header>
        <div>
          <p className="eyebrow">Your local library</p>
          <h2 id="automatic-backup-manage-heading">Private backup</h2>
        </div>
        <button type="button" aria-label="Close private backup" onClick={close} disabled={dismissLocked}>×</button>
      </header>

      <section className="automatic-backup-manage__section" aria-labelledby="automatic-backup-account-heading">
        <h3 id="automatic-backup-account-heading">Account and status</h3>
        <div className="automatic-backup-manage__state" data-tone={status.phase === 'protected' ? 'success' : status.phase === 'error' || status.localSaveFailed ? 'danger' : 'warning'}>
          <strong>{status.phase === 'protected' ? 'Online copy checked' : status.phase === 'recovery-required' ? 'Recovery available' : status.phase === 'capacity' ? 'Online copies are full' : status.phase === 'offline' ? 'Offline' : status.phase === 'verifying-recovery' ? 'Checking recovered library' : 'Saved on this phone'}</strong>
          <p role="status" aria-live="polite">{statusDetail}</p>
          {status.protectedRevision && <small>Last checked {formatDate(status.protectedRevision.verifiedAt)} · {copyCounts(status.protectedRevision.snapshot)}.</small>}
          {status.localSaveFailed && <p role="alert">A recent local save did not finish. Check the current climb or list before continuing.</p>}
        </div>
        <div className="automatic-backup-manage__identity">
          <p>{status.account ? status.account.email ? `Connected as ${status.account.email}` : 'Private account connected.' : 'No private backup account connected.'}</p>
          {status.account
            ? <button className="button button--secondary" type="button" disabled={locked} onClick={() => void runSimple('sign-out')}>Sign out</button>
            : <button className="button button--primary" type="button" disabled={locked || status.phase === 'not-configured'} onClick={() => void runSimple('connect')}>Connect account</button>}
        </div>
        {status.phase === 'not-configured' && <p>This build does not have private backup access. You can still save or recover a portable file.</p>}
        {status.phase === 'verifying-recovery' && <button className="button button--secondary" type="button" disabled={locked} onClick={() => void runSimple('retry')}>{busy === 'retry' ? 'Checking…' : 'Retry local verification'}</button>}
        {status.account && status.phase !== 'protected' && status.phase !== 'checking' && status.phase !== 'uploading' && status.phase !== 'verifying-recovery' && <button className="button button--secondary" type="button" disabled={locked} onClick={() => void runSimple('retry')}>{busy === 'retry' ? 'Checking…' : 'Retry online backup'}</button>}
      </section>

      <section className="automatic-backup-manage__section" aria-labelledby="automatic-backup-library-heading">
        <h3 id="automatic-backup-library-heading">This phone</h3>
        <dl className="automatic-backup-manage__facts">
          <div><dt>Saved climbs, including Trash</dt><dd>{localCounts.climbs}</dd></div>
          <div><dt>Saved lists</dt><dd>{localCounts.lists}</dd></div>
        </dl>
        <p>Automatic online backup checks saved changes while the app is open and online. It does not promise background uploads. A portable backup file remains available.</p>
        <button className="button button--secondary" type="button" disabled={dismissLocked} onClick={onPortableBackup}>Save or recover a backup file</button>
      </section>

      {status.account && <section className="automatic-backup-manage__section" aria-labelledby="automatic-backup-history-heading">
        <div className="automatic-backup-manage__identity">
          <h3 id="automatic-backup-history-heading">Retained copies</h3>
          <button className="button button--secondary" type="button" disabled={locked} onClick={() => void loadHistory(true)}>{busy === 'history' ? 'Checking…' : 'Refresh history'}</button>
        </div>
        {capacity && <p>{freeSlots} of {capacity.slots} backup copies available. Each copy can be up to {formatBytes(capacity.bytesPerSlot)}. Full storage pauses new copies; CruxControl keeps the existing history.</p>}
        {!listing && <p>{busy === 'history' ? 'Checking retained copies…' : 'Connect or refresh to check retained copies.'}</p>}
        {listing?.snapshots.length === 0 && <p>No online copies are stored for this account.</p>}
        {listing && listing.snapshots.length > 0 && <ul className="automatic-backup-manage__versions" aria-label="Retained backup history">
          {[...listing.snapshots].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map((snapshot) => (
            <li className="automatic-backup-manage__version" key={`${snapshot.slot}:${snapshot.generation}`}>
              <h4>Saved {formatDate(snapshot.createdAt)}</h4>
              <p>{formatBytes(snapshot.bytes)}</p>
              <button className="button button--secondary" type="button" disabled={locked} aria-label={`Review backup saved ${formatDate(snapshot.createdAt)}`} onClick={() => void reviewCopy(snapshot)}>
                {busy === 'review' && selected?.slot === snapshot.slot ? 'Checking copy…' : 'Review this copy'}
              </button>
            </li>
          ))}
        </ul>}
        {(status.phase === 'discovery' || status.phase === 'recovery-required') && listing && listing.snapshots.length > 0 && <div className="automatic-backup-manage__notice">
          <strong>Choose which saved library this phone should use.</strong>
          <p>Review an online copy before recovering it. Choosing this phone keeps its saved records and all retained copies.</p>
        </div>}
        {listing && <div className="automatic-backup-manage__actions">
          <button className="button button--secondary" type="button" disabled={locked || Boolean(recoveryBlockReason)} onClick={() => void adoptLocalLibrary()}>
            {busy === 'adopt' ? 'Checking history…' : 'Use this phone’s library'}
          </button>
          {recoveryBlockReason && <p className="automatic-backup-manage__blocking">{recoveryBlockReason}</p>}
        </div>}
      </section>}

      {review && selected && <section className="automatic-backup-manage__review" aria-labelledby="automatic-backup-review-heading">
        <h3 id="automatic-backup-review-heading">Review recovery</h3>
        <p>Server copy saved {formatDate(selected.createdAt)} · backup date {formatDate(review.backup.exportedAt)}. The original remains retained.</p>
        <dl>
          <div><dt>Climbs in copy</dt><dd>{review.backup.drafts.length}</dd></div>
          <div><dt>Climbs in Trash</dt><dd>{review.review.trashClimbs}</dd></div>
          <div><dt>Lists in copy</dt><dd>{review.backup.playlists.length}</dd></div>
          <div><dt>Climbs to add</dt><dd>{review.review.add.climbs}</dd></div>
          <div><dt>Lists to add</dt><dd>{review.review.add.playlists}</dd></div>
          <div><dt>Already here, unchanged</dt><dd>{review.review.unchanged.climbs} climbs · {review.review.unchanged.playlists} lists</dd></div>
        </dl>
        {review.review.unavailableLocalReferences > 0 && <p className="automatic-backup-manage__notice">{review.review.unavailableLocalReferences} local list reference{review.review.unavailableLocalReferences === 1 ? ' is' : 's are'} unavailable and will be preserved.</p>}
        {conflicts.length > 0 && <div className="automatic-backup-manage__conflicts">
          <strong>Recovery is paused. Nothing was added.</strong>
          <p>These identities exist on this phone with different contents. Both versions remain unchanged.</p>
          <ul>{conflicts.map((conflict) => <li key={`${conflict.kind}:${conflict.id}`}><strong>{conflict.name}</strong><span>{conflict.kind === 'climb' ? 'Climb' : 'List'} · saved version differs</span></li>)}</ul>
        </div>}
        {noChanges && conflicts.length === 0 && <p className="automatic-backup-manage__notice">Everything in this copy is already here. Nothing needs to be restored.</p>}
        <div className="automatic-backup-manage__actions">
          <button className="button button--secondary" type="button" disabled={locked} onClick={() => void reviewCopy(selected)}>Review again</button>
          {review.review.add.climbs + review.review.add.playlists > 0 && conflicts.length === 0 && <button className="button button--primary" type="button" disabled={locked || Boolean(recoveryBlockReason) || status.phase === 'verifying-recovery'} onClick={() => void restoreCopy()}>
            {busy === 'restore' ? 'Saving recovery…' : `Restore ${review.review.add.climbs} climbs and ${review.review.add.playlists} lists`}
          </button>}
          {recoveryBlockReason && <p className="automatic-backup-manage__blocking">{recoveryBlockReason}</p>}
        </div>
      </section>}

      {feedback && <p className="automatic-backup-manage__feedback" role="status" aria-live="polite">{feedback}</p>}
      {outcome && <section className="automatic-backup-manage__result" aria-live="polite">
        <h3>{outcome.status === 'complete' ? 'Recovery saved' : outcome.status === 'failed' && outcome.phase === 'verification' ? 'Recovery saved; verification pending' : outcome.status === 'blocked' ? 'Recovery paused' : 'Recovery needs another step'}</h3>
        {outcome.status === 'complete' && <p>{restoreCounts(outcome)}</p>}
        {outcome.status === 'failed' && outcome.phase === 'verification' && <p>{outcome.drafts.added} climbs and {outcome.playlists.added} lists were saved. Verification remains pending; authoring and online backup are paused.</p>}
        {outcome.status === 'failed' && outcome.phase !== 'verification' && <p>No new recovery was confirmed. Keep this retained copy and review again before trying another recovery.</p>}
        {refreshFailed && <button className="button button--secondary" type="button" disabled={locked} onClick={() => void retryRefresh()}>Retry library refresh</button>}
      </section>}

      <footer>
        <button className="button button--secondary" type="button" onClick={close} disabled={dismissLocked}>Close</button>
      </footer>
    </dialog>
  );
}
