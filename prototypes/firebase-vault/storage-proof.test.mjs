import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, getDownloadURL, getMetadata, listAll, ref, updateMetadata, uploadBytes } from 'firebase/storage';
import { storageProofRules } from './prepare-proof.mjs';

const projectId = 'demo-cruxcontrol-vault';
const owner = 'synthetic-owner';
const other = 'synthetic-other';
const prefix = `owners/${owner}/snapshots`;
const payload = new TextEncoder().encode(JSON.stringify({
  format: 'cruxcontrol-library-backup', version: 1,
  exportedAt: '2026-10-10T00:00:00.000Z', drafts: [], playlists: [],
}));
const metadata = {
  contentType: 'application/json',
  customMetadata: {
    format: 'cruxcontrol-library-backup-v1',
    sha256: createHash('sha256').update(payload).digest('hex'),
  },
};
let environment;
let owned;
let denied;
let anonymous;
const rejectsAccess = (promise) => assert.rejects(promise, { code: 'storage/unauthorized' });

before(async () => {
  assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9199',
    'Run with npm test; a loopback Storage emulator is required');
  environment = await initializeTestEnvironment({
    projectId,
    storage: { host: '127.0.0.1', port: 9199, rules: await storageProofRules(owner) },
  });
  owned = environment.authenticatedContext(owner).storage();
  denied = environment.authenticatedContext(other).storage();
  anonymous = environment.unauthenticatedContext().storage();
});
beforeEach(async () => environment.withSecurityRulesDisabled(async context => {
  // rules-unit-testing 5 clears root items only; our fixtures use nested paths.
  async function clearTree(directory) {
    const { items, prefixes } = await listAll(directory);
    await Promise.all(items.map(item => deleteObject(item)));
    for (const child of prefixes) await clearTree(child);
  }
  await clearTree(ref(context.storage()));
}));
after(async () => environment?.cleanup());

test('owner creates, independently discovers and reads exact bytes', async () => {
  await uploadBytes(ref(owned, `${prefix}/00`), payload, metadata);
  const freshOwner = environment.authenticatedContext(owner).storage();
  const listing = await listAll(ref(freshOwner, prefix));
  assert.deepEqual(listing.items.map(item => item.fullPath), [`${prefix}/00`]);
  assert.deepEqual(new Uint8Array(await getBytes(listing.items[0])), payload);
});

test('anonymous and other account cannot read, list, write or delete owner objects', async () => {
  await uploadBytes(ref(owned, `${prefix}/00`), payload, metadata);
  for (const client of [anonymous, denied]) {
    await rejectsAccess(getBytes(ref(client, `${prefix}/00`)));
    await rejectsAccess(listAll(ref(client, prefix)));
    await rejectsAccess(uploadBytes(ref(client, `${prefix}/01`), payload, metadata));
    await rejectsAccess(deleteObject(ref(client, `${prefix}/00`)));
  }
  await rejectsAccess(uploadBytes(ref(denied, `owners/${other}/snapshots/00`), payload, metadata));
  await rejectsAccess(uploadBytes(ref(owned, `owners/${other}/snapshots/00`), payload, metadata));
});

test('owner cannot overwrite, alter metadata or delete; retained bytes survive', async () => {
  const object = ref(owned, `${prefix}/00`);
  await uploadBytes(object, payload, metadata);
  await rejectsAccess(uploadBytes(object, payload, metadata));
  await rejectsAccess(updateMetadata(object, { customMetadata: { sha256: '0'.repeat(64) } }));
  await rejectsAccess(deleteObject(object));
  assert.deepEqual(new Uint8Array(await getBytes(object)), payload);
});

// Design blocker: epic-library-preservation-private-vault, "Storage proof
// findings and next acceptance gate". Emulator 15.33.0 commits both uploads.
// Keep the assertion executable; this todo is NOT immutable-backup acceptance.
test('competing creates cannot both commit to the same empty slot', {
  todo: 'epic-library-preservation-private-vault: concurrent creation is not atomic in the Storage emulator',
}, async () => {
  const object = ref(owned, `${prefix}/00`);
  const competing = [payload, new TextEncoder().encode('{"different":"snapshot"}')];
  const results = await Promise.allSettled(competing.map(bytes => uploadBytes(object, bytes, {
    ...metadata, customMetadata: {
      ...metadata.customMetadata, sha256: createHash('sha256').update(bytes).digest('hex'),
    },
  })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const loser = results.find(result => result.status === 'rejected');
  assert.equal(loser.reason.code, 'storage/unauthorized');
  const winner = results.findIndex(result => result.status === 'fulfilled');
  assert.deepEqual(new Uint8Array(await getBytes(object)), competing[winner]);
});

test('root enumeration and paths outside the finite proof pool are denied', async () => {
  await rejectsAccess(listAll(ref(owned)));
  await rejectsAccess(listAll(ref(owned, 'owners')));
  for (const path of [`${prefix}/32`, `${prefix}/000`, `${prefix}/31/extra`, 'other/00']) {
    await rejectsAccess(uploadBytes(ref(owned, path), payload, metadata));
  }
  await uploadBytes(ref(owned, `${prefix}/31`), payload, metadata);
});

test('all 32 slots fill once, and exhaustion cannot replace retained snapshots', async () => {
  for (let i = 0; i < 32; i += 1) {
    await uploadBytes(ref(owned, `${prefix}/${String(i).padStart(2, '0')}`), payload, metadata);
  }
  assert.equal((await listAll(ref(owned, prefix))).items.length, 32);
  await rejectsAccess(uploadBytes(ref(owned, `${prefix}/32`), payload, metadata));
  await rejectsAccess(uploadBytes(ref(owned, `${prefix}/00`), payload, metadata));
});

test('empty, oversized, wrong-type and malformed metadata uploads are rejected', async () => {
  const object = ref(owned, `${prefix}/00`);
  await rejectsAccess(uploadBytes(object, new Uint8Array(), metadata));
  await rejectsAccess(uploadBytes(object, new Uint8Array(25 * 1024 * 1024 + 1), metadata));
  await rejectsAccess(uploadBytes(object, payload, { ...metadata, contentType: 'text/plain' }));
  await rejectsAccess(uploadBytes(object, payload, { contentType: 'application/json' }));
  await rejectsAccess(uploadBytes(object, payload, { ...metadata, customMetadata: { ...metadata.customMetadata, sha256: 'invalid' } }));
  await rejectsAccess(uploadBytes(object, payload, { ...metadata, customMetadata: { ...metadata.customMetadata, unexpected: 'field' } }));
});

test('provider download tokens are a separate bearer capability, outside Rules metadata filtering', async () => {
  const object = ref(owned, `${prefix}/00`);
  await uploadBytes(object, payload, { ...metadata, customMetadata: {
    ...metadata.customMetadata, firebaseStorageDownloadTokens: 'synthetic-capability-token',
  } });
  await rejectsAccess(getBytes(ref(anonymous, `${prefix}/00`)));
  // This records a provider limitation; it does not assert that all anonymous
  // reads are denied. The app must not expose or persist tokenized download URLs.
  const url = new URL(await getDownloadURL(object));
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '9199');
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), payload);
});

test('25 MiB upper boundary is accepted; content validity remains the client responsibility', async () => {
  const bytes = new Uint8Array(25 * 1024 * 1024);
  const object = ref(owned, `${prefix}/00`);
  await uploadBytes(object, bytes, { ...metadata, customMetadata: {
    ...metadata.customMetadata, sha256: createHash('sha256').update(bytes).digest('hex'),
  } });
  assert.equal((await getMetadata(object)).size, bytes.length);
});

test('rule preparation rejects identifiers that could inject rule source', async () => {
  await assert.rejects(storageProofRules("owner' || true"));
  await assert.rejects(storageProofRules(''));
});
