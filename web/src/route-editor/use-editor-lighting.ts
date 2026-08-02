import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardLightController, BoardLightState } from '../board-control/light-controller';
import type { BoardHoldAssignment } from '../board-renderer/types';
import { lightSceneFromAssignments } from '../climb-browser/light-scene';
import type { BoardDefinition } from '../domain/boards/definition';

const unsupported: BoardLightState = Object.freeze({ transport: { status: 'unsupported' as const, capability: { supported: false as const, reason: 'api-unavailable' as const } }, operation: 'idle', lastAppliedScene: null, error: null });

export function useEditorLighting({ definition, assignments, controller, previewDelayMs = 180 }: { readonly definition: BoardDefinition; readonly assignments: readonly BoardHoldAssignment[]; readonly controller?: BoardLightController | null; readonly previewDelayMs?: number }) {
  const [controllerState, setControllerState] = useState(() => controller?.getState() ?? unsupported);
  const [livePreview, setLivePreviewState] = useState(false);
  const [explicitStatus, setExplicitStatus] = useState<'idle' | 'connecting' | 'lighting'>('idle');
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'previewing' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const assignmentsRef = useRef(assignments);
  const busyRef = useRef(false);
  const skipNextPreview = useRef(false);
  const previewSequence = useRef(0);
  const mounted = useRef(true);
  assignmentsRef.current = assignments;
  useEffect(() => controller?.subscribe(setControllerState), [controller]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const preview = useCallback(async () => {
    if (!controller) return;
    const sequence = ++previewSequence.current;
    setMessage(null);
    setPreviewStatus('previewing');
    try {
      await controller.preview(lightSceneFromAssignments(definition, assignmentsRef.current));
      if (mounted.current && previewSequence.current === sequence) setPreviewStatus('idle');
    } catch (error) {
      if (mounted.current && previewSequence.current === sequence) {
        setPreviewStatus('error');
        setMessage(error instanceof Error ? error.message : 'Could not preview the draft.');
      }
    }
  }, [controller, definition]);

  useEffect(() => {
    if (controllerState.transport.status === 'connected' || !livePreview) return;
    setLivePreviewState(false);
  }, [controllerState.transport.status, livePreview]);

  useEffect(() => {
    if (!livePreview || controllerState.transport.status !== 'connected' || !controller) return;
    if (skipNextPreview.current) { skipNextPreview.current = false; return; }
    const timer = window.setTimeout(() => {
      void preview();
    }, previewDelayMs);
    return () => window.clearTimeout(timer);
  }, [assignments, controller, controllerState.transport.status, livePreview, preview, previewDelayMs]);
  const lightDraft = useCallback(async () => {
    if (!controller || busyRef.current) return;
    try {
      busyRef.current = true;
      previewSequence.current += 1;
      setMessage(null);
      setPreviewStatus('idle');
      if (controller.getState().transport.status !== 'connected') { setExplicitStatus('connecting'); await controller.requestAndConnect(); }
      setExplicitStatus('lighting');
      const scene = lightSceneFromAssignments(definition, assignmentsRef.current);
      if (scene.length === 0) await controller.clear(); else await controller.light(scene);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not light the draft.');
    } finally {
      busyRef.current = false;
      if (mounted.current) setExplicitStatus('idle');
    }
  }, [controller, definition]);
  const setLivePreview = (enabled: boolean) => {
    if (enabled) {
      if (controllerState.transport.status !== 'connected' || !controller) return;
      skipNextPreview.current = true;
      setLivePreviewState(true);
      void preview();
      return;
    }
    previewSequence.current += 1;
    setLivePreviewState(false);
    setPreviewStatus('idle');
  };
  const status = explicitStatus !== 'idle'
    ? explicitStatus
    : previewStatus === 'error' || message
      ? 'error'
      : previewStatus;
  return { controllerState, livePreview, status, message, setLivePreview, lightDraft };
}
