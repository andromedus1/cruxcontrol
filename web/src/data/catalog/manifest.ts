import { CatalogBootstrapError } from './errors.ts';

export interface CatalogManifest {
  schemaVersion: 2;
  version: number;
  board: 'kilter-fullride-7x10';
  file: string;
  compression: 'gzip';
  sha256: string;
  bytesGzipped: number;
  bytesRaw: number;
  generatedOn: string;
  source: 'legacy-aurora-kilter';
  sourceDataThrough: string | null;
  generatedFrom: string;
  filter: string;
}

export interface CatalogDownloadProgress {
  receivedBytes: number;
  totalBytes: number;
}

export const CATALOG_MANIFEST_LIMIT = 16 * 1024;
export const CATALOG_COMPRESSED_LIMIT = 8 * 1024 * 1024;
export const CATALOG_RAW_LIMIT = 32 * 1024 * 1024;

const FILE_NAME = /^kilter-7x10\.v[1-9][0-9]*\.db\.gz$/;

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

function boundedText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !value.includes('\0');
}

export function parseCatalogManifest(value: unknown): CatalogManifest {
  if (!isRecord(value)) throw invalid('Catalog manifest must be an object');
  const { schemaVersion, version, board, file, compression, sha256, bytesGzipped, bytesRaw,
    generatedOn, source, sourceDataThrough, generatedFrom, filter } = value;
  if (schemaVersion !== 2 || !Number.isSafeInteger(version) || (version as number) <= 0
    || board !== 'kilter-fullride-7x10' || compression !== 'gzip'
    || typeof file !== 'string' || !FILE_NAME.test(file)
    || typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)
    || !Number.isSafeInteger(bytesGzipped) || (bytesGzipped as number) <= 0
    || !Number.isSafeInteger(bytesRaw) || (bytesRaw as number) <= 0
    || !validDate(generatedOn) || source !== 'legacy-aurora-kilter'
    || !(sourceDataThrough === null || validDate(sourceDataThrough))
    || !boundedText(generatedFrom, 512) || !boundedText(filter, 512)) {
    throw invalid('Catalog manifest has invalid schema, provenance, size, or file identity');
  }
  if ((bytesGzipped as number) > CATALOG_COMPRESSED_LIMIT
    || (bytesRaw as number) > CATALOG_RAW_LIMIT) {
    throw new CatalogBootstrapError('size', 'Catalog manifest declares an artifact above the supported size limits');
  }
  return Object.freeze({
    schemaVersion: 2,
    version: version as number,
    board,
    file,
    compression,
    sha256,
    bytesGzipped: bytesGzipped as number,
    bytesRaw: bytesRaw as number,
    generatedOn,
    source,
    sourceDataThrough,
    generatedFrom,
    filter,
  });
}
