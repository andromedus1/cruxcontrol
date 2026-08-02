import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFullrideLightController } from '../board-control/light-controller';
import { MockBoardByteTransport } from '../board-control/mock-byte-transport';
import { BoardTransportError } from '../board-control/transport';
import type { BoardHoldAssignment } from '../board-renderer/types';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { useEditorLighting } from './use-editor-lighting';

afterEach(() => vi.useRealTimers());

describe('useEditorLighting', () => {
  it('connects and lights an unrestricted empty draft', async () => {
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({ definition: kilterFullride7x10Definition, transport });
    const { result } = renderHook(() => useEditorLighting({ definition: kilterFullride7x10Definition, assignments: [], controller }));
    await act(() => result.current.lightDraft());
    expect(transport.operations.map(({ type }) => type)).toEqual(['connect', 'write']);
  });

  it('keeps live preview opt-in and sends immediately when enabled', async () => {
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({ definition: kilterFullride7x10Definition, transport });
    await controller.requestAndConnect();
    const { result } = renderHook(() => useEditorLighting({ definition: kilterFullride7x10Definition, assignments: [], controller }));
    expect(result.current.livePreview).toBe(false);
    await act(async () => { result.current.setLivePreview(true); });
    expect(result.current.livePreview).toBe(true);
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(1);
  });

  it('debounces assignment changes and previews only the latest scene', async () => {
    vi.useFakeTimers();
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({ definition: kilterFullride7x10Definition, transport });
    await controller.requestAndConnect();
    const placementId = kilterFullride7x10Definition.placements[0]!.id;
    let assignments: readonly BoardHoldAssignment[] = [];
    const { result, rerender } = renderHook(() => useEditorLighting({ definition: kilterFullride7x10Definition, assignments, controller }));
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
    await act(async () => { await vi.advanceTimersByTimeAsync(179); });
    expect(transport.operations).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });

    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(1);
    expect(controller.getState().lastAppliedScene?.[0]?.color).toBe(
      kilterFullride7x10Definition.rolePresets.finish.lightColor,
    );
  });

  it('turns preview off on disconnect and recovers from a failed preview through explicit connect-and-light', async () => {
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({ definition: kilterFullride7x10Definition, transport });
    await controller.requestAndConnect();
    const { result } = renderHook(() => useEditorLighting({ definition: kilterFullride7x10Definition, assignments: [], controller }));
    transport.failNext('write', new BoardTransportError('write-failed', 'Preview failed.'));
    act(() => result.current.setLivePreview(true));
    await waitFor(() => expect(result.current.status).toBe('error'));
    await waitFor(() => expect(result.current.livePreview).toBe(false));
    expect(result.current.message).toBe('Preview failed.');

    await act(async () => { await result.current.lightDraft(); });
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
    const controller = createFullrideLightController({ definition: kilterFullride7x10Definition, transport });
    const { result } = renderHook(() => useEditorLighting({ definition: kilterFullride7x10Definition, assignments: [], controller }));
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.lightDraft();
      second = result.current.lightDraft();
    });
    expect(transport.operations.filter(({ type }) => type === 'connect')).toHaveLength(1);
    await act(async () => { await Promise.all([first, second]); });
    expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(1);
  });
});
