import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  readonly heading: string;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  readonly listHeader?: ReactNode;
  readonly listFooter?: ReactNode;
  readonly onCreateClimb?: () => void;
  readonly onEditClimb?: (key: ClimbViewKey) => void;
  readonly onManageLists?: (key: ClimbViewKey) => void;
  readonly primaryAction?: Readonly<{
    label: string;
    onActivate: (key: ClimbViewKey) => void;
  }>;
  readonly destructiveAction?: Readonly<{
    label: string;
    onActivate: (key: ClimbViewKey) => void;
  }>;
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
  heading,
  emptyTitle,
  emptyDescription,
  listHeader,
  listFooter,
  onCreateClimb,
  onEditClimb,
  onManageLists,
  primaryAction,
  destructiveAction,
}: LocalClimbViewerProps) {
  validateRecords(definition, climbs);
  const selected = useMemo(
    () => climbs.find(({ key }) => key === selectedKey) ?? null,
    [climbs, selectedKey],
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogMode = useRef<'closed' | 'modeless' | 'modal'>('closed');
  const [desktopDetails, setDesktopDetails] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  const rowRefs = useRef(new Map<ClimbViewKey, HTMLButtonElement>());
  const returnFocusKey = useRef<ClimbViewKey | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const media = window.matchMedia('(min-width: 900px)');
    const sync = () => {
      setDesktopDetails(media.matches);
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
      <aside className="climb-list-pane" aria-label={heading}>
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Fullride 7×10</p>
            <h1>{heading}</h1>
          </div>
          {onCreateClimb && (
            <button className="button button--primary" type="button" onClick={onCreateClimb}>
              Create climb
            </button>
          )}
        </header>
        {listHeader}
        {climbs.length === 0 ? (
          <section className="climb-empty">
            <p className="climb-empty__symbol" aria-hidden="true">
              ◇
            </p>
            <h2>{emptyTitle}</h2>
            <p>{emptyDescription}</p>
            {onCreateClimb && (
              <button className="button button--primary" type="button" onClick={onCreateClimb}>
                Create your first climb
              </button>
            )}
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
                  <span className="climb-row__meta">
                    {climb.angle}°{climb.grade ? ` · ${climb.grade}` : ''}
                    {climb.setter ? ` · ${climb.setter}` : ''}
                  </span>
                  <span className="climb-row__holds">{climb.assignments.length} holds</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {listFooter}
      </aside>
      <main className="climb-detail-pane">
        {!selected && (
          <section className="no-selection">
            <p>Select a climb to inspect its holds and light the board.</p>
          </section>
        )}
        <dialog
          ref={dialogRef}
          className="climb-sheet"
          aria-label={selected ? `${selected.name} details` : 'Climb details'}
          onCancel={(event) => {
            event.preventDefault();
            dismiss();
          }}
          onClose={() => {
            if (selected && window.matchMedia('(max-width: 899px)').matches) dismiss();
          }}
        >
          {selected && (
            <>
              <button
                className="climb-sheet__close"
                type="button"
                aria-label="Close climb details"
                onClick={dismiss}
              >
                ×
              </button>
              <ClimbDetail
                key={selected.key}
                definition={definition}
                climb={selected}
                controller={controller}
                showBoardControls={!desktopDetails}
                onEdit={onEditClimb ? () => onEditClimb(selected.key) : undefined}
                onManageLists={onManageLists ? () => onManageLists(selected.key) : undefined}
                primaryAction={
                  primaryAction
                    ? {
                        label: primaryAction.label,
                        onActivate: () => primaryAction.onActivate(selected.key),
                      }
                    : undefined
                }
                destructiveAction={
                  destructiveAction
                    ? {
                        label: destructiveAction.label,
                        onActivate: () => destructiveAction.onActivate(selected.key),
                      }
                    : undefined
                }
              />
            </>
          )}
        </dialog>
      </main>
    </div>
  );
}
