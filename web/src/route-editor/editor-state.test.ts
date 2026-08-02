import { describe, expect, it } from 'vitest';
import { apiLevel3Color } from '../domain/boards/colors';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { draftRevision, localDraftId } from '../drafts/codec';
import { draftContent } from '../drafts/test-fixtures';
import type { LocalClimbDraft } from '../drafts/types';
import { applyEditorTool, cycleAppearance } from './assignments';
import { createRouteEditorState, routeEditorReducer } from './editor-state';
import { lightEffectGroupId } from '../board-renderer/types';

const placementId = kilterFullride7x10Definition.placements[0]!.id;
const draft: LocalClimbDraft = {
  ...draftContent(),
  schemaVersion: 3,
  id: localDraftId('11111111-1111-4111-8111-111111111111'),
  revision: draftRevision(1),
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
  metadata: {},
};

describe('route editor model', () => {
  it('cycles through every semantic role and then unused', () => {
    let appearance = cycleAppearance();
    expect(appearance).toEqual({ kind: 'role', role: 'start' });
    appearance = cycleAppearance(appearance!);
    expect(appearance).toEqual({ kind: 'role', role: 'middle' });
    appearance = cycleAppearance(appearance!);
    expect(appearance).toEqual({ kind: 'role', role: 'finish' });
    appearance = cycleAppearance(appearance!);
    expect(appearance).toEqual({ kind: 'role', role: 'foot-only' });
    expect(cycleAppearance(appearance!)).toBeNull();
  });

  it('overwrites and erases custom colors without validity rules', () => {
    const custom = applyEditorTool([], placementId, { kind: 'custom', color: apiLevel3Color(255) });
    expect(custom[0]?.appearance).toEqual({ kind: 'custom', color: 255 });
    expect(applyEditorTool(custom, placementId, { kind: 'erase' })).toEqual([]);
  });

  it('keeps exact no-op assignments clean and accepts every packed color', () => {
    const empty: readonly never[] = [];
    expect(applyEditorTool(empty, placementId, { kind: 'erase' })).toBe(empty);

    for (let packed = 0; packed <= 255; packed += 1) {
      const custom = applyEditorTool([], placementId, {
        kind: 'custom',
        color: apiLevel3Color(packed),
      });
      expect(custom[0]?.appearance).toEqual({ kind: 'custom', color: packed });
    }

    const state = createRouteEditorState(draft);
    const eraseState = routeEditorReducer(
      routeEditorReducer(state, { type: 'set-tool', tool: { kind: 'erase' } }),
      { type: 'activate-placement', placementId },
    );
    expect(eraseState.generation).toBe(0);
    expect(eraseState.saveStatus).toBe('saved');
  });

  it('applies and removes effect membership only on assigned holds while preserving base color', () => {
    const effectGroupId = lightEffectGroupId('side-pulse');
    const empty: readonly never[] = [];
    expect(applyEditorTool(empty, placementId, { kind: 'apply-effect', effectGroupId })).toBe(
      empty,
    );
    const custom = applyEditorTool([], placementId, {
      kind: 'custom',
      color: apiLevel3Color(173),
    });
    const animated = applyEditorTool(custom, placementId, { kind: 'apply-effect', effectGroupId });
    expect(animated[0]).toEqual({
      placementId,
      appearance: { kind: 'custom', color: 173 },
      effectGroupId,
    });
    expect(applyEditorTool(animated, placementId, { kind: 'apply-effect', effectGroupId })).toBe(
      animated,
    );
    expect(applyEditorTool(animated, placementId, { kind: 'remove-effect' })).toEqual(custom);
  });

  it('adds, edits, and removes normalized effect groups and clears dangling membership', () => {
    const effectGroupId = lightEffectGroupId('side-wave');
    const group = {
      id: effectGroupId,
      kind: 'wave' as const,
      palette: [apiLevel3Color(12)],
      periodMs: 1500,
      intensity: 0.8,
    };
    let state = createRouteEditorState(draft);
    state = routeEditorReducer(state, { type: 'add-effect-group', group });
    expect(state.content.effectGroups).toEqual([group]);
    state = routeEditorReducer(state, {
      type: 'update-effect-group',
      id: effectGroupId,
      changes: { kind: 'twinkle', periodMs: 900 },
    });
    expect(state.content.effectGroups[0]).toMatchObject({ kind: 'twinkle', periodMs: 900 });
    state = routeEditorReducer(
      routeEditorReducer(
        routeEditorReducer(state, {
          type: 'set-tool',
          tool: { kind: 'custom', color: apiLevel3Color(12) },
        }),
        { type: 'activate-placement', placementId },
      ),
      { type: 'set-tool', tool: { kind: 'apply-effect', effectGroupId } },
    );
    state = routeEditorReducer(state, { type: 'activate-placement', placementId });
    expect(state.content.assignments[0]?.effectGroupId).toBe(effectGroupId);
    state = routeEditorReducer(state, { type: 'remove-effect-group', id: effectGroupId });
    expect(state.content.effectGroups).toEqual([]);
    expect(state.content.assignments[0]).not.toHaveProperty('effectGroupId');
  });

  it('does not dirty on identical metadata', () => {
    const state = createRouteEditorState(draft);
    expect(routeEditorReducer(state, { type: 'set-name', value: '' })).toBe(state);
    expect(routeEditorReducer(state, { type: 'set-name', value: 'Wave' }).saveStatus).toBe('dirty');
  });

  it('preserves ordinary metadata spaces while omitting blank-only values', () => {
    const state = createRouteEditorState(draft);
    const withSpace = routeEditorReducer(state, {
      type: 'set-metadata',
      field: 'description',
      value: 'Move left ',
    });
    expect(withSpace.content.metadata?.description).toBe('Move left ');
    const withSentence = routeEditorReducer(withSpace, {
      type: 'set-metadata',
      field: 'description',
      value: 'Move left now',
    });
    expect(withSentence.content.metadata?.description).toBe('Move left now');
    expect(
      routeEditorReducer(withSentence, { type: 'set-metadata', field: 'description', value: '   ' })
        .content.metadata?.description,
    ).toBeUndefined();
  });
});
