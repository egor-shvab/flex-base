import { defineConfig } from 'vitest/config'
import { APP_INCLUDE, COVERAGE_BASE, SERVER_INCLUDE } from './vitest.coverage.config.ts'

/**
 * The suite is two projects, and which one a spec lands in is decided by what it needs rather
 * than by what it is:
 *
 * - `unit` (`vitest.unit.config.ts`) — pure logic and Vue-only reactivity, `environment: 'node'`.
 * - `nuxt` (`vitest.nuxt.config.ts`) — anything needing the Nuxt runtime or a DOM, marked by a
 *   `*.nuxt.spec.ts` suffix so the split is visible in the file name.
 *
 * `npm run test` runs both. `test:unit` is the inner loop — it stays under a Nuxt build's worth
 * of startup, which is the whole reason the fast half was not simply absorbed into the slow one.
 */
export default defineConfig({
  test: {
    projects: ['./vitest.unit.config.ts', './vitest.nuxt.config.ts'],

    // Coverage is root-only under `projects`: one report merged across both, rather than each
    // project reporting on a slice of the codebase the other one also touches. This config is
    // also what `vitest --merge-reports --coverage` reports through, so the reporters and the
    // output directory named here are the ones the merged report uses — see
    // `vitest.coverage.config.ts` for why the scope is declared in a third file.
    coverage: {
      ...COVERAGE_BASE,
      // Every module that ships and can be reasoned about as logic, whether or not a spec in
      // *this* run reaches it — `server/api/` and `server/middleware/` are covered by the
      // `integration` project, and merging the two runs is what makes their rows real
      include: [...SERVER_INCLUDE, ...APP_INCLUDE],
    },
  },
})
