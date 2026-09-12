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
import { spatialCapacityPlan } from '../light-effects/capacity-plan';

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
  const [animationRunning, setAnimationRunning] = useState(false);
  const [effectiveAnimationFps, setEffectiveAnimationFps] = useState<number | null>(null);
  const [explicitStatus, setExplicitStatus] = useState<'idle' | 'lighting'>('idle');
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'previewing' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const assignmentsRef = useRef(assignments);
  const effectGroupsRef = useRef(effectGroups);
  const automaticTimer = useRef<number | null>(null);
  const previewSequence = useRef(0);
  const animationSequence = useRef(0);
  const animationTimer = useRef<number | null>(null);
  const recentBatchMs = useRef<number[]>([]);
  const mounted = useRef(true);
  assignmentsRef.current = assignments;
  effectGroupsRef.current = effectGroups;

  const cancelAnimation = useCallback(() => {
    animationSequence.current += 1;
    previewSequence.current += 1;
    if (automaticTimer.current !== null) window.clearTimeout(automaticTimer.current);
    automaticTimer.current = null;
    recentBatchMs.current = [];
    if (animationTimer.current !== null) window.clearTimeout(animationTimer.current);
    animationTimer.current = null;
    if (mounted.current) {
      setAnimationRunning(false);
      setEffectiveAnimationFps(null);
      setExplicitStatus('idle');
      setPreviewStatus('idle');
    }
  }, []);

  useEffect(() => controller?.subscribe((state) => {
    // Observe the operation synchronously: React may batch clearing and idle
    // notifications into one render. Empty animation previews use previewing.
    if (state.operation === 'clearing' || state.operation === 'diagnosing') cancelAnimation();
    setControllerState(state);
  }), [cancelAnimation, controller]);

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

  useEffect(() => {
    if (controllerState.transport.status === 'connected') return;
    cancelAnimation();
  }, [cancelAnimation, controllerState.transport.status]);

  const startAnimation = useCallback(
    (startedAt: number) => {
      if (!controller || !mounted.current || document.hidden) return;
      const transport = controller.getState().transport;
      if (transport.status !== 'connected') return;
      const apiLevel = apiLevelForAuroraDeviceName(transport.device.name);
      const profile = measuredCapacityProfile(apiLevel);
      if (!profile) {
        setMessage(`API ${apiLevel} animation capacity has not been measured on this board.`);
        return;
      }
      const plan = spatialCapacityPlan(assignmentsRef.current, effectGroupsRef.current);
      let schedule = chooseAnimationSchedule(
        profile,
        plan.worstCaseLights,
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
        if (frame.length > plan.worstCaseLights) {
          setMessage(`Effect frame used ${frame.length} lights, exceeding its ${plan.worstCaseLights}-light reserve. Playback stopped.`);
          cancelAnimation();
          return;
        }
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
        if (mounted.current && animationSequence.current === sequence) {
          recentBatchMs.current = [
            ...recentBatchMs.current.slice(-8),
            performance.now() - batchStartedAt,
          ];
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
    if (!controller || controller.getState().transport.status !== 'connected' ||
      controller.getState().operation === 'diagnosing' || document.hidden) return;
    cancelAnimation();
    const sequence = previewSequence.current;
    try {
      setMessage(null);
      setPreviewStatus('idle');
      setExplicitStatus('lighting');
      const groupIds = new Set(effectGroupsRef.current.map(({ id }) => id));
      const animated = effectGroupsRef.current.some((group) => group.model === 'spatial') || assignmentsRef.current.some(
        ({ effectGroupId }) => effectGroupId !== undefined && groupIds.has(effectGroupId),
      );
      const startedAt = performance.now();
      const plan = spatialCapacityPlan(assignmentsRef.current, effectGroupsRef.current);
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
      if (animated && profile) {
        const schedule = chooseAnimationSchedule(profile, plan.worstCaseLights, []);
        if (schedule.fps === 0) {
          const effects = plan.spatialReserves.reduce((sum, reserve) => sum + reserve.lights, 0);
          setMessage(`Animation needs ${plan.worstCaseLights} lights (${plan.assignmentLights} route/static + ${effects} effects); measured API 2 playback allows 20. Reduce route lights or effect reserves.`);
          return;
        }
      }
      if (profile) {
        const assessment = assessStaticScene(profile, scene.length);
        if (!assessment.accepted) {
          setMessage(assessment.warning ?? 'This scene is outside the measured board capacity.');
          return;
        }
      }
      // Automatic scene replacement shares the controller's latest-frame-wins queue.
      // Empty scenes use the same path, without masquerading as an explicit stop.
      const result = await previewScene(scene);
      if (mounted.current && previewSequence.current === sequence && result.status === 'applied' && animated) {
        startAnimation(startedAt);
      }
    } catch (error) {
      if (mounted.current && previewSequence.current === sequence) {
        setMessage(error instanceof Error ? error.message : 'Could not light the climb.');
      }
    } finally {
      if (mounted.current && previewSequence.current === sequence) setExplicitStatus('idle');
    }
  }, [cancelAnimation, controller, definition, previewScene, startAnimation, staticScene]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) cancelAnimation();
      else void lightDraft();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [cancelAnimation, lightDraft]);

  // Repository refreshes recreate arrays; only actual scene changes should send
  // lights or restart playback. Metadata edits and status notifications do not.
  const sceneKey = JSON.stringify([assignments, effectGroups]);
  useEffect(() => {
    cancelAnimation();
    if (controllerState.transport.status === 'connected' && !document.hidden) {
      automaticTimer.current = window.setTimeout(() => {
        automaticTimer.current = null;
        void lightDraft();
      }, previewDelayMs);
    }
    return cancelAnimation;
  }, [cancelAnimation, controllerState.transport.status, lightDraft, previewDelayMs, sceneKey]);

  const status =
    explicitStatus !== 'idle'
      ? explicitStatus
      : previewStatus === 'error' || message
        ? 'error'
        : previewStatus;

  return {
    controllerState,
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
    lightDraft,
  };
}
