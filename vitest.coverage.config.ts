/**
 * The coverage scope, shared by the two configs that measure it. **Not a runnable Vitest
 * config** — it exports fragments, and `vitest.config.ts` is still the root. It is named
 * `*.config.ts` anyway so `tsconfig.tools.json`'s `./*.config.ts` glob type-checks it; a
 * `vitest.coverage.ts` would fall outside every project and be invisible to `npm run typecheck`.
 *
 * It exists because coverage is now collected in two runs and merged: the `unit` and `nuxt`
 * projects reach everything under `app/` and the server's business layer, while `server/api/`
 * and `server/middleware/` are only ever exercised by the `integration` project, which needs a
 * database and so is deliberately absent from `npm run test`. One `include` list restated in
 * two files would drift; see `docs/decisions.md`.
 */

/** Everything both runs share: the provider, and what is never worth measuring. */
export const COVERAGE_BASE = {
  provider: 'v8' as const,
  exclude: [
    // Types are erased and the specs are not their own subject
    '**/*.spec.ts',
    'shared/types/**',
    // Generated, and matched by no glob below — declared so a future `server/**/*.ts`
    // shorthand cannot quietly sweep the Prisma client into the report
    'server/generated/**',
    // Environment wiring: reads `process.env` and constructs a client. Excluded rather
    // than carried as a file that would sit at 0% forever
    'server/db/prisma.ts',
  ],
}

/**
 * The half both runs can reach. The `integration` project measures exactly this and no more —
 * it cannot execute anything under `app/`, and its v8 provider would have to transform the
 * uncovered `app/field-types/*.ts` modules, which import `.vue` files, in a node environment
 * with no Vue plugin to resolve them.
 */
export const SERVER_INCLUDE = [
  'shared/**/*.ts',
  'server/api/**/*.ts',
  'server/db/**/*.ts',
  'server/middleware/**/*.ts',
  'server/services/**/*.ts',
  'server/utils/**/*.ts',
]

/**
 * The client half, measured by the `unit` + `nuxt` run alone. `.vue` files are deliberately
 * absent: components are pinned by behaviour specs, and ~40 markup files at partial coverage
 * would drown the signal from the modules that matter.
 */
export const APP_INCLUDE = [
  'app/api/**/*.ts',
  'app/composables/**/*.ts',
  'app/middleware/**/*.ts',
  'app/stores/**/*.ts',
  'app/utils/**/*.ts',
  // Only the registries themselves — `field-types/cells/` and `controls/` are components
  'app/field-types/*.ts',
  // A component's own composables sit beside it, and `app/components/**` is otherwise excluded
  // on purpose (markup). Named so they do not leave the report by living where they belong.
  'app/components/**/use*.ts',
]
