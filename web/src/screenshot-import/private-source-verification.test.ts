import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { detectKilterFullrideRings } from './ring-detector';
import { SUPPLIED_FULLRIDE_CLIMBS } from './supplied-fullride-climbs';
import type { DetectedRing, SuppliedRingFact } from './types';

const SOURCE_DIRECTORY = resolve(process.cwd(), '../docs/set_boulders');

function paeth(left: number, up: number, upperLeft: number): number {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  return upDistance <= upperLeftDistance ? up : upperLeft;
}

function decodeRgbaPng(source: Buffer) {
  expect(source.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  let offset = 8;
  let width = 0;
  let height = 0;
  const compressed: Buffer[] = [];
  while (offset < source.length) {
    const length = source.readUInt32BE(offset);
    const type = source.subarray(offset + 4, offset + 8).toString('ascii');
    const data = source.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect([...data.subarray(8, 13)]).toEqual([8, 6, 0, 0, 0]);
    } else if (type === 'IDAT') compressed.push(data);
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(compressed));
  const stride = width * 4;
  expect(raw.length).toBe((stride + 1) * height);
  const pixels = new Uint8ClampedArray(stride * height);
  let sourceOffset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = raw[sourceOffset++];
    for (let columnByte = 0; columnByte < stride; columnByte += 1) {
      const encoded = raw[sourceOffset++];
      const target = row * stride + columnByte;
      const left = columnByte >= 4 ? pixels[target - 4]! : 0;
      const up = row > 0 ? pixels[target - stride]! : 0;
      const upperLeft = row > 0 && columnByte >= 4 ? pixels[target - stride - 4]! : 0;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? up
              : filter === 3
                ? Math.floor((left + up) / 2)
                : filter === 4
                  ? paeth(left, up, upperLeft)
                  : Number.NaN;
      if (!Number.isFinite(predictor)) throw new TypeError(`Unsupported PNG filter ${filter}`);
      pixels[target] = (encoded + predictor) & 0xff;
    }
  }
  return { width, height, data: pixels };
}

function tuple(fact: DetectedRing | SuppliedRingFact): string {
  return `${fact.row.toString().padStart(2, '0')}:${fact.column.toString().padStart(2, '0')}:${fact.role}`;
}

describe('private supplied screenshot sources', () => {
  const verify = existsSync(SOURCE_DIRECTORY) ? it : it.skip;
  verify(
    'matches all 16 read-only PNG checksums and production-detector ring tuples to the manifest',
    () => {
      const paths = readdirSync(SOURCE_DIRECTORY)
        .filter((name) => extname(name).toLowerCase() === '.png')
        .sort();
      expect(paths).toHaveLength(16);
      for (const name of paths) {
        const bytes = readFileSync(`${SOURCE_DIRECTORY}/${name}`);
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        const entry = SUPPLIED_FULLRIDE_CLIMBS.find((candidate) => candidate.sha256 === sha256);
        expect(entry, `checksum-linked manifest entry for ${name}`).toBeDefined();
        expect(entry?.sourceName).toBe(basename(name));
        expect(entry?.name.trim()).not.toBe('');
        const detected = detectKilterFullrideRings(decodeRgbaPng(bytes));
        expect(detected.rings.map(tuple).sort(), `ring facts for ${name}`).toEqual(
          entry!.rings.map(tuple).sort(),
        );
        expect(
          detected.warnings.every(({ code }) => code === 'off-grid'),
          `only status-bar/off-board components may warn for ${name}`,
        ).toBe(true);
      }
    },
    120_000,
  );
});
