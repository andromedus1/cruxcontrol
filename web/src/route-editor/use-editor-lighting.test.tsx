import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFullrideLightController } from '../board-control/light-controller';
import { MockBoardByteTransport } from '../board-control/mock-byte-transport';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { useEditorLighting } from './use-editor-lighting';

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
});
