import { createAppUpdateService, type AppUpdateService } from './update-service.ts';

/**
 * Create the app-owned update coordinator. Registration itself starts once in
 * main.tsx, before runtime/workspace admission, so StrictMode cannot release a
 * live lease during its development-only mount cycle.
 */
export function registerServiceWorker(): AppUpdateService {
  if (import.meta.env.DEV) return createAppUpdateService({ container: null });
  return createAppUpdateService();
}
