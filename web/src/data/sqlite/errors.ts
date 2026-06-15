/**
 * Errors raised by the wa-sqlite catalog read path.
 *
 * Kept dependency-free so they can be thrown from the Worker-agnostic engine
 * ({@link ../catalog-db.ts}) and re-thrown at the main-thread adapter after a
 * round trip across the Comlink boundary.
 */

/**
 * Thrown when a SQL statement fails to compile or execute against the catalog.
 *
 * Carries the offending {@link sql} so a failure is debuggable without having to
 * correlate it back to the call site, and chains the underlying cause.
 */
export class CatalogQueryError extends Error {
  /** The SQL statement that failed. */
  readonly sql: string;

  constructor(message: string, sql: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CatalogQueryError';
    this.sql = sql;
    // Restore the prototype chain across the TS `extends Error` downlevel gap.
    Object.setPrototypeOf(this, CatalogQueryError.prototype);
  }
}
