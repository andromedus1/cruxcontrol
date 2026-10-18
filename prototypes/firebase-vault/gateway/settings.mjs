export const PROJECT_ID = 'cruxcontrol-auth-20261010';
export const BUCKET = `${PROJECT_ID}-vault-proof`;
export const SERVICE_ACCOUNT = `crux-vault-proof@${PROJECT_ID}.iam.gserviceaccount.com`;
export const FUNCTION_NAME = 'privateVaultProof';
export const FUNCTION_OPTIONS = Object.freeze({
  region: 'us-central1', memory: '512MiB', cpu: 1, concurrency: 1,
  minInstances: 0, maxInstances: 1, timeoutSeconds: 60, invoker: 'public',
  serviceAccount: SERVICE_ACCOUNT, cors: false,
});
