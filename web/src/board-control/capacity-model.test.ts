import { describe, expect, it } from 'vitest';
import { encodeApiLevel2Scene } from './api-level-2-codec';
import { encodeApiLevel3Scene, type ApiLevel3Light } from './api-level-3-codec';
import { encodedSceneCost } from './capacity-model';

const POINTS = [0, 1, 20, 84, 85, 127, 128, 168, 252, 305] as const;

describe('encodedSceneCost', () => {
  it.each([2, 3] as const)('matches API %i codec output and packet boundaries', (apiLevel) => {
    for (const lightCount of POINTS) {
      const lights: ApiLevel3Light[] = Array.from({ length: lightCount }, (_, ledPosition) => ({
        ledPosition,
        color: 0xff,
      }));
      const writes = apiLevel === 3 ? encodeApiLevel3Scene(lights) : encodeApiLevel2Scene(lights);
      const cost = encodedSceneCost(apiLevel, lightCount);
      expect(cost.writeCount).toBe(writes.length);
      expect(cost.framedBytes).toBe(writes.reduce((sum, write) => sum + write.byteLength, 0));
    }
  });

  it('reports the profiled full-board values and rejects invalid counts', () => {
    expect(encodedSceneCost(3, 305)).toEqual({
      apiLevel: 3,
      lightCount: 305,
      packetCount: 4,
      framedBytes: 939,
      writeCount: 47,
    });
    expect(encodedSceneCost(2, 305)).toEqual({
      apiLevel: 2,
      lightCount: 305,
      packetCount: 3,
      framedBytes: 628,
      writeCount: 32,
    });
    expect(() => encodedSceneCost(3, -1)).toThrow(RangeError);
  });
});
