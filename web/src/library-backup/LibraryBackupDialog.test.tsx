import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { draftRevision, localDraftId } from '../drafts/codec.ts';
import { draftContent } from '../drafts/test-fixtures.ts';
import type { LocalClimbDraft } from '../drafts/types.ts';
import { encodeLibraryBackup } from './codec.ts';
import { LibraryBackupDialog } from './LibraryBackupDialog.tsx';
import { LibraryBackupService } from './service.ts';
import type { LibraryBackupStore } from './types.ts';

const id = localDraftId('00000000-0000-4000-8000-000000000501');
function climb(): LocalClimbDraft {
  return { ...draftContent({ name: 'Dialog climb' }), schemaVersion: 4, id, revision: draftRevision(1), createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', metadata: {} };
}
function store(initial: readonly LocalClimbDraft[] = []): LibraryBackupStore {
  const drafts = [...initial];
  return {
    readDrafts: vi.fn(async () => drafts),
    readPlaylists: vi.fn(async () => []),
    restoreMissingDrafts: vi.fn(async (records: readonly LocalClimbDraft[]) => {
      drafts.push(...records.filter((record) => !drafts.some(({ id: current }) => current === record.id)));
      return { added: records.length, unchanged: 0 };
    }),
    restoreMissingPlaylists: vi.fn(async () => ({ added: 0, unchanged: 0 })),
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
