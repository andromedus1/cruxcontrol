import { useCallback, useSyncExternalStore } from 'react';
import type { BoardLightController, BoardLightState } from '../board-control/light-controller';

const unsupportedState: BoardLightState = Object.freeze({
  transport: Object.freeze({
    status: 'unsupported',
    capability: Object.freeze({ supported: false, reason: 'api-unavailable' }),
  }),
  operation: 'idle',
  lastAppliedScene: null,
  error: null,
});

export function useBoardLightState(controller?: BoardLightController | null): BoardLightState {
  const subscribe = useCallback(
    (listener: () => void) => (controller ? controller.subscribe(listener) : () => undefined),
    [controller],
  );
  const getSnapshot = useCallback(
    () => controller?.getState() ?? unsupportedState,
    [controller],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
