export const BOARD_TRANSPORT_ERROR_CODES = [
  'unsupported',
  'insecure-context',
  'chooser-cancelled',
  'chooser-in-progress',
  'device-unavailable',
  'gatt-connect-failed',
  'service-not-found',
  'characteristic-not-found',
  'write-not-supported',
  'write-failed',
  'disconnected',
] as const;

export type BoardTransportErrorCode = (typeof BOARD_TRANSPORT_ERROR_CODES)[number];

export interface BoardDeviceRef {
  readonly id: string;
  readonly name: string | null;
}

export type BoardTransportCapability =
  | { readonly supported: true }
  | {
      readonly supported: false;
      readonly reason: 'insecure-context' | 'api-unavailable';
    };

export type BoardTransportState =
  | {
      readonly status: 'unsupported';
      readonly capability: Extract<BoardTransportCapability, { supported: false }>;
    }
  | { readonly status: 'disconnected'; readonly device: BoardDeviceRef | null }
  | { readonly status: 'selecting'; readonly device: null }
  | { readonly status: 'connecting'; readonly device: BoardDeviceRef }
  | { readonly status: 'connected'; readonly device: BoardDeviceRef }
  | { readonly status: 'disconnecting'; readonly device: BoardDeviceRef }
  | {
      readonly status: 'error';
      readonly device: BoardDeviceRef | null;
      readonly error: BoardTransportError;
    };

export type BoardTransportListener = (state: BoardTransportState) => void;
export type Unsubscribe = () => void;

export class BoardTransportError extends Error {
  readonly code: BoardTransportErrorCode;
  readonly recoverable: boolean;

  constructor(
    code: BoardTransportErrorCode,
    message: string,
    options?: { readonly recoverable?: boolean; readonly cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'BoardTransportError';
    this.code = code;
    this.recoverable = options?.recoverable ?? code !== 'unsupported';
  }
}

export interface BoardByteTransport {
  getCapability(): BoardTransportCapability;
  getState(): BoardTransportState;
  subscribe(listener: BoardTransportListener): Unsubscribe;
  getRememberedDevices(): Promise<readonly BoardDeviceRef[]>;
  requestAndConnect(): Promise<BoardDeviceRef>;
  reconnect(deviceId?: string): Promise<BoardDeviceRef>;
  disconnect(): Promise<void>;
  writeBatch(chunks: readonly Uint8Array[]): Promise<void>;
}

export function freezeDevice(device: BoardDeviceRef): BoardDeviceRef {
  return Object.freeze({ id: device.id, name: device.name });
}

