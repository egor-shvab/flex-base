import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  test: {
    name: 'unit',
    environment: 'node',
    // Required: the generated tsconfigs set `types: []`
    globals: false,
    include: ['{app,server,shared}/**/*.spec.ts', 'prisma/seed/**/*.spec.ts'],
    exclude: [...configDefaults.exclude, '**/*.nuxt.spec.ts', '**/*.integration.spec.ts'],
  },

  resolve: {
    alias: {
      '~~': resolve('.'),
      '#shared': resolve('./shared'),
      '#server': resolve('./server'),
      '~': resolve('./app'),
    },
  },
})
