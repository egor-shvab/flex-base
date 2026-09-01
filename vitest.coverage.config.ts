/**
 * The coverage scope, shared by the two configs that measure it. **Not a runnable Vitest
 * config** — it exports fragments. Named `*.config.ts` so `tsconfig.tools.json`'s glob
 * type-checks it; a `vitest.coverage.ts` would be invisible to `npm run typecheck`.
 *
 * Coverage is collected in two runs and merged: `unit` and `nuxt` reach `app/` and the server's
 * business layer, while `server/api/` and `server/middleware/` are exercised only by
 * `integration`, which needs a database. One `include` list in two files would drift
 * (`docs/decisions.md`).
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
 * The half both runs can reach. `integration` measures exactly this: it cannot execute anything
 * under `app/`, and its v8 provider would have to transform the uncovered `app/field-types/*.ts`
 * modules — which import `.vue` files — in a node environment with no Vue plugin.
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
 * The client half, measured by the `unit` + `nuxt` run alone. `.vue` files are absent on
 * purpose: components are pinned by behaviour specs, and markup at partial coverage would drown
 * the signal from the modules that matter.
 */
export const APP_INCLUDE = [
  'app/api/**/*.ts',
  'app/composables/**/*.ts',
  'app/middleware/**/*.ts',
  'app/stores/**/*.ts',
  'app/utils/**/*.ts',
  // The assemblers and every per-type module; the `.vue` cells beside them stay out. `**`, not
  // `*`: a per-type module sits a directory down, which a single-level glob would drop silently.
  'app/field-types/**/*.ts',
  // A component's own composables sit beside it, and `app/components/**` is otherwise excluded
  // on purpose (markup). Named so they do not leave the report by living where they belong.
  'app/components/**/use*.ts',
]
