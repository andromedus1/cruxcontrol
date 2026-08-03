import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BoardLightController, BoardLightState } from '../board-control/light-controller';
import { kilterFullride7x10Definition as definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { ClimbDetail } from './ClimbDetail';
import { climbViewKey, type ClimbViewRecord } from './types';
import { createSpatialPreset } from '../light-effects/preset-library';

const climb: ClimbViewRecord = {
  key: climbViewKey('local:detail'), name: 'Color Study', angle: 40, origin: 'local-draft',
  assignments: [
    { placementId: definition.placements[0].id, appearance: { kind: 'role', role: 'start' } },
    { placementId: definition.placements[1].id, appearance: { kind: 'custom', color: 255 as never } },
  ],
};

function controllerWith(state: BoardLightState): BoardLightController {
  return {
    getState: () => state,
    subscribe: () => () => undefined,
    requestAndConnect: vi.fn().mockResolvedValue({ id: 'board', name: 'Homewall' }),
    reconnect: vi.fn().mockResolvedValue({ id: 'board', name: 'Homewall' }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    light: vi.fn().mockResolvedValue(undefined), clear: vi.fn().mockResolvedValue(undefined),
    preview: vi.fn().mockResolvedValue({ status: 'applied' }),
  };
}

describe('ClimbDetail', () => {
  it('renders all semantic roles plus custom color truthfully', () => {
    render(<ClimbDetail definition={definition} climb={climb} />);
    for (const label of ['Start · Green', 'Middle · Blue', 'Finish · Red/Pink', 'Foot-only · Gold/Yellow', 'Custom colors']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Light this climb' })).toBeDisabled();
  });

  it('keeps connection explicit and lights exactly one projected scene', async () => {
    const disconnected = controllerWith({ transport: { status: 'disconnected', device: null }, operation: 'idle', lastAppliedScene: null, error: null });
    const firstRender = render(<ClimbDetail definition={definition} climb={climb} controller={disconnected} />);
    expect(disconnected.requestAndConnect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(disconnected.requestAndConnect).toHaveBeenCalledOnce();
    firstRender.unmount();

    const connected = controllerWith({ transport: { status: 'connected', device: { id: 'board', name: 'Homewall' } }, operation: 'idle', lastAppliedScene: null, error: null });
    render(<ClimbDetail definition={definition} climb={climb} controller={connected} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Light this climb' })); });
    expect(connected.light).toHaveBeenCalledOnce();
    expect(connected.light).toHaveBeenCalledWith([
      { placementId: definition.placements[0].id, color: definition.rolePresets.start.lightColor },
      { placementId: definition.placements[1].id, color: 255 },
    ]);
  });

  it('lights saved spatial effects through the shared animated scene', async () => {
    const connected = controllerWith({ transport: { status: 'connected', device: { id: 'board', name: 'Homewall' } }, operation: 'idle', lastAppliedScene: null, error: null });
    const animated = { ...climb, effectGroups: [createSpatialPreset('beach-ball', 7)] };
    render(<ClimbDetail definition={definition} climb={animated} controller={connected} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Light this climb' })); });
    expect(connected.light).toHaveBeenCalledOnce();
    expect(vi.mocked(connected.light).mock.calls[0]![0].length).toBeGreaterThan(climb.assignments.length);
  });

  it('keeps animation controls stable while a complete-scene preview write is in flight', async () => {
    vi.useFakeTimers();
    let state: BoardLightState = { transport: { status: 'connected', device: { id: 'board', name: 'Homewall' } }, operation: 'idle', lastAppliedScene: null, error: null };
    let listener: ((value: BoardLightState) => void) | undefined;
    let finishPreview: (() => void) | undefined;
    const previewGate = new Promise<void>((resolve) => { finishPreview = resolve; });
    const controller: BoardLightController = {
      ...controllerWith(state),
      getState: () => state,
      subscribe: (next) => { listener = next; return () => { listener = undefined; }; },
      preview: vi.fn(async () => {
        state = { ...state, operation: 'previewing' };
        listener?.(state);
        await previewGate;
        return { status: 'applied' as const };
      }),
    };
    const animated = { ...climb, effectGroups: [createSpatialPreset('beach-ball', 7)] };
    const view = render(<ClimbDetail definition={definition} climb={animated} controller={controller} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Light this climb' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(controller.preview).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Restart animation' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Previewing…' })).not.toBeInTheDocument();
    finishPreview?.();
    await act(async () => { await Promise.resolve(); });
    view.unmount();
    vi.useRealTimers();
  });

  it('labels an empty scene as a clear-board operation', async () => {
    const connected = controllerWith({ transport: { status: 'connected', device: { id: 'board', name: null } }, operation: 'idle', lastAppliedScene: null, error: null });
    render(<ClimbDetail definition={definition} climb={{ ...climb, assignments: [] }} controller={connected} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Clear board' })); });
    expect(connected.clear).toHaveBeenCalledOnce();
  });

  it('shows reconnect and preview operations explicitly', () => {
    const recoverableError = controllerWith({
      transport: {
        status: 'error',
        device: { id: 'board', name: 'Homewall' },
        error: Object.assign(new Error('Connection lost'), { recoverable: true }),
      } as BoardLightState['transport'],
      operation: 'idle',
      lastAppliedScene: null,
      error: null,
    });
    const firstRender = render(<ClimbDetail definition={definition} climb={climb} controller={recoverableError} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(recoverableError.reconnect).toHaveBeenCalledWith('board');
    firstRender.unmount();

    const previewing = controllerWith({
      transport: { status: 'connected', device: { id: 'board', name: 'Homewall' } },
      operation: 'previewing',
      lastAppliedScene: null,
      error: null,
    });
    render(<ClimbDetail definition={definition} climb={climb} controller={previewing} />);
    expect(screen.getByRole('button', { name: 'Previewing…' })).toBeDisabled();
    expect(screen.getByText('Previewing board changes…')).toBeInTheDocument();
  });
});
