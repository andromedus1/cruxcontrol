import { VaultError, type VaultErrorCode } from '../private-vault/contract.ts';
import type { BackupStatus, ProtectedRevision } from './types.ts';

export const INITIAL_BACKUP_STATUS: BackupStatus = Object.freeze({
  phase: 'checking',
  account: null,
  revision: null,
  protectedRevision: null,
  localSaveFailed: false,
  error: null,
});

const ERROR_COPY: Readonly<Record<VaultErrorCode, Readonly<{
  phase: BackupStatus['phase'];
  message: string;
}>>> = Object.freeze({
  'not-configured': { phase: 'not-configured', message: 'Private backup is not configured on this build.' },
  'signed-out': { phase: 'signed-out', message: 'Sign in to back up or recover this library.' },
  'account-changed': { phase: 'discovery', message: 'Your account changed. Review retained backups before continuing.' },
  'not-admitted': { phase: 'discovery', message: 'Review retained backups before backing up this library.' },
  cancelled: { phase: 'signed-out', message: 'Sign-in was cancelled.' },
  offline: { phase: 'offline', message: 'You are offline. Saved changes stay on this phone and can be backed up later.' },
  unavailable: { phase: 'error', message: 'Backup could not be completed. Your saved library remains available.' },
  conflict: { phase: 'discovery', message: 'Backup history changed. Review it before continuing.' },
  missing: { phase: 'discovery', message: 'A retained backup is no longer available. Review backup history before continuing.' },
  'invalid-response': { phase: 'error', message: 'Backup service returned data that could not be verified.' },
  'invalid-backup': { phase: 'error', message: 'This saved backup could not be verified as a library.' },
  'staging-missing': { phase: 'pending', message: 'A saved backup is being checked before it can be retried.' },
});

export function errorStatus(cause: unknown): Readonly<{
  phase: BackupStatus['phase'];
  error: string;
}> {
  if (cause instanceof VaultError) {
    const mapped = ERROR_COPY[cause.code];
    return Object.freeze({ phase: mapped.phase, error: mapped.message });
  }
  return Object.freeze({
    phase: 'error',
    error: 'Backup could not be completed. Your saved library remains available.',
  });
}

export function snapshotStatus(
  phase: BackupStatus['phase'],
  revision: number | null,
  protectedRevision: ProtectedRevision | null,
  account: BackupStatus['account'],
  localSaveFailed: boolean,
  error: string | null = null,
): BackupStatus {
  return Object.freeze({ phase, revision, protectedRevision, account, localSaveFailed, error });
}
