/**
 * Web Worker host for the catalog SQLite engine.
 *
 * Runs only in a browser dedicated Worker. Builds the OPFS sync-access-handle
 * VFS (which requires a Worker — its synchronous handles are not callable on the
 * main thread), opens {@link CatalogDb} READONLY at the shared catalog filename,
 * and exposes a {@link CatalogDbApi} over Comlink.
 *
 * This module is intentionally untested in CI: jsdom/Node have no OPFS and no
 * real Worker. Its logic is deliberately thin (construct VFS → open → expose);
 * the SQL behaviour it delegates to is covered by catalog-db.test.ts, and the
 * OPFS/Worker wiring is verified manually and by a later e2e pass.
 */

import { expose } from 'comlink';
import { AccessHandlePoolVFS } from 'wa-sqlite/src/examples/AccessHandlePoolVFS.js';
import { CatalogDb } from './catalog-db.ts';
import { CATALOG_DB_FILENAME } from './catalog-config.ts';
import type { CatalogDbApi } from './catalog-db-api.ts';

/** OPFS directory the VFS owns; the catalog DB lives inside it. */
const OPFS_DIRECTORY = 'cruxcontrol-catalog';

/**
 * Open the catalog over OPFS, READONLY.
 *
 * If the catalog has not been bootstrapped yet the file is missing, so the open
 * fails — we resolve to a `null` connection rather than throwing, so the API can
 * report `isReady() === false` and the UI can show a "catalog not loaded" state
 * until catalog-bootstrap runs. (Whether rows *exist* is bootstrap's concern.)
 */
async function openCatalog(): Promise<CatalogDb | null> {
  const vfs = new AccessHandlePoolVFS(OPFS_DIRECTORY);
  // AccessHandlePoolVFS provisions its OPFS handle pool asynchronously; await
  // readiness before opening. Its `name` is a fixed getter ('AccessHandlePool').
  await vfs.isReady;
  try {
    return await CatalogDb.open(CATALOG_DB_FILENAME, {
      vfs: vfs as unknown as SQLiteVFS,
      name: vfs.name,
    });
  } catch {
    return null;
  }
}

const catalogPromise = openCatalog();

const api: CatalogDbApi = {
  async query(sql, params) {
    const db = await catalogPromise;
    if (!db) {
      // Caller should gate on isReady(); surface a clear error if it didn't.
      throw new Error('catalog not loaded');
    }
    return db.query(sql, params);
  },

  async isReady() {
    const db = await catalogPromise;
    return db?.isReady() ?? false;
  },

  async close() {
    const db = await catalogPromise;
    await db?.close();
  },
};

expose(api);
