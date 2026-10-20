// Separate from the vault: its own bucket, runtime identity and function. Nothing here
// grants or reads anything in the vault bucket.
export const PROJECT_ID = 'cruxcontrol-auth-20261010';
export const BUCKET = `${PROJECT_ID}-catalog`;
export const SERVICE_ACCOUNT = `crux-catalog-reader@${PROJECT_ID}.iam.gserviceaccount.com`;
export const FUNCTION_NAME = 'privateCatalog';
export const FUNCTION_OPTIONS = Object.freeze({
  region: 'us-central1', memory: '512MiB', cpu: 1, concurrency: 1,
  minInstances: 0, maxInstances: 2, timeoutSeconds: 60, invoker: 'public',
  serviceAccount: SERVICE_ACCOUNT, cors: false,
});
