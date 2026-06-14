import type { CatalogPort, Row, SqlValue } from './port.ts';

/**
 * In-memory {@link CatalogPort} for tests and early UI development — no Worker,
 * no wa-sqlite, no OPFS. Returns canned rows keyed by the exact SQL string.
 *
 * This is intentionally dumb: it does not parse SQL. Seed it with the queries
 * a test expects and the rows they should return.
 */
export class MockCatalogPort implements CatalogPort {
  private readonly responses: Map<string, Row[]>;
  private ready: boolean;

  constructor(responses?: Map<string, Row[]>, ready = true) {
    this.responses = responses ?? new Map();
    this.ready = ready;
  }

  /** Register the rows to return for an exact SQL string. */
  seed(sql: string, rows: Row[]): void {
    this.responses.set(sql, rows);
  }

  query<T extends Row = Row>(sql: string, _params?: readonly SqlValue[]): Promise<T[]> {
    return Promise.resolve((this.responses.get(sql) ?? []) as T[]);
  }

  isReady(): Promise<boolean> {
    return Promise.resolve(this.ready);
  }

  close(): Promise<void> {
    this.ready = false;
    return Promise.resolve();
  }
}
