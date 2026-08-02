import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DraftConflictError } from '../drafts/errors';
import { draftRevision, localDraftId } from '../drafts/codec';
import { draftContent } from '../drafts/test-fixtures';
import type { DraftContent, LocalClimbDraft } from '../drafts/types';
import { activeInstallationId, createAppInstallationRegistry } from './installations';
import type { CruxControlRuntime } from './create-runtime';
import { CruxControlWorkspace } from './CruxControlWorkspace';

const original: LocalClimbDraft = {
  ...draftContent({ name: 'Original' }),
  schemaVersion: 1,
  id: localDraftId('11111111-1111-4111-8111-111111111111'),
  revision: draftRevision(1),
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
  metadata: {},
};

function persisted(id: LocalClimbDraft['id'], revision: number, content: DraftContent): LocalClimbDraft {
  return {
    ...content,
    schemaVersion: 1,
    id,
    revision: draftRevision(revision),
    createdAt: original.createdAt,
    updatedAt: `2026-08-02T00:00:0${revision}.000Z`,
    metadata: content.metadata ?? {},
  };
}

describe('CruxControlWorkspace', () => {
  it('adopts Save-a-copy identity so later saves target the copy', async () => {
    const copyId = localDraftId('22222222-2222-4222-8222-222222222222');
    const conflict = new DraftConflictError(original.id, draftRevision(1), draftRevision(2));
    const update = vi.fn()
      .mockRejectedValueOnce(conflict)
      .mockImplementation(async (id, revision, content: DraftContent) => persisted(id, Number(revision) + 1, content));
    const create = vi.fn(async (content: DraftContent) => persisted(copyId, 1, content));
    const runtime: CruxControlRuntime = {
      installation: createAppInstallationRegistry().require(activeInstallationId),
      drafts: { create, get: vi.fn(), list: vi.fn().mockResolvedValue([original]), update, delete: vi.fn() },
      controller: null,
      close: vi.fn(),
    };
    render(<CruxControlWorkspace runtime={runtime} />);

    fireEvent.click(await screen.findByRole('button', { name: /Original/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit climb' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Recovered copy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save now' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save a copy' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('saved'));

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Recovered copy v2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save now' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[1]?.[0]).toBe(copyId);
    expect(update.mock.calls[1]?.[2].name).toBe('Recovered copy v2');
  });
});
