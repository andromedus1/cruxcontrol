import { defineConfig } from '@playwright/test';

// Browser verification of the packaged assets. This does not run iOS Simulator.
export default defineConfig({
  testDir: './prototype-tests',
  forbidOnly: Boolean(process.env.CI),
  use: {
    baseURL: 'http://127.0.0.1:4187',
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --mode ios-prototype --host 127.0.0.1 --port 4187 --strictPort',
    port: 4187,
    reuseExistingServer: false,
  },
});
