import {
  canonicalSnapshot,
  decodeLibraryBackup,
  encodeLibraryBackup,
} from '../library-backup/codec.ts';
import { LibraryBackupService } from '../library-backup/service.ts';
import type { LibraryRestoreOutcome } from '../library-backup/service.ts';
import type { VaultSnapshot, PrivateVault, VaultListing, VaultStatus } from '../private-vault/types.ts';
import {
  countsForBackup,
  decodeVaultListing,
  decodeVaultReceipt,
  decodeVaultSnapshot,
  VAULT_CAPACITY,
  VaultError,
} from '../private-vault/contract.ts';
import { validateStagedBackup } from '../private-vault/contract.ts';
import type {
  BackupControl,
  BackupStatus,
  LibraryPreservation,
  OnlineBackupReview,
  PreservationRecord,
  ProtectedRevision,
  VaultBinding,
} from './types.ts';
import { errorStatus, INITIAL_BACKUP_STATUS, snapshotStatus } from './status.ts';

const COALESCE_MS = 30_000;
const MAX_COALESCE_MS = 60_000;
const RETRY_DELAYS_MS = [5_000, 15_000, 60_000] as const;
const CAS_ATTEMPTS = 5;

export interface AutomaticBackup {
  getSnapshot(): BackupStatus;
  subscribe(listener: () => void): () => void;
  start(): void;
  setForeground(active: boolean): void;
  retry(): Promise<void>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  history(): Promise<VaultListing>;
  review(snapshot: VaultSnapshot): Promise<OnlineBackupReview>;
  restore(review: OnlineBackupReview): Promise<LibraryRestoreOutcome>;
  useLocalLibrary(): Promise<void>;
  close(): void;
}

export interface AutomaticBackupClock {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface AutomaticBackupOptions {
  readonly preservation: LibraryPreservation;
  readonly backupService: LibraryBackupService;
  readonly vault: PrivateVault;
  readonly now?: () => Date;
  readonly isOnline?: () => boolean;
  readonly clock?: AutomaticBackupClock;
}

interface ReviewContext {
  readonly epoch: number;
  readonly binding: VaultBinding;
}

interface PendingRemote {
  readonly snapshot: VaultSnapshot;
  readonly text: string;
}

class StaleSessionError extends Error {
  constructor() { super('The active backup session changed'); }
}

function sameBinding(left: VaultBinding | null, right: VaultBinding): boolean {
  return left !== null && left.uid === right.uid
    && left.installationId === right.installationId && left.scope === right.scope;
}

function bindingFrom(status: VaultStatus): VaultBinding {
  if (!status.account) throw new VaultError('signed-out');
  return Object.freeze({
    uid: status.account.uid,
    installationId: status.installationId,
    scope: status.scope,
  });
}

function sameSnapshot(left: VaultSnapshot, right: VaultSnapshot): boolean {
  return left.slot === right.slot && left.generation === right.generation
    && left.sha256 === right.sha256 && left.bytes === right.bytes;
}

function sameListing(left: readonly VaultSnapshot[], right: readonly VaultSnapshot[]): boolean {
  if (left.length !== right.length) return false;
  const bySlot = new Map(left.map((snapshot) => [snapshot.slot, snapshot]));
  return right.every((snapshot) => {
    const known = bySlot.get(snapshot.slot);
    return known !== undefined && sameSnapshot(known, snapshot);
  });
}

function sameCounts(left: VaultSnapshot['counts'], right: VaultSnapshot['counts']): boolean {
  return left.climbs === right.climbs && left.finished === right.finished
    && left.drafts === right.drafts && left.trash === right.trash
    && left.playlists === right.playlists;
}

function emptyLibrary(snapshot: Readonly<{ drafts: readonly unknown[]; playlists: readonly unknown[] }>): boolean {
  return snapshot.drafts.length === 0 && snapshot.playlists.length === 0;
}

function sortedHistory(snapshots: readonly VaultSnapshot[]): readonly VaultSnapshot[] {
  return Object.freeze([...snapshots].sort((left, right) => left.slot.localeCompare(right.slot)));
}

function protectedFrom(record: PreservationRecord): ProtectedRevision | null {
  return record.control.protected;
}

function controlWith(control: BackupControl, patch: Partial<BackupControl>): BackupControl {
  return Object.freeze({ ...control, ...patch });
}

function isPendingSnapshot(snapshot: VaultSnapshot, control: BackupControl): boolean {
  const pending = control.pending;
  return pending !== null && snapshot.slot === pending.slot
    && snapshot.bytes === pending.staged.bytes
    && snapshot.sha256 === pending.staged.sha256;
}

function conflictingPendingSlot(listing: VaultListing, control: BackupControl): string | null {
  const pending = control.pending;
  if (!pending) return null;
  const atSlot = slotInListing(listing, pending.slot);
  return atSlot && !isPendingSnapshot(atSlot, control) ? pending.slot : null;
}

function listingDisagrees(control: BackupControl, listing: VaultListing): boolean {
  const remoteBySlot = new Map(listing.snapshots.map((snapshot) => [snapshot.slot, snapshot]));
  for (const known of control.history) {
    const remote = remoteBySlot.get(known.slot);
    if (!remote || !sameSnapshot(known, remote)) return true;
  }
  for (const remote of listing.snapshots) {
    const known = control.history.find(({ slot }) => slot === remote.slot);
    if (known ? !sameSnapshot(known, remote) : !isPendingSnapshot(remote, control)) return true;
  }
  return false;
}

function slotInListing(listing: VaultListing, slot: string): VaultSnapshot | undefined {
  return listing.snapshots.find((snapshot) => snapshot.slot === slot);
}

function nextSlot(listing: VaultListing): string | null {
  const occupied = new Set(listing.snapshots.map(({ slot }) => slot));
  for (let index = 0; index < VAULT_CAPACITY.slots; index += 1) {
    const slot = String(index).padStart(5, '0');
    if (!occupied.has(slot)) return slot;
  }
  return null;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function verifiedBackupText(text: string, snapshot: VaultSnapshot): ReturnType<typeof decodeLibraryBackup> {
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes !== snapshot.bytes) throw new VaultError('invalid-response');
  return decodeLibraryBackup(text);
}

export function createAutomaticBackup(options: AutomaticBackupOptions): AutomaticBackup {
  const { preservation, backupService, vault } = options;
  const now = options.now ?? (() => new Date());
  const clock = options.clock ?? {
    setTimeout: (callback: () => void, delayMs: number) => globalThis.setTimeout(callback, delayMs),
    clearTimeout: (handle: unknown) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
  const isOnline = options.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine);
  const listeners = new Set<() => void>();
  const reviewContexts = new WeakMap<object, ReviewContext>();
  let current = INITIAL_BACKUP_STATUS;
  let queueTail: Promise<unknown> = Promise.resolve();
  let sessionEpoch = 0;
  let foreground = true;
  let started = false;
  let closed = false;
  let unsubscribePreservation: (() => void) | null = null;
  let debounceTimer: unknown = null;
  let maxWaitTimer: unknown = null;
  let retryTimer: unknown = null;
  let retryIndex = 0;
  let lastAccountStatus: VaultStatus | null = null;

  function publish(status: BackupStatus): void {
    if (closed) return;
    current = Object.freeze(status);
    for (const listener of listeners) {
      try { listener(); } catch { /* Observers cannot change the coordinator. */ }
    }
  }

  function updateStatus(patch: Partial<BackupStatus>): void {
    publish({ ...current, ...patch });
  }

  function publishFromRecord(
    phase: BackupStatus['phase'],
    record: PreservationRecord,
    account: BackupStatus['account'],
    error: string | null = null,
    localSaveFailed = current.localSaveFailed,
  ): void {
    publish(snapshotStatus(phase, record.revision, protectedFrom(record), account, localSaveFailed, error));
  }

  function assertEpoch(epoch: number): void {
    if (closed || epoch !== sessionEpoch) throw new StaleSessionError();
  }

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = queueTail.then(async () => {
      if (closed) throw new VaultError('cancelled');
      return operation();
    });
    queueTail = result.then(() => undefined, () => undefined);
    return result;
  }

  function clearTimer(which: 'debounce' | 'max' | 'retry'): void {
    const handle = which === 'debounce' ? debounceTimer : which === 'max' ? maxWaitTimer : retryTimer;
    if (handle === null) return;
    clock.clearTimeout(handle);
    if (which === 'debounce') debounceTimer = null;
    else if (which === 'max') maxWaitTimer = null;
    else retryTimer = null;
  }

  function cancelScheduledWork(): void {
    clearTimer('debounce');
    clearTimer('max');
    clearTimer('retry');
  }

  function fireDrive(epoch: number): void {
    void enqueue(async () => drive(epoch)).catch(() => undefined);
  }

  function scheduleCommittedChange(): void {
    if (closed || !started || !foreground) return;
    clearTimer('debounce');
    debounceTimer = clock.setTimeout(() => {
      debounceTimer = null;
      clearTimer('max');
      fireDrive(sessionEpoch);
    }, COALESCE_MS);
    if (maxWaitTimer === null) {
      maxWaitTimer = clock.setTimeout(() => {
        maxWaitTimer = null;
        clearTimer('debounce');
        fireDrive(sessionEpoch);
      }, MAX_COALESCE_MS);
    }
  }

  function scheduleRetry(epoch: number): void {
    if (closed || !foreground || retryTimer !== null || retryIndex >= RETRY_DELAYS_MS.length) return;
    const delay = RETRY_DELAYS_MS[retryIndex++]!;
    retryTimer = clock.setTimeout(() => {
      retryTimer = null;
      fireDrive(epoch);
    }, delay);
  }

  function publishError(cause: unknown, epoch: number, fallbackRecord?: PreservationRecord): void {
    if (closed || epoch !== sessionEpoch) return;
    const mapped = errorStatus(cause);
    const account = lastAccountStatus?.account ?? current.account;
    if (mapped.phase === 'signed-out' || mapped.phase === 'not-configured') {
      publish(snapshotStatus(mapped.phase, fallbackRecord?.revision ?? current.revision,
        fallbackRecord ? protectedFrom(fallbackRecord) : current.protectedRevision,
        mapped.phase === 'signed-out' ? null : account,
        current.localSaveFailed, mapped.error));
      return;
    }
    if (fallbackRecord) {
      publishFromRecord(mapped.phase, fallbackRecord, account, mapped.error);
    } else {
      updateStatus({ phase: mapped.phase, error: mapped.error, account });
    }
    if (mapped.phase !== 'offline' && mapped.phase !== 'discovery'
      && mapped.phase !== 'recovery-required' && mapped.phase !== 'capacity'
      && mapped.phase !== 'verifying-recovery') scheduleRetry(epoch);
  }

  async function currentRecord(): Promise<PreservationRecord> {
    return preservation.read();
  }

  async function writeControl(
    epoch: number,
    change: (record: PreservationRecord) => BackupControl | null,
  ): Promise<PreservationRecord | null> {
    for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt += 1) {
      assertEpoch(epoch);
      const record = await currentRecord();
      const control = change(record);
      if (control === null) return record;
      if (await preservation.compareAndSet(record.version, control)) return preservation.read();
    }
    throw new VaultError('conflict');
  }

  async function accountStatus(epoch: number): Promise<VaultStatus | null> {
    let status: VaultStatus;
    try {
      status = await vault.status();
    } catch (cause) {
      assertEpoch(epoch);
      throw cause;
    }
    assertEpoch(epoch);
    lastAccountStatus = status;
    if (!status.configured) {
      const record = await currentRecord();
      publishFromRecord('not-configured', record, status.account, 'Private backup is not configured on this build.');
      return null;
    }
    if (!status.account) {
      const record = await currentRecord();
      publishFromRecord('signed-out', record, null, 'Sign in to back up or recover this library.');
      return null;
    }
    return status;
  }

  async function safeRetainStaged(uid: string, ids: readonly string[], epoch: number): Promise<void> {
    assertEpoch(epoch);
    try {
      await vault.retainStaged(uid, ids);
    } catch (cause) {
      assertEpoch(epoch);
      // Cleanup is best-effort. Durable pending metadata remains authoritative.
      if (cause instanceof VaultError && (cause.code === 'account-changed' || cause.code === 'signed-out')) throw cause;
    }
    assertEpoch(epoch);
  }

  async function verifyRemoteText(
    uid: string,
    snapshot: VaultSnapshot,
    epoch: number,
  ): Promise<PendingRemote> {
    assertEpoch(epoch);
    const text = await vault.download(uid, snapshot);
    assertEpoch(epoch);
    const decoded = verifiedBackupText(text, snapshot);
    if (await sha256(text) !== snapshot.sha256 || decoded.exportedAt !== snapshot.exportedAt
      || !sameCounts(countsForBackup(decoded), snapshot.counts)) {
      throw new VaultError('invalid-response');
    }
    return Object.freeze({ snapshot, text });
  }

  async function persistDiscovery(
    epoch: number,
    binding: VaultBinding,
    listing: VaultListing,
    conflictingPendingSlot: string | null,
  ): Promise<PreservationRecord> {
    const record = await writeControl(epoch, (latest) => {
      if (!sameBinding(latest.control.binding, binding)) {
        return controlWith(latest.control, {
          binding,
          admission: 'discovery',
          history: sortedHistory(listing.snapshots),
          pending: null,
          protected: null,
        });
      }
      const pending = conflictingPendingSlot === latest.control.pending?.slot
        ? null
        : latest.control.pending;
      const history = listing.snapshots.filter((snapshot) =>
        !(pending && isPendingSnapshot(snapshot, { ...latest.control, pending })));
      const retained = new Set(history.map((snapshot) => snapshot.slot));
      const protection = latest.control.protected
        && retained.has(latest.control.protected.snapshot.slot)
        && history.some((snapshot) => sameSnapshot(snapshot, latest.control.protected!.snapshot))
        ? latest.control.protected
        : null;
      return controlWith(latest.control, {
        binding,
        admission: 'discovery',
        history: sortedHistory(history),
        pending,
        protected: protection,
      });
    });
    if (!record) throw new VaultError('conflict');
    return record;
  }

  async function finalizePending(
    epoch: number,
    binding: VaultBinding,
    pendingId: string,
    revision: number,
    snapshot: VaultSnapshot,
  ): Promise<PreservationRecord> {
    const verifiedAt = now().toISOString();
    const record = await writeControl(epoch, (latest) => {
      const pending = latest.control.pending;
      if (!sameBinding(latest.control.binding, binding) || !pending || pending.id !== pendingId
        || pending.slot !== snapshot.slot || pending.staged.bytes !== snapshot.bytes
        || pending.staged.sha256 !== snapshot.sha256) return null;
      const priorAtSlot = latest.control.history.find(({ slot }) => slot === snapshot.slot);
      if (priorAtSlot && !sameSnapshot(priorAtSlot, snapshot)) throw new VaultError('conflict');
      const history = priorAtSlot
        ? latest.control.history.map((known) => known.slot === snapshot.slot ? snapshot : known)
        : [...latest.control.history, snapshot];
      return controlWith(latest.control, {
        history: sortedHistory(history),
        pending: null,
        protected: Object.freeze({ revision: pending.revision, snapshot, verifiedAt }),
      });
    });
    if (!record) throw new VaultError('conflict');
    if (record.control.pending?.id === pendingId || !record.control.protected
      || record.control.protected.revision !== revision
      || !sameSnapshot(record.control.protected.snapshot, snapshot)) {
      throw new VaultError('conflict');
    }
    await safeRetainStaged(binding.uid, record.control.pending ? [record.control.pending.id] : [], epoch);
    return record;
  }

  async function findPendingRemote(
    listing: VaultListing,
    pending: NonNullable<BackupControl['pending']>,
  ): Promise<VaultSnapshot | null> {
    const remote = slotInListing(listing, pending.slot);
    if (!remote) return null;
    if (remote.bytes !== pending.staged.bytes || remote.sha256 !== pending.staged.sha256) {
      throw new VaultError('conflict');
    }
    return decodeVaultSnapshot(remote);
  }

  async function completeRemotePending(
    epoch: number,
    binding: VaultBinding,
    pending: NonNullable<BackupControl['pending']>,
    snapshot: VaultSnapshot,
  ): Promise<PreservationRecord> {
    await verifyRemoteText(binding.uid, snapshot, epoch);
    return finalizePending(epoch, binding, pending.id, pending.revision, snapshot);
  }

  async function uploadPending(
    epoch: number,
    binding: VaultBinding,
    pending: NonNullable<BackupControl['pending']>,
  ): Promise<PreservationRecord> {
    assertEpoch(epoch);
    const rawReceipt = await vault.upload(binding.uid, pending.slot, pending.staged);
    assertEpoch(epoch);
    const receipt = decodeVaultReceipt(rawReceipt);
    if (receipt.snapshot.slot !== pending.slot || receipt.snapshot.bytes !== pending.staged.bytes
      || receipt.snapshot.sha256 !== pending.staged.sha256) throw new VaultError('invalid-response');
    return finalizePending(epoch, binding, pending.id, pending.revision, receipt.snapshot);
  }

  async function recoverOrUploadPending(
    epoch: number,
    binding: VaultBinding,
    pending: NonNullable<BackupControl['pending']>,
    listing: VaultListing,
  ): Promise<Readonly<{ record: PreservationRecord; listing: VaultListing; discovery: boolean }>> {
    let pendingSnapshot: VaultSnapshot | null;
    try {
      pendingSnapshot = await findPendingRemote(listing, pending);
    } catch {
      return { record: await persistDiscovery(epoch, binding, listing, pending.slot), listing, discovery: true };
    }
    if (pendingSnapshot) {
      const record = await completeRemotePending(epoch, binding, pending, pendingSnapshot);
      return { record, listing, discovery: false };
    }
    if (listingDisagrees((await currentRecord()).control, listing)) {
      return { record: await persistDiscovery(epoch, binding, listing, null), listing, discovery: true };
    }
    try {
      const record = await uploadPending(epoch, binding, pending);
      const refreshed = decodeVaultListing(await vault.list(binding.uid));
      assertEpoch(epoch);
      const expected = record.control.protected
        ? [...listing.snapshots, record.control.protected.snapshot]
        : listing.snapshots;
      if (!sameListing(expected, refreshed.snapshots)) {
        return {
          record: await persistDiscovery(epoch, binding, refreshed, null),
          listing: refreshed,
          discovery: true,
        };
      }
      return { record, listing: refreshed, discovery: false };
    } catch (cause) {
      if (cause instanceof VaultError && cause.code === 'conflict') {
        const refreshed = decodeVaultListing(await vault.list(binding.uid));
        assertEpoch(epoch);
        return {
          record: await persistDiscovery(epoch, binding, refreshed, pending.slot),
          listing: refreshed,
          discovery: true,
        };
      }
      if (!(cause instanceof VaultError) || cause.code !== 'staging-missing') throw cause;
      assertEpoch(epoch);
      const refreshed = decodeVaultListing(await vault.list(binding.uid));
      assertEpoch(epoch);
      const found = await findPendingRemote(refreshed, pending).catch(() => null);
      if (found) {
        const record = await completeRemotePending(epoch, binding, pending, found);
        return { record, listing: refreshed, discovery: false };
      }
      if (listingDisagrees((await currentRecord()).control, refreshed)) {
        return { record: await persistDiscovery(epoch, binding, refreshed,
          slotInListing(refreshed, pending.slot) ? pending.slot : null), listing: refreshed, discovery: true };
      }
      const record = await writeControl(epoch, (latest) => {
        if (!sameBinding(latest.control.binding, binding) || latest.control.pending?.id !== pending.id) return null;
        return controlWith(latest.control, { pending: null });
      });
      if (!record) throw new VaultError('conflict');
      await safeRetainStaged(binding.uid, [], epoch);
      return { record, listing: refreshed, discovery: false };
    }
  }

  async function settlePendingForAdmission(
    epoch: number,
    binding: VaultBinding,
    pending: NonNullable<BackupControl['pending']>,
    listing: VaultListing,
  ): Promise<Readonly<{ record: PreservationRecord; listing: VaultListing; discovery: boolean }>> {
    let remote: VaultSnapshot | null;
    try {
      remote = await findPendingRemote(listing, pending);
    } catch {
      return { record: await persistDiscovery(epoch, binding, listing, pending.slot), listing, discovery: true };
    }
    if (remote) {
      return {
        record: await completeRemotePending(epoch, binding, pending, remote),
        listing,
        discovery: false,
      };
    }

    try {
      const record = await uploadPending(epoch, binding, pending);
      const refreshed = decodeVaultListing(await vault.list(binding.uid));
      assertEpoch(epoch);
      if (listingDisagrees(record.control, refreshed)) {
        return {
          record: await persistDiscovery(epoch, binding, refreshed, null),
          listing: refreshed,
          discovery: true,
        };
      }
      return { record, listing: refreshed, discovery: false };
    } catch (cause) {
      if (!(cause instanceof VaultError)
        || (cause.code !== 'staging-missing' && cause.code !== 'conflict')) throw cause;
      const refreshed = decodeVaultListing(await vault.list(binding.uid));
      assertEpoch(epoch);
      let found: VaultSnapshot | null;
      try {
        found = await findPendingRemote(refreshed, pending);
      } catch {
        return {
          record: await persistDiscovery(epoch, binding, refreshed, pending.slot),
          listing: refreshed,
          discovery: true,
        };
      }
      if (found) {
        return {
          record: await completeRemotePending(epoch, binding, pending, found),
          listing: refreshed,
          discovery: false,
        };
      }
      if (cause.code === 'staging-missing' && !sameListing(listing.snapshots, refreshed.snapshots)) {
        return {
          record: await persistDiscovery(epoch, binding, refreshed, null),
          listing: refreshed,
          discovery: true,
        };
      }
      if (cause.code === 'conflict') {
        return {
          record: await persistDiscovery(epoch, binding, refreshed, null),
          listing: refreshed,
          discovery: true,
        };
      }
      const record = await writeControl(epoch, (latest) => {
        if (!sameBinding(latest.control.binding, binding) || latest.control.pending?.id !== pending.id) return null;
        return controlWith(latest.control, { pending: null });
      });
      if (!record) throw new VaultError('conflict');
      await safeRetainStaged(binding.uid, record.control.pending ? [record.control.pending.id] : [], epoch);
      return { record, listing: refreshed, discovery: false };
    }
  }

  async function captureAndUpload(
    epoch: number,
    binding: VaultBinding,
    record: PreservationRecord,
    listing: VaultListing,
  ): Promise<Readonly<{ record: PreservationRecord; listing: VaultListing; attempted: boolean }>> {
    const captured = await preservation.capture();
    assertEpoch(epoch);
    if (emptyLibrary(captured.snapshot)) {
      const protectedRevision = record.control.protected;
      const error = 'This library is empty. Earlier backups are kept; empty copies are not uploaded.';
    const phase: BackupStatus['phase'] = protectedRevision?.revision === captured.revision
      ? 'protected' : 'pending';
      publish(snapshotStatus(phase, captured.revision, protectedRevision, lastAccountStatus?.account ?? null,
        current.localSaveFailed, error));
      return { record, listing, attempted: false };
    }
    if (record.control.pending) return { record, listing, attempted: false };
    if (record.control.protected?.revision === captured.revision) {
      publishFromRecord('protected', record, lastAccountStatus?.account ?? null);
      return { record, listing, attempted: false };
    }
    const slot = nextSlot(listing);
    if (slot === null) {
      publishFromRecord('capacity', record, lastAccountStatus?.account ?? null,
        `All ${VAULT_CAPACITY.slots} backup slots are in use. Existing backups were kept.`);
      return { record, listing, attempted: false };
    }
    const text = encodeLibraryBackup(captured.snapshot, now());
    const staged = validateStagedBackup(await vault.stage(binding.uid, text));
    assertEpoch(epoch);
    const expectedHash = await sha256(text);
    if (staged.bytes !== new TextEncoder().encode(text).byteLength || staged.sha256 !== expectedHash) {
      await safeRetainStaged(binding.uid, [], epoch);
      throw new VaultError('invalid-response');
    }
    const capturedAt = now().toISOString();
    const pending = Object.freeze({
      id: staged.id,
      revision: captured.revision,
      slot,
      staged,
      capturedAt,
    });
    const pendingRecord = await writeControl(epoch, (latest) => {
      if (!sameBinding(latest.control.binding, binding) || latest.control.admission !== 'active'
        || latest.control.pending !== null) return null;
      return controlWith(latest.control, { pending });
    });
    if (!pendingRecord || pendingRecord.control.pending?.id !== staged.id) {
      const latest = await currentRecord();
      await safeRetainStaged(binding.uid, latest.control.pending ? [latest.control.pending.id] : [], epoch);
      publishFromRecord('discovery', latest, lastAccountStatus?.account ?? null,
        'Library backup state changed. Review backup history before continuing.');
      return { record: latest, listing, attempted: false };
    }
    publishFromRecord('uploading', pendingRecord, lastAccountStatus?.account ?? null);
    await uploadPending(epoch, binding, pending);
    const after = await preservation.read();
    const refreshedListing = decodeVaultListing(await vault.list(binding.uid));
    assertEpoch(epoch);
    if (listingDisagrees(after.control, refreshedListing)) {
      const discovered = await persistDiscovery(epoch, binding, refreshedListing, null);
      return { record: discovered, listing: refreshedListing, attempted: true };
    }
    publishFromRecord(after.control.protected?.revision === after.revision ? 'protected' : 'pending',
      after, lastAccountStatus?.account ?? null);
    return { record: after, listing: refreshedListing, attempted: true };
  }

  async function activateEmptyFreshInstall(
    epoch: number,
    binding: VaultBinding,
    listing: VaultListing,
    captured: Awaited<ReturnType<LibraryPreservation['capture']>>,
  ): Promise<PreservationRecord> {
    const record = await writeControl(epoch, (latest) => controlWith(latest.control, {
      binding,
      admission: 'active',
      history: sortedHistory(listing.snapshots),
      pending: null,
      protected: null,
    }));
    if (!record) throw new VaultError('conflict');
    const message = 'No saved climbs yet. Empty library copies are not uploaded.';
    publish(snapshotStatus('pending', captured.revision, null, lastAccountStatus?.account ?? null,
      current.localSaveFailed, message));
    return record;
  }

  async function refreshAndDrive(epoch: number): Promise<void> {
    assertEpoch(epoch);
    let record: PreservationRecord | undefined;
    try {
      try {
        await preservation.verifyRecovery();
      } catch (cause) {
        record = await currentRecord().catch(() => undefined);
        if (cause instanceof Error && /recovery verification/i.test(cause.message)) {
          if (record) publishFromRecord('verifying-recovery', record, current.account,
            'Library recovery verification is still pending. Backup and authoring remain paused.');
          else updateStatus({ phase: 'verifying-recovery', error: 'Library recovery verification is still pending.' });
        } else {
          publishError(cause, epoch, record);
        }
        return;
      }
      const status = await accountStatus(epoch);
      if (!status || !status.account) return;
      const binding = bindingFrom(status);
      record = await currentRecord();
      let captured: Awaited<ReturnType<LibraryPreservation['capture']>>;
      try {
        captured = await preservation.capture();
      } catch (cause) {
        if (String(cause instanceof Error ? cause.message : cause).includes('verification is pending')) {
          publishFromRecord('verifying-recovery', record, status.account,
            'Library recovery verification is still pending. Backup and authoring remain paused.');
          return;
        }
        throw cause;
      }
      assertEpoch(epoch);
      const listing = decodeVaultListing(await vault.list(binding.uid));
      assertEpoch(epoch);
      const identityMatches = sameBinding(record.control.binding, binding);
      if (!identityMatches) {
        if (listing.snapshots.length === 0 && emptyLibrary(captured.snapshot)) {
          record = await activateEmptyFreshInstall(epoch, binding, listing, captured);
          await safeRetainStaged(binding.uid, [], epoch);
        } else {
          record = await persistDiscovery(epoch, binding, listing, null);
          await safeRetainStaged(binding.uid, record.control.pending ? [record.control.pending.id] : [], epoch);
          const phase = listing.snapshots.length > 0 && emptyLibrary(captured.snapshot)
            ? 'recovery-required' : 'discovery';
          publishFromRecord(phase, record, status.account,
            phase === 'recovery-required'
              ? 'This phone has no saved climbs. Retained backups are available to review and recover.'
              : 'Review retained backups or choose to use this phone’s library before backing it up.');
        }
        return;
      }

      const pending = record.control.pending;
      const pendingRevision = pending?.revision ?? null;
      const pendingRemote = pending ? await findPendingRemote(listing, pending).catch(() => null) : null;
      const disagrees = listingDisagrees(record.control, listing);
      if (pending && pendingRemote) {
        record = await completeRemotePending(epoch, binding, pending, pendingRemote);
      }
      if (disagrees) {
        record = await persistDiscovery(epoch, binding, listing,
          pending && !pendingRemote && slotInListing(listing, pending.slot) ? pending.slot : null);
        await safeRetainStaged(binding.uid, record.control.pending ? [record.control.pending.id] : [], epoch);
        const phase = listing.snapshots.length > 0 && emptyLibrary(captured.snapshot)
          ? 'recovery-required' : 'discovery';
        publishFromRecord(phase, record, status.account,
          phase === 'recovery-required'
            ? 'Retained backups are available to review and recover.'
            : 'Backup history changed. Review it or choose to use this phone’s library.');
        return;
      }
      if (record.control.admission !== 'active') {
        const phase = listing.snapshots.length > 0 && emptyLibrary(captured.snapshot)
          ? 'recovery-required' : 'discovery';
        publishFromRecord(phase, record, status.account,
          phase === 'recovery-required'
            ? 'Retained backups are available to review and recover.'
            : 'Choose a retained backup to recover or explicitly use this phone’s library.');
        return;
      }
      await safeRetainStaged(binding.uid, record.control.pending ? [record.control.pending.id] : [], epoch);
      if (record.control.pending) {
        const resolved = await recoverOrUploadPending(epoch, binding, record.control.pending, listing);
        record = resolved.record;
        if (resolved.discovery) {
          publishFromRecord('discovery', record, status.account,
            'Backup history changed. Review it before continuing.');
          return;
        }
      }
      if (pendingRevision !== null && record.control.protected?.revision === pendingRevision
        && record.revision > pendingRevision) {
        publishFromRecord('pending', record, status.account);
        scheduleCommittedChange();
        return;
      }
      const result = await captureAndUpload(epoch, binding, record, listing);
      record = result.record;
      if (!result.attempted) return;
      const latestCapture = await preservation.capture();
      if (record.control.protected?.revision === latestCapture.revision) {
        publishFromRecord('protected', { ...record, revision: latestCapture.revision }, status.account);
        return;
      }
      // A receipt for R never stands in for R+1. A newer commit remains pending
      // until the normal coalescing timer or an explicit foreground retry.
      publishFromRecord('pending', { ...record, revision: latestCapture.revision }, status.account);
      scheduleCommittedChange();
    } catch (cause) {
      if (cause instanceof StaleSessionError || closed || epoch !== sessionEpoch) return;
      publishError(cause, epoch, record);
    }
  }

  async function drive(epoch: number): Promise<void> {
    if (closed || epoch !== sessionEpoch) return;
    if (!foreground) return;
    try {
      if (!isOnline()) throw new VaultError('offline');
    } catch (cause) {
      const record = await currentRecord().catch(() => undefined);
      publishError(cause, epoch, record);
      return;
    }
    publish({ ...current, phase: 'checking', error: null });
    await refreshAndDrive(epoch);
    if (epoch === sessionEpoch && current.phase !== 'error' && current.phase !== 'offline') retryIndex = 0;
  }

  async function listForAccount(epoch: number): Promise<Readonly<{ status: VaultStatus; binding: VaultBinding; listing: VaultListing }>> {
    const status = await accountStatus(epoch);
    if (!status?.account) throw new VaultError(status?.configured ? 'signed-out' : 'not-configured');
    const binding = bindingFrom(status);
    const listing = decodeVaultListing(await vault.list(binding.uid));
    assertEpoch(epoch);
    return { status, binding, listing };
  }

  function rejectRestore(cause: Error): LibraryRestoreOutcome {
    return { status: 'failed', phase: 'preflight', drafts: null, error: cause };
  }

  const unsubscribeCommitSource = () => {
    if (unsubscribePreservation) unsubscribePreservation();
    unsubscribePreservation = null;
  };

  return Object.freeze({
    getSnapshot: () => current,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start: () => {
      if (started || closed) return;
      started = true;
      unsubscribePreservation = preservation.subscribe((event) => {
        if (event === 'write-failed') {
          updateStatus({ localSaveFailed: true });
          return;
        }
        if (event === 'committed') {
          if (current.phase === 'protected') {
            updateStatus({ phase: 'pending', localSaveFailed: false, error: null });
          } else {
            updateStatus({ localSaveFailed: false });
          }
          const epoch = sessionEpoch;
          void currentRecord().then((record) => {
            if (closed || epoch !== sessionEpoch) return;
            const phase = current.phase === 'protected'
              && record.control.protected?.revision !== record.revision ? 'pending' : current.phase;
            publish(snapshotStatus(phase, record.revision, protectedFrom(record), current.account,
              current.localSaveFailed, current.error));
          }).catch(() => undefined);
          scheduleCommittedChange();
        }
      });
      const epoch = sessionEpoch;
      void enqueue(() => drive(epoch)).catch(() => undefined);
    },
    setForeground: (active: boolean) => {
      if (closed || foreground === active) return;
      foreground = active;
      if (!active) {
        cancelScheduledWork();
        return;
      }
      retryIndex = 0;
      fireDrive(sessionEpoch);
    },
    retry: () => {
      if (closed) return Promise.resolve();
      cancelScheduledWork();
      retryIndex = 0;
      const epoch = sessionEpoch;
      return enqueue(() => drive(epoch));
    },
    signIn: () => {
      if (closed) return Promise.reject(new VaultError('cancelled'));
      cancelScheduledWork();
      const epoch = ++sessionEpoch;
      updateStatus({ phase: 'checking', error: null, account: null });
      return enqueue(async () => {
        try {
          await vault.signIn();
          assertEpoch(epoch);
          retryIndex = 0;
          await drive(epoch);
        } catch (cause) {
          if (cause instanceof StaleSessionError || closed || epoch !== sessionEpoch) return;
          publishError(cause, epoch);
        }
      });
    },
    signOut: () => {
      if (closed) return Promise.resolve();
      cancelScheduledWork();
      const epoch = ++sessionEpoch;
      const previous = current;
      publish(snapshotStatus('signed-out', previous.revision, previous.protectedRevision, null,
        previous.localSaveFailed, 'Sign in to back up or recover this library.'));
      return enqueue(async () => {
        try {
          await vault.signOut();
          assertEpoch(epoch);
          lastAccountStatus = lastAccountStatus ? { ...lastAccountStatus, account: null } : null;
        } catch (cause) {
          if (cause instanceof StaleSessionError || closed || epoch !== sessionEpoch) return;
          publishError(cause, epoch);
        }
      });
    },
    history: () => {
      const epoch = sessionEpoch;
      return enqueue(async () => {
        try {
          const { listing, status, binding } = await listForAccount(epoch);
      const record = await currentRecord();
          if (!sameBinding(record.control.binding, binding) || listingDisagrees(record.control, listing)) {
            const updated = await persistDiscovery(epoch, binding, listing, conflictingPendingSlot(listing, record.control));
            publishFromRecord('discovery', updated, status.account,
              'Review retained backups before backing up this library.');
          }
          return listing;
        } catch (cause) {
          if (cause instanceof StaleSessionError) throw new VaultError('account-changed');
          publishError(cause, epoch);
          throw cause instanceof VaultError ? cause : new VaultError('unavailable');
        }
      });
    },
    review: (selected: VaultSnapshot) => {
      const epoch = sessionEpoch;
      return enqueue(async () => {
        try {
          const { listing, status, binding } = await listForAccount(epoch);
          const snapshot = listing.snapshots.find(({ slot }) => slot === selected.slot);
          if (!snapshot || !sameSnapshot(snapshot, selected)) throw new VaultError('missing');
          const remote = await verifyRemoteText(binding.uid, snapshot, epoch);
          const backup = decodeLibraryBackup(remote.text);
          const localReview = await backupService.review(backup);
          assertEpoch(epoch);
          const review = Object.freeze({ snapshot, backup, review: localReview });
          reviewContexts.set(review, { epoch, binding });
          const record = await currentRecord();
          if (!sameBinding(record.control.binding, binding) || listingDisagrees(record.control, listing)) {
            const updated = await persistDiscovery(epoch, binding, listing, conflictingPendingSlot(listing, record.control));
            publishFromRecord('recovery-required', updated, status.account,
              'Review this retained copy, then choose whether to recover it or use this phone’s library.');
          }
          return review;
        } catch (cause) {
          if (cause instanceof StaleSessionError) throw new VaultError('account-changed');
          publishError(cause, epoch);
          throw cause instanceof VaultError ? cause : new VaultError('unavailable');
        }
      });
    },
    restore: (review: OnlineBackupReview) => {
      cancelScheduledWork();
      const epoch = sessionEpoch;
      return enqueue(async () => {
        const context = reviewContexts.get(review as object);
        if (!context || context.epoch !== epoch) return rejectRestore(new VaultError('account-changed'));
        let committedOutcome: LibraryRestoreOutcome | null = null;
        try {
          const { status, binding, listing } = await listForAccount(epoch);
          if (!sameBinding(context.binding, binding)) return rejectRestore(new VaultError('account-changed'));
          try {
            await preservation.verifyRecovery();
          } catch (cause) {
            if (cause instanceof Error && /recovery verification/i.test(cause.message)) {
              const held = await currentRecord();
              publishFromRecord('verifying-recovery', held, status.account,
                'Library recovery verification is still pending. Backup and authoring remain paused.');
            } else {
              publishError(cause, epoch, await currentRecord().catch(() => undefined));
            }
            return rejectRestore(cause instanceof Error ? cause : new VaultError('unavailable'));
          }
          const selected = listing.snapshots.find(({ slot }) => slot === review.snapshot.slot);
          if (!selected || !sameSnapshot(selected, review.snapshot)) return rejectRestore(new VaultError('missing'));
          let record = await currentRecord();
          if (!sameBinding(record.control.binding, binding) || listingDisagrees(record.control, listing)) {
            record = await persistDiscovery(epoch, binding, listing, conflictingPendingSlot(listing, record.control));
          }
          if (record.control.pending) {
            const resolved = await recoverOrUploadPending(epoch, binding, record.control.pending, listing);
            record = resolved.record;
            if (resolved.discovery || record.control.pending) {
              publishFromRecord('discovery', record, status.account,
                'A pending backup must be resolved before recovery can change this library.');
              return rejectRestore(new VaultError('not-admitted'));
            }
          }
          const outcome = await backupService.restore(review.backup);
          if (outcome.status === 'complete'
            || (outcome.status === 'failed' && outcome.phase === 'verification')) committedOutcome = outcome;
          assertEpoch(epoch);
          if (outcome.status !== 'complete') {
            if (outcome.status === 'failed' && outcome.phase === 'verification') {
              const held = await currentRecord();
              publishFromRecord('verifying-recovery', held, status.account,
                'Recovery was saved, but verification is incomplete. Backup and authoring remain paused.');
            }
            return outcome;
          }
          const captured = await preservation.capture();
          assertEpoch(epoch);
          const matchesSource = canonicalSnapshot(captured.snapshot) === canonicalSnapshot(review.backup);
          const refreshedListing = decodeVaultListing(await vault.list(binding.uid));
          assertEpoch(epoch);
          const committed = await writeControl(epoch, (latest) => {
            if (!sameBinding(latest.control.binding, binding)) return null;
            const history = sortedHistory(refreshedListing.snapshots);
            const receiptStillRetained = history.some((snapshot) => sameSnapshot(snapshot, review.snapshot));
            if (!receiptStillRetained) return controlWith(latest.control, {
              admission: 'discovery', history, pending: null, protected: null,
            });
            const preservePrior = latest.control.protected
              && history.some((snapshot) => sameSnapshot(snapshot, latest.control.protected!.snapshot))
              ? latest.control.protected : null;
            return controlWith(latest.control, {
              admission: 'active',
              history,
              pending: null,
              protected: matchesSource
                ? Object.freeze({ revision: captured.revision, snapshot: review.snapshot, verifiedAt: now().toISOString() })
                : preservePrior,
            });
          });
          if (!committed) throw new VaultError('conflict');
          if (!committed.control.protected || committed.control.protected.revision !== captured.revision) {
            publishFromRecord('pending', committed, status.account,
              'Recovery is complete. This phone’s additional records still need a backup.');
            if (foreground) await refreshAndDrive(epoch);
          } else {
            publishFromRecord('protected', committed, status.account);
          }
          return outcome;
        } catch (cause) {
          if (committedOutcome) {
            if (cause instanceof StaleSessionError || closed || epoch !== sessionEpoch) return committedOutcome;
            publishError(cause, epoch, await currentRecord().catch(() => undefined));
            return committedOutcome;
          }
          if (cause instanceof StaleSessionError || closed || epoch !== sessionEpoch) {
            return rejectRestore(new VaultError('account-changed'));
          }
          publishError(cause, epoch);
          return rejectRestore(cause instanceof VaultError ? cause : new VaultError('unavailable'));
        }
      });
    },
    useLocalLibrary: () => {
      const epoch = sessionEpoch;
      return enqueue(async () => {
        try {
          const { status, binding, listing: initialListing } = await listForAccount(epoch);
          let listing = initialListing;
          let currentRecordValue = await currentRecord();
          if (sameBinding(currentRecordValue.control.binding, binding) && currentRecordValue.control.pending) {
            const settled = await settlePendingForAdmission(
              epoch, binding, currentRecordValue.control.pending, listing,
            );
            currentRecordValue = settled.record;
            listing = settled.listing;
            if (settled.discovery || currentRecordValue.control.pending) {
              publishFromRecord('discovery', currentRecordValue, status.account,
                'A pending backup or changed history must be reviewed before this library can be admitted.');
              return;
            }
          }
          const captured = await preservation.capture();
          const record = await writeControl(epoch, (latest) => {
            if (latest.control.pending || (latest.control.binding && !sameBinding(latest.control.binding, binding))) {
              return null;
            }
            const bindingMatches = sameBinding(latest.control.binding, binding);
            const history = sortedHistory(listing.snapshots);
            const protectedCopy = bindingMatches && latest.control.protected
              && history.some((snapshot) => sameSnapshot(snapshot, latest.control.protected!.snapshot))
              ? latest.control.protected : null;
            return controlWith(latest.control, {
              binding,
              admission: 'active',
              history,
              pending: null,
              protected: protectedCopy,
            });
          });
          if (!record) throw new VaultError('conflict');
          if (record.control.pending || !sameBinding(record.control.binding, binding)) {
            publishFromRecord('discovery', record, status.account,
              'Backup state changed in another open app. Review history before continuing.');
            return;
          }
          await safeRetainStaged(binding.uid, [], epoch);
          if (emptyLibrary(captured.snapshot)) {
            publishFromRecord(record.control.protected?.revision === captured.revision ? 'protected' : 'pending',
              { ...record, revision: captured.revision }, status.account,
              'This phone’s library is empty. Existing backups are kept; empty copies are not uploaded.');
            return;
          }
          await refreshAndDrive(epoch);
        } catch (cause) {
          if (cause instanceof StaleSessionError || closed || epoch !== sessionEpoch) return;
          publishError(cause, epoch);
        }
      });
    },
    close: () => {
      if (closed) return;
      closed = true;
      sessionEpoch += 1;
      cancelScheduledWork();
      unsubscribeCommitSource();
      listeners.clear();
    },
  });
}
