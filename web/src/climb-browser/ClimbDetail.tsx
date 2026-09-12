import { useMemo } from 'react';
import type { BoardLightController } from '../board-control/light-controller';
import { BoardRenderer } from '../board-renderer/BoardRenderer';
import type { BoardDefinition, ClimbRole } from '../domain/boards/definition';
import { BoardControlBar } from './BoardControlBar';
import { renderAnimationFrame } from '../light-effects/frame';
import { useAnimationClock } from '../light-effects/use-animation-clock';
import { useEditorLighting } from '../route-editor/use-editor-lighting';
import type { ClimbViewRecord } from './types';

export interface ClimbDetailProps {
  readonly definition: BoardDefinition;
  readonly climb: ClimbViewRecord;
  readonly controller?: BoardLightController | null;
  readonly showBoardControls?: boolean;
  readonly headingLevel?: 1 | 2;
  readonly onEdit?: () => void;
  readonly onManageLists?: () => void;
  readonly primaryAction?: Readonly<{ label: string; onActivate: () => void }>;
  readonly destructiveAction?: Readonly<{ label: string; onActivate: () => void }>;
}

const roles: readonly ClimbRole[] = ['start', 'middle', 'finish', 'foot-only'];

export function ClimbDetail({
  definition,
  climb,
  controller,
  showBoardControls = true,
  headingLevel = 2,
  onEdit,
  onManageLists,
  primaryAction,
  destructiveAction,
}: ClimbDetailProps) {
  const effectGroups = useMemo(() => climb.effectGroups ?? [], [climb.effectGroups]);
  const lighting = useEditorLighting({
    definition,
    assignments: climb.assignments,
    effectGroups,
    controller,
  });
  const state = lighting.controllerState;
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const connected = state.transport.status === 'connected';
  const lightBusy = lighting.status === 'lighting';
  const ready = connected && !lightBusy && (state.operation === 'idle' || lighting.animationRunning);
  const effectIds = useMemo(() => new Set(effectGroups.map(({ id }) => id)), [effectGroups]);
  const animated = effectGroups.some(({ model }) => model === 'spatial') || climb.assignments.some(
    ({ effectGroupId }) => effectGroupId !== undefined && effectIds.has(effectGroupId),
  );
  const previewElapsedMs = useAnimationClock({ active: animated, fps: 10 });
  const visualScene = useMemo(
    () => renderAnimationFrame({ definition, assignments: climb.assignments, effectGroups, elapsedMs: previewElapsedMs }),
    [climb.assignments, definition, effectGroups, previewElapsedMs],
  );
  const hasCustom = climb.assignments.some(({ appearance }) => appearance.kind === 'custom');
  let operationStatus = '';
  if (lighting.animationRunning) {
    operationStatus = 'Animation running. Keep CruxControl in the foreground.';
  } else if (state.operation === 'lighting') {
    operationStatus = 'Lighting this climb…';
  } else if (state.operation === 'clearing') {
    operationStatus = 'Clearing the board…';
  } else if (state.operation === 'previewing') {
    operationStatus = 'Lighting this climb…';
  } else if (state.operation === 'diagnosing') {
    operationStatus = 'Board capacity test running.';
  }
  const boardHeadingId = `board-${String(climb.key).replace(/[^a-z0-9_-]/gi, '-')}`;

  const light = () => {
    if (!controller || !ready) return;
    void lighting.lightDraft();
  };

  return (
    <article className="climb-detail" aria-labelledby={boardHeadingId}>
      {showBoardControls && <BoardControlBar controller={controller} />}
      <header className="climb-detail__header">
        <div>
          <p className="eyebrow">{climb.origin === 'local-draft' ? 'Local climb' : 'Climb'}</p>
          <Heading id={boardHeadingId}>{climb.name}</Heading>
        </div>
        <span className="angle-badge">{climb.angle}°</span>
      </header>
      <dl className="climb-meta">
        {climb.grade && (
          <>
            <dt>Grade</dt>
            <dd>{climb.grade}</dd>
          </>
        )}
        {climb.setter && (
          <>
            <dt>Setter</dt>
            <dd>{climb.setter}</dd>
          </>
        )}
        <dt>Holds</dt>
        <dd>{climb.assignments.length}</dd>
      </dl>
      {climb.description && <p className="climb-detail__description">{climb.description}</p>}
      <section className="climb-detail__board" aria-label="Board preview">
        <BoardRenderer
          definition={definition}
          assignments={climb.assignments}
          lightScene={visualScene}
          labelledBy={boardHeadingId}
        />
      </section>
      <ul className="role-legend" aria-label="Hold colors">
        {roles.map((role) => (
          <li key={role}>
            <span style={{ background: definition.rolePresets[role].screenColor }} />
            {definition.rolePresets[role].label}
          </li>
        ))}
        {hasCustom && (
          <li>
            <span className="role-legend__custom" />
            Custom colors
          </li>
        )}
      </ul>
      <div className="climb-detail__actions">
        <p className="action-status" aria-live="polite">
          {lighting.message ||
            state.error?.message ||
            operationStatus ||
            (!connected ? 'Connect a board to light this climb automatically.' : 'Selected climb lights automatically.')}
        </p>
        {onEdit && (
          <button className="button button--secondary" type="button" onClick={onEdit}>
            Edit climb
          </button>
        )}
        {onManageLists && (
          <button className="button button--secondary" type="button" onClick={onManageLists}>
            Add to lists
          </button>
        )}
        {primaryAction && (
          <button
            className="button button--secondary"
            type="button"
            onClick={primaryAction.onActivate}
          >
            {primaryAction.label}
          </button>
        )}
        {destructiveAction && (
          <button
            className="button button--destructive"
            type="button"
            onClick={destructiveAction.onActivate}
          >
            {destructiveAction.label}
          </button>
        )}
        {connected && !lighting.animationRunning && (lighting.message || state.error) && (
          <button className="button button--primary" type="button" disabled={!ready} onClick={light}>
            Retry lighting
          </button>
        )}
      </div>
    </article>
  );
}
