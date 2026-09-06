import { expect, test } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';

let devServer: ViteDevServer;
let origin: string;
let workerRequests = 0;
const previousNodeEnv = process.env.NODE_ENV;

test.beforeAll(async () => {
  test.setTimeout(60_000);
  devServer = await createServer({
    logLevel: 'error',
    plugins: [
      {
        name: 'observe-development-worker-requests',
        configureServer(server) {
          server.middlewares.use((request, _response, next) => {
            if (request.url?.split('?')[0] === '/sw.js') workerRequests += 1;
            next();
          });
        },
      },
    ],
    server: { host: '127.0.0.1', port: 0 },
  });
  await devServer.listen();
  const address = devServer.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('Development server did not listen');
  origin = 'http://127.0.0.1:' + address.port;
});

test.afterAll(async () => {
  try {
    await devServer?.close();
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('opens the development workspace without trying to register a disabled worker', async ({
  page,
}) => {
  await page.goto(origin);
  await expect(page.getByRole('button', { name: 'Create climb', exact: true })).toBeVisible();
  expect(workerRequests).toBe(0);
  await expect(page.getByRole('complementary', { name: 'Application update' })).toHaveCount(0);
});
