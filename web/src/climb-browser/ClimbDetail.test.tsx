import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BoardLightController, BoardLightState } from '../board-control/light-controller';
import { kilterFullride7x10Definition as definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { ClimbDetail } from './ClimbDetail';
import { climbViewKey, type ClimbViewRecord } from './types';
import { createSpatialPreset } from '../light-effects/preset-library';
import type { ClimbNavigation } from './navigation';

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
    expect(screen.queryByRole('button', { name: 'Light this climb' })).not.toBeInTheDocument();
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
    await waitFor(() => expect(connected.preview).toHaveBeenCalledOnce());
    expect(connected.preview).toHaveBeenCalledWith([
      { placementId: definition.placements[0].id, color: definition.rolePresets.start.lightColor },
      { placementId: definition.placements[1].id, color: 255 },
    ]);
  });

  it('lights saved spatial effects through the shared animated scene', async () => {
    const connected = controllerWith({ transport: { status: 'connected', device: { id: 'board', name: 'Homewall' } }, operation: 'idle', lastAppliedScene: null, error: null });
    const animated = { ...climb, effectGroups: [createSpatialPreset('beach-ball', 7)] };
    render(<ClimbDetail definition={definition} climb={animated} controller={connected} />);
    await waitFor(() => expect(connected.preview).toHaveBeenCalledOnce());
    expect(vi.mocked(connected.preview).mock.calls[0]![0].length).toBeGreaterThan(climb.assignments.length);
  });

  it('automatically clears the board for an empty selection', async () => {
    const connected = controllerWith({ transport: { status: 'connected', device: { id: 'board', name: null } }, operation: 'idle', lastAppliedScene: null, error: null });
    render(<ClimbDetail definition={definition} climb={{ ...climb, assignments: [] }} controller={connected} />);
    await waitFor(() => expect(connected.preview).toHaveBeenCalledWith([]));
  });

  it('offers a lighting retry after a failed automatic scene and removes it after recovery', async () => {
    const controller = controllerWith({ transport: { status: 'connected', device: { id: 'board', name: 'Homewall' } }, operation: 'idle', lastAppliedScene: null, error: null });
    vi.mocked(controller.preview).mockRejectedValueOnce(new Error('Scene could not be sent.'));
    render(<ClimbDetail definition={definition} climb={climb} controller={controller} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry lighting' }));
    await waitFor(() => expect(controller.preview).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry lighting' })).not.toBeInTheDocument());
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
    expect(screen.getByText('Lighting this climb…')).toBeInTheDocument();
  });
});

function navigationAt(overrides: Partial<ClimbNavigation> = {}): ClimbNavigation {
  return {
    positionLabel: '2 of 3',
    canPrevious: true,
    canNext: true,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    ...overrides,
  };
}

function swipe(target: Element, dx: number) {
  fireEvent.pointerDown(target, { pointerId: 3, pointerType: 'touch', isPrimary: true, clientX: 200, clientY: 300 });
  fireEvent.pointerMove(target, { pointerId: 3, pointerType: 'touch', clientX: 200 + dx / 2, clientY: 302 });
  fireEvent.pointerUp(target, { pointerId: 3, pointerType: 'touch', clientX: 200 + dx, clientY: 304 });
}

function reducedMotion(reduce: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: reduce && query.includes('prefers-reduced-motion: reduce'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  }));
}

describe('ClimbDetail navigation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('has no navigation chrome without a list position', () => {
    render(<ClimbDetail definition={definition} climb={climb} />);
    expect(screen.queryByRole('navigation', { name: 'Climb navigation' })).not.toBeInTheDocument();
    expect(screen.getByRole('article')).not.toHaveAttribute('tabindex');
  });

  it('shows compact previous/next buttons with the position in a polite status', () => {
    const navigation = navigationAt({ positionLabel: '12 of 50+' });
    render(<ClimbDetail definition={definition} climb={climb} navigation={navigation} />);
    const status = screen.getByText('12 of 50+').closest('[role="status"]');
    expect(status).toHaveAttribute('aria-live', 'polite');
    fireEvent.click(screen.getByRole('button', { name: 'Previous climb' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next climb' }));
    expect(navigation.onPrevious).toHaveBeenCalledOnce();
    expect(navigation.onNext).toHaveBeenCalledOnce();
  });

  it('moves with swipes anywhere on the detail, including the board', () => {
    const navigation = navigationAt();
    render(<ClimbDetail definition={definition} climb={climb} navigation={navigation} />);
    swipe(screen.getByRole('img', { name: 'Color Study' }), -90);
    swipe(screen.getByRole('heading', { name: 'Color Study' }), 90);
    expect(navigation.onNext).toHaveBeenCalledOnce();
    expect(navigation.onPrevious).toHaveBeenCalledOnce();
  });

  it('moves with ArrowLeft/ArrowRight only while focus is in the detail and without modifiers', () => {
    const navigation = navigationAt();
    render(
      <>
        <button type="button">Outside</button>
        <ClimbDetail definition={definition} climb={climb} navigation={navigation} onEdit={vi.fn()} />
      </>,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'Outside' }), { key: 'ArrowRight' });
    expect(navigation.onNext).not.toHaveBeenCalled();
    const edit = screen.getByRole('button', { name: 'Edit climb' });
    edit.focus();
    fireEvent.keyDown(edit, { key: 'ArrowRight', shiftKey: true });
    expect(navigation.onNext).not.toHaveBeenCalled();
    fireEvent.keyDown(edit, { key: 'ArrowRight' });
    expect(navigation.onNext).toHaveBeenCalledOnce();
    // Focus moves off content that remounts for the next climb, onto the detail itself.
    expect(screen.getByRole('article')).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('article'), { key: 'ArrowLeft' });
    expect(navigation.onPrevious).toHaveBeenCalledOnce();
    const next = screen.getByRole('button', { name: 'Next climb' });
    next.focus();
    fireEvent.keyDown(next, { key: 'ArrowRight' });
    expect(navigation.onNext).toHaveBeenCalledTimes(2);
    expect(next).toHaveFocus();
  });

  it('stops at the ends with a nudge and a First climb / Last climb announcement', () => {
    vi.useFakeTimers();
    reducedMotion(false);
    const navigation = navigationAt({ positionLabel: '3 of 3', canNext: false });
    render(<ClimbDetail definition={definition} climb={climb} navigation={navigation} />);
    const next = screen.getByRole('button', { name: 'Next climb' });
    expect(next).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Previous climb' })).not.toHaveAttribute('aria-disabled');
    fireEvent.click(next);
    expect(navigation.onNext).not.toHaveBeenCalled();
    expect(screen.getByText('3 of 3').closest('[role="status"]')).toHaveTextContent('3 of 3 · Last climb');
    expect(screen.getByRole('article')).toHaveClass('climb-swipe-zone--nudge-next');
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByRole('article')).not.toHaveClass('climb-swipe-zone--nudge-next');
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(screen.queryByText(/Last climb/)).not.toBeInTheDocument();
  });

  it('announces the first climb without the nudge when reduced motion is requested', () => {
    reducedMotion(true);
    const navigation = navigationAt({ positionLabel: '1 of 3', canPrevious: false });
    render(<ClimbDetail definition={definition} climb={climb} navigation={navigation} />);
    swipe(screen.getByRole('article'), 90);
    expect(navigation.onPrevious).not.toHaveBeenCalled();
    expect(screen.getByText(/First climb/)).toBeInTheDocument();
    expect(screen.getByRole('article').className).not.toMatch(/nudge/);
  });

  it('announces the end when a surface discovers asynchronously that nothing follows', async () => {
    const navigation = navigationAt({ positionLabel: '25 of 25+', onNext: vi.fn(async () => false) });
    render(<ClimbDetail definition={definition} climb={climb} navigation={navigation} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next climb' }));
    expect(await screen.findByText(/Last climb/)).toBeInTheDocument();
  });
});
