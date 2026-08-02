export interface PlaylistHistoryAdapter {
  readonly currentHash: () => string;
  readonly replaceWithoutHash: () => void;
}

export function browserPlaylistHistoryAdapter(): PlaylistHistoryAdapter {
  return {
    currentHash: () => window.location.hash,
    replaceWithoutHash: () =>
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}`,
      ),
  };
}

export function clearImportedPlaylistHash(
  importedFragment: string | null,
  history: PlaylistHistoryAdapter,
): void {
  if (importedFragment && history.currentHash() === importedFragment) {
    history.replaceWithoutHash();
  }
}
