// Local synthetic acceptance only. No cloud calls or credentials.
import assert from 'node:assert/strict';
import { fork, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createVaultHandler } from './gateway/handler.mjs';
import { LIBRARY_POOL } from './gateway/contract.mjs';
import { createStructuredLibrary } from '../ios/fixtures/structured-library.mjs';
import { canonicalSnapshot, decodeLibraryBackup } from '../../web/src/library-backup/codec.ts';

const digest = value => createHash('sha256').update(value).digest('hex');
if (process.argv[2] === '--server') {
  // Separate process so client fixture/HTTP buffers do not inflate server memory.
  const objects = new Map();
  const store = {
    async list() { return [...objects.values()].map(value => value.snapshot); },
    async read(slot) { return objects.get(slot) ?? null; },
    async create(slot, bytes, sha256, details) {
      if (objects.has(slot)) throw Object.assign(new Error('Exists'), { code: 412 });
      objects.set(slot, { bytes: Buffer.from(bytes), snapshot: {
        slot, bytes: bytes.length, sha256, generation: '1', createdAt: new Date().toISOString(), ...details,
      } });
    },
  };
  const server = createServer(createVaultHandler({ ownerUid: 'synthetic-owner',
    verifyToken: async () => ({ uid: 'synthetic-owner' }), store,
    stores: { [LIBRARY_POOL.id]: store },
  }));
  server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
  process.on('message', message => {
    if (message === 'usage') process.send({ memory: process.memoryUsage(), resource: process.resourceUsage() });
    if (message === 'close') {
      server.closeAllConnections();
      server.close(() => process.exit(0));
    }
  });
} else {
  assert(process.argv.length === 3, 'Usage: node --experimental-strip-types verify-structured.mjs NEW_PRIVATE_OUTPUT_DIRECTORY');
  const output = resolve(process.argv[2]);
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  if (output === root || output.startsWith(`${root}/`)) execFileSync('git', ['check-ignore', '--quiet', `${output}/fixture.json`]);
  await mkdir(output, { mode: 0o700 }); // Do not overwrite prior evidence.
  const bytes = Buffer.from(createStructuredLibrary());
  const decoded = decodeLibraryBackup(bytes.toString('utf8'));
  const fixture = { synthetic: true, bytes: bytes.length, sha256: digest(bytes),
    canonicalSha256: digest(canonicalSnapshot(decoded)), climbs: decoded.drafts.length,
    playlists: decoded.playlists.length, references: decoded.playlists.reduce((n, p) => n + p.entries.length, 0) };
  await writeFile(`${output}/fixture.json`, bytes, { mode: 0o600 });
  const child = fork(fileURLToPath(import.meta.url), ['--server'], {
    execArgv: ['--experimental-strip-types', '--max-old-space-size=384'], stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  let diagnostics = '';
  child.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk.toString()).slice(-4000); });
  const message = () => new Promise((accept, reject) => {
    const cleanup = () => { child.off('message', received); child.off('exit', exited); clearTimeout(timer); };
    const received = value => { cleanup(); accept(value); };
    const exited = code => { cleanup(); reject(new Error(`Local server exited ${code}: ${diagnostics}`)); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Local server response timed out')); }, 60000);
    child.once('message', received); child.once('exit', exited);
  });
  const started = performance.now();
  try {
    const { port } = await message();
    const url = `http://127.0.0.1:${port}${LIBRARY_POOL.route}/00000`;
    const headers = { Authorization: 'Bearer synthetic-token', 'Content-Type': 'application/json', 'X-Content-SHA256': fixture.sha256 };
    const created = await fetch(url, { method: 'PUT', headers, body: bytes, signal: AbortSignal.timeout(60000) });
    assert.equal(created.status, 201);
    const initialReceipt = await created.json();
    assert.equal(initialReceipt.verified, true);
    const recovered = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
    assert.equal(recovered.status, 200);
    assert.equal(digest(Buffer.from(await recovered.arrayBuffer())), fixture.sha256);
    const retry = await fetch(url, { method: 'PUT', headers, body: bytes, signal: AbortSignal.timeout(60000) });
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), initialReceipt);
    assert.deepEqual(initialReceipt.snapshot.counts, { climbs: 10000, finished: 5000, drafts: 2500, trash: 2500, playlists: 1000 });
    const response = message(); child.send('usage');
    const usage = await response;
    const evidence = { ...fixture, elapsedMs: Math.round(performance.now() - started), nodeHeapLimitMiB: 384, ...usage,
      limitation: 'Local fake store; excludes GCS SDK/auth/runtime overhead. Not a production 512 MiB memory bound.' };
    await writeFile(`${output}/summary.json`, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
    console.log(JSON.stringify(evidence));
  } finally {
    if (child.connected) child.send('close'); else child.kill();
  }
}
