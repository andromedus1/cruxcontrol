import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/catalog-bootstrap.spec.ts'],
  forbidOnly: Boolean(process.env.CI),
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
