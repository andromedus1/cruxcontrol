import { useCallback, useRef } from 'react';
import type { ClimbNavigationDirection } from './navigation';

export interface SwipeOptions {
  readonly enabled: boolean;
  readonly onSwipe: (direction: ClimbNavigationDirection) => void;
}

/** Horizontal travel that always counts as a swipe. */
export const SWIPE_MIN_DISTANCE_PX = 56;
/** A shorter, fast flick still counts once it travels this far… */
export const SWIPE_FLICK_MIN_DISTANCE_PX = 24;
/** …at this average speed. */
export const SWIPE_FLICK_MIN_VELOCITY_PX_PER_MS = 0.4;
/** Horizontal travel must dominate vertical travel by this ratio. */
export const SWIPE_DOMINANCE_RATIO = 1.5;
/** Vertical travel that hands the gesture to scrolling before any decision. */
const VERTICAL_CANCEL_PX = 12;
const CLICK_SUPPRESSION_MS = 400;

/** Gestures starting on these keep their own horizontal drag behavior. */
const IGNORED_TARGETS = [
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="slider"]',
  '[data-no-swipe]',
].join(', ');

interface Track {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly startedAt: number;
}

export function swipeDirection(dx: number, dy: number, elapsedMs: number): ClimbNavigationDirection | null {
  const distance = Math.abs(dx);
  if (distance === 0 || distance < SWIPE_DOMINANCE_RATIO * Math.abs(dy)) return null;
  const velocity = distance / Math.max(elapsedMs, 1);
  const swiped =
    distance >= SWIPE_MIN_DISTANCE_PX ||
    (distance >= SWIPE_FLICK_MIN_DISTANCE_PX && velocity >= SWIPE_FLICK_MIN_VELOCITY_PX_PER_MS);
  if (!swiped) return null;
  // Content follows the finger: dragging left reveals the next climb.
  return dx < 0 ? 'next' : 'previous';
}

/**
 * Recognizes horizontal touch/pen swipes on an element without interfering with
 * vertical scrolling or taps. Pair the element with `touch-action: pan-y` so the
 * browser keeps vertical panning and delivers horizontal drags as pointer events.
 */
export function useHorizontalSwipe<T extends HTMLElement>(options: SwipeOptions): React.RefCallback<T> {
  const latest = useRef(options);
  latest.current = options;
  // React calls the ref with null on unmount, which removes the listeners.
  const cleanup = useRef<(() => void) | null>(null);

  return useCallback((element: T | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!element) return;
    let track: Track | null = null;
    let suppressClicksUntil = Number.NEGATIVE_INFINITY;

    const onPointerDown = (event: PointerEvent) => {
      track = null;
      if (!latest.current.enabled || !event.isPrimary) return;
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
      const target = event.target;
      if (target instanceof Element && target.closest(IGNORED_TARGETS)) return;
      track = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startedAt: performance.now() };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!track || event.pointerId !== track.pointerId) return;
      const dx = event.clientX - track.x;
      const dy = event.clientY - track.y;
      // A clearly vertical drag is scrolling; stop watching it.
      if (Math.abs(dy) > VERTICAL_CANCEL_PX && Math.abs(dy) > Math.abs(dx)) track = null;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!track || event.pointerId !== track.pointerId) return;
      const started = track;
      track = null;
      if (!latest.current.enabled) return;
      const direction = swipeDirection(
        event.clientX - started.x,
        event.clientY - started.y,
        performance.now() - started.startedAt,
      );
      if (!direction) return;
      suppressClicksUntil = performance.now() + CLICK_SUPPRESSION_MS;
      latest.current.onSwipe(direction);
    };
    const onPointerCancel = (event: PointerEvent) => {
      if (track && event.pointerId === track.pointerId) track = null;
    };
    // A swipe that ends over a button must not also activate it.
    const onClickCapture = (event: MouseEvent) => {
      if (performance.now() >= suppressClicksUntil) return;
      suppressClicksUntil = Number.NEGATIVE_INFINITY;
      event.preventDefault();
      event.stopPropagation();
    };

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', onPointerCancel);
    element.addEventListener('click', onClickCapture, true);
    cleanup.current = () => {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerCancel);
      element.removeEventListener('click', onClickCapture, true);
    };
  }, []);
}
