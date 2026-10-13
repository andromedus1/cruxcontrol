import { LIBRARY_BACKUP_LIMITS } from '../library-backup/codec.ts';
import type { DecodedLibraryBackup } from '../library-backup/types.ts';
import type {
  StagedBackup,
  VaultAccount,
  VaultContentCounts,
  VaultListing,
  VaultReceipt,
  VaultScope,
  VaultSnapshot,
  VaultStatus,
} from './types.ts';

export const VAULT_CAPACITY = Object.freeze({ slots: 512, bytesPerSlot: LIBRARY_BACKUP_LIMITS.bytes });
export const VAULT_SLOT_PATTERN = /^\d{5}$/;

export type VaultErrorCode =
  | 'not-configured'
  | 'signed-out'
  | 'account-changed'
  | 'not-admitted'
  | 'cancelled'
  | 'offline'
  | 'unavailable'
  | 'conflict'
  | 'missing'
  | 'invalid-response'
  | 'invalid-backup'
  | 'staging-missing';

export class VaultError extends Error {
  readonly code: VaultErrorCode;

  constructor(code: VaultErrorCode) {
    super(code);
    this.name = 'VaultError';
    this.code = code;
  }
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new VaultError('invalid-response');
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new VaultError('invalid-response');
  }
}

function validUtcTimestamp(value: unknown, canonicalMilliseconds = false): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/.exec(value);
  if (!match) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const milliseconds = (match[2] ?? '').slice(0, 3).padEnd(3, '0');
  const normalized = `${match[1]}.${milliseconds}Z`;
  return new Date(parsed).toISOString() === normalized
    && (!canonicalMilliseconds || value === new Date(parsed).toISOString());
}

function decodeAccount(value: unknown): VaultAccount {
  const account = record(value);
  exactKeys(account, ['uid', 'email']);
  if (typeof account.uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(account.uid)
    || (account.email !== null && (typeof account.email !== 'string' || account.email.length > 320
      || containsControlCharacter(account.email)))) {
    throw new VaultError('invalid-response');
  }
  return Object.freeze({ uid: account.uid, email: account.email as string | null });
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0)!;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
}

export function decodeVaultSnapshot(value: unknown): VaultSnapshot {
  const snapshot = record(value);
  exactKeys(snapshot, ['slot', 'bytes', 'sha256', 'generation', 'createdAt', 'exportedAt', 'counts']);
  if (typeof snapshot.slot !== 'string' || !VAULT_SLOT_PATTERN.test(snapshot.slot)) {
    throw new VaultError('invalid-response');
  }
  const slot = Number(snapshot.slot);
  if (slot > 511 || String(slot).padStart(5, '0') !== snapshot.slot
    || !Number.isSafeInteger(snapshot.bytes) || (snapshot.bytes as number) < 1
    || (snapshot.bytes as number) > VAULT_CAPACITY.bytesPerSlot
    || typeof snapshot.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(snapshot.sha256)
    || typeof snapshot.generation !== 'string' || !/^[1-9]\d*$/.test(snapshot.generation)
    || !validUtcTimestamp(snapshot.createdAt)
    || !validUtcTimestamp(snapshot.exportedAt, true)) {
    throw new VaultError('invalid-response');
  }
  const counts = record(snapshot.counts);
  exactKeys(counts, ['climbs', 'finished', 'drafts', 'trash', 'playlists']);
  if (Object.values(counts).some(count => typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0)
    || (counts.finished as number) + (counts.drafts as number) + (counts.trash as number) !== counts.climbs
    || (counts.climbs as number) > 10_000 || (counts.playlists as number) > 1_000) {
    throw new VaultError('invalid-response');
  }
  const decodedCounts: VaultContentCounts = Object.freeze({
    climbs: counts.climbs as number,
    finished: counts.finished as number,
    drafts: counts.drafts as number,
    trash: counts.trash as number,
    playlists: counts.playlists as number,
  });
  return Object.freeze({
    slot: snapshot.slot,
    bytes: snapshot.bytes as number,
    sha256: snapshot.sha256,
    generation: snapshot.generation,
    createdAt: snapshot.createdAt,
    exportedAt: snapshot.exportedAt,
    counts: decodedCounts,
  });
}

export function decodeVaultStatus(value: unknown): VaultStatus {
  const status = record(value);
  exactKeys(status, ['configured', 'installationId', 'scope', 'account']);
  if (typeof status.configured !== 'boolean'
    || typeof status.installationId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(status.installationId)
    || (status.scope !== 'library-v1'
      && !(typeof status.scope === 'string' && /^acceptance-v1\/r00[1-4]$/.test(status.scope)))
    || (status.account !== null && typeof status.account !== 'object')
    || (!status.configured && status.account !== null)) {
    throw new VaultError('invalid-response');
  }
  return Object.freeze({
    configured: status.configured,
    installationId: status.installationId,
    scope: status.scope as VaultScope,
    account: status.account === null ? null : decodeAccount(status.account),
  });
}

export function decodeVaultListing(value: unknown): VaultListing {
  const listing = record(value);
  exactKeys(listing, ['snapshots', 'capacity']);
  const capacity = record(listing.capacity);
  exactKeys(capacity, ['slots', 'bytesPerSlot']);
  if (capacity.slots !== VAULT_CAPACITY.slots || capacity.bytesPerSlot !== VAULT_CAPACITY.bytesPerSlot
    || !Array.isArray(listing.snapshots) || listing.snapshots.length > VAULT_CAPACITY.slots) {
    throw new VaultError('invalid-response');
  }
  const snapshots = listing.snapshots.map(decodeVaultSnapshot);
  if (new Set(snapshots.map(({ slot }) => slot)).size !== snapshots.length) {
    throw new VaultError('invalid-response');
  }
  return Object.freeze({
    snapshots: Object.freeze(snapshots),
    capacity: VAULT_CAPACITY,
  });
}

export function decodeVaultReceipt(value: unknown): VaultReceipt {
  const receipt = record(value);
  exactKeys(receipt, ['snapshot', 'verified']);
  if (receipt.verified !== true) throw new VaultError('invalid-response');
  return Object.freeze({ snapshot: decodeVaultSnapshot(receipt.snapshot), verified: true });
}

export function countsForBackup(backup: DecodedLibraryBackup): VaultContentCounts {
  const trash = backup.drafts.filter(draft => draft.trashedAt !== undefined).length;
  const live = backup.drafts.filter(draft => draft.trashedAt === undefined);
  return Object.freeze({
    climbs: backup.drafts.length,
    finished: live.filter(draft => draft.status === 'finished').length,
    drafts: live.filter(draft => draft.status === 'draft').length,
    trash,
    playlists: backup.playlists.length,
  });
}

export function validateStagedBackup(value: unknown): StagedBackup {
  const staged = record(value);
  exactKeys(staged, ['id', 'bytes', 'sha256']);
  if (typeof staged.id !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(staged.id)
    || !Number.isSafeInteger(staged.bytes) || (staged.bytes as number) < 1
    || (staged.bytes as number) > VAULT_CAPACITY.bytesPerSlot
    || typeof staged.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(staged.sha256)) {
    throw new VaultError('invalid-response');
  }
  return Object.freeze({ id: staged.id, bytes: staged.bytes as number, sha256: staged.sha256 });
}
