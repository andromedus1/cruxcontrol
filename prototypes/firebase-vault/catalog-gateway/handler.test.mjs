import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createCatalogHandler } from './handler.mjs';
import { artifactObject, manifestObject } from './contract.mjs';

const owner = 'synthetic-owner';
const artifact = Buffer.from('gzip-bytes-for-v2');
const manifestFor = (version, bytes) => Buffer.from(JSON.stringify({ schemaVersion: 3, source: 'boardsesh-kilter',
  version, file: `kilter-7x10.v${version}.db.gz`, sha256: 'b'.repeat(64), bytesGzipped: bytes.length }));

async function harness(t, { objects, failList = false, failRead = false } = {}) {
  const stored = objects ?? new Map([
    [artifactObject(1), Buffer.from('v1')], [manifestObject(1), manifestFor(1, Buffer.from('v1'))],
    [artifactObject(2), artifact], [manifestObject(2), manifestFor(2, artifact)],
    [artifactObject(3), Buffer.from('unpublished')],
  ]);
  const reads = [];
  const store = {
    async list() {
      if (failList) throw new Error('boom');
      return [...stored.keys()].map((name, index) => ({ name, generation: String(index + 1) }));
    },
    async read(name, generation) {
      reads.push([name, generation]);
      if (failRead) throw new Error('boom');
      return stored.get(name);
    },
  };
  const verifyToken = async token => {
    if (token === 'unavailable') throw new Error('provider down');
    if (!['owner', 'other'].includes(token)) throw Object.assign(new Error('secret detail'), { code: 'auth/id-token-expired' });
    return { uid: token === 'owner' ? owner : 'someone-else' };
  };
  const server = createServer(createCatalogHandler({ admittedUids: [owner], verifyToken, store }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (path, token = 'owner', method = 'GET') =>
    fetch(`${base}${path}`, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { get, reads };
}

test('authentication and admission', async t => {
  const { get } = await harness(t);
  assert.equal((await get('/catalog-v1/manifest', null)).status, 401);
  assert.equal((await get('/catalog-v1/manifest', 'expired')).status, 401);
  assert.equal((await get('/catalog-v1/manifest', 'unavailable')).status, 503);
  const forbidden = await get('/catalog-v1/manifest', 'other');
  assert.equal(forbidden.status, 403);
  assert.deepEqual(await forbidden.json(), { error: 'ACCOUNT_NOT_ADMITTED' });
});

test('serves the latest published manifest, ignoring unpublished versions', async t => {
  const { get } = await harness(t);
  const response = await get('/catalog-v1/manifest');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await response.json()).version, 2);
});

test('streams a published artifact with exact length and digest header', async t => {
  const { get, reads } = await harness(t);
  const response = await get('/catalog-v1/artifacts/kilter-7x10.v2.db.gz');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/gzip');
  assert.equal(response.headers.get('content-length'), String(artifact.length));
  assert.equal(response.headers.get('content-encoding'), null);
  assert.equal(response.headers.get('x-catalog-sha256'), 'b'.repeat(64));
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), artifact);
  assert.deepEqual(reads.at(-1), [artifactObject(2), '3']);
  assert.equal((await get('/catalog-v1/artifacts/kilter-7x10.v1.db.gz')).status, 200);
});

test('rejects unpublished, malformed and traversal paths', async t => {
  const { get } = await harness(t);
  for (const path of ['/catalog-v1/artifacts/kilter-7x10.v3.db.gz', '/catalog-v1/artifacts/kilter-7x10.v9.db.gz',
    '/catalog-v1/artifacts/..%2Fsecret', '/catalog-v1/artifacts/kilter-7x10.v02.db.gz',
    '/catalog-v1/manifest?x=1', '/catalog-v1/artifacts/', '/snapshots', '/']) {
    assert.equal((await get(path)).status, 404, path);
  }
  const method = await get('/catalog-v1/manifest', 'owner', 'DELETE');
  assert.equal(method.status, 405);
  assert.equal(method.headers.get('allow'), 'GET');
});

test('no catalog and storage failures', async t => {
  const empty = await harness(t, { objects: new Map() });
  assert.deepEqual(await (await empty.get('/catalog-v1/manifest')).json(), { error: 'NO_CATALOG' });
  const listFailure = await harness(t, { failList: true });
  assert.equal((await listFailure.get('/catalog-v1/manifest')).status, 503);
  const readFailure = await harness(t, { failRead: true });
  const response = await readFailure.get('/catalog-v1/artifacts/kilter-7x10.v2.db.gz');
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'CATALOG_UNAVAILABLE' });
});

test('artifact length must match its manifest', async t => {
  const objects = new Map([[artifactObject(1), Buffer.from('truncated')],
    [manifestObject(1), manifestFor(1, Buffer.from('much longer original'))]]);
  const { get } = await harness(t, { objects });
  assert.equal((await get('/catalog-v1/artifacts/kilter-7x10.v1.db.gz')).status, 503);
});
