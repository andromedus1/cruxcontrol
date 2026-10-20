import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Storage } from '@google-cloud/storage';
import { defineString } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { createCatalogHandler } from './handler.mjs';
import { createGcsStore } from './gcs-store.mjs';
import { PROJECT_ID, BUCKET, FUNCTION_OPTIONS } from './settings.mjs';

const admitted = defineString('CATALOG_ADMITTED_UIDS');
let handler;

export const privateCatalog = onRequest(FUNCTION_OPTIONS, async (request, response) => {
  response.setHeader('Cache-Control', 'private, no-store');
  if (!handler) {
    try {
      // This entry point may only verify genuine Firebase tokens and read live GCS.
      if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.STORAGE_EMULATOR_HOST
        || process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw new Error('Emulated provider');
      const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
      if (app.options.projectId !== PROJECT_ID) throw new Error('Wrong project');
      const auth = getAuth(app);
      handler = createCatalogHandler({
        admittedUids: admitted.value().split(',').map(uid => uid.trim()).filter(Boolean),
        // Bounded diagnostics only: never log tokens, claims or exception text.
        verifyToken: async token => {
          try { return await auth.verifyIdToken(token, true); }
          catch (error) {
            console.warn(JSON.stringify({ event: 'catalog-auth-rejected',
              code: typeof error?.code === 'string' && error.code.startsWith('auth/') ? error.code : 'auth/provider-error' }));
            throw error;
          }
        },
        store: createGcsStore(new Storage({ projectId: PROJECT_ID }).bucket(BUCKET)),
      });
    } catch {
      response.status(503).json({ error: 'CONFIGURATION_INVALID' });
      return;
    }
  }
  await handler(request, response);
});
