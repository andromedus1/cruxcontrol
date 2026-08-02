import { useEffect, useMemo, useRef } from 'react';
import type { BoardLightController } from '../board-control/light-controller';
import type { BoardDefinition } from '../domain/boards/definition';
import { ClimbDetail } from './ClimbDetail';
import type { ClimbViewKey, ClimbViewRecord } from './types';
import './LocalClimbViewer.css';

export interface LocalClimbViewerProps {
  readonly definition: BoardDefinition;
  readonly climbs: readonly ClimbViewRecord[];
  readonly selectedKey: ClimbViewKey | null;
  readonly onSelectedKeyChange: (key: ClimbViewKey | null) => void;
  readonly controller?: BoardLightController | null;
  readonly onCreateClimb?: () => void;
  readonly onEditClimb?: (key: ClimbViewKey) => void;
}

function validateRecords(definition: BoardDefinition, climbs: readonly ClimbViewRecord[]) {
  const keys = new Set<ClimbViewKey>();
  for (const climb of climbs) {
    if (keys.has(climb.key)) throw new Error(`Duplicate climb view key ${climb.key}`);
    keys.add(climb.key);
    if (!Number.isFinite(climb.angle) || !definition.supportedAngles.includes(climb.angle)) {
      throw new RangeError(`Climb ${climb.key} uses unsupported angle ${climb.angle}`);
    }
  }
}

export function LocalClimbViewer({
  definition,
  climbs,
  selectedKey,
  onSelectedKeyChange,
  controller,
  onCreateClimb,
  onEditClimb,
}: LocalClimbViewerProps) {
  validateRecords(definition, climbs);
  const selected = useMemo(
    () => climbs.find(({ key }) => key === selectedKey) ?? null,
    [climbs, selectedKey],
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogMode = useRef<'closed' | 'modeless' | 'modal'>('closed');
  const rowRefs = useRef(new Map<ClimbViewKey, HTMLButtonElement>());
  const returnFocusKey = useRef<ClimbViewKey | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const media = window.matchMedia('(min-width: 900px)');
    const sync = () => {
      if (!selected) {
        if (dialog.open) dialog.close();
        dialogMode.current = 'closed';
        return;
      }
      if (media.matches) {
        if (dialogMode.current === 'modal' && dialog.open) dialog.close();
        if (!dialog.open) dialog.setAttribute('open', '');
        dialogMode.current = 'modeless';
      } else {
        if (dialogMode.current === 'modeless' && dialog.open) dialog.removeAttribute('open');
        if (!dialog.open) dialog.showModal();
        dialogMode.current = 'modal';
      }
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [selected]);

  const dismiss = () => {
    const key = returnFocusKey.current;
    onSelectedKeyChange(null);
    requestAnimationFrame(() => key && rowRefs.current.get(key)?.focus());
  };

  return (
    <div className="local-climb-viewer">
      <aside className="climb-list-pane" aria-label="Saved climbs">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Fullride 7×10</p>
            <h1>My climbs</h1>
          </div>
          {onCreateClimb && <button className="button button--primary" type="button" onClick={onCreateClimb}>Create climb</button>}
        </header>
        {climbs.length === 0 ? (
          <section className="climb-empty">
            <p className="climb-empty__symbol" aria-hidden="true">◇</p>
            <h2>No saved climbs yet</h2>
            <p>Create a draft to choose holds, save it locally, and light it on your board.</p>
            {onCreateClimb && <button className="button button--primary" type="button" onClick={onCreateClimb}>Create your first climb</button>}
          </section>
        ) : (
          <ul className="climb-list">
            {climbs.map((climb) => (
              <li key={climb.key}>
                <button
                  ref={(element) => {
                    if (element) rowRefs.current.set(climb.key, element);
                    else rowRefs.current.delete(climb.key);
                  }}
                  className="climb-row"
                  type="button"
                  aria-current={selected?.key === climb.key ? 'true' : undefined}
                  onClick={() => {
                    returnFocusKey.current = climb.key;
                    onSelectedKeyChange(climb.key);
                  }}
                >
                  <span className="climb-row__name">{climb.name}</span>
                  <span className="climb-row__meta">{climb.angle}°{climb.grade ? ` · ${climb.grade}` : ''}{climb.setter ? ` · ${climb.setter}` : ''}</span>
                  <span className="climb-row__holds">{climb.assignments.length} holds</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <main className="climb-detail-pane">
        {!selected && <section className="no-selection"><p>Select a saved climb to inspect its holds and light the board.</p></section>}
        <dialog
          ref={dialogRef}
          className="climb-sheet"
          aria-label={selected ? `${selected.name} details` : 'Climb details'}
          onCancel={(event) => { event.preventDefault(); dismiss(); }}
          onClose={() => { if (selected && window.matchMedia('(max-width: 899px)').matches) dismiss(); }}
        >
          {selected && (
            <>
              <button className="climb-sheet__close" type="button" aria-label="Close climb details" onClick={dismiss}>×</button>
              <ClimbDetail definition={definition} climb={selected} controller={controller} onEdit={onEditClimb ? () => onEditClimb(selected.key) : undefined} />
            </>
          )}
        </dialog>
      </main>
    </div>
  );
}
