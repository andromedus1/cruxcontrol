import { useCallback, useEffect, useRef, useState } from 'react';
import { apiLevelForAuroraDeviceName } from '../board-control/api-level-2-codec';
import type { BoardLightController, BoardLightState } from '../board-control/light-controller';
import type { BoardHoldAssignment, LightEffectGroup } from '../board-renderer/types';
import { lightSceneFromAssignments } from '../climb-browser/light-scene';
import type { BoardDefinition } from '../domain/boards/definition';
import { renderAnimationFrame } from '../light-effects/frame';

const unsupported: BoardLightState = Object.freeze({
  transport: {
    status: 'unsupported' as const,
    capability: { supported: false as const, reason: 'api-unavailable' as const },
  },
  operation: 'idle',
  lastAppliedScene: null,
  error: null,
});

export function useEditorLighting({
  definition,
  assignments,
  effectGroups = [],
  controller,
  previewDelayMs = 180,
}: {
  readonly definition: BoardDefinition;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly effectGroups?: readonly LightEffectGroup[];
  readonly controller?: BoardLightController | null;
  readonly previewDelayMs?: number;
}) {
  const [controllerState, setControllerState] = useState(
    () => controller?.getState() ?? unsupported,
  );
  const [livePreview, setLivePreviewState] = useState(false);
  const [animationRunning, setAnimationRunning] = useState(false);
  const [explicitStatus, setExplicitStatus] = useState<'idle' | 'connecting' | 'lighting'>('idle');
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'previewing' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const assignmentsRef = useRef(assignments);
  const effectGroupsRef = useRef(effectGroups);
  const busyRef = useRef(false);
  const skipNextPreview = useRef(false);
  const previewSequence = useRef(0);
  const animationSequence = useRef(0);
  const animationTimer = useRef<number | null>(null);
  const mounted = useRef(true);
  assignmentsRef.current = assignments;
  effectGroupsRef.current = effectGroups;

  useEffect(() => controller?.subscribe(setControllerState), [controller]);

  const cancelAnimation = useCallback(() => {
    animationSequence.current += 1;
    if (animationTimer.current !== null) window.clearTimeout(animationTimer.current);
    animationTimer.current = null;
    if (mounted.current) setAnimationRunning(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      cancelAnimation();
      mounted.current = false;
    };
  }, [cancelAnimation]);

  const staticScene = useCallback(
    () => lightSceneFromAssignments(definition, assignmentsRef.current),
    [definition],
  );

  const preview = useCallback(async () => {
    if (!controller) return;
    const sequence = ++previewSequence.current;
    setMessage(null);
    setPreviewStatus('previewing');
    try {
      await controller.preview(staticScene());
      if (mounted.current && previewSequence.current === sequence) setPreviewStatus('idle');
    } catch (error) {
      if (mounted.current && previewSequence.current === sequence) {
        setPreviewStatus('error');
        setMessage(error instanceof Error ? error.message : 'Could not preview the draft.');
      }
    }
  }, [controller, staticScene]);

  useEffect(() => {
    if (controllerState.transport.status === 'connected' || !livePreview) return;
    setLivePreviewState(false);
  }, [controllerState.transport.status, livePreview]);

  useEffect(() => {
    if (controllerState.transport.status === 'connected') return;
    cancelAnimation();
  }, [cancelAnimation, controllerState.transport.status]);

  useEffect(() => {
    if (controllerState.operation === 'clearing') cancelAnimation();
  }, [cancelAnimation, controllerState.operation]);

  useEffect(() => {
    if (animationRunning && controllerState.lastAppliedScene?.length === 0) cancelAnimation();
  }, [animationRunning, cancelAnimation, controllerState.lastAppliedScene]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) cancelAnimation();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [cancelAnimation]);

  useEffect(() => {
    if (
      !livePreview ||
      animationRunning ||
      controllerState.transport.status !== 'connected' ||
      !controller
    )
      return;
    if (skipNextPreview.current) {
      skipNextPreview.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void preview();
    }, previewDelayMs);
    return () => window.clearTimeout(timer);
  }, [
    assignments,
    effectGroups,
    animationRunning,
    controller,
    controllerState.transport.status,
    livePreview,
    preview,
    previewDelayMs,
  ]);

  const startAnimation = useCallback(
    (startedAt: number) => {
      if (!controller) return;
      const transport = controller.getState().transport;
      if (transport.status !== 'connected') return;
      const delayMs = apiLevelForAuroraDeviceName(transport.device.name) === 2 ? 167 : 100;
      const sequence = ++animationSequence.current;
      setAnimationRunning(true);

      const tick = async () => {
        if (
          !mounted.current ||
          animationSequence.current !== sequence ||
          controller.getState().transport.status !== 'connected'
        )
          return;
        const frame = renderAnimationFrame({
          definition,
          assignments: assignmentsRef.current,
          effectGroups: effectGroupsRef.current,
          elapsedMs: performance.now() - startedAt,
        });
        try {
          await controller.preview(frame);
        } catch (error) {
          if (mounted.current && animationSequence.current === sequence) {
            setMessage(error instanceof Error ? error.message : 'Could not animate the draft.');
            setPreviewStatus('error');
            cancelAnimation();
          }
          return;
        }
        if (mounted.current && animationSequence.current === sequence) {
          animationTimer.current = window.setTimeout(() => void tick(), delayMs);
        }
      };
      animationTimer.current = window.setTimeout(() => void tick(), delayMs);
    },
    [cancelAnimation, controller, definition],
  );

  const lightDraft = useCallback(async () => {
    if (!controller || busyRef.current) return;
    try {
      busyRef.current = true;
      cancelAnimation();
      previewSequence.current += 1;
      setMessage(null);
      setPreviewStatus('idle');
      if (controller.getState().transport.status !== 'connected') {
        setExplicitStatus('connecting');
        await controller.requestAndConnect();
      }
      setExplicitStatus('lighting');
      const groupIds = new Set(effectGroupsRef.current.map(({ id }) => id));
      const animated = assignmentsRef.current.some(
        ({ effectGroupId }) => effectGroupId !== undefined && groupIds.has(effectGroupId),
      );
      const startedAt = performance.now();
      const scene = animated
        ? renderAnimationFrame({
            definition,
            assignments: assignmentsRef.current,
            effectGroups: effectGroupsRef.current,
            elapsedMs: 0,
          })
        : staticScene();
      if (scene.length === 0) await controller.clear();
      else await controller.light(scene);
      if (animated) startAnimation(startedAt);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not light the draft.');
    } finally {
      busyRef.current = false;
      if (mounted.current) setExplicitStatus('idle');
    }
  }, [cancelAnimation, controller, definition, startAnimation, staticScene]);

  const stopAnimation = useCallback(async () => {
    cancelAnimation();
    if (!controller || controller.getState().transport.status !== 'connected') return;
    try {
      setExplicitStatus('lighting');
      const scene = staticScene();
      if (scene.length === 0) await controller.clear();
      else await controller.light(scene);
      if (mounted.current) setMessage(null);
    } catch (error) {
      if (mounted.current) {
        setMessage(error instanceof Error ? error.message : 'Could not stop the animation.');
      }
    } finally {
      if (mounted.current) setExplicitStatus('idle');
    }
  }, [cancelAnimation, controller, staticScene]);

  const setLivePreview = (enabled: boolean) => {
    if (enabled) {
      if (animationRunning || controllerState.transport.status !== 'connected' || !controller)
        return;
      skipNextPreview.current = true;
      setLivePreviewState(true);
      void preview();
      return;
    }
    previewSequence.current += 1;
    setLivePreviewState(false);
    setPreviewStatus('idle');
  };
  const status =
    explicitStatus !== 'idle'
      ? explicitStatus
      : previewStatus === 'error' || message
        ? 'error'
        : previewStatus;

  return {
    controllerState,
    livePreview,
    animationRunning,
    status,
    message,
    setLivePreview,
    lightDraft,
    stopAnimation,
  };
}
