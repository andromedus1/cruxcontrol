import { describe, expect, it } from 'vitest';
import {
  checksumApiLevel3Payload,
  encodeApiLevel3Packets,
  encodeApiLevel3Scene,
  quantizeApiLevel3Color,
  splitApiLevel3Writes,
  type ApiLevel3Light,
  type Rgb24,
} from './api-level-3-codec.ts';

const bytes = (...values: number[]) => new Uint8Array(values);
const flatten = (parts: readonly Uint8Array[]) =>
  Uint8Array.from(parts.flatMap((part) => Array.from(part)));

describe('quantizeApiLevel3Color', () => {
  it.each<[Rgb24, number]>([
    [{ red: 0, green: 0, blue: 0 }, 0x00],
    [{ red: 255, green: 255, blue: 255 }, 0xff],
    [{ red: 255, green: 0, blue: 0 }, 0xe0],
    [{ red: 0, green: 255, blue: 0 }, 0x1c],
    [{ red: 0, green: 0, blue: 255 }, 0x03],
    [{ red: 160, green: 96, blue: 128 }, 0xae],
    [{ red: 31, green: 31, blue: 63 }, 0x00],
  ])('quantizes $0 to $1', (rgb, expected) => {
    expect(quantizeApiLevel3Color(rgb)).toBe(expected);
  });

  it('can produce every protocol color byte', () => {
    const colors = new Set<number>();
    for (let red = 0; red < 8; red += 1) {
      for (let green = 0; green < 8; green += 1) {
        for (let blue = 0; blue < 4; blue += 1) {
          colors.add(quantizeApiLevel3Color({ red: red << 5, green: green << 5, blue: blue << 6 }));
        }
      }
    }
    expect([...colors].sort((left, right) => left - right)).toEqual(
      Array.from({ length: 256 }, (_, index) => index),
    );
  });

  it.each([
    ['red', -1],
    ['red', 256],
    ['red', 1.5],
    ['green', Number.NaN],
    ['green', Number.POSITIVE_INFINITY],
    ['blue', Number.NEGATIVE_INFINITY],
  ] as const)('rejects an invalid %s channel', (channel, value) => {
    const rgb: Rgb24 = { red: 0, green: 0, blue: 0, [channel]: value };
    expect(() => quantizeApiLevel3Color(rgb)).toThrow(RangeError);
  });
});

describe('encodeApiLevel3Packets', () => {
  it('encodes the exact empty clear frame', () => {
    expect(encodeApiLevel3Packets([])).toEqual([bytes(0x01, 0x01, 0xab, 0x02, 0x54, 0x03)]);
  });

  it('encodes the exact documented green-light fixture', () => {
    expect(encodeApiLevel3Packets([{ ledPosition: 42, color: 0x1c }])).toEqual([
      bytes(0x01, 0x04, 0x65, 0x02, 0x54, 0x2a, 0x00, 0x1c, 0x03),
    ]);
  });

  it('encodes positions little-endian', () => {
    const [packet] = encodeApiLevel3Packets([{ ledPosition: 0x1234, color: 0xff }]);
    expect(packet?.slice(5, 8)).toEqual(bytes(0x34, 0x12, 0xff));
  });

  it.each([
    [84, [0x54]],
    [85, [0x52, 0x53]],
    [168, [0x52, 0x53]],
    [169, [0x52, 0x51, 0x53]],
  ] as const)('preserves %i records with the expected markers', (count, markers) => {
    const scene = makeScene(count);
    const packets = encodeApiLevel3Packets(scene);
    expect(packets.map((packet) => packet[4])).toEqual(markers);

    const decoded = packets.flatMap((packet) => {
      expect(packet[0]).toBe(0x01);
      expect(packet[1]).toBe(packet.length - 5);
      expect(packet[2]).toBe(independentChecksum(packet.slice(4, -1)));
      expect(packet[3]).toBe(0x02);
      expect(packet.at(-1)).toBe(0x03);
      return decodeRecords(packet);
    });
    expect(decoded).toEqual(scene);
  });

  it.each([
    ['ledPosition', -1],
    ['ledPosition', 65_536],
    ['ledPosition', 1.5],
    ['ledPosition', Number.NaN],
    ['color', -1],
    ['color', 256],
    ['color', 1.5],
    ['color', Number.POSITIVE_INFINITY],
  ] as const)('rejects invalid light %s values', (field, value) => {
    const light: ApiLevel3Light = { ledPosition: 1, color: 1, [field]: value };
    expect(() => encodeApiLevel3Packets([light])).toThrow(RangeError);
  });

  it('identifies both indexes when LED positions are duplicated', () => {
    expect(() =>
      encodeApiLevel3Packets([
        { ledPosition: 42, color: 1 },
        { ledPosition: 7, color: 2 },
        { ledPosition: 42, color: 3 },
      ]),
    ).toThrow(/indexes 0 and 2/);
  });
});

describe('checksumApiLevel3Payload', () => {
  it('complements the low byte of the payload sum', () => {
    expect(checksumApiLevel3Payload(bytes(0x54))).toBe(0xab);
    expect(checksumApiLevel3Payload(bytes(0x54, 0x2a, 0x00, 0x1c))).toBe(0x65);
    expect(checksumApiLevel3Payload(bytes(0xff, 0x02))).toBe(0xfe);
  });
});

describe('splitApiLevel3Writes', () => {
  it.each([
    [6, [6]],
    [20, [20]],
    [21, [20, 1]],
  ] as const)('splits a %i-byte stream without loss', (length, expectedLengths) => {
    const packet = Uint8Array.from({ length }, (_, index) => index);
    const writes = splitApiLevel3Writes([packet]);
    expect(writes.map((write) => write.length)).toEqual(expectedLengths);
    expect(flatten(writes)).toEqual(packet);
  });

  it('chunks multiple packets as one continuous message across packet boundaries', () => {
    const packets = [Uint8Array.from({ length: 18 }, (_, index) => index), bytes(18, 19, 20, 21)];
    const writes = splitApiLevel3Writes(packets);
    expect(writes.map((write) => write.length)).toEqual([20, 2]);
    expect(writes[0]?.slice(-2)).toEqual(bytes(18, 19));
    expect(flatten(writes)).toEqual(flatten(packets));
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid maximum write size %s',
    (size) => expect(() => splitApiLevel3Writes([bytes(1)], size)).toThrow(RangeError),
  );

  it('rejects an empty packet list', () => {
    expect(() => splitApiLevel3Writes([])).toThrow(/At least one framed packet/);
  });

  it('reconstructs a large multi-packet encoded scene with 1-20 byte writes', () => {
    const packets = encodeApiLevel3Packets(makeScene(169));
    const writes = splitApiLevel3Writes(packets);
    expect(writes.every((write) => write.length >= 1 && write.length <= 20)).toBe(true);
    expect(flatten(writes)).toEqual(flatten(packets));
  });
});

describe('encodeApiLevel3Scene', () => {
  it('composes encoding and default write chunking', () => {
    expect(encodeApiLevel3Scene([])).toEqual([bytes(0x01, 0x01, 0xab, 0x02, 0x54, 0x03)]);
    expect(flatten(encodeApiLevel3Scene(makeScene(85)))).toEqual(
      flatten(encodeApiLevel3Packets(makeScene(85))),
    );
  });
});

function makeScene(count: number): ApiLevel3Light[] {
  return Array.from({ length: count }, (_, index) => ({
    ledPosition: index,
    color: index & 0xff,
  }));
}

function independentChecksum(payload: Uint8Array): number {
  return ~(Array.from(payload).reduce((sum, value) => sum + value, 0) & 0xff) & 0xff;
}

function decodeRecords(packet: Uint8Array): ApiLevel3Light[] {
  const records: ApiLevel3Light[] = [];
  for (let offset = 5; offset < packet.length - 1; offset += 3) {
    records.push({
      ledPosition: packet[offset]! | (packet[offset + 1]! << 8),
      color: packet[offset + 2]!,
    });
  }
  return records;
}
