import { registerPlugin } from '@capacitor/core';
import {
  CatalogUpdateError,
  type CatalogUpdateCheck,
  type CatalogUpdateErrorCode,
  type CatalogUpdateSource,
} from '../../../web/src/catalog/update-source.ts';

/** Android `PrivateCatalog` plugin: tokens stay native; results carry only status and version. */
export interface NativePrivateCatalogPlugin {
  check(): Promise<unknown>;
  prepare(options: { version: number }): Promise<unknown>;
}

const MAX_VERSION = 999_999;
const STATUSES = new Set(['unconfigured', 'signed-out', 'none']);

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CatalogUpdateError('unavailable');
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new CatalogUpdateError('unavailable');
  }
}

function version(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > MAX_VERSION) {
    throw new CatalogUpdateError('unavailable');
  }
  return value as number;
}

export function decodeCatalogCheck(value: unknown): CatalogUpdateCheck {
  const result = record(value);
  if (result.status === 'available') {
    exactKeys(result, ['status', 'version']);
    return Object.freeze({ status: 'available', version: version(result.version) });
  }
  exactKeys(result, ['status']);
  if (typeof result.status !== 'string' || !STATUSES.has(result.status)) throw new CatalogUpdateError('unavailable');
  return Object.freeze({ status: result.status as 'unconfigured' | 'signed-out' | 'none' });
}

const NATIVE_CODES: Readonly<Record<string, CatalogUpdateErrorCode>> = Object.freeze({
  AUTH_REQUIRED: 'signed-out',
  NOT_ADMITTED: 'not-admitted',
  NETWORK: 'network',
  INTEGRITY: 'integrity',
  UNAVAILABLE: 'unavailable',
});

export function toCatalogUpdateError(error: unknown): CatalogUpdateError {
  if (error instanceof CatalogUpdateError) return error;
  const code = typeof error === 'object' && error !== null && 'code' in error
    && typeof error.code === 'string' ? error.code : '';
  // Plugin messages are not surfaced: each bounded code has fixed product copy.
  return new CatalogUpdateError(NATIVE_CODES[code] ?? 'unavailable');
}

export function createNativePrivateCatalog(
  plugin: NativePrivateCatalogPlugin = registerPlugin<NativePrivateCatalogPlugin>('PrivateCatalog'),
): CatalogUpdateSource {
  return Object.freeze({
    async check() {
      let value: unknown;
      try { value = await plugin.check(); } catch (error) { throw toCatalogUpdateError(error); }
      return decodeCatalogCheck(value);
    },
    async prepare(requested: number) {
      const expected = version(requested);
      let value: unknown;
      try { value = await plugin.prepare({ version: expected }); } catch (error) { throw toCatalogUpdateError(error); }
      const result = record(value);
      exactKeys(result, ['version']);
      if (version(result.version) !== expected) throw new CatalogUpdateError('unavailable');
    },
  });
}
