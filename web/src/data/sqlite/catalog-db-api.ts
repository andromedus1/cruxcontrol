/**
 * The RPC surface the catalog Worker exposes over Comlink.
 *
 * Defined separately from the Worker module so the main-thread adapter can
 * import the *type* without pulling Worker/wa-sqlite code into the main bundle.
 * Mirrors {@link ../port.ts}'s `CatalogPort`, but every method is async because
 * Comlink proxies all calls across the Worker boundary.
 */

import type { Row, SqlValue } from '../port.ts';

/** Comlink-exposed catalog API, backed by {@link ./catalog-db.ts} in a Worker. */
export interface CatalogDbApi {
  /** Run a read-only query; see `CatalogPort.query`. */
  query<T extends Row = Row>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;

  /** Resolves true while the catalog DB is open and queryable. */
  isReady(): Promise<boolean>;

  /** Close the underlying connection. */
  close(): Promise<void>;
}
