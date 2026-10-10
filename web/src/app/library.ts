import {
  IndexedDbLocalDraftRepository,
  openDraftDatabase,
  type LocalDraftRepository,
} from '../drafts';
import {
  IndexedDbLocalPlaylistRepository,
  openPlaylistDatabase,
  type LocalPlaylistRepository,
} from '../playlists';
import { IndexedDbLibraryBackupStore, type LibraryBackupStore } from '../library-backup';

export interface AppLibrary {
  readonly drafts: LocalDraftRepository;
  readonly playlists: LocalPlaylistRepository;
  readonly backupStore: LibraryBackupStore;
  close(): void;
}

export async function openBrowserLibrary(
  options: {
    readonly openDrafts?: () => Promise<IDBDatabase>;
    readonly openPlaylists?: () => Promise<IDBDatabase>;
  } = {},
): Promise<AppLibrary> {
  const drafts = await (options.openDrafts ?? openDraftDatabase)();
  let playlists: IDBDatabase;
  try {
    playlists = await (options.openPlaylists ?? openPlaylistDatabase)();
  } catch (cause) {
    drafts.close();
    throw cause;
  }
  let closed = false;
  return {
    drafts: new IndexedDbLocalDraftRepository(drafts),
    playlists: new IndexedDbLocalPlaylistRepository(playlists),
    backupStore: new IndexedDbLibraryBackupStore(drafts, playlists),
    close: () => {
      if (closed) return;
      closed = true;
      playlists.close();
      drafts.close();
    },
  };
}
