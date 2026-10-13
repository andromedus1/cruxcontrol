import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { validateAndroidVaultBuildConfig } from './android-vault-config.mjs';

export async function checkAndroidVaultApk(apk, variant) {
  const entries = execFileSync('unzip', ['-Z1', apk], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim().split('\n');
  assert.equal(new Set(entries).size, entries.length, 'Duplicate APK entries');
  const configPath = 'assets/vault-config.json';
  const configured = entries.includes(configPath);
  const config = configured ? JSON.parse(execFileSync('unzip', ['-p', apk, configPath],
    { encoding: 'utf8', maxBuffer: 16 * 1024 })) : null;
  const scope = validateAndroidVaultBuildConfig(config, variant)?.scope ?? null;
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  assert(sdk, 'ANDROID_HOME is required for APK isolation validation');
  const versions = (await readdir(join(sdk, 'build-tools'))).filter(value => /^\d+(?:\.\d+)+$/.test(value))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  assert(versions.length, 'Android build tools are required');
  const aapt = join(sdk, 'build-tools', versions[0], 'aapt');
  const badging = execFileSync(aapt, ['dump', 'badging', apk], { encoding: 'utf8' });
  const manifest = execFileSync(aapt, ['dump', 'xmltree', apk, 'AndroidManifest.xml'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  const debuggable = badging.includes('application-debuggable');
  assert.equal(debuggable, variant !== 'release', 'Unexpected debuggable flag');
  if (variant !== 'signedProof') {
    assert(!entries.includes('assets/auth-proof-config.json'), 'Authentication proof config leaked into an ordinary build');
    assert(!manifest.includes('AuthProofActivity'), 'Authentication proof activity leaked into an ordinary build');
  }
  const descriptors = { account: 'NativeAccountPlugin;', vault: 'PrivateVaultPlugin;', proof: 'NativeAuthProofPlugin;' };
  const found = { account: false, vault: false, proof: false };
  for (const entry of entries.filter(value => /^classes\d*\.dex$/.test(value))) {
    const bytes = execFileSync('unzip', ['-p', apk, entry], { maxBuffer: 64 * 1024 * 1024 });
    for (const [key, value] of Object.entries(descriptors)) found[key] ||= bytes.includes(Buffer.from(value));
  }
  assert(found.account && found.vault, 'Native application vault plugins are absent');
  assert.equal(found.proof, variant === 'signedProof', 'Unexpected proof plugin in APK');
  return { configured, scope, debuggable, proofSurface: found.proof };
}
