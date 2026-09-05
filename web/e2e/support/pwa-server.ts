import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import type { PwaGeneration, PwaGenerationBuilds } from './pwa-builds';

const contentTypes: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function buildRoot(builds: PwaGenerationBuilds, generation: PwaGeneration): string {
  return resolve(builds[generation].outputRoot);
}

function requestPath(request: IncomingMessage): string {
  try {
    return new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  } catch {
    return '/';
  }
}

function safeRelativePath(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relativePath = decoded.replace(/^\/+/, '') || 'index.html';
  const pieces = relativePath.split('/');
  return pieces.includes('..') || relativePath.includes('\0') ? null : relativePath;
}

function isNavigation(request: IncomingMessage, pathname: string): boolean {
  const accept = request.headers.accept ?? '';
  return accept.includes('text/html') || (!extname(pathname) && pathname !== '/sw.js');
}

async function serve(
  request: IncomingMessage,
  response: ServerResponse,
  generationRoot: () => string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  const pathname = requestPath(request);
  const relativePath = safeRelativePath(pathname);
  if (relativePath === null) {
    response.writeHead(400);
    response.end();
    return;
  }
  const root = generationRoot();
  const candidate = resolve(join(root, relativePath));
  const relativeToRoot = relative(root, candidate);
  if (relativeToRoot === '..' || relativeToRoot.startsWith(`..${sep}`)) {
    response.writeHead(403);
    response.end();
    return;
  }
  let file = candidate;
  try {
    const metadata = await stat(file);
    if (!metadata.isFile()) throw new Error('not a file');
  } catch {
    if (!isNavigation(request, pathname)) {
      response.writeHead(404);
      response.end();
      return;
    }
    file = join(root, 'index.html');
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Content-Length': body.byteLength,
      'Content-Type': contentTypes[extname(file).toLowerCase()] ?? 'application/octet-stream',
      Pragma: 'no-cache',
    });
    if (request.method === 'HEAD') response.end();
    else response.end(body);
  } catch {
    response.writeHead(500);
    response.end();
  }
}

export class PwaGenerationServer {
  readonly #builds: PwaGenerationBuilds;
  #generation: PwaGeneration = 'A';
  #server: ReturnType<typeof createServer> | null = null;
  #port: number | null = null;

  constructor(builds: PwaGenerationBuilds) {
    this.#builds = builds;
  }

  get origin(): string {
    if (this.#port === null) throw new Error('PWA generation server is not started');
    return `http://127.0.0.1:${this.#port}`;
  }

  get generation(): PwaGeneration {
    return this.#generation;
  }

  async start(): Promise<void> {
    if (this.#server) throw new Error('PWA generation server already started');
    const server = createServer((request, response) => {
      void serve(request, response, () => buildRoot(this.#builds, this.#generation));
    });
    await new Promise<void>((resolvePromise, reject) => {
      const onError = (error: Error) => {
        server.off('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        server.off('error', onError);
        const address = server.address();
        if (!address || typeof address === 'string') {
          reject(new Error('PWA generation server did not expose a TCP address'));
          return;
        }
        this.#port = address.port;
        resolvePromise();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(0, '127.0.0.1');
    });
    this.#server = server;
  }

  switchGeneration(generation: PwaGeneration): void {
    if (!this.#server) throw new Error('PWA generation server is not started');
    this.#generation = generation;
  }

  async close(): Promise<void> {
    const server = this.#server;
    this.#server = null;
    this.#port = null;
    if (!server) return;
    await new Promise<void>((resolvePromise, reject) => {
      server.close((error) => (error ? reject(error) : resolvePromise()));
    });
  }
}
