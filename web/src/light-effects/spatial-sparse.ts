import type { SpatialLightEffectGroup } from '../board-renderer/types';
import { packApiLevel3Color, unpackApiLevel3Color } from '../domain/boards/colors';
import type { BoardDefinition } from '../domain/boards/definition';
import type { LightScene } from '../domain/boards/light-scene';
import type { ApiLevel3Color } from '../domain/boards/types';
import { spatialDisplayColor } from './spatial-colors';
import type { SpatialLoopClock } from './spatial-frame-v2';
import type { SpatialPoint } from './spatial-geometry';

const tau = Math.PI * 2;
const fraction = (value: number) => ((value % 1) + 1) % 1;
const seedFraction = (seed: number) => fraction(Math.sin(seed * 12.9898) * 43758.5453);

interface Target {
  readonly x: number;
  readonly y: number;
  readonly brightness: number;
  readonly paletteIndex: number;
  readonly white?: number;
  readonly point?: SpatialPoint;
}

interface RainLanes {
  readonly points: readonly SpatialPoint[];
  readonly lanes: readonly (readonly SpatialPoint[])[];
}
const rainLaneCache = new WeakMap<SpatialLightEffectGroup, RainLanes>();

function rainLanes(group: SpatialLightEffectGroup, points: readonly SpatialPoint[]): readonly (readonly SpatialPoint[])[] {
  const cached = rainLaneCache.get(group);
  if (cached?.points === points) return cached.lanes;
  if (group.recipe.kind !== 'matrix-rain') return [];
  const xs = [...new Set(points.map(({ x }) => x))].sort((a, b) => a - b);
  const count = Math.min(group.recipe.columns, xs.length);
  const lanes = Array.from({ length: count }, (_, index) => {
    const x = xs[Math.floor((index + .5) * xs.length / count)]!;
    return points.filter((point) => point.x === x).sort((a, b) => b.y - a.y);
  });
  rainLaneCache.set(group, { points, lanes });
  return lanes;
}

function rainTargets(group: SpatialLightEffectGroup, points: readonly SpatialPoint[], clock: SpatialLoopClock): Target[] {
  if (group.recipe.kind !== 'matrix-rain') return [];
  const lanes = rainLanes(group, points);
  // Spend scarce lights on readable trails before adding another stream.
  const count = Math.min(3, lanes.length, Math.max(1, Math.floor(group.footprint / 3)));
  const targets: Target[] = [];
  const offset = seedFraction(group.seed);
  for (let stream = 0; stream < count; stream += 1) {
    const length = Math.floor(group.footprint / count) + (stream < group.footprint % count ? 1 : 0);
    const cycles = 6 - stream;
    const phase = clock.phase * cycles + [.13, .57, .81][stream]! + offset;
    const fall = Math.floor(phase) % cycles;
    // Each stream owns a disjoint part of the authored lane pool. A new lane
    // is selected only after the complete trail has left and a dark gap passes.
    const pool = lanes.filter((_, index) => index % count === stream);
    const lane = pool[(fall + Math.floor(offset * pool.length)) % pool.length]!;
    const step = Math.floor(fraction(phase) * (lane.length + length * 2 + 4)) - length;
    for (let tail = 0; tail < length; tail += 1) {
      const row = step - tail;
      if (row < 0 || row >= lane.length) continue;
      const point = lane[group.recipe.direction === 'down' ? row : lane.length - 1 - row]!;
      const shimmer = tail > 0 && (clock.frame + row) % 5 === 0 ? .85 : 1;
      targets.push({ ...point, point, brightness: (tail === 0 ? 1 : .78 * .66 ** (tail - 1)) * shimmer,
        paletteIndex: Math.round((1 - tail / Math.max(1, length - 1)) * (group.palette.length - 1)),
        white: tail === 0 ? .72 : 0 });
    }
  }
  return targets;
}

/** Approved sparse studies sampled only at the board's held pose clock. */
function naturalTargets(group: SpatialLightEffectGroup, clock: SpatialLoopClock): Target[] {
  const targets: Target[] = [];
  const p = clock.phase;
  const seed = seedFraction(group.seed);
  const add = (x: number, y: number, brightness: number, paletteIndex: number, white = 0) => {
    targets.push({ x, y, brightness, paletteIndex, white });
  };
  switch (group.recipe.kind) {
    case 'fireflies':
      for (let n = 0; n < Math.min(8, group.footprint); n += 1) {
        const phase = p * 8 + n * .04 + seed;
        const cycle = Math.floor(phase) % 8;
        const q = fraction(phase);
        const brightness = q > .12 && q < .44 ? Math.sin((q - .12) / .32 * Math.PI) : 0;
        add(.1 + fraction(n * .381 + cycle * .173 + seed) * .8,
          .16 + fraction(n * .217 + cycle * .293 + seed * .37) * .72, brightness, n);
      }
      break;
    case 'shooting-stars': {
      const phase = p * 8;
      const pass = Math.floor(phase);
      const q = fraction(phase);
      const direction = pass % 2 ? 1 : -1;
      if (q > .15 && q < .65) {
        const u = (q - .15) / .5;
        const start = .25 + fraction(pass * .27 + seed) * .5;
        for (let tail = 0; tail < Math.min(6, group.footprint); tail += 1) {
          const h = u - tail * .04;
          add(start + direction * (h - .2) * .65, 1.15 - h * 1.5,
            // Keep the final blue tail above RGB332's first visible step.
            [1, .8, .6, .45, .32, .26][tail]!, pass, tail === 0 ? .65 : 0);
        }
      }
      break;
    }
    case 'jellyfish': {
      const pulse = .5 + .5 * Math.cos(tau * (p * 24 + seed));
      const x = .5 + .22 * Math.sin(tau * (p + seed));
      const y = .57 + .12 * Math.cos(tau * (p * 2 + seed));
      const width = .065 + .025 * pulse;
      for (let n = 0; n < 5; n += 1) {
        const angle = Math.PI * n / 4;
        add(x + Math.cos(angle) * width, y + Math.sin(angle) * .065, .7 + .3 * pulse, n);
      }
      for (let n = 0; n < 4; n += 1) {
        const side = n % 2 ? 1 : -1;
        const depth = Math.floor(n / 2) + 1;
        add(x + side * .045 + .015 * Math.sin(tau * (p * 24 + seed) - depth), y - depth * .07, .55, n);
      }
      break;
    }
    case 'embers':
      for (let n = 0; n < 6; n += 1) {
        add(.34 + n * .065, .08 + (n % 2) * .065,
          .45 + .4 * (.5 + .5 * Math.sin(tau * (p * (7 + n) + n * .23 + seed))), n);
      }
      for (let n = 0; n < 4; n += 1) {
        const q = fraction(p * (5 + n) + n * .23 + seed);
        if (q < .85) add(.4 + n * .055 + .07 * Math.sin(q * 4 + n), .2 + q * .58,
          Math.sin(q / .85 * Math.PI) * .85, n);
      }
      break;
  }
  return targets;
}

function displayColor(definition: BoardDefinition, group: SpatialLightEffectGroup, target: Target): ApiLevel3Color {
  const rgb = unpackApiLevel3Color(group.palette[target.paletteIndex % group.palette.length]!);
  // Matrix's old palette includes very dark greens. Trail age now owns the
  // fade, so normalize each authored hue before applying its decay envelope.
  const peak = Math.max(rgb.red, rgb.green, rgb.blue);
  const gain = group.recipe.kind === 'matrix-rain' && peak > 0 ? 255 / peak : 1;
  const white = peak === 0 ? 0 : target.white ?? 0;
  const level = target.brightness * group.intensity;
  const channel = (value: number) => Math.round((value * gain + (255 - value * gain) * white) * level);
  return spatialDisplayColor(definition, packApiLevel3Color({ red: channel(rgb.red), green: channel(rgb.green), blue: channel(rgb.blue) }));
}

export function renderSparseScene(
  definition: BoardDefinition,
  group: SpatialLightEffectGroup,
  points: readonly SpatialPoint[],
  eligible: readonly SpatialPoint[],
  clock: SpatialLoopClock,
): LightScene {
  const targets = group.recipe.kind === 'matrix-rain' ? rainTargets(group, points, clock) : naturalTargets(group, clock);
  const allowed = new Set(eligible.map(({ id }) => id));
  const used = new Set<SpatialPoint['id']>();
  const scene: Array<LightScene[number]> = [];
  for (const target of targets) {
    if (scene.length >= group.footprint) break;
    if (target.x < 0 || target.x > 1 || target.y < 0 || target.y > 1 || target.brightness <= .06) continue;
    let point = target.point;
    if (!point) {
      let distance = Infinity;
      for (const candidate of points) {
        const next = Math.hypot(candidate.x - target.x, candidate.y - target.y);
        if (next < distance) { distance = next; point = candidate; }
      }
    }
    // Mask the intended cell instead of relocating the actor into another lane
    // or replacing a reserved climb light with part of its silhouette.
    if (!point || !allowed.has(point.id) || used.has(point.id)) continue;
    const color = displayColor(definition, group, target);
    if (color === 0) continue;
    used.add(point.id);
    scene.push(Object.freeze({ placementId: point.id, color }));
  }
  return Object.freeze(scene);
}
