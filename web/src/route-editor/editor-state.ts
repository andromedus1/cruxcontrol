import type { DraftContent, DraftMetadata, LocalClimbDraft } from '../drafts/types';
import { applyEditorTool } from './assignments';
import type { RouteEditorAction, RouteEditorState } from './types';

function contentOf(draft: LocalClimbDraft): DraftContent {
  return Object.freeze({
    installationId: draft.installationId,
    definitionId: draft.definitionId,
    layoutRevision: draft.layoutRevision,
    name: draft.name,
    angle: draft.angle,
    assignments: draft.assignments,
    metadata: draft.metadata,
  });
}

export function createRouteEditorState(draft: LocalClimbDraft): RouteEditorState {
  return Object.freeze({ draft, content: contentOf(draft), generation: 0, persistedGeneration: 0, saveStatus: 'saved', tool: { kind: 'cycle' as const }, persistenceError: null });
}

function changed(state: RouteEditorState, content: DraftContent): RouteEditorState {
  return Object.freeze({ ...state, content: Object.freeze(content), generation: state.generation + 1, saveStatus: 'dirty', persistenceError: null });
}

export function routeEditorReducer(state: RouteEditorState, action: RouteEditorAction): RouteEditorState {
  switch (action.type) {
    case 'set-name': return action.value === state.content.name ? state : changed(state, { ...state.content, name: action.value });
    case 'set-angle': return action.value === state.content.angle ? state : changed(state, { ...state.content, angle: action.value });
    case 'set-metadata': {
      const value = action.value.trim() ? action.value : undefined;
      if (state.content.metadata?.[action.field] === value) return state;
      const metadata: DraftMetadata = { ...state.content.metadata, [action.field]: value };
      if (value === undefined) delete metadata[action.field];
      return changed(state, { ...state.content, metadata: Object.freeze(metadata) });
    }
    case 'set-tool': return Object.freeze({ ...state, tool: action.tool });
    case 'activate-placement': {
      const assignments = applyEditorTool(state.content.assignments, action.placementId, state.tool);
      return assignments === state.content.assignments
        ? state
        : changed(state, { ...state.content, assignments });
    }
    case 'save-started': return Object.freeze({ ...state, saveStatus: 'saving', persistenceError: null });
    case 'save-succeeded': return Object.freeze({ ...state, draft: action.draft, persistedGeneration: action.generation, saveStatus: state.generation === action.generation ? 'saved' : 'dirty', persistenceError: null });
    case 'save-failed': return Object.freeze({ ...state, saveStatus: action.conflict ? 'conflict' : 'error', persistenceError: action.error });
    case 'reload': return createRouteEditorState(action.draft);
  }
}
