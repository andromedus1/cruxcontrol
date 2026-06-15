import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The `beforeinstallprompt` event. Not in the standard lib DOM types (it's a
 * Chromium-only event), so we declare the shape we rely on.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

export interface InstallPrompt {
  /**
   * True when the browser fired `beforeinstallprompt` and an install can be
   * triggered programmatically. False on browsers that never fire the event
   * (iOS Safari, desktop Safari) — the UI should fall back to manual
   * "Add to Home Screen" instructions in that case.
   */
  canInstall: boolean;
  /**
   * Trigger the native install prompt. No-op if `canInstall` is false. After
   * the user responds, the deferred event is consumed (it can only be used
   * once), so `canInstall` returns to false.
   */
  promptInstall: () => Promise<void>;
}

/**
 * Capture the `beforeinstallprompt` event so the app can offer an install
 * affordance on demand. Chromium browsers fire this event and let us defer it;
 * browsers that don't fire it leave `canInstall` false (manual-instructions
 * fallback is the UI's responsibility).
 */
export function useInstallPrompt(): InstallPrompt {
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      // Prevent the browser's default mini-infobar so we control the timing.
      event.preventDefault();
      deferredRef.current = event as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const onAppInstalled = () => {
      // Once installed, the deferred event is stale — drop it.
      deferredRef.current = null;
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const deferred = deferredRef.current;
    if (!deferred) return;
    await deferred.prompt();
    // The prompt can only be shown once; consume it.
    deferredRef.current = null;
    setCanInstall(false);
  }, []);

  return { canInstall, promptInstall };
}
