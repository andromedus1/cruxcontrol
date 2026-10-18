import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function storageProofRules(ownerUid) {
  assert(/^[A-Za-z0-9_-]{1,128}$/.test(ownerUid ?? ''), 'Invalid proof owner UID');
  const template = await readFile(new URL('storage-proof.rules', import.meta.url), 'utf8');
  const placeholder = "'__PROOF_OWNER_UID__'";
  assert.equal(template.split(placeholder).length, 2, 'Expected one owner placeholder');
  return template.replace(placeholder, JSON.stringify(ownerUid));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [evidenceFile, outputDirectory, projectId] = process.argv.slice(2);
  assert(evidenceFile && outputDirectory && projectId === 'cruxcontrol-auth-20261010',
    'Usage: node prepare-proof.mjs PRIVATE_NATIVE_SESSION_EVIDENCE PRIVATE_OUTPUT_DIR cruxcontrol-auth-20261010');
  const evidence = JSON.parse(await readFile(evidenceFile, 'utf8'));
  assert(evidence.ok && evidence.method === 'verifySession' && evidence.value?.signedIn,
    'Use successful native forced-refresh evidence');
  const rules = await storageProofRules(evidence.value.uid);
  const repository = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: dirname(fileURLToPath(import.meta.url)), encoding: 'utf8',
  }).trim();
  const directory = resolve(outputDirectory);
  if (directory === repository || directory.startsWith(`${repository}/`)) {
    execFileSync('git', ['check-ignore', '--quiet', `${directory}/storage.rules`], { cwd: repository });
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(`${directory}/storage.rules`, rules, { mode: 0o600, flag: 'wx' });
  await writeFile(`${directory}/firebase.json`, JSON.stringify({ storage: { rules: 'storage.rules' } }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log('Prepared private owner-scoped storage rules; nothing deployed and no billing changed.');
}
