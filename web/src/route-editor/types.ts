import type {
  BoardHoldAppearance,
  LightEffectGroup,
  LightEffectGroupId,
} from '../board-renderer/types';
import type { ApiLevel3Color } from '../domain/boards/types';
import type { DraftContent, LocalClimbDraft } from '../drafts/types';

export type EditorTool =
  | { readonly kind: 'cycle' }
  | { readonly kind: 'erase' }
  | { readonly kind: 'eyedropper' }
  | { readonly kind: 'custom'; readonly color: ApiLevel3Color }
  | { readonly kind: 'apply-effect'; readonly effectGroupId: LightEffectGroupId }
  | { readonly kind: 'remove-effect' };

export type EditorSaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

export interface RouteEditorState {
  readonly draft: LocalClimbDraft;
  readonly content: DraftContent;
  readonly generation: number;
  readonly persistedGeneration: number;
  readonly saveStatus: EditorSaveStatus;
  readonly tool: EditorTool;
  readonly advancedColor: ApiLevel3Color;
  readonly persistenceError: Error | null;
}

export type RouteEditorAction =
  | { readonly type: 'set-name'; readonly value: string }
  | { readonly type: 'set-angle'; readonly value: number }
  | {
      readonly type: 'set-metadata';
      readonly field: 'grade' | 'description' | 'setterNotes';
      readonly value: string;
    }
  | { readonly type: 'set-tool'; readonly tool: EditorTool }
  | { readonly type: 'add-effect-group'; readonly group: LightEffectGroup }
  | {
      readonly type: 'update-effect-group';
      readonly id: LightEffectGroupId;
      readonly changes: Partial<Omit<LightEffectGroup, 'id'>>;
    }
  | { readonly type: 'remove-effect-group'; readonly id: LightEffectGroupId }
  | {
      readonly type: 'activate-placement';
      readonly placementId: import('../domain/boards/types').BoardPlacementId;
    }
  | { readonly type: 'save-started'; readonly generation: number }
  | {
      readonly type: 'save-succeeded';
      readonly draft: LocalClimbDraft;
      readonly generation: number;
    }
  | { readonly type: 'save-failed'; readonly error: Error; readonly conflict: boolean }
  | { readonly type: 'reload'; readonly draft: LocalClimbDraft };

export type { BoardHoldAppearance };
