import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
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

function Controlled({ climbs = [first] }: { climbs?: readonly ClimbViewRecord[] }) {
  const [selected, setSelected] = useState<ClimbViewKey | null>(null);
  return (
    <LocalClimbViewer
      {...copy}
      definition={definition}
      climbs={climbs}
      selectedKey={selected}
      onSelectedKeyChange={setSelected}
    />
  );
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
    expect(screen.getByText(/Select a saved climb/)).toBeInTheDocument();
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
});
