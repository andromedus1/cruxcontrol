import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, useReducer } from 'react';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DraftConflictError } from '../drafts/errors';
import { draftRevision, localDraftId } from '../drafts/codec';
import type { LocalDraftRepository } from '../drafts/repository';
import { draftContent } from '../drafts/test-fixtures';
import type { DraftContent, LocalClimbDraft } from '../drafts/types';
import { createRouteEditorState, routeEditorReducer } from './editor-state';
import { useDraftAutosave } from './use-draft-autosave';

const initial: LocalClimbDraft = {
  ...draftContent(),
  schemaVersion: 3,
  id: localDraftId('11111111-1111-4111-8111-111111111111'),
  revision: draftRevision(1),
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
  metadata: {},
};

function saved(content: DraftContent, revision: number, id = initial.id): LocalClimbDraft {
  return {
    ...content,
    schemaVersion: 3,
    id,
    revision: draftRevision(revision),
    createdAt: initial.createdAt,
    updatedAt: `2026-08-02T00:00:0${revision}.000Z`,
    metadata: content.metadata ?? {},
  };
}

function repository(update: LocalDraftRepository['update']): LocalDraftRepository {
  return {
    create: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    update,
    trash: vi.fn(),
    restore: vi.fn(),
    deletePermanently: vi.fn(),
  };
}

function useHarness(drafts: LocalDraftRepository, delayMs = 800) {
  const [state, dispatch] = useReducer(routeEditorReducer, initial, createRouteEditorState);
  return {
    state,
    dispatch,
    controls: useDraftAutosave({ repository: drafts, state, dispatch, delayMs }),
  };
}

afterEach(() => vi.useRealTimers());

describe('useDraftAutosave', () => {
  it('coalesces burst edits into one latest optimistic update', async () => {
    vi.useFakeTimers();
    const update = vi.fn<LocalDraftRepository['update']>(async (_id, revision, content) =>
      saved(content, Number(revision) + 1),
    );
    const drafts = repository(update);
    const { result } = renderHook(() => useHarness(drafts));

    act(() => {
      result.current.dispatch({ type: 'set-name', value: 'Tidal' });
      result.current.dispatch({ type: 'set-name', value: 'Tidal Wave' });
      result.current.dispatch({ type: 'set-status', value: 'finished' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0]?.[2].name).toBe('Tidal Wave');
    expect(update.mock.calls[0]?.[2].status).toBe('finished');
    expect(result.current.state.saveStatus).toBe('saved');
  });

  it('serializes an in-flight save and follows it with exactly one newest snapshot', async () => {
    let releaseFirst!: (draft: LocalClimbDraft) => void;
    const first = new Promise<LocalClimbDraft>((resolve) => {
      releaseFirst = resolve;
    });
    let updateCount = 0;
    const update = vi.fn<LocalDraftRepository['update']>((_id, revision, content) =>
      ++updateCount === 1 ? first : Promise.resolve(saved(content, Number(revision) + 1)),
    );
    const { result } = renderHook(() => useHarness(repository(update)));

    act(() => result.current.dispatch({ type: 'set-name', value: 'First' }));
    let flush!: Promise<void>;
    act(() => {
      flush = result.current.controls.saveNow();
    });
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    act(() => {
      result.current.dispatch({ type: 'set-name', value: 'Second' });
      result.current.dispatch({ type: 'set-name', value: 'Latest' });
    });
    releaseFirst(saved(update.mock.calls[0]![2], 2));
    await act(async () => {
      await flush;
    });

    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[1]?.[1]).toBe(2);
    expect(update.mock.calls[1]?.[2].name).toBe('Latest');
    expect(result.current.state.saveStatus).toBe('saved');
  });

  it('keeps conflicts recoverable when reload is missing and adopts a saved copy', async () => {
    const conflict = new DraftConflictError(initial.id, draftRevision(1), draftRevision(2));
    const drafts = repository(vi.fn().mockRejectedValue(conflict));
    vi.mocked(drafts.get).mockResolvedValue(null);
    const copy = saved(
      { ...draftContent(), name: 'Copy me' },
      1,
      localDraftId('22222222-2222-4222-8222-222222222222'),
    );
    vi.mocked(drafts.create).mockResolvedValue(copy);
    const { result } = renderHook(() => useHarness(drafts));

    act(() => result.current.dispatch({ type: 'set-name', value: 'Copy me' }));
    await act(async () => {
      await result.current.controls.saveNow();
    });
    expect(result.current.state.saveStatus).toBe('conflict');

    await act(async () => {
      await expect(result.current.controls.reloadStored()).rejects.toThrow('no longer exists');
    });
    expect(result.current.state.saveStatus).toBe('conflict');
    expect(result.current.state.persistenceError?.message).toContain('Save a copy');

    await act(async () => {
      await result.current.controls.saveCopy();
    });
    expect(result.current.state.draft.id).toBe(copy.id);
    expect(result.current.state.content.name).toBe('Copy me');
    expect(result.current.state.saveStatus).toBe('saved');
  });

  it('reloads the stored revision after a conflict and retries ordinary failures', async () => {
    const conflict = new DraftConflictError(initial.id, draftRevision(1), draftRevision(2));
    const stored = saved({ ...draftContent(), name: 'Other tab' }, 2);
    const update = vi
      .fn<LocalDraftRepository['update']>()
      .mockRejectedValueOnce(conflict)
      .mockRejectedValueOnce(new Error('Storage temporarily unavailable'))
      .mockImplementation(async (_id, revision, content) => saved(content, Number(revision) + 1));
    const drafts = repository(update);
    vi.mocked(drafts.get).mockResolvedValue(stored);
    const { result } = renderHook(() => useHarness(drafts));

    act(() => result.current.dispatch({ type: 'set-name', value: 'Conflicting edit' }));
    await act(async () => {
      await result.current.controls.saveNow();
    });
    expect(result.current.state.saveStatus).toBe('conflict');

    await act(async () => {
      await result.current.controls.reloadStored();
    });
    expect(result.current.state.content.name).toBe('Other tab');
    expect(result.current.state.draft.revision).toBe(2);
    expect(result.current.state.saveStatus).toBe('saved');

    act(() => result.current.dispatch({ type: 'set-name', value: 'Retry me' }));
    await act(async () => {
      await result.current.controls.saveNow();
    });
    expect(result.current.state.saveStatus).toBe('error');
    expect(result.current.state.persistenceError?.message).toBe('Storage temporarily unavailable');

    await act(async () => {
      await result.current.controls.retry();
    });
    expect(result.current.state.content.name).toBe('Retry me');
    expect(result.current.state.saveStatus).toBe('saved');
  });

  it('does not reload a climb that another context moved to Trash', async () => {
    const conflict = new DraftConflictError(initial.id, draftRevision(1), draftRevision(2));
    const drafts = repository(vi.fn().mockRejectedValue(conflict));
    vi.mocked(drafts.get).mockResolvedValue({
      ...saved(draftContent({ name: 'Trashed elsewhere' }), 2),
      trashedAt: '2026-08-02T00:00:02.000Z',
    });
    const { result } = renderHook(() => useHarness(drafts));

    act(() => result.current.dispatch({ type: 'set-name', value: 'Keep my changes' }));
    await act(async () => {
      await result.current.controls.saveNow();
    });
    await act(async () => {
      await expect(result.current.controls.reloadStored()).rejects.toThrow('in Trash');
    });

    expect(result.current.state.content.name).toBe('Keep my changes');
    expect(result.current.state.saveStatus).toBe('conflict');
    expect(result.current.state.persistenceError?.message).toContain('Save a copy');
  });

  it('cancels pending autosave on unmount and remains live under StrictMode effect replay', async () => {
    vi.useFakeTimers();
    const update = vi.fn<LocalDraftRepository['update']>(async (_id, revision, content) =>
      saved(content, Number(revision) + 1),
    );
    const drafts = repository(update);
    const first = renderHook(() => useHarness(drafts));
    act(() => first.result.current.dispatch({ type: 'set-name', value: 'Unmounted' }));
    first.unmount();
    await vi.advanceTimersByTimeAsync(800);
    expect(update).not.toHaveBeenCalled();

    const wrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;
    const strict = renderHook(() => useHarness(drafts), { wrapper });
    act(() => strict.result.current.dispatch({ type: 'set-name', value: 'Strict' }));
    await act(async () => {
      await strict.result.current.controls.saveNow();
    });
    expect(strict.result.current.state.saveStatus).toBe('saved');
  });
});
