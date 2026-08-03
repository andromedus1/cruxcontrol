import { useCallback, useEffect, useRef, useState } from 'react';
import { apiLevelForAuroraDeviceName } from '../board-control/api-level-2-codec';
import type { BoardLightController, BoardLightState } from '../board-control/light-controller';
import type { BoardHoldAssignment, LightEffectGroup } from '../board-renderer/types';
import { lightSceneFromAssignments } from '../climb-browser/light-scene';
import type { BoardDefinition } from '../domain/boards/definition';
import { renderAnimationFrame } from '../light-effects/frame';
import {
  assessStaticScene,
  capacityCostLabel,
  chooseAnimationSchedule,
  measuredCapacityProfile,
} from '../board-control/capacity-policy';
import { encodedSceneCost } from '../board-control/capacity-model';

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
  const [effectiveAnimationFps, setEffectiveAnimationFps] = useState<number | null>(null);
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
  const recentBatchMs = useRef<number[]>([]);
  const mounted = useRef(true);
  assignmentsRef.current = assignments;
  effectGroupsRef.current = effectGroups;

  useEffect(() => controller?.subscribe(setControllerState), [controller]);

  const cancelAnimation = useCallback(() => {
    animationSequence.current += 1;
    recentBatchMs.current = [];
    if (animationTimer.current !== null) window.clearTimeout(animationTimer.current);
    animationTimer.current = null;
    if (mounted.current) {
      setAnimationRunning(false);
      setEffectiveAnimationFps(null);
    }
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

  const connectedApiLevel =
    controllerState.transport.status === 'connected'
      ? apiLevelForAuroraDeviceName(controllerState.transport.device.name)
      : null;
  const sceneLightCount = assignments.length;
  const capacity = connectedApiLevel === null
    ? null
    : Object.freeze({
        apiLevel: connectedApiLevel,
        cost: encodedSceneCost(connectedApiLevel, sceneLightCount),
        measured: measuredCapacityProfile(connectedApiLevel) !== null,
      });

  const previewScene = useCallback(
    async (scene: ReturnType<typeof staticScene>) => {
      if (!controller) return Object.freeze({ status: 'superseded' } as const);
      const transport = controller.getState().transport;
      const apiLevel = apiLevelForAuroraDeviceName(
        transport.status === 'connected' ? transport.device.name : null,
      );
      const profile = measuredCapacityProfile(apiLevel);
      if (profile) {
        const assessment = assessStaticScene(profile, scene.length);
        if (!assessment.accepted) throw new Error(assessment.warning);
      }
      return controller.preview(scene);
    },
    [controller],
  );

  const preview = useCallback(async () => {
    if (!controller) return;
    const sequence = ++previewSequence.current;
    setMessage(null);
    setPreviewStatus('previewing');
    try {
      await previewScene(staticScene());
      if (mounted.current && previewSequence.current === sequence) setPreviewStatus('idle');
    } catch (error) {
      if (mounted.current && previewSequence.current === sequence) {
        setPreviewStatus('error');
        setMessage(error instanceof Error ? error.message : 'Could not preview the draft.');
      }
    }
  }, [controller, previewScene, staticScene]);

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
      const apiLevel = apiLevelForAuroraDeviceName(transport.device.name);
      const profile = measuredCapacityProfile(apiLevel);
      if (!profile) {
        setMessage(`API ${apiLevel} animation capacity has not been measured on this board.`);
        return;
      }
      let schedule = chooseAnimationSchedule(
        profile,
        assignmentsRef.current.length,
        recentBatchMs.current,
      );
      if (schedule.fps === 0) {
        setMessage(schedule.warning ?? 'This animation is outside the measured board capacity.');
        return;
      }
      const sequence = ++animationSequence.current;
      setAnimationRunning(true);
      setEffectiveAnimationFps(schedule.fps);

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
        // API2 replacement semantics require every frame to contain the complete scene.
        const batchStartedAt = performance.now();
        try {
          await previewScene(frame);
        } catch (error) {
          if (mounted.current && animationSequence.current === sequence) {
            setMessage(error instanceof Error ? error.message : 'Could not animate the draft.');
            setPreviewStatus('error');
            cancelAnimation();
          }
          return;
        }
        recentBatchMs.current = [
          ...recentBatchMs.current.slice(-8),
          performance.now() - batchStartedAt,
        ];
        if (mounted.current && animationSequence.current === sequence) {
          schedule = chooseAnimationSchedule(profile, frame.length, recentBatchMs.current);
          if (schedule.warning) setMessage(schedule.warning);
          if (schedule.fps === 0) {
            cancelAnimation();
            return;
          }
          setEffectiveAnimationFps(schedule.fps);
          const periodMs = 1_000 / schedule.fps;
          const elapsedMs = performance.now() - startedAt;
          const nextDueAt = startedAt + (Math.floor(elapsedMs / periodMs) + 1) * periodMs;
          animationTimer.current = window.setTimeout(
            () => void tick(),
            Math.max(0, nextDueAt - performance.now()),
          );
        }
      };
      animationTimer.current = window.setTimeout(() => void tick(), 1_000 / schedule.fps);
    },
    [cancelAnimation, controller, definition, previewScene],
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
      const connected = controller.getState().transport;
      const apiLevel = apiLevelForAuroraDeviceName(
        connected.status === 'connected' ? connected.device.name : null,
      );
      const profile = measuredCapacityProfile(apiLevel);
      if (profile) {
        const assessment = assessStaticScene(profile, scene.length);
        if (!assessment.accepted) {
          setMessage(assessment.warning ?? 'This scene is outside the measured board capacity.');
          return;
        }
      }
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
      const transport = controller.getState().transport;
      const profile = measuredCapacityProfile(
        apiLevelForAuroraDeviceName(
          transport.status === 'connected' ? transport.device.name : null,
        ),
      );
      if (profile) {
        const assessment = assessStaticScene(profile, scene.length);
        if (!assessment.accepted) {
          setMessage(assessment.warning ?? 'This scene is outside the measured board capacity.');
          return;
        }
      }
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
    capacity:
      capacity === null
        ? null
        : Object.freeze({
            label: `API ${capacity.apiLevel} · ${capacityCostLabel(capacity.cost)}${capacity.measured ? ' · measured profile' : ' · capacity unmeasured'}`,
            measured: capacity.measured,
            effectiveAnimationFps,
          }),
    setLivePreview,
    lightDraft,
    stopAnimation,
  };
}
