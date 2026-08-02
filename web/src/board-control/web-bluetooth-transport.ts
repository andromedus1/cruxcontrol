import {
  BoardTransportError,
  freezeDevice,
  type BoardByteTransport,
  type BoardDeviceRef,
  type BoardTransportCapability,
  type BoardTransportErrorCode,
  type BoardTransportListener,
  type BoardTransportState,
  type Unsubscribe,
} from './transport.ts';
import type {
  BluetoothDeviceLike,
  BluetoothRemoteGattCharacteristicLike,
  BluetoothRemoteGattServerLike,
  WebBluetoothPlatform,
} from './web-bluetooth-platform.ts';

export interface WebBluetoothTransportConfig {
  readonly requestOptions: Readonly<{
    filters: readonly { readonly services: readonly string[] }[];
    optionalServices: readonly string[];
  }>;
  readonly primaryServiceUuid: string;
  readonly writeCharacteristicUuid: string;
}

type WriteMethod = (value: ArrayBufferView) => Promise<void>;

export class WebBluetoothByteTransport implements BoardByteTransport {
  private readonly capability: BoardTransportCapability;
  private readonly listeners = new Set<BoardTransportListener>();
  private readonly listeningDevices = new Set<BluetoothDeviceLike>();
  private state: BoardTransportState;
  private device: BluetoothDeviceLike | null = null;
  private server: BluetoothRemoteGattServerLike | null = null;
  private characteristic: BluetoothRemoteGattCharacteristicLike | null = null;
  private writeMethod: WriteMethod | null = null;
  private chooserInProgress = false;
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly platform: WebBluetoothPlatform,
    private readonly config: WebBluetoothTransportConfig,
  ) {
    this.capability = !platform.isSecureContext
      ? Object.freeze({ supported: false, reason: 'insecure-context' as const })
      : typeof platform.bluetooth?.requestDevice !== 'function'
        ? Object.freeze({ supported: false, reason: 'api-unavailable' as const })
        : Object.freeze({ supported: true as const });
    this.state = this.capability.supported
      ? Object.freeze({ status: 'disconnected', device: null })
      : Object.freeze({ status: 'unsupported', capability: this.capability });
  }

  getCapability(): BoardTransportCapability {
    return this.capability;
  }

  getState(): BoardTransportState {
    return this.state;
  }

  subscribe(listener: BoardTransportListener): Unsubscribe {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  async getRememberedDevices(): Promise<readonly BoardDeviceRef[]> {
    if (!this.capability.supported || !this.platform.bluetooth?.getDevices) return Object.freeze([]);
    let devices: readonly BluetoothDeviceLike[];
    try {
      devices = await this.platform.bluetooth.getDevices();
    } catch (cause) {
      throw new BoardTransportError('device-unavailable', 'Remembered boards could not be accessed.', {
        cause,
      });
    }
    for (const device of devices) this.installDisconnectListener(device);
    return Object.freeze(devices.map((device) => this.deviceRef(device)));
  }

  requestAndConnect(): Promise<BoardDeviceRef> {
    const unsupported = this.unsupportedError();
    if (unsupported) return Promise.reject(unsupported);
    if (this.chooserInProgress) {
      return Promise.reject(
        new BoardTransportError('chooser-in-progress', 'A board chooser is already open.'),
      );
    }
    this.chooserInProgress = true;
    this.publish(Object.freeze({ status: 'selecting', device: null }));
    // Keep this call in the synchronous user-activation portion of the method.
    let chooser: Promise<BluetoothDeviceLike>;
    try {
      chooser = this.platform.bluetooth!.requestDevice(this.config.requestOptions);
    } catch (cause) {
      this.chooserInProgress = false;
      const error = this.mapChooserError(cause);
      this.publishError(error, null);
      return Promise.reject(error);
    }
    // Observe chooser rejection immediately even when an older GATT operation is
    // holding the FIFO queue. Deferring the first rejection handler until the
    // queued continuation runs can surface a browser-level unhandled rejection.
    const chooserResult = chooser.then(
      (device) => ({ ok: true as const, device }),
      (cause: unknown) => ({ ok: false as const, cause }),
    );
    return this.enqueue(async () => {
      try {
        const result = await chooserResult;
        if (!result.ok) throw result.cause;
        const { device } = result;
        this.device = device;
        this.installDisconnectListener(device);
        return await this.connectDevice(device);
      } catch (cause) {
        const error = this.mapChooserError(cause);
        this.clearHandles();
        if (error.code === 'chooser-cancelled') {
          this.device = null;
          this.publish(Object.freeze({ status: 'disconnected', device: null }));
        } else if (error.code === 'disconnected') {
          this.publish(
            Object.freeze({
              status: 'disconnected',
              device: this.device ? this.deviceRef(this.device) : null,
            }),
          );
        } else if (this.state.status !== 'error' || this.state.error !== error) {
          this.publishError(error, this.device);
        }
        throw error;
      } finally {
        this.chooserInProgress = false;
      }
    });
  }

  reconnect(deviceId?: string): Promise<BoardDeviceRef> {
    const unsupported = this.unsupportedError();
    if (unsupported) return Promise.reject(unsupported);
    return this.enqueue(async () => {
      let device = this.device;
      if (deviceId && device?.id !== deviceId) device = null;
      if (!device && this.platform.bluetooth?.getDevices) {
        let devices: readonly BluetoothDeviceLike[];
        try {
          devices = await this.platform.bluetooth.getDevices();
        } catch (cause) {
          throw this.fail('device-unavailable', 'Remembered boards could not be accessed.', cause);
        }
        device = deviceId ? devices.find((candidate) => candidate.id === deviceId) ?? null : devices[0] ?? null;
      }
      if (!device) {
        const error = new BoardTransportError('device-unavailable', 'The selected board is not available.');
        this.publishError(error, null);
        throw error;
      }
      this.device = device;
      this.installDisconnectListener(device);
      return this.connectDevice(device);
    });
  }

  disconnect(): Promise<void> {
    return this.enqueue(async () => {
      const device = this.device;
      if (!device || (!this.server && this.state.status === 'disconnected')) return;
      const ref = this.deviceRef(device);
      this.publish(Object.freeze({ status: 'disconnecting', device: ref }));
      try {
        (this.server ?? device.gatt)?.disconnect();
      } finally {
        this.clearHandles();
        this.publish(Object.freeze({ status: 'disconnected', device: ref }));
      }
    });
  }

  writeBatch(chunks: readonly Uint8Array[]): Promise<void> {
    const copies = chunks.map((chunk) => new Uint8Array(chunk));
    if (copies.length === 0) {
      return Promise.reject(new BoardTransportError('write-failed', 'No board data was provided.'));
    }
    return this.enqueue(async () => {
      if (this.state.status !== 'connected' || !this.characteristic || !this.writeMethod) {
        throw new BoardTransportError('disconnected', 'Connect to the board before sending lights.');
      }
      const generation = this.generation;
      const write = this.writeMethod;
      try {
        for (const chunk of copies) {
          if (generation !== this.generation || this.state.status !== 'connected') {
            throw new BoardTransportError('disconnected', 'The board disconnected while sending lights.');
          }
          await write(chunk);
        }
      } catch (cause) {
        if (generation !== this.generation) {
          const error = new BoardTransportError(
            'disconnected',
            'The board disconnected while sending lights.',
            { cause },
          );
          throw error;
        }
        const error =
          cause instanceof BoardTransportError
            ? cause
            : new BoardTransportError('write-failed', 'The board could not receive the light data.', { cause });
        this.publishError(error, this.device);
        throw error;
      }
    });
  }

  private async connectDevice(device: BluetoothDeviceLike): Promise<BoardDeviceRef> {
    const ref = this.deviceRef(device);
    this.clearHandles();
    const connectionGeneration = this.generation;
    this.publish(Object.freeze({ status: 'connecting', device: ref }));
    if (!device.gatt) throw this.fail('gatt-connect-failed', 'The board does not expose a Bluetooth connection.');
    let server: BluetoothRemoteGattServerLike;
    try {
      server = await device.gatt.connect();
      this.assertCurrentConnection(connectionGeneration);
    } catch (cause) {
      if (cause instanceof BoardTransportError) throw cause;
      throw this.fail('gatt-connect-failed', 'Could not connect to the board.', cause);
    }
    this.server = server;
    let service;
    try {
      service = await server.getPrimaryService(this.config.primaryServiceUuid);
      this.assertCurrentConnection(connectionGeneration);
    } catch (cause) {
      if (cause instanceof BoardTransportError) throw cause;
      throw this.fail('service-not-found', 'The board control service was not found.', cause);
    }
    let characteristic: BluetoothRemoteGattCharacteristicLike;
    try {
      characteristic = await service.getCharacteristic(this.config.writeCharacteristicUuid);
      this.assertCurrentConnection(connectionGeneration);
    } catch (cause) {
      if (cause instanceof BoardTransportError) throw cause;
      throw this.fail('characteristic-not-found', 'The board write channel was not found.', cause);
    }
    const withoutResponse = characteristic.writeValueWithoutResponse?.bind(characteristic);
    const withResponse = characteristic.writeValueWithResponse?.bind(characteristic);
    const write =
      characteristic.properties?.writeWithoutResponse !== false && withoutResponse
        ? withoutResponse
        : characteristic.properties?.write !== false && withResponse
          ? withResponse
          : null;
    if (!write) throw this.fail('write-not-supported', 'The board write channel is not supported.');
    this.characteristic = characteristic;
    this.writeMethod = write;
    this.generation += 1;
    this.publish(Object.freeze({ status: 'connected', device: ref }));
    return ref;
  }

  private installDisconnectListener(device: BluetoothDeviceLike): void {
    if (this.listeningDevices.has(device)) return;
    this.listeningDevices.add(device);
    device.addEventListener('gattserverdisconnected', () => {
      if (device !== this.device) return;
      const intentional = this.state.status === 'disconnecting';
      const ref = this.deviceRef(device);
      this.clearHandles();
      if (!intentional) this.publish(Object.freeze({ status: 'disconnected', device: ref }));
    });
  }

  private clearHandles(): void {
    this.server = null;
    this.characteristic = null;
    this.writeMethod = null;
    this.generation += 1;
  }

  private assertCurrentConnection(generation: number): void {
    if (generation !== this.generation) {
      throw new BoardTransportError('disconnected', 'The board disconnected while connecting.');
    }
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private unsupportedError(): BoardTransportError | null {
    if (this.capability.supported) return null;
    const code = this.capability.reason === 'insecure-context' ? 'insecure-context' : 'unsupported';
    return new BoardTransportError(
      code,
      this.capability.reason === 'insecure-context'
        ? 'Board control requires a secure connection.'
        : 'This browser does not support Bluetooth board control.',
      { recoverable: false },
    );
  }

  private fail(code: BoardTransportErrorCode, message: string, cause?: unknown): BoardTransportError {
    const error = new BoardTransportError(code, message, { cause });
    this.clearHandles();
    this.publishError(error, this.device);
    return error;
  }

  private mapChooserError(cause: unknown): BoardTransportError {
    if (cause instanceof BoardTransportError) return cause;
    if (typeof cause === 'object' && cause !== null && 'name' in cause && cause.name === 'NotFoundError') {
      return new BoardTransportError('chooser-cancelled', 'No board was selected.', { cause });
    }
    return new BoardTransportError('device-unavailable', 'The board chooser could not select a device.', { cause });
  }

  private publishError(error: BoardTransportError, device: BluetoothDeviceLike | null): void {
    this.publish(Object.freeze({ status: 'error', device: device ? this.deviceRef(device) : null, error }));
  }

  private publish(state: BoardTransportState): void {
    this.state = state;
    for (const listener of [...this.listeners]) listener(state);
  }

  private deviceRef(device: BluetoothDeviceLike): BoardDeviceRef {
    return freezeDevice({ id: device.id, name: device.name ?? null });
  }
}
