import type { LibrarySnapshot } from '../library-backup/types.ts';
import type {
  StagedBackup,
  VaultAccount,
  VaultScope,
  VaultSnapshot,
} from '../private-vault/types.ts';

export interface VaultBinding {
  readonly uid: string;
  readonly installationId: string;
  readonly scope: VaultScope;
}

export interface PendingBackup {
  readonly id: string;
  readonly revision: number;
  readonly slot: string;
  readonly staged: StagedBackup;
  readonly capturedAt: string;
}

export interface ProtectedRevision {
  readonly revision: number;
  readonly snapshot: VaultSnapshot;
  readonly verifiedAt: string;
}

export interface BackupControl {
  readonly binding: VaultBinding | null;
  readonly admission: 'discovery' | 'active';
  readonly history: readonly VaultSnapshot[];
  readonly pending: PendingBackup | null;
  readonly protected: ProtectedRevision | null;
}

export interface RecoveryVerification {
  readonly revision: number;
  readonly sha256: string;
}

export interface PreservationRecord {
  readonly revision: number;
  readonly version: number;
  readonly control: BackupControl;
  readonly recovery: RecoveryVerification | null;
}

export interface LibraryPreservation {
  read(): Promise<PreservationRecord>;
  capture(): Promise<Readonly<{ revision: number; snapshot: LibrarySnapshot }>>;
  compareAndSet(version: number, control: BackupControl): Promise<boolean>;
  verifyRecovery(): Promise<void>;
  subscribe(listener: (event: 'committed' | 'write-failed') => void): () => void;
}

export interface BackupStatus {
  readonly phase:
    | 'checking'
    | 'not-configured'
    | 'signed-out'
    | 'discovery'
    | 'recovery-required'
    | 'pending'
    | 'uploading'
    | 'protected'
    | 'offline'
    | 'capacity'
    | 'error'
    | 'verifying-recovery';
  readonly account: VaultAccount | null;
  readonly revision: number | null;
  readonly protectedRevision: ProtectedRevision | null;
  readonly localSaveFailed: boolean;
  readonly error: string | null;
}

export interface OnlineBackupReview {
  readonly snapshot: VaultSnapshot;
  readonly backup: import('../library-backup/types.ts').DecodedLibraryBackup;
  readonly review: import('../library-backup/types.ts').BackupReview;
}
