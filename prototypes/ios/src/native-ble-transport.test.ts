import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BleService } from '@capacitor-community/bluetooth-le';
import { NativeBleByteTransport, type NativeBleClient } from './native-ble-transport.ts';
import {
  AURORA_ADVERTISEMENT_SERVICE_UUID,
  NORDIC_UART_SERVICE_UUID,
  NORDIC_UART_RX_CHARACTERISTIC_UUID,
} from '../../../web/src/board-control/aurora-web-bluetooth.ts';
import { createFullrideLightController } from '../../../web/src/board-control/light-controller.ts';
import { kilterFullride7x10Definition } from '../../../web/src/domain/boards/definitions/kilter-fullride-7x10.ts';
import { apiLevel3Color } from '../../../web/src/domain/boards/colors.ts';

const device = { deviceId: 'synthetic-native-board', name: 'Kilter Board' };
function services(withoutResponse = true, withResponse = true): BleService[] {
  return [
    {
      uuid: NORDIC_UART_SERVICE_UUID.toUpperCase(),
      characteristics: [
        {
          uuid: NORDIC_UART_RX_CHARACTERISTIC_UUID,
          descriptors: [],
          properties: {
            broadcast: false,
            read: false,
            writeWithoutResponse: withoutResponse,
            write: withResponse,
            notify: false,
            indicate: false,
            authenticatedSignedWrites: false,
          },
        },
      ],
    },
  ];
}
function fixture() {
  const callbacks: Array<() => void> = [];
  const client = {
    initialize: vi.fn<NativeBleClient['initialize']>().mockResolvedValue(),
    isEnabled: vi.fn<NativeBleClient['isEnabled']>().mockResolvedValue(true),
    requestDevice: vi.fn<NativeBleClient['requestDevice']>().mockResolvedValue(device),
    connect: vi.fn<NativeBleClient['connect']>().mockImplementation(async (_id, callback) => {
      callbacks.push(() => callback?.(device.deviceId));
    }),
    disconnect: vi.fn<NativeBleClient['disconnect']>().mockResolvedValue(),
    getServices: vi.fn<NativeBleClient['getServices']>().mockResolvedValue(services()),
    write: vi.fn<NativeBleClient['write']>().mockResolvedValue(),
    writeWithoutResponse: vi.fn<NativeBleClient['writeWithoutResponse']>().mockResolvedValue(),
  };
  return { client, callbacks, transport: new NativeBleByteTransport(client) };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const bytes = (view: DataView) => [
  ...new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
];
afterEach(() => vi.useRealTimers());

describe('native BLE transport contract', () => {
  it('does not initialize until Connect, emits lifecycle, remembers only the selected board', async () => {
    const { client, transport } = fixture();
    const states: string[] = [];
    const unsubscribe = transport.subscribe((state) => states.push(state.status));
    expect(await transport.getRememberedDevices()).toEqual([]);
    expect(client.initialize).not.toHaveBeenCalled();
    const selected = await transport.requestAndConnect();
    expect(states).toEqual(['disconnected', 'selecting', 'connecting', 'connected']);
    expect(client.requestDevice).toHaveBeenCalledWith({
      services: [AURORA_ADVERTISEMENT_SERVICE_UUID],
    });
    expect(await transport.getRememberedDevices()).toEqual([selected]);
    unsubscribe();
    await transport.disconnect();
    await transport.reconnect(selected.id);
    expect(client.requestDevice).toHaveBeenCalledTimes(1);
    expect(states).toHaveLength(4);
  });

  it.each([
    ['BLE permission denied', 'device-unavailable', /Settings/],
    ['BLE unsupported', 'unsupported', /real iPhone/],
    ['unexpected initialization failure', 'device-unavailable', /initialize/],
  ])('surfaces initialization failure %s without discovery', async (message, code, copy) => {
    const { client, transport } = fixture();
    client.initialize.mockRejectedValue(new Error(message));
    await expect(transport.requestAndConnect()).rejects.toMatchObject({
      code,
      message: expect.stringMatching(copy),
    });
    expect(client.requestDevice).not.toHaveBeenCalled();
    expect(transport.getState().status).toBe(code === 'unsupported' ? 'unsupported' : 'error');
  });

  it('handles Bluetooth off, cancellation, duplicate chooser and retry', async () => {
    const { client, transport } = fixture();
    client.isEnabled.mockResolvedValueOnce(false);
    await expect(transport.requestAndConnect()).rejects.toMatchObject({
      code: 'device-unavailable',
      message: expect.stringContaining('off'),
    });
    const selected = deferred<typeof device>();
    client.requestDevice.mockReturnValueOnce(selected.promise);
    const first = transport.requestAndConnect();
    const cancelled = expect(first).rejects.toMatchObject({
      code: 'chooser-cancelled',
    });
    await expect(transport.requestAndConnect()).rejects.toMatchObject({
      code: 'chooser-in-progress',
    });
    await vi.waitFor(() => expect(client.requestDevice).toHaveBeenCalledTimes(1));
    selected.reject(new Error('requestDevice cancelled.'));
    await cancelled;
    expect(transport.getState().status).toBe('disconnected');
    await transport.requestAndConnect();
    expect(transport.getState().status).toBe('connected');
  });

  it.each(['service', 'channel', 'properties'] as const)(
    'rejects a missing %s and disconnects',
    async (missing) => {
      const { client, transport } = fixture();
      client.getServices.mockResolvedValue(
        missing === 'service'
          ? []
          : missing === 'channel'
            ? [{ uuid: NORDIC_UART_SERVICE_UUID, characteristics: [] }]
            : services(false, false),
      );
      await expect(transport.requestAndConnect()).rejects.toMatchObject({
        code: {
          service: 'service-not-found',
          channel: 'characteristic-not-found',
          properties: 'write-not-supported',
        }[missing],
      });
      expect(client.disconnect).toHaveBeenCalledWith(device.deviceId);
    },
  );

  it('uses without-response, copies caller buffers and preserves FIFO batch ordering', async () => {
    const { client, transport } = fixture();
    await transport.requestAndConnect();
    const first = deferred<void>();
    client.writeWithoutResponse.mockReturnValueOnce(first.promise);
    const backing = new Uint8Array([0, 10, 11, 0]);
    const one = transport.writeBatch([backing.subarray(1, 3), new Uint8Array([12])]);
    const two = transport.writeBatch([new Uint8Array([13])]);
    backing[1] = 99;
    await vi.waitFor(() => expect(client.writeWithoutResponse).toHaveBeenCalledTimes(1));
    expect(bytes(client.writeWithoutResponse.mock.calls[0]![3])).toEqual([10, 11]);
    first.resolve();
    await Promise.all([one, two]);
    expect(client.writeWithoutResponse.mock.calls.map((call) => bytes(call[3]))).toEqual([
      [10, 11],
      [12],
      [13],
    ]);
    expect(client.writeWithoutResponse.mock.calls[0]!.slice(0, 3)).toEqual([
      device.deviceId,
      NORDIC_UART_SERVICE_UUID,
      NORDIC_UART_RX_CHARACTERISTIC_UUID,
    ]);
    expect(client.write).not.toHaveBeenCalled();
  });

  it('falls back to advertised with-response writes', async () => {
    const { client, transport } = fixture();
    client.getServices.mockResolvedValue(services(false, true));
    await transport.requestAndConnect();
    await transport.writeBatch([new Uint8Array([7])]);
    expect(client.write).toHaveBeenCalledTimes(1);
    expect(client.writeWithoutResponse).not.toHaveBeenCalled();
  });

  it('honors pacing and diagnostic cancellation without sending the next chunk', async () => {
    vi.useFakeTimers();
    const { client, transport } = fixture();
    await transport.requestAndConnect();
    const abort = new AbortController();
    const trace = vi.fn();
    const sending = transport.writeBatch([new Uint8Array([1]), new Uint8Array([2])], {
      signal: abort.signal,
      interChunkDelayMs: 20,
      onEvent: trace,
      frameIndex: 4,
    });
    const failure = expect(sending).rejects.toMatchObject({
      code: 'write-failed',
    });
    await vi.advanceTimersByTimeAsync(19);
    expect(client.writeWithoutResponse).toHaveBeenCalledTimes(1);
    abort.abort();
    await failure;
    await vi.runAllTimersAsync();
    expect(client.writeWithoutResponse).toHaveBeenCalledTimes(1);
    expect(trace.mock.calls.map(([event]) => event.stage)).toEqual([
      'batch-started',
      'chunk-called',
      'chunk-settled',
    ]);
  });

  it.each(['remote', 'force'] as const)(
    'rejects final-write success and queued stale bytes after %s disconnect',
    async (kind) => {
      const { client, transport, callbacks } = fixture();
      await transport.requestAndConnect();
      const write = deferred<void>();
      client.writeWithoutResponse.mockReturnValueOnce(write.promise);
      const first = transport.writeBatch([new Uint8Array([1])]);
      const queued = transport.writeBatch([new Uint8Array([2])]);
      const firstFailed = expect(first).rejects.toMatchObject({
        code: 'disconnected',
      });
      const queuedFailed = expect(queued).rejects.toMatchObject({
        code: 'disconnected',
      });
      await vi.waitFor(() => expect(client.writeWithoutResponse).toHaveBeenCalledTimes(1));
      if (kind === 'remote') callbacks[0]!();
      else transport.forceDisconnect();
      const reconnect = transport.reconnect();
      await Promise.resolve();
      expect(client.connect).toHaveBeenCalledTimes(1);
      write.resolve();
      await Promise.all([firstFailed, queuedFailed, reconnect]);
      expect(client.writeWithoutResponse).toHaveBeenCalledTimes(1);
      expect(transport.getState().status).toBe('connected');
      callbacks[0]!(); // stale callback must not tear down the new connection
      expect(transport.getState().status).toBe('connected');
      await transport.writeBatch([new Uint8Array([3])]);
      expect(bytes(client.writeWithoutResponse.mock.calls[1]![3])).toEqual([3]);
    },
  );

  it('discards a late chooser result after backgrounding and requires an explicit foreground connect', async () => {
    const { client, transport } = fixture();
    const choice = deferred<typeof device>();
    client.requestDevice.mockReturnValueOnce(choice.promise);
    const connecting = transport.requestAndConnect();
    const failure = expect(connecting).rejects.toMatchObject({
      code: 'disconnected',
    });
    await vi.waitFor(() => expect(client.requestDevice).toHaveBeenCalledTimes(1));
    transport.setForeground(false);
    choice.resolve(device);
    await failure;
    expect(client.connect).not.toHaveBeenCalled();
    await expect(transport.requestAndConnect()).rejects.toMatchObject({
      code: 'disconnected',
    });
    transport.setForeground(true);
    expect(client.connect).not.toHaveBeenCalled();
    await transport.requestAndConnect();
    expect(client.connect).toHaveBeenCalledTimes(1);
  });

  it('cleans up a connect that completes after force-disconnect without publishing connected', async () => {
    const { client, transport } = fixture();
    const connected = deferred<void>();
    client.connect.mockReturnValueOnce(connected.promise);
    const pending = transport.requestAndConnect();
    const failed = expect(pending).rejects.toMatchObject({
      code: 'disconnected',
    });
    const states: string[] = [];
    transport.subscribe((state) => states.push(state.status));
    await vi.waitFor(() => expect(client.connect).toHaveBeenCalledTimes(1));
    transport.forceDisconnect();
    await vi.waitFor(() => expect(client.disconnect).toHaveBeenCalledTimes(1));
    connected.resolve();
    await failed;
    expect(client.disconnect).toHaveBeenCalledTimes(2);
    expect(states).not.toContain('connected');
    await transport.reconnect();
    expect(transport.getState().status).toBe('connected');
  });

  it('reports write/disconnect failures and cleans up before a successful retry', async () => {
    const { client, transport } = fixture();
    await transport.requestAndConnect();
    client.writeWithoutResponse.mockRejectedValueOnce(new Error('Native write timeout'));
    client.disconnect.mockRejectedValueOnce(new Error('Native disconnect timeout'));
    await expect(transport.writeBatch([new Uint8Array([1])])).rejects.toMatchObject({
      code: 'write-failed',
    });
    await vi.waitFor(() => expect(transport.getState()).toMatchObject({ status: 'error' }));
    await transport.reconnect();
    expect(client.disconnect).toHaveBeenCalledTimes(2);
    await transport.writeBatch([new Uint8Array([2])]);
  });

  it('rejects invalid, unsupported and unselected operations', async () => {
    const { transport } = fixture();
    await expect(transport.writeBatch([])).rejects.toMatchObject({
      code: 'write-failed',
    });
    await expect(transport.writeBatch([new Uint8Array([1])])).rejects.toMatchObject({
      code: 'disconnected',
    });
    await expect(transport.reconnect()).rejects.toMatchObject({
      code: 'device-unavailable',
    });
    const unavailable = new NativeBleByteTransport(null);
    expect(unavailable.getCapability().supported).toBe(false);
    await expect(unavailable.requestAndConnect()).rejects.toMatchObject({
      code: 'unsupported',
    });
  });

  it('preserves unavailable capability through background and disconnect', async () => {
    const { client, transport } = fixture();
    client.initialize.mockRejectedValueOnce(new Error('BLE unsupported'));
    await expect(transport.requestAndConnect()).rejects.toMatchObject({ code: 'unsupported' });
    transport.setForeground(false);
    transport.setForeground(true);
    await transport.disconnect();
    expect(transport.getState().status).toBe('unsupported');
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('preserves the connection failure when native cleanup fires its disconnect callback', async () => {
    const { client, transport, callbacks } = fixture();
    client.getServices.mockResolvedValueOnce([]);
    // iOS invokes onDisconnected before resolving its disconnect call.
    client.disconnect.mockImplementationOnce(async () => callbacks[0]!());
    await expect(transport.requestAndConnect()).rejects.toMatchObject({
      code: 'service-not-found',
    });
    expect(transport.getState()).toMatchObject({
      status: 'error',
      error: { code: 'service-not-found' },
    });
    await transport.reconnect();
    expect(transport.getState().status).toBe('connected');
  });

  it('recovers after failed connection cleanup followed by a late native disconnect callback', async () => {
    const { client, transport, callbacks } = fixture();
    client.getServices.mockResolvedValueOnce([]);
    client.disconnect.mockRejectedValueOnce(new Error('Disconnection timeout.'));
    await expect(transport.requestAndConnect()).rejects.toMatchObject({
      code: 'service-not-found',
    });
    callbacks[0]!();
    await transport.reconnect();
    expect(transport.getState().status).toBe('connected');
  });

  it('feeds real Fullride light/clear packets through the native write seam', async () => {
    const { client, transport } = fixture();
    const controller = createFullrideLightController({
      definition: kilterFullride7x10Definition,
      transport,
    });
    await controller.requestAndConnect();
    await controller.light([
      {
        placementId: kilterFullride7x10Definition.placements[0]!.id,
        color: apiLevel3Color(28),
      },
    ]);
    await controller.clear();
    const sent = client.writeWithoutResponse.mock.calls.map((call) => bytes(call[3]));
    expect(sent).toHaveLength(2);
    // API3 color 28 converts to API2 green 3 (0x30); payload 50 00 30 has checksum 7f.
    expect(sent[0]).toEqual([1, 3, 127, 2, 80, 0, 48, 3]);
    expect(sent[1]).toEqual([1, 1, 175, 2, 80, 3]);
  });

  it('disconnects a backgrounded session and sends nothing until explicit foreground reconnect', async () => {
    const { client, transport } = fixture();
    await transport.requestAndConnect();
    transport.setForeground(false);
    await vi.waitFor(() => expect(client.disconnect).toHaveBeenCalledOnce());
    transport.setForeground(true);
    expect(client.connect).toHaveBeenCalledOnce();
    await expect(transport.writeBatch([new Uint8Array([1])])).rejects.toMatchObject({
      code: 'disconnected',
    });
    expect(client.writeWithoutResponse).not.toHaveBeenCalled();
    await transport.reconnect();
    await transport.writeBatch([new Uint8Array([2])]);
    expect(client.writeWithoutResponse).toHaveBeenCalledOnce();
  });

  it.each(['connect', 'getServices'] as const)(
    'cleans up a native %s failure and permits retry',
    async (method) => {
      const { client, transport } = fixture();
      client[method].mockRejectedValueOnce(new Error('Native operation failed'));
      await expect(transport.requestAndConnect()).rejects.toMatchObject({
        code: method === 'connect' ? 'gatt-connect-failed' : 'device-unavailable',
      });
      expect(client.disconnect).toHaveBeenCalledOnce();
      expect(transport.getState().status).toBe('error');
      await transport.reconnect();
      expect(transport.getState().status).toBe('connected');
    },
  );

  it('does not accept a service discovery result from a disconnected session', async () => {
    const { client, transport } = fixture();
    const discovery = deferred<BleService[]>();
    client.getServices.mockReturnValueOnce(discovery.promise);
    const pending = transport.requestAndConnect();
    const failure = expect(pending).rejects.toMatchObject({ code: 'disconnected' });
    await vi.waitFor(() => expect(client.getServices).toHaveBeenCalledOnce());
    await transport.disconnect();
    discovery.resolve(services());
    await failure;
    expect(transport.getState().status).toBe('disconnected');
    await expect(transport.writeBatch([new Uint8Array([1])])).rejects.toMatchObject({
      code: 'disconnected',
    });
    expect(client.writeWithoutResponse).not.toHaveBeenCalled();
  });
});
