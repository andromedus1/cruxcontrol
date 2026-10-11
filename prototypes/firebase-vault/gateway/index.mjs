import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Storage } from '@google-cloud/storage';
import { defineString } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { createVaultHandler } from './handler.mjs';
import { createGcsStore } from './gcs-store.mjs';
import { PROJECT_ID, BUCKET, FUNCTION_OPTIONS } from './settings.mjs';

const owner = defineString('VAULT_OWNER_UID');
let handler;

export const privateVaultProof = onRequest(FUNCTION_OPTIONS, async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  if (!handler) {
    try {
      // This entry point may only verify genuine Firebase tokens and use live GCS.
      if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.STORAGE_EMULATOR_HOST
        || process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw new Error('Emulated provider');
      const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
      if (app.options.projectId !== PROJECT_ID) throw new Error('Wrong project');
      const auth = getAuth(app);
      const storage = new Storage({ projectId: PROJECT_ID });
      handler = createVaultHandler({ ownerUid: owner.value(),
        verifyToken: async token => {
          try { return await auth.verifyIdToken(token, true); }
          catch (error) {
            const known = ['auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired',
              'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found',
              'auth/insufficient-permission', 'auth/internal-error'];
            // Bounded diagnostics only: never log exception text, tokens or claims.
            console.warn(JSON.stringify({ event: 'vault-auth-rejected',
              code: known.includes(error?.code) ? error.code : 'auth/provider-error',
              signatureRemoved: token.endsWith('.SIGNATURE_REMOVED_BY_GOOGLE') }));
            throw error;
          }
        },
        store: createGcsStore(storage.bucket(BUCKET), owner.value()),
      });
    } catch {
      response.status(503).json({ error: 'CONFIGURATION_INVALID' });
      return;
    }
  }
  await handler(request, response);
});
