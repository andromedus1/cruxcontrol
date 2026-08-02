import { useState } from 'react';
import type { BoardLightController } from '../board-control/light-controller';
import { BoardRenderer } from '../board-renderer/BoardRenderer';
import type { BoardDefinition, ClimbRole } from '../domain/boards/definition';
import { BoardControlBar } from './BoardControlBar';
import { lightSceneFromAssignments } from './light-scene';
import type { ClimbViewRecord } from './types';
import { useBoardLightState } from './use-board-light-state';

export interface ClimbDetailProps {
  readonly definition: BoardDefinition;
  readonly climb: ClimbViewRecord;
  readonly controller?: BoardLightController | null;
  readonly headingLevel?: 1 | 2;
  readonly onEdit?: () => void;
}

const roles: readonly ClimbRole[] = ['start', 'middle', 'finish', 'foot-only'];

export function ClimbDetail({ definition, climb, controller, headingLevel = 2, onEdit }: ClimbDetailProps) {
  const state = useBoardLightState(controller);
  const [localError, setLocalError] = useState('');
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const connected = state.transport.status === 'connected';
  const ready = connected && state.operation === 'idle';
  const empty = climb.assignments.length === 0;
  const hasCustom = climb.assignments.some(({ appearance }) => appearance.kind === 'custom');
  let actionLabel = empty ? 'Clear board' : 'Light this climb';
  let operationStatus = '';
  if (state.operation === 'lighting') {
    actionLabel = 'Lighting…';
    operationStatus = 'Lighting this climb…';
  } else if (state.operation === 'clearing') {
    actionLabel = 'Clearing…';
    operationStatus = 'Clearing the board…';
  } else if (state.operation === 'previewing') {
    actionLabel = 'Previewing…';
    operationStatus = 'Previewing board changes…';
  }
  const boardHeadingId = `board-${String(climb.key).replace(/[^a-z0-9_-]/gi, '-')}`;

  const light = () => {
    if (!controller || !ready) return;
    setLocalError('');
    const action = empty
      ? controller.clear()
      : controller.light(lightSceneFromAssignments(definition, climb.assignments));
    void action.catch((error: unknown) => {
      setLocalError(error instanceof Error ? error.message : 'The board could not be updated.');
    });
  };

  return (
    <article className="climb-detail" aria-labelledby={boardHeadingId}>
      <BoardControlBar controller={controller} />
      <header className="climb-detail__header">
        <div>
          <p className="eyebrow">{climb.origin === 'local-draft' ? 'Local draft' : 'Climb'}</p>
          <Heading id={boardHeadingId}>{climb.name}</Heading>
        </div>
        <span className="angle-badge">{climb.angle}°</span>
      </header>
      <dl className="climb-meta">
        {climb.grade && <><dt>Grade</dt><dd>{climb.grade}</dd></>}
        {climb.setter && <><dt>Setter</dt><dd>{climb.setter}</dd></>}
        <dt>Holds</dt><dd>{climb.assignments.length}</dd>
      </dl>
      {climb.description && <p className="climb-detail__description">{climb.description}</p>}
      <section className="climb-detail__board" aria-label="Board preview">
        <BoardRenderer definition={definition} assignments={climb.assignments} labelledBy={boardHeadingId} />
      </section>
      <ul className="role-legend" aria-label="Hold colors">
        {roles.map((role) => <li key={role}><span style={{ background: definition.rolePresets[role].screenColor }} />{definition.rolePresets[role].label}</li>)}
        {hasCustom && <li><span className="role-legend__custom" />Custom colors</li>}
      </ul>
      <div className="climb-detail__actions">
        <p className="action-status" aria-live="polite">{localError || state.error?.message || operationStatus || (!connected ? 'Connect a board to light this scene.' : '')}</p>
        {onEdit && <button className="button button--secondary" type="button" onClick={onEdit}>Edit climb</button>}
        <button className="button button--primary" type="button" disabled={!ready} onClick={light}>{actionLabel}</button>
      </div>
    </article>
  );
}
