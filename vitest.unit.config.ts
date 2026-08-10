import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/**
 * The fast project: pure logic, no Nuxt runtime, no DOM, no database. Nothing here pays for a
 * Nuxt app instance, which is the entire reason it is a separate project rather than one suite
 * with a mixed environment — see `vitest.nuxt.config.ts` for the other half.
 *
 * A spec belongs here unless it genuinely needs Nuxt or a DOM. Vue reactivity alone does not
 * count: `vue` is a plain dependency, so a composable built from `ref`/`watch`/`computed` is
 * testable here with an `effectScope` and nothing else.
 */
export default defineConfig({
  test: {
    name: 'unit',
    environment: 'node',
    // No globals, matching the project's `autoImport: false` doctrine — and required anyway,
    // since the generated tsconfigs set `types: []`, so ambient `describe`/`it` would not typecheck
    globals: false,
    include: ['{app,server,shared}/**/*.spec.ts'],
    // `exclude` replaces Vitest's defaults rather than extending them, so `node_modules` and
    // friends have to be carried over by hand alongside the other projects' files. The
    // integration specs are excluded by name for the same reason they are not in
    // `test.projects`: they need a database, and this project must never want one.
    exclude: [...configDefaults.exclude, '**/*.nuxt.spec.ts', '**/*.integration.spec.ts'],
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
