import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { kilterFullride7x10Definition as definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { LocalClimbViewer } from './LocalClimbViewer';
import { climbViewKey, type ClimbViewKey, type ClimbViewRecord } from './types';

const first: ClimbViewRecord = {
  key: climbViewKey('local:first'), name: 'Garage Circuit', angle: 40,
  assignments: [{ placementId: definition.placements[0].id, appearance: { kind: 'role', role: 'start' } }],
  origin: 'local-draft', grade: 'V4', setter: 'Andrew',
};

function Controlled({ climbs = [first] }: { climbs?: readonly ClimbViewRecord[] }) {
  const [selected, setSelected] = useState<ClimbViewKey | null>(null);
  return <LocalClimbViewer definition={definition} climbs={climbs} selectedKey={selected} onSelectedKeyChange={setSelected} />;
}

describe('LocalClimbViewer', () => {
  it('shows an honest empty state and injected create action', () => {
    const create = vi.fn();
    render(<LocalClimbViewer definition={definition} climbs={[]} selectedKey={null} onSelectedKeyChange={() => undefined} onCreateClimb={create} />);
    expect(screen.getByRole('heading', { name: 'No saved climbs yet' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create your first climb' }));
    expect(create).toHaveBeenCalledOnce();
  });

  it('uses controlled selection and renders truthful climb detail', () => {
    render(<Controlled />);
    fireEvent.click(screen.getByRole('button', { name: /Garage Circuit/ }));
    expect(screen.getByRole('heading', { name: 'Garage Circuit' })).toBeInTheDocument();
    expect(screen.getByText('V4')).toBeInTheDocument();
    expect(screen.getByText('Andrew')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Garage Circuit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Light this climb' })).toBeDisabled();
  });

  it('does not silently replace a stale selection', () => {
    render(<LocalClimbViewer definition={definition} climbs={[first]} selectedKey={climbViewKey('missing')} onSelectedKeyChange={() => undefined} />);
    expect(screen.getByText(/Select a saved climb/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Garage Circuit' })).not.toBeInTheDocument();
  });

  it('rejects duplicate keys and unsupported angles', () => {
    expect(() => render(<LocalClimbViewer definition={definition} climbs={[first, first]} selectedKey={null} onSelectedKeyChange={() => undefined} />)).toThrow('Duplicate');
    expect(() => render(<LocalClimbViewer definition={definition} climbs={[{ ...first, key: climbViewKey('bad'), angle: 37 }]} selectedKey={null} onSelectedKeyChange={() => undefined} />)).toThrow('unsupported angle');
  });
});
