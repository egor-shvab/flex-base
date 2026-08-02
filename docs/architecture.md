# Architecture

How the metadata layer works. Rules live in `CLAUDE.md`; rationale and rejected alternatives live in `decisions.md`.

---

## 1. Stack

- **Frontend:** Nuxt 4, Vue 3, TypeScript, Pinia, SCSS (`sass-embedded`).
- **Backend:** Nitro via `server/api` routes.
- **Database:** PostgreSQL 17 (Docker) through Prisma 7 (`@prisma/client` + `@prisma/adapter-pg`).
- **Auth:** manual — bcrypt for password hashing, `jsonwebtoken` for tokens, no auth library. The JWT (`{ sub: userId }`, HS256, 7 days) lives in an httpOnly `auth_token` cookie. `server/middleware/auth.ts` resolves it to `event.context.user` on every request and **never rejects**; handlers call `requireUser(event)` to enforce 401. Client side: `app/stores/auth.ts` + `app/middleware/auth.global.ts` handle session restore and redirects both ways; requests go through `useApi()` so cookies are forwarded during SSR.
- **Validation:** zod, shared between client and server.

---

## 2. The four `shared/` layers

Each folder has one job, and the dependency order is what keeps them honest — a file may only import from layers above it.

1. **`types/`** — declarations only, erased at build time. They may `import type` a constant purely to derive from it (`TFieldType` is `typeof FIELD_TYPES[number]`); because both directions are type-only, that reference costs nothing at runtime.
2. **`constants/`** — the runtime registries (`FIELD_TYPES`, `FILTER_VALUE_BY_TYPE`, `RESERVED_QUERY_PARAMS`, `RECORD_PAGE_SIZE`, …). Values, never logic.
3. **`utils/`** — generic helpers. `filter.ts` (param naming + value-shape predicates) is a pure leaf; `record-query.ts` (the URL codec) additionally uses the value schemas to decode.
4. **`validation/`** — zod schemas and their builders. A schema validates; turning validated params into a domain model is the codec's job, never a `.transform()`.

### Module inventory

**`shared/types/`**

| Module      | Contents                                                                                                                                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.ts`   | `IAuthUser`                                                                                                                                                                                                                                                                                             |
| `table.ts`  | `ITable`, `ITableListItem` (with `_count`)                                                                                                                                                                                                                                                              |
| `field.ts`  | `TFieldType`, `IFieldOptions` (SELECT's `choices`; RELATION's `targetTableId` + `labelFieldKey`), `IField`                                                                                                                                                                                              |
| `record.ts` | `TRecordValue`, `TRecordData`, `IRecord`, `IRecordPage` (records + paging + `relationLabels`), `IRecordOption`, `IRecordQueryState` (page + sort + filters — one resolved list query), `IRecordQuery` (the same plus the server-resolved `pageSize`), `IRecordQueryParams` (what the schema guarantees) |
| `range.ts`  | `INumberRange`, `IDateRange` — the two-bound shapes shared by `BaseRange` and the filter codec                                                                                                                                                                                                          |
| `filter.ts` | `TFilterValue`, `IFilterValueByType`, `TRecordFilterValues`, `TFilterShape` (`scalar`/`range`), `IFilterValueSpec`, `TFilterParamRole` (`value`/`from`/`to`), `IRecordSort`, `TSortDirection`                                                                                                           |

`TRecordFilterValues` is **the filter model of every layer**: typed values keyed by `Field.key`, sparse — an absent key is unfiltered, and the count of filtered fields is `Object.keys(…).length`.

**`shared/constants/`**

- `field.ts` — `FIELD_TYPES`, `FIELD_TYPE_LABELS`. Every type in `FIELD_TYPES` is creatable; there is no second, narrower list.
- `filter.ts` — `FILTER_VALUE_BY_TYPE`; `DEFAULT_SORT_KEY` (`createdAt`) + `DEFAULT_SORT_DIR` (`desc`, newest first); `RESERVED_QUERY_PARAMS` (`page`/`pageSize`/`sort`/`dir`); `SEARCH_MIN_LENGTH` (2); `RECORD_NUMBER_KEY` / `CREATED_AT_KEY` / `UPDATED_AT_KEY` + `RESERVED_FIELD_KEYS`.
- `record.ts` — `RECORD_PAGE_SIZE` (50), `RECORD_PAGE_SIZE_MAX` (100), `RELATION_OPTIONS_LIMIT` (200), `UNKNOWN_RECORD_LABEL`.

**`shared/utils/`**

- `record-label.ts` — `buildRecordLabel(record, labelFieldKey)`: the one rule for how a record reads when something links to it. Both server paths use it, so they cannot disagree. A blank or deleted label field falls back to `#<number>`, which keeps two unlabelled records apart in a picker.
- `filter.ts` — `recordColumn(key, name, type)` and `queryFields(fields)` (§5); `filterParamSlots(key, type)`, `filterParamNames(key, type)`, `rangeParamName(key, bound)`, all over one private `RANGE_PARAM_SUFFIX`; `claimFilterParams(fields)`, which resolves each param name to at most one field — reserved names first, then fields in order; `isRangeFilterValue` / `isFilterValueEmpty`, both shape-based so they need no field metadata.
- `record-query.ts` — the URL codec: `parseRecordQueryState(fields, query)`, `parseFilterValues(fields, query)`, `toFilterParams(values)`, `toRecordQueryParams(state)`. Shared by the page, the store and the records endpoint, so a shared link and the fetch behind it cannot diverge. `parseRecordQueryState` is the exact inverse of `toRecordQueryParams` and the one reader both sides use. It is **lenient by design** — rejecting bad input is the schema's job. Decoding goes straight from params to typed values with no intermediate condition model, narrowing a range **by value shape**, never by field type.

**`shared/validation/`**

- `auth.ts` — `credentialsSchema` (login and register share it), `registerSchema`.
- `name.ts` — `nameSchema`, the one rule for every user-visible name (1–100 chars); tables and fields build on it so they cannot drift.
- `table.ts` — `tableSchema`.
- `field.ts` — flat `fieldSchema` (name/type/required/choices/targetTableId/labelFieldKey, per-type `superRefine`), one schema for client and server. Whether a RELATION's target exists and is owned is a database question, so the server layers `requireFieldTarget` on top.
- `record.ts` — `VALUE_SCHEMA_BY_TYPE` (per type: `base` schema + `blank` value + `fromQuery` decoder), `buildRecordSchema(fields)` (strips unknown keys), `blankValueFor(field)`, `buildFilterValueSchema(field)` (exported for the codec), `buildRecordQuerySchema(fields)` (page + pageSize + sort/dir + the filter params the table's fields claim; a **loose** object so the refinement can read filter params without widening the base ones). Required is enforced only where `blank` is `null`, so a BOOLEAN's `false` counts as a value.

---

## 3. The field-type registries

`app/field-types/` holds the entire per-field-type surface of the client, deliberately outside `~/components` so nothing there is globally registered — these are only ever reached through the registries. All are `markRaw`ped module constants.

| File                  | Registry                                                                     | Branch point for                           |
| --------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| `inputs.ts`           | `FIELD_INPUTS: Record<TFieldType, TRecordFieldControl>`                      | editing a record                           |
| `filters.ts`          | `FIELD_FILTERS: { [K in TFieldType]: IFieldControl<IFilterValueByType[K]> }` | filtering                                  |
| `cells.ts`            | `FIELD_CELLS: Record<TFieldType, Component>`                                 | displaying a record                        |
| `filter-summaries.ts` | `FILTER_SUMMARIES`                                                           | how an active filter reads above the table |
| `record-columns.ts`   | `RECORD_COLUMNS`                                                             | the record's own columns (§5)              |

`types.ts` defines the shape both control tables share:

- `IFieldControl<TValue>` — `component` + a `props(field)` factory + optional `toControl`/`fromControl` adapters.
- `TRecordFieldControl` = `Required<IFieldControl<TRecordValue>>`, since a record input always adapts (a DOM control speaks strings and checkboxes, never `TRecordValue`) — which is why `DynamicForm` never branches on an optional adapter.
- `IFieldCellProps` — `field` + `value`, the same pair the control tables receive.

**Inputs.** TEXT/DATE/SELECT share one `blankIsNull` adapter (a blank control means "no value", never `''`). NUMBER keeps a real parse, and unparseable text passes through so the schema reports "Enter a number". BOOLEAN maps to `BaseCheckbox`. RELATION reuses `blankIsNull` over the shared picker.

**Filters.** TEXT is a debounced, trimmed `BaseInput` (matching is always case-insensitive and partial); SELECT a `BaseSelect` fed from the field's own metadata; NUMBER/DATE a `BaseRange` with its `type`; RELATION the same picker the form uses, so a filter offers exactly what a record can link to. Only BOOLEAN adds adapters, because a `<select>` speaks strings while its filter value is `boolean | null` (`null` = "All"). **No control knows an operator** — the value is the whole contract, and `FILTER_VALUE_BY_TYPE` maps it to conditions at the serialization boundary.

**Cells.** `cells/{Text,Number,Boolean,Date,Select,Relation}FieldCell.vue` — one read-only cell per type. BOOLEAN renders an `mdi:check`/`mdi:minus` icon, SELECT a chip, NUMBER/DATE fixed `en-GB` `Intl` formats, RELATION the label the page resolved (or a muted "Unknown record"). Blank values never reach a cell — `DynamicTable` renders the `—` placeholder itself. `RecordNumberCell` and `TimestampCell` belong to `RECORD_COLUMNS` rather than to a field type, which is why they are not named `*FieldCell`.

**`controls/RelationFieldSelect.vue`** is the only control that is a component rather than a registry row, because a relation's candidates are records of another table and no synchronous `props(field)` factory can produce them. One component serves both tables: `blankLabel` is "— Select —" when editing and "All" when filtering. A linked record the candidate list does not offer — beyond `RELATION_OPTIONS_LIMIT`, or since deleted — is appended as its own option, so opening a form can never drop a link on save.

---

## 4. Record identity

Two different jobs, split across two columns:

- **`Record.id`** — a `cuid()`. It is what relations reference (inside `data` JSONB, with no foreign key) and what the API addresses, so it must be stable, non-recycled and unguessable.
- **`Record.number`** — an `Int`, sequential **per table** (`@@unique([tableId, number])`), purely for display. Nothing references it.

`number` is allocated from `Table.recordCounter` inside the insert's own transaction: Prisma's atomic `{ increment: 1 }` takes the row lock, so concurrent creates queue instead of racing and no retry loop is needed. The counter is a **high-water mark, not a count** — deleting a record never frees its number for reuse, the same contract an issue tracker gives.

---

## 5. Record columns

Three columns of `Record` itself are shown on **every** table and are deliberately not configurable per table: `Record #`, `Created at`, `Updated at`. **In a query each behaves like a field**, via one seam rather than a special case at each layer.

`recordColumn(key, name, type)` builds each as an ordinary `IField` under a reserved **camelCase** key — a shape `slugify` can never emit, so no user field can shadow one (`RESERVED_FIELD_KEYS` states the reservation rather than relying on that luck).

`queryFields(fields)` returns them around a table's own fields in presentation order — `Record # | …fields… | Created at | Updated at` — and is applied wherever a **query** is built: the codec, the query schema, `buildRecordWhere`/`buildRecordOrderBy`, `DynamicTable`, `RecordsFilterPanel`, `RecordsFilterSummary`. It is **never** applied where record **data** is read or written (`buildRecordSchema`, `DynamicForm`, the field manager), since none of it is part of that data — which is what makes these columns generic and read-only.

Because they look like ordinary fields, the filter controls, the URL format, the badge count and "Clear all" all work on them unchanged. Only two registries know better:

- **`RECORD_COLUMN_SQL`** (`server/services/record-query.ts`) — the projection, since these live outside `data`. Every entry declares both an `expr` and a `sortExpr`: the number **filters as text** (`4` matches `#4`, `#14`, `#42`) but **orders as an integer** (`#9` before `#10`); a timestamp **filters as `::date`**, so an inclusive `to` bound covers that whole day instead of stopping at its midnight, but **orders as a timestamp**, so two records made on one day still order by time.
- **`RECORD_COLUMNS`** (`app/field-types/record-columns.ts`) — where the value comes from (`record.number` / `record.createdAt` / `record.updatedAt`, never `record.data`) and which cell renders it. `DynamicTable` consults it first and falls through to `FIELD_CELLS`, so it never learns which columns exist.

Since `DEFAULT_SORT_KEY` is `createdAt`, the default view shows an active descending arrow on the Created at header — the table's default ordering is visible rather than implicit.

---

## 6. Relations

A RELATION field stores **one** target record's id — a plain `string`, so it needs no widening of `TRecordValue` and no new filter shape. Its `options` carry `{ targetTableId, labelFieldKey }`: the table it points at (**immutable** — retargeting would orphan every stored id, so `updateField` rejects a change with 400) and which of that table's fields a linked record reads as (**editable** — pure display).

An id is not readable, so the label is resolved server-side. `server/services/relations.ts` is the only module that knows what a RELATION means, which is what keeps `records.ts` generic. It applies `buildRecordLabel` in three places:

- **`resolveRelationLabels`** — runs after the record list and returns `IRecordPage.relationLabels`, keyed by **field id** then by target record id (per field, because two relations may point at one table through different label fields). One `findMany` per distinct target table, never one per row.
- **`assertRelationTargets`** — gates every record write: a value that does not resolve to a live record of its target table is a 400, so a crafted payload cannot store a dangling id.
- **`listRelationOptions`** — backs `GET /api/tables/[tableId]/fields/[fieldId]/options`, the candidates a picker offers, capped at `RELATION_OPTIONS_LIMIT` and label-ascending. Scoped by the **source field**, so nothing about the target is taken from the client.

Client side, `app/stores/relations.ts` is the single home for both halves — `optionsByField` (a picker's candidates) and `labelsByField` (id → label), both keyed by field id. `RelationFieldSelect` reads the options; `RelationFieldCell` reads the labels.

---

## 7. Wire formats

### Filters

Plain query params named after the field, the name following from the value's shape:

```
?company=acme&stage=Won&active=true&contract_value_from=1000&contract_value_to=5000&signed_on_from=2026-01-01
```

- A **scalar** value (TEXT, SELECT, BOOLEAN, RELATION) takes the field's bare key; a **range** (NUMBER, DATE) spreads to `_from` / `_to` suffixes.
- The record's own columns ride in the same namespace: `?recordNumber=4` as a scalar (partial match, like any text filter), `?createdAt_from=…&updatedAt_to=…` as ranges. All three are accepted `?sort=` keys too.
- A RELATION carries the target record's **id** (`?company=clx…`) — the picker's own value, so a link cannot decode to a label the server would have to re-resolve.
- **How each is compared is the field type's business on the server** (TEXT partially, the rest exactly, ranges inclusively) and never travels in the URL. There are no operators anywhere in the project.
- Every filter is ANDed. One value per param — a repeated param is a 400.
- An empty value (`?company=`) means "not filtered", never `ILIKE '%%'`.
- Params the table does not own are **ignored, not rejected** — with bare names a typo is indistinguishable from `utm_source`. A malformed **known** param (`?contract_value_from=abc`) is still a 400.

### Search

One reserved `?search=` param, ANDed with the filters. It is **free text ORed across the table's searchable columns** — the only OR anywhere in the query layer. `SEARCH_MIN_LENGTH` (2) is enforced by the **query schema**, not just the input, so no caller can trigger an unanchored full-table scan with one character; a shorter term is a 400, and the client drops it rather than sending it. `?search=` empty reads as absent, exactly like a filter.

---

## 8. The query layer

`server/services/record-query.ts` is the only SQL in the project: `buildRecordWhere(tableId, fields, filters)`, `buildRecordSearch(...)`, `buildRecordOrderBy(fields, sort)`. Raw because Prisma cannot `orderBy` a JSON path.

**One total map, `FIELD_SQL_BY_TYPE`**, gives each field type:

- `expr` — the JSONB projection a **filter** compares against (`::numeric`/`::boolean` casts; plain text for TEXT/DATE/SELECT/RELATION).
- `sortExpr` — how the column **orders**, when that differs from how it filters. RELATION is the only field type that declares one: a correlated subquery over the target's label field, because it filters on the stored id but orders by the label.
- `filter` — how its value compares: `matchesPartially` (`ILIKE` with escaped wildcards), `matchesExactly` (`=`), `withinRange` (inclusive `>=`/`<=` for whichever bounds are set).
- `searchExpr` — how free-text search matches it, or `null` to opt out. Separate from `expr` because NUMBER and BOOLEAN cast, and neither `numeric` nor `boolean` has an `ILIKE` operator: NUMBER searches the un-cast text, BOOLEAN opts out (searching `e` would match every `false`), RELATION opts out (its stored value is a cuid).

`RECORD_COLUMN_SQL` is consulted before that map, for the columns of `Record` itself (§5).

`buildRecordWhere` walks the table's **fields** and looks each one up in the filter map, so a key the table does not own has nothing to compare against; everything is ANDed.

> **`buildRecordSearch`'s parentheses are load-bearing.** `withinRange` returns a bare two-bound `a >= x AND a <= y` with no parentheses of its own, which is safe only while every sibling is `AND`. An unparenthesised OR group would bind to the last bound of a range filter and silently widen it.

**The search cost is real and is paid twice:** the same WHERE fragment goes into the page query and the count; the page query can stop at `LIMIT+OFFSET` but the count cannot; and an unanchored `ILIKE` over user-defined JSON keys is unindexable. The `(tableId, createdAt)` index still supplies the access path, so it is an index scan with a per-row filter, not a sequential scan.

Keys and values are bound as parameters, never interpolated, and the key is `::text`-cast to disambiguate Postgres' `->>` overloads.

`buildRecordOrderBy` falls back to `"createdAt" DESC`. Under an explicit field sort, blanks go `NULLS LAST` and ties break on `"createdAt" DESC` — which also keeps paging stable.

---

## 9. Data model

`prisma/schema.prisma` — the `FieldType` enum (`TEXT`/`NUMBER`/`BOOLEAN`/`DATE`/`SELECT`/`RELATION`) and four models. Every id is a `cuid()`; `createdAt` defaults to `now()` and `updatedAt` is `@updatedAt` wherever it exists. The `datasource` block carries **no inline `url`** — Prisma 7 resolves `DATABASE_URL` through `prisma.config.ts`.

**Ownership lives only on `Table.userId`.** Fields and records reach the user through their table, which is why every scoped query filters via the `table` relation rather than a denormalized `userId`. Every relation is `onDelete: Cascade`.

| Model    | Columns                                                                                                                  | Indexes                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `User`   | `id`, `email` (`@unique`), `passwordHash`, `createdAt`                                                                   | —                                                                                        |
| `Table`  | `id`, `name`, `userId`, `recordCounter`, `createdAt`, `updatedAt`                                                        | `@@unique([userId, name])` — name unique per user; left prefix covers the dashboard list |
| `Field`  | `id`, `tableId`, `name` (editable), `key` (**immutable**), `type`, `required`, `options` (`Json?`), `order`, `createdAt` | `@@unique([tableId, key])`; left prefix covers the per-table list                        |
| `Record` | `id`, `number`, `tableId`, `data` (`Json`, **keyed by `Field.key`**), `createdAt`, `updatedAt`                           | `@@unique([tableId, number])` serves the `#` sort; `@@index([tableId, createdAt])`       |

`Record.data` is keyed by `Field.key`, never by field id, so renaming a field never rewrites a single row. `User` is always read with an explicit `select` so `passwordHash` cannot reach a response. `Table.recordCounter` is never exposed in `tableSelect`.

**Sorting or filtering by a JSONB key is deliberately unindexed** — keys are user-defined per table, so no general index applies. This is the first scaling limit the schema will hit.

**Migrations applied:** `20260723124643_init`, `20260726084538_record_table_created_index`, `20260728134724_drop_redundant_indexes`, `20260729052159_record_number` (hand-written — see `decisions.md`).

---

## 10. Module map

Only the modules whose contract is not obvious from their name.

### `server/`

| Module                                      | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `utils/ownership.ts`                        | `requireOwnedTable` (single scoped query; 404 when missing or foreign) · `requireOwnedTableFields` (same plus the table's field metadata in one round trip — reads need it to resolve sort/filter params) · `requireRecordFields` (the same plus a 400 when the table has no fields — **writes only**, since a field-less table must still list an empty page) · `requireFieldTarget` (a RELATION may only point at an owned table, labelled by a field that table has)         |
| `utils/prisma-errors.ts`                    | `toHttpError(error, { conflict?, notFound })` — the shared `P2002` → 409 / `P2025` → 404 mapping used by all three services                                                                                                                                                                                                                                                                                                                                                     |
| `utils/auth.ts`                             | bcrypt hash/verify, JWT sign/verify, `auth_token` cookie helpers, `requireUser`                                                                                                                                                                                                                                                                                                                                                                                                 |
| `services/tables.ts`                        | list/create/rename/delete scoped by `userId`. `deleteTable` refuses with 409 when another table's RELATION field targets it. Exports `tableSelect`; `tableListSelect` spreads it and adds the counts only the dashboard needs                                                                                                                                                                                                                                                   |
| `services/fields.ts`                        | list/create/update/delete scoped by `tableId`; derives the immutable `key` (slugify + dedupe), `order`, and DB `options`. Rejects type changes and RELATION retargeting (400 each). A new key must be free for **every query param it would claim** — a field called "Page" becomes `page_2`, "Budget from" becomes `budget_from_2` next to a NUMBER `budget`. Exports `fieldSelect` + `toFieldMetadata`, the one place Prisma's untyped `options` JSON is narrowed to `IField` |
| `services/records.ts`                       | paginated list (`$transaction` of two `$queryRaw`s sharing one WHERE fragment) + create/update/delete scoped by `tableId`. `data` is replaced wholesale on update; every write passes `assertRelationTargets` first                                                                                                                                                                                                                                                             |
| `api/tables/[tableId]/records/index.get.ts` | validates with `buildRecordQuerySchema(fields)`, then composes `IRecordQuery` from `parseRecordQueryState(fields, params)` + the validated `pageSize` — **the schema judges, the codec decodes**                                                                                                                                                                                                                                                                                |

### `app/`

| Module                             | Contract                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `composables/useApi.ts`            | the `useRequestFetch` seam — its one job is keeping callers off bare `$fetch`                                                                                                                                                                                                                                                                                                                                                         |
| `composables/useForm.ts`           | form state keyed `Record<string, unknown>`; its dynamic key handling is what lets one composable drive metadata-generated forms                                                                                                                                                                                                                                                                                                       |
| `composables/useDeleteConfirm.ts`  | the confirm-then-delete flow every list page repeats. The target is cleared **only on success**, so a failed delete leaves the dialog open                                                                                                                                                                                                                                                                                            |
| `composables/useDebouncedModel.ts` | a writable local `draft` of a `v-model` that writes back on a delay, re-synced when the model changes from outside, skipping the write when draft and model already agree. `delay: 0` writes through synchronously, which is what lets `BaseInput` use one code path for both                                                                                                                                                         |
| `utils/format.ts`                  | every `Intl` formatter in one place. Locales are hard-coded `en-GB` and `formatTimestamp` pins `timeZone: 'UTC'` — an `undefined` locale renders differently on server and client, which is a hydration mismatch. The prose date (`1 Jan 2026`) and the column date (`01 Jan 2026`) are two named constants, never one formatter reconfigured per call                                                                                |
| `utils/api-error.ts`               | `getApiErrorMessage` reads Nitro's message off `FetchError.data`; `toPageError` asserts a cause only for a 404                                                                                                                                                                                                                                                                                                                        |
| `utils/safe-redirect.ts`           | `resolveSafeRedirect` restricts `?redirect` to internal paths                                                                                                                                                                                                                                                                                                                                                                         |
| `stores/records.ts`                | **Every action takes the query params from the caller** — the store never mirrors them. `createRecord` returns the page the new record landed on and only refetches when that equals the current page; the page navigates when it differs. An edit refetches the current page rather than splicing. State is cleared when `fetchRecords` is called for a different table. Each fetch forwards `relationLabels` to the relations store |
| `stores/tables.ts`                 | `loaded`/`failed` flags + `ensureTables()`, which **never throws** — it sets `failed` and the sidebar reports it inline with a Retry                                                                                                                                                                                                                                                                                                  |
| `stores/relations.ts`              | `loadOptions(tableId, fields)` fetches every relation field's candidates in parallel and makes no request at all for a table without relations                                                                                                                                                                                                                                                                                        |
| `error.vue`                        | the whole-app error boundary. Deliberately **store-free** — it has to render when data fetching is exactly what failed                                                                                                                                                                                                                                                                                                                |

### The renderers — `app/components/records/`

- **`DynamicForm.vue`** — renders a form from `IField[]` by walking `FIELD_INPUTS`: `v-bind`s each entry's `props(field)`, passes the value through `toControl`, pushes what the control emits back through `fromControl`. Values flow down as props and changes back up via `update: [key, value]`, so the parent's `useForm` object is never mutated.
- **`DynamicTable.vue`** — renders from `queryFields(fields)` + `IRecord[]`, so **one** `columns` list drives header and body alike. Two resolvers keep the body loop uniform: `cellValue` reads `RECORD_COLUMNS` first and falls through to `record.data`; `cellComponent` likewise falls through to `FIELD_CELLS`. No branch on a key or a type anywhere in the template. Emits `edit`/`delete`/`sort`; the optional `sort` prop drives `aria-sort` and the header arrow.
- **`RecordsFilterPanel.vue`** — the filter drawer. One control per `queryFields(fields)` entry from `FIELD_FILTERS`, bound to `filters[field.key]` falling back to the type's empty value. Rebuilt in field order so URLs stay stable, dropping anything `isFilterValueEmpty`, so the map only ever holds active filters.
- **`RecordsFilterSummary.vue`** — the active filters stated **above** the data. Iterates `queryFields(fields)` and looks each key up in the filter map — never `Object.entries(filters)`, which would surface a key with no field to pair it with — so chip order matches the drawer and the URL.

### The records page

**The URL query is the single source of truth** for filter/sort/page. `queryParams` is `parseRecordQueryState(fields, route.query)` — page, sort and filters in one shot, so the page parses nothing itself. Every control writes back through `toRecordQueryParams`, and one `watch(queryParams)` refetches. Sort and page navigations are **pushed** (back steps through them); live filter edits **replace**, or a few keystrokes would bury the previous page. Records and relation options are fetched **after** fields resolve, in parallel with each other — filters decode against field metadata, so a shared filter URL would otherwise render unfiltered on first paint.

---

## 11. Styling reference

`app/assets/scss/` partials:

| Partial           | Contents                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `_palette.scss`   | the primitive colour ramp as **SCSS variables** (`$gray-200`, `$blue-600`, …)                             |
| `_variables.scss` | the public token surface: CSS custom properties built from the palette                                    |
| `_reset.scss`     | reset/normalize + base typography + the global `:focus-visible` baseline                                  |
| `_functions.scss` | the `rem()` helper                                                                                        |
| `_mixins.scss`    | the shared style fragments + `$breakpoint-shell`; `@use`s `functions` itself and does not re-export it    |
| `_auth-form.scss` | the shared `.auth-form` block; `@use`s `functions` and `mixins` itself                                    |
| `main.scss`       | entry point — `@use`s `variables` / `reset` / `auth-form`, and must **not** re-`@use` functions or mixins |

**Token surface:** semantic colour (`--color-canvas`, `--color-surface`/`-hover`/`-disabled`/`-muted`, `--color-text`/`-subtle`/`-on-accent`, `--color-accent`/`-hover`/`-active`/`-tint`, `--color-danger*`, `--color-border`/`-strong`/`-control`, `--color-focus`, `--color-scrim`, `--shadow-sm`/`-md`), geometry (`--radius-sm`/`-md`/`-lg`/`-pill`, `--control-height`, `--control-padding-x`, `--header-height`, `--sidebar-width`), type (`--font-size-xs…xl`, `--line-height-tight`/`-base`).

**Mixins:** `focus-ring($offset)`, `below-shell`, `stack($gap)`, `field-label`, `field-error`, `form-control`, `error-banner`, `page-header`, `page-title`, `page-empty`, `text-link`.

`form-control` splits the two focus signals: `:focus` recolours the border ("this field is active", including programmatic autofocus), `focus-ring` draws the ring ("you are on the keyboard"). Where a link fills a card, the **card** wears the ring via `:has(:focus-visible)` and the link suppresses its own.

### `BaseButton` variants

`.base-button` is a neutral chassis (flex centering, radius, type, `focus-ring`, `:disabled`); the filled look lives in `&--primary`, which the template always emits since `variant` defaults to `'primary'`. **`font-size`/`font-weight` must stay on the chassis** — `--ghost` declares neither, so moving them would drop ghost buttons to the UA default.

| Variant     | Use                                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `primary`   | default filled action                                                                                                              |
| `secondary` | the neutral peer of primary — same geometry so a dialog's footer pair aligns, bordered rather than filled. `ConfirmModal`'s Cancel |
| `danger`    | destructive filled action                                                                                                          |
| `ghost`     | transparent text+icon with a faint `--color-accent-tint` hover                                                                     |
| `icon`      | borderless icon-only; takes `icon` (iconify name) + `label` (aria-label/title)                                                     |
| `link`      | bare text button for row actions — the chrome of a link, the semantics of a button                                                 |

`primary`/`danger`/`ghost` are `min-height: var(--control-height)`. `icon` and `link` are deliberately smaller: they set row heights in `DynamicTable`, `BasePagination`, modal headers, `.table-card__actions` and `.field-row`, so they grow when those surfaces are re-laid-out, not before.

A typed `tone?: 'default' | 'danger'` recolours hover for the `icon`/`link` variants via the internal `--hover-color` custom property, which each variant defaults for itself (`icon` → text, `link` → accent). Per-variant defaults are why this is a custom property rather than a `v-bind`.

### Other atoms worth knowing

- **`BaseInput`** — bound with `:value` + `@input` rather than `v-model`, which would cast a `type="number"` input's value to a number and write `1.5` back while the user is still typing `1.50`; the composition guard is kept by hand so IME input still works. `ariaLabel` and `invalid` serve **grouped** controls where a wrapper owns the visible label and error line. `debounce` and `trim` serve callers that bind props rather than `v-model`, since `<component :is>` cannot pass v-model modifiers.
- **`BaseRange`** — the two-bound atom, knowing nothing about filters: one label above a 1fr/1fr grid of bare `BaseInput`s. A required `type` (`number`/`date`) picks the bound's DOM type; a `null` bound means "no bound", never zero. It keeps typed text in local drafts synced by a `watch` that resyncs **only a bound that disagrees with what is on screen** — that is what distinguishes an outside change (clear all, a shared URL, the back button) from the value being echoed back.
- **`BaseModal`** — teleport, backdrop/Esc close, `role="dialog"`, optional `footer` slot outside the scrolling body. `variant`: `dialog` (centered card) / `drawer` (same chrome anchored right, full height). Marks `#__nuxt` `inert` while open, which makes `aria-modal="true"` true rather than a claim.
- **`BaseSelect`** — generic over `TValue extends string`. Pins `height` rather than `min-height` because Chrome ignores `line-height` on `<select>`.
- **`BaseBadge`** — `chip` (a **value**, e.g. a SELECT cell — never uppercased, it is user data) / `label` (a **meta marker**, e.g. `required`).
- **`BasePagination`** — `pageCount` is passed in rather than derived, so the `ceil` formula lives only in the store. Owns its internal layout only; the consumer positions it.

### The shell

`app/layouts/default.vue` is a CSS grid of `var(--sidebar-width) minmax(0, 1fr)` under a full-width `var(--header-height)` header. **`minmax(0, 1fr)` plus `min-width: 0` on the main region is load-bearing** — without it the column's min-content width is `DynamicTable`'s full intrinsic width, so it never shrinks, the table's `overflow-x` never engages, and the whole document scrolls sideways.

**The shell owns the viewport, and the document never scrolls:** the grid is `height: 100dvh` with `overflow: hidden`, so its `var(--header-height) 1fr` rows resolve against a definite height and the header cannot scroll away. The sidebar and the main region are the two scroll panes — each `overflow-y: auto` **plus `min-height: 0`**, which is the vertical counterpart of the `min-width: 0` above: a grid item's automatic minimum is its content, so without it the pane grows past the row and its `overflow` never engages. The sidebar is a plain grid item, not `position: sticky` — the fixed shell supplies the height that a `calc(100vh - …)` used to fake. A page that wants to fill the pane instead of scrolling it sets `height: 100%` (see below).

Below `below-shell` the grid collapses to one column and the sidebar becomes `position: fixed` with `top: var(--header-height); bottom: 0` (out of the grid it has no row to take its height from), translated off-canvas **and `visibility: hidden`** (translation alone leaves it off-screen but focusable), opened by a header toggle over a scrim, closing on Escape, scrim click, and route change. Sidebar `z-index: 50` / scrim `40`, both below `BaseModal`'s `100`. `BaseModal` teleports to `<body>`, so the shell's `overflow: hidden` cannot clip a dialog or the filter drawer.

`DynamicTable` rows are `height: rem(52)` on `tbody td`, not derived from the tallest cell. `th` padding sits on the `&__sort` button so the whole header cell is a ≥44px target rather than a ~20px text run. Its root is the scroll container on **both** axes, and `thead th` is `position: sticky; top: 0` — with an opaque `background` (the padding lives on the inner button, so the cell must paint it) and an inset `box-shadow` standing in for the header rule, because `border-collapse: collapse` paints the collapsed edge with the table rather than with the sticky cell. The **Actions column is pinned** the same way on the other axis: `position: sticky; right: 0` on both its `th` and its `td`, so the fields scroll under it. The corner cell is sticky on both axes and takes `z-index: 2` to sit above the header row and the pinned column alike; its buttons live in a `&__actions-group` wrapper because a `display: flex` `<td>` cannot be sticky (see `decisions.md`).

**The records page fills the pane rather than scrolling it.** `.records-page` is `display: flex; flex-direction: column; height: 100%`; breadcrumbs, the header row, the filter summary and the failure banner are the fixed band; `&__body` is `flex: 1; min-height: 0`. `DynamicTable` takes `flex: 0 1 auto; min-height: 0` from the page, so it sizes to its rows and stops — a short result ends at its last row with the pager directly beneath, a long one shrinks to the pane and scrolls inside itself. Only the rows scroll. The empty states are centred by `margin-block: auto`, not by a `justify-content` on `&__body`, which would move the grid too.

The table list is fetched **by the layout, once per session**, via `ensureTables()`. The layout uses key `app-tables` and the dashboard `dashboard-tables` — **never the same key** (see `decisions.md`).

---

## 12. Manual regression checklist

Until a test suite exists, walk this after any change to the metadata layer:

- Record CRUD across **every** field type.
- A filtered URL loaded cold — it must render filtered on first paint.
- `BaseRange` resyncing on "Clear all" and on the back button.
- Sort and page history; the console for hydration mismatches.
- **Relations:** a link renders as its label rather than an id; sorting that column is alphabetical by label; deleting a target record degrades the cell to "Unknown record"; deleting a targeted table is refused.
- **Record columns:** `#9` sorts before `#10` (integer, not text); a number filter matches partially; a created record takes the next number and a deleted one's is never reused; a `Created at` range whose `from` and `to` are the same day still matches records made later that day (the `::date` cast).
- **Search:** a one-character term is rejected; a term matching a NUMBER column's text works; BOOLEAN and RELATION columns do not match.
