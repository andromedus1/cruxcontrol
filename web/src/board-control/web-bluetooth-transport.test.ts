import { describe, expect, it, vi } from 'vitest';
import { AURORA_WEB_BLUETOOTH_CONFIG } from './aurora-web-bluetooth.ts';
import type {
  BluetoothDeviceLike,
  BluetoothRemoteGattCharacteristicLike,
  BluetoothRemoteGattServerLike,
  BluetoothRemoteGattServiceLike,
  WebBluetoothPlatform,
} from './web-bluetooth-platform.ts';
import { WebBluetoothByteTransport } from './web-bluetooth-transport.ts';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

class FakeDevice implements BluetoothDeviceLike {
  readonly id = 'board-1';
  readonly name = 'Kilter Board @3.0';
  readonly gatt: BluetoothRemoteGattServerLike;
  private disconnectListener: (() => void) | null = null;

  constructor(server: BluetoothRemoteGattServerLike) {
    this.gatt = server;
  }

  addEventListener(_type: 'gattserverdisconnected', listener: () => void): void {
    this.disconnectListener = listener;
  }

  remoteDisconnect(): void {
    this.disconnectListener?.();
  }
}

function browserFixture(characteristics: BluetoothRemoteGattCharacteristicLike[]) {
  const log: string[] = [];
  let characteristicIndex = 0;
  const service: BluetoothRemoteGattServiceLike = {
    async getCharacteristic(uuid) {
      log.push(`characteristic:${uuid}`);
      return characteristics[characteristicIndex++]!;
    },
  };
  const server: BluetoothRemoteGattServerLike = {
    connected: false,
    async connect() {
      log.push('connect');
      return server;
    },
    disconnect() {
      log.push('disconnect');
    },
    async getPrimaryService(uuid) {
      log.push(`service:${uuid}`);
      return service;
    },
  };
  const device = new FakeDevice(server);
  let chooserCalls = 0;
  const platform: WebBluetoothPlatform = {
    isSecureContext: true,
    bluetooth: {
      requestDevice(options) {
        chooserCalls += 1;
        log.push(`chooser:${options.filters[0]?.services[0]}`);
        return Promise.resolve(device);
      },
      getDevices: () => Promise.resolve([device]),
    },
  };
  return { platform, device, log, chooserCalls: () => chooserCalls };
}

describe('WebBluetoothByteTransport', () => {
  it.each([
    [
      { isSecureContext: false } satisfies WebBluetoothPlatform,
      'insecure-context',
      'insecure-context',
    ],
    [{ isSecureContext: true } satisfies WebBluetoothPlatform, 'api-unavailable', 'unsupported'],
  ] as const)(
    'reports unsupported capability without a chooser',
    async (platform, reason, code) => {
      const transport = new WebBluetoothByteTransport(platform, AURORA_WEB_BLUETOOTH_CONFIG);
      expect(transport.getCapability()).toEqual({ supported: false, reason });
      await expect(transport.requestAndConnect()).rejects.toMatchObject({ code });
    },
  );

  it('opens the chooser synchronously with exact Aurora options and rejects a second chooser', async () => {
    const characteristic = { writeValueWithoutResponse: () => Promise.resolve() };
    const fixture = browserFixture([characteristic]);
    const transport = new WebBluetoothByteTransport(fixture.platform, AURORA_WEB_BLUETOOTH_CONFIG);
    const connecting = transport.requestAndConnect();
    expect(fixture.chooserCalls()).toBe(1);
    expect(transport.getState().status).toBe('selecting');
    await expect(transport.requestAndConnect()).rejects.toMatchObject({
      code: 'chooser-in-progress',
    });
    await connecting;
    expect(fixture.log[0]).toContain('chooser:4488b571');
    expect(fixture.log.slice(1, 4)).toEqual([
      'connect',
      `service:${AURORA_WEB_BLUETOOTH_CONFIG.primaryServiceUuid}`,
      `characteristic:${AURORA_WEB_BLUETOOTH_CONFIG.writeCharacteristicUuid}`,
    ]);
  });

  it('maps chooser cancellation and permits another attempt', async () => {
    let attempts = 0;
    const fixture = browserFixture([{ writeValueWithoutResponse: () => Promise.resolve() }]);
    const platform: WebBluetoothPlatform = {
      isSecureContext: true,
      bluetooth: {
        ...fixture.platform.bluetooth!,
        requestDevice(options) {
          attempts += 1;
          if (attempts === 1) return Promise.reject(new DOMException('cancelled', 'NotFoundError'));
          return fixture.platform.bluetooth!.requestDevice(options);
        },
      },
    };
    const transport = new WebBluetoothByteTransport(platform, AURORA_WEB_BLUETOOTH_CONFIG);
    await expect(transport.requestAndConnect()).rejects.toMatchObject({
      code: 'chooser-cancelled',
    });
    expect(transport.getState()).toEqual({ status: 'disconnected', device: null });
    await expect(transport.requestAndConnect()).resolves.toMatchObject({ id: 'board-1' });
  });

  it('attaches a chooser rejection handler before returning to the caller', async () => {
    const chooser = deferred<BluetoothDeviceLike>();
    const then = vi.spyOn(chooser.promise, 'then');
    const transport = new WebBluetoothByteTransport(
      {
        isSecureContext: true,
        bluetooth: { requestDevice: () => chooser.promise },
      },
      AURORA_WEB_BLUETOOTH_CONFIG,
    );

    const connecting = transport.requestAndConnect();
    expect(then).toHaveBeenCalledTimes(1);
    chooser.reject(new DOMException('cancelled', 'NotFoundError'));
    await expect(connecting).rejects.toMatchObject({ code: 'chooser-cancelled' });
  });

  it('normalizes synchronous chooser errors and releases the chooser guard', async () => {
    const transport = new WebBluetoothByteTransport(
      {
        isSecureContext: true,
        bluetooth: {
          requestDevice() {
            throw new Error('platform failure');
          },
        },
      },
      AURORA_WEB_BLUETOOTH_CONFIG,
    );
    await expect(transport.requestAndConnect()).rejects.toMatchObject({
      code: 'device-unavailable',
    });
    await expect(transport.requestAndConnect()).rejects.toMatchObject({
      code: 'device-unavailable',
    });
  });

  it.each([
    ['gatt-connect-failed', 'connect'],
    ['service-not-found', 'service'],
    ['characteristic-not-found', 'characteristic'],
  ] as const)('maps a %s browser-stage failure', async (code, failureStage) => {
    const characteristic = { writeValueWithoutResponse: () => Promise.resolve() };
    const service: BluetoothRemoteGattServiceLike = {
      getCharacteristic() {
        return failureStage === 'characteristic'
          ? Promise.reject(new Error('missing characteristic'))
          : Promise.resolve(characteristic);
      },
    };
    const server: BluetoothRemoteGattServerLike = {
      connected: false,
      connect() {
        return failureStage === 'connect'
          ? Promise.reject(new Error('radio'))
          : Promise.resolve(server);
      },
      disconnect() {},
      getPrimaryService() {
        return failureStage === 'service'
          ? Promise.reject(new Error('missing service'))
          : Promise.resolve(service);
      },
    };
    const device = new FakeDevice(server);
    const transport = new WebBluetoothByteTransport(
      {
        isSecureContext: true,
        bluetooth: { requestDevice: () => Promise.resolve(device) },
      },
      AURORA_WEB_BLUETOOTH_CONFIG,
    );
    const statuses: string[] = [];
    transport.subscribe((state) => statuses.push(state.status));
    await expect(transport.requestAndConnect()).rejects.toMatchObject({ code });
    expect(statuses).toEqual(['disconnected', 'selecting', 'connecting', 'error']);
  });

  it('rejects a characteristic with neither modern write method', async () => {
    const fixture = browserFixture([{}]);
    const transport = new WebBluetoothByteTransport(fixture.platform, AURORA_WEB_BLUETOOTH_CONFIG);
    await expect(transport.requestAndConnect()).rejects.toMatchObject({
      code: 'write-not-supported',
    });
  });

  it('serializes complete concurrent batches without interleaving', async () => {
    const gates = [deferred<void>(), deferred<void>(), deferred<void>()];
    const started: number[] = [];
    const characteristic: BluetoothRemoteGattCharacteristicLike = {
      writeValueWithoutResponse(value) {
        const byte = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)[0]!;
        started.push(byte);
        return gates[started.length - 1]!.promise;
      },
    };
    const fixture = browserFixture([characteristic]);
    const transport = new WebBluetoothByteTransport(fixture.platform, AURORA_WEB_BLUETOOTH_CONFIG);
    await transport.requestAndConnect();
    const first = transport.writeBatch([new Uint8Array([1]), new Uint8Array([2])]);
    const second = transport.writeBatch([new Uint8Array([3])]);
    await Promise.resolve();
    expect(started).toEqual([1]);
    gates[0]!.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toEqual([1, 2]);
    gates[1]!.resolve();
    await first;
    await Promise.resolve();
    expect(started).toEqual([1, 2, 3]);
    gates[2]!.resolve();
    await second;
  });

  it('falls back to writes with response and resolves fresh handles after reconnect', async () => {
    const writes: string[] = [];
    const first = {
      properties: { writeWithoutResponse: false, write: true },
      writeValueWithResponse: async () => {
        writes.push('first');
      },
    };
    const second = {
      writeValueWithoutResponse: async () => {
        writes.push('second');
      },
    };
    const fixture = browserFixture([first, second]);
    const transport = new WebBluetoothByteTransport(fixture.platform, AURORA_WEB_BLUETOOTH_CONFIG);
    await transport.requestAndConnect();
    await transport.writeBatch([new Uint8Array([1])]);
    fixture.device.remoteDisconnect();
    await expect(transport.writeBatch([new Uint8Array([2])])).rejects.toMatchObject({
      code: 'disconnected',
    });
    await transport.reconnect('board-1');
    await transport.writeBatch([new Uint8Array([3])]);
    expect(writes).toEqual(['first', 'second']);
    expect(fixture.log.filter((entry) => entry.startsWith('characteristic:'))).toHaveLength(2);
  });

  it('invalidates a multi-chunk batch after remote disconnect', async () => {
    const gate = deferred<void>();
    const writes: number[] = [];
    const fixture = browserFixture([
      {
        writeValueWithoutResponse(value) {
          writes.push(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)[0]!);
          return gate.promise;
        },
      },
    ]);
    const transport = new WebBluetoothByteTransport(fixture.platform, AURORA_WEB_BLUETOOTH_CONFIG);
    await transport.requestAndConnect();
    const batch = transport.writeBatch([new Uint8Array([1]), new Uint8Array([2])]);
    await Promise.resolve();
    fixture.device.remoteDisconnect();
    gate.resolve();
    await expect(batch).rejects.toMatchObject({ code: 'disconnected' });
    expect(writes).toEqual([1]);
  });

  it('keeps the queue usable after a failed write and disconnects idempotently', async () => {
    let calls = 0;
    const characteristic = {
      async writeValueWithoutResponse() {
        calls += 1;
        if (calls === 1) throw new Error('radio busy');
      },
    };
    const fixture = browserFixture([characteristic, characteristic]);
    const transport = new WebBluetoothByteTransport(fixture.platform, AURORA_WEB_BLUETOOTH_CONFIG);
    await transport.requestAndConnect();
    await expect(transport.writeBatch([new Uint8Array([1])])).rejects.toMatchObject({
      code: 'write-failed',
    });
    await expect(transport.writeBatch([new Uint8Array([2])])).rejects.toMatchObject({
      code: 'disconnected',
    });
    await transport.reconnect();
    await expect(transport.writeBatch([new Uint8Array([3])])).resolves.toBeUndefined();
    await transport.disconnect();
    await transport.disconnect();
    expect(transport.getState().status).toBe('disconnected');
  });

  it('returns no remembered devices when the optional API is absent', async () => {
    const fixture = browserFixture([{ writeValueWithoutResponse: () => Promise.resolve() }]);
    const transport = new WebBluetoothByteTransport(
      {
        isSecureContext: true,
        bluetooth: {
          requestDevice: fixture.platform.bluetooth!.requestDevice.bind(fixture.platform.bluetooth),
        },
      },
      AURORA_WEB_BLUETOOTH_CONFIG,
    );
    await expect(transport.getRememberedDevices()).resolves.toEqual([]);
  });

  it('normalizes remembered-device access failures', async () => {
    const transport = new WebBluetoothByteTransport(
      {
        isSecureContext: true,
        bluetooth: {
          requestDevice: () => Promise.reject(new Error('unused')),
          getDevices: () => Promise.reject(new Error('permission store unavailable')),
        },
      },
      AURORA_WEB_BLUETOOTH_CONFIG,
    );
    await expect(transport.getRememberedDevices()).rejects.toMatchObject({
      code: 'device-unavailable',
    });
    await expect(transport.reconnect()).rejects.toMatchObject({ code: 'device-unavailable' });
  });
});
