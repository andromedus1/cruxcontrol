import type { ClimbRole } from '../domain/boards/definition';
import type { DetectedRing, ScreenshotImportWarning, ScreenshotPixels } from './types';

const REFERENCE_WIDTH = 1080;
const REFERENCE_HEIGHT = 2400;
// Keep analysis within twice the reference width and height (2,160×4,800,
// about 10.4 megapixels), which covers the supplied profile and ordinary
// phone screenshots while bounding canvas and detector memory use.
export const SCREENSHOT_MAX_WIDTH = REFERENCE_WIDTH * 2;
export const SCREENSHOT_MAX_HEIGHT = REFERENCE_HEIGHT * 2;
const REFERENCE_LEFT = 48.5;
const REFERENCE_TOP = 652;
const REFERENCE_PITCH = 49.05;
const MIN_COMPONENT_AREA = 80;
const MAX_PROTOTYPE_DISTANCE = 145;
const CONFIDENT_SNAP = 0.22;
const MAX_SNAP = 0.35;

// Measured from the supplied Kilter screenshots. These are source-screen colors,
// deliberately independent from the packed colors sent to the controller.
const PROTOTYPES: ReadonlyArray<
  readonly [role: ClimbRole, red: number, green: number, blue: number]
> = [
  ['middle', 0, 213, 245],
  ['start', 49, 230, 91],
  ['finish', 252, 78, 245],
  ['foot-only', 255, 249, 0],
];

interface PixelComponent {
  readonly role: ClimbRole;
  readonly area: number;
  readonly x: number;
  readonly y: number;
  readonly colorDistance: number;
}

function unsupportedProfile(pixels: ScreenshotPixels): ScreenshotImportWarning | null {
  const expectedRatio = REFERENCE_WIDTH / REFERENCE_HEIGHT;
  const ratio = pixels.width / pixels.height;
  if (
    !Number.isInteger(pixels.width) ||
    !Number.isInteger(pixels.height) ||
    pixels.width < 270 ||
    pixels.height < 600 ||
    pixels.width > SCREENSHOT_MAX_WIDTH ||
    pixels.height > SCREENSHOT_MAX_HEIGHT ||
    Math.abs(ratio / expectedRatio - 1) > 0.02 ||
    pixels.data.length !== pixels.width * pixels.height * 4
  ) {
    return {
      code: 'unsupported-profile',
      message: `Expected a Kilter Fullride screenshot between 270×600 and ${SCREENSHOT_MAX_WIDTH}×${SCREENSHOT_MAX_HEIGHT}; received ${pixels.width}×${pixels.height}.`,
    };
  }
  return null;
}

function classifyPixel(
  data: Uint8ClampedArray,
  offset: number,
): Readonly<{ prototype: number; distance: number }> | null {
  const alpha = data[offset + 3];
  if (alpha < 128) return null;
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const brightest = Math.max(red, green, blue);
  const darkest = Math.min(red, green, blue);
  if (brightest < 145 || brightest - darkest < 85) return null;

  let best = -1;
  let bestSquared = Number.POSITIVE_INFINITY;
  for (let index = 0; index < PROTOTYPES.length; index += 1) {
    const prototype = PROTOTYPES[index];
    const squared =
      (red - prototype[1]) ** 2 + (green - prototype[2]) ** 2 + (blue - prototype[3]) ** 2;
    if (squared < bestSquared) {
      best = index;
      bestSquared = squared;
    }
  }
  const distance = Math.sqrt(bestSquared);
  return distance <= MAX_PROTOTYPE_DISTANCE ? { prototype: best, distance } : null;
}

function connectedComponents(pixels: ScreenshotPixels): readonly PixelComponent[] {
  const { width, height, data } = pixels;
  const classes = new Int8Array(width * height).fill(-1);
  const distances = new Float32Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const classified = classifyPixel(data, index * 4);
    if (classified) {
      classes[index] = classified.prototype;
      distances[index] = classified.distance;
    }
  }

  const seen = new Uint8Array(width * height);
  const minimumArea = Math.max(
    5,
    Math.round(MIN_COMPONENT_AREA * (width / REFERENCE_WIDTH) * (height / REFERENCE_HEIGHT)),
  );
  const components: PixelComponent[] = [];
  for (let seed = 0; seed < classes.length; seed += 1) {
    if (classes[seed] < 0 || seen[seed]) continue;
    const prototype = classes[seed];
    const queue = [seed];
    seen[seed] = 1;
    let cursor = 0;
    let area = 0;
    let sumX = 0;
    let sumY = 0;
    let sumDistance = 0;
    while (cursor < queue.length) {
      const index = queue[cursor++];
      const x = index % width;
      const y = Math.floor(index / width);
      area += 1;
      sumX += x;
      sumY += y;
      sumDistance += distances[index];
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const neighborX = x + dx;
          const neighborY = y + dy;
          if (neighborX < 0 || neighborX >= width || neighborY < 0 || neighborY >= height) continue;
          const neighbor = neighborY * width + neighborX;
          if (!seen[neighbor] && classes[neighbor] === prototype) {
            seen[neighbor] = 1;
            queue.push(neighbor);
          }
        }
      }
    }
    if (area >= minimumArea) {
      components.push({
        role: PROTOTYPES[prototype][0],
        area,
        x: sumX / area,
        y: sumY / area,
        colorDistance: sumDistance / area,
      });
    }
  }
  return components;
}

function nearestCell(
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
): Readonly<{ column: number; row: number; distance: number }> {
  let nearest = { column: 0, row: 0, distance: Number.POSITIVE_INFINITY };
  for (let row = 0; row <= 28; row += 1) {
    for (let column = row % 2; column <= 20; column += 2) {
      const dx =
        (x - (REFERENCE_LEFT + REFERENCE_PITCH * column) * scaleX) / (REFERENCE_PITCH * scaleX);
      const dy =
        (y - (REFERENCE_TOP + REFERENCE_PITCH * row) * scaleY) / (REFERENCE_PITCH * scaleY);
      const distance = Math.hypot(dx, dy);
      if (distance < nearest.distance) nearest = { column, row, distance };
    }
  }
  return nearest;
}

export function detectKilterFullrideRings(pixels: ScreenshotPixels): Readonly<{
  rings: readonly DetectedRing[];
  warnings: readonly ScreenshotImportWarning[];
}> {
  const profileWarning = unsupportedProfile(pixels);
  if (profileWarning) return { rings: [], warnings: [profileWarning] };

  const scaleX = pixels.width / REFERENCE_WIDTH;
  const scaleY = pixels.height / REFERENCE_HEIGHT;
  const rings = new Map<string, DetectedRing>();
  const warnings: ScreenshotImportWarning[] = [];
  for (const component of connectedComponents(pixels)) {
    const cell = nearestCell(component.x, component.y, scaleX, scaleY);
    if (cell.distance > MAX_SNAP) {
      warnings.push({
        code: 'off-grid',
        role: component.role,
        centroid: { x: component.x, y: component.y },
        message: `Ignored an off-grid ${component.role} ring candidate.`,
      });
      continue;
    }
    const spatialConfidence = Math.max(0, 1 - cell.distance / MAX_SNAP);
    const colorConfidence = Math.max(0, 1 - component.colorDistance / MAX_PROTOTYPE_DISTANCE);
    const detected: DetectedRing = {
      column: cell.column,
      row: cell.row,
      role: component.role,
      confidence: Math.min(spatialConfidence, colorConfidence),
    };
    if (cell.distance > CONFIDENT_SNAP) {
      warnings.push({
        code: 'low-confidence',
        column: cell.column,
        row: cell.row,
        role: component.role,
        message: `The ${component.role} ring at column ${cell.column}, row ${cell.row} requires confirmation.`,
      });
    }
    const key = `${cell.column}:${cell.row}`;
    const existing = rings.get(key);
    if (existing) {
      warnings.push({
        code: 'duplicate-cell',
        column: cell.column,
        row: cell.row,
        message: `Multiple ring candidates mapped to column ${cell.column}, row ${cell.row}.`,
      });
      if (existing.confidence >= detected.confidence) continue;
    }
    rings.set(key, detected);
  }

  return {
    rings: [...rings.values()].sort((a, b) => a.row - b.row || a.column - b.column),
    warnings,
  };
}
