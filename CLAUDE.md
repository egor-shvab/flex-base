# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository. Read the relevant
companion before changing the area it covers:

- **`docs/architecture.md`** — how the metadata layer works: registries, record identity and
  columns, relations, wire formats, the SQL layer, module contracts, the e2e checklist.
- **`docs/styling.md`** — how the SCSS layer fits together: tokens, mixin semantics, the
  `BaseButton` variant contract, the shell.
- **`docs/decisions.md`** — why it works that way: rejected alternatives and load-bearing
  constraints that must not be "cleaned up".
- **`docs/limitations.md`** — what the project knowingly does not do, each with the trigger that
  would reopen it.

How the five are maintained is §12.

---

## 1. Project & scope

FlexBase is a full-stack **low-code platform** (Nuxt 4, Vue 3, TypeScript, Nitro, Prisma,
PostgreSQL): users create their own tables and custom fields and manage records through generated
interfaces.

Non-negotiable:

- **Metadata-driven** — forms, tables and APIs come from configuration in the database, never from
  hardcoded entities. A new field type plugs into the registries without rewrites (§9).
- **Server-enforced ownership** — every resource belongs to one user, checked on the server on every
  request.
- **Full TypeScript coverage**, with zod schemas shared by client and server; **YAGNI** — build what
  the change needs, favouring clean architecture over short-term optimisation.

**Out of scope unless explicitly asked:** teams, workspaces, permissions, dashboards, activity
history, workflows, automations, file uploads, import/export, third-party integrations. The
architecture may be shaped to accommodate them only where that also improves existing code. A design
element whose feature is out of scope is not built.

Work starts from a request, not a backlog: **no roadmap or plan file is kept** unless a request asks
for one (§2). `docs/limitations.md` **Open** entries are in scope; **Accepted** ones are not unless
a request says so — and an Open entry waits behind its stated trigger.

---

## 2. Commands & definition of done

Commands are in `README.md` (`package.json` is the source). `npm run typecheck` is the fast loop —
the build's `vue-tsc` errors without rewriting `.output`, and its second step is the **only** check
of the Playwright specs. `build` stays the pre-commit gate, the only step exercising Vite/Nitro
bundling. In CI, call the tools rather than `test:integration` / `test:e2e` / `test:coverage`, which
start Docker and install Chromium. PostgreSQL runs in Docker — never OSPanel's bundled modules.

### Definition of done

In order:

1. `npm run format`;
2. `npx eslint .` passes;
3. `npm run build` passes;
4. `npm run test` passes, with tests for the changed logic (§10);
5. interactive or visual change: the keyboard path works and the focus ring is visible (a manual
   walk; target size and axe are gated by `npm run test:e2e`);
6. verified in the running app (dev server);
7. a knowingly left limitation is recorded in `docs/limitations.md`;
8. docs updated **only where a rule, contract or limitation changed** (§12);
9. a task from a plan file is marked in it before the work is reported (below).

**A finished change is left uncommitted.** Never `git commit` unless the user asks for one in that
message — not when the suite is green, not because a plan said so; approving a plan is not approval
to commit. Say what is in the tree and suggest a Conventional Commit message.

### Marking a plan task done

- Mark **per task**, the moment steps 1–8 pass and before reporting it — batched marks are what an
  interruption loses.
- The mark is the **first line of the task's block**: `**Status:** done — YYYY-MM-DD`. No line means
  not started.
- Mark what happened: `done, with changes — <difference>`, `in progress — <what is left>`, or
  dropped/superseded. A prepared but unlanded diff is not done.
- When every task is done, say so and **offer** to delete the plan file; never delete one unasked.

---

## 3. Layering

**`server/` is three layers pointing one way — `api` → `services` → `db` —** with `utils/`
importable by all three and importing none. `db/` is the only place that touches the Prisma client,
a `select` shape, a row mapper or `Prisma.Sql` (so the per-type SQL lives in `db/field-types/`).
**`db/` may not import `h3`**: it classifies a fault, `utils/http-errors.ts` maps it. Enforced by
`no-restricted-imports` — **an alias-prefixed restriction must be a `regex` pattern, never a
`group`** (`docs/decisions.md`).

**`shared/` is ordered `types` → `field-types` → `constants` → `utils` → `validation`**, each
importing only from layers before it. `field-types/` is read by `utils/` and `validation/`, **never
the reverse** (lint-enforced), and is the one place outside `validation/` that may import zod. A
helper that fits no other folder goes in `utils/`.

**A declaration lives with the layer that uses it** — `app/types/` and `app/utils/` for what only
Vue uses, `shared/` for what both sides speak. `docs/design/` is the visual reference (§8), never
imported.

---

## 4. Imports

**Components are auto-imported; nothing else is** (`autoImport: false` for app and Nitro), so a
missing import is a `vue-tsc` error. Import Vue APIs from `vue`, Nuxt composables from `#imports`,
`defineStore` from `pinia`, h3 helpers from `h3`, the server's `useRuntimeConfig` from
`nitropack/runtime`, and a component referenced from **script** (e.g. behind `<component :is>`) from
`#components`.

- **Imports are always aliased** — `~/` (app), `#server/` (server), `#shared/` (both); relative
  paths are a lint error under `app/`, `server/` and `shared/`.
- **`#server` is server-only.** The Vue layer reaches the server through `useApi()`; shared code
  goes in `shared/`.
- **Server code never imports from `#imports`.**

Rationale: `docs/decisions.md` → _Everything except components is imported explicitly_.

---

## 5. API conventions

- Route files are named by method suffix (`index.get.ts`, `[tableAddress].patch.ts`). Handlers stay
  thin: validate with the shared zod schema (`readValidatedBody(event, schema.parse)` → a 400 with
  zod details) → assert ownership → call a service.
- **Each service module exports one plain object named for it** (`AuthService`, `TableService`,
  `FieldService`, `RecordService`, `RelationService`), called as `FieldService.createField(…)`;
  method names are never shortened. `app/api/` modules are bound per resource inside a store, so
  their members stay bare (`api.list`, `api.remove`).
- **A table-scoped route is declared with a factory from `server/utils/handler.ts`**, never a bare
  `defineEventHandler` — the ownership check is what produces the context. A shape none covers
  **adds a factory**.
- **Ownership lives in the query:** scope every Prisma query inside its `where` (`{ id, userId }` or
  a relation filter through `table`) via `server/utils/ownership.ts` — never fetch then check.
- **Status codes:** another user's resource is **404, never 403**; 401 only from
  `requireUser(event)`; 409 for uniqueness conflicts; every login failure is the same generic 401.
- `User` rows are read with an explicit `select` (`id`, `email`); `passwordHash` never leaves. Never
  return another user's data.
- Errors are `createError({ statusCode, statusMessage })`. Secrets come from
  `useRuntimeConfig(event)`, never `process.env` (sole exception: `server/db/prisma.ts`).
- Record lists are **always paginated server-side** (default 50, cap 100). **No queries in loops** —
  batch with `in`, `createMany` or `include` (watch relation-label resolution). `select` only what a
  response needs; check `@@index` coverage for a new query pattern.
- No `console.log`. **A handler never logs for itself** — `server/plugins/error-log.ts` records
  unhandled 5xx under a redaction contract (`docs/decisions.md`).
- **`POST /api/client-errors` is the one endpoint open to anyone**; it carries its own guards — a
  `content-length` check before the body is read (a missing length refused) and a per-address rate
  limit — and takes no user id from its body.

**Migrations are non-destructive.** A new required column is added nullable → backfilled →
`NOT NULL`, written with `--create-only`. Never drop or retype a column holding user data without an
explicit plan. **Judge a migration's cost against the table it will eventually run on** — a rewrite
instant on a small table locks a large one for minutes.

---

## 6. Code quality

- **DRY, with a hard trigger:** the **second** occurrence of the same logic (a validation block, an
  error mapping, a `watch`, a fetch pattern, a constraint→HTTP mapping) is extracted before
  continuing — into a composable, a util or a service. Never "for now".
- **Names:** the longer name wins wherever it removes a question (`readCellValue` over `cellValue`).
  A name states what a value **is**, not its shape (`queryState` holds state; `queryParams` would be
  its strings). Where the code's prose already names a concept, that phrase is the name.
- **Comments are rare** — only a trap, an external fact, or a security invariant. No purpose lines,
  no restating code, no history.
- **A function name opens with a role prefix, never with whether it is async.** One exemplar per
  family; a new function joins one or says why it cannot:
  - `to*` pure conversion, no I/O — `toSharedRecord`
  - `build*` assembles a composite value — `buildRecordWhere`
  - `parse*` decodes an untrusted string — `parseRecordQueryState`
  - `is*` · `matches*` · `should*` predicate — `isMultiValue`
  - `format*` · `summarise*` value → display string — `formatDate`
  - `*For(field)` sync registry lookup keyed by a field (§9) — `inputFor`
  - `require*` · `assert*` throws unless a precondition holds — `requireOwnedTable`
  - `list*` · `get*` service read — a collection, or exactly one row (throws if absent)
  - `fetch*` · `load*` · `ensure*` store read — one endpoint, several composed, only if not held

  `get*` retrieves something that exists, never something computed. `buildOptions` and
  `collectRelationTargets` are the two sync service members, and their prefixes say so.

- **One meaning per word.** Taken: `ref` (Vue), `slot` (template), `spec` (test file), `summary` (a
  filter chip or a field's config line), `detail` (the record dialog). Qualify a second use
  (`configSummary`).
- **Closed vocabularies — an internal rename never reaches them:** URL query params, JSON body keys,
  Prisma columns and `FieldType` members, BEM class names, user-visible labels (the e2e suite
  selects by them), and the `*For(field)` family. An internal name may differ from its wire name
  (`params.dir = state.sort.direction`).
- **`any` is forbidden** — interfaces, generics, or `unknown` with guards.
- **Type naming:** project interfaces `I*`, type aliases `T*`, everywhere; external and generated
  types keep their names. A module object of **behaviour** is PascalCase (`FieldService`); a
  registry of **data** is SCREAMING_SNAKE (`FIELD_CELLS`).

---

## 7. Frontend conventions

- Pinia stores are **setup-style**; state is mutated only inside the store's actions.
- `Base*` prefix for generic atoms in `app/components/common/`.
- **A composable belonging to one component lives in that component's folder** (`Foo/Foo.vue` +
  `Foo/useThing.ts` + its specs) — `BaseSelect/` today. **A page is the exception** (a sibling
  folder would become a route): its composable stays in `app/composables/`, scoped by TSDoc.
  `nuxt.config.ts` pins `extensions: ['.vue']`, so a `.ts` there is not registered as a component.
- Props and emits via `defineProps<…>()` / `defineEmits<…>()`. DTO types come from `z.infer` of the
  shared schemas, never a parallel interface.
- Data fetching: page → `useAsyncData` / store action → **`app/api/`** → `useApi()`. **Never bare
  `$fetch`** (it drops cookies in SSR). Errors via `getApiErrorMessage`.
- **A URL and a response type live only in `app/api/`** — paths from `apiPath`, responses declared
  in `shared/types/api.ts` and annotated on every handler. A store or component writing `/api/…` or
  an `api<{…}>` generic is reaching past that layer.
- Forms use `useForm`; list-page deletes use `useDeleteConfirm`; a popover uses `usePopover` (+
  `useAnchoredPosition` to escape a clipping ancestor).
- **A popover swallows Escape only while it has something open.** `BaseModal` and the shell's
  sidebar hold the only two `document` Escape listeners; a popover adds none — `@keydown.esc.stop`
  on its panel where focus is inside it, a JS check on `open` where focus stays outside (a
  combobox). Details: `docs/decisions.md` → _Escape is swallowed only while something of ours is
  open_.
- **Every async surface states its condition:** loading, empty and error are distinct — never infer
  "empty" from "unknown"; a failed fetch shows a banner + retry.
- **Never ship a dead control** — a visible input or button that cannot act yet is worse than its
  absence.

### Performance

- **`shallowRef`** for large fetched collections replaced wholesale; plain `ref` for small UI state.
- Field-type registries are **`markRaw`ped module constants**.
- **`Lazy`**-prefix heavy, conditionally rendered components (`<LazyBaseModal v-if>`).
- **Debounce** user-driven query inputs ~300 ms (`useDebouncedModel`).
- Fetch page data through `useAsyncData` with an explicit key; never re-fetch in `onMounted` what
  SSR loaded. **A layout and a page must never share a key.**
- No image pipeline ships (`docs/decisions.md` → _Webfonts come from `@fontsource`, and
  `@nuxt/image` is not installed_).

Static UI (auth pages, chrome) does not need this machinery — KISS wins there.

---

## 8. Styling & design

All styles are **SCSS**: globals in `app/assets/scss/main.scss`, components in
`<style lang="scss" scoped>`.

### Design principles

Neutral chrome, coloured data. **Light grey surfaces carry the interface; one deep green accent
(`#1C6B4A`) marks primary actions, focus and selection and never fills a large area; the closed
ten-hue badge palette is the user's — the two never mix.** **Archivo** for anything a person reads,
**IBM Plex Mono** for anything a machine produced (record numbers, keys, addresses, timestamps).
**36px control height, 8px radius, 14px control and cell text**; borders do the structural work, and
a shadow only means a surface floats — always with a real border.

**`docs/design/` is the visual reference** — `FlexBase Design System.dc.html` for foundations, the
rest for pages; serve them from a local static server (they render through `support.js`). The
reference never beats a project rule (the a11y floors, §1's scope, §6's closed vocabularies) and
never brings a feature the app lacks; any disagreement is settled by **proposing a reference
update**, not by changing code to match.

### Accessibility: WCAG 2.2 AA

`npm run test:e2e` gates axe (WCAG A/AA, failing on `serious`/`critical`) and target size; neither
replaces the keyboard walk.

- Everything interactive is keyboard-operable with a visible `:focus-visible`. **Focus is never
  removed, only restyled.** Two registers: a control with no border of its own (button, link, row,
  option) takes `focus-ring`; a **form control** takes `form-control` or `control-focus`, which
  recolour its own border. **They are mutually exclusive.** `--focus-ring-halo` is **never the
  indicator** (`docs/decisions.md` → _Focus is never removed, only restyled_).
- **Target size ≥ 24×24** (SC 2.5.8). The house floor is `--control-height` (36px) for anything that
  edits or commits a value; **compact chrome** — pager cells (30px), a chip's remove button (24px) —
  is the only tier below. Content-sized controls need **both** axes floored. 44×44 is AAA — never
  quote it as the AA bar.
- The gate (`test/e2e/accessibility.spec.ts`, `test/e2e/setup/a11y.ts`) encodes three SC 2.5.8
  exceptions — `.text-link` inline, an `<input>` whose wrapping `<label>` is the target, anything
  not rendered. **Do not add a fourth to make a failure go away.**
- Text contrast ≥ 4.5:1; control outlines and other non-text UI ≥ 3:1 (hence
  `--color-border-control` apart from `--color-border-strong`).
- Dialogs and off-canvas surfaces are `inert`-guarded and hidden with `visibility: hidden`, not
  translation alone.

### Rules

- **BEM** class names; SCSS nesting with `&` — never repeat a parent selector.
- **Sizes in rem via `rem()`**; plain `px` only for hairlines and shadow offsets/blur.
- `functions` and `mixins` reach every SFC and entry file automatically, but **not** a transitively
  `@use`d partial — such a partial `@use`s both itself, and `main.scss` must not re-`@use` either.
- **Reuse before you paste:** check `_mixins.scss`; a block with no per-site variation is a class in
  its own partial (`.auth-form`, `.text-link`, `.visually-hidden`). Use `.visually-hidden` to hide
  text — `display: none` / `visibility: hidden` remove it from the accessibility tree.
- **Components consume `var(--color-*)` and nothing else**; palette primitives must stay unreachable
  from an SFC.
- **Tokens come in coherent semantic sets**, consumed by real UI in the same change — never a
  one-off, never an unread value. Every `rem()` inside `_variables.scss` is interpolated:
  `--radius-md: #{rem(8)}`.
- **Breakpoints live in `_mixins.scss`, in `em`**: `$breakpoint-shell` (56.25em, the off-canvas
  sidebar, `below-shell`) and `$breakpoint-compact` (40em, one-step breadcrumb and bottom sheets,
  `below-compact`). Add one only for a real layout need, named for that layout.
- **Icons:** `@nuxt/icon` with Material Symbols outline-rounded names — **never text glyphs** (`×`,
  `+`, `✓`, `→`) as icons; icon buttons use `BaseButton`'s `icon` variant.

---

## 9. Adding a new field type

**Three modules — one per slice — and one line in each of three registries**, nothing else:

- **`prisma/schema.prisma`** — the `FieldType` member (+ migration)
- **`shared/field-types/<type>.ts`** — `IFieldTypeModule`: `label`, `multiValue`, `filter` (shape +
  empty), `value` (`base`, `listBase`, `blank`, `fromQuery`)
- **`server/db/field-types/<type>.ts`** — `IFieldSqlModule`: `sql` (`expr` · `filter` ·
  `searchPredicate` or `null` · `sortExpr` only if it orders differently · `sortJoin` only for a
  value in another row · **`filterIndex` and `sortIndex`**) and `multi`
- **`app/field-types/<type>/index.ts`** — `IAppFieldType`: `input`, `multiInput`, `filter`,
  `multiFilter`, `cell`, `summary`, `multiSummary`, `icon`, `align`, `configSummary` — plus **one**
  cell component beside it

Then a line in each `registry.ts` (shared, `server/db`, app), its value shape in
`IFilterValueByType` (`shared/types/filter.ts`), a zod branch in `shared/validation/field.ts` and
`FieldService.buildOptions` if it takes `options`, and a fixture in `test/fixtures.ts`.

- **The registries are the only files that enumerate the types**, and every map is a total
  `Record<TFieldType, …>` — a new member fails to compile until all three declare it. Never
  enumerate the types anywhere else.
- **The split is by bundle, never by concern** — a module with the schema and the SQL would ship
  Prisma to the browser (`docs/decisions.md`).
- **Indexability is declared**: the index kind follows how the type _compares_; `null` where nothing
  local can cover it. Nothing is indexed until a field opts in (`docs/architecture.md` §9).
- **Cardinality is per field** (`options.multiple`); `isMultiValue(field)` is its only reader, and
  each affected registry has a total `MULTI_*` override plus a resolver every consumer calls:
  `sqlFor`, `inputFor`, `filterFor`, `summaryFor`, `cellComponent`, `filterShapeFor`.
- **Inputs, filters and config summaries are data; only cells are components.** A control needing
  data beyond its own metadata gets a component in its type's folder (RELATION's picker is the only
  one).
- **No `switch`/`if` on field type** in pages, services or generic components. If a new type would
  need edits to `RecordForm`, `RecordsTable` or a service, fix the abstraction.

Registry contracts: `docs/architecture.md` §3.

---

## 10. Testing

**Changes to `shared/field-types/`, `shared/utils/`, `shared/validation/`, `server/services/`,
`server/db/`, `app/composables/`, `app/stores/` and `app/utils/` ship with tests; a change to
behaviour in `docs/architecture.md` §11 ships with an e2e one.** CI gates all four projects on every
push to `main`/`develop` and every PR.

### The four projects

`vitest.config.ts` declares **`unit` and `nuxt` only**, so `npm run test` never needs a database.
**A spec's project is decided by what it needs, not what it is:**

- **`unit`** — `{app,server,shared}/**/*.spec.ts`, `node`, aliases mirrored in `resolve.alias`;
  under a second.
- **`nuxt`** — `{app,shared}/**/*.nuxt.spec.ts`, the real app on happy-dom; a Nuxt build's startup.
- **`integration`** — `{server,shared}/**/*.integration.spec.ts`, `node` + real PostgreSQL;
  standalone config.
- **`e2e`** — `test/e2e/**/*.spec.ts`, Chromium against the production build; ~1 min.

**Default to `unit`** — Vue reactivity alone runs in `node` under an `effectScope`. Use `nuxt` only
for: anything importing `#imports` (every store, via `useApi()`); anything touching `document`,
`window`, focus or layout; anything whose **import graph** reaches a `.vue` file. Use `integration`
only for what a stub cannot answer (the SQL runs, a constraint fires, a lock holds, rules survive to
the endpoint), and `e2e` only for what a browser answers (§11's list).

### End-to-end

Chromium only, `workers: 1`, its own `flexbase_e2e` database.

- **The server is the built output started by `scripts/serve-output.mjs`** — never `nuxt preview` /
  `npm run preview`, which load the root `.env` (the development database; the suite truncates). Its
  import **must stay dynamic** (`docs/decisions.md`).
- **`test/disposable-database.ts` refuses any database not ending in `_test` or `_e2e`.** Never
  weaken it.
- **Selectors are roles and accessible names**, never `data-testid`. Two exceptions only — a
  decorative mirror of a name (`.base-select__value`) and structural reach (a column, a scroll
  container, geometry). When a role would help a _user_, fix the app (that is why the pager count
  and records empty state are `role="status"` — scope that one to `main`, or Nuxt's route announcer
  matches too). `BaseSelect`'s button is named _label + value_ ("Stage Won"), and its overlay is a
  **sibling**.
- **Assert the table through `expect.poll`**, never a bare read — rows refetch after the URL moves;
  wait on something the navigation must produce, not text already on screen.

### Integration

- **`flexbase_test`** on the same container; `global-setup.ts` refuses a name not ending `_test`,
  then runs `migrate deploy` (creating it). `INTEGRATION_DATABASE_URL` is the only override.
- The npm scripts start the database and install the browser — a stopped container makes Playwright
  report **zero tests run**.
- **`fileParallelism: false`** — one database.
- **Handlers are invoked directly** with a real `H3Event` (`test/integration/event.ts`, which sets
  `content-length` — without it every `readValidatedBody` is a 400). Only Nitro's routing is
  skipped.
- **One shim, `test/integration/nitro-runtime.ts`**, providing `useRuntimeConfig` — never grow it
  into a general Nitro stub.
- Rows are seeded through Prisma (`test/integration/seed.ts`), never through the services under
  test.

### Rules

- **Specs are colocated**, which puts them in `npm run typecheck`'s globs. `globals: false` — import
  `describe`/`it`/`expect` from `vitest`. Aliases as in source.
- **Field fixtures live in `test/fixtures.ts`** (`~~/test/fixtures`).
- **Mount through `~~/test/mount`, never `mountSuspended` directly, and never end a case with
  `wrapper.unmount()`** (`docs/decisions.md`).
- **Do not hand-stub what the Nuxt environment provides** — `registerEndpoint` for APIs,
  `mockNuxtImport` for `useRoute` and friends. Under `mountSuspended`, use
  `setActivePinia(useNuxtApp().$pinia as Pinia)` and clear its state between cases.
- **Unit tests are deterministic and offline** — no database, network, `Date.now`, randomness or
  filesystem.
- **A service reaching `prisma` is tested against `test/prisma-mock.ts`**
  (`vi.mock('#server/db/prisma', …)`) — `server/db/prisma.ts` builds a real client at load. The stub
  proves the code **around** a query (which guard fires, the `where` shape, query count — assert the
  argument, not only the outcome); **never that the query runs**.
- **Assert structure and behaviour, never computed styles** — `test.css` is `false`.
- **A spec file that outgrows its concern is split over one shared rig**
  (`BaseSelect/select-harness`); add a case to the file whose concern it is.

**Coverage is one report merged from two runs**; `.vitest-reports/` must contain nothing but the
blob files, and e2e contributes none (`docs/decisions.md`). **The SQL layer is verified twice,
deliberately**: `record-sql.spec.ts` pins `.text`/`.values`, `record-sql.integration.spec.ts` runs
them — the same split covers `widenToList` and the record counter.

**Two invariants live only in specs:** `MULTI_INPUTS` is non-null at exactly the types
`MULTI_VALUE_BY_TYPE` marks `true` (a mismatch keeps only the first value), and `MULTI_SQL` the same
(a widened field through the scalar projection never matches — probed via `ORDER BY`, since a
widened filter is list-shaped anyway). Other spec-pinned contracts: `docs/architecture.md` §10 and
`docs/decisions.md`.

---

## 11. Environment & tooling

`.env` at the repo root (copy `.env.example`): `DATABASE_URL` (the `docker-compose.yml` container,
`postgresql://flexbase:flexbase@localhost:5432/flexbase`) and `JWT_SECRET`
(`runtimeConfig.jwtSecret`).

- **npm**; `postinstall` runs `prisma generate && nuxt prepare`.
- **Prisma 7:** CLI config in `prisma.config.ts` (loads `.env` via `dotenv/config`); the client
  generates into `server/generated/prisma` (never edit) and needs `@prisma/adapter-pg`.
- **Prettier** (no semicolons, single quotes, 2 spaces, `printWidth` 100) formats code, SCSS, JSON
  and Markdown. **ESLint** is for code quality plus the `no-restricted-imports` boundaries.
- **`nuxt build` type-checks** (`typeCheck: 'build'`); `nuxt dev` does not — use
  `npm run typecheck`. Never edit the generated `.nuxt/` configs.
- `compatibilityDate` is pinned to `2025-07-15`. Modules: `@nuxt/eslint`, `@nuxt/icon`,
  `@pinia/nuxt`.
- Dependencies that look removable and are not — `h3`, `nitropack`, `ofetch`,
  `@iconify-json/material-symbols`, `@fontsource/*`, `@axe-core/playwright`, `tsx` (runs the seed,
  whose generated client has `.js` specifiers) — and `vue-router` / `@nuxt/fonts` deliberately
  absent: `docs/decisions.md` → _Tooling & module resolution_.

---

## 12. Documentation maintenance

These documents are a working reference for whoever changes the code next, loaded in full into an
agent's context, so every unnecessary sentence costs attention. **Less documentation, better
documentation** — this section included.

**Before adding anything, check it is not already written and that a reader needs it.** Elsewhere in
the docs → cross-reference; in the code → leave it there. One home per kind of information (the
routing at the top), never two.

**Never write:** running inventories (files, modules, specs, endpoints); changelogs or shipped
history; numbers that drift (test totals, coverage, counts); narrative (how a decision was reached);
the same rule twice.

**Prefer the short form:** a rule is a sentence; a decision is its rule, the failure if violated,
and the rejected alternative. Explain a _why_ only where the code cannot and an obvious cleanup
would break it. **When a change makes a passage wrong, rewrite or delete it** — never append a
correction.

**A pointer to a numbered section is a dependency.** Before moving or renumbering one, grep the repo
(docs, source comments, specs, migrations) for its old `§N` — a stale number still resolves, to the
wrong place. The same holds for a `decisions.md` → _Title_ reference when an entry is renamed.
