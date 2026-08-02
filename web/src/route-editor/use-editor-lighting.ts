import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardLightController, BoardLightState } from '../board-control/light-controller';
import type { BoardHoldAssignment } from '../board-renderer/types';
import { lightSceneFromAssignments } from '../climb-browser/light-scene';
import type { BoardDefinition } from '../domain/boards/definition';

const unsupported: BoardLightState = Object.freeze({ transport: { status: 'unsupported' as const, capability: { supported: false as const, reason: 'api-unavailable' as const } }, operation: 'idle', lastAppliedScene: null, error: null });

export function useEditorLighting({ definition, assignments, controller, previewDelayMs = 180 }: { readonly definition: BoardDefinition; readonly assignments: readonly BoardHoldAssignment[]; readonly controller?: BoardLightController | null; readonly previewDelayMs?: number }) {
  const [controllerState, setControllerState] = useState(() => controller?.getState() ?? unsupported);
  const [livePreview, setLivePreviewState] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'lighting' | 'previewing' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const assignmentsRef = useRef(assignments);
  const busyRef = useRef(false);
  const skipNextPreview = useRef(false);
  assignmentsRef.current = assignments;
  useEffect(() => controller?.subscribe(setControllerState), [controller]);
  useEffect(() => {
    if (!livePreview || controllerState.transport.status !== 'connected' || !controller) return;
    if (skipNextPreview.current) { skipNextPreview.current = false; return; }
    const timer = window.setTimeout(() => {
      setStatus('previewing');
      void controller.preview(lightSceneFromAssignments(definition, assignmentsRef.current)).then(() => setStatus('idle')).catch((error: unknown) => { setStatus('error'); setMessage(error instanceof Error ? error.message : 'Could not preview the draft.'); });
    }, previewDelayMs);
    return () => window.clearTimeout(timer);
  }, [assignments, controller, controllerState.transport.status, definition, livePreview, previewDelayMs]);
  const lightDraft = useCallback(async () => {
    if (!controller || busyRef.current) return;
    try {
      busyRef.current = true;
      setMessage(null);
      if (controller.getState().transport.status !== 'connected') { setStatus('connecting'); await controller.requestAndConnect(); }
      setStatus('lighting');
      const scene = lightSceneFromAssignments(definition, assignmentsRef.current);
      if (scene.length === 0) await controller.clear(); else await controller.light(scene);
      setStatus('idle');
    } catch (error) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'Could not light the draft.'); }
    finally { busyRef.current = false; }
  }, [controller, definition]);
  const setLivePreview = (enabled: boolean) => {
    if (enabled && controllerState.transport.status !== 'connected') return;
    if (enabled && controller) {
      skipNextPreview.current = true;
      setStatus('previewing');
      void controller.preview(lightSceneFromAssignments(definition, assignmentsRef.current)).then(() => setStatus('idle')).catch((error: unknown) => { setStatus('error'); setMessage(error instanceof Error ? error.message : 'Could not preview the draft.'); });
    }
    setLivePreviewState(enabled);
  };
  return { controllerState, livePreview, status, message, setLivePreview, lightDraft };
}
