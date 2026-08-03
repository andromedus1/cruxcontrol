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
  const recipe = group.recipe;
  if (recipe.kind === 'bird-flock' && phase < recipe.quietFraction) return Object.freeze([]);
  const serpentine = [...normalized].sort((a, b) => Math.round(a.y * 20) - Math.round(b.y * 20) || ((Math.round(a.y * 20) % 2 ? -1 : 1) * (a.x - b.x)) || a.order - b.order);
  const weave = (
    primary: (item: typeof normalized[number]) => number,
    secondary: (item: typeof normalized[number]) => number,
    descending = false,
  ) => [...normalized].sort((a, b) => {
    const aBand = Math.round(primary(a) * 20);
    const bBand = Math.round(primary(b) * 20);
    const bandOrder = descending ? bBand - aBand : aBand - bBand;
    return bandOrder || ((Math.abs(aBand) % 2 ? -1 : 1) * (secondary(a) - secondary(b))) || a.order - b.order;
  });
  const snakeVariant = (cycleIndex + Math.floor(hash('snake-weave-offset', group.seed) * 4)) % 4;
  const snakePath = snakeVariant === 0
    ? weave((item) => item.x, (item) => item.y)
    : snakeVariant === 1
      ? weave((item) => item.x, (item) => item.y, true)
      : snakeVariant === 2
        ? weave((item) => (item.x + item.y) / 2, (item) => item.x - item.y)
        : weave((item) => (item.x - item.y + 1) / 2, (item) => item.x + item.y);
  const score = (item: typeof normalized[number]) => {
    switch (recipe.kind) {
      case 'ocean-tide': return Math.abs(item.y - (recipe.direction === 'in' ? triangle(phase) : 1 - triangle(phase))) + hash(item.placement.id, group.seed) * recipe.foam * 0.08;
      case 'tie-dye-spiral': { const angle = Math.atan2(item.y - .5, item.x - .5) / (Math.PI * 2); const radius = Math.hypot(item.x - .5, item.y - .5); const turn = recipe.direction === 'clockwise' ? phase : -phase; return distance(angle * recipe.arms + radius * 1.8, turn); }
      case 'matrix-rain': return distance(item.x * recipe.columns, hash(String(Math.round(item.x * recipe.columns)), group.seed)) + distance(item.y, recipe.direction === 'down' ? 1 - phase : phase) * .3;
      case 'snake': { const index = snakePath.findIndex((candidate) => candidate.placement.id === item.placement.id); const head = Math.floor((recipe.direction === 'forward' ? phase : 1 - phase) * snakePath.length) % snakePath.length; return (index - head + snakePath.length) % snakePath.length; }
      case 'pac-man': { const index = serpentine.findIndex((candidate) => candidate.placement.id === item.placement.id); const head = Math.floor((recipe.direction === 'forward' ? phase : 1 - phase) * serpentine.length) % serpentine.length; return (index - head + serpentine.length) % serpentine.length; }
      case 'beach-ball': return Math.hypot(item.x - triangle(phase * recipe.velocityX), item.y - triangle(phase * recipe.velocityY));
      case 'pong': { const travel = recipe.direction === 'forward' ? triangle(phase) : 1 - triangle(phase); const ball = Math.hypot(item.x - travel, item.y - triangle(phase * 1.37)); const paddle = Math.min(Math.abs(item.x) + Math.abs(item.y - triangle(phase * 1.37)), Math.abs(item.x - 1) + Math.abs(item.y - triangle(phase * 1.37))); return Math.min(ball, paddle); }
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
  const reserved = new Set(Object.values(definition.rolePresets).map(({ lightColor }) => lightColor as number));
  const selected = normalized.map((item) => ({ ...item, score: score(item) })).sort((a, b) => a.score - b.score || a.order - b.order).slice(0, Math.min(group.footprint, candidates.length));
  const scene = selected.map((item, index) => {
    let color = colorAt(group, phase + index / Math.max(1, selected.length));
    for (let attempts = 0; attempts < 256 && ((color as number) === 0 || reserved.has(color as number)); attempts += 1) color = apiLevel3Color(((color as number) + 1) % 256);
    return Object.freeze({ placementId: item.placement.id, color });
  });
  if (scene.length > group.footprint) throw new RangeError(`Spatial effect ${group.id} exceeded its ${group.footprint}-light reserve`);
  return Object.freeze(scene);
}
