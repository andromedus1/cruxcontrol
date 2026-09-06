import { samplePongPose } from './spatial-pong';
import type { BoardHoldAssignment, SpatialLightEffectGroup } from '../board-renderer/types';
import { packApiLevel3Color, unpackApiLevel3Color } from '../domain/boards/colors';
import type { BoardDefinition } from '../domain/boards/definition';
import type { LightScene } from '../domain/boards/light-scene';
import type { ApiLevel3Color } from '../domain/boards/types';
import { spatialDisplayColor } from './spatial-colors';
import { prepareFroggerPlan, sampleFroggerPlan, type FroggerPlan } from './spatial-frogger';
import { prepareSpatialGeometry, type PreparedSpatialGeometry, type SpatialPoint } from './spatial-geometry';

export const BOARD_ANIMATION_FRAME_MS = 500;

export interface SpatialLoopClock {
  readonly frame: number;
  readonly frameCount: number;
  readonly phase: number;
  readonly effectivePeriodMs: number;
}

export interface BumblebeePose {
  readonly center: Readonly<{ x: number; y: number }>;
  readonly activity: 'hover' | 'flight' | 'dart';
  readonly segment: number;
  /** Progress through the current hover or flight, in the range 0..1. */
  readonly progress: number;
  readonly heading: Readonly<{ x: number; y: number }>;
  readonly wingPose: 'up' | 'down';
}

interface BumblebeePlan {
  readonly waypoints: readonly Readonly<{ x: number; y: number }>[];
  readonly flightWeights: readonly number[];
  readonly curvePhases: readonly number[];
  readonly hoverFraction: number;
}

const positiveModulo = (value: number, modulo: number) => ((value % modulo) + modulo) % modulo;
const fraction = (value: number) => positiveModulo(value, 1);
const triangle = (value: number) => Math.abs(fraction(value) * 2 - 1);

function hash(value: string, seed: number): number {
  let h = seed | 0;
  for (const character of value) h = Math.imul(h ^ character.codePointAt(0)!, 16777619);
  return (h >>> 0) / 0x1_0000_0000;
}

const BUMBLEBEE_BASE_WAYPOINTS = Object.freeze([
  { x: .22, y: .25 },
  { x: .61, y: .19 },
  { x: .82, y: .43 },
  { x: .69, y: .78 },
  { x: .35, y: .73 },
  { x: .17, y: .50 },
] as const);

const clampUnitInterior = (value: number) => Math.max(.1, Math.min(.9, value));

/** Six deterministic interior stops used by every complete bumblebee tour. */
export function bumblebeeWaypoints(seed: number): readonly Readonly<{ x: number; y: number }>[] {
  if (!Number.isSafeInteger(seed)) throw new RangeError('Bumblebee seed must be a safe integer');
  return Object.freeze(BUMBLEBEE_BASE_WAYPOINTS.map((point, index) => Object.freeze({
    x: clampUnitInterior(point.x + (hash(`bumblebee-waypoint-x-${index}`, seed) - .5) * .08),
    y: clampUnitInterior(point.y + (hash(`bumblebee-waypoint-y-${index}`, seed) - .5) * .08),
  })));
}

const bumblebeePlanCache = new WeakMap<SpatialLightEffectGroup, BumblebeePlan>();

function bumblebeePlanFor(group: SpatialLightEffectGroup): BumblebeePlan {
  const cached = bumblebeePlanCache.get(group);
  if (cached) return cached;
  if (group.recipe.kind !== 'bumblebee') throw new TypeError('Bumblebee plan requested for a different spatial recipe');
  const hoverFraction = group.recipe.hoverFraction;
  if (!Number.isFinite(hoverFraction) || hoverFraction < 0 || hoverFraction > .8) {
    throw new RangeError('Bumblebee hover fraction must be finite and between 0 and 0.8');
  }
  // Fixed, seeded weights keep the tour authored and closed while making three
  // of the six flights noticeably quicker darts.
  const bases = [.62, .96, .56, .88, .66, .48] as const;
  const flightWeights = Object.freeze(bases.map((base, index) => Math.max(.35, Math.min(1.05,
    base + (hash(`bumblebee-flight-${index}`, group.seed) - .5) * .12))));
  const plan = Object.freeze({
    waypoints: bumblebeeWaypoints(group.seed),
    flightWeights,
    curvePhases: Object.freeze(flightWeights.map((_, index) => hash(`bumblebee-curve-${index}`, group.seed) * Math.PI * 2)),
    hoverFraction,
  });
  bumblebeePlanCache.set(group, plan);
  return plan;
}

/**
 * Sample the authored bee motion at a v2 clock position. The hover envelope
 * and eased flight both have zero displacement and velocity at their joins,
 * including the final flight back to waypoint zero.
 */
export function sampleBumblebeePose(
  group: SpatialLightEffectGroup,
  clock: Pick<SpatialLoopClock, 'phase' | 'frame' | 'frameCount'>,
): BumblebeePose {
  if (group.recipe.kind !== 'bumblebee') throw new TypeError('Bumblebee pose requested for a different spatial recipe');
  const plan = bumblebeePlanFor(group);
  const lengths = plan.flightWeights.map((weight) => weight);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const elapsed = fraction(clock.phase) * total;
  let cursor = 0;
  let segment = lengths.length - 1;
  let offset = lengths[segment]!;
  for (let index = 0; index < lengths.length; index += 1) {
    if (elapsed < cursor + lengths[index]! || index === lengths.length - 1) {
      segment = index;
      offset = elapsed - cursor;
      break;
    }
    cursor += lengths[index]!;
  }
  const start = plan.waypoints[segment]!;
  const end = plan.waypoints[(segment + 1) % plan.waypoints.length]!;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy) || 1;
  const travelHeading = Object.freeze({ x: dx / distance, y: dy / distance });
  const perpendicular = { x: -travelHeading.y, y: travelHeading.x };
  const segmentLength = lengths[segment]!;
  const hoverLength = segmentLength * plan.hoverFraction;
  const flightLength = segmentLength - hoverLength;
  let center: Readonly<{ x: number; y: number }>;
  let activity: BumblebeePose['activity'];
  let progress: number;
  if (hoverLength > 0 && offset <= hoverLength) {
    progress = Math.max(0, Math.min(1, offset / hoverLength));
    const envelope = Math.sin(Math.PI * progress) ** 2;
    const phase = plan.curvePhases[segment]!;
    const wobble = .012 * envelope * Math.sin(Math.PI * 2 * progress + phase);
    const drift = .006 * envelope * Math.sin(Math.PI * progress + phase * .7);
    center = Object.freeze({
      x: start.x + perpendicular.x * wobble + travelHeading.x * drift,
      y: start.y + perpendicular.y * wobble + travelHeading.y * drift,
    });
    activity = 'hover';
  } else {
    progress = flightLength <= 0 ? 1 : Math.max(0, Math.min(1, (offset - hoverLength) / flightLength));
    const eased = progress * progress * (3 - 2 * progress);
    const curve = Math.sin(Math.PI * progress) ** 2
      * Math.sin(Math.PI * 2 * progress + plan.curvePhases[segment]!)
      * (.02 + .012 * hash(`bumblebee-curve-size-${segment}`, group.seed));
    center = Object.freeze({
      x: start.x + dx * eased + perpendicular.x * curve,
      y: start.y + dy * eased + perpendicular.y * curve,
    });
    activity = plan.flightWeights[segment]! < .72 ? 'dart' : 'flight';
  }
  // Arrive facing along the incoming flight, then turn through the shortest
  // angle while hovering. With little/no hover, finish the turn during departure
  // so zero-hover tours keep a continuous orientation at every waypoint too.
  const previous = plan.waypoints[(segment + plan.waypoints.length - 1) % plan.waypoints.length]!;
  const incomingAngle = Math.atan2(start.y - previous.y, start.x - previous.x);
  const outgoingAngle = Math.atan2(dy, dx);
  const angleDelta = Math.atan2(Math.sin(outgoingAngle - incomingAngle), Math.cos(outgoingAngle - incomingAngle));
  const turnProgress = Math.min(1, offset / (segmentLength * Math.max(.25, plan.hoverFraction)));
  const turnEase = turnProgress * turnProgress * (3 - 2 * turnProgress);
  const angle = incomingAngle + angleDelta * turnEase;
  const heading = Object.freeze({ x: Math.cos(angle), y: Math.sin(angle) });
  // An odd number of held intervals leaves the final sampled pose matching
  // frame zero, so wing orientation joins cleanly with the closed flight.
  const wingPose = Math.floor(fraction(clock.phase) * 11) % 2 === 0 ? 'up' : 'down';
  return Object.freeze({ center, activity, segment, progress, heading, wingPose });
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
interface PathMemo {
  readonly definition: BoardDefinition;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly frameCount: number;
  readonly path: readonly SpatialPoint[];
}
const pathCache = new WeakMap<SpatialLightEffectGroup, PathMemo>();
const froggerCache = new WeakMap<SpatialLightEffectGroup, FroggerPlan>();

function pathForCached(
  definition: BoardDefinition,
  assignments: readonly BoardHoldAssignment[],
  group: SpatialLightEffectGroup,
  geometry: PreparedSpatialGeometry,
  frameCount: number,
  eligiblePoints: readonly SpatialPoint[],
): readonly SpatialPoint[] {
  const cached = pathCache.get(group);
  if (cached?.definition === definition && cached.assignments === assignments && cached.frameCount === frameCount) return cached.path;
  const path = pathFor(geometry, group, frameCount, eligiblePoints);
  pathCache.set(group, { definition, assignments, frameCount, path });
  return path;
}

function froggerPlanFor(group: SpatialLightEffectGroup): FroggerPlan {
  const cached = froggerCache.get(group);
  if (cached) return cached;
  if (group.recipe.kind !== 'frogger') throw new TypeError('Frogger plan requested for a different spatial recipe');
  const plan = prepareFroggerPlan(group.recipe.lanes, group.seed, Math.max(0, group.footprint - 2));
  froggerCache.set(group, plan);
  return plan;
}

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
    // A target outside the normalized board is genuinely off-board. Clipping
    // here keeps moving actors from reappearing on an unrelated edge hold.
    if (target.x < 0 || target.x > 1 || target.y < 0 || target.y > 1) continue;
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
  const at = (offset: number) => path[positiveModulo((reverse ? -1 : 1) * (index + offset), path.length)]!;
  const palette = group.palette;
  const protagonist = scaledColor(definition, group, palette[0]!);
  const targets: Target[] = [{ placementId: at(0).id, x: at(0).x, y: at(0).y, color: pacman ? protagonist : colorAt(definition, group, clock.phase) }];
  if (pacman) {
    const beatCount = Math.max(1, Math.round(clock.frameCount / (2 * (recipe.kind === 'pac-man' ? recipe.mouthBeat : 1))));
    // Fit whole chew beats to the loop; all actor colors retain their palette roles.
    if (Math.cos(Math.PI * 2 * beatCount * clock.phase) >= 0) {
      const mouth = at(1);
      targets.push({ placementId: mouth.id, x: mouth.x, y: mouth.y, color: protagonist });
    }
    const pellets = Math.min(Math.max(0, group.footprint - 3), 3);
    for (let offset = 2; offset < pellets + 2; offset += 1) {
      const pellet = at(offset);
      targets.push({ placementId: pellet.id, x: pellet.x, y: pellet.y, color: protagonist });
    }
    const ghost = at(-Math.max(1, Math.floor(group.footprint / 2)));
    targets.push({ placementId: ghost.id, x: ghost.x, y: ghost.y, color: scaledColor(definition, group, palette[1] ?? palette[0]!) });
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
  const xFold = triangle(clock.phase * xBounces + hash('ball-x', group.seed));
  const yFold = triangle(clock.phase * yBounces + hash('ball-y', group.seed));
  const x = .1 + (recipe.velocityX >= 0 ? xFold : 1 - xFold) * .8;
  const y = .1 + (recipe.velocityY >= 0 ? yFold : 1 - yFold) * .8;
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
  const pose = samplePongPose(group.seed, group.periodMs, clock.phase, recipe.direction);
  const paddle = Math.min(Math.round(recipe.paddleSize), Math.floor(Math.max(0, group.footprint - 1) / 2));
  const paddleSpacing = .04 + Math.min(20, Math.round(recipe.paddleSize)) * .015;
  const targets: Target[] = [{ ...pose.ball, color: colorAt(definition, group, clock.phase) }];
  for (let side = 0; side < 2; side += 1) {
    const paddleY = side === 0 ? pose.leftPaddleY : pose.rightPaddleY;
    for (let index = 0; index < paddle; index += 1) {
      const offset = (index - (paddle - 1) / 2) * paddleSpacing;
      targets.push({ x: side === 0 ? .06 : .94, y: Math.max(.06, Math.min(.94, paddleY + offset)), color: colorAt(definition, group, clock.phase, .5) });
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

function bumblebeeScene(definition: BoardDefinition, group: SpatialLightEffectGroup, points: readonly SpatialPoint[], clock: SpatialLoopClock): LightScene {
  const recipe = group.recipe;
  if (recipe.kind !== 'bumblebee') return Object.freeze([]);
  const pose = sampleBumblebeePose(group, clock);
  const { center, heading } = pose;
  const perpendicular = { x: -heading.y, y: heading.x };
  const bodyColor = scaledColor(definition, group, group.palette[0]!);
  const wingColor = scaledColor(definition, group, group.palette[1] ?? group.palette[0]!);
  const wingLift = pose.wingPose === 'up' ? .012 : -.012;
  const targets: Target[] = [
    { x: center.x + heading.x * .026, y: center.y + heading.y * .026, color: bodyColor },
    { x: center.x, y: center.y, color: bodyColor },
    { x: center.x - heading.x * .026, y: center.y - heading.y * .026, color: bodyColor },
    { x: center.x + perpendicular.x * .036 + heading.x * wingLift, y: center.y + perpendicular.y * .036 + heading.y * wingLift, color: wingColor },
    { x: center.x - perpendicular.x * .036 - heading.x * wingLift, y: center.y - perpendicular.y * .036 - heading.y * wingLift, color: wingColor },
  ];
  return project(targets, points, group.footprint);
}

function froggerScene(definition: BoardDefinition, group: SpatialLightEffectGroup, points: readonly SpatialPoint[], clock: SpatialLoopClock): LightScene {
  const recipe = group.recipe;
  if (recipe.kind !== 'frogger') return Object.freeze([]);
  const pose = sampleFroggerPlan(froggerPlanFor(group), clock.phase);
  const frogColor = scaledColor(definition, group, group.palette[0]!);
  const targets: Target[] = [
    { x: pose.frog.x - .018, y: pose.frog.y, color: frogColor },
    { x: pose.frog.x + .018, y: pose.frog.y, color: frogColor },
  ];
  for (const vehicle of pose.traffic) {
    const vehiclePaletteIndex = group.palette.length > 1
      ? 1 + vehicle.id % (group.palette.length - 1)
      : 0;
    targets.push({
      x: vehicle.x,
      y: vehicle.y,
      color: scaledColor(definition, group, group.palette[vehiclePaletteIndex]!),
    });
  }
  return project(targets, points, group.footprint);
}

function matrixScene(definition: BoardDefinition, group: SpatialLightEffectGroup, points: readonly SpatialPoint[], clock: SpatialLoopClock): LightScene {
  const recipe = group.recipe;
  if (recipe.kind !== 'matrix-rain') return Object.freeze([]);
  const columns = Math.max(1, Math.min(20, Math.round(recipe.columns)));
  const fallCount = 3 + Math.max(1, Math.round(columns / 2));
  const direction = recipe.direction === 'down' ? 1 : -1;
  const columnXs = [...new Set(points.map((point) => point.x))].sort((a, b) => a - b);
  const targets: Target[] = [];
  const streamCount = Math.min(columns, columnXs.length);
  const maxTail = 4;
  for (let tail = 0; tail < maxTail && targets.length < group.footprint * 2; tail += 1) {
    for (let column = 0; column < streamCount && targets.length < group.footprint * 2; column += 1) {
      const x = columnXs[Math.min(columnXs.length - 1, Math.floor((column + .5) * columnXs.length / streamCount))]!;
      const offset = hash(`matrix-column-${column}`, group.seed);
      const head = direction > 0
        ? 1.16 - fraction(clock.phase * fallCount + offset) * 1.48
        : -.16 + fraction(clock.phase * fallCount + offset) * 1.48;
      const y = head + direction * tail * .075;
      // Heads and tails genuinely leave the board. Omit off-board points so
      // projection cannot snap a stream to an unrelated edge hold.
      if (y < 0 || y > 1) continue;
      targets.push({ x, y, color: colorAt(definition, group, clock.phase, (column + tail) / Math.max(1, columns * 2)) });
    }
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
  const slowEnvelope = .78 + .22 * (.5 + .5 * Math.cos(Math.PI * 2 * 2 * clock.phase));
  const brightness = (.2 + triangle(clock.phase * fadeBeats) * .8) * slowEnvelope;
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
      path = pathForCached(definition, assignments, group, geometry, clock.frameCount, points);
      scene = pathScene(definition, group, points, clock, path, false);
      break;
    case 'pac-man':
      path = pathForCached(definition, assignments, group, geometry, clock.frameCount, points);
      scene = pathScene(definition, group, points, clock, path, true);
      break;
    case 'beach-ball': scene = ballScene(definition, group, points, clock); break;
    case 'pong': scene = pongScene(definition, group, points, clock); break;
    case 'bird-flock': scene = birdScene(definition, group, points, clock); break;
    case 'bumblebee': scene = bumblebeeScene(definition, group, points, clock); break;
    case 'frogger': scene = froggerScene(definition, group, points, clock); break;
    case 'pentagram': scene = pentagramScene(definition, group, points, clock); break;
    case 'ocean-tide': {
      const direction = recipe.direction === 'in' ? 1 : -1;
      const envelope = .85 + .15 * Math.cos(Math.PI * 2 * clock.phase);
      const wave = .5 + direction * envelope * (.3 * Math.sin(Math.PI * 2 * 3 * clock.phase) + .08 * Math.sin(Math.PI * 2 * 6 * clock.phase));
      // Stable samples carry their own color along the shoreline. Ranking all
      // holds by distance made unrelated pixels trade places and hues each tick.
      const count = Math.min(group.footprint, points.length);
      const targets = Array.from({ length: count }, (_, index) => {
        const x = (index + .5) / count;
        const foam = recipe.foam * .08 * Math.sin(Math.PI * 2 * (x * 3 + clock.phase * 9 + hash(`ocean-${index}`, group.seed)));
        return { x, y: wave + foam, color: colorAt(definition, group, clock.phase, x * .5) };
      });
      scene = project(targets, points, group.footprint);
      break;
    }
    case 'tie-dye-spiral': {
      const signed = recipe.direction === 'clockwise' ? 1 : -1;
      const count = Math.min(group.footprint, points.length);
      const breathing = 1 + .12 * Math.sin(Math.PI * 2 * 2 * clock.phase) + .04 * Math.sin(Math.PI * 2 * 4 * clock.phase);
      const targets = Array.from({ length: count }, (_, index) => {
        const arm = index % recipe.arms;
        const ring = Math.floor(index / recipe.arms);
        const rings = Math.ceil((count - arm) / recipe.arms);
        const radius = (.08 + .3 * (ring + .5) / rings) * breathing;
        const angle = Math.PI * 2 * (arm / recipe.arms + radius * 2.2 - signed * clock.phase * 3);
        return {
          x: .5 + radius * Math.cos(angle),
          y: .5 + radius * Math.sin(angle),
          color: colorAt(definition, group, clock.phase, index / count),
        };
      });
      scene = project(targets, points, group.footprint);
      break;
    }
    case 'matrix-rain': {
      scene = matrixScene(definition, group, points, clock);
      break;
    }
  }
  const frozen = Object.freeze(scene);
  frameCache.set(group, { definition, assignments, frame: clock.frame, scene: frozen, path });
  return frozen;
}
