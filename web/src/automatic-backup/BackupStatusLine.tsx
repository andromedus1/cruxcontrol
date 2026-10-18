import { useSyncExternalStore, type Ref } from 'react';
import type { AutomaticBackup } from './coordinator.ts';
import type { BackupStatus } from './types.ts';
import './automatic-backup.css';

function checkedCopy(status: BackupStatus): string | null {
  const protection = status.protectedRevision;
  if (!protection) return null;
  const date = new Date(protection.verifiedAt);
  const checked = Number.isFinite(date.valueOf()) ? date.toLocaleString() : 'recently';
  return `Last checked ${checked} · ${protection.snapshot.counts.climbs} climbs and ${protection.snapshot.counts.playlists} lists.`;
}

function statusCopy(status: BackupStatus): Readonly<{ title: string; detail: string }> {
  const previous = checkedCopy(status);
  if (status.localSaveFailed) {
    return { title: 'A recent save did not finish', detail: 'Check the current climb or list and try saving again.' };
  }
  switch (status.phase) {
    case 'protected':
      return { title: 'All saved changes backed up', detail: previous ?? 'The current library has a verified online copy.' };
    case 'checking':
      return { title: 'Saved on this phone', detail: 'Checking this phone’s online backup status.' };
    case 'pending':
      return { title: 'Saved on this phone', detail: status.error ?? 'New changes are waiting for an online backup.' };
    case 'uploading':
      return { title: 'Saved on this phone', detail: 'Checking a new online copy before marking it backed up.' };
    case 'offline':
      return { title: 'Saved on this phone', detail: `Offline changes wait here.${previous ? ` ${previous}` : ''}` };
    case 'signed-out':
      return { title: 'Saved on this phone', detail: `Sign in to back up or recover this library.${previous ? ` ${previous}` : ''}` };
    case 'not-configured':
      return { title: 'Saved on this phone', detail: 'Online backup is unavailable on this build. A backup file is still available.' };
    case 'discovery':
      return { title: 'Review backup history', detail: status.error ?? 'Choose which saved library this phone should use.' };
    case 'recovery-required':
      return { title: 'Backups are available to recover', detail: status.error ?? 'Review an online copy before continuing.' };
    case 'capacity':
      return { title: 'Online backup storage is full', detail: status.error ?? 'Earlier copies are retained. Save a backup file while online copies are paused.' };
    case 'verifying-recovery':
      return { title: 'Checking recovered library', detail: status.error ?? 'Backup and authoring remain paused until this check finishes.' };
    case 'error':
      return { title: 'Saved on this phone', detail: `${status.error ?? 'Online backup needs attention.'}${previous ? ` ${previous}` : ''}` };
  }
}

export function BackupStatusLine({
  automaticBackup,
  onManage,
  manageButtonRef,
}: {
  readonly automaticBackup: AutomaticBackup;
  readonly onManage: () => void;
  readonly manageButtonRef?: Ref<HTMLButtonElement>;
}) {
  const status = useSyncExternalStore(
    automaticBackup.subscribe,
    automaticBackup.getSnapshot,
    automaticBackup.getSnapshot,
  );
  const copy = statusCopy(status);
  return (
    <section className="automatic-backup-status" aria-label="Private backup status">
      <div className="automatic-backup-status__copy" role="status" aria-live="polite">
        <strong>{copy.title}</strong>
        <small>{copy.detail}</small>
      </div>
      <button ref={manageButtonRef} className="button button--secondary" type="button" onClick={onManage}>
        Manage
      </button>
    </section>
  );
}
