import { defineConfig } from '@playwright/test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const frontendPort = Number(process.env.PLAYWRIGHT_FRONTEND_PORT ?? 3000)
const backendPort = Number(process.env.PLAYWRIGHT_BACKEND_PORT ?? 8000)

export const authStatePath = join(tmpdir(), `atlas-playwright-auth-state-${frontendPort}.json`)
const databasePath = join(tmpdir(), `atlas-playwright-${backendPort}.db`).replace(/\\/g, '/')

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  outputDir: './test-results',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
    channel: 'chrome',
    storageState: authStatePath,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'phone-320x568', use: { viewport: { width: 320, height: 568 } } },
    { name: 'phone-360x800', use: { viewport: { width: 360, height: 800 } } },
    { name: 'phone-390x844', use: { viewport: { width: 390, height: 844 } } },
    { name: 'tablet-768x1024', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'tablet-1024x768', use: { viewport: { width: 1024, height: 768 } } },
    { name: 'desktop-1280x800', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'desktop-wide', use: { viewport: { width: 1600, height: 1000 } } },
  ],
  webServer: [
    {
      command: `python -m uvicorn backend.api.main:app --app-dir .. --host 127.0.0.1 --port ${backendPort}`,
      url: `http://127.0.0.1:${backendPort}/health`,
      cwd: '.',
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        DATABASE_URL: `sqlite:///${databasePath}`,
        SECRET_KEY: 'playwright-only-secret-key-at-least-32-characters',
        AUTO_SEED_SAMPLE_DATA: 'false',
      },
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort}`,
      url: `http://127.0.0.1:${frontendPort}/login`,
      cwd: '.',
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        BACKEND_URL: `http://127.0.0.1:${backendPort}`,
      },
    },
  ],
})
