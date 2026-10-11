import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { createVaultHandler } from './handler.mjs';
import { ACCEPTANCE_POOLS, APPLICATION_POOLS, LIBRARY_POOL, MAX_BYTES, digest } from './contract.mjs';
import { encodeLibraryBackup } from '../../../web/src/library-backup/codec.ts';
import { draftContent, FIRST_DRAFT_ID } from '../../../web/src/drafts/test-fixtures.ts';
import { kilterFullride7x10Definition } from '../../../web/src/domain/boards/definitions/kilter-fullride-7x10.ts';

const ownerUid = 'synthetic-owner';
const date = '2026-10-10T00:00:00.000Z';
const placement = kilterFullride7x10Definition.placements[0].id;
const library = { drafts: [{ ...draftContent({ name: 'Synthetic masterpiece', angle: 45,
  metadata: { grade: '6A', description: 'Keep this text' },
  assignments: [{ placementId: placement, appearance: { kind: 'role', role: 'start' } }],
  effectGroups: [{ model: 'spatial', id: 'synthetic-snake', recipeVersion: 1,
    recipe: { kind: 'snake', direction: 'forward', bodyLength: 7 }, seed: 11,
    palette: [28, 24], periodMs: 120000, intensity: 0.7, footprint: 7,
    target: { scope: 'selected', include: [placement], exclude: [] } }] }),
  schemaVersion: 4, id: FIRST_DRAFT_ID, revision: 3, createdAt: date, updatedAt: date, trashedAt: date }],
playlists: [{ schemaVersion: 1, id: '33333333-3333-4333-8333-333333333333', revision: 2,
  name: 'Ordered synthetic playlist', notes: '', createdAt: date, updatedAt: date,
  entries: [{ kind: 'local', id: FIRST_DRAFT_ID }, { kind: 'provider', id: {
    provider: 'kilter', sourceId: 'synthetic-catalog-climb', layoutRevision: 'kilter-fullride-7x10-v1',
  } }] }] };
const payload = Buffer.from(encodeLibraryBackup(library, new Date(date)));
const different = Buffer.from(encodeLibraryBackup(library, new Date('2026-10-10T01:00:00.000Z')));

async function harness(t) {
  const poolObjects = new Map();
  const counts = { read: 0, list: 0, create: 0 };
  const makeStore = pool => {
    const objects = new Map();
    poolObjects.set(pool.id, objects);
    return {
      objects,
      async list() { counts.list++; return [...objects.values()].map(value => value.snapshot); },
      async read(slot) { counts.read++; return objects.get(slot) ?? null; },
      async create(slot, bytes, sha256, details) {
        counts.create++;
        // Simulate network interleaving, then enforce the store port's atomic create.
        await setImmediate();
        if (objects.has(slot)) throw Object.assign(new Error('precondition'), { code: 412 });
        objects.set(slot, { bytes: Buffer.from(bytes), snapshot: {
          slot, bytes: bytes.length, sha256, generation: String(objects.size + 1), createdAt: date,
          ...(details ? { exportedAt: details.exportedAt, counts: details.counts } : {}),
        } });
      },
    };
  };
  const store = makeStore({ id: 'proof' });
  const stores = Object.fromEntries(APPLICATION_POOLS.map(pool => [pool.id, makeStore(pool)]));
  const verifyToken = async token => {
    if (token === 'unavailable') throw new Error('Provider unavailable');
    if (!['owner', 'other'].includes(token)) throw Object.assign(new Error('Never expose this'), { code: 'auth/id-token-expired' });
    return { uid: token === 'owner' ? ownerUid : 'synthetic-other' };
  };
  const server = createServer(createVaultHandler({ ownerUid, verifyToken, store, stores }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) => fetch(`${url}${path}`, {
    ...options, headers: { Authorization: 'Bearer owner', ...options.headers },
  });
  const put = (slot, bytes = payload, headers = {}) => request(`/snapshots/${slot}`, {
    method: 'PUT', body: bytes, headers: { 'Content-Type': 'application/json', 'X-Content-SHA256': digest(bytes), ...headers },
  });
  const putTo = (scope, slot, bytes = payload, headers = {}) => request(`/${scope}/snapshots/${slot}`, {
    method: 'PUT', body: bytes, headers: { 'Content-Type': 'application/json', 'X-Content-SHA256': digest(bytes), ...headers },
  });
  return { request, put, putTo, objects: store.objects, poolObjects, store, stores, counts };
}

test('independent requests discover and recover exact graded, trashed, effect and playlist bytes', async t => {
  const h = await harness(t);
  const created = await h.put('00');
  assert.equal(created.status, 201);
  assert.equal((await created.json()).verified, true);
  const listing = await (await h.request('/snapshots')).json();
  assert.equal(listing.snapshots.length, 1);
  assert.equal(listing.snapshots[0].sha256, digest(payload));
  assert.equal(listing.capacity.slots, 32);
  const recovered = await h.request('/snapshots/00');
  assert.equal(recovered.headers.get('cache-control'), 'no-store');
  assert.equal(recovered.headers.get('x-content-sha256'), digest(payload));
  assert.deepEqual(Buffer.from(await recovered.arrayBuffer()), payload);
  assert.equal(JSON.stringify(listing).includes(ownerUid), false);
  assert.equal((await h.request('/snapshots/01')).status, 404);
});

test('competing distinct proof snapshots have one winner and never replace retained bytes', async t => {
  const h = await harness(t);
  const responses = await Promise.all([h.put('00'), h.put('00', different)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
  const winner = [payload, different][responses.findIndex(r => r.status === 201)];
  assert.deepEqual(h.objects.get('00').bytes, winner);
  const loser = winner === payload ? different : payload;
  assert.equal((await h.put('00', loser)).status, 409);
  assert.deepEqual(h.objects.get('00').bytes, winner);
});

test('competing identical uploads and a retry after a lost response produce one retained object', async t => {
  const h = await harness(t);
  const responses = await Promise.all([h.put('00'), h.put('00')]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 201]);
  assert.equal(h.objects.size, 1);
  const create = h.store.create;
  h.store.create = async (...args) => { await create(...args); throw Object.assign(new Error('Lost response'), { code: 'ECONNRESET' }); };
  assert.equal((await h.put('01')).status, 503);
  const calls = h.counts.create;
  assert.equal((await h.put('01')).status, 200);
  assert.equal(h.counts.create, calls, 'Retry must verify the existing object without another write');
  assert.deepEqual(h.objects.get('01').bytes, payload);
});

test('IAM conflict recovers only an existing matching object; denied creation without one fails', async t => {
  const h = await harness(t);
  const create = h.store.create;
  h.store.create = async (...args) => { await create(...args); throw Object.assign(new Error('IAM conflict'), { code: 403 }); };
  assert.equal((await h.put('00')).status, 200);
  h.store.create = async () => { throw Object.assign(new Error('IAM denied'), { code: 403 }); };
  assert.equal((await h.put('01')).status, 503);
  assert.equal(h.objects.size, 1);
});

test('corrupt or missing readback never acknowledges protection', async t => {
  const h = await harness(t);
  const create = h.store.create;
  h.store.create = async (...args) => {
    await create(...args);
    h.objects.get(args[0]).bytes = different;
  };
  assert.equal((await h.put('00')).status, 503);
  assert.equal((await h.request('/snapshots/00')).status, 503);
  h.store.create = async () => {};
  assert.equal((await h.put('01')).status, 503);
});

test('anonymous, other account and invalid tokens cannot access any storage operation', async t => {
  const h = await harness(t);
  for (const [authorization, expected] of [['', 401], ['Bearer expired', 401], ['Bearer other', 403], ['Bearer unavailable', 503]]) {
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const response = await h.request('/snapshots/00', { method, headers: { Authorization: authorization } });
      assert.equal(response.status, expected);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal((await response.text()).includes('Never expose this'), false);
    }
  }
  assert.deepEqual(h.counts, { read: 0, list: 0, create: 0 });
});

test('malformed backup, hash, UTF-8 and oversized uploads leave no stored object', async t => {
  const h = await harness(t);
  for (const bytes of [Buffer.from('{}'), Buffer.from('not json'), Buffer.from([0xff]), Buffer.alloc(0)]) {
    assert.equal((await h.put('00', bytes)).status, 400);
  }
  assert.equal((await h.put('00', payload, { 'X-Content-SHA256': '0'.repeat(64) })).status, 400);
  assert.equal((await h.put('00', payload, { 'X-Content-SHA256': 'invalid' })).status, 400);
  assert.equal((await h.put('00', payload, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await h.put('00', payload, { 'Content-Encoding': 'gzip' })).status, 415);
  assert.equal((await h.put('00', Buffer.alloc(MAX_BYTES + 1))).status, 413);
  assert.equal(h.objects.size, 0);
  assert.deepEqual(h.counts, { read: 0, list: 0, create: 0 });
});

test('size boundary and finite capacity stop new uploads without pruning previous copies', async t => {
  const h = await harness(t);
  const boundary = Buffer.concat([payload, Buffer.alloc(MAX_BYTES - payload.length, ' ')]);
  assert.equal((await h.put('00', boundary)).status, 201);
  for (let slot = 1; slot < 32; slot++) assert.equal((await h.put(String(slot).padStart(2, '0'))).status, 201);
  assert.equal((await h.put('32')).status, 404);
  assert.equal((await h.put('00')).status, 409);
  assert.equal(h.objects.size, 32);
  assert.deepEqual(h.objects.get('00').bytes, boundary);
});

test('no alternate routes, URL credentials, deletes or metadata updates', async t => {
  const h = await harness(t);
  await h.put('00');
  for (const path of ['/snapshots/000', '/snapshots/00/extra', '/snapshots/00?token=owner', '/owners/other/snapshots/00', '/snapshots/%30%30']) {
    assert.equal((await h.request(path)).status, 404);
  }
  for (const method of ['DELETE', 'PATCH', 'POST', 'OPTIONS']) {
    assert.equal((await h.request('/snapshots/00', { method })).status, 405);
  }
  assert.deepEqual(h.objects.get('00').bytes, payload);
});

test('application pool derives canonical history metadata and stays separate from proof and acceptance pools', async t => {
  const h = await harness(t);
  const uploaded = await h.putTo('library-v1', '00000');
  assert.equal(uploaded.status, 201);
  const receipt = await uploaded.json();
  assert.deepEqual(receipt.snapshot.counts, { climbs: 1, finished: 0, drafts: 0, trash: 1, playlists: 1 });
  assert.equal(receipt.snapshot.exportedAt, date);
  const listing = await (await h.request('/library-v1/snapshots')).json();
  assert.equal(listing.capacity.slots, 512);
  assert.equal(listing.snapshots[0].slot, '00000');
  assert.equal((await h.request('/snapshots')).status, 200);
  assert.equal((await h.request('/acceptance-v1/r001/snapshots')).status, 200);
  assert.equal((await h.request('/library-v1/snapshots/00000')).headers.get('x-content-sha256'), digest(payload));
  assert.equal((await h.request('/acceptance-v1/r001/snapshots/00000')).status, 404);
  assert.notEqual(h.poolObjects.get('library-v1'), h.poolObjects.get('acceptance-v1/r001'));
});

test('five-digit application slots admit exactly 512 immutable snapshots', async t => {
  const h = await harness(t);
  for (let index = 0; index < 512; index++) {
    const slot = String(index).padStart(5, '0');
    assert.equal((await h.putTo('library-v1', slot)).status, 201, `slot ${slot}`);
  }
  assert.equal((await h.putTo('library-v1', '00512')).status, 404);
  assert.equal((await h.putTo('library-v1', '0000')).status, 404);
  assert.equal(h.poolObjects.get('library-v1').size, 512);
  const listing = await (await h.request('/library-v1/snapshots')).json();
  assert.equal(listing.snapshots.length, 512);
  assert.equal(listing.snapshots.at(-1).slot, '00511');
  assert.equal((await h.putTo('library-v1', '00000')).status, 200);
});

test('acceptance run pools share the bounded algorithm while remaining disjoint', async t => {
  const h = await harness(t);
  for (const pool of ACCEPTANCE_POOLS) {
    assert.equal((await h.putTo(pool.id, '00511')).status, 201);
    assert.equal((await h.request(`/${pool.id}/snapshots/00511`)).status, 200);
    assert.equal((await h.request(`/${pool.id}/snapshots/0511`)).status, 404);
  }
  assert.equal((await h.request('/acceptance-v1/r005/snapshots')).status, 404);
  assert.equal((await h.request('/acceptance-v1/r001/snapshots/00511')).status, 200);
  assert.equal((await h.request('/acceptance-v1/r002/snapshots/00511')).status, 200);
  assert.equal(h.poolObjects.get('acceptance-v1/r001').size, 1);
  assert.equal(h.poolObjects.get('acceptance-v1/r002').size, 1);
});

test('malformed application receipt metadata is rejected before listing or download', async t => {
  const h = await harness(t);
  assert.equal((await h.putTo('library-v1', '00000')).status, 201);
  const stored = h.poolObjects.get('library-v1').get('00000');
  stored.snapshot.counts = { ...stored.snapshot.counts, drafts: '' };
  assert.equal((await h.request('/library-v1/snapshots')).status, 503);
  assert.equal((await h.request('/library-v1/snapshots/00000')).status, 503);
  stored.snapshot.counts = { ...stored.snapshot.counts, drafts: 0 };
  stored.snapshot.exportedAt = '2026-02-31T00:00:00.000Z';
  assert.equal((await h.request('/library-v1/snapshots')).status, 503);
});
