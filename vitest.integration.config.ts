import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'
import { COVERAGE_BASE, SERVER_INCLUDE } from './vitest.coverage.config.ts'

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/** Overridable so CI can point at its own service container. */
const DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  'postgresql://flexbase:flexbase@localhost:5432/flexbase_test'

const JWT_SECRET = 'integration-not-a-real-secret'

// Assigned here as well as in `test.env` below: `test.env` reaches the worker processes, but
// `globalSetup` runs in this one — and that is where the disposable-database guard lives
process.env.DATABASE_URL = DATABASE_URL
process.env.JWT_SECRET = JWT_SECRET

/**
 * The third project: real PostgreSQL, real Prisma client, real handlers. Deliberately **not**
 * listed under `test.projects` — `npm run test` stays database-free.
 *
 * It proves the half a stub cannot: that the SQL executes, that the widening migration does what
 * it claims to stored rows, that the record counter holds under concurrent writes, and that the
 * ownership rules survive out to the endpoint.
 *
 * Handlers are invoked directly with a constructed `H3Event`, which runs `requireUser` →
 * ownership → zod → service for real and skips only Nitro's routing.
 */
export default defineConfig({
  test: {
    name: 'integration',
    environment: 'node',
    globals: false,
    include: ['{server,shared}/**/*.integration.spec.ts'],
    exclude: [...configDefaults.exclude],

    // One database, shared by every file — so files may not run against it at once
    fileParallelism: false,

    globalSetup: ['./test/integration/global-setup.ts'],
    setupFiles: ['./test/integration/setup.ts'],

    env: { DATABASE_URL, JWT_SECRET },

    // The only project reaching `server/api/` and `server/middleware/`, so its numbers are the
    // only honest ones there. It reports nothing on its own: `coverage:collect` writes a blob
    // here and merges it into the root run's report.
    coverage: { ...COVERAGE_BASE, include: SERVER_INCLUDE },
  },

  // The same aliases the unit project mirrors from `.nuxt/tsconfig.*.json`, plus the one shim
  // this project needs — see `test/integration/nitro-runtime.ts` for why it is unavoidable.
  resolve: {
    alias: {
      '~~': resolve('.'),
      '#shared': resolve('./shared'),
      '#server': resolve('./server'),
      '~': resolve('./app'),
      'nitropack/runtime': resolve('./test/integration/nitro-runtime.ts'),
    },
  },
})
