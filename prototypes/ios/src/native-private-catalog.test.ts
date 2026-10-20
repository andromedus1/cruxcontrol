import { describe, expect, it, vi } from 'vitest';
import { CatalogUpdateError } from '../../../web/src/catalog/update-source.ts';
import { createNativePrivateCatalog, type NativePrivateCatalogPlugin } from './native-private-catalog.ts';

vi.mock('@capacitor/core', () => ({ registerPlugin: vi.fn(() => ({})) }));

function plugin(overrides: Partial<NativePrivateCatalogPlugin> = {}): NativePrivateCatalogPlugin {
  return {
    check: vi.fn(async () => ({ status: 'available', version: 7 })),
    prepare: vi.fn(async ({ version }: { version: number }) => ({ version })),
    ...overrides,
  };
}

function nativeError(code: string): Error & { code: string } {
  return Object.assign(new Error(`native ${code} message`), { code });
}

describe('native private catalog adapter', () => {
  it('decodes every check status and prepares exactly the requested version', async () => {
    for (const status of ['unconfigured', 'signed-out', 'none'] as const) {
      const source = createNativePrivateCatalog(plugin({ check: vi.fn(async () => ({ status })) }));
      await expect(source.check()).resolves.toEqual({ status });
    }
    const bridge = plugin();
    const source = createNativePrivateCatalog(bridge);
    await expect(source.check()).resolves.toEqual({ status: 'available', version: 7 });
    await expect(source.prepare(7)).resolves.toBeUndefined();
    expect(bridge.prepare).toHaveBeenCalledWith({ version: 7 });
  });

  it('rejects malformed bridge results instead of trusting them', async () => {
    const malformed: unknown[] = [
      null,
      { status: 'available' },
      { status: 'available', version: 0 },
      { status: 'available', version: 1.5 },
      { status: 'available', version: 7, token: 'leak' },
      { status: 'none', version: 7 },
      { status: 'unknown' },
    ];
    for (const value of malformed) {
      const source = createNativePrivateCatalog(plugin({ check: vi.fn(async () => value) }));
      await expect(source.check()).rejects.toMatchObject({ code: 'unavailable' });
    }
    const mismatched = createNativePrivateCatalog(plugin({ prepare: vi.fn(async () => ({ version: 6 })) }));
    await expect(mismatched.prepare(7)).rejects.toMatchObject({ code: 'unavailable' });
    await expect(createNativePrivateCatalog(plugin()).prepare(0)).rejects.toBeInstanceOf(CatalogUpdateError);
  });

  it('maps bounded plugin codes to fixed product errors', async () => {
    const cases: Array<[string, string]> = [
      ['AUTH_REQUIRED', 'signed-out'],
      ['NOT_ADMITTED', 'not-admitted'],
      ['NETWORK', 'network'],
      ['INTEGRITY', 'integrity'],
      ['UNAVAILABLE', 'unavailable'],
      ['UNIMPLEMENTED', 'unavailable'],
    ];
    for (const [native, code] of cases) {
      const failing = createNativePrivateCatalog(plugin({
        check: vi.fn(async () => { throw nativeError(native); }),
        prepare: vi.fn(async () => { throw nativeError(native); }),
      }));
      const checked = await failing.check().catch((error: unknown) => error);
      expect(checked).toMatchObject({ code });
      expect((checked as Error).message).not.toContain('native');
      await expect(failing.prepare(7)).rejects.toMatchObject({ code });
    }
  });
});
