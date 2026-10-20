// Pure description and readback checks for the private catalog resources. Shared by
// provision-catalog.mjs (operator-run) and its offline tests; no cloud access here.
import { BUCKET, PROJECT_ID, SERVICE_ACCOUNT as READER } from './catalog-gateway/settings.mjs';

export const PROJECT_NUMBER = '839726977905';
export const PUBLISHER = `crux-catalog-publisher@${PROJECT_ID}.iam.gserviceaccount.com`;
export const AUTH_READER_ROLE = `projects/${PROJECT_ID}/roles/cruxVaultProofAuthReader`;
export const POOL_ID = 'github-actions';
export const PROVIDER_ID = 'cruxcontrol-catalog';
export const REPOSITORY = 'andromedus1/cruxcontrol';
export const REPOSITORY_ID = '1212058430';
export const WORKFLOW = '.github/workflows/catalog-publish.yml';
export const PROVIDER_NAME =
  `projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}`;
export const PUBLISHER_PRINCIPAL = `principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}`
  + `/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository_id/${REPOSITORY_ID}`;
export const VAULT_RESOURCES = Object.freeze({
  bucket: `${PROJECT_ID}-vault-proof`,
  serviceAccount: `crux-vault-proof@${PROJECT_ID}.iam.gserviceaccount.com`,
});

export const BUCKET_SPEC = Object.freeze({
  name: BUCKET, location: 'US-CENTRAL1', storageClass: 'STANDARD',
  iamConfiguration: { uniformBucketLevelAccess: { enabled: true }, publicAccessPrevention: 'enforced' },
  softDeletePolicy: { retentionDurationSeconds: '604800' },
  lifecycle: { rule: [] }, labels: { app: 'cruxcontrol', purpose: 'kilter-catalog' },
});

export const ATTRIBUTE_CONDITION = [
  `assertion.repository_id == '${REPOSITORY_ID}'`,
  `assertion.repository == '${REPOSITORY}'`,
  "assertion.ref == 'refs/heads/main'",
  `assertion.workflow_ref.startsWith('${REPOSITORY}/${WORKFLOW}@')`,
].join(' && ');

export const PROVIDER_SPEC = Object.freeze({
  displayName: 'CruxControl catalog publish',
  attributeMapping: {
    'google.subject': 'assertion.sub',
    'attribute.repository': 'assertion.repository',
    'attribute.repository_id': 'assertion.repository_id',
  },
  attributeCondition: ATTRIBUTE_CONDITION,
  oidc: { issuerUri: 'https://token.actions.githubusercontent.com' },
});

export const BUCKET_ROLES = Object.freeze({
  [`serviceAccount:${READER}`]: ['roles/storage.objectViewer'],
  [`serviceAccount:${PUBLISHER}`]: ['roles/storage.objectCreator', 'roles/storage.objectViewer'],
});

const PUBLIC = new Set(['allUsers', 'allAuthenticatedUsers']);
const rolesOf = (policy, member) => (policy?.bindings ?? [])
  .filter(binding => binding.members?.includes(member)).map(binding => binding.role).sort();

/** Each function returns a list of problems; an empty list means the readback is acceptable. */
export function checkBucket(bucket) {
  const problems = [];
  if (!bucket) return ['catalog bucket is missing'];
  if (bucket.name !== BUCKET) problems.push('unexpected bucket name');
  if (bucket.projectNumber !== PROJECT_NUMBER) problems.push('bucket belongs to another project');
  if (bucket.location?.toUpperCase() !== BUCKET_SPEC.location) problems.push('bucket location');
  if (bucket.storageClass !== 'STANDARD') problems.push('storage class');
  if (bucket.iamConfiguration?.uniformBucketLevelAccess?.enabled !== true) problems.push('uniform access disabled');
  if (bucket.iamConfiguration?.publicAccessPrevention !== 'enforced') problems.push('public access prevention not enforced');
  if (bucket.softDeletePolicy?.retentionDurationSeconds !== '604800') problems.push('soft delete retention');
  if (bucket.lifecycle?.rule?.length) problems.push('lifecycle deletion rules present');
  if (bucket.retentionPolicy?.isLocked) problems.push('unexpected locked retention policy');
  return problems;
}

export function checkBucketIam(policy) {
  const problems = [];
  for (const binding of policy?.bindings ?? []) {
    if (binding.members?.some(member => PUBLIC.has(member))) problems.push(`public member on ${binding.role}`);
    if (binding.condition) problems.push(`unexpected conditional binding on ${binding.role}`);
  }
  for (const [member, roles] of Object.entries(BUCKET_ROLES)) {
    const actual = rolesOf(policy, member);
    if (JSON.stringify(actual) !== JSON.stringify([...roles].sort())) {
      problems.push(`${member} has bucket roles ${actual.join(',') || 'none'}`);
    }
  }
  return problems;
}

export function checkProjectIam(policy) {
  const problems = [];
  if ((policy?.bindings ?? []).some(binding => binding.members?.some(member => PUBLIC.has(member)))) {
    problems.push('public project access');
  }
  const reader = rolesOf(policy, `serviceAccount:${READER}`);
  if (JSON.stringify(reader) !== JSON.stringify([AUTH_READER_ROLE])) problems.push(`reader project roles ${reader.join(',')}`);
  const publisher = rolesOf(policy, `serviceAccount:${PUBLISHER}`);
  if (publisher.length) problems.push(`publisher has project roles ${publisher.join(',')}`);
  for (const member of [`serviceAccount:${READER}`, `serviceAccount:${PUBLISHER}`]) {
    if ((policy?.bindings ?? []).some(binding => binding.members?.includes(member) && binding.condition)) {
      problems.push(`conditional project binding for ${member}`);
    }
  }
  return problems;
}

export function checkProvider(provider) {
  if (!provider) return ['workload identity provider is missing'];
  const problems = [];
  if (provider.state !== 'ACTIVE' || provider.disabled) problems.push('provider not active');
  if (provider.attributeCondition !== ATTRIBUTE_CONDITION) problems.push('attribute condition differs');
  if (provider.oidc?.issuerUri !== PROVIDER_SPEC.oidc.issuerUri) problems.push('issuer differs');
  if (provider.oidc?.allowedAudiences?.length) problems.push('unexpected custom audiences');
  if (JSON.stringify(provider.attributeMapping ?? {}) !== JSON.stringify(PROVIDER_SPEC.attributeMapping)) {
    problems.push('attribute mapping differs');
  }
  return problems;
}

export function checkPublisherAccountIam(policy) {
  const bindings = policy?.bindings ?? [];
  const expected = [{ role: 'roles/iam.workloadIdentityUser', members: [PUBLISHER_PRINCIPAL] }];
  const actual = bindings.map(binding => ({ role: binding.role, members: [...binding.members].sort(),
    ...(binding.condition ? { condition: binding.condition } : {}) }));
  return JSON.stringify(actual) === JSON.stringify(expected)
    ? [] : ['publisher account may be impersonated by more than the catalog workflow principal'];
}

/** Catalog resources must never touch the vault. */
export function checkVaultUntouched(vaultBucketIam, vaultAccountRoles) {
  const problems = [];
  for (const member of [`serviceAccount:${READER}`, `serviceAccount:${PUBLISHER}`, PUBLISHER_PRINCIPAL]) {
    if (rolesOf(vaultBucketIam, member).length) problems.push(`${member} has access to the vault bucket`);
  }
  if (vaultAccountRoles?.some(role => role !== AUTH_READER_ROLE)) problems.push('vault runtime roles changed');
  return problems;
}
