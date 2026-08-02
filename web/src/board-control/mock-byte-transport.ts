import {
  BoardTransportError,
  freezeDevice,
  type BoardByteTransport,
  type BoardDeviceRef,
  type BoardTransportCapability,
  type BoardTransportListener,
  type BoardTransportState,
  type Unsubscribe,
} from './transport.ts';

export type MockTransportOperation =
  | { readonly type: 'connect'; readonly device: BoardDeviceRef }
  | { readonly type: 'disconnect'; readonly device: BoardDeviceRef | null }
  | { readonly type: 'write'; readonly chunks: readonly Uint8Array[] };

export interface MockByteTransportOptions {
  readonly capability?: BoardTransportCapability;
  readonly devices?: readonly BoardDeviceRef[];
}

export class MockBoardByteTransport implements BoardByteTransport {
  private readonly capability: BoardTransportCapability;
  private readonly devices: readonly BoardDeviceRef[];
  private readonly listeners = new Set<BoardTransportListener>();
  private readonly recorded: MockTransportOperation[] = [];
  private readonly failures: Record<'connect' | 'write', BoardTransportError[]> = {
    connect: [],
    write: [],
  };
  private state: BoardTransportState;

  constructor(options?: MockByteTransportOptions) {
    this.capability = Object.freeze(
      options?.capability?.supported === false
        ? { supported: false, reason: options.capability.reason }
        : { supported: true },
    );
    this.devices = Object.freeze(
      (options?.devices ?? [{ id: 'mock-board', name: 'Mock Kilter Board' }]).map(freezeDevice),
    );
    this.state = this.capability.supported
      ? Object.freeze({ status: 'disconnected', device: null })
      : Object.freeze({ status: 'unsupported', capability: this.capability });
  }

  get operations(): readonly MockTransportOperation[] {
    return Object.freeze(this.recorded.map(copyOperation));
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

  getRememberedDevices(): Promise<readonly BoardDeviceRef[]> {
    if (!this.capability.supported) return Promise.resolve(Object.freeze([]));
    return Promise.resolve(Object.freeze(this.devices.map(freezeDevice)));
  }

  async requestAndConnect(): Promise<BoardDeviceRef> {
    if (this.capability.supported) {
      this.publish(Object.freeze({ status: 'selecting', device: null }));
    }
    return this.connect(this.devices[0]);
  }

  async reconnect(deviceId?: string): Promise<BoardDeviceRef> {
    return this.connect(
      deviceId ? this.devices.find((device) => device.id === deviceId) : this.devices[0],
    );
  }

  async disconnect(): Promise<void> {
    if (this.state.status === 'unsupported' || this.state.status === 'disconnected') return;
    const device = 'device' in this.state ? this.state.device : null;
    if (device) this.publish(Object.freeze({ status: 'disconnecting', device }));
    this.recorded.push(Object.freeze({ type: 'disconnect', device }));
    this.publish(Object.freeze({ status: 'disconnected', device }));
  }

  async writeBatch(chunks: readonly Uint8Array[]): Promise<void> {
    const copies = chunks.map((chunk) => new Uint8Array(chunk));
    if (copies.length === 0) throw new BoardTransportError('write-failed', 'No board data was provided.');
    if (this.state.status !== 'connected') {
      throw new BoardTransportError('disconnected', 'Connect to the board before sending lights.');
    }
    const failure = this.failures.write.shift();
    if (failure) {
      this.publish(Object.freeze({ status: 'error', device: this.state.device, error: failure }));
      throw failure;
    }
    this.recorded.push(
      Object.freeze({ type: 'write', chunks: Object.freeze(copies.map((chunk) => new Uint8Array(chunk))) }),
    );
  }

  failNext(operation: 'connect' | 'write', error: BoardTransportError): void {
    this.failures[operation].push(error);
  }

  simulateRemoteDisconnect(): void {
    const device = 'device' in this.state ? this.state.device : null;
    this.publish(Object.freeze({ status: 'disconnected', device }));
  }

  resetOperations(): void {
    this.recorded.length = 0;
  }

  private async connect(device: BoardDeviceRef | undefined): Promise<BoardDeviceRef> {
    if (!this.capability.supported) {
      throw new BoardTransportError('unsupported', 'This browser does not support board control.', {
        recoverable: false,
      });
    }
    if (!device) {
      const error = new BoardTransportError('device-unavailable', 'The selected board is not available.');
      this.publish(Object.freeze({ status: 'error', device: null, error }));
      throw error;
    }
    const ref = freezeDevice(device);
    this.publish(Object.freeze({ status: 'connecting', device: ref }));
    const failure = this.failures.connect.shift();
    if (failure) {
      this.publish(Object.freeze({ status: 'error', device: ref, error: failure }));
      throw failure;
    }
    this.recorded.push(Object.freeze({ type: 'connect', device: ref }));
    this.publish(Object.freeze({ status: 'connected', device: ref }));
    return ref;
  }

  private publish(state: BoardTransportState): void {
    this.state = state;
    for (const listener of [...this.listeners]) listener(state);
  }
}

function copyOperation(operation: MockTransportOperation): MockTransportOperation {
  if (operation.type === 'write') {
    return Object.freeze({
      type: 'write',
      chunks: Object.freeze(operation.chunks.map((chunk) => new Uint8Array(chunk))),
    });
  }
  if (operation.type === 'connect') {
    return Object.freeze({ type: 'connect', device: freezeDevice(operation.device) });
  }
  return Object.freeze({
    type: 'disconnect',
    device: operation.device ? freezeDevice(operation.device) : null,
  });
}
