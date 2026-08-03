import type { DraftContent, DraftMetadata, LocalClimbDraft } from '../drafts/types';
import { applyEditorTool } from './assignments';
import type { RouteEditorAction, RouteEditorState } from './types';
import { apiLevel3Color } from '../domain/boards/colors';
import type { LightEffectGroup } from '../board-renderer/types';

function contentOf(draft: LocalClimbDraft): DraftContent {
  return Object.freeze({
    status: draft.status,
    installationId: draft.installationId,
    definitionId: draft.definitionId,
    layoutRevision: draft.layoutRevision,
    name: draft.name,
    angle: draft.angle,
    assignments: draft.assignments,
    effectGroups: draft.effectGroups,
    metadata: draft.metadata,
  });
}

export function createRouteEditorState(draft: LocalClimbDraft): RouteEditorState {
  return Object.freeze({
    draft,
    content: contentOf(draft),
    generation: 0,
    persistedGeneration: 0,
    saveStatus: 'saved',
    tool: { kind: 'cycle' as const },
    advancedColor: apiLevel3Color(0b001_100_10),
    persistenceError: null,
  });
}

function changed(state: RouteEditorState, content: DraftContent): RouteEditorState {
  return Object.freeze({
    ...state,
    content: Object.freeze(content),
    generation: state.generation + 1,
    saveStatus: 'dirty',
    persistenceError: null,
  });
}

export function routeEditorReducer(
  state: RouteEditorState,
  action: RouteEditorAction,
): RouteEditorState {
  switch (action.type) {
    case 'set-status':
      return action.value === state.content.status
        ? state
        : changed(state, { ...state.content, status: action.value });
    case 'set-name':
      return action.value === state.content.name
        ? state
        : changed(state, { ...state.content, name: action.value });
    case 'set-angle':
      return action.value === state.content.angle
        ? state
        : changed(state, { ...state.content, angle: action.value });
    case 'set-metadata': {
      const value = action.value.trim() ? action.value : undefined;
      if (state.content.metadata?.[action.field] === value) return state;
      const metadata: DraftMetadata = { ...state.content.metadata, [action.field]: value };
      if (value === undefined) delete metadata[action.field];
      return changed(state, { ...state.content, metadata: Object.freeze(metadata) });
    }
    case 'set-tool':
      return Object.freeze({
        ...state,
        tool: action.tool,
        advancedColor: action.tool.kind === 'custom' ? action.tool.color : state.advancedColor,
      });
    case 'add-effect-group':
      return changed(state, {
        ...state.content,
        effectGroups: Object.freeze([...state.content.effectGroups, Object.freeze(action.group)]),
      });
    case 'replace-effect-groups':
      return changed(state, { ...state.content, effectGroups: Object.freeze([...action.groups]) });
    case 'update-effect-group': {
      const current = state.content.effectGroups.find(({ id }) => id === action.id);
      if (!current) return state;
      const updated = Object.freeze({ ...current, ...action.changes, id: current.id }) as LightEffectGroup;
      return changed(state, {
        ...state.content,
        effectGroups: Object.freeze(
          state.content.effectGroups.map((group) => (group.id === action.id ? updated : group)),
        ),
      });
    }
    case 'remove-effect-group': {
      if (!state.content.effectGroups.some(({ id }) => id === action.id)) return state;
      const assignments = Object.freeze(
        state.content.assignments.map((assignment) => {
          if (assignment.effectGroupId !== action.id) return assignment;
          const { effectGroupId: _removed, ...base } = assignment;
          return Object.freeze(base);
        }),
      );
      return changed(
        {
          ...state,
          tool:
            (state.tool.kind === 'apply-effect' || state.tool.kind === 'spatial-include' || state.tool.kind === 'spatial-exclude') && state.tool.effectGroupId === action.id
              ? { kind: 'cycle' }
              : state.tool,
        },
        {
          ...state.content,
          assignments,
          effectGroups: Object.freeze(
            state.content.effectGroups.filter(({ id }) => id !== action.id),
          ),
        },
      );
    }
    case 'activate-placement': {
      if (state.tool.kind === 'spatial-include' || state.tool.kind === 'spatial-exclude') {
        const spatialTool = state.tool;
        const group = state.content.effectGroups.find(({ id }) => id === spatialTool.effectGroupId);
        if (group?.model !== 'spatial') return state;
        const field = spatialTool.kind === 'spatial-include' ? 'include' : 'exclude';
        const other = field === 'include' ? 'exclude' : 'include';
        const current = group.target[field];
        const next = current.includes(action.placementId)
          ? current.filter((id) => id !== action.placementId)
          : [...current, action.placementId];
        const target = Object.freeze({ ...group.target, [field]: Object.freeze(next), [other]: Object.freeze(group.target[other].filter((id) => id !== action.placementId)) });
        return changed(state, { ...state.content, effectGroups: Object.freeze(state.content.effectGroups.map((candidate) => candidate.id === group.id ? Object.freeze({ ...group, target }) : candidate)) });
      }
      const assignments = applyEditorTool(
        state.content.assignments,
        action.placementId,
        state.tool,
      );
      return assignments === state.content.assignments
        ? state
        : changed(state, { ...state.content, assignments });
    }
    case 'save-started':
      return Object.freeze({ ...state, saveStatus: 'saving', persistenceError: null });
    case 'save-succeeded':
      return Object.freeze({
        ...state,
        draft: action.draft,
        persistedGeneration: action.generation,
        saveStatus: state.generation === action.generation ? 'saved' : 'dirty',
        persistenceError: null,
      });
    case 'save-failed':
      return Object.freeze({
        ...state,
        saveStatus: action.conflict ? 'conflict' : 'error',
        persistenceError: action.error,
      });
    case 'reload':
      return createRouteEditorState(action.draft);
  }
}
