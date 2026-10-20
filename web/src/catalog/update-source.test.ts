import { describe, expect, it } from 'vitest';
import {
  CATALOG_UPDATE_PREFERENCES_KEY,
  localCatalogUpdatePreferences,
  parseCatalogUpdatePreferences,
} from './update-source.ts';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('catalog update preferences', () => {
  it('round-trips per-device check and dismissal state', () => {
    const storage = memoryStorage();
    const preferences = localCatalogUpdatePreferences(() => storage);
    expect(preferences.read()).toEqual({ lastCheckedAt: null, dismissedVersion: null, stagedVersion: null });
    preferences.write({ lastCheckedAt: 1_760_000_000_000, dismissedVersion: 3, stagedVersion: 4 });
    expect(JSON.parse(storage.getItem(CATALOG_UPDATE_PREFERENCES_KEY)!)).toEqual({
      lastCheckedAt: 1_760_000_000_000, dismissedVersion: 3, stagedVersion: 4,
    });
    expect(localCatalogUpdatePreferences(() => storage).read()).toMatchObject({ dismissedVersion: 3 });
  });

  it('treats corrupt values as absent, which only causes an earlier check or a re-shown banner', () => {
    expect(parseCatalogUpdatePreferences('not json')).toEqual({ lastCheckedAt: null, dismissedVersion: null, stagedVersion: null });
    expect(parseCatalogUpdatePreferences('{"lastCheckedAt":-1,"dismissedVersion":2.5,"stagedVersion":"4"}'))
      .toEqual({ lastCheckedAt: null, dismissedVersion: null, stagedVersion: null });
  });

  it('keeps working in memory when storage is blocked', () => {
    const blocked = localCatalogUpdatePreferences(() => { throw new DOMException('denied', 'SecurityError'); });
    blocked.write({ lastCheckedAt: 5, dismissedVersion: null, stagedVersion: null });
    expect(blocked.read().lastCheckedAt).toBe(5);
  });
});
