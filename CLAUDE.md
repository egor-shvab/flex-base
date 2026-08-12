# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

Three companion documents carry the detail this file deliberately omits. Read the relevant one before changing the area it covers:

- **`docs/roadmap.md`** — what is being built next and in what order. The source of truth for the current plan (§2).
- **`docs/architecture.md`** — how the metadata layer works: the field-type registries, record identity and record columns, relations, the filter/search wire format, the SQL layer, the data model, and a map of the key modules.
- **`docs/decisions.md`** — why it works that way: the rejected alternatives, the load-bearing constraints that must not be "cleaned up", and the **Accepted limitations** register.

---

## 1. Project & current phase

FlexBase is a full-stack **low-code platform** built with **Nuxt 4, Vue 3, TypeScript, Nitro, Prisma, and PostgreSQL**. Users build simple business applications **without writing code**: instead of a fixed CRM structure, they create their own tables, define custom fields, and manage records through dynamically generated interfaces.

Two rules are non-negotiable:

- **Metadata-driven** — forms, tables, and APIs are generated from configuration stored in the database, never from hardcoded business entities. Adding a table type requires no new frontend or backend code, and a new field type plugs into the registries without rewrites (§9).
- **Server-enforced ownership** — every resource belongs to one authenticated user, checked on the server for every request.

Two more that shape every change: **full TypeScript coverage**, with zod schemas shared between client and server; and **YAGNI** — build what the change needs, not what a future feature might, favouring clean architecture over short-term optimizations.

**Not in scope unless explicitly asked:** teams, workspaces, permissions, dashboards, activity history, workflows, automations, file uploads, import/export, third-party integrations. Do not build them speculatively — but the architecture **may** be shaped to accommodate them where doing so also improves the code that exists.

**Current phase — quality, UX, maintainability, polish.** The feature set is done; the work now is tests, accessibility, resilience, and consistency. The test suite is **built** — four projects, every layer gated (§10) — so it is a gate to keep passing, not work to schedule. Entries in `docs/decisions.md` → **Accepted limitations** marked **Open** are in scope; **Accepted** entries are not, unless a request says otherwise. One **Open** row is left and it is parked behind a stated trigger, so "Open" is now something to read the register for rather than a queue to work through.

---

## 2. Commands & definition of done

```bash
npm run dev          # start dev server at http://localhost:3000
npm run typecheck    # vue-tsc only (~7s) — the fast inner-loop type gate
npm run test          # vitest run — the unit + nuxt projects; no database, no browser
npm run test:unit     # the node project only (~1s) — the inner loop
npm run test:nuxt     # the Nuxt-environment project only
npm run test:integration # the integration project — runs `db:up` itself, then Vitest
npm run test:e2e      # Playwright over the production build — installs Chromium and runs `db:up` itself (~90s incl. build)
npm run test:e2e:ui   # the same, in Playwright's UI mode
npm run test:watch    # vitest in watch mode
npm run test:coverage # `db:up` + coverage:collect — the merged report, so it needs a database
npm run coverage:collect # unit+nuxt and integration, each to a blob, merged into one report
npm run build        # production build — also runs vue-tsc; a TS error fails the build (~30s)
npm run preview      # preview a production build locally
npm run lint         # eslint
npm run format       # format all files with Prettier
npm run format:check # check formatting without writing
npm run db:up        # docker compose up -d --wait (PostgreSQL 17, container flexbase-postgres)
npm run db:studio    # browse data in a GUI
```

```bash
npx prisma migrate dev --name <name>  # create & apply a migration
npx prisma generate                   # regenerate the client into server/generated/prisma (gitignored)
```

`typecheck` is the one to reach for while iterating: same `vue-tsc` errors as the build at a quarter of the time, and it never rewrites `.output`. Keep `build` as the pre-commit gate — it is the only step that exercises Vite/Nitro bundling, and its second step (`tsc -p test/e2e/tsconfig.json`) is the **only** thing checking the Playwright specs.

**In CI, call the tools rather than these scripts.** `test:integration`, `test:e2e` and `test:coverage` each begin with `db:up`, which is right on a developer machine and wrong on a runner that already has PostgreSQL on 5432. `.github/workflows/ci.yml` invokes `vitest`/`playwright`/`coverage:collect` directly for that reason.

PostgreSQL runs in Docker. Never use OSPanel's bundled modules.

### The roadmap

**`docs/roadmap.md` is the source of truth for the current development plan** — what is being worked on now, what comes next, in what order. Read it before starting a task. Mark a task `[x]` as soon as it is done, `[~]` while in progress. A task discovered mid-development is added to it, in the stage it belongs to; anything cancelled or superseded is deleted rather than kept "for the record" — that is what git history is for.

Scope discipline: the roadmap says _what_ and _in what order_. Contracts belong in `docs/architecture.md`, rationale in `docs/decisions.md`, rules here.

### Definition of done

A change is finished only when, in order:

1. `npm run format` has been run;
2. `npx eslint .` passes;
3. `npm run build` passes;
4. `npm run test` passes, with tests covering the changed logic added or updated (§10);
5. for any interactive or visual change: the keyboard path works and the focus ring is visible — both still a manual walk. Target size and the axe rules are gated by `npm run test:e2e` (§8);
6. the change has been verified working in the running app (dev server);
7. if the change knowingly leaves a limitation, it is recorded in `docs/decisions.md` → **Accepted limitations** — not only in a commit message;
8. documentation is updated **only where a rule, contract, or limitation changed**: this file for rules, `docs/architecture.md` for contracts, `docs/decisions.md` for rationale. Do not maintain a running inventory of files, specs or migrations — the codebase is the source of truth for what exists;
9. `docs/roadmap.md` reflects reality — the task is marked `[x]`, and anything the work revealed or made obsolete is added, updated, or removed.

---

## 3. Directory structure

```
app/                         # Nuxt 4 frontend (client)
  assets/scss/               # global SCSS (main.scss + partials, incl. _mixins.scss)
  components/
    app/                     # the shell — AppSidebar, AppBreadcrumbs
    common/                  # generic UI atoms, all `Base*`
    modals/                  # dialogs built on BaseModal
    records/                 # the metadata renderers — DynamicForm, DynamicTable, the filter panel & summary
  field-types/               # EVERYTHING per-field-type: the input/filter/cell registries + the cell components
  composables/               # useApi, useForm, useDeleteConfirm, … (imported explicitly — see §4)
  layouts/                   # default + auth layouts
  middleware/                # route guards (auth)
  pages/                     # file-based routing
    tables/[tableId]/records/  # dynamic table & record views
  stores/                    # Pinia stores (auth, tables, fields, records, relations)
server/                      # Nitro backend
  api/                       # HTTP route handlers (thin: parse → check ownership → call service)
  middleware/                # server middleware (attach authenticated user to event.context)
  services/                  # generic, framework-agnostic business logic
  utils/                     # prisma singleton, auth helpers, ownership assertions
  generated/prisma/          # generated Prisma client (gitignored — never edit by hand)
shared/                      # code used by BOTH client & server — one rule per folder
  types/                     # type & interface declarations ONLY (zero runtime exports)
  constants/                 # the runtime constant registries
  utils/                     # generic framework-free helpers
  validation/                # zod schemas and nothing else
prisma/migrations/           # Prisma migration history
test/                        # fixtures, mount/prisma helpers, the integration and e2e suites
docs/                        # roadmap.md, architecture.md, decisions.md + the design concept
public/                      # static assets
```

`shared/` is four layers with a strict dependency order — `types` → `constants` → `utils` → `validation`, each importing only from layers above it. A helper that fits none of `types`/`constants`/`validation` belongs in `utils/`, not in whichever folder is nearest.

---

## 4. Imports

**Components are auto-imported; everything else is imported explicitly.** `nuxt.config.ts` sets `imports: { autoImport: false }` and `nitro: { imports: { autoImport: false } }`, so a missing import is a `vue-tsc` error at build time rather than a silently resolved global.

Import each symbol from:

| Symbol                                                                                                                                             | Import from                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `ref`, `shallowRef`, `computed`, `reactive`, `watch`, `markRaw`, `useId`, lifecycle hooks                                                          | `vue`                                                 |
| `useRoute`, `useAsyncData`, `useSeoMeta`, `useHead`, `navigateTo`, `createError`, `useRequestFetch`, `definePageMeta`, `defineNuxtRouteMiddleware` | `#imports`                                            |
| `defineStore`                                                                                                                                      | `pinia`                                               |
| a component referenced from **script** rather than a template (e.g. `NuxtLink` behind `<component :is>`)                                           | `#components`                                         |
| `defineEventHandler`, `getRouterParam`, `readValidatedBody`, `getValidatedQuery`, `createError`, cookie helpers                                    | `h3`                                                  |
| `useRuntimeConfig` (server)                                                                                                                        | `nitropack/runtime`                                   |
| project code                                                                                                                                       | `~/*` (app), `#server/*` (server), `#shared/*` (both) |

- **Imports are always aliased — never relative.** `./`, `../` and `../../` are a lint error under `app/`, `server/` and `shared/`. Use `~/field-types/types`, not `./types`; `#server/utils/auth`, not `../../../../utils/auth`.
- **`#server` is server-only.** The Vue layer reaches the server through `$fetch`/`useApi()`, never by importing it. Put anything both layers need in `shared/`.
- **Server code must not import from `#imports`** — use `h3` and `nitropack/runtime` by name.

Rationale for all three: `docs/decisions.md`.

---

## 5. API conventions

- Route files are named by HTTP method suffix under `server/api/`: `index.get.ts`, `index.post.ts`, `[tableId].patch.ts`, `[tableId].delete.ts`, …
- Handlers stay thin: validate input with the shared zod schema from `shared/validation/` → assert ownership via the `server/utils/` helpers → delegate all business logic to `server/services/`.
- Validate request bodies with `readValidatedBody(event, schema.parse)` — invalid input automatically becomes a 400 carrying the zod issue details.
- Throw errors with Nitro's `createError({ statusCode, statusMessage })`; never return password hashes or another user's data.
- **Ownership lives in the query, not around it:** scope every Prisma query on owned data inside the `where` clause (`where: { id: tableId, userId }`, or a relation filter through `table` for fields/records) — never fetch first and check ownership afterwards. Go through the `server/utils/ownership.ts` helpers.
- **Status codes:** a resource that exists but belongs to another user returns **404, never 403**. 401 comes only from `requireUser(event)`; 409 for uniqueness conflicts (duplicate email, duplicate table name, duplicate field key); login failures always return the same generic 401 regardless of which credential was wrong.
- `User` rows are always read with an explicit `select` (`id`, `email`) so `passwordHash` can never leak into a response.
- Read secrets via `useRuntimeConfig(event)` — never `process.env` (sole exception: the Prisma singleton in `server/utils/prisma.ts`).
- Record lists are **always paginated server-side** (`take`/`skip`, default 50, hard cap 100). An endpoint must never return an unbounded table.
- **No queries in loops:** batch with `findMany` + `where: { id: { in: […] } }`, `createMany`, or a relation `include`. Relation-label resolution is the case to watch.
- `select` only the columns a response needs. New query patterns must check existing `@@index` coverage first.
- No `console.log` in committed code; errors are surfaced with `createError`, not logged and swallowed.

**Migrations are non-destructive.** A new required column is added nullable → backfilled → set `NOT NULL`; `prisma migrate dev` cannot generate that and refuses the diff, so use `--create-only` and edit the SQL. Never drop or retype a column holding user data without an explicit migration plan.

---

## 6. Code quality standards

- **SRP** — each component, composable, or server utility has one reason to change. No "god" files.
- **OCP / DIP** — extend through the registries and shared interfaces rather than editing generic code; depend on types, not concretions.
- **ISP** — keep interfaces lean and specific.
- **DRY, with a hard trigger:** when the same logic (a validation block, an error mapping, a `watch`, a fetch pattern, a Prisma constraint→HTTP mapping) appears a **second** time, extract it before continuing — into a composable (`app/composables/`), a util (`app/utils/`, `server/utils/`, `shared/utils/`), or a server service. Never leave duplication "for now".
- **KISS** — readable and straightforward over clever. Do not over-engineer.
- **Self-documenting names** (`fetchProductDetails`, not `getData`). Comment the _why_, not the _what_; use TSDoc for non-obvious business logic.
- **`any` is forbidden.** Use explicit interfaces, generics, or `unknown` with type guards.
- **Type naming:** project interfaces are prefixed `I` (`IAuthUser`), project type aliases `T` (`TFieldType`). Everywhere — `shared/types/`, component-local, server. External and generated types (h3 augmentations, Prisma models, library types) keep their original names.

---

## 7. Frontend conventions

- Pinia stores are **setup-style** (`defineStore('x', () => { … })`); state is refs mutated only inside that store's actions.
- Components are PascalCase; generic atoms in `app/components/common/` carry the `Base` prefix.
- Props and emits are typed via generics — `defineProps<{ … }>()` / `defineEmits<{ … }>()`; no runtime prop declarations.
- DTO/request types are derived with `z.infer` from the shared zod schemas — never hand-write a parallel interface that can drift.
- Data fetching chain: page/component → `useAsyncData`/store action → `useApi()`. **Never bare `$fetch`** — it drops cookies during SSR. Surface request errors with `getApiErrorMessage`.
- Forms use the `useForm` composable — reactive fields, per-field zod errors that clear on edit, form-level server error, `pending`, `submit`, `reset`.
- Deleting anything from a list page goes through `useDeleteConfirm`, not a hand-rolled pending flag.
- A popover goes through `usePopover` (+ `useAnchoredPosition` where it must escape a clipping ancestor), never a hand-rolled open/outside-click/focus-restore trio.
- **A popover swallows Escape only while it has something open.** `BaseModal` owns the sole `document` listener, so one keypress must never close both. Two spellings, and the difference matters: `@keydown.esc.stop` on the panel where focus lives inside it; the key handled in JS with `stopPropagation()` guarded on `open` where the control keeps focus **outside** its panel (a combobox), since an unconditional modifier there would make a _closed_ control eat the surrounding dialog's Escape. See `docs/decisions.md`.
- **Every async surface states its condition.** Loading, empty, and error are distinct states with distinct copy — never infer "empty" from "unknown". A failed fetch is visible (banner + retry), never a silently stale view.
- **Never ship a dead control.** A visible input or button that cannot do anything yet is worse than its absence.

### Performance

- **`shallowRef`** for large fetched collections replaced wholesale (record lists, field lists); a refetch assigns a new array. Plain `ref` stays the default for small UI state.
- Keep the field-type registries **`markRaw`ped module constants** so Vue never deep-proxies component objects.
- **Lazy-load** heavy, conditionally rendered components with the `Lazy` prefix (`<LazyBaseModal v-if="open">`); pages are already auto-split per route.
- `v-for` is always keyed by a stable id (`record.id`, `field.key`) — never the index. `v-show` for frequently toggled, `v-if` for rarely shown or expensive.
- Derive state with `computed`, don't sync it with watchers; never deep-`watch` large arrays/objects.
- **Debounce** user-driven query inputs ~300 ms before hitting the API (`useDebouncedModel`).
- Fetch page data through `useAsyncData` with an explicit key so the SSR result transfers in the payload; never re-fetch in `onMounted` what SSR already loaded. A layout and a page must never share a key.
- Render real images via `<NuxtImg>`, not raw `<img>`.

These rules target collections that grow with user data. Static UI — auth pages, layout chrome — does not warrant `shallowRef`/lazy machinery; KISS wins there.

---

## 8. Styling & design

All styles are **SCSS**, never plain CSS. Global styles live in `app/assets/scss/main.scss`; component styles go in `<style lang="scss" scoped>`.

### Design principles

A deliberately plain, familiar office-app look for a largely non-technical audience: **16px base, 36px control height, 8px control radius, a single accent blue (`#1C64D8`), two shadows, borders doing the structural work.** New UI matches that register; it is not a blank canvas. `docs/concept-d-workspace.html` is the visual reference — where code and concept disagree, propose a concept update rather than changing code to match.

### Accessibility target: WCAG 2.2 AA

Two halves are machine-checked by `npm run test:e2e`: an **axe** pass over the WCAG A/AA rules, failing on `serious` and `critical`, and the target-size floor below. Neither replaces the keyboard walk in step 5 of the definition of done — axe cannot tell whether a focus order makes sense — but both catch what a walk misses because nothing on screen looks different.

- Every interactive element is keyboard-operable and has a visible `:focus-visible` ring. **Focus is never removed, only restyled** — `_reset.scss` carries a zero-specificity baseline so nothing can end up with no ring; components override it with the `focus-ring` mixin (`outline`, not `box-shadow`, so an ancestor's `overflow` cannot clip it).
- Minimum target size **24×24** — SC 2.5.8, the AA requirement. The house floor is `--control-height` (**36px**), which every sized control including icon-only buttons meets; nothing may go below 24. A content-sized control needs **both** axes floored, because a short label ("Edit" is 23px) is narrow however tall it is. 44×44 is SC 2.5.5, which is **AAA** — do not quote it as the AA bar.
- The gate lives in `test/e2e/accessibility.spec.ts` + `test/e2e/setup/a11y.ts`, which encode three real SC 2.5.8 exceptions (the _Inline_ exception for `.text-link`, an `<input>` whose wrapping `<label>` is the actual target, and anything not rendered). **Do not add a fourth to make a failure go away.**
- Text contrast ≥ 4.5:1; control outlines and other non-text UI ≥ 3:1 (this is why `--color-border-control` is a separate token from `--color-border-strong`).
- Dialogs and off-canvas surfaces are `inert`-guarded and must never leave focusable content off-screen — `visibility: hidden`, not translation alone.

### Rules

- **BEM** (`Block__Element--Modifier`) for class names.
- **Sizes in rem via the `rem()` helper** (16px base): `font-size: rem(14)`, `padding: rem(10) rem(12)`. Plain `px` is reserved for hairline borders and box-shadow offsets/blur.
- **`functions` and `mixins` reach every SFC `<style>` block and entry file automatically** (Vite `additionalData`). They do **not** reach a transitively `@use`d partial — a standalone partial like `_auth-form.scss` must `@use` both itself, and `main.scss` must **not** re-`@use` either.
- Use SCSS **nesting with `&`**; never duplicate a parent selector that could be nested.
- **Reuse before you paste.** A declaration block that would be a second copy belongs in `_mixins.scss` — check the list there first. A block with no per-site variation is a **class** in its own partial instead (`.auth-form`, `.text-link`, `.visually-hidden`), `@use`d from `main.scss`. `.visually-hidden` is the one to reach for rather than reinvent: it clips rather than hiding, because `display: none` and `visibility: hidden` both take an element out of the accessibility tree — which would silence the live region it exists for.
- **Components consume `var(--color-*)` and nothing else.** The palette primitives (`$gray-200`, `$blue-600`) are unreachable from an SFC by construction, and it must stay that way.
- **Tokens are added as coherent sets, not one-offs.** A new token must be semantic (name the role, not the value), belong to an existing ramp or establish a complete one, and be consumed by real UI in the same change. Never add a value to `_variables.scss` that no component reads.
- **Sass parses custom-property values literally** — every `rem()` in `_variables.scss` must be interpolated: `--radius-md: #{rem(8)}`.
- **Breakpoints live in `_mixins.scss`**, never `_variables.scss` (a media query cannot read a custom property), and are written in `em`. There is currently one — `$breakpoint-shell: 56.25em` (900px) + the `below-shell` mixin. Add another only for a real layout need, and name it for the layout it governs.
- **Icons:** use `@nuxt/icon` (`<Icon name="mdi:close" />`) for all iconography — **never text glyphs** (`×`, `+`, `✓`, `→`) as icons. For icon buttons use `BaseButton`'s `icon` prop.

```scss
.card {
  display: flex;

  &__header {
    padding: rem(16);
  }

  &--active {
    border-color: var(--color-accent);
  }

  &:hover {
    box-shadow: var(--shadow-md);
  }
}
```

The token inventory, the mixin list, the partial layout, and the `BaseButton` variant contract are documented in `docs/architecture.md` §11.

---

## 9. Adding a new field type

A new field type touches exactly these places — and nothing else:

1. The `FieldType` enum in `prisma/schema.prisma` (+ migration).
2. `FIELD_TYPES` + `FIELD_TYPE_LABELS` in `shared/constants/field.ts`. `TFieldType` derives from it.
3. `shared/validation/field.ts` — one zod branch for its `options` (plus the matching branch in `buildOptions`, `server/services/fields.ts`, if it stores options); `shared/validation/record.ts` — one `VALUE_SCHEMA_BY_TYPE` entry (`base` schema + `blank` value + `fromQuery` decoder).
4. `shared/constants/filter.ts` — one `FILTER_VALUE_BY_TYPE` entry (`shape`: `scalar`/`list`/`range`, and `empty` value), plus its shape in `IFilterValueByType` (`shared/types/filter.ts`).
5. `app/field-types/` — one entry each in `FIELD_INPUTS`, `FIELD_FILTERS`, `FIELD_CELLS`, `FILTER_SUMMARIES`, plus **one** cell component in `cells/`.
6. `server/services/record-query.ts` — one `FIELD_SQL_BY_TYPE` entry: its SQL projection (`expr`), how that projection is compared (`filter`), how free-text search matches it (`searchPredicate`, `null` to opt out), and `sortExpr` only if it orders differently from how it filters.
7. `MULTI_VALUE_BY_TYPE` in `shared/constants/field.ts` — `true` only if the type has a list form. If it does, one entry in each `MULTI_*` override table (`MULTI_SQL`, `MULTI_INPUTS`, `MULTI_FILTERS`, `MULTI_SUMMARIES`); if it does not, `null` in each.

Every one of these registries is a total `Record<TFieldType, …>`, so adding an enum member is a compile error until all of them exist.

**Cardinality is a second axis, and it is per-field, not per-type.** `options.multiple` makes a SELECT or a RELATION hold a list; `MULTI_VALUE_BY_TYPE` says which types may, and `isMultiValue(field)` (`shared/utils/field.ts`) is the only reader. Each affected registry keeps its flat per-type entries and gains a `MULTI_*` override table — also total — plus one resolver every consumer calls instead of indexing: `sqlFor`, `inputFor`, `filterFor`, `summaryFor`, `cellComponent`, `filterShapeFor`. So a new type must still declare its position on multi-value, and no component branches on the flag.

**Inputs and filters are data, not components** — each is an `IFieldControl` naming a `Base*` control, a `props(field)` factory, and the adapters between that control's model and the field's value. Only cells are components. A type whose control needs data beyond its own metadata gets a component in `field-types/controls/` (RELATION is the only one today).

**No scattered `switch`/`if` chains on field type** in pages, services, or generic components. If adding a type would require editing `DynamicForm`, `DynamicTable`, or a service, the abstraction is broken — fix the abstraction instead of special-casing.

Full contracts for each registry: `docs/architecture.md` §3.

---

## 10. Testing

**Step 4 of the definition of done is binding.** Changes to `shared/utils/`, `shared/validation/`, `server/services/`, `app/composables/`, `app/stores/` and `app/utils/` ship with tests; a change to behaviour listed in `docs/architecture.md` §12 ships with an end-to-end one. `.github/workflows/ci.yml` runs three jobs on every push to `main`/`develop` and on every PR: `format:check` → `lint` → `typecheck` → `test` → `build`; an **integration** job with a PostgreSQL service container; and an **e2e** job that additionally installs Chromium and builds the app.

### The four projects

`vitest.config.ts` is a thin root declaring `test.projects` — **`unit` and `nuxt` only**, so `npm run test` never wants a database. `integration` is a standalone config run by its own script. **Which project a spec lands in is decided by what it needs, not by what it is:**

|              | `unit` — `vitest.unit.config.ts`                             | `nuxt` — `vitest.nuxt.config.ts` | `integration` — `vitest.integration.config.ts` | `e2e` — `playwright.config.ts`  |
| ------------ | ------------------------------------------------------------ | -------------------------------- | ---------------------------------------------- | ------------------------------- |
| Files        | `{app,server,shared}/**/*.spec.ts`                           | `{app,shared}/**/*.nuxt.spec.ts` | `{server,shared}/**/*.integration.spec.ts`     | `test/e2e/**/*.spec.ts`         |
| Environment  | `node`, no DOM                                               | `nuxt` (real app) on happy-dom   | `node` + real PostgreSQL                       | Chromium + the production build |
| Aliases from | the `resolve.alias` block, mirroring `.nuxt/tsconfig.*.json` | Nuxt itself                      | the same block, plus one shim                  | `test/e2e/tsconfig.json`        |
| Cost         | under a second                                               | a Nuxt build's worth of startup  | a database round trip per case                 | a Nuxt build, then ~1 min       |
| Run alone    | `npm run test:unit`                                          | `npm run test:nuxt`              | `npm run test:integration`                     | `npm run test:e2e`              |

**Default to `unit`.** Vue reactivity alone does not earn the Nuxt project: `vue` is a plain dependency, so a composable built from `ref`/`watch`/`computed` is testable in `node` with an `effectScope` and nothing else. Reach for `*.nuxt.spec.ts` only for what genuinely cannot run otherwise:

- anything importing `#imports` — every Pinia store does, through `useApi()` at setup time;
- anything touching `document`, `window`, focus or layout;
- anything importing a `.vue` file, which the node project has no Vue plugin for. **What decides the project is the import graph, not what the spec does** — a pure module that imports an SFC belongs to `nuxt` even if it mounts nothing.

**Reach for `integration` only for what a stub cannot answer** — that the SQL executes, that a constraint fires, that a lock holds, that the rules survive out to the endpoint. It is not the place to re-test logic the fast projects already cover.

**Reach for `e2e` only for what a browser answers** — first paint, history, focus, keyboard, paint. Its list is `docs/architecture.md` §12 and nothing else; a case that would pass in happy-dom belongs three projects down, where it runs in a second instead of a minute.

### The end-to-end project

Chromium only, `workers: 1`, its own `flexbase_e2e` database. Three things are load-bearing:

- **The server is the built output, started by `scripts/serve-output.mjs`.** Never `nuxt preview`, and never `npm run preview`: both load the root `.env`, which points at the **development** database, and the suite truncates between cases. The launcher also works around a Windows-only crash whose fix is one dynamic import — **making it static reintroduces the bug** (`docs/decisions.md`).
- **One guard for both disposable databases.** `test/disposable-database.ts` refuses any name not ending in `_test` or `_e2e`, and both suites call it before writing. Never weaken it.
- **Selectors are roles and accessible names**, never `data-testid` — the app labels everything already, so a spec that breaks because a label changed is reporting something real. Note that `BaseSelect`'s non-searchable trigger is a `<button>` whose accessible name is _label + value_ ("Stage Won"), and its value overlay is a **sibling** of that button rather than a child.

  **Two exceptions, and only two** — a decorative mirror of an accessible name (`.base-select__value`, which giving a role would announce twice), and structural reach (reading a column, driving a scroll container, measuring geometry). Do not "fix" a selector that falls under one, and do not add a third without the same test: would a role here help a _user_? When a surface _would_ benefit, the fix is the app, not the spec — that is why the pager count and the records empty state are `role="status"`. **Scope that one to `main`**, or Nuxt's own route announcer matches too and fails strict mode.

**Assert the table through `expect.poll`, never a bare read.** A URL assertion resolves the moment the address bar moves, but the rows behind it refetch asynchronously. The same trap has a subtler form: waiting on text that is _already_ on screen proves nothing — wait on something the navigation must produce.

### The integration project

Five things make it work, and each is load-bearing:

- **A separate database.** `flexbase_test` on the same container, because the suite `TRUNCATE`s every table between cases. `test/integration/global-setup.ts` **refuses to start** unless the name ends in `_test`, then runs `prisma migrate deploy` — which creates the database if it does not exist, so nothing has to be provisioned by hand. `INTEGRATION_DATABASE_URL` is the only override.
- **The npm script provisions the database and the browser** (§2), because neither is discoverable from `npm ci` and both fail misleadingly — a stopped container makes Playwright report **zero tests run**, which reads as a broken suite.
- **`fileParallelism: false`.** One database, so files may not run against it at once.
- **Handlers invoked directly**, with a real `H3Event` built by `test/integration/event.ts` — `requireUser` → ownership → zod → service all run for real, and only Nitro's routing is skipped. Note the helper sets `content-length`: without it h3 returns an empty body without reading the stream, and every `readValidatedBody` becomes a confusing 400.
- **One shim, `test/integration/nitro-runtime.ts`.** `nitropack/runtime` cannot be imported outside a Nitro build. The shim provides `useRuntimeConfig` returning `jwtSecret` from the environment, so the auth endpoints and the server middleware can be loaded at all; do not grow it into a general Nitro stub.

Rows are seeded through Prisma (`test/integration/seed.ts`), not through the services, so a spec about `createRecord` is not seeded by `createRecord`.

### Rules

- **Specs are colocated** — each sits beside its source. That is what puts them inside the `include` globs Nuxt generates, so `npm run typecheck` checks them too.
- **`globals: false` in both projects.** Every spec imports `{ describe, it, expect } from 'vitest'`, matching the project's `autoImport: false` doctrine — and required regardless, since the generated tsconfigs set `types: []`.
- **Imports are aliased in a spec exactly as in source** (`~/…`, `#shared/…`, `#server/…`); `no-restricted-imports` applies to specs too.
- **Field fixtures live in `test/fixtures.ts`**, reached as `~~/test/fixtures`. Add a builder there rather than restating an `IField` in a second spec.
- **Mount through `~~/test/mount`, never `mountSuspended` directly.** `mountTracked` registers the wrapper and `afterEach(unmountAll)` tears it down, so no spec ends a case with `wrapper.unmount()`. This is not tidiness: a case that _fails_ skips its own trailing unmount, and a composable leaked a window listener into the next case exactly that way. `track()` is the same seam for a plain `@vue/test-utils` host.
- **Do not hand-stub what the Nuxt environment already provides** — `defineVitestConfig` boots the real app from `nuxt.config.ts`, so a stub is a second source of truth able to drift. In particular: `registerEndpoint` for an API a store calls, `mockNuxtImport` for `useRoute` and friends, `mountSuspended` for a component.
- **A mounted component reads the Nuxt app's pinia, not a spec's.** `setActivePinia(createPinia())` is right for a store tested directly and wrong under `mountSuspended` — use `setActivePinia(useNuxtApp().$pinia as Pinia)` and clear the state it carries between cases.
- **A unit test must be deterministic and offline:** no database, no network, no `Date.now`, no randomness, no filesystem. `server/services/record-query.ts` is testable precisely because it only _builds_ `Prisma.Sql` — assert on `.text` and `.values`, never execute.
- **A service that reaches the `prisma` client is tested against the stub in `test/prisma-mock.ts`**, wired per spec with `vi.mock('#server/utils/prisma', …)`. Not a preference — `server/utils/prisma.ts` constructs a real client at module load. **What the stub may prove is the code _around_ a query** — which guard fires, what shape a `where` clause is built in, how many queries are issued (assert on the argument, not only the outcome: a fetch-then-compare rewrite would still return the right value while losing the §5 property). **What it never proves is that the query runs.** That half is the integration suite's.
- **Assert on structure and behaviour, never on computed styles.** Vitest's `test.css` stays `false`, so SCSS is stubbed rather than compiled; a component spec that reads a colour is testing nothing.
- **A spec file that has grown past its concern is split over one shared rig**, not grown further — `BaseSelect` is four files over `~~/test/select-harness`. Add a case to the file whose concern it belongs to.

**Coverage is one report merged from two runs**, because `server/api/` and `server/middleware/` are reachable only from the `integration` project, which stays out of `npm run test`. `npm run coverage:collect` writes a blob per run into `.vitest-reports/` and merges them. The constraints that hold it together are in `docs/decisions.md`; the one to remember is that **`.vitest-reports/` must contain nothing but the blob files**. **`e2e` contributes no coverage** — it drives a built server, not an instrumented one.

**The SQL layer is verified twice, deliberately.** `record-query.spec.ts` asserts on `.text` and `.values` without a connection; `record-query.integration.spec.ts` runs the same builder against PostgreSQL and looks at which rows come back. Neither replaces the other — the first pins the shape and catches a change in intent, the second is the only thing that would catch a fragment the database rejects. The same split covers `widenToList` and the record counter (one transaction, vs. concurrent creates getting distinct numbers).

Contracts the specs pin that are **invisible in the browser when broken**, and must not be "simplified" away, are documented where they belong — the renderer and store contracts in `docs/architecture.md` §10, the component and query-layer ones in `docs/decisions.md`. Two structural invariants live only in the specs, because they span files no type can join: **`MULTI_INPUTS` must be non-null at exactly the types `MULTI_VALUE_BY_TYPE` marks `true`** (a mismatch silently drops every value but the first), and **`MULTI_SQL` carries the same invariant** (a widened field routed through the scalar projection compares a JSON array against a scalar and simply never matches — nothing errors, the table just comes back empty). The second is probed through `ORDER BY` rather than `WHERE`, because a widened field's filter is list-shaped whatever its type declares.

---

## 11. Environment & tooling

Configuration lives in a gitignored `.env` at the repo root (copy `.env.example`):

- `DATABASE_URL` — PostgreSQL connection string; points at the `docker-compose.yml` container (`postgresql://flexbase:flexbase@localhost:5432/flexbase`).
- `JWT_SECRET` — secret for signing auth JWTs; exposed to Nitro via `runtimeConfig.jwtSecret`.

- **Package manager:** npm (`package-lock.json`). `postinstall` runs `prisma generate && nuxt prepare`, regenerating the Prisma client and the `.nuxt/` configs.
- **Prisma 7:** CLI configuration lives in `prisma.config.ts`, which loads `.env` via `dotenv/config` (Prisma 7 no longer reads `.env` itself). The client is generated by the `prisma-client` provider into `server/generated/prisma` and requires the `@prisma/adapter-pg` driver adapter at runtime.
- **Prettier** (`.prettierrc`: no semicolons, single quotes, 2-space indent, `printWidth` 100) formats `.vue`, `.ts`, `.js`, `.scss`, `.json`, `.md` — including `<style lang="scss">` blocks. **ESLint** handles code quality only, with one project rule: `no-restricted-imports` banning relative paths under `app/`, `server/`, `shared/`.
- **Type checking:** `typescript.typeCheck: 'build'` makes `nuxt build` run `vue-tsc` and fail on any type error, `.vue` templates included. `nuxt dev` does **not** type-check — use `npm run typecheck`.
- `tsconfig.json` references the project configs generated into `.nuxt/` by `nuxt prepare`. Do not edit those directly.
- `compatibilityDate` is pinned to `2025-07-15`.
- Modules: `@nuxt/eslint`, `@nuxt/icon`, `@nuxt/image`, `@pinia/nuxt`.
- Direct dependencies that exist for a reason: `h3` and `nitropack` (server code imports them by name — keep versions in step with Nuxt's), `ofetch` (`app/utils/api-error.ts` imports `FetchError` by name), `@iconify-json/mdi` (nothing imports it — `@nuxt/icon` detects it and serves `mdi` from disk; without it every icon is a runtime fetch of `api.iconify.design`), `@axe-core/playwright` (the accessibility gate; dev-only, and it injects axe into the page rather than shipping in the bundle). `vue-router` is deliberately **not** declared. `@nuxt/fonts` was removed; do not re-add it until a real webfont exists. See `docs/decisions.md`.
