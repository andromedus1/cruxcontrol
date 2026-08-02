import type { WebBluetoothTransportConfig } from './web-bluetooth-transport.ts';

export const AURORA_ADVERTISEMENT_SERVICE_UUID = '4488b571-7806-4df6-bcff-a2897e4953ff';
export const NORDIC_UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const NORDIC_UART_RX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

export const AURORA_WEB_BLUETOOTH_CONFIG: WebBluetoothTransportConfig = Object.freeze({
  requestOptions: Object.freeze({
    filters: Object.freeze([
      Object.freeze({ services: Object.freeze([AURORA_ADVERTISEMENT_SERVICE_UUID]) }),
    ]),
    optionalServices: Object.freeze([NORDIC_UART_SERVICE_UUID]),
  }),
  primaryServiceUuid: NORDIC_UART_SERVICE_UUID,
  writeCharacteristicUuid: NORDIC_UART_RX_CHARACTERISTIC_UUID,
});

