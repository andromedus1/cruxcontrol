import { useCallback, useEffect, useRef, useState } from 'react';
import {
  endAnnouncement,
  type ClimbNavigation,
  type ClimbNavigationDirection,
} from './navigation';
import { useHorizontalSwipe } from './use-horizontal-swipe';

const NUDGE_MS = 260;
const ANNOUNCEMENT_MS = 2_500;

/** Keys inside these keep their own arrow-key behavior. */
const KEY_IGNORED_TARGETS = [
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="slider"]',
  '[data-no-swipe]',
].join(', ');

/** Elements that stay mounted across moves and may keep focus after a key move. */
export const NAVIGATION_CONTROL_ATTRIBUTE = 'data-climb-nav';

export interface ClimbNavigationInput<T extends HTMLElement> {
  /** Attach to the swipe zone; it should also carry `tabIndex={-1}` and `onKeyDown`. */
  readonly swipeRef: React.RefCallback<T>;
  readonly onKeyDown: (event: React.KeyboardEvent<T>) => void;
  readonly previous: () => void;
  readonly next: () => void;
  /** The end the user just ran into, while its nudge plays (never under reduced motion). */
  readonly nudge: ClimbNavigationDirection | null;
  /** "First climb" / "Last climb" after an attempt to move past an end. */
  readonly announcement: string;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

function isThenable(value: unknown): value is Promise<boolean> {
  return typeof (value as { then?: unknown } | null | undefined)?.then === 'function';
}

/**
 * Shared swipe, arrow-key and end-feedback behavior for a viewed climb. Every
 * input goes through the surface's `ClimbNavigation`, so buttons, keys and
 * gestures share one path.
 */
export function useClimbNavigationInput<T extends HTMLElement>(
  navigation: ClimbNavigation | null | undefined,
  /** Identity of the climb shown; arriving at another climb clears the end message. */
  currentKey: string | null,
): ClimbNavigationInput<T> {
  const latest = useRef(navigation);
  latest.current = navigation;
  const mounted = useRef(true);
  const nudgeTimer = useRef<number | null>(null);
  const announcementTimer = useRef<number | null>(null);
  const [nudge, setNudge] = useState<ClimbNavigationDirection | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
      if (announcementTimer.current !== null) window.clearTimeout(announcementTimer.current);
    };
  }, []);

  // Arriving at another climb replaces the end message.
  useEffect(() => {
    setAnnouncement('');
  }, [currentKey]);

  const signalEnd = useCallback((direction: ClimbNavigationDirection) => {
    if (!mounted.current) return;
    setAnnouncement(endAnnouncement(direction));
    if (announcementTimer.current !== null) window.clearTimeout(announcementTimer.current);
    announcementTimer.current = window.setTimeout(() => {
      announcementTimer.current = null;
      if (mounted.current) setAnnouncement('');
    }, ANNOUNCEMENT_MS);
    if (prefersReducedMotion() || nudgeTimer.current !== null) return;
    setNudge(direction);
    nudgeTimer.current = window.setTimeout(() => {
      nudgeTimer.current = null;
      if (mounted.current) setNudge(null);
    }, NUDGE_MS);
  }, []);

  const go = useCallback((direction: ClimbNavigationDirection) => {
    const current = latest.current;
    if (!current) return;
    const allowed = direction === 'next' ? current.canNext : current.canPrevious;
    if (!allowed) {
      signalEnd(direction);
      return;
    }
    const result = direction === 'next' ? current.onNext() : current.onPrevious();
    if (isThenable(result)) {
      result.then(
        (moved) => {
          if (!moved) signalEnd(direction);
        },
        () => undefined,
      );
    }
  }, [signalEnd]);

  const swipeRef = useHorizontalSwipe<T>({ enabled: Boolean(navigation), onSwipe: go });
  const previous = useCallback(() => go('previous'), [go]);
  const next = useCallback(() => go('next'), [go]);

  const onKeyDown = useCallback((event: React.KeyboardEvent<T>) => {
    if (!latest.current || event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const target = event.target;
    if (target instanceof Element && target.closest(KEY_IGNORED_TARGETS)) return;
    event.preventDefault();
    // Content inside the zone remounts for the new climb; keep focus in the zone.
    const container = event.currentTarget;
    const active = document.activeElement;
    if (!(active instanceof Element && active.closest(`[${NAVIGATION_CONTROL_ATTRIBUTE}]`))) {
      container.focus({ preventScroll: true });
    }
    go(event.key === 'ArrowLeft' ? 'previous' : 'next');
  }, [go]);

  return { swipeRef, onKeyDown, previous, next, nudge, announcement };
}
