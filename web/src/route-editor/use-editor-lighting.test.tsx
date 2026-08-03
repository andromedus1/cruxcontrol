import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFullrideLightController } from '../board-control/light-controller';
import { MockBoardByteTransport } from '../board-control/mock-byte-transport';
import { BoardTransportError } from '../board-control/transport';
import type { BoardHoldAssignment } from '../board-renderer/types';
import { lightEffectGroupId, type LightEffectGroup } from '../board-renderer/types';
import { apiLevel3Color } from '../domain/boards/colors';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { useEditorLighting } from './use-editor-lighting';

afterEach(() => vi.useRealTimers());

describe('useEditorLighting', () => {
  const effectGroupId = lightEffectGroupId('water');
  const effectGroups: readonly LightEffectGroup[] = [
    {
      id: effectGroupId,
      kind: 'color-cycle',
      palette: [apiLevel3Color(3), apiLevel3Color(31)],
      periodMs: 1000,
      intensity: 1,
    },
  ];
  const animatedAssignments: readonly BoardHoldAssignment[] = [
    {
      placementId: kilterFullride7x10Definition.placements[0]!.id,
      appearance: { kind: 'custom', color: apiLevel3Color(3) },
      effectGroupId,
    },
  ];

  it('connects and lights an unrestricted empty draft', async () => {
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({
      definition: kilterFullride7x10Definition,
      transport,
    });
    const { result } = renderHook(() =>
      useEditorLighting({ definition: kilterFullride7x10Definition, assignments: [], controller }),
    );
    await act(() => result.current.lightDraft());
    expect(transport.operations.map(({ type }) => type)).toEqual(['connect', 'write']);
  });

  it('keeps live preview opt-in and sends immediately when enabled', async () => {
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({
      definition: kilterFullride7x10Definition,
      transport,
    });
    await controller.requestAndConnect();
    const { result } = renderHook(() =>
      useEditorLighting({ definition: kilterFullride7x10Definition, assignments: [], controller }),
    );
    expect(result.current.livePreview).toBe(false);
    await act(async () => {
      result.current.setLivePreview(true);
    });
    expect(result.current.livePreview).toBe(true);
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(1);
  });

  it('debounces assignment changes and previews only the latest scene', async () => {
    vi.useFakeTimers();
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({
      definition: kilterFullride7x10Definition,
      transport,
    });
    await controller.requestAndConnect();
    const placementId = kilterFullride7x10Definition.placements[0]!.id;
    let assignments: readonly BoardHoldAssignment[] = [];
    const { result, rerender } = renderHook(() =>
      useEditorLighting({ definition: kilterFullride7x10Definition, assignments, controller }),
    );
    await act(async () => {
      result.current.setLivePreview(true);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(1);
    transport.resetOperations();

    assignments = [{ placementId, appearance: { kind: 'role', role: 'middle' } }];
    rerender();
    assignments = [{ placementId, appearance: { kind: 'role', role: 'finish' } }];
    rerender();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(179);
    });
    expect(transport.operations).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(1);
    expect(controller.getState().lastAppliedScene?.[0]?.color).toBe(
      kilterFullride7x10Definition.rolePresets.finish.lightColor,
    );
  });

  it('turns preview off on disconnect and recovers from a failed preview through explicit connect-and-light', async () => {
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({
      definition: kilterFullride7x10Definition,
      transport,
    });
    await controller.requestAndConnect();
    const { result } = renderHook(() =>
      useEditorLighting({ definition: kilterFullride7x10Definition, assignments: [], controller }),
    );
    transport.failNext('write', new BoardTransportError('write-failed', 'Preview failed.'));
    act(() => result.current.setLivePreview(true));
    await waitFor(() => expect(result.current.status).toBe('error'));
    await waitFor(() => expect(result.current.livePreview).toBe(false));
    expect(result.current.message).toBe('Preview failed.');

    await act(async () => {
      await result.current.lightDraft();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.message).toBeNull();
    expect(result.current.controllerState.transport.status).toBe('connected');

    act(() => result.current.setLivePreview(true));
    await waitFor(() => expect(result.current.livePreview).toBe(true));
    act(() => transport.simulateRemoteDisconnect());
    await waitFor(() => expect(result.current.livePreview).toBe(false));
  });

  it('captures the connect chooser in the direct light gesture and ignores duplicate busy actions', async () => {
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({
      definition: kilterFullride7x10Definition,
      transport,
    });
    const { result } = renderHook(() =>
      useEditorLighting({ definition: kilterFullride7x10Definition, assignments: [], controller }),
    );
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.lightDraft();
      second = result.current.lightDraft();
    });
    expect(transport.operations.filter(({ type }) => type === 'connect')).toHaveLength(1);
    await act(async () => {
      await Promise.all([first, second]);
    });
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(1);
  });

  it('keeps an over-cap static design intact and refuses to send it', async () => {
    const assignments = kilterFullride7x10Definition.placements.slice(0, 128).map((placement) => ({
      placementId: placement.id,
      appearance: { kind: 'role' as const, role: 'middle' as const },
    }));
    const transport = new MockBoardByteTransport({
      devices: [{ id: 'api2', name: 'Kilter Board' }],
    });
    const controller = createFullrideLightController({
      definition: kilterFullride7x10Definition,
      transport,
    });
    const { result } = renderHook(() =>
      useEditorLighting({ definition: kilterFullride7x10Definition, assignments, controller }),
    );

    await act(() => result.current.lightDraft());

    expect(assignments).toHaveLength(128);
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(0);
    expect(result.current.message).toMatch(/128 lights.*14 writes.*still saved.*not sent/i);
  });

  it('refuses API2 animation above 20 total lights before the first board write', async () => {
    const assignments = kilterFullride7x10Definition.placements.slice(0, 21).map((placement) => ({
      placementId: placement.id,
      appearance: { kind: 'custom' as const, color: apiLevel3Color(3) },
      effectGroupId,
    }));
    const transport = new MockBoardByteTransport({
      devices: [{ id: 'api2', name: 'Kilter Board' }],
    });
    const controller = createFullrideLightController({
      definition: kilterFullride7x10Definition,
      transport,
    });
    const { result } = renderHook(() =>
      useEditorLighting({
        definition: kilterFullride7x10Definition,
        assignments,
        effectGroups,
        controller,
      }),
    );

    await act(() => result.current.lightDraft());

    expect(assignments).toHaveLength(21);
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(0);
    expect(controller.getState().lastAppliedScene).toBeNull();
    expect(result.current.animationRunning).toBe(false);
    expect(result.current.message).toMatch(/21 lights.*21 route\/static.*allows 20/i);
  });

  it('starts API2 animation at the measured two FPS and keeps slow preview writes bounded', async () => {
    vi.useFakeTimers();
    const transport = new MockBoardByteTransport({
      devices: [{ id: 'api2', name: 'Kilter Board' }],
    });
    const controller = createFullrideLightController({
      definition: kilterFullride7x10Definition,
      transport,
    });
    const { result } = renderHook(() =>
      useEditorLighting({
        definition: kilterFullride7x10Definition,
        assignments: animatedAssignments,
        effectGroups,
        controller,
      }),
    );
    await act(async () => {
      await result.current.lightDraft();
    });
    expect(result.current.animationRunning).toBe(true);
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(1);
    transport.resetOperations();

    let release!: () => void;
    const slow = vi.spyOn(transport, 'writeBatch').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(499);
    });
    expect(slow).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(slow).toHaveBeenCalledOnce();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(slow).toHaveBeenCalledOnce();
    release();
    await act(async () => {
      await Promise.resolve();
    });
    expect(slow).toHaveBeenCalledOnce();
  });

  it('stops and settles the static base scene, then schedules no later frames', async () => {
    vi.useFakeTimers();
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({
      definition: kilterFullride7x10Definition,
      transport,
    });
    const { result } = renderHook(() =>
      useEditorLighting({
        definition: kilterFullride7x10Definition,
        assignments: animatedAssignments,
        effectGroups,
        controller,
      }),
    );
    await act(async () => {
      await result.current.lightDraft();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await act(async () => {
      await result.current.stopAnimation();
    });
    expect(result.current.animationRunning).toBe(false);
    expect(controller.getState().lastAppliedScene).toEqual([
      { placementId: animatedAssignments[0]!.placementId, color: apiLevel3Color(3) },
    ]);
    const writes = transport.operations.filter(({ type }) => type === 'write').length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(writes);
  });

  it('cancels animation on visibility loss, disconnect, and unmount', async () => {
    vi.useFakeTimers();
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({
      definition: kilterFullride7x10Definition,
      transport,
    });
    const view = renderHook(() =>
      useEditorLighting({
        definition: kilterFullride7x10Definition,
        assignments: animatedAssignments,
        effectGroups,
        controller,
      }),
    );
    await act(async () => {
      await view.result.current.lightDraft();
    });
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(view.result.current.animationRunning).toBe(false);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });

    await act(async () => {
      await view.result.current.lightDraft();
    });
    act(() => transport.simulateRemoteDisconnect());
    expect(view.result.current.animationRunning).toBe(false);

    await act(async () => {
      await controller.reconnect();
    });
    await act(async () => {
      await view.result.current.lightDraft();
    });
    await act(async () => {
      await controller.clear();
    });
    expect(view.result.current.animationRunning).toBe(false);
    await act(async () => {
      await view.result.current.lightDraft();
    });
    const writes = transport.operations.filter(({ type }) => type === 'write').length;
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(writes);
  });
});
