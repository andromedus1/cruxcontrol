import { fireEvent, render } from '@testing-library/react';
import { apiLevel3Color } from '../domain/boards/colors';
import { kilterFullride7x10Definition as fullride } from '../domain/boards/definitions/kilter-fullride-7x10';
import { boardDefinitionId } from '../domain/boards/identity';
import { BoardRenderer } from './BoardRenderer';

it('composes the generated Fullride fixture without changing placement centers', () => {
  const assignments = fullride.placements.map((placement, index) => ({
    placementId: placement.id,
    appearance: { kind: 'custom' as const, color: apiLevel3Color(index % 256) },
  }));
  const { container } = render(<BoardRenderer definition={fullride} assignments={assignments} />);
  const groups = container.querySelectorAll<SVGGElement>('[data-placement-id]');
  expect(groups).toHaveLength(305);
  groups.forEach((group, index) => {
    const placement = fullride.placements[index];
    const positionedGroup = group.parentElement?.parentElement;
    expect(group).toHaveAttribute('data-placement-id', placement.id);
    expect(positionedGroup).toHaveAttribute(
      'transform',
      `translate(${placement.position.x + 48} ${148 - placement.position.y})`,
    );
  });
  [0, 152, 304].forEach((index) => {
    expect(groups[index]).toHaveAttribute('data-placement-id', fullride.placements[index].id);
  });
});

it('replaces schematic bodies with one calibrated image only after it loads', () => {
  const assignments = fullride.placements.map((placement, index) => ({
    placementId: placement.id,
    appearance: { kind: 'custom' as const, color: apiLevel3Color(index % 256) },
  }));
  const { container } = render(<BoardRenderer definition={fullride} assignments={assignments} />);
  const image = container.querySelector('[data-board-raster-artwork]');
  expect(image).toBeInTheDocument();
  expect(container.querySelectorAll('[data-board-raster-artwork]')).toHaveLength(1);
  expect(container.querySelectorAll('.board-hold__body')).toHaveLength(305);
  expect(container.querySelectorAll('[data-placement-id]')).toHaveLength(305);

  fireEvent.load(image!);
  expect(container.querySelectorAll('[data-board-raster-artwork]')).toHaveLength(1);
  expect(container.querySelectorAll('[data-placement-id]')).toHaveLength(305);
  expect(container.querySelectorAll('.board-hold__body')).toHaveLength(0);
  expect(container.querySelectorAll('.board-hold__hit-target')).toHaveLength(305);
  expect(container.querySelectorAll('.board-hold__selection-halo')).toHaveLength(305);
  expect(container.querySelectorAll('.board-hold__selection-ring')).toHaveLength(305);
  expect(container.querySelectorAll('.board-hold__custom-marker')).toHaveLength(305);
});

it('keeps the complete schematic fallback after raster load failure', () => {
  const { container } = render(<BoardRenderer definition={fullride} />);
  const image = container.querySelector('[data-board-raster-artwork]');
  fireEvent.error(image!);
  expect(container.querySelectorAll('.board-hold__body')).toHaveLength(305);
  expect(container.querySelectorAll('[data-placement-id]')).toHaveLength(305);
});

it('uses no private raster for a different definition identity', () => {
  const definition = { ...fullride, id: boardDefinitionId('synthetic-fullride') };
  const { container } = render(<BoardRenderer definition={definition} />);
  expect(container.querySelectorAll('[data-board-raster-artwork]')).toHaveLength(0);
  expect(container.querySelectorAll('.board-hold__body')).toHaveLength(305);
  expect(container.querySelectorAll('[data-placement-id]')).toHaveLength(305);
});
