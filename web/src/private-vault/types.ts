export type VaultScope = 'library-v1' | 'acceptance-v1/r001' | 'acceptance-v1/r002'
  | 'acceptance-v1/r003' | 'acceptance-v1/r004';

export interface VaultContentCounts {
  readonly climbs: number;
  readonly finished: number;
  readonly drafts: number;
  readonly trash: number;
  readonly playlists: number;
}

export interface VaultAccount {
  readonly uid: string;
  readonly email: string | null;
}

export interface VaultStatus {
  readonly configured: boolean;
  readonly installationId: string;
  readonly scope: VaultScope;
  readonly account: VaultAccount | null;
}

export interface VaultSnapshot {
  readonly slot: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly generation: string;
  readonly createdAt: string;
  readonly exportedAt: string;
  readonly counts: VaultContentCounts;
}

export interface StagedBackup {
  readonly id: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface VaultListing {
  readonly snapshots: readonly VaultSnapshot[];
  readonly capacity: {
    readonly slots: number;
    readonly bytesPerSlot: number;
  };
}

export interface VaultReceipt {
  readonly snapshot: VaultSnapshot;
  readonly verified: true;
}

export interface PrivateVault {
  status(): Promise<VaultStatus>;
  signIn(): Promise<VaultAccount>;
  signOut(): Promise<void>;
  list(uid: string): Promise<VaultListing>;
  stage(uid: string, text: string): Promise<StagedBackup>;
  upload(uid: string, slot: string, staged: StagedBackup): Promise<VaultReceipt>;
  download(uid: string, snapshot: VaultSnapshot): Promise<string>;
  discard(uid: string, stagedId: string): Promise<void>;
  retainStaged(uid: string, ids: readonly string[]): Promise<void>;
}
