# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

Three companion documents carry the detail this file deliberately omits. Read the relevant one before changing the area it covers:

- **`docs/roadmap.md`** — what is being built next, in what order, and what is already done. The source of truth for the current plan (§2).
- **`docs/architecture.md`** — how the metadata layer works: the field-type registries, record identity and record columns, relations, the filter/search wire format, the SQL layer, the data model, and a map of the key modules.
- **`docs/decisions.md`** — why it works that way: the rejected alternatives, the load-bearing constraints that must not be "cleaned up", and the **Accepted limitations** register.

---

## 1. Project & current phase

FlexBase is a full-stack **low-code platform** built with **Nuxt 4, Vue 3, TypeScript, Nitro, Prisma, and PostgreSQL**. Users build simple business applications **without writing code**: instead of a fixed CRM structure, they create their own tables, define custom fields, and manage records through dynamically generated interfaces.

Two rules are non-negotiable:

- **Metadata-driven** — forms, tables, and APIs are generated from configuration stored in the database, never from hardcoded business entities.
- **Server-enforced ownership** — every resource belongs to one authenticated user, checked on the server for every request.

**Shipped and complete:** registration and authentication, per-user isolation, custom tables, typed custom fields, full record CRUD, generated forms and tables, metadata-derived validation, filtering, sorting, table-scoped search, relations between tables, and the record's own columns (`Record #`, `Created at`, `Updated at`).

**Not in scope unless explicitly asked:** teams, workspaces, permissions, dashboards, activity history, workflows, automations, file uploads, import/export, third-party integrations. Do not build them speculatively — but the architecture **may** now be shaped to accommodate them where doing so also improves the code that exists.

**Current phase — quality, UX, maintainability, polish.** The feature set is done; the work now is tests, accessibility, resilience, and consistency. Two consequences:

- Adding a test suite is current work, not deferred (§10).
- Entries in `docs/decisions.md` → **Accepted limitations** marked **Open** are in scope; entries marked **Accepted** are not, unless the request says otherwise.

### Core principles

- **Metadata-driven architecture** — behavior described by data; no hardcoded business entities, pages, or components.
- **Dynamic UI generation** — forms and tables are generated from field definitions, input components are selected by field type, validation rules are derived from metadata.
- **Generic, reusable code** — adding a new table type requires no new frontend or backend code.
- **Extensible field system** — new field types plug in without rewrites (§9).
- **Full TypeScript coverage** — with zod schemas shared between client and server.
- **YAGNI** — build what the change needs, not what a future feature might. Favor clean architecture and maintainability over short-term optimizations.

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

`typecheck` is the one to reach for while iterating: same `vue-tsc` errors as the build at a quarter of the time, and it never rewrites `.output`. Keep `build` as the pre-commit gate — it is the only step that exercises Vite/Nitro bundling. It runs in two steps: `nuxt typecheck` over the four generated projects, then `tsc -p test/e2e/tsconfig.json`, which is the **only** thing checking the Playwright specs — no generated project claims them and Playwright transpiles without checking.

**In CI, call the tools rather than these scripts.** `test:integration`, `test:e2e` and `test:coverage` each begin with `db:up`, which is right on a developer machine and wrong on a runner that already has a PostgreSQL service container on 5432 — the second bind fails before a test runs. `.github/workflows/ci.yml` invokes `vitest`/`playwright`/`coverage:collect` directly for that reason.

PostgreSQL runs in Docker. Never use OSPanel's bundled modules.

### The roadmap

**`docs/roadmap.md` is the source of truth for the current development plan.** It is not optional reading and it is not a changelog — it states what is being worked on now, what comes next, and in what order.

- **Read it before starting a new task**, to see where that task sits and what it depends on.
- **Mark a task `[x]` as soon as it is done** (by the definition below), `[~]` while it is in progress, `[ ]` until then.
- **A necessary task discovered mid-development is added to the roadmap**, in the stage it belongs to — not left in a commit message or in conversation.
- **When the task changes or new requirements arrive, update the roadmap to match.** A plan that disagrees with what is being built is worse than no plan.
- **Delete or replace anything cancelled, superseded, or no longer relevant.** No duplicates, no stale entries, no tasks kept "for the record" — that is what git history is for.
- Keep it current for the rest of the project, not just this phase.

Scope discipline: the roadmap says _what_ and _in what order_. Contracts belong in `docs/architecture.md`, rationale in `docs/decisions.md`, rules here. Do not let it grow into a specification.

### Definition of done

A change is finished only when, in order:

1. `npm run format` has been run;
2. `npx eslint .` passes;
3. `npm run build` passes;
4. `npm run test` passes, with tests covering the changed logic added or updated (§10);
5. for any interactive or visual change: the keyboard path works, the focus ring is visible, and every target is at least `--control-height` (never below the 24×24 WCAG floor);
6. the change has been verified working in the running app (dev server);
7. if the change knowingly leaves a limitation, it is recorded in `docs/decisions.md` → **Accepted limitations** — not only in a commit message;
8. documentation is updated **only where a rule, contract, or limitation changed**: this file for rules, `docs/architecture.md` for contracts, `docs/decisions.md` for rationale. Do not maintain a running inventory of files here — the codebase is the source of truth for what exists;
9. `docs/roadmap.md` reflects reality — the task is marked `[x]`, and anything the work revealed, changed, or made obsolete is added, updated, or removed.

---

## 3. Directory structure

```
app/                         # Nuxt 4 frontend (client)
  assets/scss/               # global SCSS (main.scss + partials, incl. _mixins.scss)
  components/
    app/                     # the shell — AppSidebar, AppBreadcrumbs
    common/                  # generic UI atoms, all `Base*` (buttons, inputs, modal, range, …)
    modals/                  # dialogs built on BaseModal — ConfirmModal (universal), the form modals
    records/                 # the metadata renderers — DynamicForm, DynamicTable, the filter panel & summary
  field-types/               # EVERYTHING per-field-type: the input/filter/cell registries + the cell components
  composables/               # useApi, useForm, useDeleteConfirm, … (imported explicitly — see §4)
  layouts/                   # default + auth layouts
  middleware/                # route guards (auth)
  pages/                     # file-based routing
    auth/                    # login / register
    tables/[tableId]/records/  # dynamic table & record views
  stores/                    # Pinia stores (auth, tables, fields, records, relations)
server/                      # Nitro backend
  api/                       # HTTP route handlers (thin: parse → check ownership → call service)
  middleware/                # server middleware (attach authenticated user to event.context)
  services/                  # generic, framework-agnostic business logic (record/query/relations)
  utils/                     # prisma singleton, auth helpers, ownership assertions
  generated/prisma/          # generated Prisma client (gitignored — never edit by hand)
shared/                      # code used by BOTH client & server — one rule per folder
  types/                     # type & interface declarations ONLY (zero runtime exports)
  constants/                 # the runtime constant registries (field types, filter values, page size)
  utils/                     # generic framework-free helpers (filter predicates, the URL codec)
  validation/                # zod schemas and nothing else
prisma/migrations/           # Prisma migration history
docs/                        # architecture.md + decisions.md
public/                      # static assets
```

`shared/` is four layers with a strict dependency order — `types` → `constants` → `utils` → `validation`, each importing only from layers above it. A helper that fits none of `types`/`constants`/`validation` belongs in `utils/`, not in whichever folder is nearest. See `docs/architecture.md`.

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
- **A popover swallows Escape only while it has something open.** `BaseModal` owns the `document` listener, so one keypress must never close both. Where focus lives inside the panel, `@keydown.esc.stop` on the panel says that structurally — the panel only exists while open. Where the control keeps focus _outside_ its panel (a combobox), the modifier is wrong: it would make a **closed** control eat the surrounding dialog's Escape. There, handle the key in JS and call `stopPropagation()` only when `open`.
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

A deliberately plain, familiar office-app look for a largely non-technical audience: **16px base, 36px control height, 8px control radius, a single accent blue (`#1C64D8`), two shadows, borders doing the structural work.** New UI matches that register; it is not a blank canvas.

### Accessibility target: WCAG 2.2 AA

- Every interactive element is keyboard-operable and has a visible `:focus-visible` ring. **Focus is never removed, only restyled** — `_reset.scss` carries a zero-specificity baseline so nothing can end up with no ring; components override it with the `focus-ring` mixin (`outline`, not `box-shadow`, so an ancestor's `overflow` cannot clip it).
- Minimum target size **24×24** — SC 2.5.8, the AA requirement. The house floor is `--control-height` (**36px**), which every sized control including icon-only buttons meets; nothing may go below 24 (the filter-summary chip's remove button sits exactly on it). 44×44 is SC 2.5.5, which is **AAA** — do not quote it as the AA bar.
- Text contrast ≥ 4.5:1; control outlines and other non-text UI ≥ 3:1 (this is why `--color-border-control` is a separate token from `--color-border-strong`).
- Dialogs and off-canvas surfaces are `inert`-guarded and must never leave focusable content off-screen — `visibility: hidden`, not translation alone.

### Rules

- **BEM** (`Block__Element--Modifier`) for class names.
- **Sizes in rem via the `rem()` helper** (16px base): `font-size: rem(14)`, `padding: rem(10) rem(12)`. Plain `px` is reserved for hairline borders and box-shadow offsets/blur.
- **`functions` and `mixins` reach every SFC `<style>` block and entry file automatically** (Vite `additionalData`). They do **not** reach a transitively `@use`d partial — a standalone partial like `_auth-form.scss` must `@use` both itself, and `main.scss` must **not** re-`@use` either.
- Use SCSS **nesting with `&`**; never duplicate a parent selector that could be nested.
- **Reuse before you paste.** A declaration block that would be a second copy belongs in `_mixins.scss`. Check the list there first — `focus-ring`, `below-shell`, `stack`, `cluster`, `truncate`, `field-label`, `field-error`, `form-control`, `error-banner`, `page-header`, `page-title` cover most needs. A block with no per-site variation is a **class** in its own partial instead (`.auth-form`, `.text-link`), `@use`d from `main.scss`.
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

  &__title {
    font-size: rem(20);
  }

  &--active {
    border-color: var(--color-accent);
  }

  &:hover {
    box-shadow: var(--shadow-md);
  }
}
```

The token inventory, the partial layout, and the `BaseButton` variant contract are documented in `docs/architecture.md`.

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

**Cardinality is a second axis, and it is per-field, not per-type.** `options.multiple` makes a SELECT or a RELATION hold a list; `MULTI_VALUE_BY_TYPE` (`shared/constants/field.ts`) says which types may, and `isMultiValue(field)` (`shared/utils/field.ts`) is the only reader. Each affected registry keeps its flat per-type entries and gains a `MULTI_*` override table — also total, `Record<TFieldType, X | null>` — plus one resolver that every consumer calls instead of indexing: `sqlFor`, `inputFor`, `filterFor`, `summaryFor`, `cellComponent`, `filterShapeFor`. So a new field type must still declare its position on multi-value, and no component branches on the flag.

**Inputs and filters are data, not components** — each is an `IFieldControl` naming a `Base*` control, a `props(field)` factory, and the adapters between that control's model and the field's value. Only cells are components. A type whose control needs data beyond its own metadata gets a component in `field-types/controls/` (RELATION is the only one today).

**No scattered `switch`/`if` chains on field type** in pages, services, or generic components. If adding a type would require editing `DynamicForm`, `DynamicTable`, or a service, the abstraction is broken — fix the abstraction instead of special-casing.

Full contracts for each registry: `docs/architecture.md`.

---

## 10. Testing

**Vitest and Playwright are both configured, and step 4 of the definition of done is binding.** Changes to `shared/utils/`, `shared/validation/`, `server/services/`, `app/composables/`, `app/stores/` and `app/utils/` ship with tests; a change to behaviour listed in `docs/architecture.md` §12 ships with an end-to-end one.

`.github/workflows/ci.yml` runs three jobs on every push to `main`/`develop` and on every PR: `format:check` → `lint` → `typecheck` → `test` → `build`; an **integration** job with a PostgreSQL service container; and an **e2e** job that additionally installs Chromium and builds the app. Alongside them, the total `Record<TFieldType, …>` registries still make an unhandled field type a compile error rather than a runtime surprise.

### The four projects

`vitest.config.ts` is a thin root declaring `test.projects` and the merged coverage config — **`unit` and `nuxt` only**, so `npm run test` never wants a database. `integration` is a standalone config run by its own script. **Which project a spec lands in is decided by what it needs, not by what it is**:

|              | `unit` — `vitest.unit.config.ts`                             | `nuxt` — `vitest.nuxt.config.ts` | `integration` — `vitest.integration.config.ts` | `e2e` — `playwright.config.ts`  |
| ------------ | ------------------------------------------------------------ | -------------------------------- | ---------------------------------------------- | ------------------------------- |
| Files        | `{app,server,shared}/**/*.spec.ts`                           | `{app,shared}/**/*.nuxt.spec.ts` | `{server,shared}/**/*.integration.spec.ts`     | `test/e2e/**/*.spec.ts`         |
| Environment  | `node`, no DOM                                               | `nuxt` (real app) on happy-dom   | `node` + real PostgreSQL                       | Chromium + the production build |
| Aliases from | the `resolve.alias` block, mirroring `.nuxt/tsconfig.*.json` | Nuxt itself                      | the same block, plus one shim (below)          | `test/e2e/tsconfig.json`        |
| Cost         | under a second                                               | a Nuxt build's worth of startup  | a database round trip per case                 | a Nuxt build, then ~1 min       |
| Run alone    | `npm run test:unit`                                          | `npm run test:nuxt`              | `npm run test:integration`                     | `npm run test:e2e`              |

**Default to `unit`.** Vue reactivity alone does not earn the Nuxt project: `vue` is a plain dependency, so a composable built from `ref`/`watch`/`computed` is testable in `node` with an `effectScope` and nothing else — `useDebouncedModel`, `useSelectOptions`, `useForm` and `useDeleteConfirm` all live there. Reach for `*.nuxt.spec.ts` only for what genuinely cannot run otherwise:

- anything importing `#imports` — every Pinia store does, through `useApi()` at setup time;
- anything touching `document`, `window`, focus or layout (`usePopover`, `useAnchoredPosition`);
- anything importing a `.vue` file, which the node project has no Vue plugin for.

**Reach for `integration` only for what a stub cannot answer** — that the SQL executes, that a constraint fires, that a lock holds, that the rules survive out to the endpoint. It is not the place to re-test logic the fast projects already cover.

**Reach for `e2e` only for what a browser answers** — first paint, history, focus, keyboard, paint. Its list is `docs/architecture.md` §12 and nothing else; a case that would pass in happy-dom belongs three projects down, where it runs in a second instead of a minute.

### The end-to-end project

`playwright.config.ts` + `test/e2e/`. Chromium only, `workers: 1`, its own `flexbase_e2e` database. Three things are load-bearing:

- **The server is the built output, started by `test/e2e/setup/serve.mjs`.** Never `nuxt preview`: it loads the root `.env`, which points at the **development** database, and the suite truncates between cases. The launcher also works around a Windows-only crash — `.output/server/index.mjs` assigns `globalThis._importMeta_` in its body, but ESM hoists imports, so the bundled Prisma client evaluates first, falls back to the placeholder `file:///_entry.js`, and `fileURLToPath` throws on it. A dynamic import is not hoisted, so assigning first is enough. **`npm run preview` is broken on Windows for the same reason** (`docs/decisions.md`).
- **One guard for both disposable databases.** `test/disposable-database.ts` refuses any name not ending in `_test` or `_e2e`, and both suites call it before writing. Never weaken it.
- **Selectors are roles and accessible names**, never `data-testid` — the app labels everything already, so a spec that breaks because a label changed is reporting something real. Note two shapes worth knowing: `BaseSelect`'s non-searchable trigger is a `<button>` whose accessible name is _label + value_ ("Stage Won"), and its value overlay is a **sibling** of that button rather than a child.

**Assert the table through `expect.poll`, never a bare read.** A URL assertion resolves the moment the address bar moves, but the rows behind it refetch asynchronously — reading straight after passes often enough to look fine and fails often enough to be a flake. The same trap has a subtler form: waiting on text that is _already_ on screen. Waiting for "Ada" after drilling into Ada from a record that lists her as its owner proves nothing, and the drill spec waits on the target table's name instead.

### The integration project

Four things make it work, and each is load-bearing:

- **A separate database.** `flexbase_test` on the same container, because the suite `TRUNCATE`s every table between cases and the development database holds real work. `test/integration/global-setup.ts` **refuses to start** unless the database name ends in `_test`, then runs `prisma migrate deploy` — which creates the database if it does not exist yet, so nothing has to be provisioned by hand. Never weaken that guard. `INTEGRATION_DATABASE_URL` is the only variable that overrides the default.
- **The npm script provisions what the suite needs**, because neither prerequisite is discoverable from `npm ci` and both fail loudly but misleadingly. `test:integration` and `test:e2e` run `db:up` first: a stopped container fails in `globalSetup` — for the e2e suite _after_ a full Nuxt build — and Playwright then reports **zero tests run**, which reads as a broken suite rather than a stopped database. `test:e2e` also runs `playwright install chromium`, a ~1s no-op once the browser is present: without it every test fails identically with `browserType.launch: Executable doesn't exist`, 100 red lines for one missing download. **CI must not use these scripts** — its jobs provide both prerequisites themselves, and a `db:up` there would try to bind a port the service container already holds. Invoking `vitest`/`playwright` directly is the supported path: the setups catch a database failure and name the cause.
- **`fileParallelism: false`.** One database, so files may not run against it at once.
- **Handlers invoked directly**, with a real `H3Event` built by `test/integration/event.ts` — `requireUser` → ownership → zod → service all run for real, and only Nitro's routing is skipped. Note the helper sets `content-length`: without it h3 returns an empty body without reading the stream, and every `readValidatedBody` becomes a confusing 400.
- **One shim, `test/integration/nitro-runtime.ts`.** `nitropack/runtime` cannot be imported outside a Nitro build — its entry pulls in `#nitro-internal-virtual/*`. The shim provides `useRuntimeConfig` returning `jwtSecret` from the environment, which is exactly what `nuxt.config.ts` declares. It exists so the two auth endpoints and the server middleware can be loaded at all; do not grow it into a general Nitro stub.

Rows are seeded through Prisma (`test/integration/seed.ts`), not through the services, so a spec about `createRecord` is not seeded by `createRecord`.

`defineVitestConfig` boots the real app from `nuxt.config.ts`, so the aliases, the module list and the SFC pipeline are the ones that ship. **Do not hand-stub what the environment already provides** — a stub is a second source of truth able to drift. In particular: `registerEndpoint` for an API a store calls, `mockNuxtImport` for `useRoute` and friends, `mountSuspended` for a component.

### Rules

- **Specs are colocated** — `shared/utils/record-query.spec.ts` and `app/stores/tables.nuxt.spec.ts` each sit beside their source. That is what puts them inside the `include` globs Nuxt generates, so `npm run typecheck` checks them too.
- **`globals: false` in both projects.** Every spec imports `{ describe, it, expect } from 'vitest'`, matching the project's `autoImport: false` doctrine — and required regardless, since the generated tsconfigs set `types: []`.
- **Imports are aliased in a spec exactly as in source** (`~/…`, `#shared/…`, `#server/…`); `no-restricted-imports` applies to specs too.
- **Field fixtures live in `test/fixtures.ts`**, reached as `~~/test/fixtures`. Add a builder there rather than restating an `IField` in a second spec.
- **A unit test must be deterministic and offline:** no database, no network, no `Date.now`, no randomness, no filesystem. `server/services/record-query.ts` is testable precisely because it only _builds_ `Prisma.Sql` — assert on `.text` and `.values`, never execute.
- **A service that reaches the `prisma` client is tested against the stub in `test/prisma-mock.ts`**, wired per spec with `vi.mock('#server/utils/prisma', …)`. Not a preference — `server/utils/prisma.ts` constructs a real client at module load, so without it the module cannot be imported in the node project at all. The stub answers to both `$transaction` forms and hands the callback itself as `tx`, so a transactional write and a direct one assert through the same spies. **What it may prove is the code _around_ a query** — which guard fires, what shape a `where` clause is built in, how many queries are issued (assert on the argument, not only the outcome: a fetch-then-compare rewrite would still return the right value while losing the §5 property). **What it never proves is that the query runs**, or that PostgreSQL agrees with it. Do not stretch a stub to imply otherwise — that half is the integration suite's, and `docs/roadmap.md` holds it.
- **A mounted component reads the Nuxt app's pinia, not a spec's.** `setActivePinia(createPinia())` is right for a store tested directly and wrong under `mountSuspended`, where `@pinia/nuxt` has already provided one — use `setActivePinia(useNuxtApp().$pinia as Pinia)` and clear the state it carries between cases.
- **Assert on structure and behaviour, never on computed styles.** Vitest's `test.css` stays `false`, so SCSS is stubbed rather than compiled; a component spec that reads a colour is testing nothing.

Covered today — `unit`: all of `shared/utils/`, all of `shared/validation/`, **all of `server/services/` and all of `server/utils/`** (the SQL builder, the four prisma-backed services, ownership scoping, field-key derivation, the whole of `auth.ts` including the cookie contract, the Prisma→HTTP error mapping), and the four Vue-only composables. `nuxt`: **every composable, every store, all of `app/field-types/`, all of `app/utils/`, and the route guard in `app/middleware/`**, plus the components `BaseButton`, `BaseInput`, `BaseModal`, `BasePagination`, `BaseRange`, `BaseSelect`, `RecordFieldValue`, `RecordsFilterPanel`, `RecordsFilterSummary`, `DynamicForm` and `DynamicTable`.

**Coverage is one report merged from two runs**, because `server/api/` and `server/middleware/` are reachable only from the `integration` project, which needs a database and so stays out of `npm run test`. `npm run coverage:collect` writes a blob per run into `.vitest-reports/` and merges them; `test:coverage` is that plus `db:up`. Three constraints hold it together, all in `docs/decisions.md`: the scope lives in `vitest.coverage.config.ts` so one `include` list cannot drift into two, the integration run measures the server half only, and `.vitest-reports/` must contain nothing but the blob files. **`e2e` contributes no coverage** — it drives a built server, not an instrumented one.

What the `integration` project covers: the 404-never-403 rule across all thirteen table-scoped endpoints, 401 across fourteen of the fifteen, the auth endpoints (identical answer for a wrong password and an unknown email, duplicate-email 409, no hash in any response, the cookie), the records endpoint composing its schema with the shared codec, and the middleware's three anonymous paths including a valid token for a since-deleted user. The fifteenth is `tables/index.post` — the merged report is what made that visible, and `docs/roadmap.md` holds it.

**The SQL layer is verified twice, deliberately.** `record-query.spec.ts` asserts on `.text` and `.values` without a connection; `record-query.integration.spec.ts` runs the same builder against PostgreSQL and looks at which rows come back. Neither replaces the other — the first pins the shape and catches a change in intent, the second is the only thing that would catch a fragment the database rejects. The same split covers `widenToList` (invoked, vs. what it does to stored rows) and the record counter (one transaction, vs. twenty concurrent creates getting twenty distinct numbers).

**No module under `app/` is at zero.** What is left is the rest of `app/components/`, which is markup, and end-to-end coverage — the browser-only behaviour in `docs/architecture.md` §12 that Playwright is for.

**A pure module that imports a `.vue` file belongs to the `nuxt` project.** `record-cells.ts` and `inputs.ts` mount nothing and assert on plain functions, but the node project has no Vue plugin to resolve their component imports — what decides the project is the import graph, not what the spec does.

Three contracts the renderer specs pin that are invisible in the browser when broken, and must not be "simplified" away: **`DynamicForm` never mutates the `values` prop** (the form object belongs to the parent's `useForm`); **an empty list is as blank as a null** in `RecordFieldValue`, or a cleared multi-value field renders as nothing rather than "Not set"; and **`MULTI_INPUTS` must be non-null at exactly the types `MULTI_VALUE_BY_TYPE` marks `true`** — two hand-maintained total `Record`s in different files, where a mismatch silently drops every value but the first.

**`MULTI_SQL` carries the same invariant and the same guard**, in `record-query.spec.ts`. A widened field routed through the scalar projection compares a JSON array against a scalar and simply never matches — nothing errors, the table just comes back empty. It is probed through `ORDER BY` rather than `WHERE`, because a widened field's filter is list-shaped whatever its type declares, so a `WHERE` would differ from the value's shape rather than from the routing under test.

**A store that must not throw and one that must are a documented pair.** `ensureTables` swallows, because the root layout has no error boundary above it; `fetchRecords` sets `failed` **and rethrows**, because a refetch runs from a watcher where swallowing would leave the table showing rows that no longer match the URL — and the initial load still needs the rejection for `useAsyncData` to produce the 404. Both directions are asserted, in `tables.nuxt.spec.ts` and `records.nuxt.spec.ts`.

**`useRecordDetail` keys its `useAsyncData` on the literal `'record-detail'`**, so in a spec one case's entry is the next case's cache and the fetch is skipped. Its spec tears down the previous host **and** calls `clearNuxtData` together — clearing alone leaves the instance resolved. A sync `setup` also does not await its own async data, so the mount resolves before the first request does; the helper settles a real tick afterwards rather than pretending otherwise.

**The filter side is deliberately not symmetric with the record side, and the specs pin the difference.** `MULTI_FILTERS.SELECT` is `null` because a SELECT filter was always list-shaped, so the `MULTI_INPUTS` invariant above does **not** apply to `MULTI_FILTERS`; only BOOLEAN carries adapters, because every other filter control's model already _is_ the filter value; and `RecordsFilterPanel` rebuilds its whole map in column order rather than patching one key, so a shared URL is stable whichever control was touched. `BaseRange` adds one more: a blank or unparseable bound is `null`, **never `0`**, or an empty box silently becomes `>= 0`.

Two contracts the component specs pin that are invisible in the browser when broken, and must not be "simplified" away: **`BaseSelect` normalises `props.multiple` itself**, because a bare `multiple` attribute arrives as `''` that `vue-tsc` reads as `true`; and **its combobox swallows Escape only while open**, so a closed select inside the filter drawer does not eat the drawer's own key. `BaseModal`'s spec pins the other half of that — it owns the sole document-level Escape listener, and releases it on unmount.

**The list query lives in `useRecordListQuery`, not in the records page**, and which of its actions leaves a history entry is a contract: a sort or a page step **pushes**, a filter edit, a search or a clear **replaces**. Nothing on screen shows the difference — it surfaces only as a browser Back that walks through every keystroke instead of returning where the user came from. Two more the same spec pins: a search term below `SEARCH_MIN_LENGTH` is dropped rather than sent, and an unchanged term does not navigate **at all**, because a debounced input re-emits the value it settled on. Note that `desc` is the default direction and is therefore _absent_ from the URL, so a spec asserting on `dir` reads the params back through `parseRecordQueryState` rather than checking whether the key is there.

**No module under `app/` is at zero, and `docs/architecture.md` §12 is no longer a manual walk** — `test/e2e/` automates it, bar the three lines recorded there as approximations. A behavioural change still gets driven in the running app before it ships; what changed is that the checklist behind it now has a spec per line.

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
- Direct dependencies that exist for a reason: `h3` and `nitropack` (server code imports them by name — keep versions in step with Nuxt's), `ofetch` (`app/utils/api-error.ts` imports `FetchError` by name), `@iconify-json/mdi` (nothing imports it — `@nuxt/icon` detects it and serves `mdi` from disk; without it every icon is a runtime fetch of `api.iconify.design`). `vue-router` is deliberately **not** declared. `@nuxt/fonts` was removed; do not re-add it until a real webfont exists. See `docs/decisions.md`.
