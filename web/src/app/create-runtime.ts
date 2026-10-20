import { openBrowserLibrary, type AppLibrary } from './library.ts';
import type { BoardLightController } from '../board-control/light-controller';
import type { LocalDraftRepository } from '../drafts';
import type { ConfiguredBoardInstallation } from '../installations/contracts';
import type { LocalPlaylistRepository } from '../playlists';
import {
  browserLibraryBackupDelivery,
  LibraryBackupService,
  type LibraryBackupDelivery,
} from '../library-backup';
import { activeInstallationId, createAppInstallationRegistry } from './installations';
import { createCatalogService, type CatalogService } from '../catalog/service.ts';
import { SqliteCatalogPort } from '../data/sqlite/sqlite-catalog-port.ts';
import { noCatalogUpdates, type CatalogUpdateSource } from '../catalog/update-source.ts';
import type { BoardDefinition } from '../domain/boards/definition.ts';
import type { NativePlaylistSharing } from '../playlists/portable-transports.ts';
import type { BackNavigationPort } from './back-navigation.ts';
import type { AutomaticBackup } from '../automatic-backup/coordinator.ts';
import type { LibraryPreservation } from '../automatic-backup/types.ts';

export interface RestoredFileSaveFailureNotice {
  subscribe(listener: () => void): () => void;
  take(): string | null;
}

export interface CruxControlRuntime {
  readonly installation: ConfiguredBoardInstallation;
  readonly drafts: LocalDraftRepository;
  readonly playlists: LocalPlaylistRepository;
  readonly backup?: LibraryBackupService;
  readonly backupDelivery?: LibraryBackupDelivery;
  readonly automaticBackup?: AutomaticBackup;
  readonly restoredFileSaveFailure?: RestoredFileSaveFailureNotice;
  readonly playlistSharing?: NativePlaylistSharing;
  readonly backNavigation?: BackNavigationPort;
  readonly catalog: CatalogService;
  readonly controller: BoardLightController | null;
  close(): void;
}

export interface CruxControlRuntimeDependencies {
  readonly openLibrary?: () => Promise<AppLibrary>;
  readonly openDrafts?: () => Promise<IDBDatabase>;
  readonly openPlaylists?: () => Promise<IDBDatabase>;
  readonly getInstallation?: () => ConfiguredBoardInstallation;
  readonly backupDelivery?: LibraryBackupDelivery;
  readonly createAutomaticBackup?: (options: Readonly<{
    preservation: LibraryPreservation;
    backupService: LibraryBackupService;
  }>) => AutomaticBackup;
  readonly restoredFileSaveFailure?: RestoredFileSaveFailureNotice;
  readonly playlistSharing?: NativePlaylistSharing;
  readonly backNavigation?: BackNavigationPort;
  readonly createCatalog?: (definition: BoardDefinition) => CatalogService;
  /** Signed-in catalog updates (native shells only); the web/PWA never configures them. */
  readonly catalogUpdates?: CatalogUpdateSource;
}

export async function createCruxControlRuntime(
  dependencies: CruxControlRuntimeDependencies = {},
): Promise<CruxControlRuntime> {
  let library: AppLibrary | null = null;
  let catalog: CatalogService | null = null;
  let automaticBackup: AutomaticBackup | null = null;
  try {
    library = await (dependencies.openLibrary ?? (() => openBrowserLibrary(dependencies)))();
    const { drafts, playlists } = library;
    const backup = new LibraryBackupService(library.backupStore);
    if (library.preservation && dependencies.createAutomaticBackup) {
      automaticBackup = dependencies.createAutomaticBackup({ preservation: library.preservation, backupService: backup });
    }
    const installation = (
      dependencies.getInstallation ??
      (() => createAppInstallationRegistry().require(activeInstallationId))
    )();
    catalog = (
      dependencies.createCatalog ??
      ((definition) =>
        createCatalogService(definition, {
          createPort: () => SqliteCatalogPort.create(),
          fetcher: globalThis.fetch.bind(globalThis),
          updates: dependencies.catalogUpdates ?? noCatalogUpdates,
        }))
    )(installation.definition);
    let closed = false;
    const runtime = Object.freeze({
      installation,
      drafts,
      playlists,
      backup,
      backupDelivery: dependencies.backupDelivery ?? browserLibraryBackupDelivery,
      ...(dependencies.restoredFileSaveFailure
        ? { restoredFileSaveFailure: dependencies.restoredFileSaveFailure }
        : {}),
      ...(automaticBackup ? { automaticBackup } : {}),
      playlistSharing: dependencies.playlistSharing,
      backNavigation: dependencies.backNavigation,
      catalog,
      controller: installation.createController(),
      close: () => {
        if (closed) return;
        closed = true;
        automaticBackup?.close();
        void catalog?.close().catch(() => undefined);
        library?.close();
      },
    });
    automaticBackup?.start();
    return runtime;
  } catch (error) {
    automaticBackup?.close();
    void catalog?.close().catch(() => undefined);
    library?.close();
    throw error;
  }
}
