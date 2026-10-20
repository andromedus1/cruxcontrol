/**
 * Signed-in catalog update source. The native shell owns credentials: `check` asks the
 * private endpoint for its latest version and stages that manifest, `prepare` downloads and
 * verifies the artifact; the web then reads both through same-origin `/catalog/private/`.
 */
export type CatalogUpdateCheck =
  | { readonly status: 'unconfigured' | 'signed-out' | 'none' }
  | { readonly status: 'available'; readonly version: number };

/** Network-free account state, refreshed on every open/resume independent of the cadence. */
export type CatalogUpdateAccountStatus = 'unconfigured' | 'signed-out' | 'signed-in';

export interface CatalogUpdateSource {
  /** Current account state without contacting the endpoint. */
  status(): Promise<CatalogUpdateAccountStatus>;
  /** Ask the private endpoint for its latest version and stage its manifest natively. */
  check(): Promise<CatalogUpdateCheck>;
  /** Download and verify that version's artifact into app-private storage. */
  prepare(version: number): Promise<void>;
}

export type CatalogUpdateErrorCode = 'signed-out' | 'not-admitted' | 'network' | 'integrity' | 'unavailable';

const MESSAGES: Readonly<Record<CatalogUpdateErrorCode, string>> = Object.freeze({
  'signed-out': 'Sign in to get catalog updates.',
  'not-admitted': 'This account cannot receive catalog updates.',
  network: 'The catalog service could not be reached. Check your connection and try again.',
  integrity: 'The downloaded catalog did not match its manifest, so it was not installed.',
  unavailable: 'Catalog updates are temporarily unavailable.',
});

export class CatalogUpdateError extends Error {
  readonly code: CatalogUpdateErrorCode;

  constructor(code: CatalogUpdateErrorCode, message: string = MESSAGES[code], options?: ErrorOptions) {
    super(message, options);
    this.name = 'CatalogUpdateError';
    this.code = code;
    Object.setPrototypeOf(this, CatalogUpdateError.prototype);
  }
}

/** Web/PWA default: no signed-in transport, so updates are never configured. */
export const noCatalogUpdates: CatalogUpdateSource = Object.freeze({
  status: async (): Promise<CatalogUpdateAccountStatus> => 'unconfigured',
  check: async (): Promise<CatalogUpdateCheck> => Object.freeze({ status: 'unconfigured' as const }),
  prepare: async () => { throw new CatalogUpdateError('unavailable'); },
});

/** Automatic checks run at most twice a week, matching the weekly publish. */
export const CATALOG_UPDATE_CHECK_INTERVAL_MS = 3.5 * 24 * 60 * 60 * 1000;

/**
 * Per-device conveniences. Losing them only causes an earlier check or a re-shown banner,
 * so they live in local storage rather than the library.
 */
export interface CatalogUpdatePreferences {
  /** Epoch milliseconds of the last completed endpoint check. */
  readonly lastCheckedAt: number | null;
  /** Highest version hidden with "Later"; a newer version shows the banner again. */
  readonly dismissedVersion: number | null;
  /** Version the last completed check staged natively, so a later launch can re-offer it offline. */
  readonly stagedVersion: number | null;
}

export interface CatalogUpdatePreferenceStore {
  read(): CatalogUpdatePreferences;
  write(value: CatalogUpdatePreferences): void;
}

const EMPTY_PREFERENCES: CatalogUpdatePreferences = Object.freeze({
  lastCheckedAt: null,
  dismissedVersion: null,
  stagedVersion: null,
});

export const CATALOG_UPDATE_PREFERENCES_KEY = 'cruxcontrol.catalog-update.v1';

function finiteOrNull(value: unknown, integer: boolean): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  if (integer && !Number.isSafeInteger(value)) return null;
  return value;
}

export function parseCatalogUpdatePreferences(raw: string | null): CatalogUpdatePreferences {
  if (!raw) return EMPTY_PREFERENCES;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return EMPTY_PREFERENCES;
    const record = value as Record<string, unknown>;
    return Object.freeze({
      lastCheckedAt: finiteOrNull(record.lastCheckedAt, false),
      dismissedVersion: finiteOrNull(record.dismissedVersion, true),
      stagedVersion: finiteOrNull(record.stagedVersion, true),
    });
  } catch {
    return EMPTY_PREFERENCES;
  }
}

/** Local-storage preferences that tolerate blocked or unavailable storage. */
export function localCatalogUpdatePreferences(
  storage: () => Storage | undefined = () => (typeof window === 'undefined' ? undefined : window.localStorage),
): CatalogUpdatePreferenceStore {
  let memory = EMPTY_PREFERENCES;
  return Object.freeze({
    read() {
      try {
        const store = storage();
        if (store) memory = parseCatalogUpdatePreferences(store.getItem(CATALOG_UPDATE_PREFERENCES_KEY));
      } catch { /* Fall back to this session's values. */ }
      return memory;
    },
    write(value: CatalogUpdatePreferences) {
      memory = Object.freeze({ ...value });
      try {
        storage()?.setItem(CATALOG_UPDATE_PREFERENCES_KEY, JSON.stringify(memory));
      } catch { /* A lost preference only re-checks earlier or re-shows the banner. */ }
    },
  });
}

export function memoryCatalogUpdatePreferences(
  initial: Partial<CatalogUpdatePreferences> = {},
): CatalogUpdatePreferenceStore {
  let value: CatalogUpdatePreferences = Object.freeze({ ...EMPTY_PREFERENCES, ...initial });
  return Object.freeze({
    read: () => value,
    write(next: CatalogUpdatePreferences) { value = Object.freeze({ ...next }); },
  });
}
