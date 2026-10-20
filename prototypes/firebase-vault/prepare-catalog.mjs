// Local packaging only: no credentials, cloud authentication, billing or deploy calls.
// Produces a private deploy directory for the privateCatalog function (its own codebase,
// so deploying it cannot touch the vault function).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUCKET, FUNCTION_NAME, FUNCTION_OPTIONS, PROJECT_ID } from './catalog-gateway/settings.mjs';
import { validateAdmitted } from './catalog-gateway/contract.mjs';

const [evidenceFile, outputDirectory, projectId] = process.argv.slice(2);
assert(evidenceFile && outputDirectory && projectId === PROJECT_ID,
  'Usage: node prepare-catalog.mjs PRIVATE_NATIVE_REFRESH_EVIDENCE NEW_PRIVATE_OUTPUT_DIR cruxcontrol-auth-20261010');
const evidence = JSON.parse(await readFile(evidenceFile, 'utf8'));
assert(evidence.ok === true && evidence.method === 'verifySession' && evidence.value?.signedIn === true,
  'Expected successful native forced-refresh evidence');
const admitted = [...validateAdmitted([evidence.value.uid])];
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: dirname(fileURLToPath(import.meta.url)), encoding: 'utf8',
}).trim();
const destination = resolve(outputDirectory);
assert(destination !== root && !destination.startsWith(`${root}/`), 'Keep the deploy package outside Git');
const gateway = new URL('./catalog-gateway/', import.meta.url);
const bundle = await readFile(new URL('lib/index.mjs', gateway));
const lock = await readFile(new URL('package-lock.json', gateway));
const sourcePackage = JSON.parse(await readFile(new URL('package.json', gateway), 'utf8'));
const deploymentPackage = { ...sourcePackage, scripts: { 'gcp-build': '' } };
await mkdir(destination, { mode: 0o700 }); // a new destination; never overwrite an earlier package
await mkdir(`${destination}/functions/lib`, { recursive: true, mode: 0o700 });
const save = (path, value) => writeFile(`${destination}/${path}`, value, { mode: 0o600, flag: 'wx' });
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
await save('functions/lib/index.mjs', bundle);
await save('functions/package.json', json(deploymentPackage));
await save('functions/package-lock.json', lock);
await save(`functions/.env.${PROJECT_ID}`, `CATALOG_ADMITTED_UIDS=${JSON.stringify(admitted.join(','))}\n`);
await save('firebase.json', json({ functions: [{ source: 'functions', codebase: 'private-catalog',
  runtime: 'nodejs22', ignore: ['node_modules', '.git', '.env*', '*-debug.log'] }] }));
await save('deploy-plan.json', json({ projectId: PROJECT_ID, deployed: false, codebase: 'private-catalog',
  function: { name: FUNCTION_NAME, ...FUNCTION_OPTIONS }, bucket: BUCKET,
  artifactSha256: sha(bundle), dependencyLockSha256: sha(lock), admittedAccounts: admitted.length }));
console.log(JSON.stringify({ prepared: true, deployed: false, projectId: PROJECT_ID, artifactSha256: sha(bundle) }));
