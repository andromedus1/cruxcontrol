import { useEffect, useState, useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeToReducedMotion(listener: () => void): () => void {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

function reducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function useAnimationClock({
  active,
  fps = 10,
}: {
  readonly active: boolean;
  readonly fps?: number;
}): number {
  const [elapsedMs, setElapsedMs] = useState(0);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    reducedMotionSnapshot,
    () => false,
  );

  useEffect(() => {
    if (!active || prefersReducedMotion) return;
    const cappedFps = Math.max(1, Math.min(60, fps));
    const startedAt = performance.now();
    setElapsedMs(0);
    const timer = window.setInterval(
      () => setElapsedMs(performance.now() - startedAt),
      Math.ceil(1000 / cappedFps),
    );
    return () => window.clearInterval(timer);
  }, [active, fps, prefersReducedMotion]);

  return prefersReducedMotion ? 0 : elapsedMs;
}
