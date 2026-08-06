# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

Two companion documents carry the detail this file deliberately omits. Read the relevant one before changing the area it covers:

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

`typecheck` is the one to reach for while iterating: same `vue-tsc` errors as the build at a quarter of the time, and it never rewrites `.output`. Keep `build` as the pre-commit gate — it is the only step that exercises Vite/Nitro bundling.

PostgreSQL runs in Docker. Never use OSPanel's bundled modules.

### Definition of done

A change is finished only when, in order:

1. `npm run format` has been run;
2. `npx eslint .` passes;
3. `npm run build` passes;
4. tests covering the changed logic are added or updated (once a runner exists — see §10);
5. for any interactive or visual change: the keyboard path works, the focus ring is visible, and every target is at least `--control-height` (never below the 24×24 WCAG floor);
6. the change has been verified working in the running app (dev server);
7. if the change knowingly leaves a limitation, it is recorded in `docs/decisions.md` → **Accepted limitations** — not only in a commit message;
8. documentation is updated **only where a rule, contract, or limitation changed**: this file for rules, `docs/architecture.md` for contracts, `docs/decisions.md` for rationale. Do not maintain a running inventory of files here — the codebase is the source of truth for what exists.

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
6. `server/services/record-query.ts` — one `FIELD_SQL_BY_TYPE` entry: its SQL projection (`expr`), how that projection is compared (`filter`), how free-text search matches it (`searchExpr`, `null` to opt out), and `sortExpr` only if it orders differently from how it filters.

Every one of these registries is a total `Record<TFieldType, …>`, so adding an enum member is a compile error until all of them exist.

**Inputs and filters are data, not components** — each is an `IFieldControl` naming a `Base*` control, a `props(field)` factory, and the adapters between that control's model and the field's value. Only cells are components. A type whose control needs data beyond its own metadata gets a component in `field-types/controls/` (RELATION is the only one today).

**No scattered `switch`/`if` chains on field type** in pages, services, or generic components. If adding a type would require editing `DynamicForm`, `DynamicTable`, or a service, the abstraction is broken — fix the abstraction instead of special-casing.

Full contracts for each registry: `docs/architecture.md`.

---

## 10. Testing

**No test runner is configured yet. Adding one is current-phase work, not deferred.** The intended stack is **Vitest** (unit: the URL codec, the SQL builder, the zod schemas — the pure logic that is currently verified by throwaway scripts) and **Playwright** (E2E over the auth-gated pages).

Until then the safety net is **CI + the type system**: `.github/workflows/ci.yml` runs `format:check` → `lint` → `typecheck` → `build` on every push to `main`/`develop` and on every PR, and the total `Record<TFieldType, …>` registries make an unhandled field type a compile error rather than a runtime surprise.

Once Vitest exists, changes to `shared/utils/`, `shared/validation/` and `server/services/` ship with tests, and step 4 of the definition of done becomes binding.

Behavioural changes are meanwhile verified by driving the running app. The manual regression checklist for the metadata layer is in `docs/architecture.md`.

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
