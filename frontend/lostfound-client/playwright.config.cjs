// Playwright config (CommonJS) — used when package.json sets "type": "module"
const { devices } = require('@playwright/test');

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: 'tests',
  timeout: 60 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    headless: true,
    baseURL: process.env.VITE_API_BASE_URL || 'http://localhost:5298',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
};
