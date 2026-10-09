import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'catalog-bootstrap.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  use: {
    baseURL: 'http://127.0.0.1:4175',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/build-catalog-test-harness.mjs --serve',
    port: 4175,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
