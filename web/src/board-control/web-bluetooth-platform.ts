export interface BluetoothRemoteGattCharacteristicLike {
  readonly properties?: {
    readonly writeWithoutResponse?: boolean;
    readonly write?: boolean;
  };
  writeValueWithoutResponse?(value: ArrayBufferView): Promise<void>;
  writeValueWithResponse?(value: ArrayBufferView): Promise<void>;
}

export interface BluetoothRemoteGattServiceLike {
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGattCharacteristicLike>;
}

export interface BluetoothRemoteGattServerLike {
  readonly connected: boolean;
  connect(): Promise<BluetoothRemoteGattServerLike>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGattServiceLike>;
}

export interface BluetoothDeviceLike {
  readonly id: string;
  readonly name?: string | null;
  readonly gatt?: BluetoothRemoteGattServerLike;
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void;
}

export interface BluetoothRequestDeviceOptionsLike {
  readonly filters: readonly { readonly services: readonly string[] }[];
  readonly optionalServices: readonly string[];
}

export interface BluetoothNavigatorLike {
  requestDevice(options: BluetoothRequestDeviceOptionsLike): Promise<BluetoothDeviceLike>;
  getDevices?(): Promise<readonly BluetoothDeviceLike[]>;
}

export interface WebBluetoothPlatform {
  readonly isSecureContext: boolean;
  readonly bluetooth?: BluetoothNavigatorLike;
}

export function getBrowserBluetoothPlatform(): WebBluetoothPlatform {
  const browser = globalThis as typeof globalThis & {
    readonly navigator?: { readonly bluetooth?: BluetoothNavigatorLike };
    readonly isSecureContext?: boolean;
  };
  return {
    isSecureContext: browser.isSecureContext === true,
    bluetooth: browser.navigator?.bluetooth,
  };
}
