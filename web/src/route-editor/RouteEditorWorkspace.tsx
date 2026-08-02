import { useEffect, useId, useReducer, useState } from 'react';
import type { BoardLightController } from '../board-control/light-controller';
import { BoardRenderer } from '../board-renderer/BoardRenderer';
import type { BoardDefinition } from '../domain/boards/definition';
import type { LocalDraftRepository } from '../drafts/repository';
import type { LocalClimbDraft } from '../drafts/types';
import { createRouteEditorState, routeEditorReducer } from './editor-state';
import { RouteEditorToolbar } from './RouteEditorToolbar';
import { useDraftAutosave } from './use-draft-autosave';
import { useEditorLighting } from './use-editor-lighting';
import './RouteEditorWorkspace.css';

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
    controller,
  });
  const boardHeading = useId();
  const [boardScale, setBoardScale] = useState(1);
  useEffect(() => onDraftIdentityChange?.(state.draft), [onDraftIdentityChange, state.draft]);
  const risky = state.saveStatus !== 'saved';
  const back = () => {
    if (!risky || window.confirm('Leave with changes that may not be saved?')) onBack();
  };
  const lightBusy = lighting.status === 'connecting' || lighting.status === 'lighting';
  const unsupported = !controller || lighting.controllerState.transport.status === 'unsupported';
  const lightLabel =
    lighting.status === 'connecting'
      ? 'Connecting…'
      : lighting.status === 'lighting'
        ? 'Lighting…'
        : lighting.controllerState.transport.status === 'connected'
          ? 'Light draft'
          : 'Connect & light';
  return (
    <main className="route-editor">
      <header className="route-editor__header">
        <button className="button button--secondary" type="button" onClick={back}>
          Back
        </button>
        <div>
          <p className="eyebrow">Local draft · Fullride 7×10</p>
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
            definition={definition}
            onToolChange={(tool) => dispatch({ type: 'set-tool', tool })}
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
            interactionMode="select"
            scale={boardScale}
            onScaleChange={setBoardScale}
            labelledBy={boardHeading}
            onPlacementActivate={(placementId) =>
              dispatch({ type: 'activate-placement', placementId })
            }
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
          {lighting.message ??
            (unsupported
              ? 'Bluetooth control is unavailable here; editing and saving still work.'
              : lighting.status === 'previewing'
                ? 'Previewing latest holds…'
                : '')}
        </p>
        <label className="live-toggle">
          <input
            type="checkbox"
            checked={lighting.livePreview}
            disabled={lighting.controllerState.transport.status !== 'connected'}
            onChange={(event) => lighting.setLivePreview(event.target.checked)}
          />
          Live Preview
        </label>
        <button
          className="button button--secondary"
          type="button"
          disabled={state.saveStatus === 'saving'}
          onClick={() => void autosave.saveNow()}
        >
          Save now
        </button>
        <button
          className="button button--primary"
          type="button"
          disabled={unsupported || lightBusy}
          onClick={() => void lighting.lightDraft()}
        >
          {lightLabel}
        </button>
      </footer>
    </main>
  );
}
