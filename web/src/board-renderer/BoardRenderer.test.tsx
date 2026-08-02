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
    expect(screen.getAllByRole('row')).toHaveLength(305);
    expect(screen.getAllByRole('gridcell')).toHaveLength(305);
    expect(screen.getByRole('button', { name: /Hold 1, Start/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Middle/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Finish/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Foot-only/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Custom #000000/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Custom #FFFFFF/ })).toBeInTheDocument();
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
    const first = screen.getByRole('button', { name: /Hold 1,/ });
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    const focused = document.activeElement as SVGGElement;
    expect(focused).not.toBe(first);
    fireEvent.keyDown(focused, { key: 'Enter' });
    expect(activated).toHaveBeenCalledOnce();
    expect(activated).toHaveBeenCalledWith(focused.dataset.placementId);

    fireEvent.keyDown(focused, { key: 'Home' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'End' });
    const last = screen.getByRole('button', { name: /Hold 305,/ });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: ' ' });
    expect(activated).toHaveBeenLastCalledWith(fullride.placements[304].id);
    expect(activated).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
  });

  it('converts responsive pointer coordinates for first, middle, and last holds', () => {
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
      value: () => {
        const point = {
          x: 0,
          y: 0,
          matrixTransform(matrix: { transformPoint(value: { x: number; y: number }): DOMPoint }) {
            return matrix.transformPoint(point);
          },
        };
        return point;
      },
    });
    Object.defineProperty(svg, 'getScreenCTM', {
      configurable: true,
      value: () => ({
        inverse: () => ({
          transformPoint: ({ x, y }: { x: number; y: number }) => ({
            x: (x - 20) / 2,
            y: (y - 40) / 2,
          }),
        }),
      }),
    });
    const cases = [
      { index: 0, clientX: 36, clientY: 280 },
      { index: 152, clientX: 116, clientY: 168 },
      { index: 304, clientX: 196, clientY: 56 },
    ];
    for (const testCase of cases) {
      fireEvent.click(svg, { clientX: testCase.clientX, clientY: testCase.clientY });
      expect(activated).toHaveBeenLastCalledWith(fullride.placements[testCase.index].id);
    }
    fireEvent.click(svg, { clientX: 20, clientY: 40 });
    expect(activated).toHaveBeenCalledTimes(3);

    Object.defineProperty(svg, 'getScreenCTM', { configurable: true, value: () => null });
    fireEvent.click(svg, { clientX: 36, clientY: 280 });
    expect(activated).toHaveBeenCalledTimes(3);
  });

  it('rejects invalid editor scales', () => {
    expect(() => render(<BoardRenderer definition={fullride} scale={3.1} />)).toThrow(RangeError);
  });
});
