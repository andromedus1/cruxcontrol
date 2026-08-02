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
import { activeInstallationId, createAppInstallationRegistry } from './installations';

export interface CruxControlRuntime {
  readonly installation: ConfiguredBoardInstallation;
  readonly drafts: LocalDraftRepository;
  readonly playlists: LocalPlaylistRepository;
  readonly controller: BoardLightController | null;
  close(): void;
}

export interface CruxControlRuntimeDependencies {
  readonly openDrafts?: () => Promise<IDBDatabase>;
  readonly openPlaylists?: () => Promise<IDBDatabase>;
  readonly getInstallation?: () => ConfiguredBoardInstallation;
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
    const installation = (
      dependencies.getInstallation ??
      (() => createAppInstallationRegistry().require(activeInstallationId))
    )();
    return Object.freeze({
      installation,
      drafts,
      playlists,
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
