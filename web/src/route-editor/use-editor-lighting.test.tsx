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
import { createSpatialPreset } from '../light-effects/preset-library';

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

  it('never opens a chooser automatically and lights the selection after pairing', async () => {
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({ definition: kilterFullride7x10Definition, transport });
    renderHook(() => useEditorLighting({ definition: kilterFullride7x10Definition, assignments: [], controller }));
    expect(transport.operations).toEqual([]);
    await act(() => controller.requestAndConnect());
    await waitFor(() => expect(transport.operations.map(({ type }) => type)).toEqual(['connect', 'write']));
    expect(controller.getState().lastAppliedScene).toEqual([]);
  });

  it('debounces edits, ignores equivalent repository refreshes, and sends the latest scene', async () => {
    vi.useFakeTimers();
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({ definition: kilterFullride7x10Definition, transport });
    await controller.requestAndConnect();
    const placementId = kilterFullride7x10Definition.placements[0]!.id;
    let assignments: readonly BoardHoldAssignment[] = [];
    const { rerender } = renderHook(() => useEditorLighting({ definition: kilterFullride7x10Definition, assignments, controller }));
    await act(() => vi.advanceTimersByTimeAsync(180));
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(1);
    transport.resetOperations();
    assignments = [{ placementId, appearance: { kind: 'role', role: 'middle' } }];
    rerender();
    assignments = [{ placementId, appearance: { kind: 'role', role: 'finish' } }];
    rerender();
    await act(() => vi.advanceTimersByTimeAsync(179));
    expect(transport.operations).toHaveLength(0);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(1);
    expect(controller.getState().lastAppliedScene?.[0]?.color).toBe(kilterFullride7x10Definition.rolePresets.finish.lightColor);
    assignments = structuredClone(assignments);
    rerender();
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(1);
  });

  it('reports a failed automatic write and lights automatically after reconnect', async () => {
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({ definition: kilterFullride7x10Definition, transport });
    await controller.requestAndConnect();
    transport.failNext('write', new BoardTransportError('write-failed', 'Preview failed.'));
    const { result } = renderHook(() => useEditorLighting({ definition: kilterFullride7x10Definition, assignments: [], controller }));
    await waitFor(() => expect(result.current.message).toBe('Preview failed.'));
    await act(() => controller.reconnect());
    await waitFor(() => expect(result.current.message).toBeNull());
    await waitFor(() => expect(controller.getState().lastAppliedScene).toEqual([]));
  });

  it.each(['unmount', 'change', 'hide', 'clear'] as const)('does not revive an old animation after a slow initial write and %s', async (action) => {
    vi.useFakeTimers();
    const transport = new MockBoardByteTransport({ devices: [{ id: 'api2', name: 'Kilter Board' }] });
    const controller = createFullrideLightController({ definition: kilterFullride7x10Definition, transport });
    await controller.requestAndConnect();
    let release!: () => void;
    const slow = vi.spyOn(transport, 'writeBatch').mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
    let groups = effectGroups;
    const view = renderHook(() => useEditorLighting({ definition: kilterFullride7x10Definition, assignments: animatedAssignments, effectGroups: groups, controller }));
    await act(() => vi.advanceTimersByTimeAsync(180));
    expect(slow).toHaveBeenCalledOnce();
    if (action === 'unmount') view.unmount();
    if (action === 'change') { groups = []; view.rerender(); }
    if (action === 'hide') {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      act(() => document.dispatchEvent(new Event('visibilitychange')));
    }
    let clearing: Promise<void> | undefined;
    if (action === 'clear') clearing = controller.clear();
    await act(async () => { release(); await clearing; });
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(slow).toHaveBeenCalledTimes(action === 'change' || action === 'clear' ? 2 : 1);
    if (action !== 'unmount') expect(view.result.current.animationRunning).toBe(false);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
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
    await controller.requestAndConnect();
    const { result } = renderHook(() =>
      useEditorLighting({ definition: kilterFullride7x10Definition, assignments, controller }),
    );

    await waitFor(() => expect(result.current.message).not.toBeNull());

    expect(assignments).toHaveLength(128);
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(0);
    expect(result.current.message).toMatch(/128 lights.*14 writes.*still saved.*not sent/i);
  });

  it('starts the latest animation without timing samples from a cancelled slow frame', async () => {
    vi.useFakeTimers();
    const transport = new MockBoardByteTransport({ devices: [{ id: 'api2', name: 'Kilter Board' }] });
    const controller = createFullrideLightController({ definition: kilterFullride7x10Definition, transport });
    await controller.requestAndConnect();
    let groups = effectGroups;
    const view = renderHook(() => useEditorLighting({
      definition: kilterFullride7x10Definition, assignments: animatedAssignments, effectGroups: groups, controller,
    }));
    await act(() => vi.advanceTimersByTimeAsync(180));
    let release!: () => void;
    vi.spyOn(transport, 'writeBatch').mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
    await act(() => vi.advanceTimersByTimeAsync(500));
    groups = effectGroups.map((group) => ({ ...group, periodMs: 2000 }));
    view.rerender();
    await act(() => vi.advanceTimersByTimeAsync(1500));
    await act(async () => { release(); });
    expect(view.result.current.animationRunning).toBe(true);
    expect(view.result.current.message).toBeNull();
    const writes = transport.operations.filter(({ type }) => type === 'write').length;
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(transport.operations.filter(({ type }) => type === 'write').length).toBeGreaterThan(writes);
  });

  it('reserves the complete capacity-test lifetime and cancels automatic lighting', async () => {
    vi.useFakeTimers();
    const transport = new MockBoardByteTransport({ devices: [{ id: 'api2', name: 'Kilter Board' }] });
    const controller = createFullrideLightController({ definition: kilterFullride7x10Definition, transport });
    await controller.requestAndConnect();
    let assignments = animatedAssignments;
    const view = renderHook(() => useEditorLighting({
      definition: kilterFullride7x10Definition, assignments, effectGroups, controller,
    }));
    await act(() => vi.advanceTimersByTimeAsync(180));
    expect(view.result.current.animationRunning).toBe(true);
    transport.resetOperations();
    let run!: ReturnType<NonNullable<typeof controller.runCapacityCase>>;
    act(() => {
      run = controller.runCapacityCase!({ apiLevel: 2, lightCount: 1, requestedFps: 1, durationMs: 1000, interChunkDelayMs: 0 });
    });
    expect(controller.getState().operation).toBe('diagnosing');
    expect(view.result.current.animationRunning).toBe(false);
    await expect(controller.preview([])).resolves.toEqual({ status: 'superseded' });
    await expect(controller.light([])).rejects.toThrow(/capacity test/);
    await expect(controller.clear()).rejects.toThrow(/capacity test/);
    assignments = [];
    view.rerender();
    await act(() => vi.advanceTimersByTimeAsync(1200));
    await expect(run).resolves.toMatchObject({ status: 'completed' });
    expect(controller.getState().operation).toBe('idle');
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(3);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(3);
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
    await controller.requestAndConnect();
    const { result } = renderHook(() =>
      useEditorLighting({
        definition: kilterFullride7x10Definition,
        assignments,
        effectGroups,
        controller,
      }),
    );

    await waitFor(() => expect(result.current.message).not.toBeNull());

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
    await controller.requestAndConnect();
    const { result } = renderHook(() =>
      useEditorLighting({
        definition: kilterFullride7x10Definition,
        assignments: animatedAssignments,
        effectGroups,
        controller,
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180);
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

  it('keeps an intentionally empty bird frame alive', async () => {
    vi.useFakeTimers();
    const transport = new MockBoardByteTransport({ devices: [{ id: 'api2', name: 'Kilter Board' }] });
    const controller = createFullrideLightController({ definition: kilterFullride7x10Definition, transport });
    await controller.requestAndConnect();
    const birdGroups = [createSpatialPreset('bird-flock', 7)];
    const { result } = renderHook(() => useEditorLighting({
      definition: kilterFullride7x10Definition,
      assignments: [],
      effectGroups: birdGroups,
      controller,
    }));
    await act(async () => { await vi.advanceTimersByTimeAsync(180); });
    expect(result.current.animationRunning).toBe(true);
    const firstWriteCount = transport.operations.filter(({ type }) => type === 'write').length;
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(transport.operations.filter(({ type }) => type === 'write').length).toBeGreaterThan(firstWriteCount);
    expect(result.current.animationRunning).toBe(true);
  });

  it('resumes on foreground return and cancels on hiding, disconnect, clear, and unmount', async () => {
    vi.useFakeTimers();
    const transport = new MockBoardByteTransport({ devices: [{ id: 'api2', name: 'Kilter Board' }] });
    const controller = createFullrideLightController({
      definition: kilterFullride7x10Definition,
      transport,
    });
    await controller.requestAndConnect();
    const view = renderHook(() =>
      useEditorLighting({
        definition: kilterFullride7x10Definition,
        assignments: animatedAssignments,
        effectGroups,
        controller,
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180);
    });
    expect(view.result.current.animationRunning).toBe(true);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(view.result.current.animationRunning).toBe(false);
    const hiddenWrites = transport.operations.filter(({ type }) => type === 'write').length;
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(hiddenWrites);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(view.result.current.animationRunning).toBe(true);
    act(() => transport.simulateRemoteDisconnect());
    expect(view.result.current.animationRunning).toBe(false);

    await act(async () => {
      await controller.reconnect();
    });
    await act(async () => {
      await view.result.current.lightDraft();
    });
    expect(view.result.current.animationRunning).toBe(true);
    await act(async () => {
      await controller.clear();
    });
    expect(view.result.current.animationRunning).toBe(false);
    const clearedWrites = transport.operations.filter(({ type }) => type === 'write').length;
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(clearedWrites);
    expect(controller.getState().lastAppliedScene).toEqual([]);
    await act(async () => {
      await view.result.current.lightDraft();
    });
    expect(view.result.current.animationRunning).toBe(true);
    const writes = transport.operations.filter(({ type }) => type === 'write').length;
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(writes);
  });
});
