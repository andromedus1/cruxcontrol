import { useEffect, useId, useMemo, useReducer, useState } from 'react';
import type { BoardLightController } from '../board-control/light-controller';
import { BoardRenderer } from '../board-renderer/BoardRenderer';
import type { BoardDefinition } from '../domain/boards/definition';
import type { BoardPlacementId } from '../domain/boards/types';
import type { LightEffectGroupId } from '../board-renderer/types';
import type { LocalDraftRepository } from '../drafts/repository';
import type { LocalClimbDraft } from '../drafts/types';
import { createRouteEditorState, routeEditorReducer } from './editor-state';
import { RouteEditorToolbar } from './RouteEditorToolbar';
import { LightEffectsPanel } from './LightEffectsPanel';
import { useDraftAutosave } from './use-draft-autosave';
import { useEditorLighting } from './use-editor-lighting';
import { useAnimationClock } from '../light-effects/use-animation-clock';
import { renderAnimationFrame } from '../light-effects/frame';
import './RouteEditorWorkspace.css';
import { BoardCapacityDiagnostics } from '../board-control/BoardCapacityDiagnostics';
import { BoardControlBar } from '../climb-browser/BoardControlBar';

export function RouteEditorWorkspace({
  definition,
  draft,
  repository,
  controller,
  onBack,
  onDraftIdentityChange,
}: {
  readonly definition: BoardDefinition;
  readonly draft: LocalClimbDraft;
  readonly repository: LocalDraftRepository;
  readonly controller?: BoardLightController | null;
  readonly onBack: () => void;
  readonly onDraftIdentityChange?: (draft: LocalClimbDraft) => void;
}) {
  const [state, dispatch] = useReducer(routeEditorReducer, draft, createRouteEditorState);
  const autosave = useDraftAutosave({ repository, state, dispatch });
  const lighting = useEditorLighting({
    definition,
    assignments: state.content.assignments,
    effectGroups: state.content.effectGroups,
    controller,
  });
  const boardHeading = useId();
  const [boardScale, setBoardScale] = useState(1);
  const [selectedEffectId, setSelectedEffectId] = useState<LightEffectGroupId | null>(
    state.content.effectGroups[0]?.id ?? null,
  );
  const hasAnimatedAssignments = useMemo(() => {
    const ids = new Set(state.content.effectGroups.map(({ id }) => id));
    return state.content.effectGroups.some((group) => group.model === 'spatial') || state.content.assignments.some(
      ({ effectGroupId }) => effectGroupId !== undefined && ids.has(effectGroupId),
    );
  }, [state.content.assignments, state.content.effectGroups]);
  const previewElapsedMs = useAnimationClock({ active: hasAnimatedAssignments, fps: 10 });
  const visualScene = useMemo(
    () =>
      renderAnimationFrame({
        definition,
        assignments: state.content.assignments,
        effectGroups: state.content.effectGroups,
        elapsedMs: previewElapsedMs,
      }),
    [definition, previewElapsedMs, state.content.assignments, state.content.effectGroups],
  );
  useEffect(() => onDraftIdentityChange?.(state.draft), [onDraftIdentityChange, state.draft]);
  useEffect(() => {
    if (
      selectedEffectId !== null &&
      state.content.effectGroups.some(({ id }) => id === selectedEffectId)
    )
      return;
    setSelectedEffectId(state.content.effectGroups[0]?.id ?? null);
  }, [selectedEffectId, state.content.effectGroups]);
  const risky = state.saveStatus !== 'saved';
  const back = () => {
    if (!risky || window.confirm('Leave with changes that may not be saved?')) onBack();
  };
  const lightBusy = lighting.status === 'lighting';
  const unsupported = !controller || lighting.controllerState.transport.status === 'unsupported';
  const connected = lighting.controllerState.transport.status === 'connected';
  const activatePlacement = (placementId: BoardPlacementId) => {
    if (state.tool.kind !== 'eyedropper') {
      dispatch({ type: 'activate-placement', placementId });
      return;
    }
    const sampled = state.content.assignments.find(
      (assignment) => assignment.placementId === placementId,
    )?.appearance;
    if (!sampled) return;
    dispatch({
      type: 'set-tool',
      tool: {
        kind: 'custom',
        color:
          sampled.kind === 'custom'
            ? sampled.color
            : definition.rolePresets[sampled.role].lightColor,
      },
    });
  };
  return (
    <main className="route-editor">
      <BoardControlBar controller={controller} />
      <header className="route-editor__header">
        <button className="button button--secondary" type="button" onClick={back}>
          Back
        </button>
        <div>
          <p className="eyebrow">
            {state.content.status === 'draft' ? 'Draft' : 'Finished'} · Fullride 7×10
          </p>
          <h1>{state.content.name.trim() || 'Untitled climb'}</h1>
        </div>
        <span
          className={`save-chip save-chip--${state.saveStatus}`}
          role="status"
          aria-live="polite"
        >
          {state.saveStatus}
        </span>
      </header>
      <div className="route-editor__layout">
        <aside className="route-editor__rail">
          <section className="editor-fields" aria-labelledby="details-heading">
            <h2 id="details-heading">Climb details</h2>
            <label>
              Name
              <input
                value={state.content.name}
                onChange={(event) => dispatch({ type: 'set-name', value: event.target.value })}
              />
            </label>
            <label>
              Angle
              <select
                value={state.content.angle}
                onChange={(event) =>
                  dispatch({ type: 'set-angle', value: Number(event.target.value) })
                }
              >
                {definition.supportedAngles.map((angle) => (
                  <option key={angle} value={angle}>
                    {angle}°
                  </option>
                ))}
              </select>
            </label>
            <details>
              <summary>Optional details</summary>
              <label>
                Grade
                <input
                  value={state.content.metadata?.grade ?? ''}
                  onChange={(event) =>
                    dispatch({ type: 'set-metadata', field: 'grade', value: event.target.value })
                  }
                />
              </label>
              <label>
                Description
                <textarea
                  value={state.content.metadata?.description ?? ''}
                  onChange={(event) =>
                    dispatch({
                      type: 'set-metadata',
                      field: 'description',
                      value: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Setter notes
                <textarea
                  value={state.content.metadata?.setterNotes ?? ''}
                  onChange={(event) =>
                    dispatch({
                      type: 'set-metadata',
                      field: 'setterNotes',
                      value: event.target.value,
                    })
                  }
                />
              </label>
            </details>
          </section>
          <RouteEditorToolbar
            tool={state.tool}
            advancedColor={state.advancedColor}
            onToolChange={(tool) => dispatch({ type: 'set-tool', tool })}
          />
          <LightEffectsPanel
            state={state}
            assignments={state.content.assignments}
            selectedId={selectedEffectId}
            onSelectedIdChange={setSelectedEffectId}
            dispatch={dispatch}
          />
          <BoardCapacityDiagnostics
            controller={controller}
            maxLights={definition.placements.length}
          />
        </aside>
        <section className="route-editor__board" aria-labelledby={boardHeading}>
          <div className="board-title">
            <h2 id={boardHeading}>Choose holds</h2>
            <span>{state.content.assignments.length} lit</span>
          </div>
          <div className="board-zoom" aria-label="Board zoom controls">
            <button type="button" onClick={() => setBoardScale(1)} disabled={boardScale === 1}>
              Fit
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => setBoardScale((value) => Math.max(1, value - 0.5))}
              disabled={boardScale === 1}
            >
              −
            </button>
            <span className="board-zoom__value" aria-label="Board zoom">
              {Math.round(boardScale * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setBoardScale((value) => Math.min(3, value + 0.5))}
              disabled={boardScale === 3}
            >
              +
            </button>
          </div>
          <p className="board-hint">
            Tap a hold to apply the selected tool. Pinch to zoom and drag to pan. Arrow keys move
            between holds; Enter or Space applies it.
          </p>
          <BoardRenderer
            definition={definition}
            assignments={state.content.assignments}
            lightScene={visualScene}
            interactionMode="select"
            scale={boardScale}
            onScaleChange={setBoardScale}
            labelledBy={boardHeading}
            onPlacementActivate={activatePlacement}
          />
        </section>
      </div>
      {(state.saveStatus === 'error' || state.saveStatus === 'conflict') && (
        <section className="editor-recovery" role="alert">
          <p>{state.persistenceError?.message}</p>
          {state.saveStatus === 'conflict' ? (
            <>
              <button
                type="button"
                onClick={() => void autosave.reloadStored().catch(() => undefined)}
              >
                Reload stored draft
              </button>
              <button type="button" onClick={() => void autosave.saveCopy().catch(() => undefined)}>
                Save a copy
              </button>
            </>
          ) : (
            <button type="button" onClick={() => void autosave.retry()}>
              Retry save
            </button>
          )}
        </section>
      )}
      <footer className="editor-actions">
        <p aria-live="polite">
          <span>
            {lighting.message ??
            (unsupported
              ? 'Bluetooth control is unavailable here; editing and saving still work.'
              : lighting.status === 'previewing'
                ? 'Previewing latest holds…'
                : connected ? 'Changes light automatically.' : 'Connect a board to light this climb automatically.')}
          </span>
          {lighting.capacity && (
            <span className="editor-actions__capacity">
              {lighting.capacity.label}
              {lighting.capacity.effectiveAnimationFps !== null
                ? ` · ${lighting.capacity.effectiveAnimationFps} FPS complete scenes`
                : ''}
            </span>
          )}
        </p>
        {lighting.animationRunning && (
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void lighting.stopAnimation()}
          >
            Stop animation
          </button>
        )}
        <button
          className="button button--secondary"
          type="button"
          onClick={() =>
            dispatch({
              type: 'set-status',
              value: state.content.status === 'draft' ? 'finished' : 'draft',
            })
          }
        >
          {state.content.status === 'draft' ? 'Mark finished' : 'Move to drafts'}
        </button>
        {connected && (hasAnimatedAssignments || lighting.message) && <button
          className="button button--primary"
          type="button"
          disabled={lightBusy}
          onClick={() => void lighting.lightDraft()}
        >
          {hasAnimatedAssignments ? 'Restart animation' : 'Retry lighting'}
        </button>}
      </footer>
    </main>
  );
}
