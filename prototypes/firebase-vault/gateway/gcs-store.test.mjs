import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { CRC32C, Storage } from '@google-cloud/storage';
import { createGcsStore } from './gcs-store.mjs';
import { digest, FORMAT } from './contract.mjs';

// This protocol fixture verifies SDK requests. It cannot certify Google's live
// concurrency or IAM behavior; those remain separate deployment acceptance gates.
test('SDK sends atomic create precondition, pins reads, bounds discovery and issues no destructive request', async t => {
  const records = new Map();
  const requests = [];
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      requests.push({ method: req.method, path: url.pathname, query: url.searchParams });
      const json = (status, value) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(value));
      };
      if (req.method === 'POST') {
        assert.equal(url.searchParams.get('ifGenerationMatch'), '0');
        assert.equal(url.searchParams.get('uploadType'), 'multipart');
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const boundary = /boundary="?([^";]+)/.exec(req.headers['content-type'])[1];
        const parts = Buffer.concat(chunks).toString().split(`--${boundary}`);
        const metadata = JSON.parse(parts[1].split('\r\n\r\n')[1].trim());
        const bytes = Buffer.from(parts[2].split('\r\n\r\n')[1].replace(/\r\n$/, ''));
        const name = url.searchParams.get('name');
        if (records.has(name)) { json(412, { error: { code: 412, message: 'precondition' } }); return; }
        assert.deepEqual(Object.keys(metadata.metadata).sort(), ['format', 'sha256']);
        assert.equal(metadata.metadata.format, FORMAT);
        const crc = new CRC32C(); crc.update(bytes);
        assert.equal(metadata.crc32c, crc.toString(), 'GCS must receive a server-validated write checksum');
        const value = { ...metadata, name, size: String(bytes.length), generation: '123',
          timeCreated: '2026-10-10T00:00:00.000Z', crc32c: crc.toString() };
        records.set(name, { bytes, metadata: value });
        // A bad response checksum must not trigger the SDK's automatic DELETE.
        // Subsequent independent readback still validates the actual retained bytes.
        json(200, { ...value, crc32c: 'AAAAAA==' });
        return;
      }
      if (req.method === 'GET' && url.pathname.endsWith('/o')) {
        assert.equal(url.searchParams.get('prefix'), 'owners/synthetic-owner/snapshots/');
        assert.equal(url.searchParams.get('maxResults'), '33');
        json(200, { items: [...records.values()].map(value => value.metadata) });
        return;
      }
      if (req.method === 'GET') {
        const name = decodeURIComponent(url.pathname.split('/o/')[1] ?? '');
        const record = records.get(name);
        if (!record) { json(404, { error: { code: 404, message: 'missing' } }); return; }
        if (url.searchParams.get('alt') === 'media') {
          assert.equal(url.searchParams.get('generation'), '123');
          res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': record.bytes.length,
            'x-goog-hash': `crc32c=${record.metadata.crc32c}` });
          res.end(record.bytes);
        } else json(200, record.metadata);
        return;
      }
      json(405, { error: { code: 405 } });
    } catch (error) { res.writeHead(500); res.end('Fixture assertion failed'); t.assert.fail(error.message); }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const storage = new Storage({ projectId: 'demo-vault', apiEndpoint: `http://127.0.0.1:${server.address().port}`,
    useAuthWithCustomEndpoint: false, retryOptions: { autoRetry: false } });
  const store = createGcsStore(storage.bucket('synthetic-proof'), 'synthetic-owner');
  const bytes = Buffer.from('{"synthetic":"bytes"}');
  const outcomes = await Promise.allSettled([store.create('00', bytes, digest(bytes)), store.create('00', bytes, digest(bytes))]);
  assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(outcome => outcome.status === 'rejected').reason.code, 412);
  const recovered = await store.read('00');
  assert.deepEqual(recovered.bytes, bytes);
  assert.equal(recovered.snapshot.sha256, digest(bytes));
  assert.equal((await store.list()).length, 1);
  assert.equal(await store.read('01'), null);
  assert(requests.every(request => ['POST', 'GET'].includes(request.method)));
});
