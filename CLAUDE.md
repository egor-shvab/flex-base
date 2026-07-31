# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# Role: Senior Fullstack Engineer (Nuxt 4, Vue 3, Nitro, Prisma, TypeScript, PostgreSQL)

You are an expert Senior Fullstack Developer. You build a high-performance **low-code platform** using **Nuxt 4 (Fullstack Architecture)**. Your code is production-ready, strictly typed, highly secure, and optimized for SSR/Edge deployment.

---

## 1. Project Overview

This project is a full-stack **low-code platform** built with **Nuxt 4, Vue 3, TypeScript, Nitro, Prisma, and PostgreSQL**. Users build simple business applications **without writing code**: instead of a fixed CRM structure, they create their own tables, define custom fields, and manage records through dynamically generated interfaces.

Two rules are non-negotiable: the architecture is **metadata-driven** — forms, tables, and APIs are generated from configuration stored in the database, never from hardcoded business entities — and every resource belongs to a single authenticated user, with **ownership enforced on the server for every request**.

### Core Principles

- **Metadata-driven architecture** — behavior described by data; no hardcoded business entities, pages, or components.
- **Dynamic UI generation** — forms and tables are generated from field/column definitions, input components are selected automatically by field type, and validation rules are derived from metadata.
- **Generic, reusable code** — components and APIs work with configurable entities; adding a new table type requires no new frontend or backend code.
- **Extensible field system** — new field types plug in without rewrites.
- **Server-enforced security** — authentication and per-user data ownership are checked on every request.
- **Full TypeScript coverage** — with zod schemas shared between client and server.
- **Keep the MVP simple** — design for extensibility, but do not implement future features prematurely; favor clean architecture and maintainability over short-term optimizations.

### MVP Scope

The first version focuses only on the core functionality needed to validate the concept:

- User registration and authentication.
- Per-user data isolation.
- Creating custom tables.
- Creating custom fields for each table.
- Creating, editing, and deleting records (full CRUD).
- Automatically generated forms based on field definitions.
- Automatically generated tables based on field definitions.
- Basic field validation.
- Basic filtering and sorting.
- Relationships between tables.

Everything else — teams, workspaces, permissions, dashboards, activity history, workflows, automations, file uploads, import/export, third-party integrations — is **future functionality**: do not implement it, and do not let it influence the MVP architecture.

---

## 2. Architecture

This is a full-stack Nuxt 4 application using the `app/` source directory convention (Nuxt 4 default), with the Nitro server layer under `server/`, shared client/server code under `shared/`, and the database layer under `prisma/`. Implemented so far: the full Prisma schema, authentication (register/login/logout, session restore, route guards), table metadata CRUD (dashboard + ownership-scoped API), field metadata CRUD (typed fields per table with per-type options validation), record CRUD (paginated API, metadata-driven validation, field-type component registry, `DynamicForm`/`DynamicTable`), and URL-driven filtering & sorting (a filter drawer generated from the field metadata — one control per field, all conditions ANDed — plus click-to-sort headers over a raw-SQL record query), relations between tables (a single-link RELATION field with a server-resolved display label, its own picker, filter and label-ordered sort), and the record's own columns shown on every table (`Record #` leading, `Created at`/`Updated at` trailing — sortable and filterable, never per-table configurable). **The MVP scope is complete**; what remains is a test suite.

### Stack

- **Frontend:** Nuxt 4, Vue 3, TypeScript, Pinia (state), SCSS (`sass-embedded`).
- **Backend:** Nitro (Nuxt's server engine) via `server/api` routes.
- **Database:** PostgreSQL (Docker) through **Prisma 7** (`@prisma/client` + `@prisma/adapter-pg`, `prisma` CLI). Schema: `prisma/schema.prisma` — models `User`, `Table`, `Field` (typed metadata, `options` Json), `Record` (`data` Json keyed by immutable `Field.key`); ownership lives solely on `Table.userId`, fields/records derive it through their table.
- **Auth:** manual — **bcrypt** for password hashing, **jsonwebtoken** (JWT) for tokens. No auth library. The JWT (`{ sub: userId }`, HS256, 7 days) is stored in an httpOnly `auth_token` cookie; `server/middleware/auth.ts` resolves it to `event.context.user` on every request (never rejects — handlers call `requireUser(event)` from `server/utils/auth.ts` to enforce 401). Client side: `app/stores/auth.ts` + global route middleware `app/middleware/auth.global.ts` (session restore + redirects), API calls go through `useApi()` (`useRequestFetch`, so cookies are forwarded during SSR).
- **Validation:** **zod**, used for shared client + server validation schemas.

### Directory structure

```
app/                         # Nuxt 4 frontend (client)
  assets/scss/               # global SCSS (main.scss + partials, incl. _mixins.scss)
  components/
    app/                     # the shell — AppSidebar, AppBreadcrumbs (used by the layout/pages)
    common/                  # generic UI atoms, all `Base*` (buttons, inputs, modal, range, …)
    modals/                  # dialogs built on BaseModal — ConfirmModal (universal), the form modals
    records/                 # the three metadata renderers — DynamicForm, DynamicTable, RecordsFilterPanel
  field-types/               # EVERYTHING per-field-type: the input/filter/cell registries + the cell components
  composables/               # useApi, useForm, useDeleteConfirm, … (imported explicitly — see "Imports")
  layouts/                   # default + auth layouts
  middleware/                # route guards (auth)
  pages/                     # file-based routing
    auth/                    # login / register
    tables/[tableId]/records/  # dynamic table & record views
  stores/                    # Pinia stores (auth, tables, fields, records)
server/                      # Nitro backend
  api/                       # HTTP route handlers (thin: parse → check ownership → call service)
    auth/                    # register / login / logout
    tables/[tableId]/fields/    # field-definition CRUD
    tables/[tableId]/records/   # generic record CRUD (filter/sort)
  middleware/                # server middleware (attach authenticated user to event.context)
  services/                  # generic, framework-agnostic business logic (record/query/validation)
  utils/                     # prisma singleton, auth helpers, ownership assertions
  generated/prisma/          # generated Prisma client (gitignored — never edit by hand)
shared/                      # code used by BOTH client & server — one rule per folder
  types/                     # type & interface declarations ONLY (zero runtime exports)
  constants/                 # the runtime constant registries (field types, filter values, page size)
  utils/                     # generic framework-free helpers (filter predicates, the URL codec)
  validation/                # zod schemas and nothing else
prisma/
  migrations/                # Prisma migration history
public/                      # static assets
```

### The four `shared/` layers

Each folder has one job, and the dependency order below is what keeps them honest — a file may only import from layers above it:

1. **`types/`** — declarations only, so these modules are erased at build time. They may `import type` a constant purely to derive from it (`TFieldType` is `typeof FIELD_TYPES[number]`); because both directions are type-only, the types↔constants reference costs nothing at runtime.
2. **`constants/`** — the runtime registries (`FIELD_TYPES`, `FILTER_VALUE_BY_TYPE`, `RESERVED_QUERY_PARAMS`, `RECORD_PAGE_SIZE`, …). Values, never logic.
3. **`utils/`** — generic helpers: `filter.ts` (param naming + value-shape predicates) is a pure leaf; `record-query.ts` (the URL codec) additionally uses the value schemas to decode.
4. **`validation/`** — zod schemas and their builders, nothing else. A schema validates; turning validated params into a domain model is the codec's job, not a `.transform()`.

If a helper does not fit `types`/`constants`/`validation`, it belongs in `utils/` — not in whichever folder happens to be nearest.

### Imports

**Components are auto-imported; everything else is imported explicitly.** `nuxt.config.ts` sets `imports: { autoImport: false }` and `nitro: { imports: { autoImport: false } }`, which also stops Nuxt generating the global `.d.ts` declarations — so a missing import is a `vue-tsc` error at build time rather than a silently resolved global. The component scan (`components: [{ path: '~/components', pathPrefix: false }]`) is deliberately kept: it is what makes `<LazyRecordFormModal>` code-split for free, and framework components (`<NuxtLink>`, `<NuxtPage>`, `<Icon>`) keep working.

Import each symbol from:

| Symbol                                                                                                                                             | Import from                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `ref`, `shallowRef`, `computed`, `reactive`, `watch`, `markRaw`, `useId`, lifecycle hooks                                                          | `vue`                                                 |
| `useRoute`, `useAsyncData`, `useSeoMeta`, `useHead`, `navigateTo`, `createError`, `useRequestFetch`, `definePageMeta`, `defineNuxtRouteMiddleware` | `#imports`                                            |
| `defineStore`                                                                                                                                      | `pinia`                                               |
| `defineEventHandler`, `getRouterParam`, `readValidatedBody`, `getValidatedQuery`, `createError`, cookie helpers                                    | `h3`                                                  |
| `useRuntimeConfig` (server)                                                                                                                        | `nitropack/runtime`                                   |
| project code                                                                                                                                       | `~/*` (app), `#server/*` (server), `#shared/*` (both) |

**Imports are always aliased — never relative.** `./`, `../` and `../../` are a lint error under `app/`, `server/` and `shared/` (`no-restricted-imports` in `eslint.config.mjs`, scoped to those three directories so the root config files can keep their own relative paths). Use `~/field-types/types`, not `./types`; `#server/utils/auth`, not `../../../../utils/auth`. `#server` is a Nuxt built-in alias (registered in `@nuxt/schema`'s alias defaults alongside `#shared`), so it resolves for `vue-tsc` and the Nitro bundler alike.

**`#server` is server-only.** Nuxt's import protection rejects it in app and shared code — the Vue layer reaches the server through `$fetch`/`useApi()`, never by importing it. Put anything both layers need in `shared/`.

**Server code must not import from `#imports`.** `.nuxt/types/nitro-routes.d.ts` pulls every `server/api/**` handler into the _app_ TypeScript project (to type `$fetch` route responses), and `#imports` resolves to the app's module there — so `defineEventHandler` would not be found. `h3` and `nitropack` are therefore declared as direct dependencies in `package.json`; they resolve identically in both projects.

### API conventions

- Route files are named by HTTP method suffix under `server/api/`: `index.get.ts`, `index.post.ts`, `[tableId].patch.ts`, `[tableId].delete.ts`, …
- Handlers stay thin: validate input with the shared zod schema from `shared/validation/` → assert ownership via the `server/utils/` helpers → delegate all business logic to `server/services/`.
- Validate request bodies with `readValidatedBody(event, schema.parse)` — invalid input automatically becomes a 400 response carrying the zod issue details.
- Throw errors with Nitro's `createError({ statusCode, statusMessage })`; never return password hashes or another user's data.
- Server middleware authenticates the request and attaches the user to `event.context`.
- **Status codes:** a resource that exists but belongs to another user returns **404, never 403** (a 403 confirms the resource exists). 401 comes only from `requireUser(event)`; 409 for uniqueness conflicts (duplicate email, duplicate field key); login failures always return the same generic 401 message regardless of which credential was wrong.
- **Ownership lives in the query, not around it:** scope every Prisma query on owned data inside the `where` clause (e.g. `where: { id: tableId, userId }`, or a relation filter through `table` for fields/records) — never fetch first and check ownership afterwards.
- `User` rows are always read with an explicit `select` (`id`, `email`) so `passwordHash` can never leak into a response.
- Handlers/services read secrets via `useRuntimeConfig(event)` — never `process.env` (sole exception: the Prisma singleton in `server/utils/prisma.ts`).
- No `console.log` in committed code; errors are surfaced with `createError`, not logged and swallowed.

### Adding a new field type

A new field type touches exactly these places — and nothing else:

1. The `FieldType` enum in `prisma/schema.prisma` (+ migration).
2. `FIELD_TYPES` (+ `FIELD_TYPE_LABELS`) in `shared/constants/field.ts` — `TFieldType` in `shared/types/field.ts` is derived from it, so nothing else there changes. Every type in `FIELD_TYPES` is creatable; there is no second, narrower list.
3. One zod branch for its `options` validation in `shared/validation/field.ts` (plus the matching branch in `buildOptions`, `server/services/fields.ts`, if it stores options), plus one entry in `VALUE_SCHEMA_BY_TYPE` (`shared/validation/record.ts`) describing its record value (`base` schema + `blank` value + `fromQuery` decoder).
4. Four entries in `app/field-types/` — one in `FIELD_INPUTS` (`inputs.ts`), one in `FIELD_FILTERS` (`filters.ts`), one in `FIELD_CELLS` (`cells.ts`), one in `FILTER_SUMMARIES` (`filter-summaries.ts`, how an active filter _reads_ above the table) — plus **one** cell component in `app/field-types/cells/`. Inputs and filters are **data, not components**: each is an `IFieldControl` (`types.ts`) naming a `Base*` control, a `props(field)` factory, and the adapters between that control's model and the field's value. Only cells are components, because a cell carries markup and scoped styles (an icon, tabular figures) rather than a value. **The one exception is RELATION**, whose candidates are records of another table: no synchronous `props(field)` factory can produce them, so both its entries name one project component (`app/field-types/controls/RelationFieldSelect.vue`) that reads them from the relations store. A type that needs data beyond its own metadata belongs in `controls/`; everything else stays a row in the table.
5. One entry in `FILTER_VALUE_BY_TYPE` (`shared/constants/filter.ts`) — its filter value's `shape` (`scalar`/`range`, which also names the params it claims) and `empty` value, alongside its shape in `IFilterValueByType` (`shared/types/filter.ts`) — plus one in `FIELD_SQL_BY_TYPE` (`server/services/record-query.ts`) giving its SQL projection and how that projection is compared. A type that reads as something other than what it stores also declares an optional `sortExpr` there (RELATION is the only one: it filters on the stored id but orders by the target's label).

Every one of these registries is typed as a total `Record<TFieldType, …>`, so adding an enum member is a compile error until its schema branch, components, filter value and SQL projection exist.

**No scattered `switch`/`if` chains on field type** in pages, services, or generic components — per-type behavior lives in the registry and the zod branches. If adding a type would require editing `DynamicForm`, `DynamicTable`, or a service, the abstraction is broken: fix the abstraction instead of special-casing.

`FILTER_VALUE_BY_TYPE` (`shared/constants/`) and `VALUE_SCHEMA_BY_TYPE` (`shared/validation/`) look like one table split across two layers, but merging them would be a **cycle**: `shared/utils/filter.ts` imports the constant and `shared/validation/record.ts` imports `shared/utils/filter.ts`. The split is load-bearing — leave it.

### Record identity

Two different jobs, deliberately split across two columns:

- **`Record.id`** — a `cuid()`. It is what relations reference (inside `data` JSONB, with no
  foreign key) and what the API addresses, so it must be stable, non-recycled and unguessable.
- **`Record.number`** — an `Int`, sequential **per table** (`@@unique([tableId, number])`), and
  purely for display. Nothing references it, which is why it could be renumbered without
  orphaning a single relation.

An auto-incrementing PK was considered and rejected: every user's records share one physical
`Record` table, so a global sequence would number rows across all tenants (a table would read
`1, 47, 2931`), leak platform-wide row volume through the counter, and make ids enumerable —
all while still not giving the per-table `1..n` that makes a number readable in the first place.

`number` is allocated from `Table.recordCounter` inside the insert's own transaction: Prisma's
atomic `{ increment: 1 }` takes the row lock, so concurrent creates queue instead of racing,
and no retry loop is needed. The counter is a **high-water mark, not a count** — deleting a
record never frees its number for reuse, the same contract an issue tracker gives.

### Record columns

Three columns of `Record` itself are shown on **every** table and are deliberately not
configurable per table: `Record #`, `Created at` and `Updated at`. **In a query each behaves
like a field**, via one seam rather than a special case at each layer.

`recordColumn(key, name, type)` in `shared/utils/filter.ts` builds each as an ordinary `IField`
under a reserved **camelCase** key — a shape `slugify` can never emit, so no user field can
shadow one (`RESERVED_FIELD_KEYS` states the reservation rather than relying on that luck).
`queryFields(fields)` returns them around a table's own fields **in presentation order** —
`Record # | …fields… | Created at | Updated at` — and is applied wherever a _query_ is built:
the codec, the query schema, `buildRecordWhere`/`buildRecordOrderBy`, `DynamicTable` and
`RecordsFilterPanel`. Never where record _data_ is read or written (`buildRecordSchema`,
`DynamicForm`, the field manager), since none of it is part of that data — which is exactly
what makes these columns generic and read-only.

Because they look like ordinary fields, the filter controls, the URL format, the badge count
and "Clear all" all work on them unchanged. Only two registries know better:

- `RECORD_COLUMN_SQL` (`server/services/record-query.ts`) — the projection, since these live
  outside `data`. Every entry declares **both** halves for the same reason RELATION does: the
  number **filters as text** (`4` matches `#4`, `#14`, `#42`) but **orders as an integer** (`#9`
  before `#10`); a timestamp **filters as `::date`**, so an inclusive `to` bound covers that
  whole day instead of stopping at its midnight, but **orders as a timestamp**, so two records
  made on one day still order by time.
- `RECORD_COLUMNS` (`app/field-types/record-columns.ts`) — where the value comes from
  (`record.number` / `record.createdAt` / `record.updatedAt`, never `record.data`) and which
  cell renders it. `DynamicTable` consults it first and falls through to `FIELD_CELLS`, so it
  never learns which columns exist.

`TimestampCell` pins **`timeZone: 'UTC'`**, and that is a correctness requirement rather than a
preference: `DateFieldCell` gets away with no zone because it parses a date-only value as local
midnight, the same wall-clock everywhere, but formatting a real timestamp would render
differently on the server and in the browser — a hydration mismatch. Pinning UTC also keeps the
displayed day equal to the day the filter matches on, since that compares `::date`.

Since `DEFAULT_SORT_KEY` **is** `createdAt`, the default view now shows an active descending
arrow on the Created at header: the table's default ordering became visible rather than implicit.

### Relations

A RELATION field stores **one** target record's id — a plain `string`, so it needs no widening of `TRecordValue` and no new filter shape. Its `options` carry `{ targetTableId, labelFieldKey }`: the table it points at (**immutable** — retargeting would orphan every stored id, so `updateField` rejects a change with 400) and which of that table's fields a linked record reads as (**editable** — pure display).

An id is not readable, so the label is resolved server-side and never in the browser's guesswork. `shared/utils/record-label.ts` holds the one rule (`buildRecordLabel`), and `server/services/relations.ts` — the only module that knows what a RELATION _means_, so `records.ts` stays generic — applies it in three places:

- `resolveRelationLabels` runs after the record list and returns `IRecordPage.relationLabels`, keyed by **field id** then by target record id (per field, because two relations may point at one table through different label fields). One `findMany` per distinct target table, never one per row — the case the performance rules flag.
- `assertRelationTargets` gates every record write: a value that does not resolve to a live record of its target table is a 400, so a crafted payload cannot store a dangling id.
- `listRelationOptions` backs `GET /api/tables/[tableId]/fields/[fieldId]/options`, the candidates a picker offers — capped at `RELATION_OPTIONS_LIMIT`, label-ascending. Scoped by the _source field_, so nothing about the target is taken from the client.

Client side, `app/stores/relations.ts` is the single home for both halves (`optionsByField`, `labelsByField`), fed by the options endpoint and by the labels each record page carries. `RelationFieldSelect` reads the options; `RelationFieldCell` reads the labels — which is why `IFieldCellProps` carries the `field` as well as the value, matching what the two control tables already receive.

**Known limits, deliberately:** a picker lists at most `RELATION_OPTIONS_LIMIT` candidates and has no search (a value outside that list is still shown, so editing never drops a link silently); deleting a target _record_ leaves a dangling id that reads as "Unknown record", because blocking it would mean a JSONB scan of every table — deleting a target _table_ is refused with a 409 instead; and the label sort adds one PK lookup per matching row on top of the unindexed JSONB path the schema already documents.

### Frontend conventions

- Pinia stores are **setup-style** (`defineStore('x', () => { … })`), like `app/stores/auth.ts`; state is `ref`s mutated only inside that store's actions.
- Components are PascalCase; generic atoms in `app/components/common/` carry the `Base` prefix (`BaseButton`, `BaseModal`).
- Props and emits are typed via generics — `defineProps<{ … }>()` / `defineEmits<{ … }>()`; no runtime prop declarations.
- DTO/request types are derived with `z.infer` from the shared zod schemas (see `shared/validation/auth.ts`) — never hand-write a parallel interface that can drift.
- Data fetching chain: page/component → `useAsyncData`/store action → `useApi()` (`app/composables/useApi.ts`). Never bare `$fetch` — it drops cookies during SSR. Surface request errors with `getApiErrorMessage`.
- Forms use the `useForm` composable (`app/composables/useForm.ts`) — reactive fields, per-field zod errors that clear on edit, a form-level server error, `pending`, `submit`, `reset` — instead of hand-rolled `reactive` + `watch` + `safeParse` boilerplate.

### Performance rules

Client (Vue/Nuxt):

- Use **`shallowRef`** for large fetched collections that are replaced wholesale rather than mutated item-by-item (record lists, field lists in the future records/tables stores): `const records = shallowRef<RecordDto[]>([])`, and a refetch assigns a new array to `.value`. Plain `ref` stays the default for small UI state (form fields, flags).
- The field type→component registry maps types to components — wrap component references in **`markRaw`** (or keep the registry a plain non-reactive module constant) so Vue never deep-proxies component objects.
- **Lazy-load** heavy, conditionally rendered components with the `Lazy` prefix (`<LazyBaseModal v-if="open">`) so they code-split out of the page chunk; pages are already auto-split per route.
- `v-for` is always keyed by a stable id (`record.id`, `field.key`) — never the array index. Use `v-show` for frequently toggled elements, `v-if` for rarely shown or expensive ones.
- Derive state with `computed`, don't sync it with watchers; never deep-`watch` large arrays/objects — watch an explicit narrow source instead.
- **Debounce** user-driven query inputs (filter/search boxes) ~300 ms before hitting the API.
- Fetch page data through `useAsyncData` with an explicit key so the SSR result transfers in the payload instead of refetching on hydration; never re-fetch in `onMounted` what SSR already loaded.
- When real images appear, render them via `<NuxtImg>` (`@nuxt/image` is installed) rather than raw `<img>`.

Server (Nitro/Prisma):

- Record lists are always **paginated server-side** (`take`/`skip`, default page size 50, hard cap) — an endpoint must never return an unbounded table.
- **No queries in loops:** batch with `findMany` + `where: { id: { in: […] } }`, `createMany`, or a relation `include` — relation-field display resolution is the case to watch.
- `select` only the columns a response needs; JSONB `data` filtering/sorting goes through Prisma JSON path filters or raw queries Postgres can plan, and new query patterns must check the existing `@@index` coverage first.

These rules target collections that grow with user data (records, fields, tables). Static UI — auth pages, layout chrome — does not warrant `shallowRef`/lazy machinery; the KISS principle from section 3 still wins there.

### Conventions & notes

- Modules enabled in `nuxt.config.ts`: `@nuxt/eslint`, `@nuxt/icon`, `@nuxt/image`, `@pinia/nuxt`. `@nuxt/fonts` was removed — the app ships no webfonts, and the module would try to resolve the `Segoe UI` / `Roboto` names in `_reset.scss`'s system stack from font providers. Do not re-add it until a real webfont exists.
- `ofetch` is a declared dependency because `app/utils/api-error.ts` imports `FetchError` from it by name; without the declaration it resolves only through npm hoisting of Nuxt's tree, so a hoisting change would silently break `typecheck`. `vue-router` is deliberately **not** declared — nothing imports it, and Nuxt owns the version.
- `compatibilityDate` is pinned to `2025-07-15` in `nuxt.config.ts`.
- `h3` and `nitropack` are declared as direct dependencies because server code imports them by name (see "Imports"); keep their versions in step with the one Nuxt resolves.
- TypeScript config (`tsconfig.json`) references the project-reference configs generated into `.nuxt/` (`tsconfig.app.json`, `tsconfig.server.json`, `tsconfig.shared.json`, `tsconfig.node.json`) — these are regenerated by `nuxt prepare`, do not edit them directly.
- Follow Nuxt 4 conventions: `app/pages/` for file-based routing, `app/components/` for components, `app/stores/` for Pinia; `server/api/` for Nitro route handlers.
- **Enforce data ownership through the `server/utils/` helpers** — every table/field/record query (in handlers and services alike) is scoped to the authenticated user.

---

## 3. Architectural & Code Quality Standards

You must strictly adhere to the following software engineering principles:

- **SOLID Principles:**
  - **Single Responsibility (SRP):** Each component, composable, or server utility must have one, and only one, reason to change. Avoid "god" files.
  - **Open/Closed (OCP):** Design code to be open for extension but closed for modification. Use interfaces and polymorphism where appropriate.
  - **Liskov Substitution (LSP):** Ensure derived classes/types can stand in for their base types without breaking behavior.
  - **Interface Segregation (ISP):** Keep TypeScript interfaces and types lean and specific. Client code should not depend on methods it doesn't use.
  - **Dependency Inversion (DIP):** Depend on abstractions (types/interfaces), not concretions. Utilize Nuxt dependency injection features (e.g., provide/inject) where applicable.

- **DRY (Don't Repeat Yourself) & KISS (Keep It Simple, Stupid):**
  - Extract reusable business logic into strictly typed Nuxt composables (`composables/`) or utility functions (`utils/`).
  - When the same logic (a validation block, an error-mapping, a `watch`, a fetch pattern, a Prisma constraint→HTTP mapping) appears in two or more places, immediately extract it into the appropriate shared module before continuing — a composable (`app/composables/`, e.g. `useForm`, `useApi`), a util (`app/utils/` or `server/utils/`, e.g. `resolveSafeRedirect`, `requireOwnedTable`), or a server service (`server/services/`). Never leave duplicated logic in place "for now"; the second occurrence is the trigger to refactor.
  - Do not over-engineer. Write readable, straightforward code over "clever" or overly cryptic micro-optimizations.

- **Readability & Clean Code:**
  - Use **self-documenting code** with highly descriptive variable, function, and component names (e.g., `fetchProductDetails` instead of `getData`).
  - Write concise **JSDoc/TSDoc** comments for complex algorithms or non-obvious business logic. Avoid commenting on what the code does; comment on _why_ it does it.
  - Maintain a consistent file structure aligning with Nuxt 4 layers and server/client separation.

- **Production-Ready Typing:**
  - `any` is strictly forbidden. Use explicit interfaces, generics, or `unknown` with type guards.
  - **Type naming:** project-defined interfaces are prefixed with `I` (`IAuthUser`), project-defined type aliases with `T` (`TCredentialsInput`, `TFieldType`). This applies everywhere — `shared/types/`, component-local types, server types. External and generated types (h3 augmentations, Prisma models, library types) keep their original names.

---

## 4. Styling

All styles in this project are written in **SCSS**, never plain CSS. `sass-embedded` is installed as the compiler. Global styles live in `app/assets/scss/main.scss` (registered via the `css` array in `nuxt.config.ts`); component styles go in `<style lang="scss" scoped>` blocks.

Rules:

- Always use `.scss` syntax — never plain CSS. Vue SFC style blocks must be `<style lang="scss" scoped>`.
- Follow the **BEM** (Block__Element--Modifier) methodology for class names.
- **Sizes are written in rem via the `rem()` helper** from `app/assets/scss/_functions.scss` (16px base): `font-size: rem(14)`, `padding: rem(10) rem(12)`, etc., so the UI scales with the user's browser font-size settings. Plain `px` is reserved for hairline borders (`1px solid …`) and box-shadow offsets/blur. Vue SFC style blocks get `rem()` automatically (injected via `vite.css.preprocessorOptions.scss.additionalData` in `nuxt.config.ts`); standalone SCSS partials must add `@use 'functions' as *;` themselves, and `main.scss` must NOT re-`@use` it (the injected one is already there).
- Use SCSS **nesting with the `&` operator** wherever possible, and never duplicate a parent selector when it can be nested under `&`.
- Use SCSS features (nesting, variables, mixins, functions, `@use`, etc.) to keep styles clean and maintainable.

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
    border-color: var(--color-primary);
  }

  &:hover {
    box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
  }
}
```

- **Reuse before you paste.** A declaration block that would be the second copy of an existing one belongs in `_mixins.scss` instead. Check the mixin list there first — `focus-ring`, `below-shell`, `stack`, `field-label`, `field-error`, `form-control`, `error-banner`, `page-header`, `page-title`, `page-empty`, `text-link` already cover most of what a new component or page needs.
- **There is exactly one breakpoint, and it lives in `_mixins.scss`.** `$breakpoint-shell: 56.25em` (900px) + the `below-shell` mixin — in `_mixins.scss` rather than `_variables.scss` because **a media query cannot read a custom property**, and `additionalData` injects that file into every SFC. `em` rather than `px` so it honours the browser's font-size setting. Add a second breakpoint only when a real layout needs one.
- **Global Styles:** Split into multiple focused partials inside `app/assets/scss/`:
  - `_palette.scss` — the primitive colour ramp, as **SCSS variables** (`$gray-200`, `$blue-600`, …)
  - `_variables.scss` — the public token surface: CSS custom properties built from the palette
  - `_reset.scss` — CSS reset / normalize + base typography (font stack, box-sizing, line-height) + the global `:focus-visible` baseline
  - `_functions.scss` — the `rem()` helper
  - `_mixins.scss` — the shared style fragments listed above; `@use`s `functions` itself, and does **not** re-export `rem()`
  - `_auth-form.scss` — shared `.auth-form` BEM block used by the login/register pages
  - `main.scss` — entry point that `@use`s `variables` / `reset` / `auth-form` (imported in `nuxt.config.ts` via `css: []`)
- **The token layer is three layers, and the boundary is enforced by the build.** `_palette.scss` holds primitives as SCSS variables — and because `additionalData` injects only `functions` and `mixins`, a component _cannot_ reference `$blue-600` without an `@use` it will never have. Components consume `var(--color-*)` and nothing else; that is a compile-time fact, not a convention. `_variables.scss` maps primitives to semantic names (`--color-canvas`, `--color-surface-hover`, `--color-text-subtle`, `--color-text-on-accent`, `--color-accent*`, `--color-danger*`, `--color-focus`, `--color-scrim`, `--shadow-sm/md`) plus geometry (`--radius-sm/md/lg/pill`, `--control-height`, `--control-padding-x`) and type (`--font-size-xs…xl`, `--line-height-tight/base`). **Sass parses custom-property values literally**, so every `rem()` in that file must be interpolated: `--radius-md: #{rem(8)}`.
  - Surfaces are deliberately split even where two share a value today (`--color-surface-hover` / `-disabled` / `-muted`): the previous single `--color-bg` meant page background, row hover, disabled fill and chip fill at once, and re-collapsing them just relocates that bug.
  - **Add a token only when this change consumes it.** The type scale is the one deliberate exception — a ramp is only reviewable as a whole.
- **Focus is never removed, only restyled.** `_reset.scss` carries a zero-specificity baseline — `:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible` — so nothing can end up with no ring, and any component rule overrides it without a fight. Components that need their own ring use the `focus-ring` mixin (`:focus-visible` only, `outline` not `box-shadow`, so an ancestor's `overflow` cannot clip it). `form-control` splits the two signals: `:focus` recolours the border ("this field is active", including programmatic autofocus), `focus-ring` draws the ring ("you are on the keyboard"). Where a link fills a card, the **card** wears the ring via `:has(:focus-visible)` and the link suppresses its own — see `.table-card` in `app/pages/index.vue`.
- **Interactive controls are `--control-height` (44px).** `BaseButton`'s `.base-button` is a neutral chassis; the filled look lives in `&--primary`, which the template always emits (`variant` defaults to `'primary'`). `font-size`/`font-weight` stay on the chassis on purpose — `--ghost` declares neither, so moving them onto `--primary` would silently drop ghost buttons to the UA button default. `--icon` and `--link` are deliberately still small: they set row heights in `DynamicTable`, `BasePagination`, every modal header, `.table-card__actions` and `.field-row`, so they grow when those surfaces are re-laid-out, not before. `BaseSelect` pins `height` rather than `min-height` because **Chrome ignores `line-height` on `<select>`**, which otherwise leaves it 1px taller than the inputs beside it.
- **How `functions` and `mixins` reach a style block:** Vite's `additionalData` prepends `@use` for both to every **entry file and SFC `<style>` block**, so a component uses `rem()` and the mixins without importing anything. It does **not** reach a transitively `@use`d partial — so a standalone partial like `_auth-form.scss` must `@use` both itself, while `main.scss` must not re-`@use` either.
- **Icons:** Use the `@nuxt/icon` module (`<Icon name="collection:icon" />`, e.g. `mdi:close`) for all iconography — **never text glyphs/symbols** (`×`, `+`, `✓`, `→`, `…`) as icons; a text character is not an icon. For icon buttons use `BaseButton`'s `icon` prop rather than hand-rolling. Prefer SVG sprites over icon fonts.

---

## 5. Testing Strategy

There is no test suite configured in this repository yet — no unit runner and no E2E suite. Until one exists, the safety net is **CI + the type system**: `.github/workflows/ci.yml` runs `format:check` → `lint` → `typecheck` → `build` on every push to `main`/`develop` and on every PR, and the metadata registries are total `Record<TFieldType, …>` maps, so an unhandled field type is a compile error rather than a runtime surprise.

Behavioural changes are verified by driving the running app (dev server + browser) and, for pure logic, by throwaway scripts — which is exactly the gap a real suite would close. The regression surface worth walking after any change to the metadata layer: record CRUD across **every** field type, a filtered URL loaded cold (it must render filtered on first paint), `BaseRange` resyncing on "Clear all" and the back button, sort/page history, and the console for hydration mismatches. Relations add: a link renders as its label rather than an id, sorting that column is alphabetical by label, deleting a target record degrades the cell to "Unknown record", and deleting a targeted table is refused. Record columns add: `#9` sorts before `#10` (integer, not text), a number filter matches partially, a created record takes the next number and a deleted one's is never reused, and a `Created at` range whose from and to are the same day still matches records made later that day (the `::date` cast). Vitest (unit: the URL codec, the SQL builder, the zod schemas) and Playwright (E2E over the auth-gated pages) are the intended additions once the MVP settles.

---

## 6. Environment

Configuration lives in a gitignored `.env` at the repo root (copy `.env.example` to start):

- `DATABASE_URL` — PostgreSQL connection string used by Prisma; points at the Docker container from `docker-compose.yml` (`postgresql://flexbase:flexbase@localhost:5432/flexbase`).
- `JWT_SECRET` — secret for signing auth JWTs; exposed to Nitro via `runtimeConfig.jwtSecret` in `nuxt.config.ts`.

`npm install` runs `prisma generate && nuxt prepare` via postinstall, regenerating the Prisma client and the `.nuxt/` configs.

---

## 7. Commands

```bash
npm run dev          # start dev server at http://localhost:3000
npm run typecheck    # vue-tsc only (~7s) — the fast inner-loop type gate
npm run build        # production build — also runs vue-tsc; a TS error fails the build (~30s)
npm run preview      # preview a production build locally
npm run lint         # eslint
npm run format       # format all files with Prettier
npm run format:check # check formatting without writing
```

`typecheck` is the one to reach for while iterating: same `vue-tsc` errors as the build, a quarter of the time, and it never rewrites `.output`. Keep `build` as the pre-commit gate — it is the only step that exercises Vite/Nitro bundling.

Database workflow (PostgreSQL runs in Docker — never use OSPanel's bundled modules):

```bash
npm run db:up                         # docker compose up -d --wait
npm run db:studio                     # browse data in a GUI
docker compose up -d --wait           # start PostgreSQL (postgres:17, container flexbase-postgres)
npx prisma migrate dev --name <name>  # create & apply a migration
npx prisma generate                   # regenerate the Prisma client (into server/generated/prisma, gitignored)
npx prisma studio                     # browse data in a GUI
```

---

## 8. Project-Specific Context

- **Package Manager:** This project uses **npm** (`package-lock.json` present).
- **Prisma 7 notes:** CLI configuration lives in `prisma.config.ts` (which loads `.env` via `dotenv/config` — Prisma 7 no longer reads `.env` itself); the client is generated by the `prisma-client` provider into `server/generated/prisma` (entry `client.ts`) and requires the `@prisma/adapter-pg` driver adapter at runtime (see `server/utils/prisma.ts`). `postinstall` runs `prisma generate && nuxt prepare`.
- **Tooling:** Prettier (`.prettierrc`: no semicolons, single quotes, 2-space indent, `printWidth` 100) formats `.vue`, `.ts`, `.js`, `.scss`, `.json`, and `.md` — including SCSS and `<style lang="scss">` blocks natively; build/generated output is excluded via `.prettierignore`. ESLint handles code quality only: `eslint.config.mjs` imports the config generated into `.nuxt/` by `nuxt prepare`/postinstall, with `eslint-config-prettier` appended to disable rules that would conflict with Prettier. It adds one project rule — `no-restricted-imports` banning relative paths under `app/`, `server/` and `shared/` (see "Imports").
- **Type checking:** `nuxt.config.ts` sets `typescript.typeCheck: 'build'`, so `nuxt build` runs **`vue-tsc`** (deps: `vue-tsc`, `typescript`) and fails on any type error — `.vue` templates included. Dev (`nuxt dev`) does **not** type-check (kept fast); rely on `npm run build` as the type gate. `nuxt build` without this option only strips types (esbuild), so it would not catch type errors.
- **Current State:**
  - Nuxt 4.5.0 + Vue 3.5.40 + TypeScript + Pinia + SCSS (`sass-embedded`); ESLint (`@nuxt/eslint` flat config) + Prettier configured; build-time type checking via `vue-tsc` (`typescript.typeCheck: 'build'`)
  - **app/app.vue** — page titles via `useSeoMeta` + `titleTemplate` ("… — FlexBase"); `lang="en"` set in `nuxt.config.ts` `app.head`; auth-page field errors clear live as the user edits a field
  - **app/assets/scss/** — `main.scss` entry `@use`s `_variables.scss`, `_reset.scss`, `_auth-form.scss`. `_variables.scss` builds the token surface from `_palette.scss` (primitives as SCSS variables) and `@use`s both `palette` and `functions`; the `*-tint` alpha washes are spelled out because a custom property's alpha cannot be modified in CSS. `_functions.scss` (`rem()`) **and `_mixins.scss`** are both auto-injected into SFC styles via Vite `additionalData`; a standalone partial gets neither, so `_auth-form.scss` `@use`s both itself (and `_mixins.scss` `@use`s `functions`, since it does not re-export `rem()`). Mixins: `focus-ring($offset)`, `below-shell` (the project's one breakpoint, `$breakpoint-shell: 56.25em`), `stack($gap)`, `field-label`, `field-error`, `form-control`, `error-banner`, `page-header` (wraps + gaps, so a long table name cannot push the actions off the row), `page-title` (truncates), `page-empty`, `text-link`. `back-link` was deleted with the last "← Your tables" link when breadcrumbs replaced them
  - **Design direction: "Workspace"** (chosen after a six-concept exploration) — a deliberately plain, familiar office-app look for a largely non-technical audience: 16px base, 44px minimum target, 8px control radius, a single accent blue (`#1C64D8`), two shadows, borders doing the structural work. **Phases 1–3 of 5 are complete**: the token layer and focus ring, the app shell (header + persistent table sidebar + breadcrumbs), and the records page (52px rows, the filter summary line, worded pagination, friendlier cell copy). **The 44px minimum target is now met everywhere**, icon-only buttons included. Still to come — table-scoped search (4) and a sweep of the remaining pages (5)
  - **The 44px icon change had three forced consequences**, all already absorbed: `BaseModal`'s header padding dropped to `rem(10)` so its close button does not push every dialog's header from 60px to 76px; `DynamicTable`'s action cell took `padding-block: rem(4)` + `align-items: center` (it is `display: flex`, which removes it from table layout, so it must centre its own content); and the layout's hand-rolled sidebar toggle had to be sized explicitly, since it is not a `BaseButton` and would otherwise drift
  - **`DynamicTable` rows are `height: rem(52)` on `tbody td`**, not derived from the tallest cell — before this the action cell's buttons defined the row, which is exactly why a 44px button would have pushed rows to 64px. `th` padding moved onto the `&__sort` button so the whole header cell is a ≥44px target rather than a ~20px text run. A bordered row measures 53px (52 + the 1px rule); the last row, which drops its border, measures 52
  - **`app/utils/format.ts`** — every `Intl` formatter in one place (`formatNumber`, `formatDate`, `formatDateProse`, `formatTimestamp`), lifted out of the three cells that each built their own. Locales stay hard-coded `en-GB` and `formatTimestamp` pins `timeZone: 'UTC'`: an `undefined` locale renders differently on the server and in the browser, which is a hydration mismatch. The prose date (`1 Jan 2026`, for the filter summary) and the column date (`01 Jan 2026`) are two named constants, never one formatter reconfigured per call
  - **app/layouts/default.vue** — the shell: a CSS grid of `var(--sidebar-width) minmax(0, 1fr)` under a full-width `var(--header-height)` header. **`minmax(0, 1fr)` plus `min-width: 0` on the main region is load-bearing** — without it the column's min-content width is `DynamicTable`'s full intrinsic width, so it never shrinks, the table's `overflow-x` never engages, and the whole document scrolls sideways instead. Below `below-shell` the grid collapses to one column and the sidebar becomes `position: fixed`, translated off-canvas, opened by a header toggle (`aria-expanded`/`aria-controls`) over a scrim; it closes on Escape (same listener shape as `BaseModal`), on scrim click, and on route change. Sidebar `z-index: 50` / scrim `40`, both below `BaseModal`'s `100`, so a dialog still covers the shell. A **full focus trap is deliberately not attempted** — that machinery arrives with `BaseMenu` in phase 3
  - **The table list is fetched by the layout, once per session.** `tables.ts` gained `loaded` / `failed` flags and `ensureTables()`, mirroring `auth.initialized` — both survive SSR→client because `@pinia/nuxt` serialises the store tree into `payload.pinia`. **`ensureTables()` never throws**: there is no `app/error.vue`, so a rejection in the layout's async setup would replace every authenticated page with Nuxt's full-page error; instead it sets `failed` and the sidebar says so inline with a Retry. The layout uses key `app-tables` and the dashboard `dashboard-tables` — **never the same key**, because `useAsyncData` does _not_ dedupe a layout against a page in one SSR render (it would fire two requests and warn `NUXT_E3004`, with the page's closure silently never called). The dashboard's handler is client-only (`if (import.meta.client)`), so counts refresh when you return Home while SSR still costs exactly one request. Known and accepted: `_count.records` drifts between Home visits, since `records.ts` is independent of `tables.ts`
  - **app/components/app/** — `AppSidebar.vue` (Home + the table list with record counts + "Add a table", which creates and navigates straight into the new table; active state compares `route.params.tableId`, **not** the path, because `/tables/:id` is a string prefix of `/tables/:id/records` and a path check would be ambiguous — the param marks the table active on both inner pages) and `AppBreadcrumbs.vue` (**prop-driven**, `IBreadcrumb[]` from `app/types/breadcrumb.ts`; each page passes its own because the pages already hold the `ITable` they fetched, which is also what produces their 404 — deriving the name from the store in the layout would quietly delete that guard)
  - **app/components/common/**
    - `BaseInput.vue` — labeled input atom (`type` is `text`/`email`/`password`/`number`/`date`; v-model with `.trim` support, optional `label` [hidden when omitted], placeholder, autofocus, error display with `aria-invalid`/`aria-describedby`); used by the auth pages, the `FieldFormModal` choices editor, the TEXT/NUMBER/DATE field inputs and the TEXT filter. Bound with `:value` + `@input` rather than `v-model`, which would cast a `type="number"` input's value to a number and write `1.5` back while the user is still typing `1.50` — the composition guard `v-model` provides is kept by hand instead, so IME input still works. Two props exist for **grouped** controls, where a wrapper owns the visible label and the error line: `ariaLabel` (fallthrough attrs would land on the root `<div>`, not the input) and `invalid` (invalid border with no inline message; `error` still implies it). Two more serve callers that bind props rather than `v-model`: `debounce` (ms to hold a keystroke before writing out; `0` = write through synchronously, the default every form relies on) and `trim`, the `.trim` modifier as a prop — `<component :is>` cannot pass v-model modifiers
    - `BaseButton.vue` — button atom (type/disabled props, slot content); `primary` (default) / `danger` / `icon` / `ghost` / `link` variants, applied as one `base-button--${variant}` class. **`.base-button` is a neutral chassis** (flex centering, radius, type, `focus-ring`, `:disabled`) and the filled look lives in `&--primary` — which costs no template change, because the template always emits a variant class. `primary`/`danger`/`ghost` are `min-height: var(--control-height)`; `icon` and `link` stay small on purpose (they set row heights across the app — see §4). `font-size`/`font-weight` must stay on the chassis: `--ghost` declares neither. `icon` is a borderless icon-only button taking `icon` (iconify name) + `label` (aria-label/title); `link` is a bare text button for row actions (the chrome of a link, the semantics of a button) used for Rename/Edit/Delete on the dashboard and field manager. Both read a `--hover-color` custom property that each variant defaults for itself (`icon` → text, `link` → accent); the optional `hoverColor` prop overrides it via an inline style, which is how the Delete actions and the choice-remove button go danger-red — all four call sites pass the same `var(--color-danger)`, so this wants to become a typed `tone` prop. Per-variant defaults are why this is a custom property rather than the `v-bind` it used to be. The `ghost` variant is a transparent text+icon button with a faint accent hover background (`--color-accent-tint`). Every variant has `:hover`, `:active` and a keyboard focus ring. First `@nuxt/icon` `<Icon>` usage in the app.
    - `BaseSelect.vue` — generic labeled select atom (`generic="TValue extends string"`, typed `options`, `disabled` prop, error display), used by `FieldFormModal`, `SelectFieldInput` and both the SELECT and BOOLEAN filters
    - `BaseCheckbox.vue` — labeled checkbox atom (`defineModel<boolean>`, a `<label>` wrapping the input, plus optional `id` / `error` so it honours the same uniform binding `DynamicForm` gives every input); used by `FieldFormModal` and the BOOLEAN record input
    - `BaseRange.vue` — the two-bound range atom, knowing nothing about filters: **one** label above a 1fr/1fr grid of bare `BaseInput`s (no per-input labels, no `<fieldset>`/`<legend>`), on the same tokens as `BaseInput`. A required `type` prop (`number` | `date`) picks the bound's DOM type and how it parses; one default `v-model` of `INumberRange | IDateRange` (`shared/types/range.ts` — shared because the filter codec speaks the same shapes; a filter-free module, so the atom stays filter-independent), where a `null` bound means "no bound", never zero. The bounds container is a `role="group"` named by the label, and each input carries an `aria-label`. It keeps the typed text in local refs synced by a `watch` — re-deriving it from the value would rewrite the field mid-typing (`1.50` → `1.5`), so the watcher resyncs **only a bound that disagrees with what is on screen**, which is what distinguishes an outside change (clear all, a shared URL, the back button) from the value being echoed back. Dates run through the same drafts even though their round trip is lossless, which is exactly what lets one component serve both types. Takes a `debounce` prop forwarded to both bounds
    - `BaseModal.vue` — dialog atom (teleport, backdrop/Esc close, `role="dialog"`, optional `footer` slot outside the scrolling body). `variant`: `dialog` (default, centered card) / `drawer` (same chrome anchored to the right edge, full height, body scrolls) — the drawer is a variant rather than its own component so the teleport/backdrop/Esc logic exists once
    - `BaseBadge.vue` — slot-content badge atom; `chip` (default: pill, `rem(13)`, normal case, inherits colour — displays a _value_, used by `SelectFieldCell`) / `label` (`rem(11)`, uppercase, muted — a _meta marker_, used for `required` on the field manager rows). Never uppercase the `chip` variant: SELECT values are user data
    - `BasePagination.vue` — prev/next pager with an "x–y of n" range label; props `page` / `pageCount` / `pageSize` / `total`, emits `update:page` (so callers can use a plain listener or `v-model:page`). `pageCount` is passed in rather than derived so the `ceil` formula lives only in the store. Owns its internal layout only — the consumer positions it (the records page applies `margin-top` via a class on the component root)
    - Component auto-import uses `pathPrefix: false` in `nuxt.config.ts`, so `common/BaseInput.vue` registers as `<BaseInput>` — components are the **only** thing still auto-imported (see "Imports")
  - **app/field-types/** — the whole per-field-type surface of the client, in one folder outside `~/components` (so nothing here is globally registered — these are only ever reached through the registries). See "Adding a new field type"
    - `types.ts` — `IFieldControl<TValue>` (`component` + `props(field)` factory + optional `toControl`/`fromControl` adapters), the shape **both** control tables share; `TRecordFieldControl` = `Required<IFieldControl<TRecordValue>>`, since a record input always adapts (a DOM control speaks strings and checkboxes, never `TRecordValue`) — which is why `DynamicForm` never branches on an optional adapter; and `IFieldCellProps` (`field` + `value`, the same pair the control tables get — only RELATION reads the field, to know which link it is resolving)
    - `inputs.ts` — `FIELD_INPUTS: Record<TFieldType, TRecordFieldControl>`, the branch point for **editing** a record. TEXT/DATE/SELECT share one `blankIsNull` adapter (a blank control means "no value", never `''`); NUMBER keeps the real parse (unparseable text passes through so the schema reports "Enter a number"); BOOLEAN maps to `BaseCheckbox`; RELATION reuses `blankIsNull` over the shared picker
    - `filters.ts` — `FIELD_FILTERS: { [K in TFieldType]: IFieldControl<IFilterValueByType[K]> }`, the branch point for **filtering**: TEXT a `BaseInput` (`Contains…`, debounced, trimmed; matching is always case-insensitive and partial), SELECT a `BaseSelect` whose options come from the field's own metadata, NUMBER/DATE a `BaseRange` with its `type`, RELATION the same picker the form uses (so a filter offers exactly what a record can link to). Only BOOLEAN adds adapters, because a `<select>` speaks strings while its filter value is `boolean | null` (`null` = "All", since a two-state control cannot express "either"); the rest pass straight through. **No control knows an operator** — the value is the whole contract, and `FILTER_VALUE_BY_TYPE` maps it to conditions at the serialization boundary
    - `cells.ts` — `FIELD_CELLS: Record<TFieldType, Component>`, the branch point for **displaying** a record. Cells stayed components while inputs became table rows: a cell carries markup and scoped styles (an icon, tabular figures), not just a value, so a `format | component` union would be worse than one uniform contract
    - `record-columns.ts` — `RECORD_COLUMNS`, the client half of the record-column registry (see "Record columns"): per reserved key, where the value comes from and which cell renders it. `RecordNumberCell` and `TimestampCell` (`cells/`) belong to it rather than to a field type, which is why they are not named `*FieldCell`
    - `cells/{Text,Number,Boolean,Date,Select,Relation}FieldCell.vue` — one read-only cell per type (BOOLEAN → `mdi:check`/`mdi:minus` icon, SELECT → chip, NUMBER/DATE → fixed `en-GB` `Intl` formats so SSR and client output match, RELATION → the label the page resolved, or a muted "Unknown record" once the target is gone). Blank values never reach a cell — `DynamicTable` renders the placeholder itself
    - `controls/RelationFieldSelect.vue` — the **only** control that is a component rather than a registry row, because a relation's candidates are records of another table (see "Relations"). One component for both tables: `blankLabel` is "— Select —" when editing and "All" when filtering. A linked record the candidate list does not offer — beyond `RELATION_OPTIONS_LIMIT`, or since deleted — is appended as its own option, so opening a form can never drop a link on save
    - All three tables are `markRaw`ped module constants, so Vue never deep-proxies the components and nothing is rebuilt per render
  - **app/components/records/** — the three metadata renderers
    - `DynamicForm.vue` — renders a form from `IField[]` by walking `FIELD_INPUTS`: `v-bind`s each entry's `props(field)`, passes the value through `toControl`, and pushes what the control emits back through `fromControl`. Values flow down as props and changes back up via `update: [key, value]`, so the parent's `useForm` object is never mutated. Structurally identical to `RecordsFilterPanel` — one pattern, two tables
    - `DynamicTable.vue` — renders a table from `queryFields(fields)` + `IRecord[]`, so the record's own columns bracket the table's fields and **one** `columns` list drives header and body alike. Two resolvers keep the body loop uniform: `cellValue` reads `RECORD_COLUMNS` first and falls through to `record.data`, `cellComponent` likewise falls through to `FIELD_CELLS` — no branch on a key or a type anywhere in the template; emits `edit`/`delete`/`sort`, optional `sort` prop drives `aria-sort` + the header arrow icon (`mdi:arrow-up`/`mdi:arrow-down`/`mdi:unfold-more-horizontal`), horizontal scroll wrapper (the body never scrolls sideways, even at 375px), `—` placeholder for blank values
    - `RecordsFilterSummary.vue` — the active filters, stated **above** the data instead of hidden behind the drawer that covers it. One removable chip per filter, worded by `FILTER_SUMMARIES`, plus the live match count and "Show all records". It lives on the page, not in the drawer, because the drawer is `v-if`-gated and only exists while open. Iterates `queryFields(fields)` and looks each key up in the filter map — never `Object.entries(filters)`, which would surface a key with no field to pair it with — so chip order matches the drawer and the URL. Removing one chip reuses the drawer's rebuild (blank that field, drop the empties) and the page's `applyFilters`, which resets to page 1 and **replaces** rather than pushes. It replaced the count badge that used to sit inside the Filters button
    - `RecordsFilterPanel.vue` — the filter drawer (`BaseModal variant="drawer"`): one control per `queryFields(fields)` entry from `FIELD_FILTERS` (so `Record #` leads with a partial-match text box and the two timestamp ranges trail), bound to `filters[field.key]` (falling back to the type's empty value). Merges a field's new value into the map, rebuilt in field order so URLs stay stable and dropping anything `isFilterValueEmpty`, so the map only ever holds active filters; emits `update:filters`. Footer shows the live match count (the drawer covers the table, so the count is the feedback) and a "Clear all" button
  - **app/components/modals/**
    - `ConfirmModal.vue` — universal confirmation dialog: slot body, `title` / `confirmLabel` / `danger` / `pending` props (Cancel is always "Cancel")
    - `TableFormModal.vue` — self-contained create/rename form built on `useForm`; takes an async `submitHandler` prop, emits `saved`
    - `FieldFormModal.vue` — self-contained typed-field editor (name, type select [immutable on edit], required, SELECT choices editor, RELATION target + label-field selects [target immutable on edit, label not]) built on `useForm`. The target's fields are fetched straight through `useApi()` into a local `shallowRef`, **not** the fields store — that store holds the table being edited, and loading another table's fields into it would clobber the page behind the modal. RELATION-typed candidates are excluded from the label list: a link labelled by a link would read as an id
    - `RecordFormModal.vue` — self-contained record editor; derives both its initial values (`blankValueFor`) and its schema (`buildRecordSchema`) from field metadata and renders `DynamicForm`
  - **app/composables/**
    - `useApi.ts` — the `useRequestFetch` seam (its one job: keep callers off bare `$fetch`, which drops cookies during SSR)
    - `useForm.ts` — reusable form state (fields keyed `Record<string, unknown>`, per-field errors, server error, pending, submit); used by the auth pages, `TableFormModal`, `FieldFormModal`, `RecordFormModal` (its dynamic key handling is what lets one composable drive metadata-generated forms)
    - `useDeleteConfirm.ts` — the confirm-then-delete flow all three list pages repeat: `target` (a `shallowRef`, set by the row's Delete button), `pending`, a `confirmLabel` that reads "Deleting…" while in flight, `confirm` and `cancel`. The target is cleared **only on success**, so a failed delete leaves the dialog open rather than silently dismissing it
    - `useDebouncedModel.ts` — returns a **writable** local `draft` of a `v-model` that writes back on a delay (default 300 ms), re-synced by a `watch` when the model changes from outside (clear all, a shared URL, the back button), and skipping the write when the draft already agrees with the model — that is an outside change echoing back, not an edit. Optional `normalize` runs on the way to the model only, so trimming cannot eat spaces mid-typing. A `delay` of 0 writes through **synchronously**, which is what lets `BaseInput` use one code path for both debounced and undebounced callers. Owns its own `debounce` timer; it is an internal of `BaseInput` rather than anything filter-specific
  - **app/layouts/**
    - `default.vue` — the app shell: full-width header (brand, user email, logout, plus the sidebar toggle below the breakpoint) over a persistent table sidebar and the content region. Owns the once-per-session table-list fetch
    - `auth.vue` — centered card
  - **app/middleware/**
    - `auth.global.ts` — global route guard: session restore + redirects (both directions)
  - **app/pages/**
    - `auth/login.vue` — validates with the shared zod schema, fields rendered via `BaseInput`
    - `auth/register.vue` — validates with the shared zod schema, fields rendered via `BaseInput`
    - `index.vue` — tables dashboard: card grid with field/record counts, create/rename via `LazyTableFormModal`, delete via `LazyConfirmModal`, empty state. A card opens the table's **records** page
    - `tables/[tableId]/index.vue` — field manager: typed-field list, add/edit via `LazyFieldFormModal`, delete via `LazyConfirmModal`, empty state, link through to records
    - `tables/[tableId]/records/index.vue` — record view: `DynamicTable` + a header "Filters" button (badge = **filtered fields**, so a two-bound range counts once) opening `LazyRecordsFilterPanel`, create/edit via `LazyRecordFormModal`, delete via `LazyConfirmModal`, paging via `BasePagination`, and three empty states (no fields → link to the field manager, "New record" disabled; no records; no filter matches → clear-all button). **The URL query is the single source of truth** for filter/sort/page: `queryParams` is `parseRecordQueryState(fields, route.query)` — page, sort and filters in one shot, so the page parses nothing itself — every control writes back through `toRecordQueryParams`, and one `watch(queryParams)` refetches. Sort/page navigations are pushed (back steps through them); live filter edits `replace`, or a few keystrokes would bury the previous page. Records and relation options are fetched **after** fields resolve (in parallel with each other) — filters decode against field metadata, so a shared filter URL would otherwise render unfiltered on first load, and a relation filter's picker would have nothing to show the chosen link as
  - **app/stores/**
    - `auth.ts` — Pinia auth store (user, initialized, fetchUser/register/login/logout)
    - `tables.ts` — Pinia store (`shallowRef` table list, fetch/create/rename/delete)
    - Deleting a table/field/record from a page goes through `useDeleteConfirm`, not a hand-rolled pending flag
    - `fields.ts` — Pinia store (`shallowRef` field list, fetch/create/update/delete)
    - `records.ts` — Pinia store (`shallowRef` record page + `total`/`page`/`pageSize`/`pageCount`/`pending`, fetch/create/update/delete). **Every action takes the query params from the caller** — the store never mirrors them, because a mirrored copy would have to survive SSR hydration to stay correct. `createRecord` **returns the page the new record landed on** (1 in the default view — no filters, newest first — otherwise the current one) and only refetches when that equals the current page; the records page navigates when it differs, so the URL never shows one page while the table shows another, and the refetch still happens exactly once. For an edit that may move a record out of a filtered or sorted view, the current page is refetched rather than spliced. State is cleared when `fetchRecords` is called for a different table, since the store is a singleton. Each fetch forwards the page's `relationLabels` to the relations store, which is where a cell reads them
    - `relations.ts` — Pinia store, the single client-side home for relation display data: `optionsByField` (a picker's candidates) + `labelsByField` (id → label), both keyed by **field id**, since two relations may point at one table through different label fields. `loadOptions(tableId, fields)` fetches every relation field's candidates in parallel and makes no request at all for a table without relations
  - **app/utils/**
    - `api-error.ts` — `getApiErrorMessage` reads Nitro's `createError` message off `FetchError.data`, with a generic fallback (a pure function, so it lives here rather than beside `useApi`)
    - `safe-redirect.ts` — `resolveSafeRedirect` restricts `?redirect` to internal paths (used by the auth guard and auth pages to return users to their intended destination after login)
  - **server/api/**
    - `auth/` — 4 endpoints: `register.post`, `login.post`, `logout.post`, `me.get`
    - `tables/` — `index.get`, `index.post`, `[tableId].get`, `[tableId].patch`, `[tableId].delete`
    - `tables/[tableId]/fields/` — `index.get`, `index.post`, `[fieldId].patch`, `[fieldId].delete` (each gated by `requireOwnedTable`; the two writes additionally call `requireFieldTarget`), plus `[fieldId]/options.get` — the records a RELATION field can link to, scoped by the **source field** so the target is read from stored metadata rather than trusted from the client
    - `tables/[tableId]/records/` — `index.get` (gated by `requireOwnedTableFields`; validates with `buildRecordQuerySchema(fields)`, then composes `IRecordQuery` from `parseRecordQueryState(fields, params)` + the validated `pageSize` — the schema judges, the codec decodes), `index.post`, `[recordId].patch`, `[recordId].delete`. Writes are gated by `requireRecordFields` and validated with `buildRecordSchema(fields)`, so the payload contract is the table's own metadata
  - **server/middleware/**
    - `auth.ts` — resolves the auth cookie to `event.context.user` on every request (never rejects)
  - **server/services/**
    - `tables.ts` — list/create/rename/delete scoped by `userId`; `deleteTable` refuses with 409 when another table's RELATION field targets it, since `options` JSON carries no foreign key for the cascade to protect. Exports `tableSelect` (the table's own columns, no `_count`) so `requireOwnedTable` shares one definition; `tableListSelect` spreads it and adds the counts only the dashboard needs
    - `fields.ts` — list/create/update/delete scoped by `tableId`; auto-derives immutable `key` (slugify + dedupe), `order`, and DB `options` from `type` + `choices`/`targetTableId`+`labelFieldKey`; rejects type changes and RELATION retargeting (400, each). A new key must be free for **every query param it would claim**, not just for itself, since filters are named after the field: a field called "Page" becomes `page_2`, and "Budget from" becomes `budget_from_2` next to a NUMBER `budget`. Exports `fieldSelect` + `toFieldMetadata` (the one place Prisma's untyped `options` JSON is narrowed to `IField`)
    - `records.ts` — paginated list (`$transaction` of two `$queryRaw`s sharing one WHERE fragment, `LIMIT`/`OFFSET`, plus the page's `relationLabels`), create/update/delete scoped by `tableId`; `data` is replaced wholesale on update, and every write passes `assertRelationTargets` first. `createRecord` allocates `Record.number` from `Table.recordCounter` inside the insert's own transaction (see "Record identity")
    - `relations.ts` — the only module that knows what a RELATION means (see "Relations"): `resolveRelationLabels` (a page's labels, one query per target table), `assertRelationTargets` (a write's referential integrity), `listRelationOptions` (a picker's capped, label-ordered candidates)
    - `record-query.ts` — the only SQL in the project: `buildRecordWhere(tableId, fields, filters)` + `buildRecordOrderBy(fields, sort)`. Raw because Prisma cannot `orderBy` a JSON path. **There are no operators:** one total map, `FIELD_SQL_BY_TYPE`, gives each field type an `expr` (the JSONB projection a **filter** compares against — `::numeric`/`::boolean` casts, plain text for TEXT/DATE/SELECT/RELATION), an optional `sortExpr` (how the column **orders**, when that differs — RELATION's correlated subquery over the target's label field is the only one) and a `filter` (how its value compares: `matchesPartially` = `ILIKE` with escaped wildcards, `matchesExactly` = `=`, `withinRange` = inclusive `>=`/`<=` for whichever bounds are set). `RECORD_COLUMN_SQL` is consulted before that map, for the columns of `Record` itself that a query treats as fields (`number`, `createdAt`, `updatedAt` — each with its own `expr`/`sortExpr` split; see "Record columns"). `buildRecordWhere` walks the table's **fields** and looks each one up in the filter map, so a key the table does not own has nothing to compare against; everything is ANDed. Keys and values are bound as parameters, never interpolated, and the key is `::text`-cast to disambiguate Postgres' `->>` overloads. `buildRecordOrderBy` falls back to `"createdAt" DESC` (newest first, per `DEFAULT_SORT_DIR`); under an explicit field sort, blanks go `NULLS LAST` and ties break on `"createdAt" DESC` — newest first there too, which also keeps paging stable
  - **server/utils/**
    - `prisma.ts` — PrismaClient singleton with `PrismaPg` adapter (globalThis-cached in dev)
    - `auth.ts` — bcrypt hash/verify, JWT sign/verify, `auth_token` cookie helpers, `requireUser`
    - `ownership.ts` — `requireOwnedTable(userId, tableId)`: single scoped query, 404 when missing/foreign; `requireOwnedTableFields(userId, tableId)`: same check plus the table's field metadata in one round trip (reads need it to resolve sort/filter params); `requireRecordFields(userId, tableId)`: the same, plus a 400 when the table has no fields — for writes only, since a field-less table must still list an empty page; `requireFieldTarget(userId, input)`: a RELATION may only point at an owned table, labelled by a field that table has (404 / 400). Ownership assertions live here rather than in the services because this module already imports them — the reverse would be a cycle
    - `prisma-errors.ts` — `toHttpError(error, { conflict?, notFound })`: shared Prisma `P2002` → 409 / `P2025` → 404 mapping used by all three services
  - **shared/types/** — declarations only; every module here is erased at build time
    - `auth.ts` — `IAuthUser` interface
    - `table.ts` — `ITable` / `ITableListItem` (with `_count`)
    - `field.ts` — `TFieldType` (`typeof FIELD_TYPES[number]`, via an `import type` of the constant), `IFieldOptions` (SELECT's `choices`, RELATION's `targetTableId` + `labelFieldKey`), `IField`
    - `record.ts` — `TRecordValue` / `TRecordData`, `IRecord` (its `number` is the id a user reads; `id` stays the cuid relations reference), `IRecordPage` (records + paging + `relationLabels`, keyed by relation field id then target record id), `IRecordOption` (a target record as a picker offers it), `IRecordQueryState` (**one** resolved list query — `page` + `sort: IRecordSort` + `filters: TRecordFilterValues` — held by the client and produced by the API alike) / `IRecordQuery` (the same, `extend`ed with the `pageSize` only the server resolves) / `IRecordQueryParams` (what the query schema guarantees: validated page/pageSize/sort/dir over an open record, the filter params riding along for the codec)
    - `range.ts` — `INumberRange` / `IDateRange`, the two-bound shapes shared by `BaseRange` and the filter codec. Deliberately its own module rather than part of `filter.ts`, so the atom stays filter-independent
    - `filter.ts` — **there are no operators anywhere in the project.** `TFilterValue` / `IFilterValueByType` (the value shape per field type — extending the total `Record` makes a missing type a compile error) / `TRecordFilterValues` (**the filter model of every layer:** typed values keyed by `Field.key`, sparse, so an absent key is unfiltered and the count of filtered fields is `Object.keys(…).length`) / `TFilterShape` (`scalar` | `range`) / `IFilterValueSpec` (what the registry declares per type) / `TFilterParamRole` (`value` | `from` | `to`) / `IRecordSort` / `TSortDirection`
  - **shared/constants/** — the runtime registries, values only
    - `field.ts` — `FIELD_TYPES` (which `TFieldType` is derived from, and which every creatable type is in) / `FIELD_TYPE_LABELS`
    - `filter.ts` — `FILTER_VALUE_BY_TYPE` (per type: its `shape` and its `empty` value; the shape is the single fact that names its params _and_ tells the server how many bounds to compare), `DEFAULT_SORT_KEY` (`createdAt`) + `DEFAULT_SORT_DIR` (`desc` — **newest first**, so a record added now is at the top of page 1; the same `@@index([tableId, createdAt])` serves it, since Postgres scans a btree backwards), `RESERVED_QUERY_PARAMS` (`page`/`pageSize`/`sort`/`dir` — filter params share their namespace), `RECORD_NUMBER_KEY` / `CREATED_AT_KEY` (which `DEFAULT_SORT_KEY` is defined as) / `UPDATED_AT_KEY` + `RESERVED_FIELD_KEYS` (the keys naming a record's own columns rather than a table's fields — see "Record columns")
    - `record.ts` — `RECORD_PAGE_SIZE` (50, the store's seed) / `RECORD_PAGE_SIZE_MAX` (100, the schema's hard cap) / `RELATION_OPTIONS_LIMIT` (200, a picker's cap) / `UNKNOWN_RECORD_LABEL` (what a link reads as once its target is gone — a _blank_ label is a different fact, and falls back to the record's number instead)
  - **shared/utils/**
    - `record-label.ts` — `buildRecordLabel(record, labelFieldKey)`, the one rule for how a record reads when something links to it. Both server paths (a page's labels and a picker's candidates) go through it, so the two can never disagree; a blank or deleted label field falls back to `#<number>`, which keeps two unlabelled records apart in a picker
    - `filter.ts` — pure leaf: `recordColumn(key, name, type)` + `queryFields(fields)`, which wraps a table's fields in the record's own columns in presentation order (the seam — see "Record columns"); `filterParamSlots(key, type)` (the params a field claims, each tagged `value`/`from`/`to`) / `filterParamNames(key, type)` (the names alone, for the field-key guard) / `rangeParamName(key, bound)`, all over one private `RANGE_PARAM_SUFFIX`; `claimFilterParams(fields)` resolves each param name to at most one field — reserved names first, then fields in order — so a legacy key that shadows another field's range bound stays deterministic (the query schema and the codec both read it); `isRangeFilterValue` / `isFilterValueEmpty` are shape-based, so they need no field metadata
    - `record-query.ts` — the URL codec: `parseRecordQueryState(fields, query)` / `parseFilterValues(fields, query)` / `toFilterParams(values)` / `toRecordQueryParams(state)`, shared by the page, the store and the records endpoint, so a shared link and the fetch behind it cannot diverge. `parseRecordQueryState` is the **exact inverse** of `toRecordQueryParams` and the one reader both sides use — the page over `route.query`, the endpoint over its validated params — so a link cannot decode two ways; it is lenient by design, since rejecting bad input is the schema's job. Decoding goes straight from params to typed values (no intermediate condition model), narrowing a range **by value shape**, never by field type; it borrows `buildFilterValueSchema` from the validation layer so a value decodes exactly as it validates
  - **shared/validation/** — zod schemas and nothing else
    - `auth.ts` — zod `credentialsSchema` (login and register share it) / `registerSchema`
    - `name.ts` — `nameSchema`, the one rule for every user-visible name (1–100 chars); tables and fields both build on it so they cannot drift
    - `table.ts` — zod `tableSchema`
    - `field.ts` — flat `fieldSchema` (name/type/required/choices/targetTableId/labelFieldKey, per-type `superRefine`; one schema for client + server). Whether a RELATION's target _exists and is owned_ is a database question, so the server layers `requireFieldTarget` on top
    - `record.ts` — `VALUE_SCHEMA_BY_TYPE` (per-type `base` schema + `blank` value + `fromQuery` decoder, since a URL carries only strings), `buildRecordSchema(fields)` (builds a table's schema from its metadata; strips unknown keys), `blankValueFor(field)`, `buildFilterValueSchema(field)` (exported for the codec), `buildRecordQuerySchema(fields)` (page + pageSize + sort/dir + the filter params the table's fields claim, validated against those fields; a **loose** object so the refinement can read the filter params without widening the base ones). It **validates only** — no `.transform()`: decoding the validated params into an `IRecordQuery` is the codec's job, which is what keeps `utils → validation` acyclic. Required is enforced only where `blank` is `null`, so a BOOLEAN's `false` counts as a value

  - **Filter wire format:** plain query params named after the field, the name following from the value's shape — `?company=acme&stage=Won&active=true&contract_value_from=1000&contract_value_to=5000&signed_on_from=2026-01-01`. A **scalar** value (TEXT, SELECT, BOOLEAN, RELATION) takes the field's bare key; a **range** (NUMBER, DATE) spreads to the `_from` / `_to` suffixes. The record's own columns ride in the same namespace: `?recordNumber=4` as a scalar (partial match, like any text filter) and `?createdAt_from=2026-07-01&updatedAt_to=2026-07-31` as ranges, all three being accepted `?sort=` keys too. A RELATION carries the target record's **id** (`?company=clx…`) — the picker's own value, so a link cannot decode to a label the server would have to re-resolve. How each is compared is the field type's business on the server (TEXT matches partially, the rest exactly, ranges inclusively) and never travels in the URL. Every filter is ANDed. One value per param — a repeated param is a 400. An empty value (`?company=`) means "not filtered", never `ILIKE '%%'`. Params the table does not own are **ignored, not rejected**: with bare names a typo is indistinguishable from `utm_source`, so a stray param must not break the page (a malformed _known_ param — `?contract_value_from=abc` — is still a 400)
  - **prisma/** — PostgreSQL schema: the `FieldType` enum (`TEXT`/`NUMBER`/`BOOLEAN`/`DATE`/`SELECT`/`RELATION`) and 4 models. Every id is a `cuid()`, `createdAt` defaults to `now()` and `updatedAt` is `@updatedAt` wherever it exists; the `datasource` block carries **no inline `url`** — Prisma 7 resolves `DATABASE_URL` through `prisma.config.ts`. **Ownership lives only on `Table.userId`**: fields and records reach the user through their table, which is why every scoped query filters via the `table` relation rather than a denormalized `userId`. Every relation is `onDelete: Cascade`, so deleting a user removes their tables and deleting a table removes its fields and records in one statement
    - `User` — `id`, `email` (`@unique`), `passwordHash`, `createdAt`; has many `tables`. Always read with an explicit `select`, so `passwordHash` cannot reach a response
    - `Table` — `id`, `name`, `userId` → `User`, `recordCounter` (the high-water mark `Record.number` is allocated from — see "Record identity"; never exposed in `tableSelect`), `createdAt`/`updatedAt`; has many `fields` and `records`. `@@unique([userId, name])` makes a name unique **per user** (the duplicate is the 409 out of `server/services/tables.ts`) and its left prefix covers the dashboard list
    - `Field` — `id`, `tableId` → `Table`, `name` (display label, editable), `key` (machine key, **immutable after creation**), `type` (`FieldType`), `required`, `options` (`Json?` — SELECT stores `{ choices }`, RELATION stores `{ targetTableId, labelFieldKey }`), `order`, `createdAt`. `@@unique([tableId, key])` is the constraint `createField`'s slugify-and-dedupe upholds before insert, and its left prefix covers the per-table list
    - `Record` — `id` (cuid — the identity relations reference), `number` (the id a user reads, sequential per table), `tableId` → `Table`, `data` (`Json`, default `{}`, **keyed by `Field.key`** — never by field id, so renaming a field never rewrites a single row), `createdAt`/`updatedAt`. `@@unique([tableId, number])` serves the `#` column's sort, and `@@index([tableId, createdAt])` stays because the default newest-first ordering cannot use it — Postgres gets that by scanning the btree backwards. **Sorting or filtering by a JSONB key is deliberately unindexed** — keys are user-defined per table, so no general index applies; that is the first scaling limit this schema will hit
    - **No single-column index duplicates a wider index's left prefix.** `Table_userId_idx`, `Field_tableId_idx` and `Record_tableId_idx` were each subsumed by the composite above them and only cost write throughput; `drop_redundant_indexes` removed all three, and `EXPLAIN` confirmed the plans are unchanged (the record list even improved — the composite supplies the ordering, so its `Sort` node is gone). Do not re-add them
    - Migrations applied: `20260723124643_init`, `20260726084538_record_table_created_index`, `20260728134724_drop_redundant_indexes`, `20260729052159_record_number` (**hand-written**: `Record.number` is required over existing rows, so the column is added nullable, backfilled with `ROW_NUMBER() OVER (PARTITION BY "tableId" ORDER BY "createdAt", id)`, then set `NOT NULL` — `prisma migrate dev` cannot generate that, and refuses the diff outright. Use `--create-only` and edit the SQL for any future required column). Client generated into `server/generated/prisma` (gitignored)
  - **Root & config**
    - `docker-compose.yml` — PostgreSQL 17 Alpine, container `flexbase-postgres`, persistent volume + healthcheck
    - `.env` (gitignored) + committed `.env.example` — `DATABASE_URL`, `JWT_SECRET`
    - `.claude/launch.json` — "dev" preview server config; `.claude/settings.json` — permission allowlist for the read-only commands and browser reads used constantly (builds, lint, typecheck, `docker compose ps`), deliberately excluding anything that commits, pushes, deletes or `docker compose exec`s
    - `.github/workflows/ci.yml` — CI: `format:check` → `lint` → `typecheck` → `build` on push to `main`/`develop` and on PRs. No database service: nothing in the build connects to Postgres, and the dummy `DATABASE_URL` exists only so `prisma generate` can resolve the datasource variable
    - `README.md` — the human-facing setup guide: what FlexBase is, requirements, `.env`, `npm run db:up` + `prisma migrate dev`, the command table, and the CI/testing status
  - Not yet implemented: no tests (see §5) — the MVP feature scope itself is complete

---

## 9. Output Expectations

1. **Defensive Programming:** Always write code assuming dependencies (DB, Payment Gateways) can fail. Use `try/catch` and safe error fallbacks.
2. **No Bloat:** Provide clean, self-documenting code with inline TypeScript types. Avoid long prose explanations.
3. **Definition of done** — a change is finished only when, in order:
   1. `npm run format` has been run,
   2. `npx eslint .` passes,
   3. `npm run build` passes,
   4. the change has been verified working in the running app (dev server),
   5. this file's relevant sections (especially Current State) reflect what was done.

---
