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
import type { BoardDefinition } from '../domain/boards/definition.ts';

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
  readonly restoredFileSaveFailure?: RestoredFileSaveFailureNotice;
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
  readonly restoredFileSaveFailure?: RestoredFileSaveFailureNotice;
  readonly createCatalog?: (definition: BoardDefinition) => CatalogService;
}

export async function createCruxControlRuntime(
  dependencies: CruxControlRuntimeDependencies = {},
): Promise<CruxControlRuntime> {
  let library: AppLibrary | null = null;
  let catalog: CatalogService | null = null;
  try {
    library = await (dependencies.openLibrary ?? (() => openBrowserLibrary(dependencies)))();
    const { drafts, playlists } = library;
    const backup = new LibraryBackupService(library.backupStore);
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
        }))
    )(installation.definition);
    let closed = false;
    return Object.freeze({
      installation,
      drafts,
      playlists,
      backup,
      backupDelivery: dependencies.backupDelivery ?? browserLibraryBackupDelivery,
      ...(dependencies.restoredFileSaveFailure
        ? { restoredFileSaveFailure: dependencies.restoredFileSaveFailure }
        : {}),
      catalog,
      controller: installation.createController(),
      close: () => {
        if (closed) return;
        closed = true;
        void catalog?.close().catch(() => undefined);
        library?.close();
      },
    });
  } catch (error) {
    void catalog?.close().catch(() => undefined);
    library?.close();
    throw error;
  }
}
