import type { BoardLightController } from '../board-control/light-controller';
import {
  IndexedDbLocalDraftRepository,
  openDraftDatabase,
  type LocalDraftRepository,
} from '../drafts';
import type { ConfiguredBoardInstallation } from '../installations/contracts';
import {
  IndexedDbLocalPlaylistRepository,
  openPlaylistDatabase,
  type LocalPlaylistRepository,
} from '../playlists';
import {
  browserLibraryBackupDelivery,
  IndexedDbLibraryBackupStore,
  LibraryBackupService,
  type LibraryBackupDelivery,
} from '../library-backup';
import { activeInstallationId, createAppInstallationRegistry } from './installations';

export interface CruxControlRuntime {
  readonly installation: ConfiguredBoardInstallation;
  readonly drafts: LocalDraftRepository;
  readonly playlists: LocalPlaylistRepository;
  readonly backup?: LibraryBackupService;
  readonly backupDelivery?: LibraryBackupDelivery;
  readonly controller: BoardLightController | null;
  close(): void;
}

export interface CruxControlRuntimeDependencies {
  readonly openDrafts?: () => Promise<IDBDatabase>;
  readonly openPlaylists?: () => Promise<IDBDatabase>;
  readonly getInstallation?: () => ConfiguredBoardInstallation;
  readonly backupDelivery?: LibraryBackupDelivery;
}

export async function createCruxControlRuntime(
  dependencies: CruxControlRuntimeDependencies = {},
): Promise<CruxControlRuntime> {
  let draftDatabase: IDBDatabase | null = null;
  let playlistDatabase: IDBDatabase | null = null;
  try {
    draftDatabase = await (dependencies.openDrafts ?? openDraftDatabase)();
    playlistDatabase = await (dependencies.openPlaylists ?? openPlaylistDatabase)();
    const drafts = new IndexedDbLocalDraftRepository(draftDatabase);
    const playlists = new IndexedDbLocalPlaylistRepository(playlistDatabase);
    const backup = new LibraryBackupService(
      new IndexedDbLibraryBackupStore(draftDatabase, playlistDatabase),
    );
    const installation = (
      dependencies.getInstallation ??
      (() => createAppInstallationRegistry().require(activeInstallationId))
    )();
    return Object.freeze({
      installation,
      drafts,
      playlists,
      backup,
      backupDelivery: dependencies.backupDelivery ?? browserLibraryBackupDelivery,
      controller: installation.createController(),
      close: () => {
        playlistDatabase?.close();
        draftDatabase?.close();
      },
    });
  } catch (error) {
    playlistDatabase?.close();
    draftDatabase?.close();
    throw error;
  }
}
