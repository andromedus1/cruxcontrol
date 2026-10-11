import { MAX_BYTES, SLOT_COUNT, digest, validateBackup, validateOwner, validateSnapshot, validateStored } from './contract.mjs';

class RequestError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const reject = (status, code) => { throw new RequestError(status, code); };

async function bodyBytes(request) {
  const length = request.headers['content-length'];
  if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) reject(413, 'BACKUP_TOO_LARGE');
  if (Buffer.isBuffer(request.rawBody)) {
    if (request.rawBody.length > MAX_BYTES) reject(413, 'BACKUP_TOO_LARGE');
    return request.rawBody;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BYTES) reject(413, 'BACKUP_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}

/** Tokens stay at the native-client/service boundary; responses never contain them. */
export function createVaultHandler({ ownerUid, verifyToken, store }) {
  validateOwner(ownerUid);
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const json = (status, value) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(value));
    };
    try {
      const authorization = request.headers.authorization;
      if (typeof authorization !== 'string' || !/^Bearer [A-Za-z0-9._-]+$/.test(authorization)
        || authorization.length > 16384) reject(401, 'AUTH_REQUIRED');
      let identity;
      try { identity = await verifyToken(authorization.slice(7)); }
      catch (error) {
        const invalid = new Set(['auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired',
          'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found']);
        if (invalid.has(error?.code)) reject(401, 'AUTH_REQUIRED');
        reject(503, 'AUTH_UNAVAILABLE');
      }
      if (identity?.uid !== ownerUid) reject(403, 'ACCOUNT_NOT_ADMITTED');
      // Exact routes avoid alternate encodings, traversal and URL-based credentials.
      const route = /^\/snapshots(?:\/([0-2][0-9]|3[01]))?$/.exec(request.url ?? '');
      if (!route) reject(404, 'NOT_FOUND');
      const slot = route[1];
      if (request.method === 'GET' && !slot) {
        const snapshots = await store.list();
        if (snapshots.length > SLOT_COUNT) throw new Error('Invalid snapshot pool');
        snapshots.forEach(validateSnapshot);
        if (new Set(snapshots.map(s => s.slot)).size !== snapshots.length) throw new Error('Duplicate slots');
        json(200, { snapshots, capacity: { slots: SLOT_COUNT, bytesPerSlot: MAX_BYTES } });
        return;
      }
      if (request.method === 'GET' && slot) {
        const stored = await store.read(slot);
        if (!stored) reject(404, 'NOT_FOUND');
        validateStored(stored, slot);
        response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': stored.bytes.length,
          'X-Content-SHA256': stored.snapshot.sha256, 'X-Snapshot-Generation': stored.snapshot.generation });
        response.end(stored.bytes);
        return;
      }
      if (request.method !== 'PUT' || !slot) reject(405, 'METHOD_NOT_ALLOWED');
      if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(request.headers['content-type'] ?? '')
        || (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity')) reject(415, 'JSON_REQUIRED');
      const sha256 = request.headers['x-content-sha256'];
      if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) reject(400, 'DIGEST_REQUIRED');
      const bytes = await bodyBytes(request);
      try { validateBackup(bytes); } catch { reject(400, 'INVALID_BACKUP'); }
      if (digest(bytes) !== sha256) reject(400, 'DIGEST_MISMATCH');

      const receipt = (stored, created) => {
        validateStored(stored, slot);
        if (!stored.bytes.equals(bytes)) reject(409, 'SNAPSHOT_EXISTS');
        json(created ? 201 : 200, { snapshot: stored.snapshot, verified: true });
      };
      const existing = await store.read(slot);
      if (existing) { receipt(existing, false); return; }
      try { await store.create(slot, bytes, sha256); }
      catch (error) {
        // GCS may deny an overwrite by IAM before evaluating its precondition.
        // Only a verified existing object can turn either error into a retry receipt.
        if (error?.code !== 412 && error?.code !== 403) throw error;
        const winner = await store.read(slot);
        if (!winner) throw error;
        receipt(winner, false);
        return;
      }
      const committed = await store.read(slot);
      if (!committed) throw new Error('Missing committed snapshot');
      receipt(committed, true);
    } catch (error) {
      if (!response.headersSent) json(error instanceof RequestError ? error.status : 503,
        { error: error instanceof RequestError ? error.code : 'STORAGE_UNAVAILABLE' });
      else response.destroy();
      // Never log provider errors, request headers, tokens or library content.
    }
  };
}
