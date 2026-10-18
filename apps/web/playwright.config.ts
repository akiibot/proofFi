import { defineConfig } from '@playwright/test';
import path from 'node:path';

// One worker: every test shares one seeded backend. Read-only checks run first; journeys that write
// (`*.journey.spec.ts`) run afterwards, in file order, so the read-only checks always see the pristine seed.
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  // The document and API proxy compile independently; prepare both before login.
  globalSetup: path.resolve(__dirname, 'e2e/ready.ts'),
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'off' },
  projects: [
    { name: 'read-only', testIgnore: /\.journey\.spec\.ts$/ },
    { name: 'journeys', testMatch: /\.journey\.spec\.ts$/, dependencies: ['read-only'] },
  ],
  webServer: { command: 'node apps/web/e2e/server.mjs', cwd: path.resolve(__dirname, '../..'), url: 'http://127.0.0.1:3000', reuseExistingServer: false, timeout: 120000 },
  reporter: 'list',
});
