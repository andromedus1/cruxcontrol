import { encodeApiLevel3Scene, type ApiLevel3Light } from './api-level-3-codec.ts';
import {
  BoardTransportError,
  type BoardByteTransport,
  type BoardDeviceRef,
  type BoardTransportState,
  type Unsubscribe,
} from './transport.ts';
import type { BoardDefinition } from '../domain/boards/definition.ts';
import type { LightScene } from '../domain/boards/light-scene.ts';
import type { BoardPlacementId } from '../domain/boards/types.ts';
import { assertBoardDefinition } from '../domain/boards/validate-definition.ts';

export type LightOperation = 'idle' | 'lighting' | 'clearing' | 'previewing';

export type PreviewResult =
  | { readonly status: 'applied' }
  | { readonly status: 'superseded' };

export interface BoardLightState {
  readonly transport: BoardTransportState;
  readonly operation: LightOperation;
  readonly lastAppliedScene: LightScene | null;
  readonly error: BoardTransportError | null;
}

export type BoardLightListener = (state: BoardLightState) => void;

export interface BoardLightController {
  getState(): BoardLightState;
  subscribe(listener: BoardLightListener): Unsubscribe;
  requestAndConnect(): Promise<BoardDeviceRef>;
  reconnect(deviceId?: string): Promise<BoardDeviceRef>;
  disconnect(): Promise<void>;
  light(scene: LightScene): Promise<void>;
  clear(): Promise<void>;
  preview(scene: LightScene): Promise<PreviewResult>;
}

export interface FullrideLightControllerOptions {
  readonly definition: BoardDefinition;
  readonly transport: BoardByteTransport;
}

interface ResolvedScene {
  readonly scene: LightScene;
  readonly lights: readonly ApiLevel3Light[];
}

interface ExplicitTask {
  readonly operation: 'lighting' | 'clearing';
  readonly resolved: ResolvedScene;
  readonly resolve: () => void;
  readonly reject: (reason: unknown) => void;
}

interface PreviewTask {
  readonly resolved: ResolvedScene;
  readonly resolve: (result: PreviewResult) => void;
  readonly reject: (reason: unknown) => void;
}

const APPLIED = Object.freeze({ status: 'applied' } as const);
const SUPERSEDED = Object.freeze({ status: 'superseded' } as const);

export function createFullrideLightController(
  options: FullrideLightControllerOptions,
): BoardLightController {
  assertBoardDefinition(options.definition);
  options.definition.placements.forEach((placement, index) => {
    if (placement.native.ledPosition > 0xffff) {
      throw new RangeError(
        `Definition placement index ${index} LED position must be at most 65535; received ${placement.native.ledPosition}`,
      );
    }
  });
  const ledPositions = new Map<BoardPlacementId, number>(
    options.definition.placements.map((placement) => [placement.id, placement.native.ledPosition]),
  );
  const listeners = new Set<BoardLightListener>();
  const explicitTasks: ExplicitTask[] = [];
  let pendingPreview: PreviewTask | null = null;
  let processing = false;
  let state = freezeState(options.transport.getState(), 'idle', null, null);

  const publish = (
    transport = state.transport,
    operation = state.operation,
    lastAppliedScene = state.lastAppliedScene,
    error = state.error,
  ) => {
    state = freezeState(transport, operation, lastAppliedScene, error);
    for (const listener of [...listeners]) listener(state);
  };

  options.transport.subscribe((transport) => {
    const operation =
      transport.status === 'disconnected' || transport.status === 'unsupported'
        ? 'idle'
        : state.operation;
    const error = transport.status === 'error' ? publicTransportError(transport.error) : state.error;
    publish(transport, operation, state.lastAppliedScene, error);
  });

  const resolveScene = (scene: LightScene): ResolvedScene => {
    const indexes = new Map<BoardPlacementId, number>();
    const frozenScene = Object.freeze(
      scene.map((entry, index) => {
        const ledPosition = ledPositions.get(entry.placementId);
        if (ledPosition === undefined) {
          throw new Error(`Unknown board placement ${entry.placementId} at scene index ${index}`);
        }
        const priorIndex = indexes.get(entry.placementId);
        if (priorIndex !== undefined) {
          throw new Error(
            `Duplicate board placement ${entry.placementId} at scene indexes ${priorIndex} and ${index}`,
          );
        }
        if (!Number.isInteger(entry.color) || entry.color < 0 || entry.color > 0xff) {
          throw new RangeError(`Scene index ${index} color must be an integer from 0 to 255`);
        }
        indexes.set(entry.placementId, index);
        return Object.freeze({ placementId: entry.placementId, color: entry.color });
      }),
    );
    const lights = Object.freeze(
      frozenScene.map((entry) =>
        Object.freeze({ ledPosition: ledPositions.get(entry.placementId)!, color: entry.color }),
      ),
    );
    return Object.freeze({ scene: frozenScene, lights });
  };

  const apply = async (task: ExplicitTask | PreviewTask, operation: LightOperation) => {
    publish(state.transport, operation, state.lastAppliedScene, null);
    try {
      await options.transport.writeBatch(encodeApiLevel3Scene(task.resolved.lights));
      publish(state.transport, 'idle', task.resolved.scene, null);
      if ('operation' in task) task.resolve();
      else task.resolve(APPLIED);
    } catch (error) {
      if (error instanceof BoardTransportError) {
        publish(state.transport, 'idle', state.lastAppliedScene, publicTransportError(error));
      } else {
        publish(state.transport, 'idle', state.lastAppliedScene, state.error);
      }
      task.reject(error);
    }
  };

  const pump = async () => {
    if (processing) return;
    processing = true;
    try {
      while (explicitTasks.length > 0 || pendingPreview) {
        const explicit = explicitTasks.shift();
        if (explicit) {
          await apply(explicit, explicit.operation);
          continue;
        }
        const preview = pendingPreview;
        pendingPreview = null;
        if (preview) await apply(preview, 'previewing');
      }
    } finally {
      processing = false;
      if (explicitTasks.length > 0 || pendingPreview) void pump();
    }
  };

  const enqueueExplicit = (
    operation: ExplicitTask['operation'],
    resolved: ResolvedScene,
  ): Promise<void> => {
    if (pendingPreview) {
      pendingPreview.resolve(SUPERSEDED);
      pendingPreview = null;
    }
    return new Promise<void>((resolve, reject) => {
      explicitTasks.push({ operation, resolved, resolve, reject });
      void pump();
    });
  };

  const connect = async (operation: () => Promise<BoardDeviceRef>) => {
    try {
      const device = await operation();
      publish(options.transport.getState(), state.operation, state.lastAppliedScene, null);
      return device;
    } catch (error) {
      if (error instanceof BoardTransportError) {
        publish(options.transport.getState(), 'idle', state.lastAppliedScene, publicTransportError(error));
      }
      throw error;
    }
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    requestAndConnect: () => connect(() => options.transport.requestAndConnect()),
    reconnect: (deviceId) => connect(() => options.transport.reconnect(deviceId)),
    async disconnect() {
      if (pendingPreview) {
        pendingPreview.resolve(SUPERSEDED);
        pendingPreview = null;
      }
      await options.transport.disconnect();
    },
    light(scene) {
      return enqueueExplicit('lighting', resolveScene(scene));
    },
    clear() {
      return enqueueExplicit('clearing', resolveScene([]));
    },
    preview(scene) {
      const resolved = resolveScene(scene);
      if (pendingPreview) pendingPreview.resolve(SUPERSEDED);
      return new Promise<PreviewResult>((resolve, reject) => {
        pendingPreview = { resolved, resolve, reject };
        void pump();
      });
    },
  };
}

function freezeState(
  transport: BoardTransportState,
  operation: LightOperation,
  lastAppliedScene: LightScene | null,
  error: BoardTransportError | null,
): BoardLightState {
  return Object.freeze({ transport, operation, lastAppliedScene, error });
}

function publicTransportError(error: BoardTransportError): BoardTransportError {
  const safe = new BoardTransportError(error.code, error.message, { recoverable: error.recoverable });
  return Object.freeze(safe);
}
