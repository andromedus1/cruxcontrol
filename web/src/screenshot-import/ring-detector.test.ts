import { describe, expect, it } from 'vitest';
import type { ClimbRole } from '../domain/boards/definition';
import { detectKilterFullrideRings } from './ring-detector';
import type { ScreenshotPixels } from './types';

const COLORS: Readonly<Record<ClimbRole, readonly [number, number, number]>> = {
  middle: [0, 213, 245],
  start: [49, 230, 91],
  finish: [252, 78, 245],
  'foot-only': [255, 249, 0],
};

function pixels(width = 270, height = 600): ScreenshotPixels {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

function center(column: number, row: number, width: number, height: number) {
  return {
    x: ((48.5 + 49.05 * column) * width) / 1080,
    y: ((652 + 49.05 * row) * height) / 2400,
  };
}

function disc(
  target: ScreenshotPixels,
  x: number,
  y: number,
  role: ClimbRole,
  options: Readonly<{ radius?: number; alpha?: number; variation?: number }> = {},
) {
  const radius = options.radius ?? 2;
  const color = COLORS[role];
  for (let py = Math.floor(y - radius); py <= Math.ceil(y + radius); py += 1) {
    for (let px = Math.floor(x - radius); px <= Math.ceil(x + radius); px += 1) {
      if (px < 0 || px >= target.width || py < 0 || py >= target.height) continue;
      if ((px - x) ** 2 + (py - y) ** 2 > radius ** 2) continue;
      const offset = (py * target.width + px) * 4;
      const variation = (((px + py) % 3) - 1) * (options.variation ?? 0);
      target.data[offset] = color[0] + variation;
      target.data[offset + 1] = color[1] + variation;
      target.data[offset + 2] = color[2] + variation;
      target.data[offset + 3] = options.alpha ?? 255;
    }
  }
}

describe('detectKilterFullrideRings', () => {
  it('recognizes all roles at edge cells with scaled geometry and mild pixel noise', () => {
    const image = pixels();
    const expected = [
      [0, 0, 'finish'],
      [20, 0, 'middle'],
      [1, 1, 'start'],
      [20, 28, 'foot-only'],
    ] as const;
    for (const [column, row, role] of expected) {
      const point = center(column, row, image.width, image.height);
      disc(image, point.x + 0.6, point.y - 0.4, role, { variation: 12 });
    }
    const result = detectKilterFullrideRings(image);
    expect(result.warnings).toEqual([]);
    expect(result.rings.map(({ column, row, role }) => [column, row, role])).toEqual(expected);
  });

  it('ignores transparent ring-colored pixels', () => {
    const image = pixels();
    const point = center(10, 10, image.width, image.height);
    disc(image, point.x, point.y, 'middle', { alpha: 60 });
    expect(detectKilterFullrideRings(image)).toEqual({ rings: [], warnings: [] });
  });

  it('separates confident, low-confidence, and rejected snapping deterministically', () => {
    const image = pixels();
    const pitch = (49.05 * image.width) / 1080;
    const confident = center(4, 4, image.width, image.height);
    const low = center(8, 8, image.width, image.height);
    const rejected = center(12, 12, image.width, image.height);
    disc(image, confident.x + pitch * 0.1, confident.y, 'start');
    disc(image, low.x + pitch * 0.26, low.y, 'middle');
    disc(image, rejected.x + pitch * 0.42, rejected.y, 'finish');

    const result = detectKilterFullrideRings(image);
    expect(result.rings.map(({ column, row }) => [column, row])).toEqual([
      [4, 4],
      [8, 8],
    ]);
    expect(result.warnings.map((warning) => warning.code)).toEqual(['low-confidence', 'off-grid']);
  });

  it('reports multiple disconnected components that snap to the same cell', () => {
    const image = pixels();
    const pitch = (49.05 * image.width) / 1080;
    const point = center(10, 10, image.width, image.height);
    disc(image, point.x - pitch * 0.26, point.y, 'middle');
    disc(image, point.x + pitch * 0.26, point.y, 'finish');
    const result = detectKilterFullrideRings(image);
    expect(result.rings).toHaveLength(1);
    expect(result.warnings.some((warning) => warning.code === 'duplicate-cell')).toBe(true);
  });

  it('rejects unsupported dimensions and malformed pixel buffers', () => {
    const result = detectKilterFullrideRings({
      width: 600,
      height: 600,
      data: new Uint8ClampedArray(4),
    });
    expect(result.rings).toEqual([]);
    expect(result.warnings[0]?.code).toBe('unsupported-profile');
  });

  it.each([[2161, 4800], [2160, 4801]])('rejects %i×%i before reading pixel data or allocating detector buffers', (width, height) => {
    const result = detectKilterFullrideRings({
      width,
      height,
      get data(): Uint8ClampedArray {
        throw new Error('Oversized images must be rejected before pixel access');
      },
    });
    expect(result.rings).toEqual([]);
    expect(result.warnings[0]?.code).toBe('unsupported-profile');
  });
});
