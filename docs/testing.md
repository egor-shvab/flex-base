# Testing

The rigs behind `CLAUDE.md` §10 — read before writing an integration or e2e spec. Which project a
spec belongs in, and the rules every spec follows, stay in §10; the reasons are `decisions.md` →
_Testing_.

## End-to-end

Chromium only, `workers: 1`, its own `flexbase_e2e` database. The launcher's import **must stay
dynamic** (`decisions.md` → _The built output is started by one launcher, and its import must stay
dynamic_).

- **Selectors have two exceptions only** — a decorative mirror of a name (`.base-select__value`) and
  structural reach (a column, a scroll container, geometry). When a role would help a _user_, fix
  the app: that is why the pager count and records empty state are `role="status"` — scope that one
  to `main`, or Nuxt's route announcer matches too.
- **`BaseSelect`'s button is named _label + value_** ("Stage Won"), and its overlay is a
  **sibling**.
- **Assert the table through `expect.poll`**, never a bare read — rows refetch after the URL moves;
  wait on something the navigation must produce, not text already on screen.
- The npm scripts start the database and install the browser — a stopped container makes Playwright
  report **zero tests run**.

What the suite exists to cover is `architecture.md` §11.

## Integration

- **`flexbase_test`** on the same container; `global-setup.ts` refuses a name not ending `_test`,
  then runs `migrate deploy` (creating it). `INTEGRATION_DATABASE_URL` is the only override.
- **`fileParallelism: false`** — one database.
- **Handlers are invoked directly** with a real `H3Event` (`test/integration/event.ts`, which sets
  `content-length` — without it every `readValidatedBody` is a 400). Only Nitro's routing is
  skipped.
- **One shim, `test/integration/nitro-runtime.ts`**, providing `useRuntimeConfig` — never grow it
  into a general Nitro stub.
- Rows are seeded through Prisma (`test/integration/seed.ts`), never through the services under
  test.

## Coverage and deliberate overlap

**Coverage is one report merged from two runs**; `.vitest-reports/` must contain nothing but the
blob files, and e2e contributes none (`decisions.md` → _Coverage is merged from two runs, not
collected in one_).

**The SQL layer is verified twice, deliberately**: `record-sql.spec.ts` pins `.text`/`.values`,
`record-sql.integration.spec.ts` runs them — the same split covers `widenToList` and the record
counter.

## Spec-only invariants

`MULTI_INPUTS` is non-null at exactly the types `MULTI_VALUE_BY_TYPE` marks `true` (a mismatch keeps
only the first value), and `MULTI_SQL` the same (a widened field through the scalar projection never
matches — probed via `ORDER BY`, since a widened filter is list-shaped anyway). Other spec-pinned
contracts: `architecture.md` §10 and `decisions.md`.

## Splitting a spec

A spec file that outgrows its concern is split over one shared rig (`BaseSelect/select-harness`);
add a case to the file whose concern it is.
