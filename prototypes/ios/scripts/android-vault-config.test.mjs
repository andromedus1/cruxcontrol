import assert from 'node:assert/strict';
import { test } from 'node:test';
import { androidVaultConfig, validateAndroidVaultConfig, VAULT_PROJECT, VAULT_APP_ID, ANDROID_PACKAGE } from './android-vault-config.mjs';
const source = { project_info: { project_id: VAULT_PROJECT }, client: [{
  client_info: { mobilesdk_app_id: VAULT_APP_ID, android_client_info: { package_name: ANDROID_PACKAGE } },
  api_key: [{ current_key: `AIza${'a'.repeat(35)}` }],
  oauth_client: [{ client_type: 3, client_id: '839726977905-synthetic.apps.googleusercontent.com' }],
}] };

test('only the selected public app registration can configure the production vault', () => {
  const config = androidVaultConfig(source, 'library-v1');
  assert.equal(validateAndroidVaultConfig(config).scope, 'library-v1');
  for (const [key, value] of [['projectId', 'other-project'], ['appId', 'other-app'], ['webClientId', 'other.apps.googleusercontent.com'], ['apiKey', 'private-key']]) {
    assert.throws(() => validateAndroidVaultConfig({ ...config, [key]: value }));
  }
  assert.throws(() => validateAndroidVaultConfig({ ...config, endpoint: 'https://example.com' }));
  assert.throws(() => androidVaultConfig({ type: 'service_account', private_key: 'synthetic' }, 'library-v1'));
  assert.throws(() => androidVaultConfig({ ...source, client: [...source.client, ...source.client] }, 'library-v1'));
});

test('acceptance pools are finite and cannot pass ordinary build validation', () => {
  for (const scope of ['acceptance-v1/r001', 'acceptance-v1/r002', 'acceptance-v1/r003', 'acceptance-v1/r004']) {
    const config = androidVaultConfig(source, scope);
    assert.equal(validateAndroidVaultConfig(config, true).scope, scope);
    assert.throws(() => validateAndroidVaultConfig(config));
  }
  for (const scope of ['acceptance-v1/r000', 'acceptance-v1/r005', 'acceptance-v1', 'acceptance-v1/r001/../r002', 'proof']) {
    assert.throws(() => androidVaultConfig(source, scope));
  }
});
