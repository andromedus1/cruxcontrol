import { describe, expect, it } from 'vitest';
import {
  apiLevel3Color,
  apiLevel3ColorHex,
  packApiLevel3Color,
  unpackApiLevel3Color,
} from './colors';

describe('API-level-3 colors', () => {
  it('round-trips every packed color', () => {
    for (let value = 0; value <= 255; value += 1) {
      const packed = apiLevel3Color(value);
      expect(packApiLevel3Color(unpackApiLevel3Color(packed))).toBe(packed);
      expect(apiLevel3ColorHex(packed)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it.each([
    [{ red: 0, green: 0, blue: 0 }, 0x00],
    [{ red: 255, green: 0, blue: 0 }, 0xe0],
    [{ red: 0, green: 255, blue: 0 }, 0x1c],
    [{ red: 0, green: 0, blue: 255 }, 0x03],
    [{ red: 255, green: 255, blue: 255 }, 0xff],
  ])('packs %o as %i', (rgb, expected) => expect(packApiLevel3Color(rgb)).toBe(expected));

  it('rejects malformed packed values and channels rather than clamping', () => {
    for (const value of [-1, 1.5, 256, Number.NaN])
      expect(() => apiLevel3Color(value)).toThrow(RangeError);
    expect(() => packApiLevel3Color({ red: 256, green: 0, blue: 0 })).toThrow(RangeError);
    expect(() => packApiLevel3Color({ red: 0, green: -1, blue: 0 })).toThrow(RangeError);
    expect(() => packApiLevel3Color({ red: 0, green: 0, blue: 0.5 })).toThrow(RangeError);
  });
});
