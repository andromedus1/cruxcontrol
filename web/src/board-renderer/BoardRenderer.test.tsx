import { fireEvent, render, screen } from '@testing-library/react';
import { apiLevel3Color } from '../domain/boards/colors';
import { kilterFullride7x10Definition as fullride } from '../domain/boards/definitions/kilter-fullride-7x10';
import { BoardRenderer } from './BoardRenderer';

describe('BoardRenderer', () => {
  it('renders all holds with no tab stops in view mode', () => {
    const { container } = render(<BoardRenderer definition={fullride} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(/Fullride 7x10/);
    expect(container.querySelectorAll('[data-placement-id]')).toHaveLength(305);
    expect(container.querySelectorAll('[tabindex]')).toHaveLength(0);
  });

  it('labels roles and arbitrary quantized colors', () => {
    const placements = fullride.placements;
    render(
      <BoardRenderer
        definition={fullride}
        interactionMode="select"
        assignments={[
          { placementId: placements[0].id, appearance: { kind: 'role', role: 'start' } },
          { placementId: placements[1].id, appearance: { kind: 'role', role: 'middle' } },
          { placementId: placements[2].id, appearance: { kind: 'role', role: 'finish' } },
          { placementId: placements[3].id, appearance: { kind: 'role', role: 'foot-only' } },
          {
            placementId: placements[4].id,
            appearance: { kind: 'custom', color: apiLevel3Color(0) },
          },
          {
            placementId: placements[5].id,
            appearance: { kind: 'custom', color: apiLevel3Color(255) },
          },
        ]}
      />,
    );
    expect(screen.getByRole('gridcell', { name: /Hold 1, Start/ })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: /Middle/ })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: /Finish/ })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: /Foot-only/ })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: /Custom #000000/ })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: /Custom #FFFFFF/ })).toBeInTheDocument();
  });

  it('uses one roving focus and activates through keyboard navigation', () => {
    const activated = vi.fn();
    const { container } = render(
      <BoardRenderer
        definition={fullride}
        interactionMode="select"
        onPlacementActivate={activated}
      />,
    );
    expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    const first = screen.getByRole('gridcell', { name: /Hold 1,/ });
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    const focused = document.activeElement as SVGGElement;
    expect(focused).not.toBe(first);
    fireEvent.keyDown(focused, { key: 'Enter' });
    expect(activated).toHaveBeenCalledOnce();
    expect(activated).toHaveBeenCalledWith(focused.dataset.placementId);
  });

  it('converts pointer coordinates and ignores taps when CTM is unavailable', () => {
    const activated = vi.fn();
    render(
      <BoardRenderer
        definition={fullride}
        interactionMode="select"
        scale={2.5}
        onPlacementActivate={activated}
      />,
    );
    const svg = screen.getByRole('grid') as unknown as SVGSVGElement;
    Object.defineProperty(svg, 'createSVGPoint', {
      value: () => ({
        x: 0,
        y: 0,
        matrixTransform() {
          return { x: 8, y: 120 };
        },
      }),
    });
    Object.defineProperty(svg, 'getScreenCTM', {
      configurable: true,
      value: () => ({ inverse: () => ({}) }),
    });
    fireEvent.click(svg, { clientX: 12, clientY: 20 });
    expect(activated).toHaveBeenCalledWith(fullride.placements[0].id);
    Object.defineProperty(svg, 'getScreenCTM', { configurable: true, value: () => null });
    fireEvent.click(svg);
    expect(activated).toHaveBeenCalledOnce();
  });

  it('rejects invalid editor scales', () => {
    expect(() => render(<BoardRenderer definition={fullride} scale={3.1} />)).toThrow(RangeError);
  });
});
