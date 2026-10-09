import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOpfsSyncAccessSupported, isWorkerOpfsSyncAccessSupported } from './opfs-support.ts';

describe('isOpfsSyncAccessSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns false in jsdom (no OPFS root or Web Locks)', () => {
    expect(isOpfsSyncAccessSupported()).toBe(false);
  });

  it('returns true when OPFS root access and Web Locks are present', () => {
    vi.stubGlobal('navigator', {
      storage: { getDirectory: () => {} },
      locks: { request: () => {} },
    });
    expect(isOpfsSyncAccessSupported()).toBe(true);
  });

  it('returns false when Web Locks are missing', () => {
    vi.stubGlobal('navigator', { storage: { getDirectory: () => {} } });
    expect(isOpfsSyncAccessSupported()).toBe(false);
  });

  it('checks sync-access handles in the Worker capability probe', () => {
    vi.stubGlobal('navigator', { storage: { getDirectory: () => {} } });
    vi.stubGlobal('FileSystemFileHandle', {
      prototype: { createSyncAccessHandle: () => {} },
    });
    expect(isWorkerOpfsSyncAccessSupported()).toBe(true);
    vi.stubGlobal('FileSystemFileHandle', { prototype: {} });
    expect(isWorkerOpfsSyncAccessSupported()).toBe(false);
  });
});
