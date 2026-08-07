import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/**
 * Unit tests only — pure logic, no Nuxt runtime, no DOM, no database. `@nuxt/test-utils` and a
 * DOM environment are deliberately absent: nothing under test touches them, and adding them
 * would make every spec pay for a Nuxt app instance it never uses. The first component or
 * composable test is what earns them.
 */
export default defineConfig({
  test: {
    environment: 'node',
    // No globals, matching the project's `autoImport: false` doctrine — and required anyway,
    // since the generated tsconfigs set `types: []`, so ambient `describe`/`it` would not typecheck
    globals: false,
    include: ['{app,server,shared}/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['shared/**/*.ts', 'server/services/**/*.ts'],
      // Types are erased and the specs are not their own subject
      exclude: ['**/*.spec.ts', 'shared/types/**'],
    },
  },

  // Mirrors the `paths` Nuxt generates into `.nuxt/tsconfig.*.json`, so a spec resolves at
  // runtime exactly as `vue-tsc` resolved it. `~~` is declared first for readability; Vite
  // matches a string alias on `id === find || id.startsWith(find + '/')`, so `~` cannot
  // swallow a `~~/…` specifier either way.
  resolve: {
    alias: {
      '~~': resolve('.'),
      '#shared': resolve('./shared'),
      '#server': resolve('./server'),
      '~': resolve('./app'),
    },
  },
})
