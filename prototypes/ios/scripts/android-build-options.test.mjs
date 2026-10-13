import assert from 'node:assert/strict';
import { test } from 'node:test';
import { androidBuildOptions, requireSigningEnvironment } from './android-build-options.mjs';

test('private builds require explicit bounded monotonic-capable version, including sync', () => {
  for (const version of [undefined, '', '0', '-1', '1.5', '01', '2100000001', '999999999999999999999999']) {
    assert.throws(() => androidBuildOptions(['--catalog', '/private/catalog.gz', ...(version === undefined ? [] : ['--version-code', version])]), /version-code/);
  }
  assert.equal(androidBuildOptions(['--catalog', '/private/catalog.gz', '--version-code', '2100000000']).versionCode, '2100000000');
  assert.throws(() => androidBuildOptions(['--catalog', '/private/catalog.gz', '--sync-only']), /version-code/);
  assert.equal(androidBuildOptions(['--compile-only']).variant, 'debug');
});

test('signed release and instrumented proof are explicit mutually exclusive private recipes', () => {
  const args = ['--catalog', '/private/catalog.gz', '--version-code', '12'];
  assert.equal(androidBuildOptions([...args, '--release']).variant, 'release');
  assert.equal(androidBuildOptions([...args, '--signed-proof']).variant, 'signedProof');
  assert.throws(() => androidBuildOptions([...args, '--release', '--signed-proof']), /one signed/);
  assert.throws(() => androidBuildOptions(['--compile-only', '--release']), /private catalog/);
  assert.throws(() => androidBuildOptions([...args, '--version-code', '13']), /Repeated/);
  assert.throws(() => androidBuildOptions(['--version-code', '12']), /--catalog/);
});

test('missing credentials reject without including any credential value in the error', () => {
  const credentials = { CRUX_ANDROID_KEYSTORE: '/secret/file', CRUX_ANDROID_KEY_ALIAS: 'secret', CRUX_ANDROID_STORE_PASSWORD: 'secret' };
  assert.throws(() => requireSigningEnvironment(credentials), error => !error.message.includes('secret') && /four CRUX_ANDROID/.test(error.message));
  requireSigningEnvironment({ ...credentials, CRUX_ANDROID_KEY_PASSWORD: 'secret' });
});
