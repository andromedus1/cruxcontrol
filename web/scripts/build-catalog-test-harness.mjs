import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const webRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixtureRoot = join(webRoot, 'e2e/fixtures/catalog-bootstrap');
const outputRoot = await mkdtemp(join(tmpdir(), 'crux-catalog-bootstrap-build-'));

await build({
  configFile: false,
  root: fixtureRoot,
  publicDir: false,
  mode: 'catalog-bootstrap-test',
  logLevel: 'warn',
  worker: { format: 'es' },
  build: {
    outDir: outputRoot,
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: { input: join(fixtureRoot, 'index.html') },
  },
});

if (process.argv.includes('--serve')) {
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.wasm': 'application/wasm',
    '.svg': 'image/svg+xml',
  };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      const requested = resolve(outputRoot, `.${pathname}`);
      if (requested !== outputRoot && !requested.startsWith(`${outputRoot}${sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const file = pathname === '/' ? join(outputRoot, 'index.html') : requested;
      const content = await readFile(file);
      response.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' });
      response.end(content);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
  server.listen(4175, '127.0.0.1');
  const cleanup = () => server.close(() => rm(outputRoot, { recursive: true, force: true }));
  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);
} else {
  await rm(outputRoot, { recursive: true, force: true });
}
