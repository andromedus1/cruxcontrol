import { ARTIFACT_FILE, artifactObject, checkManifest, latestVersion, manifestObject, validateAdmitted } from './contract.mjs';

class RequestError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const reject = (status, code) => { throw new RequestError(status, code); };
const INVALID_TOKEN = new Set(['auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired',
  'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found']);

/**
 * Read-only catalog downloads for admitted Firebase accounts.
 * store: { list(): Promise<{name, generation}[]>, read(name, generation): Promise<Buffer> }
 */
export function createCatalogHandler({ admittedUids, verifyToken, store }) {
  const admitted = validateAdmitted(admittedUids);
  return async (request, response) => {
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const json = (status, value) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(value));
    };
    try {
      const authorization = request.headers.authorization;
      if (typeof authorization !== 'string' || authorization.length > 16384
        || !/^Bearer [A-Za-z0-9._-]+$/.test(authorization)) reject(401, 'AUTH_REQUIRED');
      let identity;
      try { identity = await verifyToken(authorization.slice(7)); }
      catch (error) {
        if (INVALID_TOKEN.has(error?.code)) reject(401, 'AUTH_REQUIRED');
        reject(503, 'AUTH_UNAVAILABLE');
      }
      if (!admitted.has(identity?.uid)) reject(403, 'ACCOUNT_NOT_ADMITTED');

      // Exact routes only: no query strings, encodings or traversal.
      const url = request.url ?? '';
      const artifactRoute = /^\/catalog-v1\/artifacts\/([^/?#]+)$/.exec(url);
      if (url !== '/catalog-v1/manifest' && !artifactRoute) reject(404, 'NOT_FOUND');
      if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); reject(405, 'METHOD_NOT_ALLOWED'); }

      let objects;
      try { objects = await store.list(); } catch { reject(503, 'STORAGE_UNAVAILABLE'); }
      const generations = new Map(objects.map(object => [object.name, object.generation]));
      const latest = latestVersion(generations.keys());

      if (!artifactRoute) {
        if (latest === null) reject(404, 'NO_CATALOG');
        const name = manifestObject(latest);
        let manifest;
        try { manifest = checkManifest(await store.read(name, generations.get(name)), latest); }
        catch { reject(503, 'CATALOG_UNAVAILABLE'); }
        json(200, manifest);
        return;
      }

      const file = ARTIFACT_FILE.exec(artifactRoute[1]);
      if (!file) reject(404, 'NOT_FOUND');
      const version = Number(file[1]);
      const name = artifactObject(version);
      // Only published versions (artifact and manifest both present) are downloadable.
      if (!generations.has(name) || !generations.has(manifestObject(version))) reject(404, 'NOT_FOUND');
      let manifest;
      let bytes;
      try {
        manifest = checkManifest(await store.read(manifestObject(version), generations.get(manifestObject(version))), version);
        bytes = await store.read(name, generations.get(name));
      } catch { reject(503, 'CATALOG_UNAVAILABLE'); }
      if (bytes.length !== manifest.bytesGzipped) reject(503, 'CATALOG_UNAVAILABLE');
      response.writeHead(200, {
        'Content-Type': 'application/gzip',
        'Content-Length': String(bytes.length),
        'X-Catalog-SHA256': manifest.sha256,
      });
      response.end(bytes);
    } catch (error) {
      if (!(error instanceof RequestError)) {
        console.error(JSON.stringify({ event: 'catalog-unexpected-error' }));
        if (!response.headersSent) json(500, { error: 'INTERNAL' });
        return;
      }
      if (!response.headersSent) json(error.status, { error: error.code });
    }
  };
}
