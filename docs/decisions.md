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

### `@iconify-json/mdi` is declared even though nothing imports it

`@nuxt/icon`'s default `serverBundle: 'auto'` serves an installed collection from disk and otherwise falls back to the public Iconify API — so without the package every icon in the app is a runtime fetch of a third-party host, on a render path that has no fallback if it is slow or unreachable. It is the one dependency whose purpose is its mere presence; dropping it does not fail a build, it just quietly puts the icons back on the network.

No `icon: { … }` block in `nuxt.config.ts`: `serverBundle: 'local'` would only restate what `auto` already resolves to, and it would not keep the remote fallback away if the package were ever dropped.

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

### A multi-value filter is a repeated param, not a delimited one

SELECT filters carry several choices, ORed — `?stage=Won&stage=Lost`. Comma-joining was rejected: a choice's value is free user text and may contain any character, so any delimiter needs escaping, and escaping user text into a separator is a silent-corruption failure mode rather than a loud one.

This does not overturn "a repeated param is a 400" — it makes it a **per-shape** rule, which is how the layer already works ("a type declares the shape of its value, that shape names its params"). A scalar or range slot given an array is still malformed and still 400s; only a `list` slot reads repeats. The values are **sorted on serialize**, so the same selection always writes the same URL however it was clicked, and `recordQueryKey` cannot report a change nobody made.

The bounds: `FILTER_LIST_MAX` (50) in the schema, because a repeated param is the one place a single filter can grow without limit and every value becomes a term of an `IN (…)`; and the codec caps and deduplicates independently, because it also runs client-side over an unvalidated `route.query`.

### Widening `TFilterValue` with `string[]` means every object guard must exclude arrays

`isRangeFilterValue` narrowed on `typeof value === 'object' && value !== null`, which an array passes — so without `!Array.isArray` a list-shaped filter would have decoded as a range and been read for bounds it does not have. `isScalarFilterValue` was added alongside so a comparison guards on the shape it _wants_ rather than on the one other shape that happened to exist when it was written.

`TRecordValue` **is** now widened with `string[]` too — see below. That reversed an explicit note here ("a record still stores one value per field; only a filter holds several"), and it is what made this entry's guards load-bearing on both sides of the wire rather than on one.

### Multi-value is a per-field flag, not a pair of new field types

`MULTI_SELECT` and `MULTI_RELATION` as `FieldType` members was the obvious alternative, and it is what the type system wants: every registry is a total `Record<TFieldType, …>`, so two new members would have made the compiler walk you through all of them, and §9 of `CLAUDE.md` is already a checklist for exactly that.

**It fails on the only conversion anyone actually needs.** `updateField` rejects a type change, and correctly — the stored values would not survive it. So a relation field that already links each master to one service could never become multi-valued: the user would have to create a second field, re-enter every link by hand, and delete the first. A flag can be flipped with a migration; a type cannot. The upgrade path _is_ the feature.

Two smaller costs it also avoids: the user's type list would double (`Select` / `Multi-select` / `Link to table` / `Links to table`), and every one of the ten registries would carry two near-identical rows, which is the duplication `CLAUDE.md` §6's DRY trigger exists to prevent.

**What replaces the compiler's guarantee.** `MULTI_VALUE_BY_TYPE` is a total `Record<TFieldType, boolean>`, and each affected registry gains a total `Record<TFieldType, X | null>` override table. A seventh field type therefore still cannot ship without declaring its position on cardinality — the totality moved, it was not given up. `isMultiValue(field)` is the single reader of the flag, and the guard inside it is why a stale `options.multiple` on a type with no list form can never reach the schema or the SQL.

### Multi is a lifting of the single-value spec, not a second set of specs

Every layer treats "several" as the same uniform transformation of "one": `base` → `z.array(base)`, `= x` → `jsonb_exists_any`, one cell → a row of that cell, `BaseSelect` → `BaseSelect multiple`. So no field type declares a second schema, a second cell or a second summary — each registry keeps its flat entries and one resolver reads the flag.

That is what keeps the change from being a `switch` on cardinality in every renderer, which is the failure `CLAUDE.md` §9 names. The branch exists once per registry, in `sqlFor` / `inputFor` / `filterFor` / `summaryFor` / `cellComponent` / `filterShapeFor`, and nothing downstream of those learns that `multiple` exists.

**Multi-value cells need no registry at all.** `MultiValueCell` renders each entry through `FIELD_CELLS[field.type]`, because a list of values is exactly the list of how each value renders. A future multi-capable type is covered without a component.

### `TRecordSingleValue` exists because a prop type is a runtime contract

`TRecordValue` gained `string[]`, and the reflex is to let every position that holds a record value follow it. That is wrong in most of them: a per-type cell renders one value, a record's own column holds one, a decoded filter bound is one. Nine of the ten cells cannot draw a list — `MultiValueCell` is what a list resolves to, and it hands each entry back to one of them.

Ordinarily a too-wide type is a lint-level complaint. Here it is not, because **`defineProps<T>()` compiles to a _runtime_ prop declaration**: widening `IFieldCellProps.value` adds `Array` to the accepted types of nine components that will never legitimately receive one, which turns off a check that would otherwise catch a real routing bug. The narrow type is the one that keeps the check meaningful.

So `TRecordSingleValue` is the single-value union and `TRecordValue = TRecordSingleValue | string[]`. `MultiValueCell` takes its own `IMultiValueCellProps` with a plain `string[]` — a separate interface, not a widening, because the two contracts are opposites.

The same reasoning narrowed `RECORD_COLUMNS.value`, `VALUE_SCHEMA_BY_TYPE.base` / `blank`, `buildFilterValueSchema` and `toRange`, all of which had silently inherited the wider union.

**`listBase` came out of the same pass.** `buildMultiValueSchema` originally cast its result, because `z.array(base)` over a `ZodType<TRecordSingleValue>` yields `TRecordSingleValue[]`, which is not `string[]`. The cast was hiding a real gap: only a type whose values are strings _can_ be stored as a JSON array, and nothing said which those were. `IValueSchemaSpec.listBase` states it per type (`null` for the four that have none), which produces a genuine `z.ZodType<string[]>` and deletes the cast.

### Type-only imports are invisible to HMR, and `compiler-sfc` caches resolved types

Worth recording because it cost a bug report that looked like a code defect and was not.

Widening `TRecordValue` changed no runtime module: `app/field-types/types.ts` imports it with `import type`, which is erased, so it is **not an edge in Vite's module graph** and nothing downstream was invalidated. `@vue/compiler-sfc` additionally caches resolved type scopes per file. A dev server running across that edit therefore kept generating cell props from the pre-widening union — including for a component **created after** the edit, since the fresh compile still resolved through the stale cached scope.

The symptom is a runtime prop warning naming a union that no longer exists in the source (`Expected String | Number | Boolean | Null, got Array`). **A type-name in a Vue prop warning that does not match the current source means the dev server is stale, not that the source is wrong** — the fix is a full restart, and touching the SFC is not reliably enough.

Corollary for reading built output: this toolchain emits a runtime `type` only for primitive unions. Array-typed props carry none at all — `BaseSelect.options` has done so all along, and `type:Array` appears nowhere in the client bundle. So an absent type on `MultiValueCell.value` is normal, not a resolution failure.

### `TRecordValue` is widened with `string[]`

A record now stores a list for a multi-value field. This is a real reversal of an earlier decision, not an extension of it, and the consequence to know is that **`TRecordValue` stayed a subset of `TFilterValue`** — so `IFieldControl<TValue extends TFilterValue>` needed no change, and the shape guards that already existed for filters (`isListFilterValue`, `isRangeFilterValue`'s `!Array.isArray`) were the ones the record side needed too.

The one place it bites is blankness: `RecordFieldValue` had `value === null || value === undefined`, and an empty array passes neither. Without the array case a cleared multi field renders as an empty cell rather than "Not set" — a silent difference between "no value" and "we did not draw anything".

### A multi-value column sorts by its first value

A list has no intrinsic order, so any rule here is a choice. Three were on the table:

- **opt out of sorting** — the most honest, and rejected on cost: `DynamicTable` makes every header a sort button unconditionally, so it would need a `sortable` notion threaded through the table, the query schema and `buildRecordOrderBy` — new surface, for a column the user can still reach through its filter;
- **`jsonb_array_length`** — orders by how many, which nobody asked;
- **the first value**, which is what shipped.

It wins because it is explicable from the screen: the first value is the one already visible in the cell, so a user can see why a row sorted where it did without opening anything. Ordering by something invisible would be worse than either alternative.

### Cardinality is one-way: widening migrates, narrowing is refused

Single → multi runs `widenToList` — one scoped `UPDATE` wrapping each stored scalar in an array — **inside `updateField`'s own transaction**, so the metadata and the rows it describes can never disagree. It is idempotent and skips a value that is already an array or is JSON `null`, so a retry is safe and `[null]` is never written where there was no value.

Multi → single is a 400, in the same shape as `Relation target cannot be changed`. It is lossy, and there is no non-arbitrary answer to which of several values survives. A softer rule — allow it when no record holds more than one — was considered and rejected for now: it costs a JSONB scan of the table on every field save to buy a case nobody has asked for.

The consequence, and it is the reason the migration exists at all: a value written **before** the flip is a bare scalar. Three places therefore tolerate one where a list is expected — `listValue.toControl` in `inputs.ts`, `collectRelationTargets`, and `MultiValueCell` — not as defensive padding but because a form opened from a stale page must not drop the value it is about to save back.

### `jsonb_exists_any`, never the `?|` operator

Postgres spells JSONB containment `?`, `?|` and `?&`, and a literal `?` in raw SQL is the parameter placeholder on Prisma's other drivers — it has a long history of being mangled. The function forms `jsonb_exists` / `jsonb_exists_any` mean exactly the same thing and are unambiguous everywhere, so they are what this codebase uses. `widenToList`'s key test is `jsonb_exists(data, key)` for the same reason.

Two properties worth knowing, both verified before the code was written:

- `jsonb_exists_any` answers **correctly for a bare scalar** (`'"abc"'::jsonb` contains `abc`), which is what keeps an un-migrated row from disappearing from its own filter. Do not lean on it as a substitute for the migration — display and validation still want one shape — but it means a half-applied widening degrades quietly.
- It is the **only GIN-indexable comparison** in the query layer. The "sorting/filtering by a JSONB key is unindexed" ceiling below does not get worse here; this is the one filter that could eventually escape it.

### The multi-value search guard is not defensive

`jsonb_array_elements_text` raises `cannot extract elements from a scalar` on anything that is not an array — including a JSON `null`. It is a **set-returning function in `FROM`**, so that error aborts the entire list query, not the row: one legacy scalar left by a partially-applied migration would turn every search on that table into a 500.

Hence the `CASE WHEN jsonb_typeof(…) = 'array' … ELSE '[]'::jsonb END` inside the call. Writing the type test as an `AND` beside the `EXISTS` instead does **not** work: SQL does not guarantee evaluation order between `AND` operands, so the planner is free to run the function first. The guard has to be inside the argument.

### `searchExpr` became `searchPredicate`

It returned an expression that `buildRecordSearch` appended `ILIKE ${pattern}` to. A multi-value column cannot be matched that way — the question is whether _any element_ matches, which is a predicate shape no projection can express. Widening the contract to `(key, pattern) => Sql | null` cost five one-line rewrites and is what makes multi expressible at all.

Rejected: substring-matching the raw `["Won","Lost"]` text, which "works" and also lets a term of `","` or `[` match every multi-valued row. That is a lie rather than a near miss.

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

### The open record lives in the URL, not in a store

A `recordDetail` store holding what is open would have been fewer moving parts, and it was rejected: a relation is a **link** in the concept, and a link needs an `href`. Putting the chain in `?detail=` makes the cell a real `<a>` — middle-click, "copy link address" and the SSR'd markup all work — and buys three things a store cannot: browser Back closes the dialog (and Forward reopens it), a refresh or a shared link renders the same dialog server-side, and the drill-down trail is history rather than a stack to maintain.

The cost is the reserved param and the watcher below. Both were one-line changes; a store would have needed its own stack, its own back semantics, and would still have left the link an `href="#"`.

### `BaseButton`'s `to` accepts a query patch, not only a path

The prop was `string`, justified by "every link here is a path". That stopped being true when the dialog moved into the URL: a row's View action changes **one param of the route it is already on**, and the page, sort and filters around it have to survive. Serializing that to a path by hand would either drop them or rebuild the codec at the call site.

It is still not vue-router's `RouteLocationRaw` — that package stays undeclared. `{ query: TUrlQuery }` is our own shape, `NuxtLink` accepts it, and `isLink`/`rootProps` needed no change at all: an object is truthy and `to` was already forwarded unmodified.

### Reading a record is a link, everywhere

The View action in a row could have been a button emitting `view` for the page to act on — every other row action is. It is a `<NuxtLink>` instead, for the same reason a relation is: the dialog **is** a URL, so a control that opens it has an `href`, and middle-click, "copy link address" and the SSR'd markup all follow for free. It also keeps `DynamicTable` out of the business of navigation.

The cost is the `tableId` prop. Reading it from the route inside the component would have avoided the prop and coupled a generic renderer to a URL shape that is not its to know.

### The chain appends from wherever a relation cell renders

`RelationFieldCell` builds its target from `route.query` alone, so a cell **behind** an open dialog also appends to the chain — its `href` reads `?detail=A,A` rather than `?detail=A`. Unreachable in practice: `BaseModal` marks `#__nuxt` `inert` while it is open, which takes the whole table out of pointer, keyboard and accessibility reach, and the hrefs are recomputed the moment the dialog closes.

Making them differ would mean telling the cell where it is rendering — a prop threaded through `DynamicTable` and `RecordFieldValue`, or an injection — to change a link nobody can follow. The uniform rule is what keeps the same cell working in both places.

### The detail endpoint returns an aggregate, not just the record

`GET /api/tables/:tableId/records/:recordId` answers with the record **plus** its table's name, its fields, and its relation labels. Strictly, three resources. The dialog needs all three at once, and `resolveRelationLabels` needs the fields server-side regardless — so they are already loaded, and returning them costs nothing while saving two round trips and two more loading states for one small dialog.

### The dialog's title is static

`Record details`, with `{table} · #{number}` as the first line of the body — not the label the user clicked. A record's label is a property of the **relation field** (`options.labelFieldKey`), not of the table it lives in, so it is only knowable on the click path: a shared `?detail=` link or a refresh could not reproduce it, and the same dialog would carry two different titles depending on how it was reached. A static heading also does not flicker between the pending and loaded states. The label is still on screen — it is one of the record's own values.

### The record's own columns go through one seam

`queryFields(fields)` wraps a table's fields in `Record #` / `Created at` / `Updated at` **only where a query is built**, never where record data is read or written. Special-casing them at each layer instead would have meant a branch in the codec, the schema, the SQL builder, the table and the filter panel — five places to forget one.

The reserved keys are **camelCase**, a shape `slugify` can never emit, so no user field can shadow one. `RESERVED_FIELD_KEYS` states the reservation rather than relying on that luck.

### `searchExpr` is separate from `expr`

NUMBER and BOOLEAN cast in their filter projection, and neither `numeric` nor `boolean` has an `ILIKE` operator. NUMBER searches the un-cast text; BOOLEAN opts out (searching `e` would match every `false`); RELATION opts out because its stored value is a cuid, and matching the label instead would run `targetLabel`'s correlated subquery against every row — the count query has no `LIMIT`.

### `buildRecordSearch`'s parentheses are load-bearing

`withinRange` returns a bare `a >= x AND a <= y` with no parentheses of its own, which is safe only while every sibling is `AND`. Search is the only OR in the query layer, and unparenthesised it would bind to the last bound of a range filter and silently widen it.

### `SEARCH_MIN_LENGTH` is enforced by the schema, not the input

An unanchored `ILIKE` over user-defined JSON keys is unindexable and the count query cannot stop early, so a one-character term is a full-table scan paid twice. Enforcing it client-side only would leave the endpoint open to any caller.

### Relation option search deliberately does **not** enforce `SEARCH_MIN_LENGTH`

Read the reason the floor exists rather than the name of the constant. Not one half of it holds for `/fields/:fieldId/options?q=`: it is one expression over one table chosen by the field's own metadata, not an OR across every searchable column of every row; there is no count query, so nothing is paid twice; there is a hard `LIMIT RELATION_OPTIONS_LIMIT`; and a 300 ms debounce bounds the request rate. A one-character term costs exactly what the **zero**-character term this endpoint already serves unconditionally costs, so rejecting `a` while accepting `` would be cargo cult.

There is a real UX cost too: with a floor, typing one character either shows the unfiltered seed (a lie — it looks like the search did nothing) or needs a third "keep typing" state.

The bound that applies here is `max(100)`, which is what stops a caller pushing a megabyte pattern into an `ILIKE`. Stated explicitly so nobody later harmonises the two on the strength of the shared word "search".

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

`--color-surface-hover` / `-disabled` / `-muted` are separate tokens today with the same value, and `--color-surface-row-hover` / `--color-canvas` are a second such pair. The previous single `--color-bg` meant page background, row hover, disabled fill and chip fill at once; re-collapsing them just relocates that bug. The row-hover pair earns its split the hard way — see _The row wash is not the control wash_ below.

### The row wash is not the control wash

`--color-surface-row-hover` (`$gray-50`) is lighter than `--color-surface-hover` (`$gray-100`) because a hovered row is the one surface a **badge** has to survive. Every badge fill sits within 1.05:1 of `$gray-100`, so a row painted at the control-hover value erases the badge outright. Raising the badge fills instead would have broken their 4.5:1 text pairings; giving the badge a border back is what this change removed. The row is the thing that moved because it is the only one of the three with no other job.

### The border ramp is four steps, by job

`-subtle` is a rule **inside** a surface (a table's row divider), plain is structural (the box itself), `-strong` is a heavier structural job (a pinned column against columns sliding under it), and `-control` is the only one carrying a contrast floor: a control's outline is the only thing identifying the control, so it needs 3:1 non-text. Neither `$gray-200` (1.3:1) nor `$gray-300` (1.66:1) clears that — `$gray-400` (3.17:1) exists for exactly this. `BaseButton --secondary` is surface-on-surface, so its border is load-bearing. A row rule has no floor at all, which is why `-subtle` can be as light as it is.

### A coloured badge carries a dot, not a border

`BaseBadge` had a 1px border whose only job was surviving the hovered row. With the row wash lightened that job is gone, and the badge matches the design concept: fill, word, and an 8px dot in the `-fg` step.

The dot is a `::before` with **empty** `content`, not the concept's `<i>`: an empty pseudo-element contributes no accessible object, which is correct because the colour is redundant with the word it sits beside, and `DynamicTable` renders one badge per SELECT cell so a real node would cost one per cell. A glyph (`content: '●'`) is wrong twice over — CLAUDE.md §8 bans text glyphs as icons, and a non-empty `content` string _does_ reach the accessibility tree.

The guard is `variant === 'chip' && color !== undefined`, so `--label` never draws one: it is a metadata marker with no hue to signal. The `color === undefined` half is the atom's own contract rather than a state the app currently reaches — a SELECT cell always resolves to a real hue, because `badgeColorFor` falls back to `DEFAULT_BADGE_COLOR` for a value the field no longer offers. A choice renamed after records were written therefore renders **grey with a grey dot**, not untinted. Do not "simplify" the guard to `color !== undefined` on the strength of that: `--label` is reachable, and it is what the second half is for.

The padding moved `rem(1) rem(7)` → `rem(2) rem(8)` in the same change, absorbing the pixel the border gave up so the box keeps the size the row height is built around. Do not "tidy" it back to a round number.

`BaseColorPicker` keeps the border on its swatches, and that asymmetry is the point: a swatch is pure colour with no word beside it, so its edge is the only thing bounding it. It is now the sole consumer of the `-border` step.

### The accent and danger tints are opaque

Both were `rgb(… / 8%)`. A translucent tint composites against whatever is under it, and each of these lands on `--color-surface` _and_ `--color-canvas` — the ghost button's hover, the filter chip, and the error banner all appear on both. Flat steps (`$blue-tint`, `$red-tint`) make the two renderings identical; the danger banner on canvas went 4.66:1 → 4.92:1 as a side effect. The comment that used to justify the alpha form ("a custom property's alpha cannot be modified in CSS") explained why they were _spelled out_, not why they were translucent.

### The sort icon is muted with `opacity`, not a colour step

`BaseInput` carries the general rule — a muted foreground is a colour token, because placeholder text at `opacity: 0.6` measured ~2.4:1. `DynamicTable`'s sort icon is the deliberate exception: it has to mute **whatever colour it currently inherits**. At rest that is the header's `--color-text-secondary`; under the pointer the sort button hands it `--color-accent`. A fixed colour step can only mute one of the two, and restoring the other costs a `color: inherit` override that then has to out-specify the `--active` modifier.

The value is `0.35`, which composites to ~`#C6C8CD` — about **1.67:1**, deliberately under the 3:1 SC 1.4.11 bar for non-text UI. That is a considered trade, not an oversight: see **Accepted limitations**. It was tried at `0.7` (~3.14:1, compliant) first and read as visual clutter across four columns at once. The `BaseInput` rule still stands for **text**, which needs 4.5:1 and cannot reach it through transparency.

The glyph is `mdi:code-tags` under `transform: rotate(90deg)`, not the nominally correct `mdi:unfold-more-horizontal`. Turned a quarter turn, `code-tags` is a chevron pointing up stacked over one pointing down — 12×20 of its viewBox against the other glyph's 9×18 — and its two halves are more open and further apart, which is what makes it read as an affordance at 14px. `--active` resets the rotation to `none`, because the sorted column's `mdi:arrow-up` / `mdi:arrow-down` must stay upright.

### Breakpoints live in `_mixins.scss`, in `em`

A media query cannot read a custom property, and `additionalData` injects that file into every SFC. `em` rather than `px` so it honours the browser's font-size setting.

### A truncating cell clips with `overflow: clip`, not `hidden`

`DynamicTable`'s cell wrapper caps a column by truncating, and `overflow: hidden` clips a **descendant's** focus ring along with the text. That went unnoticed while every focusable thing in the table owned its own box; a relation cell puts a link _inside_ the wrapper, and its ring was invisible on all four sides.

`clip` truncates identically — the ellipsis is still computed at the content edge, so no extra text shows — but honours `overflow-clip-margin`, which lets the ring paint outside the box while the text stays in it. The margin is written as `rem(5)` (the ring's 3px width + 2px offset) because **Chrome drops `overflow-clip-margin` to 0 for any `calc()`**, `var()` included. It is the one place the ring's geometry is restated rather than referenced, so it has to move when `--focus-ring-*` does.

### Focus is never removed, only restyled

`_reset.scss` carries a zero-specificity baseline — `:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible` — so nothing can end up with no ring, and any component rule overrides it without a fight. Component rings use `outline`, not `box-shadow`, so an ancestor's `overflow` cannot clip them.

### Every sized control is one height; `link` alone has none

There is a single control height and no secondary size. `primary`/`secondary`/`danger`/`ghost` take it as `min-height`, `icon` takes it on both axes, `BaseCheckbox` gives it to the whole label row, `AppSidebar` to its items, `DynamicTable` to its sort button. `--link` is the one exception and is not an oversight: it is a text run with the semantics of a button, and it is what sizes `.table-card__actions` and `.field-row` — giving it a height would grow both surfaces for no gain, since neither is a standalone target.

The heights that are _derived_ from the control rather than equal to it are all in one direction — a control plus its own inset — and are written that way rather than as literals: `DynamicTable`'s `tbody td` is `calc(var(--control-height) + #{$cell-padding-y * 2})` against a cell inset of `rem(4)`. Anything that instead restates the number by hand will drift the next time the token moves, which is exactly what happened at 44px.

`BaseModal`'s header padding (`rem(10)`) and `DynamicTable`'s cell padding (`$cell-padding-y`, `rem(4)`) are the two insets that keep those bands from gaining an empty strip around a control. Both are deliberate and both are load-bearing. The layout's sidebar toggle is hand-rolled rather than a `BaseButton`, so it restates `--control-height` explicitly — the one place the token is duplicated instead of inherited.

### The control height is 36px, and 44px was never the AA bar

WCAG 2.2 **AA** is SC 2.5.8 _Target Size (Minimum)_: **24×24 CSS px**. 36px clears it with 50% margin. The 44×44 the design system used to carry is SC 2.5.5 _Target Size (Enhanced)_, which is **AAA**, and also the Apple HIG touch figure — it was being quoted in `CLAUDE.md` under a "WCAG 2.2 AA" heading as though it were the requirement. It was not.

The drop to 36 is a density decision, and it is safe because it never touches a content box: every control lost 8px of height _and_ 8px of block padding together, so text has exactly the room it had at 44. `form-control` went `rem(10)` → `rem(6)`, `DynamicTable`'s sort button and its Actions corner header the same (both have since folded into `$cell-padding-y`, `rem(4)` — the header row is sized by the sort button's `min-height`, so its block padding only has to stay under it), rows `rem(52)` → the calc above. Anything that trims the height without trimming the padding clips instead of compacting.

`--header-height` moved 64 → 56 in the same change, keeping the 10px-per-side slack it had around a 44px control. Its only consumers are the shell grid row and the off-canvas sidebar's `top`, both token references.

The focus ring was left at `3px` width / `2px` offset. An outline paints outside the border box, so its geometry is independent of the control height, and the places where a 5px halo crosses into a neighbour (`DynamicTable`'s actions `gap: rem(4)` and its cell inset, `AppSidebar`'s `gap: rem(2)`, and the records header's ghost pair at the same `rem(4)` — see below) were true at 44 and are unchanged — more conspicuous against a smaller box, not newly broken.

### A ghost button's padding is spacing, so the gaps beside it are unequal on purpose

`ghost` is `padding: 0 rem(12)` over a transparent background: nothing paints at its box edge, so that padding reads as part of the gap. In the records header the row's `cluster` at `rem(16)` therefore put **40px** of visible space between Settings and Filters (12 + 16 + 12) and **28px** between Filters and the bordered search box (12 + 16 + 0) — the two controls that belong together looked the furthest apart.

The ghost pair sits in its own `cluster(4)`: 12 + 4 + 12 is the same 28. **The two gaps in that row are deliberately different numbers producing equal space** — normalising them back to one value is the regression, and it will look like a tidy-up.

The cost is a fourth site where the 5px focus halo crosses into a neighbour (above): Settings' ring overlaps Filters' box by 1px. The identical trade-off was already accepted at the identical `rem(4)` in `DynamicTable`'s row actions, so this is the existing bargain, not a new one.

### The header group needs `min-width: 0`, same as the panes

The two table headers group the `<h1>` with its primary action, so the **group** — not the title — is `page-header`'s flex item. `page-title` still carries `min-width: 0`, and that is still what lets the text shrink _inside_ the group; it does nothing for the group itself. A flex item's automatic minimum is its content-based minimum, and a nowrap flex container's min-content size is the sum of its items' contributions — which for a `white-space: nowrap` heading is the whole untruncated table name. `overflow: hidden` on the `<h1>` does not rescue it: `overflow` zeroes a box's own _automatic minimum_, not its min-content _contribution_ to its parent's intrinsic size. Without `min-width: 0` on the group the header refuses to shrink and a long name runs past the pane instead of ellipsising. It reads like a redundant line and is not.

**Rejected: `flex: 1` on the group.** That implies `flex-basis: 0`, so the group's base size stops being its content, it never reaches `page-header`'s wrap threshold, and the title starts ellipsising at widths where it would have fitted whole. `justify-content: space-between` already pushes the right-hand cluster to the edge; nothing needs to grow.

The primary button in that group takes `flex: none`, through a page-owned class (`&__create`, the same shape as `&__search`) rather than a bare `.base-button` selector — a page must not reach for another component's internal class name. Shrink is distributed in proportion to flex base size, so an unfrozen button reaches its min-content and wraps "Add record" onto two lines; `.base-button` declares no `white-space`, and `--primary` is `min-height` precisely so a long label wraps rather than overflows. Freezing the button sends every pixel of the deficit to the title, which is the one child that can absorb it.

### A table column's width cap lives on a wrapper, not on the cell

`DynamicTable` sizes columns from content — `th, td { white-space: nowrap }` under the browser's default `table-layout: auto`. A table's columns are user-defined, so no field's content is bounded from above: one long TEXT value stretches its column to the width of that value and pushes the rest of the grid out of the viewport. `$column-max-width` (`rem(320)`) caps it, and `$content-max-width` derives the per-box figure by subtracting the cell's own `$cell-padding-x` twice, so a column bounded by a **value** and a column bounded by its **header name** land on the same width.

**The cap cannot go on the `td`.** CSS 2.2 §17.5.2 leaves the effect of `min-width`/`max-width` on table cells explicitly undefined, and under `table-layout: auto` browsers ignore it — the column is sized by the cell's max-content contribution, which the declaration never touches. A **block child's** `max-width` does bound that contribution. So `&__cell` is load-bearing markup, not a div for its own sake; deleting it silently restores the unbounded behaviour with the SCSS still in place.

**Rejected: `table-layout: fixed`.** It discards content-driven sizing outright and needs an explicit width per column — a figure the metadata layer has no source for, since a field carries a type and a name, not a display width. Every column would end up the same width whether it holds a checkbox or a paragraph.

**Rejected: a `--*` token.** One component's measure, and §8 admits tokens only as coherent semantic sets. It sits beside `$cell-padding-y` / `$cell-padding-x` as a local SCSS variable for the same reason.

**Rejected: capping `&__sort` instead of its label.** That button is deliberately `width: 100%` so the whole header cell is the sort target; a `max-width` on it stops it short of the cell edge whenever the table has widened a column past the cap. The cap therefore sits on `&__sort-label`, which leaves the gap and the sort icon outside the bounded box — a column bounded by its header name can run ~`rem(18)` over `$column-max-width`. Closing that gap means encoding the icon's rendered size in the table's stylesheet, which buys nothing at that magnitude.

**`BaseBadge` truncates itself.** A badge is `display: inline-flex`, so it is an atomic inline box to the cell that contains it: `text-overflow` cannot ellipsise it, and an overflowing badge is hard-clipped mid-pill with the ellipsis painted over its own fill. The `&__text` wrapper plus `max-width: 100%` moves the truncation inside the badge, where it renders as a pill ending in an ellipsis. This is why the badge, not `DynamicTable`, owns the rule.

### `BaseButton` renders the element its role implies

One component, one stylesheet. A `BaseLinkButton` would have been a second copy of six variants' worth of SCSS kept in step by hand, and the two would have drifted the first time a token moved.

Rejected: a separate `href` prop — `NuxtLink` already resolves an absolute URL to a plain `<a href rel="noopener noreferrer">` with no router involvement, so `href` would be a second prop meaning the same thing, plus a decision at every call site. Rejected: a polymorphic `as`/`is` — an open element set with no caller asking for it, and it would let a call site emit a `<div>` that looks like a button, which is the bug this component exists to prevent.

`to` is typed `string`, not vue-router's `RouteLocationRaw`: that package is deliberately undeclared, and every link in the app is a plain path. `NuxtLink` is imported from `#components` rather than resolved by name — only components _in templates_ are ambient; one referenced from script is imported like anything else.

`disabled` wins over `to` because a disabled link is not a link. Every alternative rebuilds the native attribute out of `aria-disabled` + `tabindex="-1"` + `pointer-events: none` — three mechanisms for one, taking the control out of the tab order by hand, and needing a selector for a state nothing else in the app expresses that way. A JS click guard was rejected separately: `stopImmediatePropagation` ordering against fallthrough listeners is not something a component can rely on, and `NuxtLink` installs its own handler you cannot get in front of.

### `text-link` is a class, not a mixin

It had three `@include`s and no per-site variation, which is a shared block, not a fragment. Converting the two page-header links to `BaseButton` with `to` took it to two, both of them prose links inside a sentence — so `_text-link.scss` carries the one look and `_mixins.scss` no longer carries a mixin whose whole body was a fixed declaration list.

That conversion was the point rather than a side effect: at 14px × `--line-height-base` with no padding those two header links were ~21px tall, standing alone in an action cluster rather than inline in prose, so SC 2.5.8's inline exception did not cover them. They were the only targets in the app under 24×24.

### The viewport lock lives in the shell, not in the records page

`app/layouts/default.vue` is `height: 100dvh; overflow: hidden`, and the sidebar and main region scroll their own content. The alternative — leaving the shell in document flow and giving the records page a `height: calc(100vh - var(--header-height) - …)` — was rejected on two counts: the page would have to restate the shell's own padding and header height and stay in step with them by hand, and it would still let the brand bar scroll away above the table, which is half of what makes a long list tiring to use. Putting it in the shell also deleted the sidebar's `position: sticky` + `calc(100vh - var(--header-height))`, which existed only to fake the height the fixed shell now supplies.

`dvh`, not `vh`: on mobile a collapsing URL bar leaves a `100vh` shell overhanging the visible area, which is exactly where the pager lives.

The consequence to know: **`min-height: 0` on the two panes is load-bearing.** A grid or flex item's automatic minimum is its content, so an item holding a 50-row table grows past its row and the `overflow-y: auto` beside it never fires. It reads like a redundant line and is not.

### The records grid sizes to its rows, not to the pane

`DynamicTable` takes `flex: 0 1 auto` from the records page, so its height is the height of its content, capped by the space left in the pane: a few rows end at the last row with the pager directly beneath, and a full page shrinks to the pane and scrolls inside itself.

It was `flex: 1` first, on the reasoning that a pager welded to the bottom edge gives the page a stable frame. That was wrong, and visibly so — with seven records the grid was a mostly-empty box with a void between the last row and the pager. **Do not restore it.** The frame is not worth the void.

`flex-basis: auto` is the load-bearing third of the shorthand: it makes the flex base size the grid's own content height, which is what a `max-height` or a measured height would have had to approximate. Nothing here states a height, so the behaviour re-resolves for free on resize, at any breakpoint, and when the filter summary or the error banner takes a slice of the pane.

The empty states are centred with `margin-block: auto` on the child rather than `justify-content: center` on `&__body`, because the parent cannot centre one child without lifting a short grid off the top as well. That rule is nested (`&__body &__empty`) so it outranks `BaseEmptyState`'s own `margin` — flat, the two selectors tie and the winner falls to stylesheet order across components.

### The sticky table header's rule is a shadow, not a border

`thead th` in `DynamicTable` carries `box-shadow: inset 0 -1px 0 var(--color-border)` where every other cell edge is a `border-bottom`. Under `border-collapse: collapse` the collapsed edge between the header row and the first body row is painted by the **table**, not by the cell, so a sticky `th`'s `border-bottom` scrolls away with the rows and the pinned header ends up floating. `border-collapse: separate` would fix the border and cost the single-hairline grid the table is built on, so the shadow stays. For the same reason the `th` carries its own opaque `background`: its padding lives on the inner `&__sort` button, so only the cell can paint the full width the rows scroll under.

### The pinned Actions column needs a wrapper inside the cell

The action buttons' flex row lives on a `div.dynamic-table__actions-group` **inside** the `<td>`, not on the `<td>` itself, and that is load-bearing rather than tidiness. A `<td>` with `display: flex` is not a table-cell box, so CSS generates an anonymous table-cell around it; the sticky box's containing block becomes that anonymous cell, which shrink-wraps it, and a sticky box cannot move outside its containing block. `position: sticky; right: 0` would clamp to zero movement and the column simply would not pin. Putting the flex on a wrapper keeps the `<td>` a real table cell — which the column's `width: rem(1)` + `white-space: nowrap` shrink-to-fit also assumes.

Its left edge is `box-shadow: inset 1px 0 0` for the same reason the sticky header's rule is a shadow: under `border-collapse: collapse` a real border is painted by the table, not the cell, so it would scroll away instead of riding with the pinned column. The hairline is permanent rather than appearing on scroll — a scroll-aware shadow would put a scroll listener and reactive state into a component that is otherwise pure CSS, and in this design borders already do the structural work.

It is the one divider drawn in `--color-border-strong` rather than `--color-border`: separating a frozen column from columns sliding underneath it is a heavier job than ruling off a row. **A tinted fill was considered and rejected** — `--color-surface-muted` is the same value as `--color-surface-hover`, so filling the column would have swallowed the row hover exactly where the buttons are, and `--color-accent-tint` reads as "selected" everywhere else in the app (active sidebar item, filter chips), which a permanently pinned column is not. The column earns its emphasis from the divider alone.

**A wider gutter on the pinned column was tried and dropped.** It took `rem(20)` against the scrolling columns' `rem(16)`, on the reasoning that a column sitting between a divider and the scrollbar needs the air. In practice the 4px read as a misalignment against the header label above it rather than as breathing room, and it is what the divider is for. Every cell now takes the same `$cell-padding-y $cell-padding-x` — see below.

`&.dynamic-table__actions-head` still needs its own padding rule: it is the only header with no sort button to carry the inset, so `th { padding: 0 }` would leave its label flat against the divider while every label beside it sits a full `$cell-padding-x` in. It takes the same pair as everything else, not a special one.

The pinned cells paint opaque backgrounds, so `tbody tr:hover` has to repaint the actions cell explicitly; without it the hovered row shows a white notch at its right edge.

`&.dynamic-table__actions-head` is nested inside `thead th` rather than written as a sibling `&__…` block, and spells the class out because `&__…` would resolve against the wrong parent. That is specificity, not style: `.dynamic-table thead th` outranks a bare `.dynamic-table__actions-head`, so the same declarations written as a sibling block are silently dead. Moving it out of its parent will not error — it will simply stop applying.

The body counterpart, `&.dynamic-table__actions` inside `tbody td`, **used to exist for the same reason** and is gone: it carried a tighter `padding-block` than the generic cell, because the row `height` is only a minimum on a real table cell and a 36px button at the old `rem(6)` pushed every row to 49px. Now that every cell takes `$cell-padding-y` there is nothing left to override — the constraint that rule existed to satisfy is satisfied by the generic rule itself.

### `DynamicTable` rows have an explicit height

`height: calc(var(--control-height) + #{$cell-padding-y * 2})` on `tbody td`, not derived from the tallest cell — otherwise the action cell's buttons define the row, and a button plus whatever padding happens to be generic sets it rather than the design doing so. A row is one control plus the cell inset on both sides: 44px at the current 36px control and `rem(4)` inset. A bordered row measures 45px; the last row drops its border and measures 44.

**The height and `$cell-padding-y` are one decision, not two.** A table cell treats `height` as a minimum, so the action cell's 36px buttons only land _on_ the row height if the padding the height was built from is the padding the cell actually has. Raising `$cell-padding-y` without the `calc` following it grows every row; the `calc` is written against the variable precisely so it cannot be raised alone.

It is the app's **first and only `calc()`**, and deliberately so. Written as a literal it was a magic number calibrated against a token three files away, and it went stale the moment that token moved — the `calc` is what makes the relationship survive the next density change instead of quietly mis-sizing every row.

### `BaseSelect` no longer pins `height` — the reason expired

It used to, because Chrome ignores `line-height` on `<select>` and left it 1px taller than the inputs beside it. Its trigger is a `<button>` now, so the quirk is gone and `form-control`'s `min-height` applies like every other control. Recorded rather than deleted, or the next person to find a select a pixel off will re-pin it.

### `BaseBadge --chip` is never uppercased

It displays a **value** — SELECT choices are user data. `--label` is the uppercase variant, and it marks metadata (`required`), never content.

### Never ship a dead control

The header deliberately has no global "Search everything" box: cross-table search is not built, and a dead input is worse than a gap. The principle outlives the instance — if cross-table search is built, the box arrives with it.

### A SELECT choice is coloured from a closed palette, not a free colour picker

A custom hex picker was the alternative, and it loses on all three axes the codebase already cares about.

It breaks the token boundary `_palette.scss` exists to enforce: components consume `var(--color-*)` and the build makes a primitive unreachable, so an arbitrary colour would have to arrive as a literal. `BaseButton`'s `tone` prop is the precedent — it **replaced** a free-form `hoverColor` string for exactly this reason.

It breaks the contrast guarantee. A badge needs 4.5:1 text on its fill; with a closed set every pairing is authored and verified once, while a free picker needs runtime luminance maths and still lets a user choose a pairing that fails.

And it stores the wrong thing. What is persisted is a **name** (`"blue"`), not a value, so the colour survives a re-theme, and dark mode remains reachable. The upgrade path is preserved either way: widening the enum to accept a hex later needs no data migration, because the stored names stay valid members of whatever union replaces it.

### A choice's identity is its own text

`Record.data` stores the choice string, not an option id. That keeps the whole SQL layer, the filter constants and the URL codec out of this change — SELECT still filters, sorts and searches on the stored text.

The cost is that renaming a choice orphans the records holding the old one. That was already true before colours existed; it is now also true of the colour, and it is recorded below rather than fixed, because a stable option id buys nothing for colour and rewrites `record-query.ts` to get there.

### The badge palette is selected in JavaScript, by token name

`badgeTint()` builds `var(--color-badge-<name>-bg)` from the colour prop and returns inline custom properties. A Sass `@each` emitting one modifier class per hue would keep the selection in CSS, but it needs the palette list to exist in both SCSS and TypeScript — and the failure mode of that duplication is silent: add a colour to the enum, forget the stylesheet, and the badge renders unstyled with no error anywhere. Composing the name keeps `_variables.scss` the single definition, and a literal colour still never reaches a component.

### `BaseColorPicker` handles Escape on its panel, never on `document`

It opens inside `BaseModal`, whose Escape listener is on `document`. Two document-level listeners cannot be ordered reliably — `stopPropagation` between listeners on the _same_ node does nothing, and registration order is an accident of mount order. Handling the key on the panel with `.stop` means the event never reaches `document` at all, so one Escape closes the popover and leaves the dialog open. The precondition is that focus is inside the panel while it is open, which the roving tabindex requires regardless.

No `useDismissable` was extracted and `BaseModal` was not refactored, though an earlier plan called for both. The justification had been that a popover would be the third hand-rolled document-Escape listener — but because the popover deliberately does _not_ register one, the count stays at two and the extraction would have had a single consumer. Extracting on the first occurrence is the speculative build `CLAUDE.md` §1 rules out; the trigger still fires the day a second popover appears.

### The trigger fired: `usePopover` and `useAnchoredPosition` were extracted

`BaseSelect` is the second popover, so the entry above is now spent. Two composables rather than one, split by reason to change: `usePopover` owns open state, outside-pointer dismissal and focus restore; `useAnchoredPosition` owns measurement, flipping and reflow. The seam is real because their consumer sets differ — `BaseColorPicker` took the first and not the second, since its panel is 254×110 inside a centred dialog where `position: absolute` already works. Merging them would have made that retrofit an all-or-nothing change to a working control.

**`usePopover` registers no Escape listener and must never grow one.** The entry above is the reason, and it applies verbatim to a select opened inside the filter drawer. Escape is the caller's, in one of two spellings — see "Escape is swallowed only while something is open" below.

It also exposes `containerRef` and `triggerRef` **separately** — the outside-click boundary and the focus-restore target are not the same element once a control puts a clear button beside its trigger. Inferring the second from the first with a `querySelector` was tried and rejected: it made the ordering of two buttons load-bearing and invisible.

### `BaseSelect` is an ARIA listbox **or** a combobox, never a `<select>`

A native `<select>` cannot render a choice's colour (`<option>` fills are not styleable across browsers), cannot search, cannot load asynchronously, and has nowhere to put "loading" / "no results" / "could not load" as distinct states. All four were wanted at once, so the element had to go.

`searchable` picks the control's root, and only the root — the clear button, the chevron, the teleported panel, the status row and the `role="listbox"` `<ul>` are shared:

- **`false` → a `<button aria-haspopup="listbox">`.** Native semantics, native focus, and its accessible name is label + current value, the way a `<select>` announces.
- **`true` → an `<input role="combobox">`.** The user types into the control itself; the panel below lists matches.

What it cost, all of it deliberate:

- **the OS-native picker on touch** — an accepted limitation, the same trade as the 36px control height; `searchable` additionally raises the soft keyboard where a `<button>` did not;
- **arrow keys changing the value while closed** — a native select does it; the ARIA pattern opens the list instead, and a filter that changed under an unseen arrow key would fire a request per press;
- **type-ahead**, which is _not_ given up — reimplemented by hand (500 ms buffer, match on the option's label) for the non-searchable branch, and it must stay. Where there is a search box, the search box _is_ the type-ahead.

Rejected: a native `<select>` with a colour swatch rendered beside it. The swatch cannot follow the open dropdown, which is exactly where the choice is made.

### `searchable` is an explicit prop, and the threshold moved to the call site

It was once derived — `loadOptions !== undefined || options.length > 8` — which welded search to the data source and made it impossible to turn off. Two things were wrong with that:

1. **Search and async are orthogonal.** Local options deserve filtering just as much; a server-backed list is not the only long one.
2. **The docblock defending it was factually false**, not merely superseded: it claimed "a call site cannot know whether the user has three tables or forty". Every call site owns the `options` array it passes and can count it. `shouldSearch()` in `app/utils/select.ts` counts exactly what the component was counting, one layer out, where the number is visible.

`shouldSearch` exports the **predicate, not the number**, because what the two field-type registries would otherwise duplicate is the comparison rather than the literal.

Rejected: a tri-state `searchable?: boolean | 'auto'`. It keeps the threshold inside the component — the very thing being removed — and would add a fourth spelling of the implicit behaviour rather than deleting it.

**Not for a list that arrives after mount.** `FieldFormModal`'s two relation selects hardcode `searchable` instead of counting: both lists are fetched, so a derived value would start `false`, render a `<button>`, then flip to an `<input>` when the fetch lands — swapping the focused element out from under the user. A stable branch beats an accurate one.

### The search input is in the control, not in the panel

A select where you click to open and then move to a second field to type is a select wearing a search box. Putting the input in the control makes it what it actually is — a combobox — and the panel becomes purely a result list.

**The selection renders as an overlay over the control, never as the input's value.** Consequences that make it the right model: searching never means clearing what is already chosen first; there is no restore-on-close or restore-on-blur to get wrong; and one piece of markup serves single and multiple alike. The native `placeholder` attribute handles the empty case, so it can never show _underneath_ a selection.

Rejected: APG's editable-combobox flavour, where the input's value **is** the selected label. It needs restore-on-close logic, forces the user to erase the current value before searching, and has no multi-select story at all.

Two ARIA consequences that are easy to get backwards:

- **`aria-labelledby="${id}-label ${id}"` must not cross to the input branch.** On a `<button>` that self-reference folds the element's _content_ into its name. On an `<input>` the same construct computes from the element's **value** — so the control's accessible name would change with every keystroke. The button instead points at the overlay by IDREF, which keeps the name label + value with the markup shared.
- **The selection has to be announced somewhere.** On a `<button>` it was the accessible _name_; on an `<input>` the accessible value is the search term, so without help the selection would reach assistive tech nowhere but the option rows. `aria-describedby` points at the same visible overlay — a description is the right slot for "what is currently chosen", and it invents no visually-hidden element (the project has no `sr-only` mixin).

### Escape is swallowed only while something of ours is open

`BaseModal` listens on `document`, so a popover must never eat an Escape that belongs to the dialog around it. **Where focus lives inside the panel, `@keydown.esc.stop` says that structurally** — the panel only exists while open, so the handler cannot fire otherwise. That is `BaseColorPicker` and `BaseSelect`'s non-searchable branch.

**Where the control keeps focus outside its panel, the modifier is actively wrong.** A combobox holds focus in its input whether the list is open or shut, so an unconditional `.stop` there would mean _the filter drawer can never be closed by keyboard while any searchable select has focus_. The condition is not expressible as a modifier, so that branch handles the key in JS and calls `stopPropagation()` only when `open`.

The invariant is the sentence, not the spelling.

### Opening on type is driven by the model, not by `keydown`

A printable-key test (`event.key.length === 1 && !ctrl && !meta && !alt`) is wrong for at least three real inputs: **paste** (`Ctrl+V` is excluded by definition, and the pasted text fires no keydown of its own), **IME composition** (the keydown is `Process`, never the composed character), and text **dropped** into the field. Watching the model catches every path by construction.

It also means the input needs no composition guard: `v-model` already withholds the write until a composition commits. `BaseInput` hand-rolls one only because it binds `:value` + `@input` to dodge the `type="number"` cast — do not copy that here.

### A click inside a searchable control never closes the panel

On the non-searchable branch a click on the trigger toggles, as a button should. On the combobox branch it only ever opens: a click inside a text field places the caret, and closing on it would make it impossible to click into the middle of a term being edited.

The chevron therefore stays decorative on both branches, so the combobox offers no pointer close. Accepted rather than fixed: a real toggle button would add a third focusable element inside a 36px control for a case that outside-click and Escape already cover.

### In `multiple`, the control shows a count, not chips

One selection reads as itself; several read as "3 selected". Chips were rejected on a structural argument, not an aesthetic one: they make the control's height a function of its content, and **nothing in the positioning layer observes that**. `useAnchoredPosition` measures on open, on `resize` and on capture-phase `scroll` — the moment a chip wrapped to a second row the control would grow, the panel would not move, and it would visibly detach from the field it belongs to. Fixing that means a `ResizeObserver` in a composable whose other consumer has no use for one: a positioning rewrite in service of a display choice.

Independently sufficient: the 36px control height is a design invariant (`CLAUDE.md` §8), and in the filter drawer every control below a growing chip field would shift down as the user picks — moving the control they were aiming at.

### `useListboxNavigation` was extracted for SRP, not DRY

"Extracting on the first occurrence is the speculative build `CLAUDE.md` §1 rules out" (above) does **not** bind here: that entry rejected a _DRY_-motivated extraction of a composable with one consumer and no size problem. This is decomposition of an SFC that had grown to two control branches, two keyboard dispatchers, a search model, an async pipeline and a popover. The blessed precedent is `useSelectOptions`, and this file carries the same "not a general-purpose composable" warning for the same reason.

`typeAhead` lives in it despite being called from only one of the two branches: its whole effect is `setActive(index)`, so it shares the composable's single reason to change. Splitting a twenty-line function with one consumer into a third file is the over-fragmentation the SRP argument is supposed to prevent.

### The select panel teleports to `<body>`, and the native `popover` attribute cannot substitute

`BaseModal` marks `#__nuxt` `inert` while a dialog is open, and `inert` is inherited by the entire subtree. A panel rendered in place is therefore unfocusable inside the very drawer it belongs to — and the native `popover` attribute does **not** rescue it, because top-layer promotion changes paint order, not DOM ancestry. Teleporting to `<body>` makes the panel a sibling of the app root, which is the only escape; it is the same reason `BaseModal` itself teleports.

Clearing the drawer's `overflow-y: auto` is a second benefit, not the reason. Both together are why `useAnchoredPosition` works in viewport coordinates with `position: fixed`.

### `.stop` on Escape survives the Teleport

Worth stating because it looks like it should not. The panel is a real DOM child of `<body>`, so a keydown inside it bubbles panel → body → html → document; stopping it at the panel means `BaseModal`'s `document` listener never sees it. Teleport moves the node, not the event path.

This covers the branch whose focus is inside the panel. The combobox branch's handler is **not** teleported — it sits on the input, in the control — so it needs no such argument; what it needs instead is the `open` condition the modifier cannot express (above).

### The active option's indicator is an inset outline, not a background wash

Under `aria-activedescendant` the active option is not focused, so `:focus-visible` — and with it the `focus-ring` mixin — can never match it. A background wash fails twice over: `--color-surface-hover` on `--color-surface` is ~1.05:1, under SC 1.4.11's 3:1 floor for a non-text indicator, and it is indistinguishable from the pointer hover on the same row. Hence a real outline in `--color-focus`, written out rather than `@include`d, with a negative offset so the scrolling list cannot clip it.

### The async option list is stale-while-revalidating

While a request is in flight the previous results stay on screen under an explicit `Searching…` row, rather than blanking. The condition is still stated, which is what `CLAUDE.md` §7 asks for; emptying the list on every debounce window would flicker for no information gained. The seed (`props.options`) is what shows whenever the search box is empty, so a failed search or a cleared term always lands on a usable list rather than an empty one.

`loadOptions` is passed through to this composable **only when `searchable`**. Handing it a loader nothing can ever call would leave a half-built async machine — `status` pinned at `idle`, `retry` unreachable, the abort and request-id pair dead code for that instance. One ternary, and "never ship a dead control" holds a layer below the UI. Rejected: letting `loadOptions` imply `searchable`, which would re-couple the two props and silently override an explicit `false`.

### The blank option became a placeholder, and the wire format did not move

`— Select —` / `All` used to be real `<option value="">` entries because a native select had nowhere else to put them. They are placeholders now, with `clearable` as the way back. Clearing still emits `''`, which is why `blankIsNull` in `inputs.ts` and the BOOLEAN filter's two adapters in `filters.ts` are **unchanged**, `isFilterValueEmpty` still drops it, and a shared filter URL means exactly what it meant before.

The em-dash spellings went with them: they existed to make a fake choice read as not-a-choice, which a muted placeholder carries on its own. `FieldFormModal`'s **Type** select is the exception that proves the rule — it never had a blank option, its model is `TFieldType`, and it is therefore neither clearable nor placeholdered.

### `BaseSelect` normalises `multiple` instead of reading the prop

The conditional type below has a runtime cost that is invisible until it bites: Vue casts a
bare attribute (`<BaseSelect multiple />`) to `true` only for a prop it knows is `Boolean`, and
`multiple?: TModel extends string[] ? true : false` gives the SFC compiler no constructor to
emit — the built output is `multiple:{default:void 0}`. So a bare attribute arrives as `''`,
which is **falsy**, and the control silently runs in single mode.

`vue-tsc` cannot catch it: the template checker reads a bare attribute as `true`, so the types
agree with each other and disagree with the runtime. The failure is quiet and downstream — the
control emits a string where a list was expected, and whatever adapter receives it decides what
to do with a value it was never meant to see.

`isMultiple` (`props.multiple !== undefined && props.multiple !== false`) makes both spellings
mean the same thing. **Never read `props.multiple` directly.** Widening the prop to a plain
`boolean` would fix the cast and give back exactly the mismatch the entry below exists to
prevent, so the type stays and the read moved.

### An atom's `disabled` must be a declared prop, never attribute fallthrough

`BaseCheckbox` had no `disabled` prop, so `:disabled` on it landed on the wrapping `<div>` by
fallthrough — where the attribute means nothing. The control looked plausible and stayed fully
operable, with only a server 400 behind it. That is the "dead control" failure inverted: not a
control that cannot act, but a lock that does not lock.

The rule generalises to every atom with a wrapper element: a native form attribute has to be
declared and bound to the **inner control**, because fallthrough silently targets the root.
`BaseInput`, `BaseSelect` and `BaseButton` already did this; the checkbox was the gap.

### `multiple` is tied to the model's type, not merely declared beside it

`multiple?: TModel extends string[] ? true : false`. A plain `multiple?: boolean` would let `<BaseSelect v-model="aStringRef" multiple />` compile and then misbehave at runtime — a worse type system than the single-select generic it replaced. With the conditional, that call is a compile error, and the two states cannot disagree.

Internally selection is **always** a `string[]`, whatever the model's shape: one normalisation in, one `commit` out, and keyboard, rendering and ARIA are written once. That is the whole cost of multi mode.

### `RelationFieldSelect` gets its `tableId` from the store, not from `IField`

`IField` carries no `tableId`, and adding one is wrong: `recordColumn()` in `shared/utils/filter.ts` synthesises `IField`s for `Record #` / `Created at` / `Updated at` that belong to no field row and would have to invent one, poisoning a type the query layer keeps honest. `loadOptions(tableId, fields)` already receives it, so the relations store records it per field and `searchOptions` resolves its own URL.

`searchOptions` deliberately does **not** write `optionsByField` — that is the seed every other consumer of `optionsFor()` reads, and a search result would clobber it. It does call `cacheLabels`, so a record found only through a search still renders as its label in a cell afterwards.

---

## Accepted limitations

The register referenced by `CLAUDE.md` §1. **Open** entries are in scope for the current phase; **Accepted** entries are not, unless a request says otherwise.

| Limitation                                                                                                                                                           | Why it stands                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Status                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **A dialog does not trap focus**, it only moves focus in on open and restores it on close                                                                            | `BaseModal` now focuses its own container (or an `autofocus` descendant) on mount and returns focus to the still-connected trigger on unmount. A real trap is unnecessary while `inert` on `#__nuxt` keeps Tab inside, and it is the container rather than the first control on purpose — that control is a destructive Delete in one dialog and a text input in another                                                                                                                                                                                                                                             | **Closed** — the WCAG 2.2 AA gap is met                                                   |
| **Row actions are three inline icons, where the concept draws one `⋯` menu** of full sentences                                                                       | The stated blocker is gone: `usePopover` + `useAnchoredPosition` exist, and they anchor correctly inside a scrolling, clipping container — that is exactly what the filter drawer proved. What is left is that three 36×36 targets in a pinned column still fit, so the menu would be work without a user-visible gain. The third button does add one more site where the 5px focus halo crosses a `gap: rem(4)` neighbour — the bargain that row already struck                                                                                                                                                     | **Open** — revisit when a fourth row action appears                                       |
| **No test suite**                                                                                                                                                    | CI + total `Record<TFieldType, …>` registries have carried it so far                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **Open** — top priority (`CLAUDE.md` §10)                                                 |
| **36px targets are below the Apple HIG / Material touch figure on touch devices**                                                                                    | A flat 36 was chosen over a `@media (pointer: coarse)` override restoring 44: a second geometry mode means every derived height has to hold at two values, and the app's touch use is secondary. Clears WCAG 2.2 AA (SC 2.5.8, 24×24) with 50% margin; it is SC 2.5.5 **AAA** that is given up                                                                                                                                                                                                                                                                                                                       | **Accepted** — revisit if touch becomes a primary surface                                 |
| **Relation picker lists at most `RELATION_OPTIONS_LIMIT` (200) candidates**                                                                                          | Now 200 **matches**, not 200 candidates: the picker searches the target table server-side (`?q=`, debounced 300 ms, race-guarded, matching the label field and the `#number` fallback), so a record past the seed is reached by naming it. The cap itself stands — a dropdown is not a place to render a whole table. A value outside the list is still shown as its own option, so editing never drops a link silently                                                                                                                                                                                              | **Closed** — search shipped; the cap is deliberate                                        |
| **A select no longer opens the OS-native picker on touch**, and a searchable one raises the soft keyboard where a `<button>` did not                                 | The price of a listbox that can render a choice's colour, search, and load asynchronously — none of which a `<select>` can do. Every option row is `--control-height`, so SC 2.5.8 is clear either way. Same trade as the 36px row below; the keyboard half is bounded by `shouldSearch()`, which keeps short pickers on the button branch                                                                                                                                                                                                                                                                           | **Accepted** — revisit if touch becomes a primary surface                                 |
| **The dropdown's `Retry` button is pointer-only**                                                                                                                    | It lives in the teleported panel, and `Tab` dismisses the panel before focus can reach it. Not a dead control — the keyboard path to retrying a failed search is editing the term, which re-issues the request — but the button itself is unreachable. Fixing it needs a roving tabindex across the panel, or a `Tab` that moves _within_ the panel first                                                                                                                                                                                                                                                            | **Open** — a11y, small                                                                    |
| **The dropdown's `role="status"` mounts together with its first message**                                                                                            | The live region is inside `<Teleport v-if="open">`, and a region inserted in the same frame as its content is not reliably announced — so the _first_ status ("Searching…", "No options") is probably silent while later transitions are announced. A fix means a permanently-mounted mirror region in the control, duplicating the copy                                                                                                                                                                                                                                                                             | **Open** — a11y, small                                                                    |
| **In `multiple`, the closed control shows a count, not which values are chosen**                                                                                     | Chips would make the control's height content-dependent, which `useAnchoredPosition` does not observe (see the entry above). The information is a click away in the ticked option rows, and already spelled out in `RecordsFilterSummary` above the table. It now also applies to the **record form**, where the argument is weaker — a filter's selection is restated above the table, an editor's is not, so "3 selected" is the one place multi-value reads as less than single-value did. A chip row _below_ the control (leaving its height fixed) is the cheap fix if it is ever wanted                        | **Accepted** — deliberate; the form case is the one worth revisiting                      |
| **Relation option search scans the target table unindexed**                                                                                                          | An unanchored `ILIKE` over a user-defined JSON key, same ceiling as the three rows below — but paid **once** (no count query), over one table, on one expression, under a hard `LIMIT`                                                                                                                                                                                                                                                                                                                                                                                                                               | **Accepted** — same ceiling                                                               |
| **Only SELECT filters are multi-valued**; every other filter and every record value holds one                                                                        | The second consumer arrived. `options.multiple` makes a SELECT or a RELATION hold a list, `TRecordValue` gained `string[]`, and a multi-value field filters as a list whatever its type declares. The prediction held exactly: the atom needed no change at all, only a prop                                                                                                                                                                                                                                                                                                                                         | **Closed** — multi-value SELECT and RELATION shipped                                      |
| **A multi-value filter can only mean _any of_, never _all of_**                                                                                                      | There are no operators anywhere in this project, so a filter's value is its whole contract and "has any" is the only question its shape can ask. Expressing "has all" needs an operator in the URL, in every control and in the SQL map — reopening a load-bearing decision to serve one comparison. Users do want it; the answer is a design change, not a patch                                                                                                                                                                                                                                                    | **Accepted** — revisit only alongside operators as a whole                                |
| **A multi-value cell shows one line in the table**, so values past the width cap are cut off                                                                         | A row has a fixed height and its cell wrapper truncates, so wrapping would clip the second line rather than reveal it, and a `+2` affordance needs a measurement the cell has no reason to take. `RecordDetail` wraps the same cell and shows every value, which is what that surface is for — the same escape hatch the truncated-cell row below relies on                                                                                                                                                                                                                                                          | **Open** — UX, shares a fix with the truncated-cell row below                             |
| **`_count.records` drifts between Home visits**                                                                                                                      | `records.ts` is independent of `tables.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | **Open** — small                                                                          |
| **Deleting a target record leaves a dangling id** that reads as "Unknown record"                                                                                     | Blocking it would mean a JSONB scan of every table on every delete. Deleting a target **table** is refused with a 409 instead                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | **Accepted** — revisit only with a real referential design                                |
| **Sorting/filtering by a JSONB key is unindexed**                                                                                                                    | Keys are user-defined per table, so no general index applies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | **Accepted** — the first scaling ceiling; watch it                                        |
| **Relation label sort costs one PK lookup per matching row**                                                                                                         | On top of the unindexed JSONB path above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | **Accepted** — same ceiling                                                               |
| **Free-text search is unindexable and its cost is paid twice** (page query + count)                                                                                  | Unanchored `ILIKE` over user-defined JSON keys. `SEARCH_MIN_LENGTH` bounds the worst case                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | **Accepted** — same ceiling                                                               |
| **A disabled `BaseButton` with `to` renders `<button disabled>`**, so it announces as _button, dimmed_ rather than _link, dimmed_                                    | Every alternative rebuilds native `disabled` out of `aria-disabled` + `tabindex="-1"` + `pointer-events: none`, taking the control out of the tab order by hand for a state the rest of the app expresses natively                                                                                                                                                                                                                                                                                                                                                                                                   | **Accepted**                                                                              |
| **No error reporting or observability**                                                                                                                              | Nothing beyond `createError` responses; no client or server error sink exists                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | **Accepted** — revisit before any real deployment                                         |
| **Renaming a SELECT choice orphans the records holding the old text**, which then render as a neutral badge                                                          | A choice's identity is its own text, so the whole SQL layer stays out of it. The stale value keeps its text rather than blanking, and nothing errors                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **Accepted** — an option id buys nothing for colour                                       |
| **Choice colours do not show in the record form or the filter dropdown**, only in table cells                                                                        | The custom listbox this wanted now exists. `choiceOptions()` carries the hue and `BaseBadge` renders it in the trigger and in every option row, so a choice reads the same in three places from one palette. The parenthetical about a scroll container clipping it is moot — the panel teleports to `<body>`                                                                                                                                                                                                                                                                                                        | **Closed**                                                                                |
| **The _colour_ popover always opens below its trigger and never flips**                                                                                              | Narrowed: `BaseSelect` flips, via `useAnchoredPosition`. `BaseColorPicker` adopted `usePopover` but kept `position: absolute`, because changing a working control's positioning model to close this buys nothing — it is 254×110 inside a centred dialog, so the case needs a viewport short enough to matter. The machinery now exists, so this is a one-line follow-up rather than a design question                                                                                                                                                                                                               | **Open** — small, and now trivial                                                         |
| **A truncated table cell offers no way to read the full value** — no `title`, no expand affordance, **except for a relation**, whose dialog shows the target in full | The rendered text is produced by the cell _component_ (a relation label resolved from a store, `Yes`/`No`, a formatted date), so it is not recoverable from the raw value without a text projection per field type — a fifth registry, against the "only cells are components" contract in `CLAUDE.md` §9. The record's own edit dialog shows every value in full                                                                                                                                                                                                                                                    | **Open** — UX                                                                             |
| **The unsorted sort icon is ~1.67:1**, under the 3:1 SC 1.4.11 floor for non-text UI                                                                                 | `--color-text-secondary` at `opacity: 0.35`. A compliant `0.7` (~3.14:1) was shipped first and read as clutter — the glyph repeats on every column at once, so what is legible on one header is noise across four. Nothing depends on seeing it: the header's own text names the column, the button is a real `<button>` in the tab order with a 3px focus ring, and sort state reaches assistive tech through `aria-sort` on the `th` rather than through the icon. It is an affordance hint, not a control boundary — unlike `--color-border-control`, which is why that token carries the floor and this does not | **Accepted** — deliberate; raise it only on a real report of users missing the affordance |
| **A badge's fill is ~1.1:1 against a hovered row**, so the pill shape barely reads there                                                                             | The badge draws no border by design. The dot (its `-fg` step, ≥6:1 on that row) and the word both survive, and neither the fill nor the dot is the meaning. Raising the fills to bound the pill would break their 4.5:1 text pairings                                                                                                                                                                                                                                                                                                                                                                                | **Accepted** — the word carries the meaning                                               |
