import { kilterFullride7x10Definition as fullride } from '../domain/boards/definitions/kilter-fullride-7x10';
import { createBoardTransform, nearestPlacement, placementInDirection } from './geometry';

describe('board geometry', () => {
  it('round-trips every Fullride point and inverts the vertical axis', () => {
    const transform = createBoardTransform(fullride);
    for (const placement of fullride.placements) {
      const svg = transform.toSvg(placement.position);
      const restored = transform.toBoard(svg);
      expect(restored.x).toBeCloseTo(placement.position.x);
      expect(restored.y).toBeCloseTo(placement.position.y);
    }
    expect(transform.toSvg({ x: 0, y: fullride.bounds.top }).y).toBeLessThan(
      transform.toSvg({ x: 0, y: fullride.bounds.bottom }).y,
    );
  });

  it('rejects invalid gutters and resolves only nearby placements', () => {
    expect(() => createBoardTransform(fullride, -1)).toThrow(RangeError);
    const first = fullride.placements[0];
    expect(nearestPlacement(fullride, first.position)).toBe(first.id);
    expect(
      nearestPlacement(fullride, { x: fullride.bounds.left, y: fullride.bounds.bottom }),
    ).toBeNull();
  });

  it('navigates spatially and stays put at an edge', () => {
    const first = fullride.placements[0];
    expect(placementInDirection(fullride, first.id, 'up')).not.toBe(first.id);
    expect(placementInDirection(fullride, first.id, 'left')).toBe(first.id);
  });
});
