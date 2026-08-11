import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import { assertDisposableDatabase } from './test/disposable-database'

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/** Its own port, so a dev server on 3000 is never mistaken for the suite's. */
const PORT = process.env.E2E_PORT ?? '3123'
const BASE_URL = `http://localhost:${PORT}`

/** Overridable so CI can point at its own service container. */
const E2E_DATABASE_URL = assertDisposableDatabase(
  process.env.E2E_DATABASE_URL ?? 'postgresql://flexbase:flexbase@localhost:5432/flexbase_e2e',
)

const JWT_SECRET = 'e2e-not-a-real-secret'

// Set here, once the guard above has run, so the Prisma singleton the seed helpers reach for
// connects to the disposable database and not to whatever the ambient environment held
process.env.DATABASE_URL = E2E_DATABASE_URL
process.env.JWT_SECRET = JWT_SECRET

/**
 * The end-to-end suite: the production build, a real database, a real browser. It answers what
 * nothing below it can — what the app *does* with the logic the other three projects pin.
 *
 * **The server is the built output, started through `scripts/serve-output.mjs`** — the same
 * launcher `npm run preview` uses, minus the `.env` that `scripts/preview.mjs` loads on top of
 * it. That file is exactly what the suite must not read: it points at the *development*
 * database, and the suite creates and truncates tables. Reading env only from `webServer.env`
 * is what makes the target database unambiguous. The launcher itself exists because the output
 * bundle cannot start on Windows without its fix-up — see that file.
 */
export default defineConfig({
  testDir: resolve('./test/e2e'),
  // Colocated with the specs, so `#server`/`#shared` resolve here as they do everywhere else
  tsconfig: resolve('./test/e2e/tsconfig.json'),

  // One database, so cases may not run against it at once — the same reason the integration
  // project sets `fileParallelism: false`
  fullyParallel: false,
  workers: 1,

  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',

  globalSetup: resolve('./test/e2e/setup/global-setup.ts'),

  use: {
    baseURL: BASE_URL,
    // Every spec starts signed in; `global-setup` registers the one account and saves this
    storageState: resolve('./test/e2e/.auth/user.json'),
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
