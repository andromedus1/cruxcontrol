import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { draftRevision, localDraftId } from '../drafts/codec.ts';
import { draftContent } from '../drafts/test-fixtures.ts';
import type { LocalClimbDraft } from '../drafts/types.ts';
import { encodeLibraryBackup, LIBRARY_BACKUP_LIMITS } from './codec.ts';
import { playlistId, playlistRevision } from '../playlists/codec.ts';
import type { LocalPlaylist } from '../playlists/types.ts';
import { LibraryBackupDialog } from './LibraryBackupDialog.tsx';
import { LibraryBackupService } from './service.ts';
import type { LibraryBackupStore } from './types.ts';

const id = localDraftId('00000000-0000-4000-8000-000000000501');
function climb(): LocalClimbDraft {
  return { ...draftContent({ name: 'Dialog climb' }), schemaVersion: 4, id, revision: draftRevision(1), createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', metadata: {} };
}
function store(initial: readonly LocalClimbDraft[] = []): LibraryBackupStore {
  const drafts = [...initial];
  const playlists: LocalPlaylist[] = [];
  return {
    readDrafts: vi.fn(async () => drafts),
    readPlaylists: vi.fn(async () => playlists),
    restoreMissingDrafts: vi.fn(async (records: readonly LocalClimbDraft[]) => {
      const missing = records.filter((record) => !drafts.some(({ id: current }) => current === record.id));
      drafts.push(...missing);
      return { added: missing.length, unchanged: records.length - missing.length };
    }),
    restoreMissingPlaylists: vi.fn(async (records) => {
      const missing = records.filter((record) => !playlists.some(({ id: current }) => current === record.id));
      playlists.push(...missing);
      return { added: missing.length, unchanged: records.length - missing.length };
    }),
  };
}
describe('LibraryBackupDialog', () => {
  it('reviews an uploaded file before adding records and names the exact add counts', async () => {
    const text = encodeLibraryBackup({ drafts: [climb()], playlists: [] }, new Date('2026-09-05T00:00:00.000Z'));
    const onRestored = vi.fn(async () => undefined);
    render(
      <LibraryBackupDialog
        service={new LibraryBackupService(store())}
        onClose={vi.fn()}
        onRestored={onRestored}
        readFileText={async () => text}
      />,
    );
    fireEvent.change(screen.getByLabelText('Library backup file'), {
      target: { files: [new File(['x'], 'library.json', { type: 'application/json' })] },
    });
    expect(await screen.findByText('Climbs to add')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add 1 climbs & 0 playlists' })).toBeInTheDocument();
  });

  it('shows an identical no-op without a write CTA', async () => {
    const text = encodeLibraryBackup({ drafts: [climb()], playlists: [] }, new Date('2026-09-05T00:00:00.000Z'));
    render(
      <LibraryBackupDialog
        service={new LibraryBackupService(store([climb()]))}
        onClose={vi.fn()}
        onRestored={vi.fn(async () => undefined)}
        readFileText={async () => text}
      />,
    );
    fireEvent.change(screen.getByLabelText('Library backup file'), { target: { files: [new File(['x'], 'library.json')] } });
    expect(await screen.findByText('Everything in this backup is already here.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add .*climbs/ })).not.toBeInTheDocument();
  });

  it('distinguishes successful storage from a failed workspace refresh', async () => {
    const text = encodeLibraryBackup({ drafts: [climb()], playlists: [] }, new Date('2026-09-05T00:00:00.000Z'));
    render(
      <LibraryBackupDialog
        service={new LibraryBackupService(store())}
        onClose={vi.fn()}
        onRestored={vi.fn(async () => { throw new Error('refresh unavailable'); })}
        readFileText={async () => text}
      />,
    );
    fireEvent.change(screen.getByLabelText('Library backup file'), { target: { files: [new File(['x'], 'library.json')] } });
    fireEvent.click(await screen.findByRole('button', { name: /Add 1 climbs/ }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Recovery saved' })).toBeInTheDocument());
    expect(screen.getByText('The library view could not refresh.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry refresh' })).toBeInTheDocument();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const fileText = () => encodeLibraryBackup({ drafts: [climb()], playlists: [] }, new Date('2026-09-05T00:00:00.000Z'));
const choose = (name = 'library.json') => fireEvent.change(screen.getByLabelText('Library backup file'), { target: { files: [new File(['x'], name)] } });

describe('recovery failure and async boundaries', () => {
  it.each([
    { phase: 'preflight' as const, drafts: null, message: 'Recovery could not start. No records were added.' },
    { phase: 'drafts' as const, drafts: null, message: 'No records were added. Climb recovery failed before committing; playlists were not changed.' },
    { phase: 'playlists' as const, drafts: { added: 1, unchanged: 0 }, message: '1 climbs were added and 0 existing climbs were unchanged. No playlists were added.' },
    { phase: 'playlists' as const, drafts: { added: 0, unchanged: 1 }, message: '0 climbs were added and 1 existing climbs were unchanged. No playlists were added.' },
  ])('reports the exact $phase outcome with $drafts', async ({ phase, drafts, message }) => {
    const service = new LibraryBackupService(store());
    vi.spyOn(service, 'restore').mockResolvedValue({ status: 'failed', phase, drafts, error: new Error('Storage unavailable') });
    render(<LibraryBackupDialog service={service} onClose={vi.fn()} onRestored={vi.fn()} readFileText={async () => fileText()} />);
    choose();
    fireEvent.click(await screen.findByRole('button', { name: /Add 1 climbs/ }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText('Climbs to add')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review and retry' })).toBeInTheDocument();
  });

  it('clears a refresh failure after a single guarded retry without repeating recovery', async () => {
    const pending = deferred<void>();
    const refresh = vi.fn().mockRejectedValueOnce(new Error('Temporary refresh error')).mockImplementationOnce(() => pending.promise);
    const service = new LibraryBackupService(store());
    const restore = vi.spyOn(service, 'restore');
    render(<LibraryBackupDialog service={service} onClose={vi.fn()} onRestored={refresh} readFileText={async () => fileText()} />);
    choose();
    fireEvent.click(await screen.findByRole('button', { name: /Add 1 climbs/ }));
    const retry = await screen.findByRole('button', { name: 'Retry refresh' });
    fireEvent.click(retry);
    fireEvent.click(retry);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(retry).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close', exact: true })).toBeDisabled();
    await act(async () => pending.resolve());
    expect(await screen.findByRole('heading', { name: 'Recovery complete' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(restore).toHaveBeenCalledOnce();
  });

  it('keeps Escape closed off during export and suppresses an unmounted delayed download', async () => {
    const pending = deferred<{ filename: string; text: string }>();
    const service = new LibraryBackupService(store());
    vi.spyOn(service, 'exportFile').mockReturnValue(pending.promise);
    const onClose = vi.fn(), createUrl = vi.fn(() => 'blob:test');
    const { unmount } = render(<LibraryBackupDialog service={service} onClose={onClose} onRestored={vi.fn()} createObjectUrl={createUrl} revokeObjectUrl={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download library backup' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
    unmount();
    await act(async () => pending.resolve({ filename: 'library.json', text: fileText() }));
    expect(createUrl).not.toHaveBeenCalled();
  });
});

describe('file selection and safe retry', () => {
  it('ignores a slow previous file after a newer selection finishes', async () => {
    const pending = deferred<string>();
    const read = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(fileText());
    const service = new LibraryBackupService(store());
    const review = vi.spyOn(service, 'review');
    render(<LibraryBackupDialog service={service} onClose={vi.fn()} onRestored={vi.fn()} readFileText={read} />);
    choose('old.json');
    expect(screen.getByLabelText('Library backup file')).not.toBeDisabled();
    choose('new.json');
    expect(await screen.findByText('new.json')).toBeInTheDocument();
    await act(async () => pending.resolve(fileText()));
    expect(screen.queryByText('old.json')).not.toBeInTheDocument();
    expect(screen.getByText('new.json')).toBeInTheDocument();
    expect(review).toHaveBeenCalledOnce();
  });

  it('checks file size before reading and cancels a pending read on close', async () => {
    const pending = deferred<string>();
    const read = vi.fn(() => pending.promise), onClose = vi.fn();
    const service = new LibraryBackupService(store());
    const review = vi.spyOn(service, 'review');
    render(<LibraryBackupDialog service={service} onClose={onClose} onRestored={vi.fn()} readFileText={read} />);
    const oversized = new File(['x'], 'large.json');
    Object.defineProperty(oversized, 'size', { value: LIBRARY_BACKUP_LIMITS.bytes + 1 });
    fireEvent.change(screen.getByLabelText('Library backup file'), { target: { files: [oversized] } });
    expect(screen.getByRole('alert')).toHaveTextContent('25 MiB');
    expect(read).not.toHaveBeenCalled();
    choose();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
    expect(onClose).toHaveBeenCalledOnce();
    await act(async () => pending.resolve(fileText()));
    expect(review).not.toHaveBeenCalled();
  });

  it('blocks a differing identity without offering a write', async () => {
    const service = new LibraryBackupService(store([{ ...climb(), name: 'Current edited climb' }]));
    const restore = vi.spyOn(service, 'restore');
    render(<LibraryBackupDialog service={service} onClose={vi.fn()} onRestored={vi.fn()} readFileText={async () => fileText()} />);
    choose();
    expect(await screen.findByText('Recovery is paused. Nothing was added.')).toBeInTheDocument();
    expect(screen.getByText('Dialog climb')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add .*climbs/ })).not.toBeInTheDocument();
    expect(restore).not.toHaveBeenCalled();
  });

  it('reviews partial recovery again and adds only the remaining playlist', async () => {
    const port = store();
    vi.mocked(port.restoreMissingPlaylists).mockRejectedValueOnce(new Error('Playlist storage unavailable'));
    const list: LocalPlaylist = {
      schemaVersion: 1, id: playlistId('00000000-0000-4000-8000-000000000502'),
      revision: playlistRevision(1), name: 'Recovered list', notes: '',
      entries: [{ kind: 'local', id }], createdAt: climb().createdAt, updatedAt: climb().updatedAt,
    };
    const text = encodeLibraryBackup({ drafts: [climb()], playlists: [list] }, new Date('2026-09-05T00:00:00.000Z'));
    render(<LibraryBackupDialog service={new LibraryBackupService(port)} onClose={vi.fn()} onRestored={vi.fn(async () => undefined)} readFileText={async () => text} />);
    choose();
    fireEvent.click(await screen.findByRole('button', { name: 'Add 1 climbs & 1 playlists' }));
    expect(await screen.findByText('1 climbs were added and 0 existing climbs were unchanged. No playlists were added.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review and retry' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add 0 climbs & 1 playlists' }));
    expect(await screen.findByRole('heading', { name: 'Recovery complete' })).toBeInTheDocument();
    expect(screen.getByText('0 climbs and 1 playlists were added. 1 climbs and 0 playlists were already here, unchanged.')).toBeInTheDocument();
    expect(await port.readDrafts()).toEqual([climb()]);
    expect(await port.readPlaylists()).toEqual([list]);
  });

  it('blocks close and resubmission until the restore promise settles', async () => {
    const pending = deferred<{ added: number; unchanged: number }>();
    const port = store();
    vi.mocked(port.restoreMissingDrafts).mockReturnValue(pending.promise);
    const onClose = vi.fn();
    render(<LibraryBackupDialog service={new LibraryBackupService(port)} onClose={onClose} onRestored={vi.fn(async () => undefined)} readFileText={async () => fileText()} />);
    choose();
    fireEvent.click(await screen.findByRole('button', { name: /Add 1 climbs/ }));
    await waitFor(() => expect(port.restoreMissingDrafts).toHaveBeenCalledOnce());
    expect(screen.getByLabelText('Library backup file')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close', exact: true })).toBeDisabled();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => pending.resolve({ added: 1, unchanged: 0 }));
    expect(await screen.findByRole('heading', { name: 'Recovery complete' })).toBeInTheDocument();
    expect(port.restoreMissingDrafts).toHaveBeenCalledOnce();
  });
});
