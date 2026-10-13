// Public app registration only. Never accepts CLI credentials or service keys.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { androidVaultConfig } from './android-vault-config.mjs';

const [sourceFile, scope] = process.argv.slice(2);
assert(process.argv.length === 4 && sourceFile && (scope === 'library-v1' || /^acceptance-v1\/r00[1-4]$/.test(scope)),
  'Usage: node prepare-android-vault.mjs GOOGLE_SERVICES_JSON library-v1|acceptance-v1/r00N (N=1..4)');
const config = androidVaultConfig(JSON.parse(await readFile(sourceFile, 'utf8')), scope);
const variant = scope === 'library-v1' ? 'main' : 'signedProof';
const directory = new URL(`../android/app/src/${variant}/assets/`, import.meta.url);
await mkdir(directory, { recursive: true });
const target = new URL('vault-config.json', directory);
await writeFile(target, JSON.stringify(config) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ prepared: true, scope, path: fileURLToPath(target), credentialsIncluded: false }));
