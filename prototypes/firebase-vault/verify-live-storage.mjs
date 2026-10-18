// Live synthetic proof. Temporarily impersonates only the dedicated runtime identity.
// Never reads native tokens, persists cloud tokens, or operates on a physical device.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { PROJECT_ID, BUCKET, SERVICE_ACCOUNT } from './gateway/settings.mjs';
import { createGcsStore } from './gateway/gcs-store.mjs';
import { validateBackup, digest } from './gateway/contract.mjs';
const require = createRequire(import.meta.url), gatewayRequire = createRequire(new URL('./gateway/package.json', import.meta.url));
const auth = require('firebase-tools/lib/auth.js');
const { Storage } = gatewayRequire('@google-cloud/storage');
const { OAuth2Client } = gatewayRequire('google-auth-library');
const { initializeApp, deleteApp } = gatewayRequire('firebase-admin/app');
const { getAuth } = gatewayRequire('firebase-admin/auth');
const [sessionFile, fixtureFile, configFile, output, project, raceSlot = '01'] = process.argv.slice(2);
assert(sessionFile && fixtureFile && configFile && output && project === PROJECT_ID,
  'Usage: node --experimental-strip-types verify-live-storage.mjs PRIVATE_NATIVE_SESSION SYNTHETIC_BACKUP PRIVATE_GOOGLE_CONFIG NEW_PRIVATE_EVIDENCE_DIR cruxcontrol-auth-20261010 [UNUSED_RACE_SLOT]');
assert(/^([0-2][0-9]|3[01])$/.test(raceSlot) && !['00', '02'].includes(raceSlot));
assert(process.env.XDG_CONFIG_HOME, 'Isolated Firebase CLI configuration required');
const destination = resolve(output);
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
if (destination.startsWith(`${root}/`)) execFileSync('git', ['check-ignore', '--quiet', `${destination}/summary.json`]);
await mkdir(destination, { mode: 0o700 });
const session = JSON.parse(await readFile(sessionFile, 'utf8'));
assert(session.ok && session.method === 'verifySession' && session.value.signedIn);
const operator = auth.getGlobalDefaultAccount();
assert.equal(operator.user.email, session.value.email, 'Operator must be the admitted account');
const bytes = await readFile(fixtureFile); validateBackup(bytes);
const alternate = Buffer.from(JSON.stringify({ ...JSON.parse(bytes), exportedAt: '2026-10-11T00:00:00.000Z' }));
validateBackup(alternate); assert(!bytes.equals(alternate));
const config = JSON.parse(await readFile(configFile, 'utf8'));
assert.equal(config.project_info.project_id, PROJECT_ID);
const apiKey = config.client[0].api_key[0].current_key;
const credential = await auth.getAccessToken(operator.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
const adminHeaders = { Authorization: `Bearer ${credential.access_token}`, 'Content-Type': 'application/json' };
async function api(url, body, attempt = 0) {
  assert(['iam.googleapis.com', 'iamcredentials.googleapis.com', 'serviceusage.googleapis.com'].includes(new URL(url).hostname));
  const response = await fetch(url, { method: body ? 'POST' : 'GET',
    headers: { ...adminHeaders, ...(new URL(url).hostname === 'iamcredentials.googleapis.com'
      ? { 'x-goog-user-project': PROJECT_ID } : {}) },
    redirect: 'error', signal: AbortSignal.timeout(30000), body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  // A credential request has no data mutation; allow bounded IAM propagation.
  if (response.status === 403 && url.endsWith(':generateAccessToken') && attempt < 36) {
    await new Promise(resolve => setTimeout(resolve, 5000)); return api(url, body, attempt + 1);
  }
  if (!response.ok) await writeFile(`${destination}/control-error.json`, JSON.stringify({ status: response.status,
    host: new URL(url).hostname, error: data.error }, null, 2), { mode: 0o600 });
  assert(response.ok, `Proof control API failed (${response.status}, ${new URL(url).hostname})`);
  return data;
}
const accountUrl = `https://iam.googleapis.com/v1/projects/${PROJECT_ID}/serviceAccounts/${SERVICE_ACCOUNT}`;
const member = `user:${operator.user.email}`, role = 'roles/iam.serviceAccountTokenCreator';
let added = false, firebase, otherUser, otherCreated = false;
const evidence = { at: new Date().toISOString(), projectId: PROJECT_ID };
try {
  const serviceUrl = `https://serviceusage.googleapis.com/v1/projects/839726977905/services/iamcredentials.googleapis.com`;
  if ((await api(serviceUrl)).state !== 'ENABLED') {
    let operation = await api(`${serviceUrl}:enable`, {});
    for (let count = 0; !operation.done && count < 60; count++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      operation = await api(`https://serviceusage.googleapis.com/v1/${operation.name}`);
    }
    assert(operation.done && !operation.error);
  }
  const policy = await api(`${accountUrl}:getIamPolicy`, {});
  policy.bindings ??= [];
  let binding = policy.bindings.find(b => b.role === role && !b.condition);
  if (!binding?.members.includes(member)) {
    if (!binding) { binding = { role, members: [] }; policy.bindings.push(binding); }
    binding.members.push(member);
    added = true;
    await api(`${accountUrl}:setIamPolicy`, { policy });
  }
  const delegated = await api(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${SERVICE_ACCOUNT}:generateAccessToken`,
    { scope: ['https://www.googleapis.com/auth/devstorage.read_write'], lifetime: '900s' });
  const client = new OAuth2Client(); client.setCredentials({ access_token: delegated.accessToken });
  const bucket = new Storage({ projectId: PROJECT_ID, authClient: client }).bucket(BUCKET);
  const store = createGcsStore(bucket, session.value.uid);
  const prefix = `owners/${session.value.uid}/snapshots/`;
  const permissions = ['storage.objects.create', 'storage.objects.get', 'storage.objects.list', 'storage.objects.delete', 'storage.objects.update'];
  const query = new URLSearchParams(); permissions.forEach(p => query.append('permissions', p));
  const permissionResponse = await fetch(`https://storage.googleapis.com/storage/v1/b/${BUCKET}/iam/testPermissions?${query}`,
    { headers: { Authorization: `Bearer ${delegated.accessToken}` } });
  assert.equal(permissionResponse.status, 200);
  const allowed = (await permissionResponse.json()).permissions ?? [];
  assert.deepEqual(allowed.sort(), permissions.slice(0, 3).sort()); evidence.runtimePermissions = allowed;
  assert.equal(await store.read(raceSlot), null, 'Use an unused synthetic proof slot; never reset it');
  const race = await Promise.allSettled([store.create(raceSlot, bytes, digest(bytes)), store.create(raceSlot, alternate, digest(alternate))]);
  assert.equal(race.filter(r => r.status === 'fulfilled').length, 1);
  const rejected = race.find(r => r.status === 'rejected'); assert([403, 412].includes(rejected.reason.code));
  const winner = await store.read(raceSlot); assert(winner.bytes.equals(bytes) || winner.bytes.equals(alternate));
  await assert.rejects(bucket.file(`${prefix}${raceSlot}`).save(Buffer.from('forbidden overwrite'), { resumable: false, validation: false }), e => e.code === 403);
  await assert.rejects(bucket.file(`${prefix}${raceSlot}`).delete(), e => e.code === 403);
  const retained = await store.read(raceSlot); assert.deepEqual(retained, winner);
  const original = await store.read('00'); assert(original.bytes.equals(bytes));
  evidence.atomicCreate = { slot: raceSlot, winners: 1, loserStatus: rejected.reason.code, overwriteDenied: true, deleteDenied: true,
    retainedSha256: winner.snapshot.sha256, originalUnchanged: true };

  // A synthetic Firebase user supplies a genuine, differently owned ID token.
  // This does not replace the separately tested native Google sign-in flow.
  firebase = initializeApp({ projectId: PROJECT_ID, serviceAccountId: SERVICE_ACCOUNT,
    credential: { getAccessToken: async () => ({ access_token: credential.access_token, expires_in: 3600 }) } }, 'vault-live-isolation-proof');
  const firebaseAuth = getAuth(firebase);
  otherUser = `crux-vault-synthetic-${Date.now()}`;
  const customToken = await firebaseAuth.createCustomToken(otherUser);
  const signedIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) });
  assert.equal(signedIn.status, 200);
  otherCreated = true;
  const other = await signedIn.json();
  assert.equal((await firebaseAuth.verifyIdToken(other.idToken, true)).uid, otherUser);
  const endpoint = `https://us-central1-${PROJECT_ID}.cloudfunctions.net/privateVaultProof/snapshots`;
  evidence.otherAccount = {};
  for (const method of ['GET', 'PUT']) {
    const response = await fetch(endpoint + (method === 'PUT' ? '/02' : ''), { method,
      headers: { Authorization: `Bearer ${other.idToken}`, 'Content-Type': 'application/json', 'X-Content-SHA256': digest(bytes) },
      body: method === 'PUT' ? bytes : undefined });
    assert.equal(response.status, 403); assert.equal((await response.json()).error, 'ACCOUNT_NOT_ADMITTED');
    evidence.otherAccount[method] = 403;
  }
  assert.equal(await store.read('02'), null);
  for (const headers of [{}, { Authorization: 'Bearer invalid' }]) {
    const response = await fetch(endpoint, { headers }); assert.equal(response.status, 401);
  }
  evidence.anonymousAndInvalidDenied = true;
} finally {
  try { if (otherCreated && firebase) await getAuth(firebase).deleteUser(otherUser); }
  finally {
    if (firebase) await deleteApp(firebase);
    if (added) {
      const policy = await api(`${accountUrl}:getIamPolicy`, {});
      for (const b of policy.bindings ?? []) if (b.role === role && !b.condition) b.members = b.members.filter(m => m !== member);
      policy.bindings = policy.bindings.filter(b => b.members.length);
      await api(`${accountUrl}:setIamPolicy`, { policy });
      const after = await api(`${accountUrl}:getIamPolicy`, {});
      assert(!after.bindings?.some(b => b.role === role && !b.condition && b.members.includes(member)));
    }
    evidence.temporaryOperatorGrantRemoved = added;
    await writeFile(`${destination}/summary.json`, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
  }
}
console.log(JSON.stringify(evidence));
