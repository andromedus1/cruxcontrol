import { render } from '@testing-library/react';
import { apiLevel3Color } from '../domain/boards/colors';
import { kilterFullride7x10Definition as fullride } from '../domain/boards/definitions/kilter-fullride-7x10';
import { BoardRenderer } from './BoardRenderer';

it('composes the generated Fullride fixture without changing placement centers', () => {
  const assignments = fullride.placements.map((placement, index) => ({
    placementId: placement.id,
    appearance: { kind: 'custom' as const, color: apiLevel3Color(index % 256) },
  }));
  const { container } = render(<BoardRenderer definition={fullride} assignments={assignments} />);
  const groups = container.querySelectorAll<SVGGElement>('[data-placement-id]');
  expect(groups).toHaveLength(305);
  [0, 152, 304].forEach((index) => {
    expect(groups[index]).toHaveAttribute('data-placement-id', fullride.placements[index].id);
    expect(groups[index].getAttribute('transform')).toMatch(/^translate\(/);
  });
});
