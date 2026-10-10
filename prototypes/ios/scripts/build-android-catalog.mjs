import { execFileSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { CATALOG_COMPRESSED_LIMIT } from '../../../web/src/data/catalog/manifest.ts';
import { boundedFile, prepareAndroidCatalog, readCatalogManifest, validateCatalogBytes } from './prepare-android-catalog.mjs';
import { checkAndroidCatalog, checkAndroidCatalogApk } from './check-android-catalog.mjs';
import { androidBuildOptions, requireSigningEnvironment } from './android-build-options.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifestFile = resolve(root, '../../web/public/catalog/manifest.json');
const dist = resolve(root, '../../web/dist-ios-prototype');
const assets = join(root, 'android/app/src/main/assets/public');
const { sourceFile, syncOnly, versionCode, variant } = androidBuildOptions(process.argv.slice(2));
if (variant !== 'debug') requireSigningEnvironment(process.env);
if (variant === 'signedProof') console.warn('SYNTHETIC SIGNED PROOF ONLY: WebView debugging enabled. Never distribute this variant for daily authoring.');
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
  const task = `assemble${variant[0].toUpperCase()}${variant.slice(1)}`;
  run('./gradlew', [task, ...(versionCode ? [`-PprototypeVersionCode=${versionCode}`] : [])], join(root, 'android'));
  if (sourceFile) console.log('Final private APK verified', await checkAndroidCatalogApk(join(root, `android/app/build/outputs/apk/${variant}/app-${variant}.apk`), manifestFile));
}
