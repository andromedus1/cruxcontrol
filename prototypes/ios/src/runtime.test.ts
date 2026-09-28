import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@capacitor/app';
import { NativeBleByteTransport } from './native-ble-transport.ts';
import { bindNativeLifecycle, createPrototypeRuntime } from './runtime.ts';

const native = vi.hoisted(() => ({
  platform: vi.fn(() => 'ios'),
  disableQueue: vi.fn(),
  initialize: vi.fn(),
  addListener: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: native.platform },
}));
vi.mock('@capacitor-community/bluetooth-le', () => ({
  BleClient: {
    disableQueue: native.disableQueue,
    initialize: native.initialize,
  },
}));
vi.mock('@capacitor/app', () => ({ App: { addListener: native.addListener } }));

const callbacks = new Map<string, () => void>();
const removals: ReturnType<typeof vi.fn>[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  native.platform.mockReturnValue('ios');
  callbacks.clear();
  removals.length = 0;
  native.addListener.mockImplementation(async (event: string, callback: () => void) => {
    callbacks.set(event, callback);
    const remove = vi.fn().mockResolvedValue(undefined);
    removals.push(remove);
    return { remove };
  });
});

describe('prototype runtime composition and lifetime', () => {
  it('opens the real library without initializing Bluetooth and releases native listeners on close', async () => {
    const runtime = await createPrototypeRuntime();
    expect(runtime.controller?.getState().transport.status).toBe('disconnected');
    expect(runtime.backup).toBeDefined();
    expect(native.disableQueue).toHaveBeenCalledOnce();
    expect(native.initialize).not.toHaveBeenCalled();
    expect([...callbacks.keys()]).toEqual(['pause', 'resume']);
    runtime.close();
    for (const remove of removals) expect(remove).toHaveBeenCalledOnce();
  });

  it('uses unsupported native capability for browser inspection without initializing plugins', async () => {
    native.platform.mockReturnValue('web');
    const runtime = await createPrototypeRuntime();
    expect(runtime.controller?.getState().transport.status).toBe('unsupported');
    expect(native.disableQueue).not.toHaveBeenCalled();
    expect(native.initialize).not.toHaveBeenCalled();
    expect(native.addListener).not.toHaveBeenCalled();
    runtime.close();
  });

  it('forwards only background/foreground events and ignores callbacks after disposal', async () => {
    const transport = new NativeBleByteTransport(null);
    const foreground = vi.spyOn(transport, 'setForeground');
    const dispose = await bindNativeLifecycle(transport, App);
    expect(foreground).not.toHaveBeenCalled();
    callbacks.get('pause')!();
    callbacks.get('resume')!();
    expect(foreground.mock.calls).toEqual([[false], [true]]);
    // Failed asynchronous listener removal must not revive a closed runtime.
    removals[0]!.mockRejectedValueOnce(new Error('listener removal failed'));
    dispose();
    callbacks.get('resume')!();
    expect(foreground.mock.calls).toEqual([[false], [true], [false]]);
    await Promise.resolve();
  });

  it('cleans up partial registration while preserving its original failure', async () => {
    const transport = new NativeBleByteTransport(null);
    const foreground = vi.spyOn(transport, 'setForeground');
    const remove = vi.fn().mockRejectedValue(new Error('cleanup failed'));
    const failure = new Error('resume registration failed');
    native.addListener.mockResolvedValueOnce({ remove }).mockRejectedValueOnce(failure);
    await expect(bindNativeLifecycle(transport, App)).rejects.toBe(failure);
    expect(remove).toHaveBeenCalledOnce();
    expect(foreground).toHaveBeenCalledWith(false);
  });
});
