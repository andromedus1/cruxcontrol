import {
  decodeVaultSnapshot,
  validateStagedBackup,
  VAULT_SLOT_PATTERN,
} from '../private-vault/contract.ts';
import type {
  BackupControl,
  PendingBackup,
  PreservationRecord,
  ProtectedRevision,
  RecoveryVerification,
  VaultBinding,
} from './types.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const DEFAULT_CONTROL: BackupControl = Object.freeze({
  binding: null,
  admission: 'discovery',
  history: Object.freeze([]),
  pending: null,
  protected: null,
});

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid preservation ${label}`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`Invalid preservation ${label}`);
  }
}

function safeInteger(value: unknown, label: string, positive = false): number {
  if (!Number.isSafeInteger(value) || (value as number) < (positive ? 1 : 0)) {
    throw new Error(`Invalid preservation ${label}`);
  }
  return value as number;
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`Invalid preservation ${label}`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new Error(`Invalid preservation ${label}`);
  }
  return value;
}

function decodeBinding(value: unknown): VaultBinding | null {
  if (value === null) return null;
  const binding = object(value, 'binding');
  exactKeys(binding, ['uid', 'installationId', 'scope'], 'binding');
  if (typeof binding.uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(binding.uid)
    || typeof binding.installationId !== 'string' || !UUID.test(binding.installationId)
    || (binding.scope !== 'library-v1' && !/^acceptance-v1\/r00[1-4]$/.test(String(binding.scope)))) {
    throw new Error('Invalid preservation binding');
  }
  return Object.freeze({
    uid: binding.uid,
    installationId: binding.installationId,
    scope: binding.scope as VaultBinding['scope'],
  });
}

function decodePending(value: unknown): PendingBackup | null {
  if (value === null) return null;
  const pending = object(value, 'pending backup');
  exactKeys(pending, ['id', 'revision', 'slot', 'staged', 'capturedAt'], 'pending backup');
  if (typeof pending.id !== 'string' || !UUID.test(pending.id)
    || typeof pending.slot !== 'string' || !VAULT_SLOT_PATTERN.test(pending.slot)
    || Number(pending.slot) > 511) {
    throw new Error('Invalid preservation pending backup');
  }
  const staged = validateStagedBackup(pending.staged);
  if (staged.id !== pending.id) throw new Error('Invalid preservation staged identity');
  return Object.freeze({
    id: pending.id,
    revision: safeInteger(pending.revision, 'pending revision'),
    slot: pending.slot,
    staged,
    capturedAt: timestamp(pending.capturedAt, 'capture time'),
  });
}

function decodeProtected(value: unknown): ProtectedRevision | null {
  if (value === null) return null;
  const protection = object(value, 'protected revision');
  exactKeys(protection, ['revision', 'snapshot', 'verifiedAt'], 'protected revision');
  return Object.freeze({
    revision: safeInteger(protection.revision, 'protected revision'),
    snapshot: decodeVaultSnapshot(protection.snapshot),
    verifiedAt: timestamp(protection.verifiedAt, 'verification time'),
  });
}

export function decodeBackupControl(value: unknown): BackupControl {
  const raw = object(value, 'control');
  exactKeys(raw, ['binding', 'admission', 'history', 'pending', 'protected'], 'control');
  if ((raw.admission !== 'discovery' && raw.admission !== 'active')
    || !Array.isArray(raw.history) || raw.history.length > 512) {
    throw new Error('Invalid preservation control');
  }
  const binding = decodeBinding(raw.binding);
  const history = raw.history.map(decodeVaultSnapshot);
  if (new Set(history.map(({ slot }) => slot)).size !== history.length) {
    throw new Error('Invalid preservation history');
  }
  const pending = decodePending(raw.pending);
  const protection = decodeProtected(raw.protected);
  if ((raw.admission === 'active' || history.length > 0 || pending || protection) && !binding) {
    throw new Error('Preservation state has no owner binding');
  }
  if (pending && history.some(({ slot }) => slot === pending.slot)) {
    throw new Error('Pending preservation slot is already retained');
  }
  if (protection && !history.some((snapshot) =>
    snapshot.slot === protection.snapshot.slot
      && snapshot.generation === protection.snapshot.generation
      && snapshot.sha256 === protection.snapshot.sha256
      && snapshot.bytes === protection.snapshot.bytes)) {
    throw new Error('Protected preservation receipt is absent from known history');
  }
  return Object.freeze({
    binding,
    admission: raw.admission,
    history: Object.freeze(history),
    pending,
    protected: protection,
  });
}

export function decodeRecoveryVerification(value: unknown): RecoveryVerification | null {
  if (value === null) return null;
  const recovery = object(value, 'recovery verification');
  exactKeys(recovery, ['revision', 'sha256'], 'recovery verification');
  if (typeof recovery.sha256 !== 'string' || !SHA256.test(recovery.sha256)) {
    throw new Error('Invalid preservation recovery hash');
  }
  return Object.freeze({
    revision: safeInteger(recovery.revision, 'recovery revision'),
    sha256: recovery.sha256,
  });
}

export function decodePreservationRecord(value: unknown): PreservationRecord {
  const record = object(value, 'record');
  exactKeys(record, ['revision', 'version', 'control', 'recovery'], 'record');
  const revision = safeInteger(record.revision, 'revision');
  const version = safeInteger(record.version, 'version');
  const control = decodeBackupControl(record.control);
  if (control.pending && control.pending.revision > revision) {
    throw new Error('Pending preservation revision is ahead of the library');
  }
  if (control.protected && control.protected.revision > revision) {
    throw new Error('Protected preservation revision is ahead of the library');
  }
  const recovery = decodeRecoveryVerification(record.recovery);
  if (recovery && recovery.revision !== revision) {
    throw new Error('Preservation recovery revision does not match the library');
  }
  return Object.freeze({ revision, version, control, recovery });
}

export function emptyBackupControl(): BackupControl {
  return DEFAULT_CONTROL;
}
