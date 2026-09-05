import { describe, expect, it } from 'vitest';
import { quantizeApiLevel3ColorForApiLevel2 } from '../board-control/api-level-2-codec';
import { apiLevel3Color, unpackApiLevel3Color } from '../domain/boards/colors';
import { kilterFullride7x10Definition as definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { spatialDisplayColor } from './spatial-colors';

describe('API-2 spatial color protection', () => {
  it('keeps every nonblack source byte away from encoded role colors', () => {
    const roleBytes = new Set(Object.values(definition.rolePresets).map(({ lightColor }) => quantizeApiLevel3ColorForApiLevel2(lightColor)));
    roleBytes.add(quantizeApiLevel3ColorForApiLevel2(0));
    for (let source = 1; source < 256; source += 1) {
      const adjusted = spatialDisplayColor(definition, apiLevel3Color(source));
      expect(adjusted).not.toBe(apiLevel3Color(0));
      expect(roleBytes.has(quantizeApiLevel3ColorForApiLevel2(adjusted))).toBe(false);
    }
  });

  it('keeps black black and returns a nearby packed color', () => {
    expect(spatialDisplayColor(definition, apiLevel3Color(0))).toBe(apiLevel3Color(0));
    const source = apiLevel3Color(0x1c);
    const adjusted = spatialDisplayColor(definition, source);
    const from = unpackApiLevel3Color(source);
    const to = unpackApiLevel3Color(adjusted);
    expect((to.red - from.red) ** 2 + (to.green - from.green) ** 2 + (to.blue - from.blue) ** 2).toBeLessThan(255 ** 2 * 3);
  });
});
