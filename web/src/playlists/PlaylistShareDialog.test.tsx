import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { draftRevision, localDraftId } from '../drafts/codec.ts';
import { draftContent } from '../drafts/test-fixtures.ts';
import type { LocalClimbDraft } from '../drafts/types.ts';
import { playlistId, playlistRevision } from './codec.ts';
import { PlaylistShareDialog } from './PlaylistShareDialog.tsx';
import type { PlaylistTransportAdapters } from './portable-transports.ts';
import type { LocalPlaylist } from './types.ts';
import { decodePortablePlaylist } from './portable-codec.ts';

const CLIMB_ID = localDraftId('00000000-0000-4000-8000-000000000401');

function climb(): LocalClimbDraft {
  return {
    ...draftContent({ name: 'Ocean 🌊' }),
    schemaVersion: 3,
    id: CLIMB_ID,
    revision: draftRevision(8),
    createdAt: '2026-08-02T18:00:00.000Z',
    updatedAt: '2026-08-02T18:00:00.000Z',
    metadata: {},
  };
}

function playlist(overrides: Partial<LocalPlaylist> = {}): LocalPlaylist {
  return {
    schemaVersion: 1,
    id: playlistId('00000000-0000-4000-8000-000000000402'),
    revision: playlistRevision(1),
    name: 'Shared projects',
    notes: '',
    entries: [{ kind: 'local', id: CLIMB_ID }],
    createdAt: '2026-08-02T18:00:00.000Z',
    updatedAt: '2026-08-02T18:00:00.000Z',
    ...overrides,
  };
}

function transports(overrides: Partial<PlaylistTransportAdapters> = {}) {
  const value: PlaylistTransportAdapters = {
    writeClipboardText: vi.fn(async () => undefined),
    canShare: vi.fn(() => true),
    share: vi.fn(async () => undefined),
    createObjectUrl: vi.fn(() => 'blob:playlist'),
    revokeObjectUrl: vi.fn(),
    startDownload: vi.fn(),
    ...overrides,
  };
  return value;
}

describe('PlaylistShareDialog', () => {
  it('omits native links and saves the complete playlist through the injected delivery', async () => {
    const deliver = vi.fn(async (_file: { filename: string; text: string }) => ({ status: 'saved' as const }));
    const adapter = transports();
    render(<PlaylistShareDialog playlist={playlist()} localClimbs={[climb()]} baseUrl={null} transports={adapter} deliverFile={{ kind: 'save', deliver }} onClose={vi.fn()} />);
    expect(screen.queryByLabelText('Share link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument();
    expect(screen.queryByText(/too large/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save playlist file' }));
    await screen.findByText('Playlist file saved.');
    expect(deliver).toHaveBeenCalledOnce();
    const file = deliver.mock.calls[0]![0] as { filename: string; text: string };
    expect(file.filename).toBe('Shared projects.cruxplaylist.json');
    expect(decodePortablePlaylist(JSON.parse(file.text)).playlist.entries).toMatchObject([{ kind: 'local-snapshot', snapshot: { name: 'Ocean 🌊', assignments: climb().assignments } }]);
    expect(adapter.startDownload).not.toHaveBeenCalled();
  });

  it('guards pending native delivery and reports cancellation or failure without completion', async () => {
    let finish!: (value: { status: 'cancelled' }) => void;
    const pending = new Promise<{ status: 'cancelled' }>((resolve) => { finish = resolve; });
    const deliver = vi.fn().mockReturnValueOnce(pending).mockRejectedValueOnce(new Error('Destination write failed'));
    const onClose = vi.fn(); const onOperationStart = vi.fn(); const onOperationEnd = vi.fn();
    render(<PlaylistShareDialog playlist={playlist()} localClimbs={[climb()]} baseUrl={null} deliverFile={{ kind: 'save', deliver }} onClose={onClose} onOperationStart={onOperationStart} onOperationEnd={onOperationEnd} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save playlist file' }));
    expect(screen.getByRole('button', { name: 'Close sharing' })).toBeDisabled();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
    finish({ status: 'cancelled' });
    await screen.findByText('Playlist file save canceled.');
    expect(onOperationStart).toHaveBeenCalledOnce(); expect(onOperationEnd).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Save playlist file' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Destination write failed');
    expect(screen.queryByText('Playlist file saved.')).not.toBeInTheDocument();
  });
  it('treats native share cancellation neutrally and preserves real failures and file fallback', async () => {
    const share = vi.fn().mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'))
      .mockRejectedValueOnce(new DOMException('Sharing denied', 'NotAllowedError'));
    const adapter = transports({ share });
    render(<PlaylistShareDialog playlist={playlist()} localClimbs={[climb()]} transports={adapter} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Share with another app' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sharing cancelled'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Share with another app' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sharing denied');
    fireEvent.click(screen.getByRole('button', { name: 'Download file' }));
    expect(adapter.startDownload).toHaveBeenCalledOnce();
  });

  it('does not classify a clipboard AbortError as native share cancellation', async () => {
    render(<PlaylistShareDialog playlist={playlist()} localClimbs={[climb()]}
      transports={transports({ writeClipboardText: vi.fn().mockRejectedValue(new DOMException('Copy aborted', 'AbortError')) })} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Copy aborted');
  });

  it('offers truthful link, file, and supported Web Share actions with accessible status', async () => {
    const adapter = transports();
    render(
      <PlaylistShareDialog
        playlist={playlist()}
        localClimbs={[climb()]}
        baseUrl={new URL('https://example.test/app?old=1')}
        transports={adapter}
        onClose={vi.fn()}
      />,
    );

    const link = screen.getByLabelText('Share link');
    expect((link as HTMLTextAreaElement).value).toMatch(
      /^https:\/\/example\.test\/app#playlist=/u,
    );
    expect((link as HTMLTextAreaElement).value).not.toContain('?old=1');
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Link copied'));
    expect(adapter.writeClipboardText).toHaveBeenCalledWith((link as HTMLTextAreaElement).value);

    fireEvent.click(screen.getByRole('button', { name: 'Download file' }));
    expect(adapter.startDownload).toHaveBeenCalledWith(
      'blob:playlist',
      'Shared projects.cruxplaylist.json',
    );
    expect(adapter.revokeObjectUrl).toHaveBeenCalledWith('blob:playlist');

    fireEvent.click(screen.getByRole('button', { name: 'Share with another app' }));
    await waitFor(() => expect(adapter.share).toHaveBeenCalledOnce());
    expect(screen.getByRole('status')).toHaveTextContent('Share completed');
  });

  it('keeps a failed copy link selectable and reports the actual clipboard error', async () => {
    const failure = new DOMException('Clipboard permission denied', 'NotAllowedError');
    const adapter = transports({ writeClipboardText: vi.fn(async () => Promise.reject(failure)) });
    render(
      <PlaylistShareDialog
        playlist={playlist()}
        localClimbs={[climb()]}
        transports={adapter}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Clipboard permission denied');
    expect(screen.getByLabelText('Share link')).toBeInTheDocument();
  });

  it('falls back to a complete shareable file when the URL exceeds the limit', () => {
    const adapter = transports({
      canShare: vi.fn((data: ShareData) => Boolean(data.files?.length)),
    });
    render(
      <PlaylistShareDialog
        playlist={playlist({ notes: '🌊'.repeat(2_000) })}
        localClimbs={[climb()]}
        baseUrl={new URL('https://example.test/app')}
        transports={adapter}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument();
    expect(screen.getByText(/too large for a reliable link/u)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download file' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Share with another app' })).toBeEnabled();
  });

  it('blocks export when a local membership cannot be snapshotted', () => {
    render(
      <PlaylistShareDialog
        playlist={playlist()}
        localClimbs={[]}
        transports={transports()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('playlist.entries[0]');
    expect(screen.queryByRole('button', { name: 'Download file' })).not.toBeInTheDocument();
  });
});
