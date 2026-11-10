import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import { assertDisposableDatabase } from './test/disposable-database'

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url))

const PORT = process.env.E2E_PORT ?? '3123'
const BASE_URL = `http://localhost:${PORT}`

const E2E_DATABASE_URL = assertDisposableDatabase(
  process.env.E2E_DATABASE_URL ?? 'postgresql://flexbase:flexbase@localhost:5432/flexbase_e2e',
)

const JWT_SECRET = 'e2e-not-a-real-secret'

// After the guard, so the seed helpers' Prisma singleton connects to the disposable database
process.env.DATABASE_URL = E2E_DATABASE_URL
process.env.JWT_SECRET = JWT_SECRET

/**
 * The server is the built output through `scripts/serve-output.mjs`, never `npm run preview`,
 * whose `.env` points at the development database this suite truncates.
 */
export default defineConfig({
  testDir: resolve('./test/e2e'),
  tsconfig: resolve('./test/e2e/tsconfig.json'),

  fullyParallel: false,
  workers: 1,

  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',

  globalSetup: resolve('./test/e2e/setup/global-setup.ts'),

  use: {
    baseURL: BASE_URL,
    storageState: resolve('./test/e2e/.auth/user.json'),
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'npm run build && node scripts/serve-output.mjs',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      JWT_SECRET,
      PORT,
      NITRO_PORT: PORT,
    },
  },
})
