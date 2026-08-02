import { bench, describe } from 'vitest';
import { encodeApiLevel2Scene } from './api-level-2-codec.ts';
import { encodeApiLevel3Scene, type ApiLevel3Light } from './api-level-3-codec.ts';

const scene = (lightCount: number): readonly ApiLevel3Light[] =>
  Object.freeze(
    Array.from({ length: lightCount }, (_, ledPosition) =>
      Object.freeze({ ledPosition, color: ledPosition % 256 }),
    ),
  );

describe('Aurora full-scene encoder baseline', () => {
  for (const lightCount of [1, 20, 84, 85, 168, 252, 305]) {
    const lights = scene(lightCount);
    bench(`API level 2 · ${lightCount} lights`, () => {
      encodeApiLevel2Scene(lights);
    });
    bench(`API level 3 · ${lightCount} lights`, () => {
      encodeApiLevel3Scene(lights);
    });
  }
});
