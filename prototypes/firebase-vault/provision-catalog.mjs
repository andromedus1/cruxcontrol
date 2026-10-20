// Operator-run provisioning for the private Kilter catalog. Never touches vault resources,
// never deletes, and never runs from CI. Modes:
//   inspect (default)  read-only: report every problem against the catalog plan
//   provision          create/reconcile bucket, identities, IAM and workload identity
//   bootstrap DIR      upload the legacy v1 artifact + manifest (create-only) as version 1
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { BUCKET, PROJECT_ID, SERVICE_ACCOUNT as READER } from './catalog-gateway/settings.mjs';
import { artifactObject, latestVersion, manifestObject } from './catalog-gateway/contract.mjs';
import {
  AUTH_READER_ROLE, BUCKET_ROLES, BUCKET_SPEC, POOL_ID, PROJECT_NUMBER, PROVIDER_ID, PROVIDER_SPEC, PUBLISHER,
  PUBLISHER_PRINCIPAL, VAULT_RESOURCES, checkBucket, checkBucketIam, checkProjectIam, checkProvider,
  checkPublisherAccountIam, checkVaultUntouched,
} from './catalog-plan.mjs';

const require = createRequire(import.meta.url);
const auth = require('firebase-tools/lib/auth.js');
const [directory, project, mode = 'inspect', bootstrapDir] = process.argv.slice(2);
assert(directory && project === PROJECT_ID && ['inspect', 'provision', 'bootstrap'].includes(mode)
  && (mode !== 'bootstrap' || bootstrapDir),
'Usage: node provision-catalog.mjs PRIVATE_EVIDENCE_DIR cruxcontrol-auth-20261010 [inspect|provision|bootstrap LEGACY_CATALOG_DIR]');
assert(process.env.XDG_CONFIG_HOME, 'Use the isolated Firebase CLI configuration');
const evidenceDir = resolve(directory);
await mkdir(evidenceDir, { recursive: true, mode: 0o700 });
const account = auth.getProjectDefaultAccount(evidenceDir);
assert(account?.tokens?.refresh_token, 'Firebase CLI sign-in is required');
const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
const permitted = new Set(['cloudbilling.googleapis.com', 'cloudresourcemanager.googleapis.com',
  'serviceusage.googleapis.com', 'iam.googleapis.com', 'storage.googleapis.com']);
const evidence = { at: new Date().toISOString(), projectId: PROJECT_ID, mode, problems: [] };
const writes = mode === 'provision';

async function api(url, method = 'GET', body, { missing = false, raw = null, attempt = 0 } = {}) {
  assert(permitted.has(new URL(url).hostname));
  assert(method === 'GET' || writes || mode === 'bootstrap' || (method === 'POST' && /:getIamPolicy$/.test(url)),
    `Refusing ${method} in ${mode} mode`);
  const response = await fetch(url, { method, redirect: 'error', signal: AbortSignal.timeout(60000),
    headers: { Authorization: `Bearer ${token.access_token}`,
      'Content-Type': raw ? 'application/octet-stream' : 'application/json' },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
  if (missing && response.status === 404) return null;
  const data = await response.json();
  if (!response.ok) {
    // Retry only reads during service-enablement propagation; never blind write retries.
    if (method === 'GET' && attempt < 12 && response.status === 403
      && data.error?.details?.some(detail => detail.reason === 'SERVICE_DISABLED')) {
      await new Promise(done => setTimeout(done, 5000));
      return api(url, method, body, { missing, raw, attempt: attempt + 1 });
    }
    await writeFile(`${evidenceDir}/catalog-${mode}-error.json`, JSON.stringify({ method,
      host: new URL(url).hostname, status: response.status, error: data.error }, null, 2), { mode: 0o600 });
    throw new Error(`Cloud API ${response.status} from ${new URL(url).hostname}; see private evidence`);
  }
  return data;
}

async function waitFor(read, label) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const value = await read();
    if (value) return value;
    await new Promise(done => setTimeout(done, 2000));
  }
  throw new Error(`${label} did not appear`);
}

async function ensureBinding(getUrl, setUrl, role, member, wrap) {
  const policy = await api(getUrl, getUrl.endsWith(':getIamPolicy') ? 'POST' : 'GET',
    getUrl.endsWith(':getIamPolicy') ? {} : undefined);
  policy.bindings ??= [];
  let binding = policy.bindings.find(b => b.role === role && !b.condition);
  if (binding?.members.includes(member)) return;
  if (!writes) { evidence.problems.push(`missing ${role} for ${member}`); return; }
  if (!binding) { binding = { role, members: [] }; policy.bindings.push(binding); }
  binding.members.push(member);
  await api(setUrl, setUrl.endsWith(':setIamPolicy') ? 'POST' : 'PUT', wrap ? { policy } : policy);
}

const billing = await api(`https://cloudbilling.googleapis.com/v1/projects/${PROJECT_ID}/billingInfo`);
assert.equal(billing.billingEnabled, true, 'Owner must enable billing first');
const resource = await api(`https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT_ID}`);
assert.equal(resource.projectNumber, PROJECT_NUMBER);
const projectUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT_ID}`;
const bucketUrl = `https://storage.googleapis.com/storage/v1/b/${BUCKET}`;
const accountsUrl = `https://iam.googleapis.com/v1/projects/${PROJECT_ID}/serviceAccounts`;
const poolUrl = `https://iam.googleapis.com/v1/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools`;

if (mode !== 'bootstrap') {
  for (const service of ['iam.googleapis.com', 'iamcredentials.googleapis.com', 'sts.googleapis.com', 'storage.googleapis.com']) {
    const url = `https://serviceusage.googleapis.com/v1/projects/${PROJECT_NUMBER}/services/${service}`;
    if ((await api(url)).state === 'ENABLED') continue;
    if (!writes) { evidence.problems.push(`service ${service} disabled`); continue; }
    let operation = await api(`${url}:enable`, 'POST', {});
    for (let attempt = 0; !operation.done && attempt < 60; attempt++) {
      await new Promise(done => setTimeout(done, 2000));
      operation = await api(`https://serviceusage.googleapis.com/v1/${operation.name}`);
    }
    assert(operation.done && !operation.error, `Enabling ${service} did not complete`);
  }

  const role = await api(`https://iam.googleapis.com/v1/${AUTH_READER_ROLE}`, 'GET', undefined, { missing: true });
  assert.deepEqual(role?.includedPermissions, ['firebaseauth.users.get'], 'Expected the existing auth-reader role');

  for (const [email, id, displayName] of [[READER, 'crux-catalog-reader', 'CruxControl catalog reader'],
    [PUBLISHER, 'crux-catalog-publisher', 'CruxControl catalog publisher (CI)']]) {
    if (await api(`${accountsUrl}/${email}`, 'GET', undefined, { missing: true })) continue;
    if (!writes) { evidence.problems.push(`service account ${email} missing`); continue; }
    await api(accountsUrl, 'POST', { accountId: id, serviceAccount: { displayName } });
    await waitFor(() => api(`${accountsUrl}/${email}`, 'GET', undefined, { missing: true }), email);
  }

  let bucket = await api(bucketUrl, 'GET', undefined, { missing: true });
  if (!bucket && writes) bucket = await api(`https://storage.googleapis.com/storage/v1/b?project=${PROJECT_ID}`, 'POST', BUCKET_SPEC);
  evidence.problems.push(...checkBucket(bucket));

  if (bucket) {
    for (const [member, roles] of Object.entries(BUCKET_ROLES)) {
      for (const bucketRole of roles) await ensureBinding(`${bucketUrl}/iam`, `${bucketUrl}/iam`, bucketRole, member);
    }
  }
  await ensureBinding(`${projectUrl}:getIamPolicy`, `${projectUrl}:setIamPolicy`, AUTH_READER_ROLE,
    `serviceAccount:${READER}`, true);

  if (!await api(`${poolUrl}/${POOL_ID}`, 'GET', undefined, { missing: true })) {
    if (writes) {
      await api(`${poolUrl}?workloadIdentityPoolId=${POOL_ID}`, 'POST', { displayName: 'GitHub Actions' });
      await waitFor(() => api(`${poolUrl}/${POOL_ID}`, 'GET', undefined, { missing: true }), 'identity pool');
    } else evidence.problems.push('workload identity pool missing');
  }
  const providerUrl = `${poolUrl}/${POOL_ID}/providers/${PROVIDER_ID}`;
  let provider = await api(providerUrl, 'GET', undefined, { missing: true });
  if (!provider && writes) {
    await api(`${poolUrl}/${POOL_ID}/providers?workloadIdentityPoolProviderId=${PROVIDER_ID}`, 'POST', PROVIDER_SPEC);
    provider = await waitFor(() => api(providerUrl, 'GET', undefined, { missing: true }), 'identity provider');
  }
  evidence.problems.push(...checkProvider(provider));

  const publisherUrl = `${accountsUrl}/${PUBLISHER}`;
  if (await api(publisherUrl, 'GET', undefined, { missing: true })) {
    await ensureBinding(`${publisherUrl}:getIamPolicy`, `${publisherUrl}:setIamPolicy`,
      'roles/iam.workloadIdentityUser', PUBLISHER_PRINCIPAL, true);
    evidence.publisherAccountIam = await api(`${publisherUrl}:getIamPolicy`, 'POST', {});
    evidence.problems.push(...checkPublisherAccountIam(evidence.publisherAccountIam));
  }

  if (bucket) {
    evidence.bucket = await api(bucketUrl);
    evidence.bucketIam = await api(`${bucketUrl}/iam`);
    evidence.problems.push(...checkBucketIam(evidence.bucketIam));
  }
  evidence.projectIam = await api(`${projectUrl}:getIamPolicy`, 'POST', {});
  evidence.problems.push(...checkProjectIam(evidence.projectIam));
  const vaultIam = await api(`https://storage.googleapis.com/storage/v1/b/${VAULT_RESOURCES.bucket}/iam`);
  const vaultRoles = (evidence.projectIam.bindings ?? [])
    .filter(b => b.members?.includes(`serviceAccount:${VAULT_RESOURCES.serviceAccount}`)).map(b => b.role);
  evidence.problems.push(...checkVaultUntouched(vaultIam, vaultRoles));
}

if (mode === 'bootstrap') {
  const legacyDir = resolve(bootstrapDir);
  const manifestBytes = await readFile(`${legacyDir}/manifest.json`);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  assert(manifest.schemaVersion === 2 && manifest.source === 'legacy-aurora-kilter' && manifest.version === 1
    && manifest.file === 'kilter-7x10.v1.db.gz', 'Bootstrap expects the legacy v1 manifest');
  const artifact = await readFile(`${legacyDir}/${manifest.file}`);
  assert.equal(artifact.length, manifest.bytesGzipped);
  assert.equal(createHash('sha256').update(artifact).digest('hex'), manifest.sha256);
  assert.deepEqual(checkBucket(await api(bucketUrl, 'GET', undefined, { missing: true })), [], 'Provision first');
  const listing = await api(`${bucketUrl}/o?prefix=${encodeURIComponent('kilter-7x10/')}`);
  const names = (listing.items ?? []).map(item => item.name);
  assert.equal(latestVersion(names), null, 'A catalog version is already published; bootstrap is one-time');
  const upload = async (name, bytes) => {
    const created = await api(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media`
      + `&ifGenerationMatch=0&name=${encodeURIComponent(name)}`, 'POST', undefined, { raw: bytes });
    assert.equal(created.md5Hash, createHash('md5').update(bytes).digest('base64'), `Readback mismatch for ${name}`);
    return { name, generation: created.generation, bytes: bytes.length };
  };
  // Artifact first: a version is published only once its manifest exists.
  evidence.bootstrap = [await upload(artifactObject(1), artifact), await upload(manifestObject(1), manifestBytes)];
}

await writeFile(`${evidenceDir}/catalog-${mode}-evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ mode, projectId: PROJECT_ID, problems: evidence.problems,
  bootstrapped: mode === 'bootstrap' }));
if (evidence.problems.length) process.exitCode = 1;
