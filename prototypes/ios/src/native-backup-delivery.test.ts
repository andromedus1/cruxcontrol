import { Directory, Encoding } from '@capacitor/filesystem';
import type { FilesystemPlugin } from '@capacitor/filesystem';
import type { SharePlugin } from '@capacitor/share';
import { describe, expect, it, vi } from 'vitest';
import { createNativeBackupDelivery } from './native-backup-delivery.ts';

const file = {
  filename: 'cruxcontrol-library-2026-10-09.json',
  text: '{"saved":"雪"}',
};
const uri = 'file:///private/var/mobile/Containers/Data/Application/test/Library/Caches/cruxcontrol-backup-export/cruxcontrol-library-2026-10-09.json';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup(overrides: {
  readonly writeFile?: FilesystemPlugin['writeFile'];
  readonly rmdir?: FilesystemPlugin['rmdir'];
  readonly share?: SharePlugin['share'];
} = {}) {
  const filesystem = {
    writeFile: overrides.writeFile ?? vi.fn(async () => ({ uri })),
    rmdir: overrides.rmdir ?? vi.fn(async () => undefined),
  };
  const share = { share: overrides.share ?? vi.fn(async () => ({ activityType: '' })) };
  return {
    filesystem,
    share,
    delivery: createNativeBackupDelivery({
      filesystem: filesystem as unknown as Pick<FilesystemPlugin, 'writeFile' | 'rmdir'>,
      share: share as unknown as Pick<SharePlugin, 'share'>,
    }),
  };
}

const ownedDirectory = {
  path: 'cruxcontrol-backup-export',
  directory: Directory.Cache,
  recursive: true,
};

describe('createNativeBackupDelivery', () => {
  it('writes the exact UTF-8 backup to cache, shares its returned file URI and waits before cleanup', async () => {
    const pendingShare = deferred<{ activityType: string }>();
    const { filesystem, share, delivery } = setup({ share: vi.fn(() => pendingShare.promise) });

    const operation = delivery.deliver(file);
    await vi.waitFor(() => expect(share.share).toHaveBeenCalledOnce());
    expect(filesystem.rmdir).toHaveBeenCalledTimes(1);
    expect(filesystem.rmdir).toHaveBeenCalledWith(ownedDirectory);
    expect(filesystem.writeFile).toHaveBeenCalledWith({
      path: `cruxcontrol-backup-export/${file.filename}`,
      data: file.text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    expect(share.share).toHaveBeenCalledWith({ files: [uri], title: 'CruxControl library backup' });

    pendingShare.resolve({ activityType: '' });
    await expect(operation).resolves.toEqual({ status: 'shared' });
    expect(filesystem.rmdir).toHaveBeenCalledTimes(2);
  });

  it('normalizes only the pinned exact iOS cancellation message', async () => {
    const { filesystem, share, delivery } = setup({
      share: vi.fn().mockRejectedValue(new Error('Share canceled')),
    });
    await expect(delivery.deliver(file)).resolves.toEqual({ status: 'cancelled' });
    expect(share.share).toHaveBeenCalledOnce();
    expect(filesystem.rmdir).toHaveBeenCalledTimes(1);

    const unrelated = setup({ share: vi.fn().mockRejectedValue(new Error('Share canceled by destination')) });
    await expect(unrelated.delivery.deliver(file)).rejects.toThrow('Share canceled by destination');
    expect(unrelated.filesystem.rmdir).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: 'exact cancellation', shareError: new Error('Share canceled'), rejects: false },
    { name: 'unknown share rejection', shareError: new Error('destination unavailable'), rejects: true },
  ])('retains the cache file after $name and clears it at the next export preflight', async ({ shareError, rejects }) => {
    const cache = new Map<string, string>();
    const events: string[] = [];
    const fileCountsBeforeWrite: number[] = [];
    const rmdir = vi.fn(async () => {
      events.push('remove');
      cache.clear();
    });
    const writeFile = vi.fn(async ({ path, data }: { path: string; data: string }) => {
      events.push('write');
      fileCountsBeforeWrite.push(cache.size);
      cache.set(path, data);
      return { uri };
    });
    const share = vi.fn()
      .mockRejectedValueOnce(shareError)
      .mockResolvedValueOnce({ activityType: '' });
    const { delivery } = setup({ rmdir, writeFile, share });
    const path = `cruxcontrol-backup-export/${file.filename}`;

    if (rejects) {
      await expect(delivery.deliver(file)).rejects.toThrow('destination unavailable');
    } else {
      await expect(delivery.deliver(file)).resolves.toEqual({ status: 'cancelled' });
    }
    expect(cache.get(path)).toBe(file.text);
    expect(events).toEqual(['remove', 'write']);
    expect(rmdir).toHaveBeenCalledOnce();

    await expect(delivery.deliver({ ...file, text: '{"saved":"next"}' })).resolves.toEqual({ status: 'shared' });
    expect(events).toEqual(['remove', 'write', 'remove', 'write', 'remove']);
    expect(fileCountsBeforeWrite).toEqual([0, 0]);
    expect(cache.size).toBe(0);
  });

  it('cleans up a partial write failure and does not open the share sheet', async () => {
    const failure = new Error('disk full');
    const { filesystem, share, delivery } = setup({ writeFile: vi.fn().mockRejectedValue(failure) });
    await expect(delivery.deliver(file)).rejects.toMatchObject({
      message: 'Unable to export the library backup: disk full',
      cause: failure,
    });
    expect(share.share).not.toHaveBeenCalled();
    expect(filesystem.rmdir).toHaveBeenCalledTimes(2);
  });

  it.each(['', 'https://example.com/backup.json', 'blob:backup', 'file:///'])('rejects a missing or non-file URI before sharing: %s', async (invalidUri) => {
    const { filesystem, share, delivery } = setup({ writeFile: vi.fn(async () => ({ uri: invalidUri })) });
    await expect(delivery.deliver(file)).rejects.toThrow('valid local backup file URI');
    expect(share.share).not.toHaveBeenCalled();
    expect(filesystem.rmdir).toHaveBeenCalledTimes(2);
  });

  it('cancels before filesystem work and still attempts to remove an interrupted leftover', async () => {
    const { filesystem, share, delivery } = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(delivery.deliver(file, controller.signal)).resolves.toEqual({ status: 'cancelled' });
    expect(filesystem.rmdir).toHaveBeenCalledTimes(1);
    expect(filesystem.rmdir).toHaveBeenCalledWith(ownedDirectory);
    expect(filesystem.writeFile).not.toHaveBeenCalled();
    expect(share.share).not.toHaveBeenCalled();
  });

  it('cancels after asynchronous preparation when abort arrives before the sheet opens', async () => {
    const pendingWrite = deferred<{ uri: string }>();
    const { filesystem, share, delivery } = setup({ writeFile: vi.fn(() => pendingWrite.promise) });
    const controller = new AbortController();
    const operation = delivery.deliver(file, controller.signal);
    await vi.waitFor(() => expect(filesystem.writeFile).toHaveBeenCalledOnce());
    controller.abort();
    pendingWrite.resolve({ uri });
    await expect(operation).resolves.toEqual({ status: 'cancelled' });
    expect(share.share).not.toHaveBeenCalled();
    expect(filesystem.rmdir).toHaveBeenCalledTimes(2);
  });

  it('keeps the temporary file until a share already in progress completes after abort', async () => {
    const pendingShare = deferred<{ activityType: string }>();
    const { filesystem, share, delivery } = setup({ share: vi.fn(() => pendingShare.promise) });
    const controller = new AbortController();
    const operation = delivery.deliver(file, controller.signal);
    await vi.waitFor(() => expect(share.share).toHaveBeenCalledOnce());
    controller.abort();
    expect(filesystem.rmdir).toHaveBeenCalledTimes(1);
    pendingShare.resolve({ activityType: 'com.apple.DocumentManagerUICore.SaveToFiles' });
    await expect(operation).resolves.toEqual({ status: 'shared' });
    expect(filesystem.rmdir).toHaveBeenCalledTimes(2);
  });

  it('retains the file when an aborted caller receives cancellation from an open share sheet', async () => {
    const pendingShare = deferred<{ activityType: string }>();
    const { filesystem, share, delivery } = setup({ share: vi.fn(() => pendingShare.promise) });
    const controller = new AbortController();
    const operation = delivery.deliver(file, controller.signal);
    await vi.waitFor(() => expect(share.share).toHaveBeenCalledOnce());
    controller.abort();
    pendingShare.reject(new Error('Share canceled'));
    await expect(operation).resolves.toEqual({ status: 'cancelled' });
    expect(filesystem.rmdir).toHaveBeenCalledTimes(1);
  });

  it('keeps the successful outcome and reports a failed final cleanup', async () => {
    const rmdir = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('cache locked'));
    const { delivery } = setup({ rmdir });
    await expect(delivery.deliver(file)).resolves.toEqual({
      status: 'shared',
      warning: "The temporary backup copy could not be removed from this app's storage.",
    });
  });

  it('keeps a pre-share export error and appends a failed cleanup warning', async () => {
    const failure = new Error('disk full');
    const rmdir = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('cache locked'));
    const { delivery, share } = setup({ writeFile: vi.fn().mockRejectedValue(failure), rmdir });
    await expect(delivery.deliver(file)).rejects.toThrow(
      "Unable to export the library backup: disk full. The temporary backup copy could not be removed from this app's storage.",
    );
    expect(share.share).not.toHaveBeenCalled();
  });

  it('retries cleanup of the owned directory before writing the next export', async () => {
    const rmdir = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('cache locked'));
    const { filesystem, delivery } = setup({ rmdir });
    await expect(delivery.deliver(file)).resolves.toMatchObject({ status: 'shared', warning: expect.any(String) });
    await expect(delivery.deliver(file)).resolves.toEqual({ status: 'shared' });
    expect(rmdir).toHaveBeenCalledTimes(4);
    expect(rmdir.mock.invocationCallOrder[2]).toBeLessThan(vi.mocked(filesystem.writeFile).mock.invocationCallOrder[1]!);
  });

  it('rejects an overlapping delivery before it can touch the in-use directory', async () => {
    const pendingShare = deferred<{ activityType: string }>();
    const { filesystem, share, delivery } = setup({ share: vi.fn(() => pendingShare.promise) });
    const active = delivery.deliver(file);
    await vi.waitFor(() => expect(share.share).toHaveBeenCalledOnce());
    await expect(delivery.deliver(file)).rejects.toThrow('already in progress');
    expect(filesystem.rmdir).toHaveBeenCalledTimes(1);
    expect(filesystem.writeFile).toHaveBeenCalledOnce();
    pendingShare.resolve({ activityType: '' });
    await active;
    expect(filesystem.rmdir).toHaveBeenCalledTimes(2);
  });

  it.each(['', '.', '..', '../backup.json', 'folder/backup.json', 'folder\\backup.json'])('rejects a filename that is not a basename: %s', async (filename) => {
    const { filesystem, delivery } = setup();
    await expect(delivery.deliver({ ...file, filename })).rejects.toThrow('nonempty basename');
    expect(filesystem.rmdir).not.toHaveBeenCalled();
    expect(filesystem.writeFile).not.toHaveBeenCalled();
  });

  it('ignores only the Filesystem missing-file error while cleaning an absent directory', async () => {
    const missingFile = Object.assign(new Error('missing'), { code: 'OS-PLUG-FILE-0008' });
    const rmdir = vi.fn().mockRejectedValueOnce(missingFile).mockResolvedValueOnce(undefined);
    const { delivery, share } = setup({ rmdir });
    await expect(delivery.deliver(file)).resolves.toEqual({ status: 'shared' });
    expect(share.share).toHaveBeenCalledOnce();

    const denied = setup({ rmdir: vi.fn().mockRejectedValue(Object.assign(new Error('denied'), { code: 'OS-PLUG-FILE-0009' })) });
    await expect(denied.delivery.deliver(file)).rejects.toThrow('denied');
    expect(denied.filesystem.writeFile).not.toHaveBeenCalled();
  });
});
