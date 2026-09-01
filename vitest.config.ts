import { defineConfig } from 'vitest/config'
import { APP_INCLUDE, COVERAGE_BASE, SERVER_INCLUDE } from './vitest.coverage.config.ts'

/**
 * Two projects, and which one a spec lands in is decided by what it needs rather than what it is:
 *
 * - `unit` — pure logic and Vue-only reactivity, `environment: 'node'`;
 * - `nuxt` — anything needing the Nuxt runtime or a DOM, marked by a `*.nuxt.spec.ts` suffix.
 *
 * `npm run test` runs both. `test:unit` is the inner loop, staying under a Nuxt build's worth of
 * startup — the reason the fast half is not absorbed into the slow one.
 */
export default defineConfig({
  test: {
    projects: ['./vitest.unit.config.ts', './vitest.nuxt.config.ts'],

    // Coverage is root-only under `projects`: one report merged across both, rather than each
    // reporting on a slice the other also touches. `vitest --merge-reports --coverage` reports
    // through this config, so the reporters and output directory here are the merged report's.
    coverage: {
      ...COVERAGE_BASE,
      // Every module that ships and can be reasoned about as logic, whether or not a spec in
      // *this* run reaches it — `server/api/` and `server/middleware/` are covered by the
      // `integration` project, and merging the two runs is what makes their rows real
      include: [...SERVER_INCLUDE, ...APP_INCLUDE],
    },
  },
})
