import type { BoardHoldAssignment, SpatialLightEffectGroup } from '../board-renderer/types';
import { apiLevel3Color, packApiLevel3Color, unpackApiLevel3Color } from '../domain/boards/colors';
import type { BoardDefinition } from '../domain/boards/definition';
import type { LightScene } from '../domain/boards/light-scene';
import type { ApiLevel3Color } from '../domain/boards/types';

const fraction = (value: number) => ((value % 1) + 1) % 1;
export const BOARD_ANIMATION_FRAME_MS = 500;
const hash = (value: string, seed: number) => { let h = seed | 0; for (const c of value) h = Math.imul(h ^ c.codePointAt(0)!, 16777619); return (h >>> 0) / 0x1_0000_0000; };
const triangle = (value: number) => Math.abs(fraction(value) * 2 - 1);
const distance = (a: number, b: number) => { const d = Math.abs(fraction(a) - fraction(b)); return Math.min(d, 1 - d); };

function colorAt(group: SpatialLightEffectGroup, phase: number): ApiLevel3Color {
  const palette = group.palette;
  const scaled = fraction(phase) * palette.length;
  const from = unpackApiLevel3Color(palette[Math.floor(scaled) % palette.length]!);
  const to = unpackApiLevel3Color(palette[(Math.floor(scaled) + 1) % palette.length]!);
  const amount = scaled - Math.floor(scaled);
  return packApiLevel3Color({ red: Math.round((from.red + (to.red - from.red) * amount) * group.intensity), green: Math.round((from.green + (to.green - from.green) * amount) * group.intensity), blue: Math.round((from.blue + (to.blue - from.blue) * amount) * group.intensity) });
}

function eligible(definition: BoardDefinition, assignments: readonly BoardHoldAssignment[], group: SpatialLightEffectGroup) {
  const assignmentMap = new Map(assignments.map((assignment) => [assignment.placementId, assignment]));
  const include = new Set(group.target.include); const exclude = new Set(group.target.exclude);
  return definition.placements.filter((placement) => {
    if (exclude.has(placement.id)) return false;
    const assignment = assignmentMap.get(placement.id);
    if (assignment?.appearance.kind === 'role') return false;
    if (group.target.scope === 'selected') return include.has(placement.id);
    if (include.has(placement.id)) return true;
    return group.target.scope === 'background-board' || assignment === undefined;
  });
}

export function renderSpatialGroup(definition: BoardDefinition, assignments: readonly BoardHoldAssignment[], group: SpatialLightEffectGroup, elapsedMs: number): LightScene {
  const candidates = eligible(definition, assignments, group);
  if (candidates.length === 0 || group.palette.length === 0) return Object.freeze([]);
  // API-2 can deliver only two complete scenes per second. Use the same held poses in
  // the UI preview so it never advertises intermediate motion the board cannot show.
  const boardElapsedMs = Math.floor(elapsedMs / BOARD_ANIMATION_FRAME_MS) * BOARD_ANIMATION_FRAME_MS;
  const phase = fraction(boardElapsedMs / group.periodMs);
  const cycleIndex = Math.floor(boardElapsedMs / group.periodMs);
  const width = definition.bounds.right - definition.bounds.left || 1;
  const height = definition.bounds.top - definition.bounds.bottom || 1;
  const normalized = candidates.map((placement, order) => ({ placement, order, x: (placement.position.x - definition.bounds.left) / width, y: (placement.position.y - definition.bounds.bottom) / height }));
  const allNormalized = definition.placements.map((placement, order) => ({ placement, order, x: (placement.position.x - definition.bounds.left) / width, y: (placement.position.y - definition.bounds.bottom) / height }));
  const recipe = group.recipe;
  const reserved = new Set(Object.values(definition.rolePresets).map(({ lightColor }) => lightColor as number));
  const safeColor = (input: ApiLevel3Color) => {
    let color = input;
    for (let attempts = 0; attempts < 256 && ((color as number) === 0 || reserved.has(color as number)); attempts += 1) color = apiLevel3Color(((color as number) + 1) % 256);
    return color;
  };
  const scaledColor = (input: ApiLevel3Color, amount = group.intensity) => {
    const rgb = unpackApiLevel3Color(input);
    return safeColor(packApiLevel3Color({ red: Math.round(rgb.red * amount), green: Math.round(rgb.green * amount), blue: Math.round(rgb.blue * amount) }));
  };
  const chooseNearest = (targets: readonly Readonly<{ x: number; y: number; color: ApiLevel3Color }>[], limit: number) => {
    const used = new Set<string>();
    return targets.slice(0, limit).flatMap((target) => {
      const match = normalized
        .filter(({ placement }) => !used.has(placement.id))
        .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y) || a.order - b.order)[0];
      if (!match) return [];
      used.add(match.placement.id);
      return [Object.freeze({ placementId: match.placement.id, color: scaledColor(target.color) })];
    });
  };
  if (recipe.kind === 'frogger') {
    const lanes = Math.max(1, Math.min(8, Math.round(recipe.lanes)));
    const vehicleCount = Math.max(0, group.footprint - Math.min(2, group.footprint));
    const vehicles = Array.from({ length: vehicleCount }, (_, index) => {
      const lane = index % lanes;
      const laneX = (lane + 1) / (lanes + 1);
      const speed = .72 + hash(`frogger-speed-${lane}-${cycleIndex}`, group.seed) * 1.15;
      const offset = hash(`frogger-offset-${index}-${cycleIndex}`, group.seed);
      const upward = (lane + cycleIndex) % 2 === 0;
      const vehicleY = upward ? triangle(phase * speed + offset) : 1 - triangle(phase * speed + offset);
      return { x: laneX, y: vehicleY, color: group.palette[1 + (index % Math.max(1, group.palette.length - 1))] ?? group.palette[0]! };
    });
    const frogX = .05 + phase * .9;
    const nearbyTraffic = vehicles.filter(({ x }) => Math.abs(x - frogX) < .2);
    const tracks = [.18, .38, .62, .82];
    const frogY = tracks
      .map((y) => ({ y, clearance: nearbyTraffic.reduce((minimum, vehicle) => Math.min(minimum, Math.abs(vehicle.y - y)), 1) + hash(`frogger-track-${y}-${Math.floor(phase * lanes)}`, group.seed) * .08 }))
      .sort((a, b) => b.clearance - a.clearance)[0]!.y;
    const frogCount = Math.min(2, group.footprint);
    const frogTargets = Array.from({ length: frogCount }, (_, index) => ({ x: frogX - index * .035, y: frogY + (index ? .025 : 0), color: group.palette[0]! }));
    return Object.freeze(chooseNearest([...frogTargets, ...vehicles], group.footprint));
  }
  if (recipe.kind === 'pentagram') {
    const radius = .4;
    const circleCount = Math.floor(group.footprint / 2);
    const starCount = group.footprint - circleCount;
    const vertices = Array.from({ length: 5 }, (_, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
      return { x: .5 + Math.cos(angle) * radius, y: .5 + Math.sin(angle) * radius };
    });
    const order = [0, 2, 4, 1, 3, 0];
    const vertexCount = Math.min(5, starCount);
    const chordCount = starCount - vertexCount;
    const anchors = [
      ...Array.from({ length: circleCount }, (_, index) => {
        const angle = -Math.PI / 2 + Math.PI / Math.max(1, circleCount) + index * Math.PI * 2 / Math.max(1, circleCount);
        return { x: .5 + Math.cos(angle) * radius, y: .5 + Math.sin(angle) * radius, outward: null };
      }),
      ...Array.from({ length: vertexCount }, (_, index) => ({ ...vertices[order[Math.floor(index * 5 / Math.max(1, vertexCount))]!]!, outward: null })),
      ...Array.from({ length: chordCount }, (_, index) => {
        const stroke = Math.floor(index * 5 / Math.max(1, chordCount));
        const from = vertices[order[stroke]!]!; const to = vertices[order[stroke + 1]!]!;
        const x = (from.x + to.x) / 2; const y = (from.y + to.y) / 2;
        const dx = x - .5; const dy = y - .5;
        return { x, y, outward: Math.abs(dx) > Math.abs(dy)
          ? { x: Math.sign(dx) * 8 / width, y: 0 }
          : { x: 0, y: Math.sign(dy) * 8 / height } };
      }),
    ];
    const used = new Set<string>();
    const selected = anchors.flatMap((anchor) => {
      const base = anchor.outward ? normalized
        .filter(({ placement }) => !used.has(placement.id))
        .sort((a, b) => Math.hypot(a.x - anchor.x, a.y - anchor.y) - Math.hypot(b.x - anchor.x, b.y - anchor.y) || a.order - b.order)[0] : undefined;
      const target = base && anchor.outward
        ? { x: base.x + anchor.outward.x, y: base.y + anchor.outward.y }
        : anchor;
      const match = normalized
        .filter(({ placement }) => !used.has(placement.id))
        .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y) || a.order - b.order)[0];
      if (!match) return [];
      used.add(match.placement.id);
      return [match];
    });
    const fade = triangle(phase * recipe.fadeRate);
    const from = unpackApiLevel3Color(group.palette[0]!);
    const to = unpackApiLevel3Color(group.palette[group.palette.length - 1]!);
    const color = safeColor(packApiLevel3Color({
      red: Math.round((from.red + (to.red - from.red) * fade) * group.intensity),
      green: Math.round((from.green + (to.green - from.green) * fade) * group.intensity),
      blue: Math.round((from.blue + (to.blue - from.blue) * fade) * group.intensity),
    }));
    return Object.freeze(selected.map(({ placement }) => Object.freeze({ placementId: placement.id, color })));
  }
  if (recipe.kind === 'bird-flock' && phase < recipe.quietFraction) return Object.freeze([]);
  const orthogonalWalk = (key: string) => {
    const directionOrder = Math.floor(hash(`${key}-directions`, group.seed) * 4);
    const directions = [
      (from: typeof allNormalized[number], to: typeof allNormalized[number]) => to.x === from.x && to.y > from.y,
      (from: typeof allNormalized[number], to: typeof allNormalized[number]) => to.y === from.y && to.x > from.x,
      (from: typeof allNormalized[number], to: typeof allNormalized[number]) => to.x === from.x && to.y < from.y,
      (from: typeof allNormalized[number], to: typeof allNormalized[number]) => to.y === from.y && to.x < from.x,
    ];
    const neighbors = new Map(allNormalized.map((from) => {
      const nearest = directions.map((matches) => allNormalized
        .filter((to) => to.placement.id !== from.placement.id && matches(from, to))
        .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y) || a.order - b.order)[0])
        .filter((value): value is typeof allNormalized[number] => value !== undefined);
      nearest.sort((a, b) => {
        const aDirection = directions.findIndex((matches) => matches(from, a));
        const bDirection = directions.findIndex((matches) => matches(from, b));
        return ((aDirection - directionOrder + 4) % 4) - ((bDirection - directionOrder + 4) % 4);
      });
      return [from.placement.id, nearest] as const;
    }));
    const start = allNormalized[Math.floor(hash(`${key}-start`, group.seed) * allNormalized.length)]!;
    const visited = new Set<string>();
    const walk: typeof allNormalized = [];
    const visit = (point: typeof allNormalized[number]) => {
      visited.add(point.placement.id);
      walk.push(point);
      for (const neighbor of neighbors.get(point.placement.id) ?? []) {
        if (visited.has(neighbor.placement.id)) continue;
        visit(neighbor);
        walk.push(point);
      }
    };
    visit(start);
    return walk;
  };
  const snakePath = recipe.kind === 'snake' ? orthogonalWalk(`snake-cycle-${cycleIndex}`) : [];
  const pacManPath = recipe.kind === 'pac-man' ? orthogonalWalk(`pac-man-cycle-${cycleIndex}`) : [];
  const frameInCycle = Math.floor((boardElapsedMs % group.periodMs) / BOARD_ANIMATION_FRAME_MS);
  const pathScore = (path: typeof allNormalized, placementId: string, head: number) => {
    for (let offset = 0; offset < path.length; offset += 1) {
      if (path[(head + offset) % path.length]!.placement.id === placementId) return offset;
    }
    return Number.POSITIVE_INFINITY;
  };
  const score = (item: typeof normalized[number]) => {
    switch (recipe.kind) {
      case 'ocean-tide': return Math.abs(item.y - (recipe.direction === 'in' ? triangle(phase) : 1 - triangle(phase))) + hash(item.placement.id, group.seed) * recipe.foam * 0.08;
      case 'tie-dye-spiral': { const angle = Math.atan2(item.y - .5, item.x - .5) / (Math.PI * 2); const radius = Math.hypot(item.x - .5, item.y - .5); const turn = recipe.direction === 'clockwise' ? phase : -phase; return distance(angle * recipe.arms + radius * 1.8, turn); }
      case 'matrix-rain': {
        const profileKey = `matrix-cycle-${cycleIndex}`;
        const column = Math.round(item.x * recipe.columns);
        const columnPhase = hash(`${profileKey}-column-${column}`, group.seed);
        const wind = (hash(`${profileKey}-wind`, group.seed) - .5) * .7;
        const fallingPhase = fraction((recipe.direction === 'down' ? 1 - phase : phase) + columnPhase * .55);
        return distance(item.x * recipe.columns + phase * wind, columnPhase) + distance(item.y, fallingPhase) * .35;
      }
      case 'snake': { const head = recipe.direction === 'forward' ? frameInCycle % snakePath.length : (snakePath.length - 1 - frameInCycle) % snakePath.length; return pathScore(snakePath, item.placement.id, head); }
      case 'pac-man': { const head = recipe.direction === 'forward' ? frameInCycle % pacManPath.length : (pacManPath.length - 1 - frameInCycle) % pacManPath.length; return pathScore(pacManPath, item.placement.id, head); }
      case 'beach-ball': {
        const profileKey = `beach-ball-cycle-${cycleIndex}`;
        const xRate = recipe.velocityX * (.62 + hash(`${profileKey}-x-rate`, group.seed) * .86);
        const yRate = recipe.velocityY * (.62 + hash(`${profileKey}-y-rate`, group.seed) * .86);
        const xOffset = hash(`${profileKey}-x-offset`, group.seed);
        const yOffset = hash(`${profileKey}-y-offset`, group.seed);
        return Math.hypot(item.x - triangle(phase * xRate + xOffset), item.y - triangle(phase * yRate + yOffset));
      }
      case 'pong': {
        const profileKey = `pong-cycle-${cycleIndex}`;
        const travel = recipe.direction === 'forward' ? triangle(phase) : 1 - triangle(phase);
        const verticalRate = .72 + hash(`${profileKey}-vertical-rate`, group.seed) * 1.56;
        const verticalOffset = hash(`${profileKey}-vertical-offset`, group.seed);
        const ballY = triangle(phase * verticalRate + verticalOffset);
        const ball = Math.hypot(item.x - travel, item.y - ballY);
        const paddle = Math.min(Math.abs(item.x) + Math.abs(item.y - ballY), Math.abs(item.x - 1) + Math.abs(item.y - ballY));
        return Math.min(ball, paddle);
      }
      case 'bird-flock': {
        const travel = (phase - recipe.quietFraction) / (1 - recipe.quietFraction);
        const x = recipe.direction === 'left' ? 1 - travel : travel;
        const profileKey = `bird-cycle-${cycleIndex}`;
        const entryY = .22 + hash(`${profileKey}-entry`, group.seed) * .56;
        const exitY = .22 + hash(`${profileKey}-exit`, group.seed) * .56;
        const arc = (hash(`${profileKey}-arc`, group.seed) - .5) * .36;
        const centerY = entryY + (exitY - entryY) * travel + Math.sin(Math.PI * travel) * arc;
        const spread = .28 + hash(`${profileKey}-spread`, group.seed) * .5;
        return Math.abs(item.x - x) + Math.abs(Math.abs(item.y - centerY) - Math.abs(item.x - x) * spread);
      }
    }
  };
  const selected = normalized.map((item) => ({ ...item, score: score(item) })).filter(({ score: itemScore }) => Number.isFinite(itemScore)).sort((a, b) => a.score - b.score || a.order - b.order).slice(0, Math.min(group.footprint, candidates.length));
  const scene = selected.map((item, index) => {
    const color = safeColor(colorAt(group, phase + index / Math.max(1, selected.length)));
    return Object.freeze({ placementId: item.placement.id, color });
  });
  if (scene.length > group.footprint) throw new RangeError(`Spatial effect ${group.id} exceeded its ${group.footprint}-light reserve`);
  return Object.freeze(scene);
}
