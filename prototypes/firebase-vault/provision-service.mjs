// Explicit operator provisioning for the bounded proof; never links billing or deletes data.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { PROJECT_ID, BUCKET, SERVICE_ACCOUNT } from './gateway/settings.mjs';

const require = createRequire(import.meta.url);
const auth = require('firebase-tools/lib/auth.js');
const [directory, project, mode = 'inspect'] = process.argv.slice(2);
assert(directory && project === PROJECT_ID && ['inspect', 'provision'].includes(mode),
  'Usage: node provision-service.mjs PRIVATE_PREPARED_DIRECTORY cruxcontrol-auth-20261010 [inspect|provision]');
assert(process.env.XDG_CONFIG_HOME, 'Use the isolated Firebase CLI configuration');
const destination = resolve(directory);
const plan = JSON.parse(await readFile(`${destination}/resource-plan.json`, 'utf8'));
assert.equal(plan.projectId, PROJECT_ID);
assert.equal(plan.bucket.name, BUCKET);
assert.equal(plan.runtimeIdentity, SERVICE_ACCOUNT);
for (const [file, expected] of [['functions/lib/index.mjs', plan.artifactSha256],
  ['functions/package-lock.json', plan.dependencyLockSha256]]) {
  assert.equal(createHash('sha256').update(await readFile(`${destination}/${file}`)).digest('hex'), expected);
}
const account = auth.getProjectDefaultAccount(destination);
assert(account?.tokens?.refresh_token, 'Firebase CLI sign-in is required');
const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
const permitted = new Set(['cloudbilling.googleapis.com', 'cloudresourcemanager.googleapis.com',
  'serviceusage.googleapis.com', 'billingbudgets.googleapis.com', 'iam.googleapis.com', 'storage.googleapis.com']);
const evidence = { at: new Date().toISOString(), projectId: PROJECT_ID, mode };
async function api(url, method = 'GET', body, missing = false) {
  assert(permitted.has(new URL(url).hostname));
  const response = await fetch(url, { method, redirect: 'error', signal: AbortSignal.timeout(60000),
    headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json',
      ...(new URL(url).hostname === 'billingbudgets.googleapis.com' ? { 'x-goog-user-project': PROJECT_ID } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  if (missing && response.status === 404) return null;
  const data = await response.json();
  if (!response.ok) {
    // Keep provider details private; tokens are never included in evidence.
    await writeFile(`${destination}/provision-error.json`, JSON.stringify({ method,
      host: new URL(url).hostname, status: response.status, error: data.error }, null, 2), { mode: 0o600 });
    throw new Error(`Cloud API ${response.status} from ${new URL(url).hostname}; see private evidence`);
  }
  return data;
}
async function enable(service) {
  const url = `https://serviceusage.googleapis.com/v1/projects/${number}/services/${service}`;
  const current = await api(url);
  if (current.state === 'ENABLED') return;
  assert.equal(mode, 'provision', `Enable ${service} through explicit provisioning first`);
  let operation = await api(`${url}:enable`, 'POST', {});
  for (let attempt = 0; !operation.done && attempt < 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    operation = await api(`https://serviceusage.googleapis.com/v1/${operation.name}`);
  }
  assert(operation.done && !operation.error, `Enabling ${service} did not complete`);
  console.log(JSON.stringify({ enabled: service }));
}
async function policy(url, role, member, projectPolicy = false) {
  const current = await api(url + (projectPolicy ? ':getIamPolicy' : '/iam'), projectPolicy ? 'POST' : 'GET', projectPolicy ? {} : undefined);
  current.bindings ??= [];
  let binding = current.bindings.find(b => b.role === role && !b.condition);
  if (!binding?.members.includes(member)) {
    assert.equal(mode, 'provision', 'Expected IAM binding is absent');
    if (!binding) { binding = { role, members: [] }; current.bindings.push(binding); }
    binding.members.push(member);
    await api(url + (projectPolicy ? ':setIamPolicy' : '/iam'), projectPolicy ? 'POST' : 'PUT',
      projectPolicy ? { policy: current } : current);
  }
}

evidence.billing = await api(`https://cloudbilling.googleapis.com/v1/projects/${PROJECT_ID}/billingInfo`);
assert.equal(evidence.billing.billingEnabled, true, 'Owner must enable billing first');
const resource = await api(`https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT_ID}`);
const number = resource.projectNumber;
assert.equal(number, '839726977905');
evidence.projectParent = resource.parent ?? null;
await enable('billingbudgets.googleapis.com');
const budgetsUrl = `https://billingbudgets.googleapis.com/v1/${evidence.billing.billingAccountName}/budgets`;
const budgets = await api(`${budgetsUrl}?pageSize=1000`);
assert(!budgets.nextPageToken, 'Review paginated billing budgets explicitly');
let budget = (budgets.budgets ?? []).find(b => !b.spendCap && b.budgetFilter?.projects?.length === 1
  && [`projects/${number}`, `projects/${PROJECT_ID}`].includes(b.budgetFilter.projects[0])
  && !b.budgetFilter.services?.length && !b.budgetFilter.customPeriod
  && (!b.budgetFilter.calendarPeriod || b.budgetFilter.calendarPeriod === 'MONTH'));
if (mode === 'provision') {
  const thresholdRules = [0.2, 0.5, 1].map(thresholdPercent => ({ thresholdPercent, spendBasis: 'CURRENT_SPEND' }));
  if (budget) {
    assert.equal(budget.amount?.specifiedAmount?.currencyCode, 'USD');
    assert.equal(Number(budget.amount.specifiedAmount.units), 5, 'Do not replace an unexpected owner budget');
    assert(!budget.amount.specifiedAmount.nanos);
    for (const rule of budget.thresholdRules ?? []) {
      if (!thresholdRules.some(r => r.thresholdPercent === rule.thresholdPercent && r.spendBasis === rule.spendBasis)) thresholdRules.push(rule);
    }
    budget = await api(`https://billingbudgets.googleapis.com/v1/${budget.name}?updateMask=thresholdRules,notificationsRule`, 'PATCH',
      { name: budget.name, etag: budget.etag, thresholdRules,
        notificationsRule: { ...budget.notificationsRule, disableDefaultIamRecipients: false, enableProjectLevelRecipients: true } });
  } else {
    budget = await api(budgetsUrl, 'POST', { displayName: 'CruxControl proof monthly alerts',
      budgetFilter: { projects: [`projects/${number}`], calendarPeriod: 'MONTH', creditTypesTreatment: 'INCLUDE_ALL_CREDITS' },
      amount: { specifiedAmount: { currencyCode: 'USD', units: '5' } }, thresholdRules,
      notificationsRule: { disableDefaultIamRecipients: false, enableProjectLevelRecipients: true } });
  }
}
evidence.budget = budget ?? null;
console.log(JSON.stringify({ billingEnabled: true, budgetPresent: !!budget,
  budgetUsd: budget?.amount?.specifiedAmount?.units, thresholds: budget?.thresholdRules?.map(r => r.thresholdPercent) }));
if (mode === 'provision') {
  await enable('iam.googleapis.com');
  await enable('storage.googleapis.com');
  const accountsUrl = `https://iam.googleapis.com/v1/projects/${PROJECT_ID}/serviceAccounts`;
  if (!await api(`${accountsUrl}/${SERVICE_ACCOUNT}`, 'GET', undefined, true)) {
    await api(accountsUrl, 'POST', { accountId: 'crux-vault-proof',
      serviceAccount: { displayName: 'CruxControl immutable vault proof' } });
  }
  const rolesUrl = `https://iam.googleapis.com/v1/projects/${PROJECT_ID}/roles`;
  const roleName = `projects/${PROJECT_ID}/roles/cruxVaultProofAuthReader`;
  const existingRole = await api(`${rolesUrl}/cruxVaultProofAuthReader`, 'GET', undefined, true);
  if (existingRole) assert.deepEqual(existingRole.includedPermissions, ['firebaseauth.users.get']);
  else await api(rolesUrl, 'POST', { roleId: 'cruxVaultProofAuthReader', role: {
    title: 'CruxControl proof account revocation check', includedPermissions: ['firebaseauth.users.get'], stage: 'GA' } });
  const member = `serviceAccount:${SERVICE_ACCOUNT}`;
  await policy(`https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT_ID}`, roleName, member, true);
  const bucketUrl = `https://storage.googleapis.com/storage/v1/b/${BUCKET}`;
  let bucket = await api(bucketUrl, 'GET', undefined, true);
  if (!bucket) bucket = await api(`https://storage.googleapis.com/storage/v1/b?project=${PROJECT_ID}`, 'POST', plan.bucket);
  assert.equal(bucket.projectNumber, number);
  assert.equal(bucket.location.toLowerCase(), 'us-central1');
  assert.equal(bucket.storageClass, 'STANDARD');
  assert.equal(bucket.iamConfiguration.uniformBucketLevelAccess.enabled, true);
  assert.equal(bucket.iamConfiguration.publicAccessPrevention, 'enforced');
  assert.equal(bucket.softDeletePolicy.retentionDurationSeconds, '604800');
  assert(!bucket.lifecycle?.rule?.length, 'Snapshot lifecycle deletion is prohibited');
  for (const role of ['roles/storage.objectCreator', 'roles/storage.objectViewer']) await policy(bucketUrl, role, member);
  evidence.bucket = await api(bucketUrl);
  evidence.bucketIam = await api(`${bucketUrl}/iam`);
  evidence.projectIam = await api(`https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT_ID}:getIamPolicy`, 'POST', {});
  for (const p of [evidence.projectIam, evidence.bucketIam]) {
    assert(!p.bindings?.some(b => b.members?.some(m => ['allUsers', 'allAuthenticatedUsers'].includes(m))), 'Unexpected public data/project access');
  }
  assert.deepEqual(evidence.projectIam.bindings.filter(b => b.members.includes(member)).map(b => b.role), [roleName]);
  assert.deepEqual(evidence.bucketIam.bindings.filter(b => b.members.includes(member)).map(b => b.role).sort(),
    ['roles/storage.objectCreator', 'roles/storage.objectViewer'].sort());
}
await writeFile(`${destination}/${mode}-evidence.json`, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ preparedInfrastructure: mode === 'provision', functionDeployed: false,
  snapshotUploaded: false, projectId: PROJECT_ID }));
