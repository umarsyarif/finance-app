import { defineConfig, devices } from '@playwright/test';

// Real browser + real backend (Postgres/Redis from `make infra`), on ports that
// don't collide with the dev servers. Run: npm run test:e2e
const API_PORT = 8010;
const WEB_PORT = 5180;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts', // not *.spec/test.ts, which vitest would pick up
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  globalTeardown: './e2e/teardown.ts',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    timezoneId: 'Asia/Seoul',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: [
    {
      command: 'npm run start',
      cwd: '../backend',
      url: `http://localhost:${API_PORT}/api/healthchecker`,
      env: { PORT: String(API_PORT), NODE_CONFIG: JSON.stringify({ origin: `http://localhost:${WEB_PORT}` }) },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_API_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
