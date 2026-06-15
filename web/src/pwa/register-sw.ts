import { registerSW } from 'virtual:pwa-register';

/**
 * Register the Workbox-generated service worker.
 *
 * The plugin is configured with `registerType: 'autoUpdate'`, so a new SW
 * activates and the app picks up the new version on next load — no reload
 * prompt, no update UI. `immediate: true` registers as soon as this runs
 * (app entry) rather than waiting for the `load` event.
 *
 * In dev the SW is disabled (`devOptions.enabled: false`), so the virtual
 * module's `registerSW` is a no-op there.
 */
export function registerServiceWorker(): void {
  registerSW({ immediate: true });
}
