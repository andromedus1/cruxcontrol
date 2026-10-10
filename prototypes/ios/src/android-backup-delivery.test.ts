import { describe, expect, it, vi } from 'vitest';
import { createAndroidBackupDelivery } from './android-backup-delivery.ts';

const file = { filename: 'cruxcontrol-library-2026-10-09T12-34-56.789Z.json', text: '{"saved":"雪"}' };
const uri = 'content://com.android.providers.downloads.documents/document/1234';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup(save = vi.fn(async () => ({ uri }))) {
  return { save, delivery: createAndroidBackupDelivery({ filePicker: { save } }) };
}

describe('createAndroidBackupDelivery', () => {
  it('passes the exact UTF-8 export and reports saved only after the native write settles', async () => {
    const pending = deferred<{ uri: string }>();
    const { save, delivery } = setup(vi.fn(() => pending.promise));
    const operation = delivery.deliver(file);

    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save).toHaveBeenCalledWith(file);
    let settled = false;
    void operation.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    pending.resolve({ uri });
    await expect(operation).resolves.toEqual({ status: 'saved' });
  });

  it('reports exact picker cancellation without treating it as a storage failure', async () => {
    const { save, delivery } = setup(vi.fn().mockRejectedValue(new Error('Save canceled')));
    await expect(delivery.deliver(file)).resolves.toEqual({ status: 'cancelled' });
    expect(save).toHaveBeenCalledOnce();
  });

  it('rejects write/provider errors instead of reporting a saved backup', async () => {
    const failure = new Error('provider write failed');
    const { delivery } = setup(vi.fn().mockRejectedValue(failure));
    await expect(delivery.deliver(file)).rejects.toMatchObject({
      message: 'Unable to save the library backup: provider write failed.',
      cause: failure,
    });
  });

  it('treats a restored picker call without its in-memory export bytes as failure', async () => {
    const failure = new Error('The backup save was interrupted. Your library is unchanged; please export again.');
    const { delivery } = setup(vi.fn().mockRejectedValue(failure));
    await expect(delivery.deliver(file)).rejects.toMatchObject({
      message: `Unable to save the library backup: ${failure.message}.`,
      cause: failure,
    });
  });

  it.each(['', 'https://example.com/backup.json', 'file:///tmp/backup.json'])('requires a content URI from the picker: %s', async (invalidUri) => {
    const { delivery } = setup(vi.fn(async () => ({ uri: invalidUri })));
    await expect(delivery.deliver(file)).rejects.toThrow('did not return a content URI');
  });

  it('does not invoke native work when canceled before the picker starts', async () => {
    const { save, delivery } = setup();
    const controller = new AbortController();
    controller.abort();

    await expect(delivery.deliver(file, controller.signal)).resolves.toEqual({ status: 'cancelled' });
    expect(save).not.toHaveBeenCalled();
  });

  it('follows the actual picker result after abort instead of falsely reporting no saved file', async () => {
    const pending = deferred<{ uri: string }>();
    const { save, delivery } = setup(vi.fn(() => pending.promise));
    const controller = new AbortController();
    const operation = delivery.deliver(file, controller.signal);
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());

    controller.abort();
    pending.resolve({ uri });
    await expect(operation).resolves.toEqual({ status: 'saved' });
  });

  it('rejects overlap before opening a second picker', async () => {
    const pending = deferred<{ uri: string }>();
    const { save, delivery } = setup(vi.fn(() => pending.promise));
    const active = delivery.deliver(file);
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());

    await expect(delivery.deliver(file)).rejects.toThrow('already in progress');
    expect(save).toHaveBeenCalledOnce();
    pending.resolve({ uri });
    await active;
  });

  it.each(['', '.', '..', '../backup.json', 'folder/backup.json', 'folder\\backup.json', 'backup.txt'])('rejects an invalid backup filename before opening the picker: %s', async (filename) => {
    const { save, delivery } = setup();
    await expect(delivery.deliver({ ...file, filename })).rejects.toThrow('JSON basename');
    expect(save).not.toHaveBeenCalled();
  });
});
