// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createServer, preview } from 'vite';
import { describe, expect, it } from 'vitest';

describe('catalog gzip static serving', () => {
  for (const mode of ['development', 'preview'] as const) {
    it(`${mode} preserves gzip artifact bytes for the bounded catalog installer`, async () => {
      const root = await mkdtemp(join(tmpdir(), 'crux-catalog-serving-'));
      const directory = join(root, mode === 'preview' ? 'dist' : 'public');
      const bytes = gzipSync(Buffer.from('SQLite fixture bytes for HTTP serving'));
      await mkdir(join(directory, 'catalog'), { recursive: true });
      await writeFile(join(directory, 'catalog', 'fixture.db.gz'), bytes);
      await writeFile(join(directory, 'ordinary.txt'), 'ordinary content');
      const options = { configFile: resolve('vite.config.ts'), root, logLevel: 'silent' as const };
      const server = mode === 'preview'
        ? await preview({ ...options, preview: { host: '127.0.0.1', port: 0, open: false } })
        : await createServer({ ...options, server: { host: '127.0.0.1', port: 0, open: false } });
      try {
        if ('listen' in server) await server.listen();
        const address = server.httpServer!.address();
        if (!address || typeof address === 'string') throw new Error('Missing test server port');
        const base = `http://127.0.0.1:${address.port}`;
        const response = await fetch(`${base}/catalog/fixture.db.gz`);
        expect(response.status).toBe(200);
        expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
        expect(response.headers.get('content-type')).toBe('application/gzip');
        const ordinary = await fetch(`${base}/ordinary.txt`);
        expect(await ordinary.text()).toBe('ordinary content');
        expect(ordinary.headers.get('content-encoding')).not.toBe('identity');
      } finally {
        await server.close();
        await rm(root, { recursive: true, force: true });
      }
    });
  }
});
