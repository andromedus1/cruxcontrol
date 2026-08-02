import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch } from 'react';
import { DraftConflictError } from '../drafts/errors';
import type { LocalDraftRepository } from '../drafts/repository';
import type { LocalClimbDraft } from '../drafts/types';
import type { RouteEditorAction, RouteEditorState } from './types';

export interface DraftAutosaveControls {
  saveNow(): Promise<void>;
  retry(): Promise<void>;
  reloadStored(): Promise<void>;
  saveCopy(): Promise<LocalClimbDraft>;
}

export function useDraftAutosave({ repository, state, dispatch, delayMs = 800 }: { readonly repository: LocalDraftRepository; readonly state: RouteEditorState; readonly dispatch: Dispatch<RouteEditorAction>; readonly delayMs?: number }): DraftAutosaveControls {
  const latest = useRef(state);
  const active = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  latest.current = state;

  useEffect(() => () => { mounted.current = false; }, []);

  const saveNow = useCallback(async () => {
    if (active.current) return active.current;
    const run = async () => {
      do {
        const snapshot = latest.current;
        if (snapshot.generation === snapshot.persistedGeneration && snapshot.saveStatus !== 'error') return;
        dispatch({ type: 'save-started', generation: snapshot.generation });
        try {
          const saved = await repository.update(snapshot.draft.id, snapshot.draft.revision, snapshot.content);
          if (!mounted.current) return;
          dispatch({ type: 'save-succeeded', draft: saved, generation: snapshot.generation });
          latest.current = { ...latest.current, draft: saved, persistedGeneration: snapshot.generation };
        } catch (error) {
          if (mounted.current) dispatch({ type: 'save-failed', error: error instanceof Error ? error : new Error('Could not save draft'), conflict: error instanceof DraftConflictError });
          return;
        }
      } while (latest.current.generation !== latest.current.persistedGeneration);
    };
    active.current = run().finally(() => { active.current = null; });
    return active.current;
  }, [dispatch, repository]);

  useEffect(() => {
    if (state.saveStatus !== 'dirty') return;
    const timer = window.setTimeout(() => void saveNow(), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, saveNow, state.generation, state.saveStatus]);

  useEffect(() => {
    if (!['dirty', 'saving', 'error', 'conflict'].includes(state.saveStatus)) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.saveStatus]);

  return {
    saveNow,
    retry: saveNow,
    async reloadStored() {
      const stored = await repository.get(latest.current.draft.id);
      if (!stored) throw new Error('The stored draft no longer exists.');
      dispatch({ type: 'reload', draft: stored });
    },
    async saveCopy() {
      const copy = await repository.create(latest.current.content);
      dispatch({ type: 'reload', draft: copy });
      return copy;
    },
  };
}
