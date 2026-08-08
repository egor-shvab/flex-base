import { defineConfig } from 'vitest/config'

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
    // project reporting on a slice of the codebase the other one also touches.
    coverage: {
      provider: 'v8',
      // Every module that ships and can be reasoned about as logic, whether or not a spec
      // reaches it yet — a directory left out here is a gap no report can show. `.vue` files
      // are deliberately absent: components are pinned by behaviour specs, and ~40 markup
      // files at partial coverage would drown the signal from the modules that matter.
      include: [
        'shared/**/*.ts',
        // Handlers are only reachable from integration tests, which do not exist yet — they
        // are listed so the report says so rather than staying silent about it
        'server/api/**/*.ts',
        'server/middleware/**/*.ts',
        'server/services/**/*.ts',
        'server/utils/**/*.ts',
        'app/composables/**/*.ts',
        'app/middleware/**/*.ts',
        'app/stores/**/*.ts',
        'app/utils/**/*.ts',
        // Only the registries themselves — `field-types/cells/` and `controls/` are components
        'app/field-types/*.ts',
      ],
      exclude: [
        // Types are erased and the specs are not their own subject
        '**/*.spec.ts',
        'shared/types/**',
        // Generated, and matched by no glob above — declared so a future `server/**/*.ts`
        // shorthand cannot quietly sweep the Prisma client into the report
        'server/generated/**',
        // Environment wiring: reads `process.env` and constructs a client. Excluded rather
        // than carried as a file that would sit at 0% forever
        'server/utils/prisma.ts',
      ],
    },
  },
})
