import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { BoardLightController, BoardLightState } from '../board-control/light-controller';
import { kilterFullride7x10Definition as definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { LocalClimbViewer } from './LocalClimbViewer';
import { climbViewKey, type ClimbViewKey, type ClimbViewRecord } from './types';

const first: ClimbViewRecord = {
  key: climbViewKey('local:first'),
  name: 'Garage Circuit',
  angle: 40,
  assignments: [
    { placementId: definition.placements[0].id, appearance: { kind: 'role', role: 'start' } },
  ],
  origin: 'local-draft',
  grade: 'V4',
  setter: 'Andrew',
};

const copy = {
  heading: 'Drafts',
  emptyTitle: 'No drafts yet',
  emptyDescription: 'Create a climb to get started.',
};

const second: ClimbViewRecord = {
  ...first,
  key: climbViewKey('local:second'),
  name: 'Basement Traverse',
  assignments: [{ placementId: definition.placements[1].id, appearance: { kind: 'role', role: 'start' } }],
};
const third: ClimbViewRecord = {
  ...first,
  key: climbViewKey('local:third'),
  name: 'Attic Project',
  assignments: [{ placementId: definition.placements[2].id, appearance: { kind: 'role', role: 'finish' } }],
};

function Controlled({
  climbs = [first],
  controller,
}: {
  climbs?: readonly ClimbViewRecord[];
  controller?: BoardLightController;
}) {
  const [selected, setSelected] = useState<ClimbViewKey | null>(null);
  return (
    <LocalClimbViewer
      {...copy}
      definition={definition}
      climbs={climbs}
      selectedKey={selected}
      onSelectedKeyChange={setSelected}
      controller={controller}
    />
  );
}

function connectedController(): BoardLightController {
  const state: BoardLightState = {
    transport: { status: 'connected', device: { id: 'board', name: 'Homewall' } },
    operation: 'idle',
    lastAppliedScene: null,
    error: null,
  };
  return {
    getState: () => state,
    subscribe: () => () => undefined,
    requestAndConnect: vi.fn(),
    reconnect: vi.fn(),
    disconnect: vi.fn(),
    light: vi.fn(),
    clear: vi.fn(),
    preview: vi.fn().mockResolvedValue({ status: 'applied' }),
  };
}

function swipe(target: Element, dx: number) {
  fireEvent.pointerDown(target, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 200, clientY: 300 });
  fireEvent.pointerUp(target, { pointerId: 1, pointerType: 'touch', clientX: 200 + dx, clientY: 300 });
}

describe('LocalClimbViewer', () => {
  it('shows an honest empty state and injected create action', () => {
    const create = vi.fn();
    render(
      <LocalClimbViewer
        {...copy}
        definition={definition}
        climbs={[]}
        selectedKey={null}
        onSelectedKeyChange={() => undefined}
        onCreateClimb={create}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Drafts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No drafts yet' })).toBeInTheDocument();
    expect(screen.getByText('Create a climb to get started.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create your first climb' }));
    expect(create).toHaveBeenCalledOnce();
  });

  it('renders optional composition slots around the existing climb list', () => {
    render(
      <LocalClimbViewer
        {...copy}
        definition={definition}
        climbs={[first]}
        selectedKey={null}
        onSelectedKeyChange={() => undefined}
        listHeader={<label>Catalog name <input aria-label="Catalog name" /></label>}
        listFooter={<button type="button">Next catalog page</button>}
      />,
    );

    expect(screen.getByLabelText('Catalog name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Garage Circuit/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next catalog page' })).toBeInTheDocument();
  });

  it('binds contextual primary and destructive actions to the selected climb', () => {
    const primary = vi.fn();
    const destructive = vi.fn();
    render(
      <LocalClimbViewer
        {...copy}
        definition={definition}
        climbs={[first]}
        selectedKey={first.key}
        onSelectedKeyChange={() => undefined}
        primaryAction={{ label: 'Mark finished', onActivate: primary }}
        destructiveAction={{ label: 'Move to trash', onActivate: destructive }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark finished' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move to trash' }));
    expect(primary).toHaveBeenCalledWith(first.key);
    expect(destructive).toHaveBeenCalledWith(first.key);
  });

  it('uses controlled selection and renders truthful climb detail', () => {
    render(<Controlled />);
    fireEvent.click(screen.getByRole('button', { name: /Garage Circuit/ }));
    expect(screen.getByRole('heading', { name: 'Garage Circuit' })).toBeInTheDocument();
    expect(screen.getByText('V4')).toBeInTheDocument();
    expect(screen.getByText('Andrew')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Garage Circuit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Light this climb' })).not.toBeInTheDocument();
  });

  it('does not silently replace a stale selection', () => {
    render(
      <LocalClimbViewer
        {...copy}
        definition={definition}
        climbs={[first]}
        selectedKey={climbViewKey('missing')}
        onSelectedKeyChange={() => undefined}
      />,
    );
    expect(screen.getByText(/Select a climb/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Garage Circuit' })).not.toBeInTheDocument();
  });

  it('rejects duplicate keys and unsupported angles', () => {
    expect(() =>
      render(
        <LocalClimbViewer
          {...copy}
          definition={definition}
          climbs={[first, first]}
          selectedKey={null}
          onSelectedKeyChange={() => undefined}
        />,
      ),
    ).toThrow('Duplicate');
    expect(() =>
      render(
        <LocalClimbViewer
          {...copy}
          definition={definition}
          climbs={[{ ...first, key: climbViewKey('bad'), angle: 37 }]}
          selectedKey={null}
          onSelectedKeyChange={() => undefined}
        />,
      ),
    ).toThrow('unsupported angle');
  });

  it('preserves modal semantics across phone and desktop transitions and returns focus', async () => {
    let desktop = false;
    const listeners = new Set<EventListener>();
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      get matches() {
        return query.includes('min-width') ? desktop : !desktop;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === 'function') listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === 'function') listeners.delete(listener);
      },
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    }));
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    render(<Controlled />);

    const row = screen.getByRole('button', { name: /Garage Circuit/ });
    row.focus();
    fireEvent.click(row);
    const dialog = screen.getByRole('dialog');
    expect(showModal).toHaveBeenCalledOnce();

    const setDesktop = (value: boolean) => {
      desktop = value;
      act(() => {
        for (const listener of listeners) listener(new Event('change'));
      });
    };
    setDesktop(true);
    expect(dialog).toHaveAttribute('open');
    setDesktop(false);
    expect(showModal).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'Close climb details' }));
    await waitFor(() => expect(row).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves to neighbors in the list order shown with buttons, keys and swipes', async () => {
    render(<Controlled climbs={[first, second, third]} />);
    const firstRow = screen.getByRole('button', { name: /Garage Circuit/ });
    fireEvent.click(firstRow);
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous climb' })).toHaveAttribute('aria-disabled', 'true');

    const next = screen.getByRole('button', { name: 'Next climb' });
    next.focus();
    fireEvent.click(next);
    expect(screen.getByRole('heading', { name: 'Basement Traverse' })).toBeInTheDocument();
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Basement Traverse/ })).toHaveAttribute('aria-current', 'true');
    // The header control stays mounted, so keyboard focus survives the move.
    expect(next).toBeInTheDocument();
    expect(next).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Next climb' }), { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: 'Attic Project' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Next climb' }), { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: 'Attic Project' })).toBeInTheDocument();
    expect(screen.getByText('3 of 3').closest('[role="status"]')).toHaveTextContent('Last climb');

    swipe(screen.getByRole('img', { name: 'Attic Project' }), 100);
    expect(screen.getByRole('heading', { name: 'Basement Traverse' })).toBeInTheDocument();

    // Close returns focus to the climb now shown, not the one first opened.
    fireEvent.click(screen.getByRole('button', { name: 'Close climb details' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Basement Traverse/ })).toHaveFocus());
  });

  it('relights the board for the climb moved to, like selecting it from the list', async () => {
    const controller = connectedController();
    render(<Controlled climbs={[first, second]} controller={controller} />);
    fireEvent.click(screen.getByRole('button', { name: /Garage Circuit/ }));
    await waitFor(() => expect(controller.preview).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Next climb' }));
    await waitFor(() => expect(controller.preview).toHaveBeenCalledTimes(2));
    expect(controller.preview).toHaveBeenLastCalledWith([
      { placementId: definition.placements[1].id, color: definition.rolePresets.start.lightColor },
    ]);
  });

  it('lets fast moves light only the climb where they stop', async () => {
    vi.useFakeTimers();
    try {
      const controller = connectedController();
      render(<Controlled climbs={[first, second, third]} controller={controller} />);
      fireEvent.click(screen.getByRole('button', { name: /Garage Circuit/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Next climb' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next climb' }));
      await act(async () => { await vi.advanceTimersByTimeAsync(400); });
      expect(controller.preview).toHaveBeenCalledOnce();
      expect(controller.preview).toHaveBeenCalledWith([
        { placementId: definition.placements[2].id, color: definition.rolePresets.finish.lightColor },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses a caller navigation override, or none', () => {
    const onNext = vi.fn();
    const view = render(
      <LocalClimbViewer
        {...copy}
        definition={definition}
        climbs={[first]}
        selectedKey={first.key}
        onSelectedKeyChange={() => undefined}
        navigationOverride={{ positionLabel: '26 of 50+', canPrevious: true, canNext: true, onPrevious: vi.fn(), onNext }}
      />,
    );
    expect(screen.getByText('26 of 50+')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next climb' }));
    expect(onNext).toHaveBeenCalledOnce();
    view.rerender(
      <LocalClimbViewer
        {...copy}
        definition={definition}
        climbs={[first]}
        selectedKey={first.key}
        onSelectedKeyChange={() => undefined}
        navigationOverride={null}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Next climb' })).not.toBeInTheDocument();
  });
});
