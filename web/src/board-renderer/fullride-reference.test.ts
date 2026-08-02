import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const FULLRIDE_REFERENCE = {
  path: resolve(process.cwd(), '../docs/kilter_fullride_7x10.png'),
  width: 1126,
  height: 1584,
  sha256: 'a1e17430dd42eb7c81021834405a87d5a90bf9d14bca9af408553380f0a00bb0',
} as const;

it('preserves the immutable Fullride visual reference', async () => {
  const png = await readFile(FULLRIDE_REFERENCE.path);
  expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
  expect(png.readUInt32BE(16)).toBe(FULLRIDE_REFERENCE.width);
  expect(png.readUInt32BE(20)).toBe(FULLRIDE_REFERENCE.height);
  expect(createHash('sha256').update(png).digest('hex')).toBe(FULLRIDE_REFERENCE.sha256);
});
