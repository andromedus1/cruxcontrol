import type { ApiLevel3Color } from './types';

export interface Rgb24 {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

function channel(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new RangeError(`${name} must be an integer from 0 to 255`);
  }
  return value;
}

export function apiLevel3Color(value: number): ApiLevel3Color {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new RangeError('API-level-3 color must be an integer from 0 to 255');
  }
  return value as ApiLevel3Color;
}

export function packApiLevel3Color(rgb: Rgb24): ApiLevel3Color {
  const red = channel(rgb.red, 'Red');
  const green = channel(rgb.green, 'Green');
  const blue = channel(rgb.blue, 'Blue');
  return apiLevel3Color(((red >> 5) << 5) | ((green >> 5) << 2) | (blue >> 6));
}

export function unpackApiLevel3Color(color: ApiLevel3Color): Rgb24 {
  const value = apiLevel3Color(color);
  return {
    red: Math.round((((value >> 5) & 0x07) * 255) / 7),
    green: Math.round((((value >> 2) & 0x07) * 255) / 7),
    blue: Math.round(((value & 0x03) * 255) / 3),
  };
}

export function apiLevel3ColorHex(color: ApiLevel3Color): `#${string}` {
  const rgb = unpackApiLevel3Color(color);
  return `#${[rgb.red, rgb.green, rgb.blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}
