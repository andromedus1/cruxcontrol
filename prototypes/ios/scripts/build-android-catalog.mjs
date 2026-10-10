import { execFileSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { CATALOG_COMPRESSED_LIMIT } from '../../../web/src/data/catalog/manifest.ts';
import { boundedFile, prepareAndroidCatalog, readCatalogManifest, validateCatalogBytes } from './prepare-android-catalog.mjs';
import { checkAndroidCatalog, checkAndroidCatalogApk } from './check-android-catalog.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifestFile = resolve(root, '../../web/public/catalog/manifest.json');
const dist = resolve(root, '../../web/dist-ios-prototype');
const assets = join(root, 'android/app/src/main/assets/public');
const args = process.argv.slice(2);
let sourceFile;
let compileOnly = false;
let syncOnly = false;
let versionCode;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--catalog' && args[i + 1]) sourceFile = resolve(args[++i]);
  else if (args[i] === '--version-code' && /^[1-9]\d*$/.test(args[i + 1] ?? '')) versionCode = args[++i];
  else if (args[i] === '--compile-only') compileOnly = true;
  else if (args[i] === '--sync-only') syncOnly = true;
  else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
}
if (compileOnly && sourceFile) throw new Error('Choose either an explicit private catalog or compile-only mode');
if (!compileOnly && !sourceFile) throw new Error('Private APK requires --catalog /absolute/path/kilter-7x10.v1.db.gz (kept outside Git)');
if (sourceFile) {
  // Reject before a web build or any package mutation. The committed manifest is
  // authoritative, and is never rewritten to accommodate another input.
  const manifest = await readCatalogManifest(manifestFile);
  validateCatalogBytes(await boundedFile(sourceFile, CATALOG_COMPRESSED_LIMIT), manifest);
} else console.warn('COMPILE-ONLY Android package: catalog omitted explicitly; this APK is not a dogfood build.');
const run = (file, args, cwd = root) => execFileSync(file, args, { cwd, stdio: 'inherit' });
run('npm', ['run', 'build']);
if (sourceFile) await prepareAndroidCatalog({ sourceFile, manifestFile, destinationDirectory: join(dist, 'catalog') });
else await rm(join(dist, 'catalog'), { recursive: true, force: true });
run(join(root, 'node_modules/.bin/cap'), ['sync', 'android']);
if (sourceFile) console.log('Synced catalog verified', await checkAndroidCatalog(assets, manifestFile));
if (!syncOnly) {
  run('./gradlew', ['assembleDebug', ...(versionCode ? [`-PprototypeVersionCode=${versionCode}`] : [])], join(root, 'android'));
  if (sourceFile) console.log('Final private APK verified', await checkAndroidCatalogApk(join(root, 'android/app/build/outputs/apk/debug/app-debug.apk'), manifestFile));
}
