/**
 * Main-thread {@link CatalogPort} backed by wa-sqlite running in a Web Worker.
 *
 * Spawns the catalog Worker, Comlink-wraps it, and delegates `query`/`isReady`/
 * `close`. The rest of the app depends only on `CatalogPort`, never on this
 * class or on wa-sqlite — this is the real adapter behind that port, alongside
 * the test/early-UI `MockCatalogPort`.
 */

import { wrap, type Remote } from 'comlink';
import type { CatalogPort, Row, SqlValue } from '../port.ts';
import type { CatalogDbApi } from './catalog-db-api.ts';
import { isOpfsSyncAccessSupported } from './opfs-support.ts';
import { CatalogQueryError } from './errors.ts';

/**
 * Thrown by {@link SqliteCatalogPort.create} when the environment cannot run the
 * OPFS sync-access-handle path (e.g. older Safari/Firefox, or a non-browser
 * runtime). Fail-fast seam: the app shell renders a clear "unsupported browser"
 * state instead of crashing inside the Worker. The deferred IDB fallback will
 * later branch here instead of throwing.
 */
export class UnsupportedEnvironmentError extends Error {
  constructor(
    message = 'This browser does not support OPFS synchronous access handles, ' +
      'which the local catalog requires. Use a recent Chromium-based browser.',
  ) {
    super(message);
    this.name = 'UnsupportedEnvironmentError';
    Object.setPrototypeOf(this, UnsupportedEnvironmentError.prototype);
  }
}

/** Spawns the catalog Worker; injectable so tests can supply a fake endpoint. */
export type WorkerFactory = () => Worker;

/** Default Worker factory — the Vite-bundled module Worker. */
function defaultWorkerFactory(): Worker {
  return new Worker(new URL('./catalog.worker.ts', import.meta.url), {
    type: 'module',
  });
}

export class SqliteCatalogPort implements CatalogPort {
  private readonly worker: Worker;
  private readonly remote: Remote<CatalogDbApi>;

  private constructor(worker: Worker, remote: Remote<CatalogDbApi>) {
    this.worker = worker;
    this.remote = remote;
  }

  /**
   * Create a Worker-backed catalog port.
   *
   * @throws UnsupportedEnvironmentError if OPFS sync access handles are
   *         unavailable — checked before any Worker is spawned.
   * @param workerFactory Override the Worker source (tests inject a fake).
   */
  static create(workerFactory: WorkerFactory = defaultWorkerFactory): SqliteCatalogPort {
    if (!isOpfsSyncAccessSupported()) {
      throw new UnsupportedEnvironmentError();
    }
    const worker = workerFactory();
    const remote = wrap<CatalogDbApi>(worker);
    return new SqliteCatalogPort(worker, remote);
  }

  async query<T extends Row = Row>(sql: string, params?: readonly SqlValue[]): Promise<T[]> {
    try {
      // Comlink requires structured-cloneable args; copy the readonly param
      // tuple into a plain array. Comlink's Remote<> erases the method's generic
      // type parameter, so cast the rows back to T[] at the boundary.
      const rows = await this.remote.query(sql, params ? [...params] : undefined);
      return rows as T[];
    } catch (cause) {
      // Custom error subclasses degrade to plain Error across the Comlink
      // boundary — re-wrap so callers still get a CatalogQueryError with the SQL.
      if (cause instanceof CatalogQueryError) {
        throw cause;
      }
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new CatalogQueryError(message, sql, { cause });
    }
  }

  isReady(): Promise<boolean> {
    return this.remote.isReady();
  }

  /** Close the connection and terminate the backing Worker. */
  async close(): Promise<void> {
    try {
      await this.remote.close();
    } finally {
      this.worker.terminate();
    }
  }
}
