import { lightEffectGroupId, type SpatialEffectKind, type SpatialLightEffectGroup, type SpatialRecipe } from '../board-renderer/types';
import { apiLevel3Color } from '../domain/boards/colors';

export interface SpatialPreset { readonly kind: SpatialEffectKind; readonly label: string; readonly footprint: number; readonly palette: readonly number[]; readonly periodMs: number; readonly recipe: SpatialRecipe }

export const SPATIAL_PRESETS: readonly SpatialPreset[] = Object.freeze([
  { kind: 'ocean-tide', label: 'Ocean tide', footprint: 12, palette: [0x16, 0x2b, 0x3e, 0xbf, 0xe8], periodMs: 30_000, recipe: { kind: 'ocean-tide', direction: 'in', foam: 0.25 } },
  { kind: 'tie-dye-spiral', label: 'Tie-dye spiral', footprint: 12, palette: [0xe0, 0xf0, 0x1f, 0x1b, 0x83, 0xc3], periodMs: 45_000, recipe: { kind: 'tie-dye-spiral', direction: 'clockwise', arms: 3 } },
  { kind: 'matrix-rain', label: 'Matrix rain', footprint: 10, palette: [0x04, 0x0c, 0x1c], periodMs: 30_000, recipe: { kind: 'matrix-rain', direction: 'down', columns: 5 } },
  { kind: 'snake', label: 'Snake', footprint: 7, palette: [0x1c, 0x18], periodMs: 120_000, recipe: { kind: 'snake', direction: 'forward', bodyLength: 7 } },
  { kind: 'beach-ball', label: 'Beach ball', footprint: 4, palette: [0xfc, 0xe3, 0x1f], periodMs: 30_000, recipe: { kind: 'beach-ball', velocityX: 1, velocityY: 0.73, size: 4 } },
  { kind: 'pac-man', label: 'Pac-Man', footprint: 7, palette: [0xfc, 0x83], periodMs: 120_000, recipe: { kind: 'pac-man', direction: 'forward', mouthBeat: 2 } },
  { kind: 'pong', label: 'Pong', footprint: 6, palette: [0xff, 0x1b], periodMs: 30_000, recipe: { kind: 'pong', direction: 'forward', paddleSize: 2 } },
  { kind: 'bird-flock', label: 'Bird flock', footprint: 8, palette: [0xbf, 0x6f], periodMs: 45_000, recipe: { kind: 'bird-flock', direction: 'left', quietFraction: 0.35 } },
  { kind: 'frogger', label: 'Frogger', footprint: 10, palette: [0x1c, 0xc0, 0xa0], periodMs: 45_000, recipe: { kind: 'frogger', lanes: 4 } },
  { kind: 'pentagram', label: 'Fading pentagram', footprint: 15, palette: [0x20, 0xc0], periodMs: 30_000, recipe: { kind: 'pentagram', fadeRate: 1 } },
]);

export function createSpatialPreset(kind: SpatialEffectKind, seed = Date.now()): SpatialLightEffectGroup {
  const preset = SPATIAL_PRESETS.find((candidate) => candidate.kind === kind);
  if (!preset) throw new RangeError(`Unknown spatial preset ${kind}`);
  return Object.freeze({
    model: 'spatial', id: lightEffectGroupId(`effect-${crypto.randomUUID()}`), recipeVersion: 1,
    recipe: Object.freeze({ ...preset.recipe }), seed: Math.trunc(seed),
    palette: Object.freeze(preset.palette.map(apiLevel3Color)), periodMs: preset.periodMs,
    intensity: 1, footprint: preset.footprint,
    target: Object.freeze({ scope: 'unused' as const, include: Object.freeze([]), exclude: Object.freeze([]) }),
  });
}
