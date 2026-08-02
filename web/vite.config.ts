import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // autoUpdate: a new service worker activates and the app picks up the new
      // version on next load, with no reload prompt (design decision — silent
      // updates, no update UI until the design system lands at climb-browser).
      registerType: 'autoUpdate',
      // generateSW (the default mode): Workbox generates the service worker and
      // precaches the built app shell. We have no custom SW logic yet.
      manifest: {
        name: 'CruxControl',
        short_name: 'CruxControl',
        description: 'Control and train on a home Kilter Board.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#1e293b',
        background_color: '#1e293b',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Explicit allowlist of app-shell assets to precache. The wa-sqlite
        // .wasm worker chunk is a small code asset and is fine to precache.
        globPatterns: ['**/*.{js,css,html,svg,woff2,wasm,png,ico}'],
        // The multi-MB catalog DB lives in OPFS (catalog-bootstrap), NEVER in
        // the SW precache. There is no .db in the build yet, but this guard is
        // in place for when catalog-bootstrap adds it.
        globIgnores: ['**/*.db', '**/*.db.gz'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      // Keep dev simple — no service worker during `vite dev`.
      devOptions: { enabled: false },
    }),
  ],
  // The catalog Worker (src/data/sqlite/catalog.worker.ts) dynamically imports
  // the wa-sqlite WASM glue, which makes the worker bundle code-split. Vite's
  // default worker.format ('iife') can't code-split, so emit ES module workers.
  // Spawned as `new Worker(url, { type: 'module' })`, which this targets.
  worker: {
    format: 'es',
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
