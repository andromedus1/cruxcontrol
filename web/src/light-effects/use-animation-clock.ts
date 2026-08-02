import { useEffect, useState } from 'react';

export function useAnimationClock({
  active,
  fps = 10,
}: {
  readonly active: boolean;
  readonly fps?: number;
}): number {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!active) return;
    const cappedFps = Math.max(1, Math.min(60, fps));
    const startedAt = performance.now();
    setElapsedMs(0);
    const timer = window.setInterval(
      () => setElapsedMs(performance.now() - startedAt),
      Math.ceil(1000 / cappedFps),
    );
    return () => window.clearInterval(timer);
  }, [active, fps]);

  return elapsedMs;
}
