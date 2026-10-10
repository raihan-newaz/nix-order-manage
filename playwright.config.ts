import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/builder', fullyParallel: false, workers: 1, timeout: 60000,
  expect: { timeout: 10000 }, reporter: 'list',
  use: { baseURL: 'http://localhost:3000', browserName: 'chromium', channel: 'chrome', viewport: { width: 1536, height: 960 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'npm run dev:server', url: 'http://localhost:5000/api/health', reuseExistingServer: true, timeout: 120000 },
    { command: 'npm run dev:client', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 120000 },
    { command: 'npm run dev:storefront', url: 'http://localhost:3001', reuseExistingServer: true, timeout: 120000 },
  ],
});
