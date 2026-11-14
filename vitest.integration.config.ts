import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'
import { COVERAGE_BASE, SERVER_INCLUDE } from './vitest.coverage.config.ts'

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url))

const DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  'postgresql://flexbase:flexbase@localhost:5432/flexbase_test'

const NUXT_JWT_SECRET = 'integration-not-a-real-secret-0123456789'

// Also assigned here: `globalSetup`, which holds the disposable-database guard, runs in this
// process
process.env.DATABASE_URL = DATABASE_URL
process.env.NUXT_JWT_SECRET = NUXT_JWT_SECRET

export default defineConfig({
  test: {
    name: 'integration',
    environment: 'node',
    globals: false,
    include: ['{server,shared}/**/*.integration.spec.ts'],
    exclude: [...configDefaults.exclude],

    fileParallelism: false,

    globalSetup: ['./test/integration/global-setup.ts'],
    setupFiles: ['./test/integration/setup.ts'],

    env: { DATABASE_URL, NUXT_JWT_SECRET },

    coverage: { ...COVERAGE_BASE, include: SERVER_INCLUDE },
  },

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
