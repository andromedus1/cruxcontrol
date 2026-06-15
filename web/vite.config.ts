import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The catalog Worker (src/data/sqlite/catalog.worker.ts) dynamically imports
  // the wa-sqlite WASM glue, which makes the worker bundle code-split. Vite's
  // default worker.format ('iife') can't code-split, so emit ES module workers.
  // Spawned as `new Worker(url, { type: 'module' })`, which this targets.
  worker: {
    format: 'es',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
