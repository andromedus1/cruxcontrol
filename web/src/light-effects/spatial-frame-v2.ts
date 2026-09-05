import type { BoardHoldAssignment, SpatialLightEffectGroup } from '../board-renderer/types';
import { packApiLevel3Color, unpackApiLevel3Color } from '../domain/boards/colors';
import type { BoardDefinition } from '../domain/boards/definition';
import type { LightScene } from '../domain/boards/light-scene';
import type { ApiLevel3Color } from '../domain/boards/types';
import { spatialDisplayColor } from './spatial-colors';
import { prepareSpatialGeometry, type PreparedSpatialGeometry, type SpatialPoint } from './spatial-geometry';

export const BOARD_ANIMATION_FRAME_MS = 500;

export interface SpatialLoopClock {
  readonly frame: number;
  readonly frameCount: number;
  readonly phase: number;
  readonly effectivePeriodMs: number;
}

const positiveModulo = (value: number, modulo: number) => ((value % modulo) + modulo) % modulo;
const fraction = (value: number) => positiveModulo(value, 1);
const triangle = (value: number) => Math.abs(fraction(value) * 2 - 1);

function hash(value: string, seed: number): number {
  let h = seed | 0;
  for (const character of value) h = Math.imul(h ^ character.codePointAt(0)!, 16777619);
  return (h >>> 0) / 0x1_0000_0000;
}

export function spatialLoopClock(periodMs: number, elapsedMs: number): SpatialLoopClock {
  if (!Number.isFinite(periodMs) || periodMs <= 0 || !Number.isFinite(elapsedMs)) {
    throw new RangeError('Spatial loop period and elapsed time must be finite positive values');
  }
  const frameCount = Math.max(1, Math.round(periodMs / BOARD_ANIMATION_FRAME_MS));
  const frame = positiveModulo(Math.floor(elapsedMs / BOARD_ANIMATION_FRAME_MS), frameCount);
  return Object.freeze({ frame, frameCount, phase: frame / frameCount, effectivePeriodMs: frameCount * BOARD_ANIMATION_FRAME_MS });
}

interface Target {
  readonly x: number;
  readonly y: number;
  readonly color: ApiLevel3Color;
  readonly placementId?: SpatialPoint['id'];
}

const geometryCache = new WeakMap<BoardDefinition, PreparedSpatialGeometry>();
interface FrameMemo {
  readonly definition: BoardDefinition;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly frame: number;
  readonly scene: LightScene;
  readonly path?: readonly SpatialPoint[];
}
const frameCache = new WeakMap<SpatialLightEffectGroup, FrameMemo>();

function geometryFor(definition: BoardDefinition): PreparedSpatialGeometry {
  const prepared = geometryCache.get(definition);
  if (prepared) return prepared;
  const next = prepareSpatialGeometry(definition);
  geometryCache.set(definition, next);
  return next;
}

function eligible(
  definition: BoardDefinition,
  assignments: readonly BoardHoldAssignment[],
  group: SpatialLightEffectGroup,
): readonly SpatialPoint[] {
  const assignmentMap = new Map(assignments.map((assignment) => [assignment.placementId, assignment] as const));
  const include = new Set(group.target.include);
  const exclude = new Set(group.target.exclude);
  return geometryFor(definition).points.filter((point) => {
    if (exclude.has(point.id)) return false;
    const assignment = assignmentMap.get(point.id);
    if (assignment?.appearance.kind === 'role') return false;
    if (group.target.scope === 'selected') return include.has(point.id);
    if (include.has(point.id)) return true;
    return group.target.scope === 'background-board' || assignment === undefined;
  });
}

function scaledColor(definition: BoardDefinition, group: SpatialLightEffectGroup, input: ApiLevel3Color, amount = group.intensity): ApiLevel3Color {
  if (amount <= 0) return 0 as ApiLevel3Color;
  const rgb = unpackApiLevel3Color(input);
  const scaled = packApiLevel3Color({
    red: Math.round(rgb.red * amount),
    green: Math.round(rgb.green * amount),
    blue: Math.round(rgb.blue * amount),
  });
  return spatialDisplayColor(definition, scaled);
}

function colorAt(definition: BoardDefinition, group: SpatialLightEffectGroup, phase: number, paletteOffset = 0): ApiLevel3Color {
  const palette = group.palette;
  if (palette.length === 0) return 0 as ApiLevel3Color;
  const scaled = fraction(phase + paletteOffset) * palette.length;
  const index = Math.floor(scaled) % palette.length;
  const from = unpackApiLevel3Color(palette[index]!);
  const to = unpackApiLevel3Color(palette[(index + 1) % palette.length]!);
  return scaledColor(definition, group, packApiLevel3Color({
    red: Math.round(from.red + (to.red - from.red) * (scaled - Math.floor(scaled))),
    green: Math.round(from.green + (to.green - from.green) * (scaled - Math.floor(scaled))),
    blue: Math.round(from.blue + (to.blue - from.blue) * (scaled - Math.floor(scaled))),
  }));
}

function project(
  targets: readonly Target[],
  points: readonly SpatialPoint[],
  limit: number,
): LightScene {
  const used = new Set<string>();
  const output: Array<Readonly<{ placementId: SpatialPoint['id']; color: ApiLevel3Color }>> = [];
  for (const target of targets) {
    if (output.length >= limit || target.color === 0) continue;
    if (target.placementId !== undefined) {
      const exact = points.find((point) => point.id === target.placementId);
      if (!exact || used.has(exact.id)) continue;
      used.add(exact.id);
      output.push(Object.freeze({ placementId: exact.id, color: target.color }));
      continue;
    }
    let closest: SpatialPoint | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const point of points) {
      if (used.has(point.id)) continue;
      const distance = Math.hypot(point.x - target.x, point.y - target.y);
      if (distance < bestDistance || (distance === bestDistance && point.order < (closest?.order ?? Number.POSITIVE_INFINITY))) {
        bestDistance = distance;
        closest = point;
      }
    }
    if (!closest) continue;
    used.add(closest.id);
    output.push(Object.freeze({ placementId: closest.id, color: target.color }));
  }
  return Object.freeze(output);
}

function selectByScore(
  points: readonly SpatialPoint[],
  score: (point: SpatialPoint) => number,
  group: SpatialLightEffectGroup,
  definition: BoardDefinition,
  phase: number,
): LightScene {
  const selected = points
    .map((point) => ({ point, score: score(point) }))
    .filter(({ score: value }) => Number.isFinite(value))
    .sort((a, b) => a.score - b.score || a.point.order - b.point.order)
    .slice(0, Math.min(group.footprint, points.length));
  return Object.freeze(selected.flatMap(({ point }, index) => {
    const color = colorAt(definition, group, phase, index / Math.max(1, selected.length));
    return color === 0 ? [] : [Object.freeze({ placementId: point.id, color })];
  }));
}

function pathFor(
  geometry: PreparedSpatialGeometry,
  group: SpatialLightEffectGroup,
  frameCount: number,
  eligiblePoints: readonly SpatialPoint[],
): readonly SpatialPoint[] {
  const pool = eligiblePoints.length > 0 ? eligiblePoints : geometry.points;
  const root = pool[Math.floor(hash(`root-${group.recipe.kind}`, group.seed) * pool.length)] ?? geometry.points[0];
  if (!root) return Object.freeze([]);
  const maxEdges = Math.floor(frameCount / 2);
  if (maxEdges <= 0) return Object.freeze([root]);
  const visited = new Set<string>([root.id]);
  const walk: SpatialPoint[] = [root];
  const stack: { point: SpatialPoint; next: number }[] = [{ point: root, next: 0 }];
  let edges = 0;
  while (stack.length > 0) {
    const current = stack[stack.length - 1]!;
    if (edges >= maxEdges) {
      stack.pop();
      if (stack.length > 0) walk.push(stack[stack.length - 1]!.point);
      continue;
    }
    const neighbors = (geometry.neighbors.get(current.point.id) ?? [])
      .slice()
      .sort((a, b) => hash(`${group.recipe.kind}-${current.point.id}-${a.id}`, group.seed) - hash(`${group.recipe.kind}-${current.point.id}-${b.id}`, group.seed) || a.order - b.order);
    let next: SpatialPoint | undefined;
    while (current.next < neighbors.length) {
      const candidate = neighbors[current.next++]!;
      if (!visited.has(candidate.id)) { next = candidate; break; }
    }
    if (!next) {
      stack.pop();
      if (stack.length > 0) walk.push(stack[stack.length - 1]!.point);
      continue;
    }
    visited.add(next.id);
    edges += 1;
    walk.push(next);
    stack.push({ point: next, next: 0 });
  }
  // The DFS return to root is the closing edge; it is not a second stored pose.
  if (walk.length > 1 && walk[walk.length - 1]!.id === root.id) walk.pop();
  return Object.freeze(walk.length > 0 ? walk : [root]);
}

function pathScene(
  definition: BoardDefinition,
  group: SpatialLightEffectGroup,
  points: readonly SpatialPoint[],
  clock: SpatialLoopClock,
  path: readonly SpatialPoint[],
  pacman: boolean,
): LightScene {
  if (path.length === 0) return Object.freeze([]);
  const recipe = group.recipe;
  const index = Math.floor(clock.frame * path.length / clock.frameCount);
  const reverse = group.recipe.kind === 'snake' || group.recipe.kind === 'pac-man'
    ? group.recipe.direction === 'reverse'
    : false;
  const at = (offset: number) => path[positiveModulo((reverse ? path.length - index : index) + offset, path.length)]!;
  const palette = group.palette;
  const targets: Target[] = [{ placementId: at(0).id, x: at(0).x, y: at(0).y, color: colorAt(definition, group, clock.phase) }];
  if (pacman) {
    const beatCount = Math.max(1, Math.round(clock.frameCount / (2 * (recipe.kind === 'pac-man' ? recipe.mouthBeat : 1))));
    // Cosine starts and ends in the same open state at the discrete cycle
    // boundary, so the last held frame does not close the mouth just before
    // frame zero opens it again.
    if (Math.cos(Math.PI * 2 * Math.max(1, Math.round(clock.frameCount / beatCount)) * clock.phase) >= 0) {
      const mouth = at(1);
      targets.push({ placementId: mouth.id, x: mouth.x, y: mouth.y, color: colorAt(definition, group, clock.phase, 0.12) });
    }
    const pellets = Math.min(Math.max(0, group.footprint - 3), 3);
    for (let offset = 2; offset < pellets + 2; offset += 1) {
      const pellet = at(offset);
      targets.push({ placementId: pellet.id, x: pellet.x, y: pellet.y, color: colorAt(definition, group, clock.phase, 0.25 + offset / 16) });
    }
    const ghost = at(-Math.max(1, Math.floor(group.footprint / 2)));
    targets.push({ placementId: ghost.id, x: ghost.x, y: ghost.y, color: palette[1] === undefined ? colorAt(definition, group, clock.phase, .5) : scaledColor(definition, group, palette[1]!) });
  } else {
    const length = Math.min(Math.max(1, Math.round(recipe.kind === 'snake' ? recipe.bodyLength : 1)), group.footprint);
    for (let offset = -1; offset > -length; offset -= 1) {
      const body = at(offset);
      targets.push({ placementId: body.id, x: body.x, y: body.y, color: colorAt(definition, group, clock.phase, 0.1 + Math.abs(offset) / 16) });
    }
  }
  return project(targets, points, group.footprint);
}

function ballScene(definition: BoardDefinition, group: SpatialLightEffectGroup, points: readonly SpatialPoint[], clock: SpatialLoopClock): LightScene {
  const recipe = group.recipe;
  if (recipe.kind !== 'beach-ball') return Object.freeze([]);
  const xBounces = Math.max(1, Math.round(Math.abs(recipe.velocityX) * 3));
  const yBounces = Math.max(1, Math.round(Math.abs(recipe.velocityY) * 3));
  const x = .1 + triangle(clock.phase * xBounces + hash('ball-x', group.seed)) * .8;
  const y = .1 + triangle(clock.phase * yBounces + hash('ball-y', group.seed)) * .8;
  const radius = .035 + Math.min(20, Math.max(1, recipe.size)) / 220;
  const targets: Target[] = [];
  const count = Math.min(group.footprint, Math.max(1, Math.round(recipe.size)));
  for (let index = 0; index < count; index += 1) {
    const angle = index * Math.PI * 2 / Math.max(1, count);
    targets.push({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius, color: colorAt(definition, group, clock.phase, index / Math.max(1, count)) });
  }
  return project(targets, points, group.footprint);
}

function pongScene(definition: BoardDefinition, group: SpatialLightEffectGroup, points: readonly SpatialPoint[], clock: SpatialLoopClock): LightScene {
  const recipe = group.recipe;
  if (recipe.kind !== 'pong') return Object.freeze([]);
  const rallies = 2 + Math.max(1, Math.round(group.periodMs / 45_000));
  const travel = triangle(clock.phase * rallies + hash('pong-x', group.seed));
  const x = .08 + travel * .84;
  const y = .1 + triangle(clock.phase * (rallies + 1) + hash('pong-y', group.seed)) * .8;
  const paddle = Math.max(1, Math.min(group.footprint - 1, Math.round(recipe.paddleSize)));
  const targets: Target[] = [{ x, y, color: colorAt(definition, group, clock.phase) }];
  for (let side = 0; side < 2; side += 1) {
    for (let index = 0; index < paddle; index += 1) {
      const offset = (index - (paddle - 1) / 2) * .07;
      targets.push({ x: side === 0 ? .06 : .94, y: Math.max(.06, Math.min(.94, y + offset)), color: colorAt(definition, group, clock.phase, .5) });
    }
  }
  return project(targets, points, group.footprint);
}

function birdScene(definition: BoardDefinition, group: SpatialLightEffectGroup, points: readonly SpatialPoint[], clock: SpatialLoopClock): LightScene {
  const recipe = group.recipe;
  if (recipe.kind !== 'bird-flock') return Object.freeze([]);
  const quiet = Math.min(.95, Math.max(0, recipe.quietFraction));
  const activeStart = quiet / 2;
  const activeEnd = 1 - quiet / 2;
  if (clock.phase < activeStart || clock.phase >= activeEnd) return Object.freeze([]);
  const active = (clock.phase - activeStart) / Math.max(.0001, activeEnd - activeStart);
  const passCount = 3;
  const pass = Math.min(passCount - 1, Math.floor(active * passCount));
  const local = active * passCount - pass;
  const direction = recipe.direction === 'left' ? -1 : 1;
  const centerX = direction === 1 ? -.18 + local * 1.36 : 1.18 - local * 1.36;
  if (centerX < -.16 || centerX > 1.16) return Object.freeze([]);
  const entryY = .2 + hash(`bird-entry-${pass}`, group.seed) * .55;
  const exitY = .2 + hash(`bird-exit-${pass}`, group.seed) * .55;
  const centerY = entryY + (exitY - entryY) * local + Math.sin(Math.PI * local) * (.16 * (hash(`bird-arc-${pass}`, group.seed) - .5));
  const targets: Target[] = [];
  const count = Math.min(3, group.footprint);
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * .06;
    targets.push({ x: centerX - direction * Math.abs(offset) * 2, y: centerY + Math.abs(offset) - .04 * index, color: colorAt(definition, group, clock.phase, index / Math.max(1, count)) });
  }
  return project(targets, points, group.footprint);
}

function froggerScene(definition: BoardDefinition, group: SpatialLightEffectGroup, points: readonly SpatialPoint[], clock: SpatialLoopClock): LightScene {
  const recipe = group.recipe;
  if (recipe.kind !== 'frogger') return Object.freeze([]);
  const crossings = 2 + Math.min(4, Math.max(1, Math.round(recipe.lanes / 2)));
  const journey = triangle(clock.phase * crossings);
  const frogY = .08 + triangle(clock.phase * crossings + .25) * .84;
  const frogX = .08 + journey * .84;
  const frogColor = colorAt(definition, group, clock.phase);
  const targets: Target[] = [
    { x: frogX, y: frogY, color: frogColor },
    { x: Math.max(.04, frogX - .035), y: Math.min(.96, frogY + .035), color: frogColor },
  ];
  const vehicleCount = Math.max(0, group.footprint - 2);
  const lanes = Math.max(1, Math.min(8, Math.round(recipe.lanes)));
  for (let index = 0; index < vehicleCount; index += 1) {
    const lane = index % lanes;
    const laneX = .12 + (lane / Math.max(1, lanes - 1)) * .76;
    const y = triangle(clock.phase * (1 + (lane % 3)) + hash(`frogger-${index}`, group.seed));
    targets.push({ x: laneX, y, color: colorAt(definition, group, clock.phase, .45 + index / 16) });
  }
  return project(targets, points, group.footprint);
}

function pentagramScene(definition: BoardDefinition, group: SpatialLightEffectGroup, points: readonly SpatialPoint[], clock: SpatialLoopClock): LightScene {
  const recipe = group.recipe;
  if (recipe.kind !== 'pentagram') return Object.freeze([]);
  const radius = .4;
  const circleCount = Math.floor(group.footprint / 2);
  const starCount = group.footprint - circleCount;
  const vertices = Array.from({ length: 5 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
    return { x: .5 + Math.cos(angle) * radius, y: .5 + Math.sin(angle) * radius };
  });
  const starOrder = [0, 2, 4, 1, 3, 0];
  const targets: Target[] = [];
  for (let index = 0; index < circleCount; index += 1) {
    const angle = -Math.PI / 2 + Math.PI / Math.max(1, circleCount) + index * Math.PI * 2 / Math.max(1, circleCount);
    targets.push({ x: .5 + Math.cos(angle) * radius, y: .5 + Math.sin(angle) * radius, color: colorAt(definition, group, clock.phase) });
  }
  const vertexCount = Math.min(5, starCount);
  for (let index = 0; index < vertexCount; index += 1) targets.push({ ...vertices[starOrder[Math.floor(index * 5 / Math.max(1, vertexCount))]!]!, color: colorAt(definition, group, clock.phase) });
  const chordCount = starCount - vertexCount;
  for (let index = 0; index < chordCount; index += 1) {
    const stroke = Math.floor(index * 5 / Math.max(1, chordCount));
    const from = vertices[starOrder[stroke]!]!;
    const to = vertices[starOrder[stroke + 1]!]!;
    const x = (from.x + to.x) / 2;
    const y = (from.y + to.y) / 2;
    targets.push({ x, y: Math.abs(y - .5) >= Math.abs(x - .5) && y > .5 ? y + .067 : y, color: colorAt(definition, group, clock.phase) });
  }
  const fadeBeats = Math.max(2, Math.round(recipe.fadeRate) * 2);
  const brightness = .2 + triangle(clock.phase * fadeBeats) * .8;
  return project(targets.map((target) => ({ ...target, color: scaledColor(definition, group, target.color, brightness) })), points, group.footprint);
}

export function renderSpatialGroupV2(
  definition: BoardDefinition,
  assignments: readonly BoardHoldAssignment[],
  group: SpatialLightEffectGroup,
  elapsedMs: number,
): LightScene {
  if (group.palette.length === 0 || group.intensity <= 0) return Object.freeze([]);
  const geometry = geometryFor(definition);
  const clock = spatialLoopClock(group.periodMs, elapsedMs);
  const cached = frameCache.get(group);
  if (cached && cached.definition === definition && cached.assignments === assignments && cached.frame === clock.frame) return cached.scene;
  const points = eligible(definition, assignments, group);
  const recipe = group.recipe;
  let scene: LightScene;
  let path: readonly SpatialPoint[] | undefined;
  switch (recipe.kind) {
    case 'snake':
      path = pathFor(geometry, group, clock.frameCount, points);
      scene = pathScene(definition, group, points, clock, path, false);
      break;
    case 'pac-man':
      path = pathFor(geometry, group, clock.frameCount, points);
      scene = pathScene(definition, group, points, clock, path, true);
      break;
    case 'beach-ball': scene = ballScene(definition, group, points, clock); break;
    case 'pong': scene = pongScene(definition, group, points, clock); break;
    case 'bird-flock': scene = birdScene(definition, group, points, clock); break;
    case 'frogger': scene = froggerScene(definition, group, points, clock); break;
    case 'pentagram': scene = pentagramScene(definition, group, points, clock); break;
    case 'ocean-tide': {
      const direction = recipe.direction === 'in' ? 1 : -1;
      const wave = .5 + direction * (.3 * Math.sin(Math.PI * 2 * 3 * clock.phase) + .08 * Math.sin(Math.PI * 2 * 6 * clock.phase));
      scene = selectByScore(points, (point) => Math.abs(point.y - wave) + hash(`ocean-${point.id}`, group.seed) * recipe.foam * .08, group, definition, clock.phase);
      break;
    }
    case 'tie-dye-spiral': {
      const signed = recipe.direction === 'clockwise' ? 1 : -1;
      scene = selectByScore(points, (point) => {
        const angle = Math.atan2(point.y - .5, point.x - .5) / (Math.PI * 2);
        const radius = Math.hypot(point.x - .5, point.y - .5);
        return Math.abs(fraction(angle * recipe.arms + radius * 2.2 - signed * clock.phase * recipe.arms));
      }, group, definition, clock.phase);
      break;
    }
    case 'matrix-rain': {
      const fallCount = 3 + Math.max(1, Math.round(recipe.columns / 2));
      const direction = recipe.direction === 'down' ? 1 : -1;
      scene = selectByScore(points, (point) => {
        const column = Math.round(point.x * recipe.columns);
        const columnPhase = hash(`matrix-column-${column}`, group.seed);
        const y = direction > 0 ? 1.15 - fraction(clock.phase * fallCount + columnPhase) * 1.3 : -.15 + fraction(clock.phase * fallCount + columnPhase) * 1.3;
        if (y < -.08 || y > 1.08) return Number.POSITIVE_INFINITY;
        return Math.abs(point.x * recipe.columns - column) + Math.abs(point.y - y) * .4;
      }, group, definition, clock.phase);
      break;
    }
  }
  const frozen = Object.freeze(scene);
  frameCache.set(group, { definition, assignments, frame: clock.frame, scene: frozen, path });
  return frozen;
}
