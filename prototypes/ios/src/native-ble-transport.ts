import type { BleClientInterface } from '@capacitor-community/bluetooth-le';
import {
  BoardTransportError,
  freezeDevice,
  type BoardByteTransport,
  type BoardDeviceRef,
  type BoardTransportCapability,
  type BoardTransportListener,
  type BoardTransportState,
  type DiagnosticWriteOptions,
} from '../../../web/src/board-control/transport.ts';
import {
  AURORA_ADVERTISEMENT_SERVICE_UUID,
  NORDIC_UART_SERVICE_UUID,
  NORDIC_UART_RX_CHARACTERISTIC_UUID,
} from '../../../web/src/board-control/aurora-web-bluetooth.ts';

export type NativeBleClient = Pick<
  BleClientInterface,
  | 'initialize'
  | 'isEnabled'
  | 'requestDevice'
  | 'connect'
  | 'disconnect'
  | 'getServices'
  | 'write'
  | 'writeWithoutResponse'
>;

type Connection = {
  device: BoardDeviceRef;
  generation: number;
  mode: 'write' | 'writeWithoutResponse';
};
const unavailable = Object.freeze({
  supported: false,
  reason: 'api-unavailable',
} as const);
const disconnected = () =>
  new BoardTransportError(
    'disconnected',
    'The board connection was interrupted. Reconnect to continue.',
  );

/** Native I/O only; codecs, capacity policy and animation remain in the shared controller. */
export class NativeBleByteTransport implements BoardByteTransport {
  private capability: BoardTransportCapability;
  private state: BoardTransportState;
  private readonly listeners = new Set<BoardTransportListener>();
  private remembered: BoardDeviceRef | null = null;
  private nativeDevice: BoardDeviceRef | null = null;
  private connection: Connection | null = null;
  private generation = 0;
  private connecting = false;
  private initialized = false;
  private foreground = true;
  private queue: Promise<void> = Promise.resolve();
  private cleanup: Promise<void> = Promise.resolve();

  constructor(private readonly client: NativeBleClient | null) {
    this.capability = client ? Object.freeze({ supported: true }) : unavailable;
    this.state = client
      ? { status: 'disconnected', device: null }
      : { status: 'unsupported', capability: unavailable };
  }

  getCapability() {
    return this.capability;
  }
  getState() {
    return this.state;
  }
  subscribe(listener: BoardTransportListener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }
  async getRememberedDevices(): Promise<readonly BoardDeviceRef[]> {
    // Do not initialize Bluetooth or prompt for permission during library startup.
    return Object.freeze(this.remembered ? [this.remembered] : []);
  }
  requestAndConnect() {
    return this.connect(true);
  }
  reconnect(deviceId?: string) {
    return this.connect(false, deviceId);
  }

  setForeground(active: boolean): void {
    this.foreground = active;
    if (!active) this.forceDisconnect();
  }

  async disconnect(): Promise<void> {
    const generation = ++this.generation;
    this.connection = null;
    if (!this.client || !this.capability.supported) return;
    this.publish(
      this.remembered
        ? { status: 'disconnecting', device: this.remembered }
        : { status: 'disconnected', device: null },
    );
    try {
      await this.release(this.nativeDevice);
      if (generation === this.generation)
        this.publish({ status: 'disconnected', device: this.remembered });
    } catch (cause) {
      const error = new BoardTransportError(
        'disconnected',
        'Could not confirm board disconnection. Retry disconnecting before reconnecting.',
        { cause },
      );
      if (generation === this.generation)
        this.publish({ status: 'error', device: this.remembered, error });
      throw error;
    }
  }

  forceDisconnect(): void {
    // Invalidation happens before the first await; native cancellation bypasses writes.
    void this.disconnect().catch(() => undefined); // disconnect already publishes failure
  }

  writeBatch(chunks: readonly Uint8Array[], options?: DiagnosticWriteOptions): Promise<void> {
    if (!chunks.length || chunks.some((chunk) => !chunk.byteLength)) {
      return Promise.reject(new BoardTransportError('write-failed', 'No board data was provided.'));
    }
    const connection = this.connection;
    if (!connection) return Promise.reject(disconnected());
    const copies = chunks.map((chunk) => new Uint8Array(chunk));
    const run = this.queue.then(async () => {
      const assertReady = () => {
        this.assertCurrent(connection.generation);
        if (this.connection !== connection) throw disconnected();
        if (options?.signal.aborted)
          throw new BoardTransportError('write-failed', 'Board transmission was cancelled.');
      };
      const trace = (
        stage: 'batch-started' | 'chunk-called' | 'chunk-settled' | 'batch-settled',
        chunkIndex?: number,
        byteLength?: number,
      ) => {
        options?.onEvent(
          Object.freeze({
            atMs: performance.now(),
            stage,
            frameIndex: options.frameIndex,
            chunkIndex,
            byteLength,
          }),
        );
      };
      try {
        assertReady();
        trace('batch-started');
        for (const [index, chunk] of copies.entries()) {
          assertReady();
          trace('chunk-called', index, chunk.byteLength);
          await this.client![connection.mode](
            connection.device.id,
            NORDIC_UART_SERVICE_UUID,
            NORDIC_UART_RX_CHARACTERISTIC_UUID,
            new DataView(chunk.buffer),
            { timeout: 5_000 },
          );
          assertReady(); // including the final chunk: disconnect must not report success
          trace('chunk-settled', index, chunk.byteLength);
          if (options && index < copies.length - 1 && options.interChunkDelayMs) {
            await delay(options.interChunkDelayMs, options.signal);
          }
        }
        assertReady();
        trace('batch-settled');
      } catch (cause) {
        if (connection.generation !== this.generation) throw disconnected();
        const error =
          cause instanceof BoardTransportError
            ? cause
            : new BoardTransportError(
                'write-failed',
                'The board could not receive the light data. Reconnect to retry.',
                { cause },
              );
        this.forceDisconnect();
        this.publish({ status: 'error', device: connection.device, error });
        throw error;
      }
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async connect(select: boolean, deviceId?: string): Promise<BoardDeviceRef> {
    if (!this.client || !this.capability.supported) {
      throw new BoardTransportError(
        'unsupported',
        'Native Bluetooth is unavailable on this device.',
        { recoverable: false },
      );
    }
    if (!this.foreground) throw disconnected();
    if (this.connecting)
      throw new BoardTransportError(
        'chooser-in-progress',
        'Finish the current board selection or connection first.',
      );
    if (!select && (!this.remembered || (deviceId && this.remembered.id !== deviceId))) {
      throw new BoardTransportError(
        'device-unavailable',
        'Choose a board first. Remembered boards last for this app session.',
      );
    }
    this.connecting = true;
    this.connection = null;
    const generation = ++this.generation;
    let selected: BoardDeviceRef | null = null;
    this.publish(
      select
        ? { status: 'selecting', device: null }
        : { status: 'connecting', device: this.remembered! },
    );
    try {
      // Old native writes must settle before the same device ID can be reused.
      await this.queue;
      await this.cleanup;
      this.assertCurrent(generation);
      await this.release(this.nativeDevice); // retries a previously failed cleanup
      this.assertCurrent(generation);
      try {
        if (!this.initialized) {
          // iOS initialize replaces its CoreBluetooth manager. Keep the manager
          // that discovered the selected peripheral for subsequent reconnects.
          await this.client.initialize();
          this.initialized = true;
        }
      } catch (cause) {
        const message = messageOf(cause);
        if (message === 'BLE unsupported') {
          this.capability = unavailable;
          throw new BoardTransportError(
            'unsupported',
            'Bluetooth is unavailable here. iOS Bluetooth testing requires a real iPhone.',
            { recoverable: false, cause },
          );
        }
        throw new BoardTransportError(
          'device-unavailable',
          message === 'BLE permission denied'
            ? 'Bluetooth permission was denied. Allow Bluetooth for CruxControl Prototype in Settings, then retry.'
            : 'Could not initialize Bluetooth. Check Bluetooth and app permissions, then retry.',
          { cause },
        );
      }
      this.assertCurrent(generation);
      const enabled = await this.client.isEnabled();
      this.assertCurrent(generation);
      if (!enabled)
        throw new BoardTransportError(
          'device-unavailable',
          'Bluetooth is off. Turn it on, then retry.',
        );
      if (select) {
        const device = await this.client.requestDevice({
          services: [AURORA_ADVERTISEMENT_SERVICE_UUID],
        });
        this.assertCurrent(generation);
        selected = freezeDevice({
          id: device.deviceId,
          name: device.name ?? null,
        });
      } else selected = this.remembered!;
      this.remembered = selected;
      this.nativeDevice = selected;
      this.publish({ status: 'connecting', device: selected });
      try {
        await this.client.connect(
          selected.id,
          () => {
            if (generation !== this.generation) return;
            this.generation += 1;
            this.connection = null;
            this.nativeDevice = null;
            this.publish({ status: 'disconnected', device: selected });
          },
          { timeout: 10_000 },
        );
      } catch (cause) {
        throw new BoardTransportError(
          'gatt-connect-failed',
          'Could not connect to the board. Move closer and retry.',
          { cause },
        );
      }
      this.assertCurrent(generation);
      const services = await this.client.getServices(selected.id);
      this.assertCurrent(generation);
      const service = services.find(
        (value) => value.uuid.toLowerCase() === NORDIC_UART_SERVICE_UUID,
      );
      if (!service)
        throw new BoardTransportError(
          'service-not-found',
          'The board control service was not found.',
        );
      const channel = service.characteristics.find(
        (value) => value.uuid.toLowerCase() === NORDIC_UART_RX_CHARACTERISTIC_UUID,
      );
      if (!channel)
        throw new BoardTransportError(
          'characteristic-not-found',
          'The board write channel was not found.',
        );
      const mode = channel.properties.writeWithoutResponse
        ? 'writeWithoutResponse'
        : channel.properties.write
          ? 'write'
          : null;
      if (!mode)
        throw new BoardTransportError(
          'write-not-supported',
          'The board write channel is not supported.',
        );
      this.connection = { device: selected, generation, mode };
      this.publish({ status: 'connected', device: selected });
      return selected;
    } catch (cause) {
      // Retire this attempt before cleanup: iOS emits onDisconnected while
      // resolving disconnect, which must not replace the original failure.
      const failureGeneration = generation === this.generation ? ++this.generation : null;
      this.connection = null;
      // A connect completing after force-disconnect still needs native cleanup.
      let cleanupFailed = false;
      try {
        if (selected) await this.release(selected);
      } catch {
        cleanupFailed = true;
      }
      if (failureGeneration === null || failureGeneration !== this.generation) {
        if (cleanupFailed)
          this.publish({
            status: 'error',
            device: selected,
            error: disconnected(),
          });
        throw disconnected();
      }
      const error =
        cause instanceof BoardTransportError
          ? cause
          : new BoardTransportError(
              messageOf(cause) === 'requestDevice cancelled.'
                ? 'chooser-cancelled'
                : 'device-unavailable',
              messageOf(cause) === 'requestDevice cancelled.'
                ? 'No board was selected.'
                : 'The board could not be accessed. Retry connecting.',
              { cause },
            );
      if (error.code === 'chooser-cancelled')
        this.publish({ status: 'disconnected', device: this.remembered });
      else if (error.code === 'unsupported')
        this.publish({ status: 'unsupported', capability: unavailable });
      else this.publish({ status: 'error', device: this.remembered, error });
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  private release(device: BoardDeviceRef | null): Promise<void> {
    if (!device || !this.client) return this.cleanup;
    const cleanup = this.cleanup.then(async () => {
      await this.client!.disconnect(device.id);
      if (this.nativeDevice === device) this.nativeDevice = null;
    });
    // Keep the serialization barrier usable; the caller still sees failure and
    // nativeDevice remains available for a cleanup retry until confirmed gone.
    this.cleanup = cleanup.catch(() => undefined);
    return cleanup;
  }
  private assertCurrent(generation: number): void {
    if (generation !== this.generation || !this.foreground) throw disconnected();
  }
  private publish(state: BoardTransportState): void {
    this.state = Object.freeze(state);
    for (const listener of [...this.listeners]) listener(this.state);
  }
}

function messageOf(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : typeof cause === 'object' && cause !== null && 'message' in cause
      ? String(cause.message)
      : String(cause);
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(new BoardTransportError('write-failed', 'Board transmission was cancelled.'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}
