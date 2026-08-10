import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/** Overridable so CI can point at its own service container. */
const DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  'postgresql://flexbase:flexbase@localhost:5432/flexbase_test'

const JWT_SECRET = 'integration-not-a-real-secret'

// Assigned here as well as declared in `test.env` below: `test.env` reaches the worker
// processes the specs run in, but `globalSetup` runs in this one — and that is where the
// guard against pointing at a non-disposable database lives.
process.env.DATABASE_URL = DATABASE_URL
process.env.JWT_SECRET = JWT_SECRET

/**
 * The third project: real PostgreSQL, real Prisma client, real handlers. Deliberately **not**
 * listed in `vitest.config.ts` under `test.projects` — `npm run test` stays database-free, so
 * the inner loop and the main CI job are unaffected by whether a database is running.
 *
 * What this project exists to prove is the half a stub cannot: that the SQL the builder emits
 * actually executes, that the raw-SQL widening migration does what it claims to stored rows,
 * that the record counter holds under concurrent writes, and that the ownership rules survive
 * all the way out to the endpoint rather than only one layer below it.
 *
 * Handlers are invoked directly with a constructed `H3Event` rather than over HTTP: that runs
 * `requireUser` → ownership → zod → service for real, and skips only Nitro's routing, which is
 * generated rather than written and which Playwright covers from the outside.
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
