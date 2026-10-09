import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserLibraryBackupDelivery } from './delivery.ts';

const file = { filename: 'cruxcontrol-library-2026-10-09.json', text: '{"saved":"雪"}' };

afterEach(() => vi.restoreAllMocks());

describe('browserLibraryBackupDelivery', () => {
  it('downloads the original JSON file and reports only that the download started', async () => {
    let capturedBlob: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:backup';
    });
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const result = await browserLibraryBackupDelivery.deliver(file);

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = capturedBlob!;
    expect(blob.type).toBe('application/json');
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
    expect(content).toBe(file.text);
    expect(click).toHaveBeenCalledOnce();
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.href).toBe('blob:backup');
    expect(anchor.download).toBe(file.filename);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup');
    expect(result).toEqual({ status: 'download-started' });
  });

  it('revokes the object URL when the browser click fails', async () => {
    const createObjectURL = vi.fn(() => 'blob:failed');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('download unavailable'); });

    await expect(browserLibraryBackupDelivery.deliver(file)).rejects.toThrow('download unavailable');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:failed');
  });

  it('does not create or click a URL for an already-aborted request', async () => {
    const createObjectURL = vi.fn(() => 'blob:unused');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const controller = new AbortController();
    controller.abort();

    await expect(browserLibraryBackupDelivery.deliver(file, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});
