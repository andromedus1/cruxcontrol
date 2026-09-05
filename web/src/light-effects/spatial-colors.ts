import { quantizeApiLevel3ColorForApiLevel2 } from '../board-control/api-level-2-codec';
import { apiLevel3Color, packApiLevel3Color, unpackApiLevel3Color } from '../domain/boards/colors';
import type { BoardDefinition } from '../domain/boards/definition';
import type { ApiLevel3Color } from '../domain/boards/types';

let lookup = new WeakMap<BoardDefinition, readonly ApiLevel3Color[]>();

function buildLookup(definition: BoardDefinition): readonly ApiLevel3Color[] {
  const reservedLogical = new Set(Object.values(definition.rolePresets).map(({ lightColor }) => lightColor as number));
  const reservedEncoded = new Set(Object.values(definition.rolePresets).map(({ lightColor }) => quantizeApiLevel3ColorForApiLevel2(lightColor)));
  reservedEncoded.add(quantizeApiLevel3ColorForApiLevel2(0));
  const result = Array.from({ length: 256 }, (_, source) => {
    if (source === 0) return apiLevel3Color(0);
    const sourceRgb = unpackApiLevel3Color(apiLevel3Color(source));
    let best = apiLevel3Color(source);
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let candidate = 1; candidate < 256; candidate += 1) {
      if (reservedLogical.has(candidate)) continue;
      if (reservedEncoded.has(quantizeApiLevel3ColorForApiLevel2(candidate))) continue;
      const rgb = unpackApiLevel3Color(apiLevel3Color(candidate));
      const distance = (rgb.red - sourceRgb.red) ** 2 + (rgb.green - sourceRgb.green) ** 2 + (rgb.blue - sourceRgb.blue) ** 2;
      if (distance < bestDistance || (distance === bestDistance && candidate < (best as number))) {
        bestDistance = distance;
        best = apiLevel3Color(candidate);
      }
    }
    return best;
  });
  return Object.freeze(result);
}

/**
 * Keeps an interpolated decorative color away from semantic role colors after
 * API-level-2 quantization. The input remains untouched and black stays black;
 * callers omit black when composing a spatial scene.
 */
export function spatialDisplayColor(definition: BoardDefinition, color: ApiLevel3Color): ApiLevel3Color {
  const colors = lookup.get(definition) ?? buildLookup(definition);
  if (!lookup.has(definition)) lookup.set(definition, colors);
  return colors[color as number] ?? packApiLevel3Color(unpackApiLevel3Color(color));
}

export function clearSpatialColorCache(): void {
  lookup = new WeakMap<BoardDefinition, readonly ApiLevel3Color[]>();
}
