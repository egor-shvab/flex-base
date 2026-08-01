# Decisions & accepted limitations

Why the code is shaped the way it is. Each entry exists because the alternative looks obviously better until you know the reason — treat these as **load-bearing**: do not "clean them up" without reading the entry.

Rules live in `CLAUDE.md`; contracts live in `architecture.md`.

---

## Tooling & module resolution

### Everything except components is imported explicitly

`imports: { autoImport: false }` (app) and `nitro: { imports: { autoImport: false } }` (server) also stop Nuxt generating the global `.d.ts` declarations, so a missing import is a `vue-tsc` error at build time rather than a silently resolved global.

The component scan (`components: [{ path: '~/components', pathPrefix: false }]`) is deliberately **kept**: it is what makes `<LazyRecordFormModal>` code-split for free, and it keeps framework components (`<NuxtLink>`, `<NuxtPage>`, `<Icon>`) working. `pathPrefix: false` is why `common/BaseInput.vue` registers as `<BaseInput>`.

### Server code must not import from `#imports`

`.nuxt/types/nitro-routes.d.ts` pulls every `server/api/**` handler into the **app** TypeScript project (to type `$fetch` route responses), and `#imports` resolves to the app's module there — so `defineEventHandler` would not be found. `h3` and `nitropack` are therefore declared as direct dependencies; they resolve identically in both projects. Keep their versions in step with the ones Nuxt resolves.

### `#server` is server-only

Nuxt's import protection rejects it in app and shared code. The Vue layer reaches the server through `$fetch`/`useApi()`. `#server` is a Nuxt built-in alias (registered in `@nuxt/schema`'s alias defaults alongside `#shared`), so it resolves for `vue-tsc` and the Nitro bundler alike.

### Relative imports are a lint error under `app/`, `server/`, `shared/`

`no-restricted-imports` is scoped to those three directories specifically so the root config files can keep their own relative paths.

### `ofetch` is declared; `vue-router` is not

`app/utils/api-error.ts` imports `FetchError` from `ofetch` by name; without the declaration it resolves only through npm hoisting of Nuxt's tree, so a hoisting change would silently break `typecheck`. `vue-router` is deliberately **not** declared — nothing imports it, and Nuxt owns the version.

### `@nuxt/fonts` was removed

The app ships no webfonts, and the module tries to resolve the `Segoe UI` / `Roboto` names in `_reset.scss`'s system stack from font providers. Re-add it if and when a real webfont exists — not before.

---

## API & data access

### 404, never 403, for another user's resource

A 403 confirms the resource exists. 401 comes only from `requireUser(event)`. Login failures return the same generic 401 regardless of which credential was wrong, for the same reason.

### Ownership lives in the `where` clause, not around the query

Fetch-then-check is a TOCTOU pattern and one forgotten branch away from a leak. Scoping inside the query makes "not yours" and "not there" the same code path — which is also what makes 404-not-403 free.

Ownership assertions live in `server/utils/ownership.ts` rather than in the services because that module already imports the services' helpers; the reverse would be a cycle.

### Ownership is denormalized nowhere

It lives only on `Table.userId`; fields and records reach the user through their table. A denormalized `userId` on `Field`/`Record` would be faster to filter and impossible to keep honest.

### `Record.number` instead of an auto-incrementing PK

Every user's records share one physical `Record` table, so a global sequence would:

- number rows across all tenants (a table would read `1, 47, 2931`);
- leak platform-wide row volume through the counter;
- make ids enumerable;

—all while still not giving the per-table `1..n` that makes a number readable in the first place. So `id` stays an unguessable `cuid()` for reference and addressing, and `number` is a separate display column (`architecture.md` §4).

`number` is allocated inside the insert's own transaction via Prisma's atomic `{ increment: 1 }`, which takes the row lock, so concurrent creates queue rather than race — no retry loop. It is a **high-water mark, not a count**: deleting a record never frees its number.

### The redundant single-column indexes were dropped — do not re-add them

`Table_userId_idx`, `Field_tableId_idx` and `Record_tableId_idx` were each subsumed by the left prefix of the composite index above them, and only cost write throughput. `drop_redundant_indexes` removed all three; `EXPLAIN` confirmed the plans are unchanged, and the record list improved (the composite supplies the ordering, so its `Sort` node is gone).

`@@index([tableId, createdAt])` stays even though the default ordering is `DESC` — Postgres scans a btree backwards.

### The `record_number` migration is hand-written

`Record.number` is required over existing rows, so the column is added nullable, backfilled with `ROW_NUMBER() OVER (PARTITION BY "tableId" ORDER BY "createdAt", id)`, then set `NOT NULL`. `prisma migrate dev` cannot generate that and refuses the diff outright.

**This generalizes:** use `--create-only` and edit the SQL for any future required column over existing data.

---

## The metadata layer

### There are no operators, anywhere

A filter's **value** is the whole contract. How a value is compared is the field type's business, declared once in `FIELD_SQL_BY_TYPE` on the server — it never travels in the URL, no control knows it, and no user can pick one. This is what keeps the filter drawer, the URL codec, the summary chips and the SQL builder from each needing a per-operator branch.

### `FILTER_VALUE_BY_TYPE` and `VALUE_SCHEMA_BY_TYPE` stay split

They look like one table split across two layers. Merging them would be a **cycle**: `shared/utils/filter.ts` imports the constant, and `shared/validation/record.ts` imports `shared/utils/filter.ts`. The split is load-bearing.

### The query schema validates; the codec decodes

`buildRecordQuerySchema` has no `.transform()`. Turning validated params into an `IRecordQuery` is `parseRecordQueryState`'s job — which is what keeps the `utils → validation` dependency direction acyclic. The endpoint composes the two: the schema judges, the codec decodes.

`parseRecordQueryState` is lenient by design and is the **exact inverse** of `toRecordQueryParams`, used by both the page (over `route.query`) and the endpoint (over its validated params), so a link cannot decode two ways.

### Unknown query params are ignored, not rejected

Filter params are named after the field with no prefix, so a typo is indistinguishable from `utm_source`. A stray param must not break the page. A malformed **known** param is still a 400.

### Inputs and filters are data; only cells are components

A cell carries markup and scoped styles (an icon, tabular figures), not just a value, so a `format | component` union would be worse than one uniform contract. Inputs and filters carry neither — they name a `Base*` control plus adapters, so they stay rows in a table.

**`RelationFieldSelect` is the one exception**, because a relation's candidates are records of another table and no synchronous `props(field)` factory can produce them. The rule that follows: a type whose control needs data beyond its own metadata gets a component in `field-types/controls/`; everything else stays a row.

### RELATION's target table is immutable; its label field is not

Retargeting would orphan every stored id, so `updateField` rejects it with 400. The label field is pure display and freely editable. RELATION-typed fields are excluded from the label candidates — a link labelled by a link would read as an id.

### The record's own columns go through one seam

`queryFields(fields)` wraps a table's fields in `Record #` / `Created at` / `Updated at` **only where a query is built**, never where record data is read or written. Special-casing them at each layer instead would have meant a branch in the codec, the schema, the SQL builder, the table and the filter panel — five places to forget one.

The reserved keys are **camelCase**, a shape `slugify` can never emit, so no user field can shadow one. `RESERVED_FIELD_KEYS` states the reservation rather than relying on that luck.

### `searchExpr` is separate from `expr`

NUMBER and BOOLEAN cast in their filter projection, and neither `numeric` nor `boolean` has an `ILIKE` operator. NUMBER searches the un-cast text; BOOLEAN opts out (searching `e` would match every `false`); RELATION opts out because its stored value is a cuid, and matching the label instead would run `targetLabel`'s correlated subquery against every row — the count query has no `LIMIT`.

### `buildRecordSearch`'s parentheses are load-bearing

`withinRange` returns a bare `a >= x AND a <= y` with no parentheses of its own, which is safe only while every sibling is `AND`. Search is the only OR in the query layer, and unparenthesised it would bind to the last bound of a range filter and silently widen it.

### `SEARCH_MIN_LENGTH` is enforced by the schema, not the input

An unanchored `ILIKE` over user-defined JSON keys is unindexable and the count query cannot stop early, so a one-character term is a full-table scan paid twice. Enforcing it client-side only would leave the endpoint open to any caller.

---

## Frontend

### A layout and a page must never share a `useAsyncData` key

`useAsyncData` does **not** dedupe a layout against a page in one SSR render: it fires two requests and warns `NUXT_E3004`, with the page's closure silently never called. Hence `app-tables` (layout) and `dashboard-tables` (page). The dashboard's handler is client-only, so counts refresh when you return Home while SSR still costs exactly one request.

### `ensureTables()` never throws

A rejection in the layout's async setup would replace the page with an error boundary for what is chrome, not content — the sidebar failing to list tables should not take down a records page that loaded fine. It sets `failed` instead, and the sidebar reports it inline with a Retry.

### `app/error.vue` is store-free

It has to render when data fetching is exactly what failed.

It exists because both inner pages forwarded the upstream `statusCode` but hard-coded `statusMessage: 'Table not found'` — so a malformed `?search=`/`?sort=` returned 400, failed Nuxt's `is404` check, and rendered the 500 template claiming a table that had just loaded did not exist. `toPageError` now asserts a cause only for a 404.

### The records store never mirrors query params

A mirrored copy would have to survive SSR hydration to stay correct. Every action takes them from the caller, and the URL stays the single source of truth.

`createRecord` returns the page the new record landed on and only refetches when that equals the current page; the page navigates when it differs. Otherwise the URL would show one page while the table showed another, or the refetch would happen twice.

### A failed refetch is visible, not silent

`records.ts` sets `failed` in a `catch` that rethrows; the page's `watch` swallows the rejection (an unhandled one in a watcher left the table showing rows that no longer matched the URL) and shows a banner. **The empty state is suppressed while `failed`** — an empty result and an unknown result are indistinguishable in the store, and "No records yet" would be a guess.

### `BaseInput` binds `:value` + `@input`, not `v-model`

`v-model` would cast a `type="number"` input's value to a number and write `1.5` back while the user is still typing `1.50`. The composition guard `v-model` provides is kept by hand, so IME input still works.

`BaseRange` applies the same reasoning to both bounds: its watcher resyncs **only a bound that disagrees with what is on screen**, which is what distinguishes an outside change (clear all, a shared URL, the back button) from the value being echoed back. Dates run through the same drafts even though their round trip is lossless — that is what lets one component serve both types.

### Locales and time zones are hard-coded

`en-GB` everywhere, and `formatTimestamp` pins `timeZone: 'UTC'`. An `undefined` locale renders differently on the server and in the browser — a hydration mismatch. `DateFieldCell` gets away with no zone because it parses a date-only value as local midnight, the same wall-clock everywhere; a real timestamp does not.

Pinning UTC also keeps the displayed day equal to the day the filter matches on, since that compares `::date`.

### The active-table check compares `route.params.tableId`, not the path

`/tables/:id` is a string prefix of `/tables/:id/records`, so a path check is ambiguous. The param marks the table active on both inner pages.

### `AppBreadcrumbs` is prop-driven

Each page passes its own `IBreadcrumb[]` because the pages already hold the `ITable` they fetched — which is also what produces their 404. Deriving the name from the store in the layout would quietly delete that guard.

### `FieldFormModal` fetches the target's fields outside the fields store

That store holds the table being edited; loading another table's fields into it would clobber the page behind the modal.

---

## Styling

### The token layer is three layers, and the build enforces the boundary

`_palette.scss` holds primitives as SCSS variables. Because `additionalData` injects only `functions` and `mixins`, a component **cannot** reference `$blue-600` without an `@use` it will never have. Components consume `var(--color-*)` and nothing else — that is a compile-time fact, not a convention.

### Surfaces are split even where two share a value

`--color-surface-hover` / `-disabled` / `-muted` are separate tokens today with the same value. The previous single `--color-bg` meant page background, row hover, disabled fill and chip fill at once; re-collapsing them just relocates that bug.

### `--color-border-control` is separate from `--color-border-strong`

A divider only has to be visible; a control's outline is the only thing identifying the control, so it carries the 3:1 non-text contrast floor. Neither `$gray-200` (1.3:1) nor `$gray-300` (1.66:1) clears it — `$gray-400` (3.17:1) exists for exactly this. `BaseButton --secondary` is surface-on-surface, so its border is load-bearing.

### Breakpoints live in `_mixins.scss`, in `em`

A media query cannot read a custom property, and `additionalData` injects that file into every SFC. `em` rather than `px` so it honours the browser's font-size setting.

### Focus is never removed, only restyled

`_reset.scss` carries a zero-specificity baseline — `:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible` — so nothing can end up with no ring, and any component rule overrides it without a fight. Component rings use `outline`, not `box-shadow`, so an ancestor's `overflow` cannot clip them.

### `icon` and `link` buttons stay under 44px

They set row heights in `DynamicTable`, `BasePagination`, modal headers, `.table-card__actions` and `.field-row`. Growing them grows those surfaces, so they change when those surfaces are re-laid-out, not before. Every **icon-only button that is a standalone target** already meets 44px.

Raising the icon button to 44px forced three absorbed consequences worth knowing before touching it again: `BaseModal`'s header padding dropped to `rem(10)` (otherwise every dialog header went 60px → 76px); `DynamicTable`'s action cell took `padding-block: rem(4)` + `align-items: center` (it is `display: flex`, which removes it from table layout, so it must centre its own content); and the layout's hand-rolled sidebar toggle had to be sized explicitly, since it is not a `BaseButton`.

### `DynamicTable` rows have an explicit height

`height: rem(52)` on `tbody td`, not derived from the tallest cell — otherwise the action cell's buttons define the row, which is exactly why a 44px button would have pushed rows to 64px. A bordered row measures 53px; the last row drops its border and measures 52.

### `BaseSelect` pins `height`, not `min-height`

Chrome ignores `line-height` on `<select>`, which otherwise leaves it 1px taller than the inputs beside it.

### `BaseBadge --chip` is never uppercased

It displays a **value** — SELECT choices are user data. `--label` is the uppercase variant, and it marks metadata (`required`), never content.

### Never ship a dead control

The header deliberately has no global "Search everything" box: cross-table search is not built, and a dead input is worse than a gap. The principle outlives the instance — if cross-table search is built, the box arrives with it.

---

## Accepted limitations

The register referenced by `CLAUDE.md` §1. **Open** entries are in scope for the current phase; **Accepted** entries are not, unless a request says otherwise.

| Limitation                                                                                           | Why it stands                                                                                                                                                                                                                                                                            | Status                                                     |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **No focus management in dialogs** — focus is not moved into a dialog on open, nor restored on close | `BaseModal`'s `inert` on `#__nuxt` already keeps Tab inside; the remaining edge cases (nested modals teleporting out of the sidebar, the sidebar auto-closing on route change, breakpoint crossing mid-animation, honouring existing `autofocus`) are a piece of work in their own right | **Open** — WCAG 2.2 AA gap                                 |
| **No test suite**                                                                                    | CI + total `Record<TFieldType, …>` registries have carried it so far                                                                                                                                                                                                                     | **Open** — top priority (`CLAUDE.md` §10)                  |
| **Relation picker has no search and lists at most `RELATION_OPTIONS_LIMIT` (200) candidates**        | A value outside the list is still shown as its own option, so editing never drops a link silently                                                                                                                                                                                        | **Open** — UX                                              |
| **`_count.records` drifts between Home visits**                                                      | `records.ts` is independent of `tables.ts`                                                                                                                                                                                                                                               | **Open** — small                                           |
| **Deleting a target record leaves a dangling id** that reads as "Unknown record"                     | Blocking it would mean a JSONB scan of every table on every delete. Deleting a target **table** is refused with a 409 instead                                                                                                                                                            | **Accepted** — revisit only with a real referential design |
| **Sorting/filtering by a JSONB key is unindexed**                                                    | Keys are user-defined per table, so no general index applies                                                                                                                                                                                                                             | **Accepted** — the first scaling ceiling; watch it         |
| **Relation label sort costs one PK lookup per matching row**                                         | On top of the unindexed JSONB path above                                                                                                                                                                                                                                                 | **Accepted** — same ceiling                                |
| **Free-text search is unindexable and its cost is paid twice** (page query + count)                  | Unanchored `ILIKE` over user-defined JSON keys. `SEARCH_MIN_LENGTH` bounds the worst case                                                                                                                                                                                                | **Accepted** — same ceiling                                |
| **No error reporting or observability**                                                              | Nothing beyond `createError` responses; no client or server error sink exists                                                                                                                                                                                                            | **Accepted** — revisit before any real deployment          |
