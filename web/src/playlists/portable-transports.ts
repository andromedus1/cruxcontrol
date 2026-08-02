export interface PlaylistTransportAdapters {
  readonly writeClipboardText: (value: string) => Promise<void>;
  readonly canShare: (data: ShareData) => boolean;
  readonly share: (data: ShareData) => Promise<void>;
  readonly createObjectUrl: (file: File) => string;
  readonly revokeObjectUrl: (url: string) => void;
  readonly startDownload: (url: string, filename: string) => void;
}

export class PlaylistTransportUnavailableError extends Error {
  readonly code = 'transport-unavailable';

  constructor(readonly transport: 'clipboard' | 'share' | 'download') {
    super(`Playlist ${transport} transport is unavailable`);
    this.name = 'PlaylistTransportUnavailableError';
  }
}

export function browserPlaylistTransportAdapters(): PlaylistTransportAdapters {
  const browserNavigator = globalThis.navigator;
  const browserDocument = globalThis.document;
  return {
    writeClipboardText: (value) => {
      if (!browserNavigator?.clipboard?.writeText) {
        return Promise.reject(new PlaylistTransportUnavailableError('clipboard'));
      }
      return browserNavigator.clipboard.writeText(value);
    },
    canShare: (data) => {
      if (typeof browserNavigator?.share !== 'function') return false;
      try {
        if (typeof browserNavigator.canShare === 'function') return browserNavigator.canShare(data);
        return !data.files?.length;
      } catch {
        return false;
      }
    },
    share: (data) => {
      if (typeof browserNavigator?.share !== 'function') {
        return Promise.reject(new PlaylistTransportUnavailableError('share'));
      }
      return browserNavigator.share(data);
    },
    createObjectUrl: (file) => URL.createObjectURL(file),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    startDownload: (url, filename) => {
      if (!browserDocument) throw new PlaylistTransportUnavailableError('download');
      const anchor = browserDocument.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.hidden = true;
      browserDocument.body.append(anchor);
      try {
        anchor.click();
      } finally {
        anchor.remove();
      }
    },
  };
}

export function copyPlaylistLink(
  url: URL,
  adapters: Pick<
    PlaylistTransportAdapters,
    'writeClipboardText'
  > = browserPlaylistTransportAdapters(),
): Promise<void> {
  return adapters.writeClipboardText(url.href);
}

export function canSharePlaylist(
  data: ShareData,
  adapters: Pick<PlaylistTransportAdapters, 'canShare'> = browserPlaylistTransportAdapters(),
): boolean {
  return adapters.canShare(data);
}

export async function sharePlaylist(
  data: ShareData,
  adapters: Pick<
    PlaylistTransportAdapters,
    'canShare' | 'share'
  > = browserPlaylistTransportAdapters(),
): Promise<void> {
  if (!adapters.canShare(data)) throw new PlaylistTransportUnavailableError('share');
  await adapters.share(data);
}

export function downloadPlaylistFile(
  file: File,
  adapters: Pick<
    PlaylistTransportAdapters,
    'createObjectUrl' | 'revokeObjectUrl' | 'startDownload'
  > = browserPlaylistTransportAdapters(),
): void {
  const url = adapters.createObjectUrl(file);
  try {
    adapters.startDownload(url, file.name);
  } finally {
    adapters.revokeObjectUrl(url);
  }
}
