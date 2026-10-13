import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftRevision, localDraftId } from '../drafts/codec.ts';
import { draftContent } from '../drafts/test-fixtures.ts';
import type { LocalClimbDraft } from '../drafts/types.ts';
import { encodeLibraryBackup } from '../library-backup/codec.ts';
import { LibraryBackupService } from '../library-backup/service.ts';
import type { LibraryBackupStore, LibrarySnapshot } from '../library-backup/types.ts';
import {
  countsForBackup,
  VAULT_CAPACITY,
  VaultError,
} from '../private-vault/contract.ts';
import type {
  PrivateVault,
  StagedBackup,
  VaultAccount,
  VaultListing,
  VaultReceipt,
  VaultScope,
  VaultSnapshot,
  VaultStatus,
} from '../private-vault/types.ts';
import { decodeBackupControl, emptyBackupControl } from './state.ts';
import { createAutomaticBackup } from './coordinator.ts';
import type { BackupControl, LibraryPreservation, PreservationRecord } from './types.ts';

const account: VaultAccount = Object.freeze({ uid: 'climber_1', email: null });
const installationId = '00000000-0000-4000-8000-000000000501';
const stableDate = '2026-10-11T00:00:00.000Z';
let nextClimbId = 501;

function climb(name: string): LocalClimbDraft {
  const id = localDraftId(`00000000-0000-4000-8000-${String(nextClimbId++).padStart(12, '0')}`);
  return {
    ...draftContent({ name }),
    schemaVersion: 4,
    id,
    revision: draftRevision(1),
    createdAt: stableDate,
    updatedAt: stableDate,
    metadata: {},
  };
}

function digest(text: string): Promise<string> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then((value) =>
    Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, '0')).join(''));
}

class FakePreservation implements LibraryPreservation {
  drafts: LocalClimbDraft[];
  playlists: LibrarySnapshot['playlists'][number][] = [];
  record: PreservationRecord = Object.freeze({ revision: 0, version: 0, control: emptyBackupControl(), recovery: null });
  readonly listeners = new Set<(event: 'committed' | 'write-failed') => void>();
  casAttempts = 0;
  rejectNextCas = false;
  throwNextCas = false;
  recoveryError: Error | null = null;
  afterRestore: (() => void) | null = null;
  captureCalls = 0;
  beforeCapture: ((call: number) => Promise<void>) | null = null;
  readCalls = 0;
  beforeRead: ((record: PreservationRecord, call: number) => Promise<void>) | null = null;
  verifyCalls = 0;
  readonly store: LibraryBackupStore;

  constructor(drafts: readonly LocalClimbDraft[] = []) {
    this.drafts = [...drafts];
    this.store = {
      readSnapshot: async () => this.snapshot(),
      readDrafts: async () => [...this.drafts],
      readPlaylists: async () => [...this.playlists],
      restoreMissingDrafts: async (records) => {
        const missing = records.filter(({ id }) => !this.drafts.some((current) => current.id === id));
        this.drafts.push(...missing);
        return { added: missing.length, unchanged: records.length - missing.length };
      },
      restoreMissingPlaylists: async (records) => {
        const missing = records.filter(({ id }) => !this.playlists.some((current) => current.id === id));
        this.playlists.push(...missing);
        return { added: missing.length, unchanged: records.length - missing.length };
      },
      restoreMissingSnapshot: async (snapshot) => {
        const drafts = await this.store.restoreMissingDrafts(snapshot.drafts);
        const playlists = await this.store.restoreMissingPlaylists(snapshot.playlists);
        if (drafts.added + playlists.added > 0) this.commit();
        this.afterRestore?.();
        return { drafts, playlists };
      },
    };
  }

  snapshot(): LibrarySnapshot {
    return Object.freeze({ drafts: Object.freeze([...this.drafts]), playlists: Object.freeze([...this.playlists]) });
  }

  commit(draft?: LocalClimbDraft): void {
    if (draft) this.drafts.push(draft);
    this.record = Object.freeze({ ...this.record, revision: this.record.revision + 1 });
    this.listeners.forEach((listener) => listener('committed'));
  }

  async read(): Promise<PreservationRecord> {
    this.readCalls += 1;
    if (this.beforeRead) await this.beforeRead(this.record, this.readCalls);
    return this.record;
  }
  async capture() {
    this.captureCalls += 1;
    if (this.beforeCapture) await this.beforeCapture(this.captureCalls);
    return Object.freeze({ revision: this.record.revision, snapshot: this.snapshot() });
  }
  async compareAndSet(version: number, control: BackupControl): Promise<boolean> {
    this.casAttempts += 1;
    if (this.throwNextCas) {
      this.throwNextCas = false;
      throw new Error('local control acknowledgement failed');
    }
    if (this.rejectNextCas) {
      this.rejectNextCas = false;
      this.record = Object.freeze({ ...this.record, version: this.record.version + 1 });
      return false;
    }
    if (version !== this.record.version) return false;
    this.record = Object.freeze({ ...this.record, version: version + 1, control: decodeBackupControl(control) });
    return true;
  }
  async verifyRecovery(): Promise<void> {
    this.verifyCalls += 1;
    if (this.recoveryError) throw this.recoveryError;
  }
  subscribe(listener: (event: 'committed' | 'write-failed') => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

interface RemoteFile {
  readonly snapshot: VaultSnapshot;
  readonly text: string;
}

class FakeVault implements PrivateVault {
  configured = true;
  statusAccount: VaultAccount | null = account;
  scope: VaultScope = 'library-v1';
  nativeInstallationId = installationId;
  readonly staged = new Map<string, string>();
  readonly remote = new Map<string, RemoteFile>();
  stageCalls = 0;
  statusCalls = 0;
  uploadCalls: Readonly<{ slot: string; staged: StagedBackup }>[] = [];
  downloadCalls = 0;
  retainedIds: readonly string[] = [];
  loseNextUploadResponse = false;
  failNextUpload: VaultError | null = null;
  failNextList: VaultError | null = null;
  beforeUpload: (() => Promise<void>) | null = null;
  afterRemoteCommit: (() => void) | null = null;
  corruptNextStage = false;
  generation = 1;

  async status(): Promise<VaultStatus> {
    this.statusCalls += 1;
    return Object.freeze({ configured: this.configured, installationId: this.nativeInstallationId,
      scope: this.scope, account: this.configured ? this.statusAccount : null });
  }
  async signIn(): Promise<VaultAccount> { this.statusAccount = account; return account; }
  async signOut(): Promise<void> { this.statusAccount = null; }
  async list(uid: string): Promise<VaultListing> {
    if (this.statusAccount?.uid !== uid) throw new VaultError('account-changed');
    if (this.failNextList) {
      const failure = this.failNextList;
      this.failNextList = null;
      throw failure;
    }
    return Object.freeze({ snapshots: Object.freeze([...this.remote.values()].map(({ snapshot }) => snapshot)
      .sort((left, right) => left.slot.localeCompare(right.slot))), capacity: VAULT_CAPACITY });
  }
  async stage(uid: string, text: string): Promise<StagedBackup> {
    if (this.statusAccount?.uid !== uid) throw new VaultError('account-changed');
    const id = `00000000-0000-4000-8000-${String(900 + ++this.stageCalls).padStart(12, '0')}`;
    const staged = Object.freeze({ id, bytes: new TextEncoder().encode(text).byteLength, sha256: await digest(text) });
    this.staged.set(id, text);
    if (!this.corruptNextStage) return staged;
    this.corruptNextStage = false;
    return Object.freeze({ ...staged, sha256: 'f'.repeat(64) });
  }
  async upload(uid: string, slot: string, staged: StagedBackup): Promise<VaultReceipt> {
    if (this.statusAccount?.uid !== uid) throw new VaultError('account-changed');
    this.uploadCalls = [...this.uploadCalls, Object.freeze({ slot, staged })];
    if (this.beforeUpload) await this.beforeUpload();
    if (this.failNextUpload) {
      const failure = this.failNextUpload;
      this.failNextUpload = null;
      throw failure;
    }
    const text = this.staged.get(staged.id);
    if (text === undefined) throw new VaultError('staging-missing');
    const existing = this.remote.get(slot);
    if (existing) {
      if (existing.snapshot.bytes !== staged.bytes || existing.snapshot.sha256 !== staged.sha256) {
        throw new VaultError('conflict');
      }
      return Object.freeze({ snapshot: existing.snapshot, verified: true });
    }
    const decoded = JSON.parse(text) as { exportedAt: string; drafts: readonly unknown[]; playlists: readonly unknown[] };
    const snapshot: VaultSnapshot = Object.freeze({
      slot,
      bytes: staged.bytes,
      sha256: staged.sha256,
      generation: String(this.generation++),
      createdAt: stableDate,
      exportedAt: decoded.exportedAt,
      counts: countsForBackup(JSON.parse(text) as ReturnType<typeof import('../library-backup/codec.ts').decodeLibraryBackup>),
    });
    this.remote.set(slot, Object.freeze({ snapshot, text }));
    this.afterRemoteCommit?.();
    if (this.loseNextUploadResponse) {
      this.loseNextUploadResponse = false;
      throw new VaultError('unavailable');
    }
    return Object.freeze({ snapshot, verified: true });
  }
  async download(uid: string, snapshot: VaultSnapshot): Promise<string> {
    if (this.statusAccount?.uid !== uid) throw new VaultError('account-changed');
    const file = this.remote.get(snapshot.slot);
    if (!file || file.snapshot.sha256 !== snapshot.sha256 || file.snapshot.generation !== snapshot.generation) {
      throw new VaultError('missing');
    }
    this.downloadCalls += 1;
    return file.text;
  }
  async discard(uid: string, stagedId: string): Promise<void> {
    if (this.statusAccount?.uid !== uid) throw new VaultError('account-changed');
    this.staged.delete(stagedId);
  }
  async retainStaged(uid: string, ids: readonly string[]): Promise<void> {
    if (this.statusAccount?.uid !== uid) throw new VaultError('account-changed');
    this.retainedIds = [...ids];
    for (const id of this.staged.keys()) if (!ids.includes(id)) this.staged.delete(id);
  }

  async seed(text: string, slot: string): Promise<VaultSnapshot> {
    const bytes = new TextEncoder().encode(text).byteLength;
    const snapshot: VaultSnapshot = Object.freeze({
      slot, bytes, sha256: await digest(text), generation: String(this.generation++),
      createdAt: stableDate,
      exportedAt: (JSON.parse(text) as { exportedAt: string }).exportedAt,
      counts: countsForBackup(JSON.parse(text) as ReturnType<typeof import('../library-backup/codec.ts').decodeLibraryBackup>),
    });
    this.remote.set(slot, Object.freeze({ snapshot, text }));
    return snapshot;
  }
}

function setup(options: { drafts?: readonly LocalClimbDraft[]; vault?: FakeVault; online?: () => boolean } = {}) {
  const preservation = new FakePreservation(options.drafts);
  const vault = options.vault ?? new FakeVault();
  const backupService = new LibraryBackupService(preservation.store, () => new Date(stableDate));
  const coordinator = createAutomaticBackup({ preservation, backupService, vault,
    now: () => new Date(stableDate), isOnline: options.online ?? (() => true) });
  return { preservation, vault, coordinator };
}

async function writeRecord(preservation: FakePreservation, name = 'Saved climb'): Promise<LocalClimbDraft> {
  const draft = climb(name);
  preservation.commit(draft);
  return draft;
}

function bindControl(preservation: FakePreservation, binding: BackupControl['binding'], history: readonly VaultSnapshot[], admission: BackupControl['admission'] = 'active'): void {
  preservation.record = Object.freeze({ ...preservation.record, version: preservation.record.version + 1,
    control: decodeBackupControl({ ...emptyBackupControl(), binding, history, admission }) });
}

afterEach(() => {
  vi.useRealTimers();
  nextClimbId = 501;
});

describe('automatic backup coordinator', () => {
  it('admits a fresh empty installation without creating an empty cloud snapshot', async () => {
    const { preservation, vault, coordinator } = setup();
    coordinator.start();
    await coordinator.retry();
    expect(preservation.record.control).toMatchObject({ admission: 'active', binding: { uid: account.uid } });
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'pending', protectedRevision: null });
    expect(vault.stageCalls).toBe(0);
    expect(vault.uploadCalls).toHaveLength(0);
    coordinator.close();
  });

  it('requires explicit local-library admission before backing up existing local records', async () => {
    const { preservation, vault, coordinator } = setup({ drafts: [climb('Existing local climb')] });
    coordinator.start();
    await coordinator.retry();
    expect(coordinator.getSnapshot().phase).toBe('discovery');
    expect(vault.uploadCalls).toHaveLength(0);
    await coordinator.useLocalLibrary();
    expect(vault.uploadCalls).toHaveLength(1);
    expect(preservation.record.control.protected).toMatchObject({ revision: 0, snapshot: { slot: '00000' } });
    expect(coordinator.getSnapshot().phase).toBe('protected');
    coordinator.close();
  });

  it('blocks an empty fresh installation from uploading over retained history', async () => {
    const vault = new FakeVault();
    const text = encodeLibraryBackup({ drafts: [], playlists: [] }, new Date(stableDate));
    await vault.seed(text, '00000');
    const { preservation, coordinator } = setup({ vault });
    coordinator.start();
    await coordinator.retry();
    expect(coordinator.getSnapshot().phase).toBe('recovery-required');
    expect(preservation.record.control.admission).toBe('discovery');
    expect(vault.uploadCalls).toHaveLength(0);
    coordinator.close();
  });

  it('moves an admitted library emptied by deletion back to recovery discovery', async () => {
    const prior = climb('Deleted after backup');
    const vault = new FakeVault();
    const source = await vault.seed(encodeLibraryBackup({ drafts: [prior], playlists: [] }, new Date(stableDate)), '00000');
    const { preservation, coordinator } = setup({ vault });
    preservation.record = Object.freeze({ revision: 1, version: 1, recovery: null,
      control: decodeBackupControl({
        binding: { uid: account.uid, installationId, scope: 'library-v1' },
        admission: 'active', history: [source], pending: null,
        protected: { revision: 0, snapshot: source, verifiedAt: stableDate },
      }) });

    await coordinator.retry();

    expect(coordinator.getSnapshot().phase).toBe('recovery-required');
    expect(preservation.record.control).toMatchObject({ admission: 'discovery', history: [source], pending: null });
    expect(vault.remote.size).toBe(1);
    expect(vault.uploadCalls).toHaveLength(0);
    coordinator.close();
  });

  it.each([
    ['copied native installation', (vault: FakeVault) => { vault.nativeInstallationId = '00000000-0000-4000-8000-000000000777'; }],
    ['changed backup pool', (vault: FakeVault) => { vault.scope = 'acceptance-v1/r002'; }],
  ])('does not admit copied active state after a %s change', async (_label, changeBinding) => {
    const source = climb('Prior installation copy');
    const vault = new FakeVault();
    const snapshot = await vault.seed(encodeLibraryBackup({ drafts: [source], playlists: [] }, new Date(stableDate)), '00000');
    changeBinding(vault);
    const { preservation, coordinator } = setup({ drafts: [climb('Local records')], vault });
    bindControl(preservation, { uid: account.uid, installationId, scope: 'library-v1' }, [snapshot]);

    await coordinator.retry();

    expect(coordinator.getSnapshot().phase).toBe('discovery');
    expect(preservation.record.control).toMatchObject({ admission: 'discovery', binding: {
      uid: account.uid, installationId: vault.nativeInstallationId, scope: vault.scope,
    } });
    expect(vault.uploadCalls).toHaveLength(0);
    coordinator.close();
  });

  it('does not upload a copied pending stage under a new native installation binding', async () => {
    const vault = new FakeVault();
    const local = climb('Copied pending library');
    const staged = await vault.stage(account.uid,
      encodeLibraryBackup({ drafts: [local], playlists: [] }, new Date(stableDate)));
    vault.nativeInstallationId = '00000000-0000-4000-8000-000000000778';
    const { preservation, coordinator } = setup({ drafts: [local], vault });
    preservation.record = Object.freeze({ ...preservation.record, version: 1,
      control: decodeBackupControl({ binding: { uid: account.uid, installationId, scope: 'library-v1' },
        admission: 'active', history: [], pending: { id: staged.id, revision: 0, slot: '00000', staged,
          capturedAt: stableDate }, protected: null }) });

    await coordinator.retry();

    expect(coordinator.getSnapshot().phase).toBe('discovery');
    expect(preservation.record.control).toMatchObject({ admission: 'discovery', pending: null,
      binding: { installationId: vault.nativeInstallationId } });
    expect(vault.uploadCalls).toHaveLength(0);
    coordinator.close();
  });

  it('treats a different account as a fresh discovery boundary', async () => {
    const otherAccount: VaultAccount = { uid: 'climber_2', email: null };
    const vault = new FakeVault();
    const source = climb('Other account retained copy');
    const snapshot = await vault.seed(encodeLibraryBackup({ drafts: [source], playlists: [] }, new Date(stableDate)), '00000');
    vault.statusAccount = otherAccount;
    const { preservation, coordinator } = setup({ drafts: [climb('Local library')], vault });
    bindControl(preservation, { uid: account.uid, installationId, scope: 'library-v1' }, []);

    await coordinator.retry();

    expect(coordinator.getSnapshot().phase).toBe('discovery');
    expect(preservation.record.control).toMatchObject({ admission: 'discovery', binding: { uid: otherAccount.uid }, history: [snapshot] });
    expect(vault.uploadCalls).toHaveLength(0);
    coordinator.close();
  });

  it('checks the local recovery barrier before the offline gate and keeps failures retryable', async () => {
    let online = false;
    const { preservation, vault, coordinator } = setup({ online: () => online });
    preservation.recoveryError = new Error('Library recovery verification mismatch: canonical records differ');

    await coordinator.retry();
    expect(preservation.verifyCalls).toBe(1);
    expect(vault.statusCalls).toBe(0);
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'verifying-recovery' });

    preservation.recoveryError = null;
    await coordinator.retry();
    expect(preservation.verifyCalls).toBe(2);
    expect(vault.statusCalls).toBe(0);
    expect(coordinator.getSnapshot().phase).toBe('offline');

    online = true;
    await coordinator.retry();
    expect(preservation.verifyCalls).toBe(3);
    expect(vault.statusCalls).toBeGreaterThan(0);
    expect(coordinator.getSnapshot().phase).toBe('pending');
    coordinator.close();
  });

  it.each(['sign-out', 'close'] as const)(
    'does not publish a late final preservation read after %s', async (boundary) => {
      let releaseRead!: () => void;
      let readStarted!: () => void;
      let protectedReads = 0;
      const waiting = new Promise<void>((resolve) => { releaseRead = resolve; });
      const started = new Promise<void>((resolve) => { readStarted = resolve; });
      const { preservation, coordinator } = setup({ drafts: [climb(`Late ${boundary}`)] });
      await coordinator.retry();
      preservation.beforeRead = async (record) => {
        if (record.control.protected?.revision === 0 && ++protectedReads === 3) {
          readStarted();
          await waiting;
        }
      };
      const adoption = coordinator.useLocalLibrary();
      await started;

      if (boundary === 'sign-out') {
        const signingOut = coordinator.signOut();
        releaseRead();
        await Promise.all([adoption, signingOut]);
        expect(coordinator.getSnapshot().phase).toBe('signed-out');
      } else {
        const beforeClose = coordinator.getSnapshot();
        coordinator.close();
        releaseRead();
        await adoption;
        expect(coordinator.getSnapshot()).toEqual(beforeClose);
      }
      coordinator.close();
    },
  );

  it('uses refreshed pending history when a save arrives during pending resolution', async () => {
    const vault = new FakeVault();
    const initial = climb('Pending upload');
    const staged = await vault.stage(account.uid,
      encodeLibraryBackup({ drafts: [initial], playlists: [] }, new Date(stableDate)));
    const { preservation, coordinator } = setup({ drafts: [initial], vault });
    preservation.record = Object.freeze({ ...preservation.record, version: 1,
      control: decodeBackupControl({ binding: { uid: account.uid, installationId, scope: 'library-v1' },
        admission: 'active', history: [], pending: { id: staged.id, revision: 0, slot: '00000', staged,
          capturedAt: stableDate }, protected: null }) });
    preservation.beforeCapture = async (call) => {
      if (call === 2) preservation.commit(climb('Saved during pending resolution'));
    };

    await coordinator.retry();

    expect(vault.remote.size).toBe(2);
    expect(vault.remote.has('00000')).toBe(true);
    expect(vault.remote.has('00001')).toBe(true);
    expect(vault.stageCalls).toBe(2);
    expect(preservation.record.control).toMatchObject({
      admission: 'active',
      pending: null,
      protected: { revision: 1, snapshot: { slot: '00001' } },
    });
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'protected', revision: 1 });
    coordinator.close();
  });

  it('coalesces committed changes and honors the 60-second maximum wait', async () => {
    vi.useFakeTimers();
    const { preservation, vault, coordinator } = setup();
    coordinator.start();
    await coordinator.retry();
    await writeRecord(preservation, 'First');
    await vi.advanceTimersByTimeAsync(20_000);
    await writeRecord(preservation, 'Second');
    await vi.advanceTimersByTimeAsync(20_000);
    await writeRecord(preservation, 'Third');
    await vi.advanceTimersByTimeAsync(19_999);
    expect(vault.uploadCalls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(vault.uploadCalls).toHaveLength(1));
    expect(vault.uploadCalls).toHaveLength(1);
    expect(vault.remote.values().next().value?.snapshot.counts.climbs).toBe(3);
    coordinator.close();
  });

  it('marks a protected revision pending immediately and uploads after the 30-second quiet period', async () => {
    vi.useFakeTimers();
    const { preservation, vault, coordinator } = setup({ drafts: [climb('Already protected')] });
    coordinator.start();
    await coordinator.retry();
    await coordinator.useLocalLibrary();
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'protected', revision: 0,
      protectedRevision: { revision: 0 } });
    await writeRecord(preservation, 'Automatic timer');
    expect(coordinator.getSnapshot().phase).toBe('pending');
    await vi.waitFor(() => expect(coordinator.getSnapshot().revision).toBe(1));
    await vi.advanceTimersByTimeAsync(29_999);
    expect(vault.uploadCalls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(vault.uploadCalls).toHaveLength(2));
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'protected', revision: 1,
      protectedRevision: { revision: 1 } });
    coordinator.close();
  });

  it('recovers a lost upload response from the exact pending bytes without changing slots', async () => {
    const vault = new FakeVault();
    vault.loseNextUploadResponse = true;
    const { preservation, coordinator } = setup({ drafts: [climb('Pending climb')], vault });
    coordinator.start();
    await coordinator.retry();
    await coordinator.useLocalLibrary();
    const pending = preservation.record.control.pending;
    expect(pending).toMatchObject({ slot: '00000', revision: 0 });
    expect(vault.uploadCalls).toHaveLength(1);
    coordinator.close();

    const reopened = createAutomaticBackup({ preservation, backupService: new LibraryBackupService(preservation.store), vault,
      now: () => new Date(stableDate), isOnline: () => true });
    reopened.start();
    await reopened.retry();
    expect(preservation.record.control.pending).toBeNull();
    expect(preservation.record.control.protected).toMatchObject({ revision: 0, snapshot: { slot: '00000' } });
    expect(vault.uploadCalls).toHaveLength(1);
    expect(vault.downloadCalls).toBeGreaterThan(0);
    reopened.close();
  });

  it('retries a transient upload failure on the bounded foreground backoff without restaging', async () => {
    vi.useFakeTimers();
    const vault = new FakeVault();
    vault.failNextUpload = new VaultError('unavailable');
    const { preservation, coordinator } = setup({ drafts: [climb('Backoff retry')], vault });
    coordinator.start();
    await coordinator.retry();
    await coordinator.useLocalLibrary();
    expect(coordinator.getSnapshot().phase).toBe('error');
    expect(preservation.record.control.pending).toMatchObject({ slot: '00000', revision: 0 });
    expect(vault.uploadCalls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(vault.uploadCalls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(coordinator.getSnapshot().phase).toBe('protected'));
    expect(vault.uploadCalls).toHaveLength(2);
    expect(vault.uploadCalls[0]?.staged.id).toBe(vault.uploadCalls[1]?.staged.id);
    expect(vault.stageCalls).toBe(1);
    coordinator.close();
  });

  it('abandons an absent staged upload explicitly and captures the current revision again', async () => {
    const vault = new FakeVault();
    const draft = climb('Restage after missing file');
    const text = encodeLibraryBackup({ drafts: [draft], playlists: [] }, new Date(stableDate));
    const staged = await vault.stage(account.uid, text);
    vault.staged.delete(staged.id);
    const { preservation, coordinator } = setup({ drafts: [draft], vault });
    preservation.record = Object.freeze({ ...preservation.record, version: 1,
      control: decodeBackupControl({ binding: { uid: account.uid, installationId, scope: 'library-v1' },
        admission: 'active', history: [], pending: { id: staged.id, revision: 0, slot: '00000', staged,
          capturedAt: stableDate }, protected: null }) });
    coordinator.start();
    await coordinator.retry();
    expect(preservation.record.control.pending).toBeNull();
    expect(preservation.record.control.protected).toMatchObject({ revision: 0, snapshot: { slot: '00000' } });
    expect(vault.uploadCalls).toHaveLength(2);
    expect(vault.uploadCalls[0]?.staged.id).toBe(staged.id);
    expect(vault.uploadCalls[1]?.staged.id).not.toBe(staged.id);
    expect(vault.remote.size).toBe(1);
    coordinator.close();
  });

  it('settles the exact pending slot before explicit local admission and retains unknown history', async () => {
    const vault = new FakeVault();
    await vault.seed(encodeLibraryBackup({ drafts: [climb('Other retained copy')], playlists: [] },
      new Date(stableDate)), '00000');
    const local = climb('Chosen local library');
    const staged = await vault.stage(account.uid,
      encodeLibraryBackup({ drafts: [local], playlists: [] }, new Date(stableDate)));
    const { preservation, coordinator } = setup({ drafts: [local], vault });
    preservation.record = Object.freeze({ ...preservation.record, version: 1,
      control: decodeBackupControl({ binding: { uid: account.uid, installationId, scope: 'library-v1' },
        admission: 'active', history: [], pending: { id: staged.id, revision: 0, slot: '00001', staged,
          capturedAt: stableDate }, protected: null }) });
    coordinator.start();
    await coordinator.retry();
    expect(coordinator.getSnapshot().phase).toBe('discovery');
    await coordinator.useLocalLibrary();
    expect(preservation.record.control).toMatchObject({ admission: 'active', pending: null,
      protected: { revision: 0, snapshot: { slot: '00001' } } });
    expect(preservation.record.control.history.map(({ slot }) => slot)).toEqual(['00000', '00001']);
    expect(vault.uploadCalls).toHaveLength(1);
    expect(coordinator.getSnapshot().phase).toBe('protected');
    coordinator.close();
  });

  it('keeps revision R+1 pending when the in-flight receipt only covers R', async () => {
    let releaseUpload!: () => void;
    let uploadStarted!: () => void;
    const waiting = new Promise<void>((resolve) => { releaseUpload = resolve; });
    const started = new Promise<void>((resolve) => { uploadStarted = resolve; });
    const vault = new FakeVault();
    vault.beforeUpload = async () => { uploadStarted(); await waiting; };
    const { preservation, coordinator } = setup({ drafts: [climb('Revision one')], vault });
    coordinator.start();
    await coordinator.retry();
    const adoption = coordinator.useLocalLibrary();
    await started;
    preservation.commit(climb('Revision two'));
    releaseUpload();
    await adoption;
    expect(preservation.record).toMatchObject({ revision: 1, control: { protected: { revision: 0 }, pending: null } });
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'pending', revision: 1, protectedRevision: { revision: 0 } });
    expect(vault.uploadCalls).toHaveLength(1);
    coordinator.close();
  });

  it('invalidates an in-flight completion at sign-out, then reconciles it on same-account sign-in', async () => {
    let releaseUpload!: () => void;
    let uploadStarted!: () => void;
    const waiting = new Promise<void>((resolve) => { releaseUpload = resolve; });
    const started = new Promise<void>((resolve) => { uploadStarted = resolve; });
    const vault = new FakeVault();
    vault.beforeUpload = async () => { uploadStarted(); await waiting; };
    const { preservation, coordinator } = setup({ drafts: [climb('Sign-out race')], vault });
    coordinator.start();
    await coordinator.retry();
    const adoption = coordinator.useLocalLibrary();
    await started;
    const signingOut = coordinator.signOut();
    releaseUpload();
    await Promise.all([adoption, signingOut]);
    expect(coordinator.getSnapshot().phase).toBe('signed-out');
    expect(preservation.record.control.pending).toMatchObject({ revision: 0, slot: '00000' });
    await coordinator.signIn();
    expect(preservation.record.control.pending).toBeNull();
    expect(preservation.record.control.protected).toMatchObject({ revision: 0, snapshot: { slot: '00000' } });
    expect(vault.uploadCalls).toHaveLength(1);
    coordinator.close();
  });

  it('enters durable discovery when a remote writer adds an unknown version', async () => {
    const vault = new FakeVault();
    const first = await vault.seed(encodeLibraryBackup({ drafts: [], playlists: [] }, new Date(stableDate)), '00000');
    const second = await vault.seed(encodeLibraryBackup({ drafts: [climb('Other writer')], playlists: [] }, new Date(stableDate)), '00001');
    const { preservation, coordinator } = setup({ drafts: [climb('Local')], vault });
    bindControl(preservation, { uid: account.uid, installationId, scope: 'library-v1' }, [first]);
    coordinator.start();
    await coordinator.retry();
    expect(coordinator.getSnapshot().phase).toBe('discovery');
    expect(preservation.record.control).toMatchObject({ admission: 'discovery', history: [first, second] });
    expect(vault.uploadCalls).toHaveLength(0);
    coordinator.close();
  });

  it('retries pending CAS after a concurrent control-version change without losing the upload', async () => {
    const { preservation, vault, coordinator } = setup({ drafts: [climb('CAS retry')] });
    coordinator.start();
    await coordinator.retry();
    preservation.rejectNextCas = true;
    await coordinator.useLocalLibrary();
    expect(preservation.casAttempts).toBeGreaterThan(1);
    expect(preservation.record.control.protected).toMatchObject({ revision: 0, snapshot: { slot: '00000' } });
    expect(vault.uploadCalls).toHaveLength(1);
    coordinator.close();
  });

  it('reconciles a committed remote copy when local receipt acknowledgement fails', async () => {
    const { preservation, vault, coordinator } = setup({ drafts: [climb('Remote committed before CAS failure')] });
    await coordinator.retry();
    vault.afterRemoteCommit = () => { preservation.throwNextCas = true; };

    await coordinator.useLocalLibrary();

    expect(vault.remote.size).toBe(1);
    expect(preservation.record.control).toMatchObject({
      pending: { slot: '00000', revision: 0 },
      protected: null,
    });
    expect(coordinator.getSnapshot().phase).toBe('error');

    vault.afterRemoteCommit = null;
    await coordinator.retry();

    expect(preservation.record.control).toMatchObject({
      pending: null,
      protected: { revision: 0, snapshot: { slot: '00000' } },
    });
    expect(vault.remote.size).toBe(1);
    expect(vault.stageCalls).toBe(1);
    expect(vault.uploadCalls).toHaveLength(1);
    expect(coordinator.getSnapshot().phase).toBe('protected');
    coordinator.close();
  });

  it('does not acknowledge corrupt staged bytes or replace the prior protected copy', async () => {
    const { preservation, vault, coordinator } = setup({ drafts: [climb('Prior good copy')] });
    await coordinator.retry();
    await coordinator.useLocalLibrary();
    const prior = preservation.record.control.protected;
    expect(prior).not.toBeNull();
    preservation.commit(climb('Must not be acknowledged'));
    vault.corruptNextStage = true;

    await coordinator.retry();

    expect(coordinator.getSnapshot().phase).toBe('error');
    expect(preservation.record.control).toMatchObject({ pending: null, protected: prior });
    expect(vault.remote.size).toBe(1);
    expect(vault.uploadCalls).toHaveLength(1);
    coordinator.close();
  });

  it('explains when the connected account is not enabled for private backups', async () => {
    const vault = new FakeVault();
    vault.failNextList = new VaultError('not-admitted');
    const { coordinator } = setup({ drafts: [climb('Account policy')], vault });

    await coordinator.retry();

    expect(coordinator.getSnapshot()).toMatchObject({
      phase: 'discovery',
      error: expect.stringMatching(/account.*not enabled|not enabled.*account/i),
    });
    expect(coordinator.getSnapshot().error).not.toMatch(/review retained backups/i);
    coordinator.close();
  });

  it('reports unresolved local pending recovery instead of account admission failure', async () => {
    const vault = new FakeVault();
    const source = await vault.seed(encodeLibraryBackup({ drafts: [climb('Selected recovery')], playlists: [] }, new Date(stableDate)), '00000');
    const { preservation, coordinator } = setup({ vault });
    await coordinator.retry();
    const listing = await coordinator.history();
    const review = await coordinator.review(listing.snapshots[0]!);
    const pendingDraft = climb('Pending local backup');
    const staged = await vault.stage(account.uid,
      encodeLibraryBackup({ drafts: [pendingDraft], playlists: [] }, new Date(stableDate)));
    preservation.record = Object.freeze({ ...preservation.record, version: preservation.record.version + 1,
      control: decodeBackupControl({ binding: { uid: account.uid, installationId, scope: 'library-v1' },
        admission: 'active', history: [source], pending: { id: staged.id, revision: 0, slot: '00001', staged,
          capturedAt: stableDate }, protected: null }) });
    vault.beforeUpload = async () => {
      await vault.seed(encodeLibraryBackup({ drafts: [climb('Conflicting writer')], playlists: [] }, new Date(stableDate)), '00001');
    };

    const outcome = await coordinator.restore(review);

    expect(outcome).toMatchObject({ status: 'failed', phase: 'preflight' });
    if (outcome.status !== 'failed') throw new Error('Expected pending recovery to fail before restore.');
    expect(outcome.error.message).toMatch(/pending backup.*resolve|backup.*pending/i);
    expect(outcome.error).not.toMatchObject({ code: 'not-admitted' });
    expect(preservation.drafts).toHaveLength(0);
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'discovery' });
    coordinator.close();
  });

  it('restores a reviewed cloud copy and binds the source receipt without uploading a duplicate', async () => {
    const vault = new FakeVault();
    const source = climb('Cloud recovery');
    const sourceText = encodeLibraryBackup({ drafts: [source], playlists: [] }, new Date(stableDate));
    const sourceSnapshot = await vault.seed(sourceText, '00003');
    const { preservation, coordinator } = setup({ vault });
    coordinator.start();
    await coordinator.retry();
    const listing = await coordinator.history();
    const review = await coordinator.review(listing.snapshots[0]!);
    const restored = await coordinator.restore(review);
    expect(restored).toMatchObject({ status: 'complete', drafts: { added: 1 } });
    expect(preservation.record.control).toMatchObject({
      admission: 'active',
      protected: { revision: 1, snapshot: sourceSnapshot },
      pending: null,
    });
    expect(vault.uploadCalls).toHaveLength(0);
    expect(coordinator.getSnapshot().phase).toBe('protected');
    coordinator.close();
  });

  it('keeps a committed local restore complete when cloud history refresh fails afterward', async () => {
    const vault = new FakeVault();
    const source = climb('Committed despite cloud outage');
    const sourceSnapshot = await vault.seed(
      encodeLibraryBackup({ drafts: [source], playlists: [] }, new Date(stableDate)), '00000');
    const { preservation, coordinator } = setup({ vault });
    coordinator.start();
    await coordinator.retry();
    const listing = await coordinator.history();
    const review = await coordinator.review(listing.snapshots[0]!);
    preservation.afterRestore = () => { vault.failNextList = new VaultError('unavailable'); };
    const outcome = await coordinator.restore(review);
    expect(outcome).toMatchObject({ status: 'complete', drafts: { added: 1 } });
    expect(preservation.drafts.map(({ id }) => id)).toEqual([source.id]);
    expect(preservation.record.control.protected).toBeNull();
    expect(coordinator.getSnapshot().phase).toBe('error');
    expect(vault.uploadCalls).toHaveLength(0);
    expect(sourceSnapshot.slot).toBe('00000');
    coordinator.close();
  });

  it('blocks restore before mutation while the local recovery verification barrier remains set', async () => {
    const vault = new FakeVault();
    await vault.seed(encodeLibraryBackup({ drafts: [climb('Held restore')], playlists: [] }, new Date(stableDate)), '00000');
    const { preservation, coordinator } = setup({ vault });
    coordinator.start();
    await coordinator.retry();
    const listing = await coordinator.history();
    const review = await coordinator.review(listing.snapshots[0]!);
    preservation.recoveryError = new Error('Library recovery verification is pending');
    const outcome = await coordinator.restore(review);
    expect(outcome).toMatchObject({ status: 'failed', phase: 'preflight' });
    expect(preservation.drafts).toHaveLength(0);
    expect(coordinator.getSnapshot().phase).toBe('verifying-recovery');
    coordinator.close();
  });

  it('retains remote history and uploads the merged library after explicit recovery admission', async () => {
    const vault = new FakeVault();
    const sourceText = encodeLibraryBackup({ drafts: [climb('Cloud recovery')], playlists: [] }, new Date(stableDate));
    const sourceSnapshot = await vault.seed(sourceText, '00000');
    const local = climb('Local extra');
    const { preservation, coordinator } = setup({ drafts: [local], vault });
    coordinator.start();
    await coordinator.retry();
    const review = await coordinator.review(sourceSnapshot);
    const restored = await coordinator.restore(review);
    expect(restored.status).toBe('complete');
    expect(vault.remote.size).toBe(2);
    expect(preservation.record.control.history).toHaveLength(2);
    expect(coordinator.getSnapshot().phase).toBe('protected');
    expect(vault.uploadCalls).toHaveLength(1);
    coordinator.close();
  });

  it('does not run foreground timers while paused and retries promptly on resume', async () => {
    vi.useFakeTimers();
    const { preservation, vault, coordinator } = setup();
    coordinator.start();
    await coordinator.retry();
    coordinator.setForeground(false);
    await writeRecord(preservation, 'Paused edit');
    await vi.advanceTimersByTimeAsync(90_000);
    expect(vault.uploadCalls).toHaveLength(0);
    coordinator.setForeground(true);
    await vi.waitFor(() => expect(vault.uploadCalls).toHaveLength(1));
    expect(vault.uploadCalls).toHaveLength(1);
    coordinator.close();
  });

  it('pauses at full retained-history capacity without pruning or staging a new copy', async () => {
    const vault = new FakeVault();
    const seed = await vault.seed(encodeLibraryBackup({ drafts: [], playlists: [] }, new Date(stableDate)), '00000');
    const snapshots: VaultSnapshot[] = [];
    for (let index = 0; index < VAULT_CAPACITY.slots; index += 1) {
      const slot = String(index).padStart(5, '0');
      const snapshot = Object.freeze({ ...seed, slot, generation: String(index + 1) });
      snapshots.push(snapshot);
      vault.remote.set(slot, Object.freeze({ snapshot, text: vault.remote.get('00000')!.text }));
    }
    const { preservation, coordinator } = setup({ drafts: [climb('Capacity stop')], vault });
    bindControl(preservation, { uid: account.uid, installationId, scope: 'library-v1' }, snapshots);
    coordinator.start();
    await coordinator.retry();
    expect(coordinator.getSnapshot().phase).toBe('capacity');
    expect(vault.remote.size).toBe(VAULT_CAPACITY.slots);
    expect(vault.stageCalls).toBe(0);
    expect(vault.uploadCalls).toHaveLength(0);
    coordinator.close();
  });
});
