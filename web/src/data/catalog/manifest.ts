import { CatalogBootstrapError } from './errors.ts';

interface CatalogManifestBase {
  version: number;
  board: 'kilter-fullride-7x10';
  file: string;
  compression: 'gzip';
  sha256: string;
  bytesGzipped: number;
  bytesRaw: number;
  generatedOn: string;
  generatedFrom: string;
  filter: string;
}

/** Schema 2: the bundled older snapshot derived from the legacy Aurora Kilter data. */
export interface LegacyCatalogManifest extends CatalogManifestBase {
  schemaVersion: 2;
  source: 'legacy-aurora-kilter';
  sourceDataThrough: string | null;
}

export interface CatalogQualityScale {
  readonly min: number;
  readonly max: number;
}

export interface CatalogChangeSummary {
  readonly added: number;
  readonly removed: number;
  readonly restored: number;
}

/** Schema 3: a CruxControl artifact normalized from Boardsesh's community snapshot. */
export interface BoardseshCatalogManifest extends CatalogManifestBase {
  schemaVersion: 3;
  source: 'boardsesh-kilter';
  /** Boardsesh snapshot build instant (ISO-8601, UTC). */
  sourceBuiltAt: string;
  sourceWatermarks: Readonly<Record<string, string>>;
  layoutRevision: string;
  qualityScale: CatalogQualityScale;
  climbCount: number;
  /** Absent in manifests built before append-only reconciliation; null means not reported. */
  removedUpstreamCount: number | null;
  /** Absent in manifests built before append-only reconciliation; null means not reported. */
  changes: CatalogChangeSummary | null;
}

export type CatalogManifest = LegacyCatalogManifest | BoardseshCatalogManifest;

export interface CatalogDownloadProgress {
  receivedBytes: number;
  totalBytes: number;
}

export const CATALOG_MANIFEST_LIMIT = 16 * 1024;
export const CATALOG_COMPRESSED_LIMIT = 8 * 1024 * 1024;
export const CATALOG_RAW_LIMIT = 32 * 1024 * 1024;

const FILE_NAME = /^kilter-7x10\.v[1-9][0-9]*\.db\.gz$/;
const INSTANT = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?Z$/;
const LAYOUT_REVISION = /^kilter:[1-9][0-9]*:[1-9][0-9]*:[1-9][0-9]*:[a-f0-9]{6,64}$/;
const WATERMARK_KEY = /^[a-z0-9_]{1,64}$/;
const MAX_WATERMARKS = 32;
const MAX_QUALITY = 10;

function invalid(message: string, cause?: unknown): CatalogBootstrapError {
  return new CatalogBootstrapError('manifest', message, cause === undefined ? undefined : { cause });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = INSTANT.exec(value);
  return match !== null && validDate(match[1]);
}

function boundedText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !value.includes('\0');
}

function nonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function parseBase(value: Record<string, unknown>): CatalogManifestBase {
  const { version, board, file, compression, sha256, bytesGzipped, bytesRaw,
    generatedOn, generatedFrom, filter } = value;
  if (!Number.isSafeInteger(version) || (version as number) <= 0
    || board !== 'kilter-fullride-7x10' || compression !== 'gzip'
    || typeof file !== 'string' || !FILE_NAME.test(file)
    || typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)
    || !Number.isSafeInteger(bytesGzipped) || (bytesGzipped as number) <= 0
    || !Number.isSafeInteger(bytesRaw) || (bytesRaw as number) <= 0
    || !validDate(generatedOn)
    || !boundedText(generatedFrom, 512) || !boundedText(filter, 512)) {
    throw invalid('Catalog manifest has invalid schema, provenance, size, or file identity');
  }
  return {
    version: version as number,
    board,
    file,
    compression,
    sha256,
    bytesGzipped: bytesGzipped as number,
    bytesRaw: bytesRaw as number,
    generatedOn,
    generatedFrom,
    filter,
  };
}

function parseWatermarks(value: unknown): Readonly<Record<string, string>> {
  if (!isRecord(value)) throw invalid('Catalog manifest source watermarks must be an object');
  const entries = Object.entries(value);
  if (entries.length > MAX_WATERMARKS
    || !entries.every(([key, instant]) => WATERMARK_KEY.test(key) && validInstant(instant))) {
    throw invalid('Catalog manifest source watermarks are invalid');
  }
  return Object.freeze(Object.fromEntries(entries) as Record<string, string>);
}

function parseQualityScale(value: unknown): CatalogQualityScale {
  if (!isRecord(value)) throw invalid('Catalog manifest quality scale must be an object');
  const { min, max } = value;
  if (typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max)
    || min < 0 || max <= min || max > MAX_QUALITY) {
    throw invalid('Catalog manifest quality scale is invalid');
  }
  return Object.freeze({ min, max });
}

function parseChanges(value: unknown): CatalogChangeSummary | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) throw invalid('Catalog manifest change summary must be an object');
  const { added, removed, restored } = value;
  if (!nonnegativeInteger(added) || !nonnegativeInteger(removed) || !nonnegativeInteger(restored)) {
    throw invalid('Catalog manifest change summary is invalid');
  }
  return Object.freeze({ added, removed, restored });
}

function parseLegacy(value: Record<string, unknown>, base: CatalogManifestBase): LegacyCatalogManifest {
  const { source, sourceDataThrough } = value;
  if (source !== 'legacy-aurora-kilter' || !(sourceDataThrough === null || validDate(sourceDataThrough))) {
    throw invalid('Catalog manifest has invalid schema, provenance, size, or file identity');
  }
  return {
    schemaVersion: 2,
    ...base,
    source,
    sourceDataThrough,
  };
}

function parseBoardsesh(value: Record<string, unknown>, base: CatalogManifestBase): BoardseshCatalogManifest {
  const { source, sourceBuiltAt, sourceWatermarks, layoutRevision, qualityScale,
    climbCount, removedUpstreamCount } = value;
  if (source !== 'boardsesh-kilter' || !validInstant(sourceBuiltAt)
    || typeof layoutRevision !== 'string' || layoutRevision.length > 128 || !LAYOUT_REVISION.test(layoutRevision)
    || !Number.isSafeInteger(climbCount) || (climbCount as number) <= 0
    || !(removedUpstreamCount === undefined || removedUpstreamCount === null
      || nonnegativeInteger(removedUpstreamCount))) {
    throw invalid('Catalog manifest has invalid Boardsesh provenance or counts');
  }
  return {
    schemaVersion: 3,
    ...base,
    source,
    sourceBuiltAt,
    sourceWatermarks: parseWatermarks(sourceWatermarks),
    layoutRevision,
    qualityScale: parseQualityScale(qualityScale),
    climbCount: climbCount as number,
    removedUpstreamCount: removedUpstreamCount ?? null,
    changes: parseChanges(value.changes),
  };
}

export function parseCatalogManifest(value: unknown): CatalogManifest {
  if (!isRecord(value)) throw invalid('Catalog manifest must be an object');
  const { schemaVersion } = value;
  if (schemaVersion !== 2 && schemaVersion !== 3) {
    throw invalid('Catalog manifest has invalid schema, provenance, size, or file identity');
  }
  const base = parseBase(value);
  const manifest = schemaVersion === 2 ? parseLegacy(value, base) : parseBoardsesh(value, base);
  if (manifest.bytesGzipped > CATALOG_COMPRESSED_LIMIT || manifest.bytesRaw > CATALOG_RAW_LIMIT) {
    throw new CatalogBootstrapError('size', 'Catalog manifest declares an artifact above the supported size limits');
  }
  return Object.freeze(manifest);
}
