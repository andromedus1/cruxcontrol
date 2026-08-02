import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { draftRevision, localDraftId } from '../drafts/codec';
import { DraftConflictError } from '../drafts/errors';
import type { LocalDraftRepository } from '../drafts/repository';
import { draftContent } from '../drafts/test-fixtures';
import type { DraftContent, LocalClimbDraft } from '../drafts/types';
import { layoutRevisionId } from '../domain/boards/identity';
import type { CruxControlRuntime } from './create-runtime';
import { CruxControlWorkspace } from './CruxControlWorkspace';
import { activeInstallationId, createAppInstallationRegistry } from './installations';

const original: LocalClimbDraft = {
  ...draftContent({ name: 'Original' }),
  schemaVersion: 3,
  id: localDraftId('11111111-1111-4111-8111-111111111111'),
  revision: draftRevision(1),
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
  metadata: {},
};

function persisted(
  id: LocalClimbDraft['id'],
  revision: number,
  content: DraftContent,
): LocalClimbDraft {
  return {
    ...content,
    schemaVersion: 3,
    id,
    revision: draftRevision(revision),
    createdAt: original.createdAt,
    updatedAt: `2026-08-02T00:00:${String(revision).padStart(2, '0')}.000Z`,
    metadata: content.metadata ?? {},
  };
}

function listCollections(active: readonly LocalClimbDraft[], trash: readonly LocalClimbDraft[]) {
  return vi.fn<LocalDraftRepository['list']>(async (options) =>
    options?.collection === 'trash' ? trash : active,
  );
}

function runtimeWith(overrides: Partial<LocalDraftRepository> = {}): CruxControlRuntime {
  return {
    installation: createAppInstallationRegistry().require(activeInstallationId),
    drafts: {
      create: vi.fn(),
      get: vi.fn(),
      list: listCollections([], []),
      update: vi.fn(),
      trash: vi.fn(),
      restore: vi.fn(),
      deletePermanently: vi.fn(),
      purgeExpiredTrash: vi.fn().mockResolvedValue(0),
      ...overrides,
    },
    controller: null,
    close: vi.fn(),
  };
}

describe('CruxControlWorkspace', () => {
  it('partitions finished climbs, Drafts, and Trash with visible counts', async () => {
    const finished = persisted(
      localDraftId('22222222-2222-4222-8222-222222222222'),
      1,
      draftContent({ name: 'Finished line', status: 'finished' }),
    );
    const trashed = {
      ...persisted(
        localDraftId('33333333-3333-4333-8333-333333333333'),
        2,
        draftContent({ name: 'Deleted experiment' }),
      ),
      trashedAt: '2026-08-02T00:00:02.000Z',
    };
    const runtime = runtimeWith({ list: listCollections([finished, original], [trashed]) });

    render(<CruxControlWorkspace runtime={runtime} />);

    expect(await screen.findByRole('button', { name: /Finished line/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /My Climbs.*1 climb/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /Drafts.*1 climb/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trash.*1 climb/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Original/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Drafts.*1 climb/ }));
    expect(screen.getByRole('button', { name: /Original/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Finished line/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Trash.*1 climb/ }));
    expect(screen.getByRole('button', { name: /Deleted experiment/ })).toBeInTheDocument();
  });

  it('creates new climbs as Drafts and opens the editor immediately', async () => {
    const create = vi.fn(async (content: DraftContent) => persisted(original.id, 1, content));
    const runtime = runtimeWith({ create });

    render(<CruxControlWorkspace runtime={runtime} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Create climb' }));
    expect(await screen.findByRole('heading', { name: 'Untitled climb' })).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }));
    expect(screen.getByText('Draft · Fullride 7×10')).toBeInTheDocument();
  });

  it('moves climbs through lifecycle collections without changing identity or content', async () => {
    let current = original;
    const update = vi.fn<LocalDraftRepository['update']>(async (id, revision, content) => {
      current = persisted(id, Number(revision) + 1, content);
      return current;
    });
    const trash = vi.fn<LocalDraftRepository['trash']>(async (id, revision) => {
      current = {
        ...current,
        id,
        revision: draftRevision(Number(revision) + 1),
        trashedAt: '2026-08-02T00:00:03.000Z',
      };
      return current;
    });
    const restore = vi.fn<LocalDraftRepository['restore']>(async (id, revision) => {
      const { trashedAt: _trashedAt, ...active } = current;
      current = { ...active, id, revision: draftRevision(Number(revision) + 1) };
      return current;
    });
    const runtime = runtimeWith({
      list: listCollections([original], []),
      update,
      trash,
      restore,
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CruxControlWorkspace runtime={runtime} />);
    fireEvent.click(await screen.findByRole('button', { name: /Drafts.*1 climb/ }));
    fireEvent.click(screen.getByRole('button', { name: /Original/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark finished' }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update.mock.calls[0]?.[2]).toMatchObject({
      status: 'finished',
      name: original.name,
      assignments: original.assignments,
      effectGroups: original.effectGroups,
      metadata: original.metadata,
    });

    fireEvent.click(screen.getByRole('button', { name: /My Climbs.*1 climb/ }));
    fireEvent.click(screen.getByRole('button', { name: /Original/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Move to trash' }));
    await waitFor(() => expect(trash).toHaveBeenCalledWith(original.id, draftRevision(2)));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('restore it for 30 days'));

    fireEvent.click(screen.getByRole('button', { name: /Trash.*1 climb/ }));
    fireEvent.click(screen.getByRole('button', { name: /Original/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(restore).toHaveBeenCalledWith(original.id, draftRevision(3)));
    expect(current).toMatchObject({ id: original.id, status: 'finished', revision: 4 });
    expect(current).not.toHaveProperty('trashedAt');
  });

  it('confirms Delete forever and makes destructive failures retryable', async () => {
    const trashed = {
      ...original,
      revision: draftRevision(2),
      trashedAt: '2026-08-02T00:00:02.000Z',
    };
    const deletePermanently = vi
      .fn<LocalDraftRepository['deletePermanently']>()
      .mockRejectedValueOnce(new Error('Storage is busy.'))
      .mockResolvedValueOnce(undefined);
    const runtime = runtimeWith({
      list: listCollections([], [trashed]),
      deletePermanently,
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CruxControlWorkspace runtime={runtime} />);
    fireEvent.click(await screen.findByRole('button', { name: /Trash.*1 climb/ }));
    fireEvent.click(screen.getByRole('button', { name: /Original/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Storage is busy.');
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('cannot be undone'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry delete forever' }));
    await waitFor(() => expect(deletePermanently).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('heading', { name: 'Trash is empty' })).toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalledOnce();
  });

  it('keeps incompatible climbs visible with only safe recovery actions', async () => {
    const incompatible = {
      ...original,
      layoutRevision: layoutRevisionId('fullride-stale-layout'),
    };
    const incompatibleTrash = {
      ...persisted(
        localDraftId('22222222-2222-4222-8222-222222222222'),
        2,
        draftContent({ name: 'Stale trash', status: 'finished' }),
      ),
      layoutRevision: layoutRevisionId('fullride-stale-layout'),
      trashedAt: '2026-08-02T00:00:02.000Z',
    };
    const runtime = runtimeWith({
      list: listCollections([incompatible], [incompatibleTrash]),
    });

    render(<CruxControlWorkspace runtime={runtime} />);
    fireEvent.click(await screen.findByRole('button', { name: /Drafts.*1 climb/ }));
    const recovery = screen.getByRole('alert', { name: 'Climb recovery needed' });
    expect(recovery).toHaveTextContent('Original');
    expect(recovery).toHaveTextContent('uses a different layout revision');
    expect(screen.getByRole('button', { name: 'Move Original to Trash' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark finished' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Trash.*1 climb/ }));
    expect(screen.getByRole('button', { name: 'Restore Stale trash' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Stale trash forever' })).toBeInTheDocument();
  });

  it('reports cleanup failures without hiding successfully loaded climbs', async () => {
    const finished = persisted(
      original.id,
      1,
      draftContent({ name: 'Visible', status: 'finished' }),
    );
    const purgeExpiredTrash = vi
      .fn<LocalDraftRepository['purgeExpiredTrash']>()
      .mockRejectedValueOnce(new Error('Cleanup is temporarily unavailable.'))
      .mockResolvedValueOnce(0);
    const runtime = runtimeWith({
      list: listCollections([finished], []),
      purgeExpiredTrash,
    });

    render(<CruxControlWorkspace runtime={runtime} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cleanup is temporarily unavailable.',
    );
    expect(screen.getByRole('button', { name: /Visible/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry refreshing climbs' }));
    await waitFor(() => expect(purgeExpiredTrash).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('adopts Save-a-copy identity so later saves target the copy', async () => {
    const copyId = localDraftId('22222222-2222-4222-8222-222222222222');
    const conflict = new DraftConflictError(original.id, draftRevision(1), draftRevision(2));
    const update = vi
      .fn<LocalDraftRepository['update']>()
      .mockRejectedValueOnce(conflict)
      .mockImplementation(async (id, revision, content) =>
        persisted(id, Number(revision) + 1, content),
      );
    const create = vi.fn(async (content: DraftContent) => persisted(copyId, 1, content));
    const runtime = runtimeWith({
      create,
      list: listCollections([original], []),
      update,
    });
    render(<CruxControlWorkspace runtime={runtime} />);

    fireEvent.click(await screen.findByRole('button', { name: /Drafts.*1 climb/ }));
    fireEvent.click(screen.getByRole('button', { name: /Original/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit climb' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Recovered copy' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Save a copy' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('saved'));

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Recovered copy v2' } });
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[1]?.[0]).toBe(copyId);
    expect(update.mock.calls[1]?.[2].name).toBe('Recovered copy v2');
  });
});
