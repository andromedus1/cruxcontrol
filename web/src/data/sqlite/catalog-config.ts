/**
 * Shared configuration for the SQLite catalog read path.
 *
 * The filename is the single seam between this feature (which opens the DB
 * READONLY) and the future catalog-bootstrap feature (which writes it). Both
 * must agree on the OPFS path, so it lives here as the single source of truth.
 */

/**
 * Name of the catalog database file inside OPFS.
 *
 * The catalog-bootstrap feature writes the synced Kilter catalog to this path;
 * this feature opens it READONLY. Keep it stable — changing it orphans any
 * already-downloaded catalog.
 */
export const CATALOG_DB_FILENAME = 'catalog.sqlite3';
