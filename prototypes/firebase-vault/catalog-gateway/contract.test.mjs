import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { artifactObject, checkManifest, latestVersion, manifestObject, validateAdmitted } from './contract.mjs';

const fixture = JSON.parse(readFileSync(new URL('../storage-layout.fixture.json', import.meta.url), 'utf8'));
const manifest = (version, extra = {}) => Buffer.from(JSON.stringify({ schemaVersion: 3, source: 'boardsesh-kilter',
  version, file: `kilter-7x10.v${version}.db.gz`, sha256: 'a'.repeat(64), bytesGzipped: 10, ...extra }));

test('latest version matches the shared storage layout cases', () => {
  for (const { names, latest } of fixture.cases) assert.equal(latestVersion(names), latest, JSON.stringify(names));
});

test('object names match the shared storage layout', () => {
  for (const { version, artifact, manifest: name } of fixture.objects) {
    assert.equal(artifactObject(version), artifact);
    assert.equal(manifestObject(version), name);
  }
  for (const bad of [0, -1, 1_000_000, 1.5]) assert.throws(() => artifactObject(bad), RangeError);
});

test('manifest identity checks', () => {
  assert.equal(checkManifest(manifest(4), 4).version, 4);
  for (const [label, bytes] of [
    ['version mismatch', manifest(4)],
    ['schema 2', manifest(5, { schemaVersion: 2 })],
    ['file mismatch', manifest(5, { file: 'kilter-7x10.v4.db.gz' })],
    ['oversized artifact', manifest(5, { bytesGzipped: 9 * 1024 * 1024 })],
    ['not an object', Buffer.from('[]')],
  ]) assert.throws(() => checkManifest(bytes, 5), Error, label);
});

test('admitted account configuration', () => {
  assert.deepEqual([...validateAdmitted(['abc', 'D-E_f'])], ['abc', 'D-E_f']);
  for (const bad of [[], [''], ['a b'], 'abc', Array(33).fill('a')]) assert.throws(() => validateAdmitted(bad));
});
