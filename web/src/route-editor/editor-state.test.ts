import { describe, expect, it } from 'vitest';
import { apiLevel3Color } from '../domain/boards/colors';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { draftRevision, localDraftId } from '../drafts/codec';
import { draftContent } from '../drafts/test-fixtures';
import type { LocalClimbDraft } from '../drafts/types';
import { applyEditorTool, cycleAppearance } from './assignments';
import { createRouteEditorState, routeEditorReducer } from './editor-state';

const placementId = kilterFullride7x10Definition.placements[0]!.id;
const draft: LocalClimbDraft = { ...draftContent(), schemaVersion: 1, id: localDraftId('11111111-1111-4111-8111-111111111111'), revision: draftRevision(1), createdAt: '2026-08-02T00:00:00.000Z', updatedAt: '2026-08-02T00:00:00.000Z', metadata: {} };

describe('route editor model', () => {
  it('cycles through every semantic role and then unused', () => {
    let appearance = cycleAppearance();
    expect(appearance).toEqual({ kind: 'role', role: 'start' });
    appearance = cycleAppearance(appearance!); expect(appearance).toEqual({ kind: 'role', role: 'middle' });
    appearance = cycleAppearance(appearance!); expect(appearance).toEqual({ kind: 'role', role: 'finish' });
    appearance = cycleAppearance(appearance!); expect(appearance).toEqual({ kind: 'role', role: 'foot-only' });
    expect(cycleAppearance(appearance!)).toBeNull();
  });

  it('overwrites and erases custom colors without validity rules', () => {
    const custom = applyEditorTool([], placementId, { kind: 'custom', color: apiLevel3Color(255) });
    expect(custom[0]?.appearance).toEqual({ kind: 'custom', color: 255 });
    expect(applyEditorTool(custom, placementId, { kind: 'erase' })).toEqual([]);
  });

  it('does not dirty on identical metadata', () => {
    const state = createRouteEditorState(draft);
    expect(routeEditorReducer(state, { type: 'set-name', value: '' })).toBe(state);
    expect(routeEditorReducer(state, { type: 'set-name', value: 'Wave' }).saveStatus).toBe('dirty');
  });
});
