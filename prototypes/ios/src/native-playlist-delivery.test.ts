import { describe, expect, it, vi } from 'vitest';
import { createNativePlaylistDelivery } from './native-playlist-delivery.ts';

describe('native playlist file delivery', () => {
  it('uses the shared SAF handoff for exact portable JSON and waits for native close', async () => {
    const file = { filename: 'Synthetic.cruxplaylist.json', text: '{"format":"cruxcontrol-playlist","name":"雪"}' };
    let finish!: (value: { uri: string }) => void;
    const pending = new Promise<{ uri: string }>((resolve) => { finish = resolve; });
    const save = vi.fn(() => pending);
    const delivery = createNativePlaylistDelivery({ filePicker: { save } });
    const operation = delivery.deliver(file);
    expect(save).toHaveBeenCalledExactlyOnceWith(file);
    await expect(delivery.deliver(file)).rejects.toThrow('already in progress');
    finish({ uri: 'content://example/synthetic.json' });
    await expect(operation).resolves.toEqual({ status: 'saved' });
  });
  it('retains picker cancellation and labels real playlist failures accurately', async () => {
    const save = vi.fn().mockRejectedValueOnce(Object.assign(new Error('Save canceled'), { code: 'FILE_SAVE_CANCELED' })).mockRejectedValueOnce(new Error('Write failed'));
    const delivery = createNativePlaylistDelivery({ filePicker: { save } });
    const file = { filename: 'Synthetic.cruxplaylist.json', text: '{}' };
    await expect(delivery.deliver(file)).resolves.toEqual({ status: 'cancelled' });
    await expect(delivery.deliver(file)).rejects.toThrow('Unable to save the playlist file: Write failed');
  });
});
