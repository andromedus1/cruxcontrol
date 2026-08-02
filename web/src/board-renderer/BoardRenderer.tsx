import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, TouchEvent } from 'react';
import { apiLevel3ColorHex } from '../domain/boards/colors';
import type { BoardDefinition, ClimbRole } from '../domain/boards/definition';
import type { BoardPlacementId } from '../domain/boards/types';
import type { LightScene } from '../domain/boards/light-scene';
import { createBoardTransform, nearestPlacement, placementInDirection } from './geometry';
import { resolveBoardRasterArtwork } from './fullride-private-artwork';
import { chooseHoldArtwork, HoldArtwork } from './hold-artwork';
import { createAssignmentIndex } from './scene';
import type { BoardDirection, BoardHoldAppearance, BoardHoldAssignment } from './types';
import './BoardRenderer.css';

export interface BoardRendererProps {
  readonly definition: BoardDefinition;
  readonly assignments?: readonly BoardHoldAssignment[];
  readonly lightScene?: LightScene;
  readonly interactionMode?: 'view' | 'select';
  readonly scale?: number;
  readonly onScaleChange?: (scale: number) => void;
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
  lightScene,
  interactionMode = 'view',
  scale = 1,
  onScaleChange,
  labelledBy,
  onPlacementActivate,
}: BoardRendererProps) {
  if (!Number.isFinite(scale) || scale < 1 || scale > 3) {
    throw new RangeError('Board renderer scale must be a finite number from 1 to 3');
  }
  const transform = useMemo(() => createBoardTransform(definition), [definition]);
  const rasterArtwork = useMemo(() => resolveBoardRasterArtwork(definition), [definition]);
  const [rasterLoad, setRasterLoad] = useState<{
    readonly href: string | null;
    readonly status: 'pending' | 'ready' | 'failed';
  }>({ href: null, status: 'pending' });
  const rasterStatus =
    rasterArtwork && rasterLoad.href === rasterArtwork.href ? rasterLoad.status : 'pending';
  const rasterReady = rasterStatus === 'ready';
  const assignmentIndex = useMemo(
    () => createAssignmentIndex(definition, assignments),
    [definition, assignments],
  );
  const lightIndex = useMemo(
    () => new Map(lightScene?.map(({ placementId, color }) => [placementId, color]) ?? []),
    [lightScene],
  );
  const [focused, setFocused] = useState(definition.placements[0]?.id ?? null);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<
    | { mode: 'pan'; x: number; y: number; moved: boolean }
    | { mode: 'pinch'; distance: number; scale: number; moved: boolean }
    | null
  >(null);
  const suppressClickRef = useRef(false);
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
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
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

  const touchDistance = (event: TouchEvent<HTMLDivElement>) => {
    const first = event.touches[0]!;
    const second = event.touches[1]!;
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  };

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!onScaleChange) return;
    if (event.touches.length >= 2) {
      gestureRef.current = { mode: 'pinch', distance: touchDistance(event), scale, moved: false };
    } else if (event.touches.length === 1) {
      const touch = event.touches[0]!;
      gestureRef.current = { mode: 'pan', x: touch.clientX, y: touch.clientY, moved: false };
    }
  };

  const onTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const gesture = gestureRef.current;
    if (!onScaleChange || !viewport || !gesture) return;
    event.preventDefault();
    if (event.touches.length >= 2) {
      const distance = touchDistance(event);
      const base =
        gesture.mode === 'pinch'
          ? gesture
          : { mode: 'pinch' as const, distance, scale, moved: false };
      const nextScale = Math.min(3, Math.max(1, base.scale * (distance / base.distance)));
      const bounds = viewport.getBoundingClientRect();
      const midpointX = (event.touches[0]!.clientX + event.touches[1]!.clientX) / 2 - bounds.left;
      const midpointY = (event.touches[0]!.clientY + event.touches[1]!.clientY) / 2 - bounds.top;
      const contentX = (viewport.scrollLeft + midpointX) / scale;
      const contentY = (viewport.scrollTop + midpointY) / scale;
      onScaleChange(nextScale);
      viewport.scrollLeft = contentX * nextScale - midpointX;
      viewport.scrollTop = contentY * nextScale - midpointY;
      gestureRef.current = { ...base, moved: base.moved || Math.abs(distance - base.distance) > 3 };
    } else if (event.touches.length === 1 && gesture.mode === 'pan') {
      const touch = event.touches[0]!;
      const deltaX = touch.clientX - gesture.x;
      const deltaY = touch.clientY - gesture.y;
      viewport.scrollLeft -= deltaX;
      viewport.scrollTop -= deltaY;
      gestureRef.current = {
        mode: 'pan',
        x: touch.clientX,
        y: touch.clientY,
        moved: gesture.moved || Math.hypot(deltaX, deltaY) > 3,
      };
    }
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (!onScaleChange) return;
    const moved = gestureRef.current?.moved ?? false;
    if (event.touches.length === 1) {
      const touch = event.touches[0]!;
      gestureRef.current = { mode: 'pan', x: touch.clientX, y: touch.clientY, moved };
      return;
    }
    gestureRef.current = null;
    suppressClickRef.current = moved;
  };

  return (
    <div
      ref={viewportRef}
      className={`board-renderer__viewport${onScaleChange ? ' board-renderer__viewport--gestures' : ''}`}
      data-scale={scale}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
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
          {rasterArtwork && (
            <image
              className="board-renderer__raster-artwork"
              data-board-raster-artwork
              href={rasterArtwork.href}
              x={rasterArtwork.imageBox.x}
              y={rasterArtwork.imageBox.y}
              width={rasterArtwork.imageBox.width}
              height={rasterArtwork.imageBox.height}
              preserveAspectRatio="none"
              aria-hidden="true"
              onLoad={() => setRasterLoad({ href: rasterArtwork.href, status: 'ready' })}
              onError={() => setRasterLoad({ href: rasterArtwork.href, status: 'failed' })}
            />
          )}
          {definition.placements.map((placement, index) => {
            const center = transform.toSvg(placement.position);
            const appearance = assignmentIndex.get(placement.id);
            const animatedColor = lightIndex.get(placement.id);
            const color =
              animatedColor !== undefined
                ? apiLevel3ColorHex(animatedColor)
                : appearance
                  ? appearance.kind === 'role'
                    ? definition.rolePresets[appearance.role].screenColor
                    : apiLevel3ColorHex(appearance.color)
                  : undefined;
            const interactive = interactionMode === 'select';
            const illuminated = Boolean(appearance) || animatedColor !== undefined;
            return (
              <g
                key={placement.id}
                transform={`translate(${center.x} ${center.y})`}
                role={interactive ? 'row' : undefined}
              >
                <g role={interactive ? 'gridcell' : undefined}>
                  <g
                    ref={(element) => {
                      if (element) holdRefs.current.set(placement.id, element);
                      else holdRefs.current.delete(placement.id);
                    }}
                    className="board-hold"
                    data-placement-id={placement.id}
                    data-assignment={appearance?.kind ?? 'none'}
                    style={color ? { color } : undefined}
                    role={interactive ? 'button' : undefined}
                    aria-label={
                      interactive ? `Hold ${index + 1}, ${appearanceLabel(appearance)}` : undefined
                    }
                    tabIndex={interactive ? (focused === placement.id ? 0 : -1) : undefined}
                    onFocus={interactive ? () => setFocused(placement.id) : undefined}
                    onKeyDown={
                      interactive ? (event) => onHoldKeyDown(event, placement.id) : undefined
                    }
                  >
                    <circle className="board-hold__hit-target" r="2.35" />
                    {illuminated && <circle className="board-hold__selection-halo" r="2.15" />}
                    {illuminated && <circle className="board-hold__selection-ring" r="2.55" />}
                    <circle className="board-hold__focus-ring" r="2.7" />
                    {!rasterReady && (
                      <HoldArtwork
                        choice={chooseHoldArtwork(placement)}
                        selected={Boolean(appearance)}
                      />
                    )}
                    {appearance && <AssignmentMarker appearance={appearance} />}
                  </g>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
