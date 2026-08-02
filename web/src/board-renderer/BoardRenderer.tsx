import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { apiLevel3ColorHex } from '../domain/boards/colors';
import type { BoardDefinition, ClimbRole } from '../domain/boards/definition';
import type { BoardPlacementId } from '../domain/boards/types';
import { createBoardTransform, nearestPlacement, placementInDirection } from './geometry';
import { chooseHoldArtwork, HoldArtwork } from './hold-artwork';
import { createAssignmentIndex } from './scene';
import type { BoardDirection, BoardHoldAppearance, BoardHoldAssignment } from './types';
import './BoardRenderer.css';

export interface BoardRendererProps {
  readonly definition: BoardDefinition;
  readonly assignments?: readonly BoardHoldAssignment[];
  readonly interactionMode?: 'view' | 'select';
  readonly scale?: number;
  readonly labelledBy?: string;
  readonly onPlacementActivate?: (placementId: BoardPlacementId) => void;
}

const roleLabels: Readonly<Record<ClimbRole, string>> = {
  start: 'Start',
  middle: 'Middle',
  finish: 'Finish',
  'foot-only': 'Foot-only',
};

function appearanceLabel(appearance: BoardHoldAppearance | undefined): string {
  if (!appearance) return 'Unselected';
  return appearance.kind === 'role'
    ? roleLabels[appearance.role]
    : `Custom ${apiLevel3ColorHex(appearance.color).toUpperCase()}`;
}

function AssignmentMarker({ appearance }: { readonly appearance: BoardHoldAppearance }) {
  if (appearance.kind === 'custom') return <circle className="board-hold__custom-marker" r=".48" />;
  switch (appearance.role) {
    case 'start':
      return <path className="board-hold__marker" d="M0-.6 .55.45-.55.45Z" />;
    case 'middle':
      return <circle className="board-hold__marker" r=".45" />;
    case 'finish':
      return <rect className="board-hold__marker" x="-.42" y="-.42" width=".84" height=".84" />;
    case 'foot-only':
      return <path className="board-hold__marker" d="M0-.58.58 0 0 .58-.58 0Z" />;
  }
}

export function BoardRenderer({
  definition,
  assignments = [],
  interactionMode = 'view',
  scale = 1,
  labelledBy,
  onPlacementActivate,
}: BoardRendererProps) {
  if (!Number.isFinite(scale) || scale < 1 || scale > 3) {
    throw new RangeError('Board renderer scale must be a finite number from 1 to 3');
  }
  const transform = useMemo(() => createBoardTransform(definition), [definition]);
  const assignmentIndex = useMemo(
    () => createAssignmentIndex(definition, assignments),
    [definition, assignments],
  );
  const [focused, setFocused] = useState(definition.placements[0]?.id ?? null);
  const svgRef = useRef<SVGSVGElement>(null);
  const holdRefs = useRef(new Map<BoardPlacementId, SVGGElement>());
  const title = `${definition.manufacturer} ${definition.model}, ${definition.layout} ${definition.size}`;

  const activate = (placementId: BoardPlacementId | null) => {
    if (placementId) onPlacementActivate?.(placementId);
  };

  const moveFocus = (placementId: BoardPlacementId) => {
    setFocused(placementId);
    holdRefs.current.get(placementId)?.focus();
  };

  const onHoldKeyDown = (event: KeyboardEvent<SVGGElement>, placementId: BoardPlacementId) => {
    const directions: Partial<Record<string, BoardDirection>> = {
      ArrowUp: 'up',
      ArrowRight: 'right',
      ArrowDown: 'down',
      ArrowLeft: 'left',
    };
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault();
      moveFocus(placementInDirection(definition, placementId, direction));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const target = event.key === 'Home' ? definition.placements[0] : definition.placements.at(-1);
      if (target) moveFocus(target.id);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate(placementId);
    }
  };

  const onPointerActivate = (event: MouseEvent<SVGSVGElement>) => {
    if (interactionMode !== 'select') return;
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    const placementId = nearestPlacement(definition, transform.toBoard(local));
    if (placementId) {
      setFocused(placementId);
      activate(placementId);
    }
  };

  return (
    <div className="board-renderer__viewport" data-scale={scale}>
      <div
        className="board-renderer__surface"
        style={{
          width: `${scale * 100}%`,
          aspectRatio: `${transform.viewBox.width} / ${transform.viewBox.height}`,
        }}
      >
        <svg
          ref={svgRef}
          className="board-renderer"
          viewBox={`${transform.viewBox.x} ${transform.viewBox.y} ${transform.viewBox.width} ${transform.viewBox.height}`}
          preserveAspectRatio="xMidYMid meet"
          role={interactionMode === 'select' ? 'grid' : 'img'}
          aria-label={labelledBy ? undefined : title}
          aria-labelledby={labelledBy}
          onClick={onPointerActivate}
        >
          <rect
            className="board-renderer__panel"
            x=".6"
            y=".6"
            width={transform.viewBox.width - 1.2}
            height={transform.viewBox.height - 1.2}
            rx="1.4"
          />
          {definition.placements.map((placement, index) => {
            const center = transform.toSvg(placement.position);
            const appearance = assignmentIndex.get(placement.id);
            const color = appearance
              ? appearance.kind === 'role'
                ? definition.rolePresets[appearance.role].screenColor
                : apiLevel3ColorHex(appearance.color)
              : undefined;
            const interactive = interactionMode === 'select';
            return (
              <g
                key={placement.id}
                ref={(element) => {
                  if (element) holdRefs.current.set(placement.id, element);
                  else holdRefs.current.delete(placement.id);
                }}
                className="board-hold"
                data-placement-id={placement.id}
                data-assignment={appearance?.kind ?? 'none'}
                transform={`translate(${center.x} ${center.y})`}
                style={color ? { color } : undefined}
                role={interactive ? 'gridcell' : undefined}
                aria-roledescription={interactive ? 'button' : undefined}
                aria-label={
                  interactive ? `Hold ${index + 1}, ${appearanceLabel(appearance)}` : undefined
                }
                tabIndex={interactive ? (focused === placement.id ? 0 : -1) : undefined}
                onFocus={interactive ? () => setFocused(placement.id) : undefined}
                onKeyDown={interactive ? (event) => onHoldKeyDown(event, placement.id) : undefined}
              >
                {appearance && <circle className="board-hold__selection-ring" r="2.55" />}
                <HoldArtwork choice={chooseHoldArtwork(placement)} selected={Boolean(appearance)} />
                {appearance && <AssignmentMarker appearance={appearance} />}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
