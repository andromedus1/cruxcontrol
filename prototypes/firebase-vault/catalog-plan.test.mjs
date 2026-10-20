import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ATTRIBUTE_CONDITION, AUTH_READER_ROLE, BUCKET_SPEC, PROJECT_NUMBER, PROVIDER_SPEC, PUBLISHER, PUBLISHER_PRINCIPAL,
  VAULT_RESOURCES, checkBucket, checkBucketIam, checkProjectIam, checkProvider, checkPublisherAccountIam,
  checkVaultUntouched,
} from './catalog-plan.mjs';
import { SERVICE_ACCOUNT as READER } from './catalog-gateway/settings.mjs';

const reader = `serviceAccount:${READER}`;
const publisher = `serviceAccount:${PUBLISHER}`;
const goodBucket = { ...BUCKET_SPEC, projectNumber: PROJECT_NUMBER, location: 'us-central1' };
const goodBucketIam = { bindings: [
  { role: 'roles/storage.legacyBucketOwner', members: ['projectOwner:cruxcontrol-auth-20261010'] },
  { role: 'roles/storage.objectViewer', members: [reader, publisher] },
  { role: 'roles/storage.objectCreator', members: [publisher] },
] };

test('bucket readback', () => {
  assert.deepEqual(checkBucket(goodBucket), []);
  assert.deepEqual(checkBucket(null), ['catalog bucket is missing']);
  for (const [label, change] of [
    ['public prevention', { iamConfiguration: { ...goodBucket.iamConfiguration, publicAccessPrevention: 'inherited' } }],
    ['lifecycle', { lifecycle: { rule: [{ action: { type: 'Delete' } }] } }],
    ['project', { projectNumber: '1' }],
    ['soft delete', { softDeletePolicy: { retentionDurationSeconds: '0' } }],
  ]) assert.notDeepEqual(checkBucket({ ...goodBucket, ...change }), [], label);
});

test('bucket IAM is exact for catalog identities and never public', () => {
  assert.deepEqual(checkBucketIam(goodBucketIam), []);
  const withAdmin = { bindings: [...goodBucketIam.bindings, { role: 'roles/storage.objectAdmin', members: [publisher] }] };
  assert.match(checkBucketIam(withAdmin).join(), /publisher@.*objectAdmin/);
  const publicRead = { bindings: [...goodBucketIam.bindings, { role: 'roles/storage.objectViewer', members: ['allUsers'] }] };
  assert.match(checkBucketIam(publicRead).join(), /public member/);
  const readerWrites = { bindings: [...goodBucketIam.bindings, { role: 'roles/storage.objectCreator', members: [reader] }] };
  assert.notDeepEqual(checkBucketIam(readerWrites), []);
});

test('project IAM: reader may only check accounts; publisher has nothing', () => {
  const good = { bindings: [{ role: AUTH_READER_ROLE, members: [reader] }, { role: 'roles/owner', members: ['user:owner@example.com'] }] };
  assert.deepEqual(checkProjectIam(good), []);
  assert.notDeepEqual(checkProjectIam({ bindings: [...good.bindings, { role: 'roles/editor', members: [publisher] }] }), []);
  assert.notDeepEqual(checkProjectIam({ bindings: [] }), []);
});

test('workload identity provider is limited to the catalog workflow on main', () => {
  for (const clause of ["repository_id == '1212058430'", "ref == 'refs/heads/main'",
    "workflow_ref.startsWith('andromedus1/cruxcontrol/.github/workflows/catalog-publish.yml@')"]) {
    assert(ATTRIBUTE_CONDITION.includes(clause), clause);
  }
  const good = { ...PROVIDER_SPEC, state: 'ACTIVE', disabled: false };
  assert.deepEqual(checkProvider(good), []);
  assert.notDeepEqual(checkProvider({ ...good, attributeCondition: "assertion.repository == 'andromedus1/cruxcontrol'" }), []);
  assert.notDeepEqual(checkProvider({ ...good, oidc: { ...good.oidc, allowedAudiences: ['x'] } }), []);
});

test('publisher account impersonation is limited to the workflow principal', () => {
  assert.deepEqual(checkPublisherAccountIam({ bindings: [{ role: 'roles/iam.workloadIdentityUser', members: [PUBLISHER_PRINCIPAL] }] }), []);
  assert.notDeepEqual(checkPublisherAccountIam({ bindings: [{ role: 'roles/iam.workloadIdentityUser',
    members: [PUBLISHER_PRINCIPAL, 'user:someone@example.com'] }] }), []);
  assert.notDeepEqual(checkPublisherAccountIam({ bindings: [{ role: 'roles/iam.serviceAccountTokenCreator', members: [PUBLISHER_PRINCIPAL] }] }), []);
});

test('catalog identities never reach the vault', () => {
  const vaultIam = { bindings: [{ role: 'roles/storage.objectCreator', members: [`serviceAccount:${VAULT_RESOURCES.serviceAccount}`] }] };
  assert.deepEqual(checkVaultUntouched(vaultIam, [AUTH_READER_ROLE]), []);
  assert.notDeepEqual(checkVaultUntouched({ bindings: [...vaultIam.bindings, { role: 'roles/storage.objectViewer', members: [reader] }] }, [AUTH_READER_ROLE]), []);
  assert.notDeepEqual(checkVaultUntouched(vaultIam, [AUTH_READER_ROLE, 'roles/editor']), []);
});
