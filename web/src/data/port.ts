/**
 * Data-layer port for the local Kilter catalog.
 *
 * This is a pure contract with NO runtime dependencies. The real adapter
 * (wa-sqlite running OPFSCoopSyncVFS in a Web Worker) is implemented in
 * `epic-foundation-sqlite-readpath`; tests and early UI use `MockCatalogPort`.
 *
 * Ports & Adapters: the rest of the app depends on this interface, never on
 * wa-sqlite directly, so the catalog backend stays swappable and testable.
 */

/** A value SQLite can return or accept as a bound parameter. */
export type SqlValue = string | number | null | Uint8Array;

/** A result row keyed by column name. */
export type Row = Record<string, SqlValue>;

export interface CatalogPort {
  /**
   * Run a read-only SQL query against the local catalog.
   * @param sql    A SQL statement (SELECT). Use `?` placeholders for params.
   * @param params Positional bind parameters for the `?` placeholders.
   * @returns The result rows.
   */
  query<T extends Row = Row>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;

  /** Resolves true once the catalog DB is loaded and queryable. */
  isReady(): Promise<boolean>;

  /** Release resources (e.g. terminate the backing Worker). */
  close(): Promise<void>;
}
