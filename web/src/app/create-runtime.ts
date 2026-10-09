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
import { createCatalogService, type CatalogService } from '../catalog/service.ts';
import { SqliteCatalogPort } from '../data/sqlite/sqlite-catalog-port.ts';
import type { BoardDefinition } from '../domain/boards/definition.ts';

export interface CruxControlRuntime {
  readonly installation: ConfiguredBoardInstallation;
  readonly drafts: LocalDraftRepository;
  readonly playlists: LocalPlaylistRepository;
  readonly backup?: LibraryBackupService;
  readonly backupDelivery?: LibraryBackupDelivery;
  readonly catalog: CatalogService;
  readonly controller: BoardLightController | null;
  close(): void;
}

export interface CruxControlRuntimeDependencies {
  readonly openDrafts?: () => Promise<IDBDatabase>;
  readonly openPlaylists?: () => Promise<IDBDatabase>;
  readonly getInstallation?: () => ConfiguredBoardInstallation;
  readonly backupDelivery?: LibraryBackupDelivery;
  readonly createCatalog?: (definition: BoardDefinition) => CatalogService;
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
    const catalog = (dependencies.createCatalog ?? ((definition) => createCatalogService(definition, {
      createPort: () => SqliteCatalogPort.create(),
      fetcher: globalThis.fetch.bind(globalThis),
    })))(installation.definition);
    return Object.freeze({
      installation,
      drafts,
      playlists,
      backup,
      backupDelivery: dependencies.backupDelivery ?? browserLibraryBackupDelivery,
      catalog,
      controller: installation.createController(),
      close: () => {
        void catalog.close().catch(() => undefined);
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
