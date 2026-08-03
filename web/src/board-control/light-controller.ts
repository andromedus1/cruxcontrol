import { encodeApiLevel3Scene, type ApiLevel3Light } from './api-level-3-codec.ts';
import { apiLevelForAuroraDeviceName, encodeApiLevel2Scene } from './api-level-2-codec.ts';
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
import type { AuroraApiLevel } from './api-level-2-codec.ts';
import { measuredCapacityProfile } from './capacity-policy.ts';
import {
  summarizeCapacityTrace,
  type CapacityTraceEvent,
  type CapacityTraceSummary,
} from './capacity-trace.ts';

export type LightOperation = 'idle' | 'lighting' | 'clearing' | 'previewing';

export type PreviewResult = { readonly status: 'applied' } | { readonly status: 'superseded' };

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
  runCapacityCase?(testCase: CapacityCase): Promise<CapacityCaseResult>;
  stopCapacityCase?(): void;
}

export interface CapacityCase {
  readonly apiLevel: AuroraApiLevel;
  readonly lightCount: number;
  readonly requestedFps: 0 | 1 | 2 | 4 | 6 | 8 | 10;
  readonly durationMs: number;
  readonly interChunkDelayMs: 0 | 5 | 10 | 20;
}

export interface CapacityCaseResult {
  readonly status: 'completed' | 'cancelled' | 'timeout' | 'error';
  readonly trace: readonly CapacityTraceEvent[];
  readonly summary: CapacityTraceSummary;
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
  let diagnosticAbort: AbortController | null = null;
  let state = freezeState(publicTransportState(options.transport.getState()), 'idle', null, null);

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
    const publicTransport = publicTransportState(transport);
    const operation =
      publicTransport.status === 'disconnected' || publicTransport.status === 'unsupported'
        ? 'idle'
        : state.operation;
    const error = publicTransport.status === 'error' ? publicTransport.error : state.error;
    publish(publicTransport, operation, state.lastAppliedScene, error);
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
      const deviceName =
        state.transport.status === 'connected' ? state.transport.device.name : null;
      const writes =
        apiLevelForAuroraDeviceName(deviceName) === 3
          ? encodeApiLevel3Scene(task.resolved.lights)
          : encodeApiLevel2Scene(task.resolved.lights);
      const apiLevel = apiLevelForAuroraDeviceName(deviceName);
      const capacityProfile = measuredCapacityProfile(apiLevel);
      await options.transport.writeBatch(
        writes,
        capacityProfile
          ? {
              interChunkDelayMs: capacityProfile.safeInterChunkDelayMs,
              signal: new AbortController().signal,
              onEvent: () => undefined,
            }
          : undefined,
      );
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
      publish(
        publicTransportState(options.transport.getState()),
        state.operation,
        state.lastAppliedScene,
        null,
      );
      return device;
    } catch (error) {
      if (error instanceof BoardTransportError) {
        publish(
          publicTransportState(options.transport.getState()),
          'idle',
          state.lastAppliedScene,
          publicTransportError(error),
        );
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
    async runCapacityCase(testCase) {
      if (diagnosticAbort) throw new Error('A board capacity test is already running.');
      if (processing || explicitTasks.length > 0 || pendingPreview) {
        throw new Error('Wait for current board lighting to finish.');
      }
      if (testCase.lightCount > options.definition.placements.length) {
        throw new RangeError(
          `This board has only ${options.definition.placements.length} placements.`,
        );
      }
      const actualApiLevel = apiLevelForAuroraDeviceName(
        state.transport.status === 'connected' ? state.transport.device.name : null,
      );
      if (actualApiLevel !== testCase.apiLevel) {
        throw new Error(`Connected board reports API level ${actualApiLevel}.`);
      }
      const abort = new AbortController();
      diagnosticAbort = abort;
      const trace: CapacityTraceEvent[] = [];
      const startedAt = performance.now();
      const event = (
        stage: CapacityTraceEvent['stage'],
        detail: Omit<CapacityTraceEvent, 'atMs' | 'stage'> = {},
      ) => {
        trace.push(Object.freeze({ atMs: performance.now() - startedAt, stage, ...detail }));
      };
      const onTransportEvent = (entry: CapacityTraceEvent) => {
        trace.push(Object.freeze({ ...entry, atMs: entry.atMs - startedAt }));
      };
      const outcome: { status: CapacityCaseResult['status'] } = { status: 'completed' };
      const deadlineMs = Math.min(60_000, Math.max(1_000, testCase.durationMs + 5_000));
      const timeout = setTimeout(() => {
        outcome.status = 'timeout';
        event('timeout');
        abort.abort();
        options.transport.forceDisconnect();
        event('disconnect');
      }, deadlineMs);
      try {
        await diagnosticWrite([], -1, abort.signal, testCase, event, onTransportEvent);
        event('clear');
        const lights = options.definition.placements
          .slice(0, testCase.lightCount)
          .map((placement) => ({
            ledPosition: placement.native.ledPosition,
            color: 0xff,
          }));
        const periodMs = testCase.requestedFps === 0 ? 0 : 1000 / testCase.requestedFps;
        const animationStartedAt = performance.now();
        const endAt = animationStartedAt + (testCase.requestedFps === 0 ? 0 : testCase.durationMs);
        let frameIndex = 0;
        let alreadyScheduled = false;
        do {
          if (!alreadyScheduled) event('scheduled', { frameIndex });
          alreadyScheduled = false;
          event('rendered', { frameIndex });
          await diagnosticWrite(
            lights,
            frameIndex,
            abort.signal,
            testCase,
            event,
            onTransportEvent,
          );
          frameIndex += 1;
          if (periodMs > 0) {
            let dueAt = animationStartedAt + frameIndex * periodMs;
            while (dueAt <= performance.now() && dueAt < endAt) {
              event('scheduled', { frameIndex });
              alreadyScheduled = true;
              frameIndex += 1;
              dueAt = animationStartedAt + frameIndex * periodMs;
            }
            const waitMs = dueAt - performance.now();
            if (waitMs > 0) await wait(waitMs, abort.signal);
          }
        } while (periodMs > 0 && performance.now() < endAt && !abort.signal.aborted);
        if (abort.signal.aborted && outcome.status !== 'timeout') outcome.status = 'cancelled';
        if (state.transport.status === 'connected') {
          await diagnosticWrite([], frameIndex, abort.signal, testCase, event, onTransportEvent);
          event('clear');
        }
      } catch (error) {
        if (outcome.status !== 'timeout') {
          outcome.status = abort.signal.aborted ? 'cancelled' : 'error';
          event(outcome.status === 'cancelled' ? 'cancelled' : 'error', {
            errorCode: sanitizeErrorCode(error),
          });
        }
      } finally {
        clearTimeout(timeout);
        if (
          state.transport.status === 'connected' &&
          trace.filter(({ stage }) => stage === 'clear').length < 2
        ) {
          const recovery = new AbortController();
          try {
            await diagnosticWrite(
              [],
              Number.MAX_SAFE_INTEGER,
              recovery.signal,
              testCase,
              event,
              onTransportEvent,
            );
            event('clear');
          } catch {
            options.transport.forceDisconnect();
            event('disconnect');
          }
        }
        diagnosticAbort = null;
      }
      return Object.freeze({
        status: outcome.status,
        trace: Object.freeze(trace),
        summary: summarizeCapacityTrace(trace, testCase.requestedFps),
      });
    },
    stopCapacityCase() {
      diagnosticAbort?.abort();
    },
  };

  async function diagnosticWrite(
    lights: readonly ApiLevel3Light[],
    frameIndex: number,
    signal: AbortSignal,
    testCase: CapacityCase,
    event: (
      stage: CapacityTraceEvent['stage'],
      detail?: Omit<CapacityTraceEvent, 'atMs' | 'stage'>,
    ) => void,
    onEvent: (event: CapacityTraceEvent) => void,
  ) {
    const chunks =
      testCase.apiLevel === 3 ? encodeApiLevel3Scene(lights) : encodeApiLevel2Scene(lights);
    event('batch-queued', { frameIndex });
    await Promise.race([
      options.transport.writeBatch(chunks, {
        interChunkDelayMs: testCase.interChunkDelayMs,
        signal,
        onEvent,
        frameIndex,
      }),
      rejectOnAbort(signal),
    ]);
  }
}

function wait(durationMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, durationMs);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Diagnostic cancelled', 'AbortError'));
      },
      { once: true },
    );
  });
}

function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Diagnostic cancelled', 'AbortError'));
      return;
    }
    signal.addEventListener(
      'abort',
      () => reject(new DOMException('Diagnostic cancelled', 'AbortError')),
      { once: true },
    );
  });
}

function sanitizeErrorCode(error: unknown): string {
  if (error instanceof BoardTransportError) return error.code;
  if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
  return 'unknown';
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
  const safe = new BoardTransportError(error.code, error.message, {
    recoverable: error.recoverable,
  });
  return Object.freeze(safe);
}

function publicTransportState(transport: BoardTransportState): BoardTransportState {
  if (transport.status !== 'error') return transport;
  return Object.freeze({
    status: 'error',
    device: transport.device,
    error: publicTransportError(transport.error),
  });
}
