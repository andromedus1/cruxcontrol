import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOpfsSyncAccessSupported } from './opfs-support.ts';

describe('isOpfsSyncAccessSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns false in jsdom (no OPFS sync access handles)', () => {
    // jsdom provides neither navigator.storage.getDirectory nor
    // FileSystemFileHandle, so detection must report unsupported.
    expect(isOpfsSyncAccessSupported()).toBe(false);
  });

  it('returns true when both capabilities are present', () => {
    vi.stubGlobal('navigator', { storage: { getDirectory: () => {} } });
    vi.stubGlobal('FileSystemFileHandle', {
      prototype: { createSyncAccessHandle: () => {} },
    });
    expect(isOpfsSyncAccessSupported()).toBe(true);
  });

  it('returns false when getDirectory is present but sync handles are not', () => {
    vi.stubGlobal('navigator', { storage: { getDirectory: () => {} } });
    vi.stubGlobal('FileSystemFileHandle', { prototype: {} });
    expect(isOpfsSyncAccessSupported()).toBe(false);
  });

  it('returns false when sync handles exist but OPFS root access does not', () => {
    vi.stubGlobal('navigator', { storage: {} });
    vi.stubGlobal('FileSystemFileHandle', {
      prototype: { createSyncAccessHandle: () => {} },
    });
    expect(isOpfsSyncAccessSupported()).toBe(false);
  });
});
