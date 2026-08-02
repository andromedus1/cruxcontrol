import { describe, expect, it } from 'vitest';
import {
  apiLevelForAuroraDeviceName,
  encodeApiLevel2Packets,
  encodeApiLevel2Scene,
  quantizeApiLevel3ColorForApiLevel2,
} from './api-level-2-codec.ts';

const bytes = (...values: number[]) => new Uint8Array(values);

describe('Aurora API-level discovery', () => {
  it.each([
    ['Kilter Board', 2],
    ['Kilter Board#123', 2],
    ['Kilter Board@2', 2],
    ['Kilter Board#123@2', 2],
    ['Kilter Board#123@3', 3],
    ['Custom Wall@3', 3],
    [null, 2],
  ] as const)('maps %s to API level %i', (name, expected) => {
    expect(apiLevelForAuroraDeviceName(name)).toBe(expected);
  });
});

describe('API-level-2 encoding', () => {
  it('packs a position and down-quantized API3 color into an API2 pair', () => {
    expect(quantizeApiLevel3ColorForApiLevel2(0xff)).toBe(0xfc);
    expect(encodeApiLevel2Packets([{ ledPosition: 0x012a, color: 0xff }])).toEqual([
      bytes(0x01, 0x03, 0x88, 0x02, 0x50, 0x2a, 0xfd, 0x03),
    ]);
  });

  it('uses the API2 clear marker and 20-byte writes', () => {
    expect(encodeApiLevel2Scene([])).toEqual([bytes(0x01, 0x01, 0xaf, 0x02, 0x50, 0x03)]);
    expect(encodeApiLevel2Scene(Array.from({ length: 10 }, (_, ledPosition) => ({
      ledPosition,
      color: 0xff,
    }))).map((chunk) => chunk.length)).toEqual([20, 6]);
  });
});
