import { describe, expect, it, vi } from 'vitest';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { createFullrideLightController } from './light-controller';
import { MockBoardByteTransport } from './mock-byte-transport';
import { BoardTransportError, type DiagnosticWriteOptions } from './transport';

describe('bounded capacity runner', () => {
  it('clears before and after a static case and emits sanitized ordered trace', async () => {
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({
      definition: kilterFullride7x10Definition,
      transport,
    });
    await controller.requestAndConnect();
    const result = await controller.runCapacityCase!({
      apiLevel: 3,
      lightCount: 20,
      requestedFps: 0,
      durationMs: 1,
      interChunkDelayMs: 0,
    });
    expect(result.status).toBe('completed');
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(3);
    expect(result.trace.filter(({ stage }) => stage === 'clear')).toHaveLength(2);
    expect(result.trace.map(({ stage }) => stage)).toEqual(
      expect.arrayContaining([
        'batch-queued',
        'batch-started',
        'chunk-called',
        'chunk-settled',
        'batch-settled',
      ]),
    );
    expect(JSON.stringify(result)).not.toMatch(/mock-board|placement|color|payload|stack/i);
  });

  it('allows only one active capacity case', async () => {
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({
      definition: kilterFullride7x10Definition,
      transport,
    });
    await controller.requestAndConnect();
    const running = controller.runCapacityCase!({
      apiLevel: 3,
      lightCount: 1,
      requestedFps: 1,
      durationMs: 30,
      interChunkDelayMs: 20,
    });
    await expect(
      controller.runCapacityCase!({
        apiLevel: 3,
        lightCount: 1,
        requestedFps: 0,
        durationMs: 1,
        interChunkDelayMs: 0,
      }),
    ).rejects.toThrow(/already running/);
    controller.stopCapacityCase!();
    await expect(running).resolves.toMatchObject({ status: 'cancelled' });
  });

  it('sanitizes transport failures', async () => {
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({
      definition: kilterFullride7x10Definition,
      transport,
    });
    await controller.requestAndConnect();
    transport.failNext(
      'write',
      new BoardTransportError('write-failed', 'secret device and payload details'),
    );
    const result = await controller.runCapacityCase!({
      apiLevel: 3,
      lightCount: 1,
      requestedFps: 0,
      durationMs: 1,
      interChunkDelayMs: 0,
    });
    expect(result.status).toBe('error');
    expect(result.trace.at(-1)).toMatchObject({ stage: 'error', errorCode: 'write-failed' });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('returns on its hard timeout and immediately disconnects a hanging transport', async () => {
    vi.useFakeTimers();
    try {
      const transport = new HangingTransport();
      const controller = createFullrideLightController({
        definition: kilterFullride7x10Definition,
        transport,
      });
      await controller.requestAndConnect();
      const resultPromise = controller.runCapacityCase!({
        apiLevel: 3,
        lightCount: 1,
        requestedFps: 0,
        durationMs: 1,
        interChunkDelayMs: 0,
      });
      await vi.advanceTimersByTimeAsync(6_000);
      await expect(resultPromise).resolves.toMatchObject({ status: 'timeout' });
      expect(transport.getState().status).toBe('disconnected');
    } finally {
      vi.useRealTimers();
    }
  });
});

class HangingTransport extends MockBoardByteTransport {
  override writeBatch(
    _chunks: readonly Uint8Array[],
    _options?: DiagnosticWriteOptions,
  ): Promise<void> {
    return new Promise(() => undefined);
  }
}
