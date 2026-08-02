import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BoardLightController, BoardLightState } from '../board-control/light-controller';
import { kilterFullride7x10Definition as definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { ClimbDetail } from './ClimbDetail';
import { climbViewKey, type ClimbViewRecord } from './types';

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

  it('keeps connection explicit and lights exactly one projected scene', () => {
    const disconnected = controllerWith({ transport: { status: 'disconnected', device: null }, operation: 'idle', lastAppliedScene: null, error: null });
    const firstRender = render(<ClimbDetail definition={definition} climb={climb} controller={disconnected} />);
    expect(disconnected.requestAndConnect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(disconnected.requestAndConnect).toHaveBeenCalledOnce();
    firstRender.unmount();

    const connected = controllerWith({ transport: { status: 'connected', device: { id: 'board', name: 'Homewall' } }, operation: 'idle', lastAppliedScene: null, error: null });
    render(<ClimbDetail definition={definition} climb={climb} controller={connected} />);
    fireEvent.click(screen.getByRole('button', { name: 'Light this climb' }));
    expect(connected.light).toHaveBeenCalledOnce();
    expect(connected.light).toHaveBeenCalledWith([
      { placementId: definition.placements[0].id, color: definition.rolePresets.start.lightColor },
      { placementId: definition.placements[1].id, color: 255 },
    ]);
  });

  it('labels an empty scene as a clear-board operation', () => {
    const connected = controllerWith({ transport: { status: 'connected', device: { id: 'board', name: null } }, operation: 'idle', lastAppliedScene: null, error: null });
    render(<ClimbDetail definition={definition} climb={{ ...climb, assignments: [] }} controller={connected} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear board' }));
    expect(connected.clear).toHaveBeenCalledOnce();
  });
});
