import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/**
 * The fast project: pure logic, no Nuxt runtime, no DOM, no database. Nothing here pays for a
 * Nuxt app instance, which is why it is separate rather than one mixed-environment suite.
 *
 * A spec belongs here unless it genuinely needs Nuxt or a DOM. Vue reactivity alone does not
 * count: `vue` is a plain dependency, so a composable built from `ref`/`watch`/`computed` is
 * testable here with an `effectScope`.
 */
export default defineConfig({
  test: {
    name: 'unit',
    environment: 'node',
    // No globals, matching the project's `autoImport: false` doctrine — and required anyway,
    // since the generated tsconfigs set `types: []`, so ambient `describe`/`it` would not typecheck
    globals: false,
    // `prisma/seed/` is outside the three source directories, but its dataset carries invariants
    // no type can state — every SELECT value a declared choice, every relation ref resolving —
    // so it is checked here rather than only when the seed runs
    include: ['{app,server,shared}/**/*.spec.ts', 'prisma/seed/**/*.spec.ts'],
    // `exclude` replaces Vitest's defaults rather than extending them, so `node_modules` and
    // friends are carried over by hand. The integration specs are excluded by name for the
    // reason they are not in `test.projects`: this project must never want a database.
    exclude: [...configDefaults.exclude, '**/*.nuxt.spec.ts', '**/*.integration.spec.ts'],
  },

  // Mirrors the `paths` Nuxt generates into `.nuxt/tsconfig.*.json`, so a spec resolves at
  // runtime exactly as `vue-tsc` resolved it. `~~` is first for readability; Vite matches a
  // string alias on `id === find || id.startsWith(find + '/')`, so `~` cannot swallow it anyway.
  resolve: {
    alias: {
      '~~': resolve('.'),
      '#shared': resolve('./shared'),
      '#server': resolve('./server'),
      '~': resolve('./app'),
    },
  },
})
