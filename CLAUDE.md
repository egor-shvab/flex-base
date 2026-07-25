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

This is a full-stack Nuxt 4 application using the `app/` source directory convention (Nuxt 4 default), with the Nitro server layer under `server/`, shared client/server code under `shared/`, and the database layer under `prisma/`. Implemented so far: the full Prisma schema, authentication (register/login/logout, session restore, route guards), and table metadata CRUD (dashboard + ownership-scoped API). Not yet implemented: field/record CRUD, dynamic form/table components, filtering/sorting, relations — the corresponding directories still carry `.gitkeep` stubs.

### Stack

- **Frontend:** Nuxt 4, Vue 3, TypeScript, Pinia (state), SCSS (`sass-embedded`).
- **Backend:** Nitro (Nuxt's server engine) via `server/api` routes.
- **Database:** PostgreSQL (Docker) through **Prisma 7** (`@prisma/client` + `@prisma/adapter-pg`, `prisma` CLI). Schema: `prisma/schema.prisma` — models `User`, `Table`, `Field` (typed metadata, `options` Json), `Record` (`data` Json keyed by immutable `Field.key`); ownership lives solely on `Table.userId`, fields/records derive it through their table.
- **Auth:** manual — **bcrypt** for password hashing, **jsonwebtoken** (JWT) for tokens. No auth library. The JWT (`{ sub: userId }`, HS256, 7 days) is stored in an httpOnly `auth_token` cookie; `server/middleware/auth.ts` resolves it to `event.context.user` on every request (never rejects — handlers call `requireUser(event)` from `server/utils/auth.ts` to enforce 401). Client side: `app/stores/auth.ts` + global route middleware `app/middleware/auth.global.ts` (session restore + redirects), API calls go through `useApi()` (`useRequestFetch`, so cookies are forwarded during SSR).
- **Validation:** **zod**, used for shared client + server validation schemas.

### Directory structure

```
app/                         # Nuxt 4 frontend (client)
  assets/scss/               # global SCSS (main.scss + partials)
  components/
    common/                  # generic UI atoms (buttons, modals, …)
    modals/                  # dialogs built on BaseModal — ConfirmModal (universal), TableFormModal
    fields/                  # ONE component per field type + a type→component registry
    form/                    # DynamicForm — renders a form from field definitions
    table/                   # DynamicTable + toolbar — renders a table from column definitions
  composables/               # auto-imported composables (useApi, useTables, useRecords, …)
  layouts/                   # default + auth layouts
  middleware/                # route guards (auth)
  pages/                     # file-based routing
    auth/                    # login / register
    tables/[tableId]/records/  # dynamic table & record views
  stores/                    # Pinia stores (auth, tables, records)
server/                      # Nitro backend
  api/                       # HTTP route handlers (thin: parse → check ownership → call service)
    auth/                    # register / login / logout
    tables/[tableId]/fields/    # field-definition CRUD
    tables/[tableId]/records/   # generic record CRUD (filter/sort)
  middleware/                # server middleware (attach authenticated user to event.context)
  services/                  # generic, framework-agnostic business logic (record/query/validation)
  utils/                     # prisma singleton, auth helpers, ownership assertions
  plugins/                   # Nitro plugins
  generated/prisma/          # generated Prisma client (gitignored — never edit by hand)
shared/                      # types/constants/schemas used by BOTH client & server
  types/                     # field / table / record TypeScript types
  validation/                # shared zod schemas
prisma/
  migrations/                # Prisma migration history
public/                      # static assets
```

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
2. The shared field-type constant/type in `shared/types/`.
3. One zod branch for its `options`/value validation in `shared/validation/`.
4. One input component in `app/components/fields/` + one entry in the type→component registry.

**No scattered `switch`/`if` chains on field type** in pages, services, or generic components — per-type behavior lives in the registry and the zod branches. If adding a type would require editing `DynamicForm`, `DynamicTable`, or a service, the abstraction is broken: fix the abstraction instead of special-casing.

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

- Modules enabled in `nuxt.config.ts`: `@nuxt/eslint`, `@nuxt/fonts`, `@nuxt/icon`, `@nuxt/image`, `@pinia/nuxt`.
- `compatibilityDate` is pinned to `2025-07-15` in `nuxt.config.ts`.
- TypeScript config (`tsconfig.json`) references the project-reference configs generated into `.nuxt/` (`tsconfig.app.json`, `tsconfig.server.json`, `tsconfig.shared.json`, `tsconfig.node.json`) — these are regenerated by `nuxt prepare`, do not edit them directly.
- Follow Nuxt 4 conventions: `app/pages/` for file-based routing, `app/components/` and `app/composables/` auto-imported, `app/stores/` for Pinia; `server/api/` for Nitro route handlers. In `shared/`, only `shared/types/` and `shared/utils/` are auto-imported — everything else (e.g. `shared/validation/`) must be imported explicitly via the `#shared` alias: `import { loginSchema } from '#shared/validation/auth'`.
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
  - **Type naming:** project-defined interfaces are prefixed with `I` (`IAuthUser`), project-defined type aliases with `T` (`TLoginInput`, `TFieldKey`). This applies everywhere — `shared/types/`, component-local types, server types. External and generated types (h3 augmentations, Prisma models, library types) keep their original names.

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

- **Global Styles:** Split into multiple focused partials inside `app/assets/scss/`:
  - `_variables.scss` — CSS custom properties (colors)
  - `_reset.scss` — CSS reset / normalize + base typography (font stack, box-sizing)
  - `_functions.scss` — the `rem()` helper (NOT `@use`d by `main.scss` — it reaches SFC styles via Vite `additionalData`; standalone partials `@use` it themselves)
  - `_auth-form.scss` — shared `.auth-form` BEM block used by the login/register pages
  - `main.scss` — entry point that `@use`s `variables` / `reset` / `auth-form` (imported in `nuxt.config.ts` via `css: []`)
- **Icons:** Use the `@nuxt/icon` module. Prefer SVG sprites over icon fonts.

---

## 5. Testing Strategy

There is no test suite configured in this repository yet.

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
npm run build        # production build
npm run preview      # preview a production build locally
npm run format       # format all files with Prettier
npm run format:check # check formatting without writing
npx eslint .         # lint
```

Database workflow (PostgreSQL runs in Docker — never use OSPanel's bundled modules):

```bash
docker compose up -d --wait           # start PostgreSQL (postgres:17, container flexbase-postgres)
npx prisma migrate dev --name <name>  # create & apply a migration
npx prisma generate                   # regenerate the Prisma client (into server/generated/prisma, gitignored)
npx prisma studio                     # browse data in a GUI
```

---

## 8. Project-Specific Context

- **Package Manager:** This project uses **npm** (`package-lock.json` present).
- **Prisma 7 notes:** CLI configuration lives in `prisma.config.ts` (which loads `.env` via `dotenv/config` — Prisma 7 no longer reads `.env` itself); the client is generated by the `prisma-client` provider into `server/generated/prisma` (entry `client.ts`) and requires the `@prisma/adapter-pg` driver adapter at runtime (see `server/utils/prisma.ts`). `postinstall` runs `prisma generate && nuxt prepare`.
- **Tooling:** Prettier (`.prettierrc`: no semicolons, single quotes, 2-space indent, `printWidth` 100) formats `.vue`, `.ts`, `.js`, `.scss`, `.json`, and `.md` — including SCSS and `<style lang="scss">` blocks natively; build/generated output is excluded via `.prettierignore`. ESLint handles code quality only: `eslint.config.mjs` imports the config generated into `.nuxt/` by `nuxt prepare`/postinstall, with `eslint-config-prettier` appended to disable rules that would conflict with Prettier.
- **Current State:**
  - Nuxt 4.5.0 + Vue 3.5.40 + TypeScript + Pinia + SCSS (`sass-embedded`); ESLint (`@nuxt/eslint` flat config) + Prettier configured
  - Prisma schema with 4 models (User, Table, Field, Record) — `init` migration applied; client generated into `server/generated/prisma` (gitignored)
  - `docker-compose.yml` — PostgreSQL 17 Alpine, container `flexbase-postgres`, persistent volume + healthcheck
  - `.env` (gitignored) + committed `.env.example` — `DATABASE_URL`, `JWT_SECRET`
  - `shared/types/auth.ts` — `IAuthUser` interface
  - `shared/validation/auth.ts` — zod `credentialsSchema` / `loginSchema` / `registerSchema`
  - `server/utils/prisma.ts` — PrismaClient singleton with `PrismaPg` adapter (globalThis-cached in dev)
  - `server/utils/auth.ts` — bcrypt hash/verify, JWT sign/verify, `auth_token` cookie helpers, `requireUser`
  - `server/middleware/auth.ts` — resolves the auth cookie to `event.context.user` on every request (never rejects)
  - `server/api/auth/` — 4 endpoints: `register.post`, `login.post`, `logout.post`, `me.get`
  - `app/composables/useApi.ts` — `useRequestFetch` wrapper + `getApiErrorMessage`
  - `app/composables/useForm.ts` — reusable form state (fields, per-field errors, server error, pending, submit, reset); used by the auth pages and `TableFormModal`
  - `app/stores/auth.ts` — Pinia auth store (user, initialized, fetchUser/register/login/logout)
  - `app/middleware/auth.global.ts` — global route guard: session restore + redirects (both directions)
  - `app/layouts/default.vue` (header: brand, user email, logout) + `app/layouts/auth.vue` (centered card)
  - `app/components/common/BaseInput.vue` — labeled input atom (v-model with `.trim` support, placeholder, autofocus, error display with `aria-invalid`/`aria-describedby`); `app/components/common/BaseButton.vue` — button atom (type/disabled props, slot content). Component auto-import uses `pathPrefix: false` in `nuxt.config.ts`, so `common/BaseInput.vue` registers as `<BaseInput>`
  - `app/utils/safe-redirect.ts` — `resolveSafeRedirect` restricts `?redirect` to internal paths (used by the auth guard and auth pages to return users to their intended destination after login)
  - Page titles via `useSeoMeta` + titleTemplate in `app/app.vue` ("… — FlexBase"); `lang="en"` set in `nuxt.config.ts` `app.head`; auth-page field errors clear live as the user edits a field
  - `app/pages/auth/login.vue` + `app/pages/auth/register.vue` — validate with the shared zod schemas, fields rendered via `BaseInput`
  - `shared/types/table.ts` — `ITable` / `ITableListItem` (with `_count`); `shared/validation/table.ts` — zod `tableSchema` (name, 1–100 chars)
  - `server/utils/ownership.ts` — `requireOwnedTable(userId, tableId)`: single scoped query, 404 when missing/foreign
  - `server/services/tables.ts` — list/create/rename/delete scoped by `userId`; maps Prisma `P2002` → 409, `P2025` → 404
  - `server/api/tables/` — `index.get`, `index.post`, `[tableId].get`, `[tableId].patch`, `[tableId].delete`
  - `app/stores/tables.ts` — Pinia store (`shallowRef` table list, fetch/create/rename/delete)
  - `app/components/common/BaseModal.vue` — dialog atom (teleport, backdrop/Esc close, `role="dialog"`); `BaseButton` has a `danger` variant
  - `app/components/modals/` — `ConfirmModal.vue` (universal confirmation dialog: message/slot, danger + pending props) and `TableFormModal.vue` (self-contained create/rename form built on `useForm`; takes an async `submitHandler` prop, emits `saved`)
  - `app/pages/index.vue` — tables dashboard: card grid with field/record counts, create/rename via `LazyTableFormModal`, delete via `LazyConfirmModal`, empty state
  - `app/pages/tables/[tableId]/index.vue` — table detail stub (name + placeholder, 404 via error page)
  - `app/assets/scss/` — `main.scss` entry `@use`s `_variables.scss` (CSS custom props), `_reset.scss`, `_auth-form.scss`; `_functions.scss` provides `rem()` (auto-injected into SFC styles via Vite `additionalData`)
  - `.claude/launch.json` — "dev" preview server config
  - `README.md` — still the default Nuxt starter readme (not yet project-specific)
  - Not yet implemented: table/field/record CRUD, `server/services/`, dynamic form/table components, filtering/sorting, relations; no tests

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
