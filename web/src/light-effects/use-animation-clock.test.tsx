import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAnimationClock } from './use-animation-clock';

afterEach(() => vi.useRealTimers());

describe('useAnimationClock', () => {
  it('ticks only while active at the requested capped cadence', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ active, fps }) => useAnimationClock({ active, fps }),
      { initialProps: { active: false, fps: 10 } },
    );
    expect(result.current).toBe(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current).toBe(0);
    rerender({ active: true, fps: 10 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(99);
    });
    expect(result.current).toBe(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current).toBeGreaterThanOrEqual(100);
    rerender({ active: false, fps: 10 });
    const stopped = result.current;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current).toBe(stopped);
  });
});
