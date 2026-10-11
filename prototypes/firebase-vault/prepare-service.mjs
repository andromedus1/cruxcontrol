// Local packaging only: no credentials, cloud authentication, billing or deploy calls.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_ID, BUCKET, SERVICE_ACCOUNT, FUNCTION_NAME, FUNCTION_OPTIONS } from './gateway/settings.mjs';

const [evidenceFile, outputDirectory, projectId] = process.argv.slice(2);
assert(evidenceFile && outputDirectory && projectId === PROJECT_ID,
  'Usage: node prepare-service.mjs PRIVATE_NATIVE_REFRESH_EVIDENCE NEW_PRIVATE_OUTPUT_DIR cruxcontrol-auth-20261010');
const evidence = JSON.parse(await readFile(evidenceFile, 'utf8'));
assert(evidence.ok === true && evidence.method === 'verifySession' && evidence.value?.signedIn === true,
  'Expected successful native forced-refresh evidence');
assert(/^[A-Za-z0-9_-]{1,128}$/.test(evidence.value.uid ?? ''), 'Invalid evidence owner UID');
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: dirname(fileURLToPath(import.meta.url)), encoding: 'utf8',
}).trim();
const destination = resolve(outputDirectory);
if (destination === root || destination.startsWith(`${root}/`)) {
  execFileSync('git', ['check-ignore', '--quiet', `${destination}/functions/.env.${PROJECT_ID}`], { cwd: root });
}
const gateway = new URL('./gateway/', import.meta.url);
const bundle = await readFile(new URL('lib/index.mjs', gateway));
const lock = await readFile(new URL('package-lock.json', gateway));
const sourcePackage = JSON.parse(await readFile(new URL('package.json', gateway), 'utf8'));
// The already-built artifact needs no source tree or build tools at runtime.
const deploymentPackage = { ...sourcePackage, scripts: { 'gcp-build': '' } };
await mkdir(destination, { mode: 0o700 }); // Require a new destination; never overwrite an earlier candidate.
await mkdir(`${destination}/functions/lib`, { recursive: true, mode: 0o700 });
const save = (path, value) => writeFile(`${destination}/${path}`, value, { mode: 0o600, flag: 'wx' });
const json = value => `${JSON.stringify(value, null, 2)}\n`;
await save('functions/lib/index.mjs', bundle);
await save('functions/package.json', json(deploymentPackage));
await save('functions/package-lock.json', lock);
await save(`functions/.env.${PROJECT_ID}`, `VAULT_OWNER_UID=${JSON.stringify(evidence.value.uid)}\n`);
await save('firebase.json', json({ functions: [{ source: 'functions', codebase: 'private-vault-proof',
  runtime: 'nodejs22', ignore: ['node_modules', '.git', '.env*', '*-debug.log'] }] }));
await save('resource-plan.json', json({
  projectId: PROJECT_ID, billingRequired: true, deployed: false,
  artifactSha256: createHash('sha256').update(bundle).digest('hex'),
  dependencyLockSha256: createHash('sha256').update(lock).digest('hex'),
  function: { name: FUNCTION_NAME, ...FUNCTION_OPTIONS },
  bucket: { name: BUCKET, location: FUNCTION_OPTIONS.region, storageClass: 'STANDARD',
    iamConfiguration: { uniformBucketLevelAccess: { enabled: true }, publicAccessPrevention: 'enforced' },
    softDeletePolicy: { retentionDurationSeconds: '604800' },
    lifecycle: { rule: [] }, labels: { app: 'cruxcontrol', purpose: 'vault-proof' } },
  runtimeIdentity: SERVICE_ACCOUNT,
  bucketRoles: ['roles/storage.objectCreator', 'roles/storage.objectViewer'],
  projectCustomRole: { id: 'cruxVaultProofAuthReader', includedPermissions: ['firebaseauth.users.get'] },
  retention: {
    proof: { slots: 32, bytesPerSlot: 25 * 1024 * 1024 },
    library: { scope: 'library-v1', slots: 512, bytesPerSlot: 25 * 1024 * 1024 },
    acceptance: { scopes: ['acceptance-v1/r001', 'acceptance-v1/r002', 'acceptance-v1/r003', 'acceptance-v1/r004'],
      slotsPerScope: 512, bytesPerSlot: 25 * 1024 * 1024 },
    automaticPruning: false,
  },
  billingAlerts: { monthlyUsd: 5, thresholds: [0.2, 0.5, 1], hardCap: false },
  deploymentArtifacts: { retentionDays: 7, appliesTo: 'function build images only; never library snapshots' },
}));
console.log(JSON.stringify({ prepared: true, deployed: false, projectId: PROJECT_ID,
  artifactSha256: createHash('sha256').update(bundle).digest('hex') }));
