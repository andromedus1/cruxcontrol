import { describe, expect, it, vi } from 'vitest';
import { encodeApiLevel3Scene } from './api-level-3-codec.ts';
import { createFullrideLightController } from './light-controller.ts';
import { MockBoardByteTransport } from './mock-byte-transport.ts';
import { BoardTransportError } from './transport.ts';
import { apiLevel3Color } from '../domain/boards/colors.ts';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10.ts';
import { sceneFromRoles, type LightScene } from '../domain/boards/light-scene.ts';
import { boardPlacementId } from '../domain/boards/identity.ts';

const definition = kilterFullride7x10Definition;
const first = definition.placements[0];
const last = definition.placements.at(-1)!;

function customScene(...values: number[]): LightScene {
  if (values.length % 2 !== 0) throw new Error('Custom scene values must be index/color pairs');
  const entries = Array.from(
    { length: values.length / 2 },
    (_, index) => [values[index * 2], values[index * 2 + 1]] as const,
  );
  return Object.freeze(
    entries.map(([placementIndex, color]) =>
      Object.freeze({
        placementId: definition.placements[placementIndex].id,
        color: apiLevel3Color(color),
      }),
    ),
  );
}

function writeOperations(transport: MockBoardByteTransport) {
  return transport.operations.filter((operation) => operation.type === 'write');
}

function expectedWrites(scene: LightScene): readonly Uint8Array[] {
  return encodeApiLevel3Scene(
    scene.map((entry) => ({
      ledPosition: definition.placements.find((placement) => placement.id === entry.placementId)!
        .native.ledPosition,
      color: entry.color,
    })),
  );
}

describe('sceneFromRoles', () => {
  it('maps all four semantic roles to their generated Fullride colors', () => {
    const roles = ['start', 'middle', 'finish', 'foot-only'] as const;
    const scene = sceneFromRoles(
      definition,
      roles.map((role, index) => ({ placementId: definition.placements[index].id, role })),
    );

    expect(scene.map((entry) => entry.color)).toEqual(
      roles.map((role) => definition.rolePresets[role].lightColor),
    );
    expect(scene.map((entry) => entry.color)).toEqual([0x1c, 0x1f, 0xe3, 0xf4]);
    expect(Object.isFrozen(scene)).toBe(true);
    expect(scene.every(Object.isFrozen)).toBe(true);
  });

  it('allows empty and unconventional role combinations', () => {
    expect(sceneFromRoles(definition, [])).toEqual([]);
    expect(
      sceneFromRoles(definition, [
        { placementId: first.id, role: 'finish' },
        { placementId: last.id, role: 'finish' },
      ]),
    ).toHaveLength(2);
  });

  it('rejects unknown and duplicate placements with their indexes', () => {
    expect(() =>
      sceneFromRoles(definition, [{ placementId: boardPlacementId('unknown'), role: 'start' }]),
    ).toThrow(/Unknown board placement unknown.*index 0/);
    expect(() =>
      sceneFromRoles(definition, [
        { placementId: first.id, role: 'start' },
        { placementId: first.id, role: 'middle' },
      ]),
    ).toThrow(/indexes 0 and 1/);
  });
});

describe('Fullride light controller', () => {
  it('fails fast when a definition cannot be encoded by the API-level-3 codec', () => {
    const placements = definition.placements.map((placement, index) =>
      index === 0
        ? { ...placement, native: { ...placement.native, ledPosition: 0x10000 } }
        : placement,
    );
    expect(() =>
      createFullrideLightController({
        definition: { ...definition, placements },
        transport: new MockBoardByteTransport(),
      }),
    ).toThrow(/LED position must be at most 65535/);
  });

  it('composes placement IDs and arbitrary bytes through the real codec and mock transport', async () => {
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({ definition, transport });
    await controller.requestAndConnect();
    const scene = customScene(0, 0x00, 1, 0xff, 2, 0x55, 3, 0xaa);

    await controller.light(scene);

    expect(writeOperations(transport)).toHaveLength(1);
    expect(writeOperations(transport)[0].chunks).toEqual(expectedWrites(scene));
    expect(controller.getState()).toMatchObject({ operation: 'idle', error: null });
    expect(controller.getState().lastAppliedScene).toEqual(scene);
    expect(controller.getState().lastAppliedScene).not.toBe(scene);
    expect(Object.isFrozen(controller.getState())).toBe(true);
    expect(Object.isFrozen(controller.getState().lastAppliedScene)).toBe(true);
  });

  it('uses API level 2 when the connected controller name has no API suffix', async () => {
    const transport = new MockBoardByteTransport({
      devices: [{ id: 'physical-controller-shape', name: 'Kilter Board' }],
    });
    const controller = createFullrideLightController({ definition, transport });
    await controller.requestAndConnect();

    await controller.light(customScene(0, 0xff));

    expect(writeOperations(transport)[0].chunks).toEqual([
      new Uint8Array([0x01, 0x03, 0xb3, 0x02, 0x50, 0x00, 0xfc, 0x03]),
    ]);
  });

  it('sends a 305-placement scene as one ordered multi-write batch', async () => {
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({ definition, transport });
    await controller.requestAndConnect();
    const scene = Object.freeze(
      definition.placements.map((placement, index) =>
        Object.freeze({ placementId: placement.id, color: apiLevel3Color(index % 256) }),
      ),
    );

    await controller.light(scene);

    const writes = writeOperations(transport);
    expect(scene.length).toBe(305);
    expect(writes).toHaveLength(1);
    expect(writes[0].chunks.length).toBeGreaterThan(1);
    expect(writes[0].chunks).toEqual(expectedWrites(scene));
  });

  it('treats light([]) and clear as explicit codec clear batches', async () => {
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({ definition, transport });
    await controller.requestAndConnect();

    await controller.light([]);
    await controller.clear();

    const clear = encodeApiLevel3Scene([]);
    expect(writeOperations(transport).map((operation) => operation.chunks)).toEqual([clear, clear]);
    expect(controller.getState().lastAppliedScene).toEqual([]);
  });

  it('rejects invalid scenes without writing or changing operation state', async () => {
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({ definition, transport });
    await controller.requestAndConnect();
    const duplicate = [
      { placementId: first.id, color: apiLevel3Color(1) },
      { placementId: first.id, color: apiLevel3Color(2) },
    ];

    expect(() => controller.light(duplicate)).toThrow(/indexes 0 and 1/);
    expect(() =>
      controller.light([{ placementId: boardPlacementId('unknown'), color: apiLevel3Color(1) }]),
    ).toThrow(/Unknown board placement/);
    expect(writeOperations(transport)).toHaveLength(0);
    expect(controller.getState().operation).toBe('idle');
  });

  it('retains the last successful scene and publishes safe transport errors', async () => {
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({ definition, transport });
    await controller.requestAndConnect();
    const scene = customScene(0, 0x42);
    await controller.light(scene);
    const cause = new Error('browser diagnostic secret');
    transport.failNext(
      'write',
      new BoardTransportError('write-failed', 'The board write failed.', { cause }),
    );

    await expect(controller.light(customScene(1, 0x43))).rejects.toMatchObject({
      code: 'write-failed',
    });
    expect(controller.getState().lastAppliedScene).toEqual(scene);
    expect(controller.getState().error).toMatchObject({
      code: 'write-failed',
      message: 'The board write failed.',
    });
    expect(controller.getState().error?.cause).toBeUndefined();
    expect(Object.isFrozen(controller.getState().error)).toBe(true);
    const transportState = controller.getState().transport;
    expect(transportState).toMatchObject({ status: 'error' });
    if (transportState.status !== 'error') {
      throw new Error('Expected the transport error state to remain visible');
    }
    expect(transportState.error.cause).toBeUndefined();
    expect(Object.isFrozen(transportState.error)).toBe(true);
  });

  it('republishes connection lifecycle and recovers after disconnect and reconnect', async () => {
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({ definition, transport });
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    await controller.requestAndConnect();
    await controller.light(customScene(0, 0x22));
    transport.simulateRemoteDisconnect();

    expect(controller.getState()).toMatchObject({
      operation: 'idle',
      transport: { status: 'disconnected' },
    });
    expect(controller.getState().lastAppliedScene).toEqual(customScene(0, 0x22));
    await controller.reconnect();
    await controller.light(customScene(1, 0x23));
    expect(writeOperations(transport)).toHaveLength(2);
    unsubscribe();
    const calls = listener.mock.calls.length;
    transport.simulateRemoteDisconnect();
    expect(listener).toHaveBeenCalledTimes(calls);
  });

  it('records disconnected writes as stable errors', async () => {
    const controller = createFullrideLightController({
      definition,
      transport: new MockBoardByteTransport(),
    });
    await expect(controller.light(customScene(0, 1))).rejects.toMatchObject({
      code: 'disconnected',
    });
    expect(controller.getState().error?.code).toBe('disconnected');
  });
});

describe('preview arbitration', () => {
  it('retains only the latest preview and gives explicit operations priority', async () => {
    const transport = new FirstWriteGateTransport();
    const controller = createFullrideLightController({ definition, transport });
    await controller.requestAndConnect();
    const firstPreview = controller.preview(customScene(0, 1));
    await transport.firstWriteStarted;
    const replaced = controller.preview(customScene(1, 2));
    const newestBeforeClear = controller.preview(customScene(2, 3));
    const clear = controller.clear();
    const laterPreview = controller.preview(customScene(3, 4));

    await expect(replaced).resolves.toEqual({ status: 'superseded' });
    await expect(newestBeforeClear).resolves.toEqual({ status: 'superseded' });
    transport.releaseFirstWrite();
    await expect(firstPreview).resolves.toEqual({ status: 'applied' });
    await clear;
    await expect(laterPreview).resolves.toEqual({ status: 'applied' });

    expect(writeOperations(transport).map((operation) => operation.chunks)).toEqual([
      expectedWrites(customScene(0, 1)),
      encodeApiLevel3Scene([]),
      expectedWrites(customScene(3, 4)),
    ]);
  });

  it('rejects a failed active preview and safely settles the retained latest frame', async () => {
    const transport = new FirstWriteGateTransport();
    const controller = createFullrideLightController({ definition, transport });
    await controller.requestAndConnect();
    transport.failNext('write', new BoardTransportError('write-failed', 'Preview failed.'));
    const failed = controller.preview(customScene(0, 1));
    await transport.firstWriteStarted;
    const retained = controller.preview(customScene(1, 2));
    transport.releaseFirstWrite();

    await expect(failed).rejects.toMatchObject({ code: 'write-failed' });
    await expect(retained).rejects.toMatchObject({ code: 'disconnected' });
    expect(controller.getState().lastAppliedScene).toBeNull();
    expect(controller.getState().error?.code).toBe('disconnected');
  });
});

class FirstWriteGateTransport extends MockBoardByteTransport {
  private release!: () => void;
  private started!: () => void;
  private readonly gate = new Promise<void>((resolve) => {
    this.release = resolve;
  });
  readonly firstWriteStarted = new Promise<void>((resolve) => {
    this.started = resolve;
  });
  private isFirstWrite = true;

  override async writeBatch(chunks: readonly Uint8Array[]): Promise<void> {
    if (this.isFirstWrite) {
      this.isFirstWrite = false;
      this.started();
      await this.gate;
    }
    await super.writeBatch(chunks);
  }

  releaseFirstWrite(): void {
    this.release();
  }
}
