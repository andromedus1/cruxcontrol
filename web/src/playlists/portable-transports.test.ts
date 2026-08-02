import {
  canSharePlaylist,
  copyPlaylistLink,
  downloadPlaylistFile,
  PlaylistTransportUnavailableError,
  sharePlaylist,
  type PlaylistTransportAdapters,
} from './portable-transports.ts';

function adapters(overrides: Partial<PlaylistTransportAdapters> = {}): PlaylistTransportAdapters {
  return {
    writeClipboardText: vi.fn(async () => undefined),
    canShare: vi.fn(() => true),
    share: vi.fn(async () => undefined),
    createObjectUrl: vi.fn(() => 'blob:playlist'),
    revokeObjectUrl: vi.fn(),
    startDownload: vi.fn(),
    ...overrides,
  };
}

describe('portable playlist transports', () => {
  it('copies the complete URL and lets clipboard rejection remain truthful', async () => {
    const success = adapters();
    const url = new URL('https://example.test/app#playlist=abc');
    await copyPlaylistLink(url, success);
    expect(success.writeClipboardText).toHaveBeenCalledWith(url.href);

    const failure = new DOMException('Denied', 'NotAllowedError');
    const unavailable = adapters({
      writeClipboardText: vi.fn(async () => Promise.reject(failure)),
    });
    await expect(copyPlaylistLink(url, unavailable)).rejects.toBe(failure);
  });

  it('offers Web Share only when the injected adapter accepts the requested data', async () => {
    const data: ShareData = { title: 'Projects', url: 'https://example.test/#playlist=abc' };
    const unavailable = adapters({ canShare: vi.fn(() => false) });
    expect(canSharePlaylist(data, unavailable)).toBe(false);
    await expect(sharePlaylist(data, unavailable)).rejects.toEqual(
      expect.objectContaining<Partial<PlaylistTransportUnavailableError>>({
        code: 'transport-unavailable',
        transport: 'share',
      }),
    );
    expect(unavailable.share).not.toHaveBeenCalled();

    const available = adapters();
    await sharePlaylist(data, available);
    expect(available.canShare).toHaveBeenCalledWith(data);
    expect(available.share).toHaveBeenCalledWith(data);
  });

  it('revokes every object URL after download, including launcher failure', () => {
    const file = new File(['{}'], 'Projects.cruxplaylist.json', { type: 'application/json' });
    const success = adapters();
    downloadPlaylistFile(file, success);
    expect(success.createObjectUrl).toHaveBeenCalledWith(file);
    expect(success.startDownload).toHaveBeenCalledWith('blob:playlist', file.name);
    expect(success.revokeObjectUrl).toHaveBeenCalledWith('blob:playlist');

    const launchFailure = new Error('download blocked');
    const failure = adapters({
      startDownload: vi.fn(() => {
        throw launchFailure;
      }),
    });
    expect(() => downloadPlaylistFile(file, failure)).toThrow(launchFailure);
    expect(failure.revokeObjectUrl).toHaveBeenCalledWith('blob:playlist');
  });
});
