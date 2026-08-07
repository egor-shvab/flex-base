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
      include: [
        'shared/**/*.ts',
        'server/services/**/*.ts',
        'app/composables/**/*.ts',
        'app/stores/**/*.ts',
        'app/utils/**/*.ts',
        // Only the registries themselves — `field-types/cells/` and `controls/` are components
        'app/field-types/*.ts',
      ],
      // Types are erased and the specs are not their own subject
      exclude: ['**/*.spec.ts', 'shared/types/**'],
    },
  },
})
