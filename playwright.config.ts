import { defineConfig, devices } from '@playwright/test'

// Smoke tests for the critical journeys, against the local dev server and the shared Supabase project
// from .env.local, which MUST use the dev slug (wives-hangout-2026-dev; the server refuses anything else
// outside production). Email is forced to log mode; rows are tagged source=e2e and deleted afterwards
// (e2e/teardown.ts, dev slug only).
const PORT = 3200

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Each submit waits 3s (bot check) plus a laptop → London database round trip; the duplicate test submits twice.
  timeout: 60_000,
  workers: 3,
  retries: 0,
  reporter: 'list',
  globalTeardown: './e2e/teardown.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Pixel 7'],
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node --env-file=.env.local scripts/dev-server.mjs',
    env: { PORT: String(PORT), EMAIL_MODE: 'log', REGISTRATION_OPENS_AT: '', REGISTRATION_CLOSES_AT: '', RATE_LIMIT_MAX: '1000', MENU_RATE_LIMIT_MAX: '1000', MENU_CLOSES_AT: '2999-01-01T00:00:00+01:00' },
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
