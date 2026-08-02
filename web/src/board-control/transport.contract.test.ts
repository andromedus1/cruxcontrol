import { describe, expect, it } from 'vitest';
import { MockBoardByteTransport } from './mock-byte-transport.ts';
import { BoardTransportError, type BoardByteTransport } from './transport.ts';

export function boardByteTransportContract(
  name: string,
  createTransport: () => BoardByteTransport,
): void {
  describe(name, () => {
    it('emits current state immediately and supports unsubscribe', async () => {
      const transport = createTransport();
      const statuses: string[] = [];
      const unsubscribe = transport.subscribe((state) => statuses.push(state.status));
      unsubscribe();
      await transport.requestAndConnect();
      expect(statuses).toEqual(['disconnected']);
    });

    it('connects, writes an ordered batch, disconnects, and reconnects', async () => {
      const transport = createTransport();
      const device = await transport.requestAndConnect();
      await transport.writeBatch([new Uint8Array([1, 2]), new Uint8Array([3])]);
      await transport.disconnect();
      await transport.reconnect(device.id);
      expect(transport.getState().status).toBe('connected');
    });

    it('rejects empty and disconnected writes with stable errors', async () => {
      const transport = createTransport();
      await expect(transport.writeBatch([])).rejects.toMatchObject({ code: 'write-failed' });
      await expect(transport.writeBatch([new Uint8Array([1])])).rejects.toMatchObject({
        code: 'disconnected',
      });
    });
  });
}

boardByteTransportContract('MockBoardByteTransport contract', () => new MockBoardByteTransport());

describe('MockBoardByteTransport evidence and failures', () => {
  it('copies caller bytes both when recording and exposing operations', async () => {
    const transport = new MockBoardByteTransport();
    await transport.requestAndConnect();
    const bytes = new Uint8Array([4, 5]);
    await transport.writeBatch([bytes]);
    bytes[0] = 99;
    const firstRead = transport.operations[1];
    expect(firstRead).toMatchObject({ type: 'write' });
    if (firstRead?.type !== 'write') throw new Error('Expected a write operation');
    expect([...firstRead.chunks[0]!]).toEqual([4, 5]);
    firstRead.chunks[0]![0] = 88;
    const secondRead = transport.operations[1];
    if (secondRead?.type !== 'write') throw new Error('Expected a write operation');
    expect([...secondRead.chunks[0]!]).toEqual([4, 5]);
  });

  it('scripts one-shot failures and remote disconnects', async () => {
    const transport = new MockBoardByteTransport();
    transport.failNext('connect', new BoardTransportError('gatt-connect-failed', 'No connection'));
    await expect(transport.requestAndConnect()).rejects.toMatchObject({
      code: 'gatt-connect-failed',
    });
    await transport.reconnect();
    transport.failNext('write', new BoardTransportError('write-failed', 'No write'));
    await expect(transport.writeBatch([new Uint8Array([1])])).rejects.toMatchObject({
      code: 'write-failed',
    });
    transport.simulateRemoteDisconnect();
    expect(transport.getState().status).toBe('disconnected');
  });

  it('mirrors the real chooser and connection state sequence', async () => {
    const transport = new MockBoardByteTransport();
    const statuses: string[] = [];
    transport.subscribe((state) => statuses.push(state.status));
    await transport.requestAndConnect();
    expect(statuses).toEqual(['disconnected', 'selecting', 'connecting', 'connected']);
  });

  it('represents unsupported capability deterministically', async () => {
    const transport = new MockBoardByteTransport({
      capability: { supported: false, reason: 'api-unavailable' },
    });
    expect(transport.getState().status).toBe('unsupported');
    await expect(transport.getRememberedDevices()).resolves.toEqual([]);
    await expect(transport.requestAndConnect()).rejects.toMatchObject({ code: 'unsupported' });
  });
});
