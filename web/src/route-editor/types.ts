import type { BoardHoldAppearance } from '../board-renderer/types';
import type { ClimbRole } from '../domain/boards/definition';
import type { ApiLevel3Color } from '../domain/boards/types';
import type { DraftContent, LocalClimbDraft } from '../drafts/types';

export type EditorTool =
  | { readonly kind: 'cycle' }
  | { readonly kind: 'role'; readonly role: ClimbRole }
  | { readonly kind: 'erase' }
  | { readonly kind: 'custom'; readonly color: ApiLevel3Color };

export type EditorSaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

export interface RouteEditorState {
  readonly draft: LocalClimbDraft;
  readonly content: DraftContent;
  readonly generation: number;
  readonly persistedGeneration: number;
  readonly saveStatus: EditorSaveStatus;
  readonly tool: EditorTool;
  readonly persistenceError: Error | null;
}

export type RouteEditorAction =
  | { readonly type: 'set-name'; readonly value: string }
  | { readonly type: 'set-angle'; readonly value: number }
  | { readonly type: 'set-metadata'; readonly field: 'grade' | 'description' | 'setterNotes'; readonly value: string }
  | { readonly type: 'set-tool'; readonly tool: EditorTool }
  | { readonly type: 'activate-placement'; readonly placementId: import('../domain/boards/types').BoardPlacementId }
  | { readonly type: 'save-started'; readonly generation: number }
  | { readonly type: 'save-succeeded'; readonly draft: LocalClimbDraft; readonly generation: number }
  | { readonly type: 'save-failed'; readonly error: Error; readonly conflict: boolean }
  | { readonly type: 'reload'; readonly draft: LocalClimbDraft };

export type { BoardHoldAppearance };
