import assert from 'node:assert/strict';

export const VAULT_PROJECT = 'cruxcontrol-auth-20261010';
export const VAULT_APP_ID = '1:839726977905:android:d266860e8e4d6b67a45cd0';
export const ANDROID_PACKAGE = 'io.github.andromedus1.cruxcontrol.prototype';
const acceptance = /^acceptance-v1\/r00[1-4]$/;

export function validateAndroidVaultConfig(config, allowAcceptance = false) {
  assert(config && typeof config === 'object' && !Array.isArray(config), 'Expected public vault configuration');
  assert.deepEqual(Object.keys(config).sort(), ['apiKey', 'appId', 'projectId', 'scope', 'webClientId'], 'Unexpected vault configuration fields');
  assert.equal(config.projectId, VAULT_PROJECT, 'Wrong Firebase project');
  assert.equal(config.appId, VAULT_APP_ID, 'Wrong Android app registration');
  assert(typeof config.apiKey === 'string' && /^AIza[0-9A-Za-z_-]{35}$/.test(config.apiKey), 'Invalid public Firebase API key');
  assert(typeof config.webClientId === 'string' && /^839726977905-[a-zA-Z0-9]+\.apps\.googleusercontent\.com$/.test(config.webClientId), 'Wrong Google web client project');
  assert(config.scope === 'library-v1' || (allowAcceptance && acceptance.test(config.scope)), 'This build cannot select an acceptance namespace');
  return config;
}

export function androidVaultConfig(source, scope) {
  assert.equal(source.project_info?.project_id, VAULT_PROJECT, 'Wrong Firebase project');
  const clients = source.client?.filter(entry => entry.client_info?.android_client_info?.package_name === ANDROID_PACKAGE);
  assert.equal(clients?.length, 1, 'Expected one CruxControl Android registration');
  const client = clients[0];
  const webClients = client.oauth_client?.filter(entry => entry.client_type === 3);
  assert.equal(webClients?.length, 1, 'Expected one Google web client; complete provider setup');
  return validateAndroidVaultConfig({ projectId: VAULT_PROJECT,
    appId: client.client_info.mobilesdk_app_id, apiKey: client.api_key?.[0]?.current_key,
    webClientId: webClients[0].client_id, scope }, acceptance.test(scope));
}
