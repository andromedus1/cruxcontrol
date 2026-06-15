import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useInstallPrompt } from './use-install-prompt.ts';

/**
 * Build a synthetic `beforeinstallprompt` event. The real event is Chromium-only
 * and not constructible from the standard `Event` with a `prompt()` method, so
 * we attach the methods the hook relies on.
 */
function makeBeforeInstallPromptEvent(prompt: () => Promise<void>): Event {
  const event = new Event('beforeinstallprompt');
  Object.assign(event, {
    prompt,
    userChoice: Promise.resolve({ outcome: 'accepted' as const }),
  });
  return event;
}

describe('useInstallPrompt', () => {
  it('reports canInstall=false until beforeinstallprompt fires', () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);

    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent(vi.fn().mockResolvedValue(undefined)));
    });

    expect(result.current.canInstall).toBe(true);
  });

  it('promptInstall() invokes the deferred event prompt() and consumes it', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent(prompt));
    });
    expect(result.current.canInstall).toBe(true);

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    // The deferred event is single-use, so canInstall flips back to false.
    expect(result.current.canInstall).toBe(false);
  });

  it('promptInstall() is a no-op when nothing has been deferred', async () => {
    const { result } = renderHook(() => useInstallPrompt());

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(result.current.canInstall).toBe(false);
  });
});
