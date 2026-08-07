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

| Module      | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.ts`   | `IAuthUser`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `table.ts`  | `ITable`, `ITableListItem` (with `_count`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `field.ts`  | `TFieldType`, `IFieldChoice` (`value` + `color`), `IFieldOptions` (SELECT's `choices`; RELATION's `targetTableId` + `labelFieldKey`; both types' `multiple`), `IField`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `color.ts`  | `TBadgeColor` — the closed badge palette, a design-system concept rather than a field one, so an atom can consume it without importing field metadata                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `record.ts` | `TRecordSingleValue` (**one** value — what a per-type cell renders, what a record column holds, what a decoded filter bound is), `TRecordValue` (that plus `string[]`, what a multi-value field stores), `TRecordData`, `IRecord`, `IRecordPage` (records + paging + `relationLabels`), `IRecordOption`, `IRecordDetailRef` (one record addressed from anywhere: `tableId` + `recordId`), `IRecordDetail` (that record plus its table, fields and labels), `IRecordQueryState` (page + sort + filters — one resolved list query), `IRecordQuery` (the same plus the server-resolved `pageSize`), `IRecordQueryParams` (what the schema guarantees) |
| `range.ts`  | `INumberRange`, `IDateRange` — the two-bound shapes shared by `BaseRange` and the filter codec                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `filter.ts` | `TFilterValue` (`string[]` is the list shape; `TRecordValue` is a subset of this union), `IFilterValueByType`, `TRecordFilterValues`, the shape union (`scalar`/`list`/`range`), `IFilterValueSpec`, `TFilterParamRole` (`value`/`from`/`to`), `IRecordSort`, `TSortDirection`                                                                                                                                                                                                                                                                                                                                                                     |

`TRecordFilterValues` is **the filter model of every layer**: typed values keyed by `Field.key`, sparse — an absent key is unfiltered, and the count of filtered fields is `Object.keys(…).length`.

**`shared/constants/`**

- `field.ts` — `FIELD_TYPES`, `FIELD_TYPE_LABELS`, `BOOLEAN_LABELS`, `MULTI_VALUE_BY_TYPE` (which types may be configured to hold several values — SELECT and RELATION). Every type in `FIELD_TYPES` is creatable; there is no second, narrower list.
- `filter.ts` — `FILTER_VALUE_BY_TYPE`; `DEFAULT_SORT_KEY` (`createdAt`) + `DEFAULT_SORT_DIR` (`desc`, newest first); `RESERVED_QUERY_PARAMS` (`page`/`pageSize`/`sort`/`dir`/`search`/`detail`) + `DETAIL_PARAM`; `SEARCH_MIN_LENGTH` (2); `FILTER_LIST_MAX` (50, the cap on one list-shaped filter's values); `RECORD_NUMBER_KEY` / `CREATED_AT_KEY` / `UPDATED_AT_KEY` + `RESERVED_FIELD_KEYS`.
- `record.ts` — `RECORD_PAGE_SIZE` (50), `RECORD_PAGE_SIZE_MAX` (100), `RELATION_OPTIONS_LIMIT` (200), `UNKNOWN_RECORD_LABEL`, `RECORD_LIST_MAX` (50, the cap on how many values one multi-value field may hold — `FILTER_LIST_MAX`'s counterpart on the write side).

**`shared/utils/`**

- `field.ts` — `choiceValues` / `choiceOptions` / `badgeColorFor` (SELECT's choices as strings, as picker options, and as a hue), and **`isMultiValue(field)`** — the one reader of `options.multiple`, guarded by `MULTI_VALUE_BY_TYPE` so a stale flag on a type with no list form cannot reach the schema or the SQL.
- `record-label.ts` — `buildRecordLabel(record, labelFieldKey)`: the one rule for how a record reads when something links to it. Both server paths use it, so they cannot disagree. A blank or deleted label field falls back to `#<number>`, which keeps two unlabelled records apart in a picker. A multi-value field is not offered as a label, but one can be widened after being chosen, so a stored list degrades to its values joined rather than to `["a","b"]`.
- `filter.ts` — `recordColumn(key, name, type)` and `queryFields(fields)` (§5); `filterShapeFor(field)` / `emptyFilterValueFor(field)`, which override `FILTER_VALUE_BY_TYPE` for a multi-value field (always `list`, always `[]`) and are what every caller holding an `IField` reads instead of indexing by type; `filterParamSlots(key, type)`, `filterParamNames(key, type)`, `rangeParamName(key, bound)`, all over one private `RANGE_PARAM_SUFFIX`; `claimFilterParams(fields)`, which resolves each param name to at most one field — reserved names first, then fields in order; `isRangeFilterValue` / `isListFilterValue` / `isScalarFilterValue` / `isFilterValueEmpty`, all shape-based so they need no field metadata. **`isRangeFilterValue` excludes arrays explicitly** — an array is a non-null object, so without that a list value would narrow to a range.

  The param **slots** stay keyed by type, and multi-value does not move them: `scalar` and `list` already claim the same single name (a list is that name repeated), and no multi-capable type is `range`. That is what keeps `filterParamNames` callable from `createField`, where only the type is known.

- `record-query.ts` — the URL codec: `parseRecordQueryState(fields, query)`, `parseFilterValues(fields, query)`, `toFilterParams(values)`, `toRecordQueryParams(state)`. Shared by the page, the store and the records endpoint, so a shared link and the fetch behind it cannot diverge. `parseRecordQueryState` is the exact inverse of `toRecordQueryParams` and the one reader both sides use. It is **lenient by design** — rejecting bad input is the schema's job. Decoding goes straight from params to typed values with no intermediate condition model, narrowing a range **by value shape**, never by field type. `recordQueryKey(state)` serializes the same params to a stable string, for watchers that must fire on a changed query rather than a changed object.
- `record-detail.ts` — the `?detail=` codec (§7): `parseDetailChain`, `toDetailParam`, `pushDetail`, `popDetail`, and `withDetailChain(query, chain)`, the one seam every link in the dialog is built from — it layers the chain onto the current query, so the list view a dialog was opened over always survives.
- `query-param.ts` — `singleParam`, the `string | string[] | number` collapse both codecs read a param through.

**`shared/validation/`**

- `auth.ts` — `credentialsSchema` (login and register share it), `registerSchema`.
- `name.ts` — `nameSchema`, the one rule for every user-visible name (1–100 chars); tables and fields build on it so they cannot drift.
- `table.ts` — `tableSchema`.
- `field.ts` — flat `fieldSchema` (name/type/required/choices/targetTableId/labelFieldKey/multiple, per-type `superRefine`), one schema for client and server. `multiple` is judged against `MULTI_VALUE_BY_TYPE` rather than a hardcoded type pair, so a type with no list form rejects it. Flat at the top level only: a SELECT choice is `{ value, color }`, and `superRefine` judges uniqueness on `value` alone, since two choices differing only by colour are the same choice. Whether a RELATION's target exists and is owned is a database question, so the server layers `requireFieldTarget` on top.
- `record.ts` — `VALUE_SCHEMA_BY_TYPE` (per type: `base` schema + `blank` value + `fromQuery` decoder), `buildRecordSchema(fields)` (strips unknown keys), `blankValueFor(field)`, `buildFilterValueSchema(field)` (exported for the codec), `buildRecordQuerySchema(fields)` (page + pageSize + sort/dir + the filter params the table's fields claim; a **loose** object so the refinement can read filter params without widening the base ones). Required is enforced only where `blank` is `null`, so a BOOLEAN's `false` counts as a value.

  **A multi-value field's schema is its type's own `base` lifted into `z.array`** — the type still says what one value is, cardinality says how many. `blank` becomes `[]`, `required` becomes "at least one", and the cap is `RECORD_LIST_MAX`. Duplicates are **rejected**, not deduplicated: a control cannot produce one (picking a chosen option toggles it off), so a repeat is a crafted payload, and rejecting keeps a `.transform()` out of a layer that only judges. No type declares a second schema.

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

**Cardinality is the second axis, and it is a property of the field rather than of its type.** Each of the four control registries above keeps its flat per-type entries and gains a total `Record<TFieldType, X | null>` override table — `MULTI_INPUTS`, `MULTI_FILTERS`, `MULTI_SUMMARIES`, and `MULTI_SQL` on the server — plus one resolver every consumer calls instead of indexing:

| Registry              | Resolver                      | Consumer               |
| --------------------- | ----------------------------- | ---------------------- |
| `inputs.ts`           | `inputFor(field)`             | `DynamicForm`          |
| `filters.ts`          | `filterFor(field)`            | `RecordsFilterPanel`   |
| `filter-summaries.ts` | `summaryFor(field)`           | `RecordsFilterSummary` |
| `cells.ts`            | `cellComponent(column)` (§10) | `RecordFieldValue`     |

`null` means "this type has no list form", which `MULTI_VALUE_BY_TYPE` already refuses to configure — the two agree by construction, and the override tables are where that agreement is spent. Because they are total, a new field type still cannot ship without stating its position.

Only two entries are non-`null` anywhere. `MULTI_FILTERS` and `MULTI_SUMMARIES` leave **SELECT** `null`: a SELECT filter has always been list-shaped, so nothing about filtering it changes when the stored value becomes a list.

Multi-value **cells** need no override table at all. `cellComponent` returns one shared `MultiValueCell`, which renders each entry through `FIELD_CELLS[field.type]` — a list of values is the list of how each value renders, so a future multi-capable type is covered without a component of its own. It is one line by default (a table row has a fixed height and its cell wrapper truncates); `RecordDetail` overrides it to wrap.

`cellComponent` is paired with **`cellValues`** / **`cellSingleValue`** (`app/utils/record-cells.ts`): whenever the first returns `MultiValueCell`, the value is `cellValues`, otherwise it is `cellSingleValue`. `RecordFieldValue` branches on the same `isMultiValue` question to pick the pair. That is what lets each cell declare the exact shape it renders instead of the union of both — and `cellValues` is **the one place** a stored value that is not yet an array is accounted for (a row drawn before `updateField`'s migration ran).

`types.ts` defines the shape both control tables share:

- `IFieldControl<TValue>` — `component` + a `props(field)` factory + optional `toControl`/`fromControl` adapters.
- `TRecordFieldControl` = `Required<IFieldControl<TRecordValue>>`, since a record input always adapts (a DOM control speaks strings and checkboxes, never `TRecordValue`) — which is why `DynamicForm` never branches on an optional adapter.
- `IFieldCellProps` — `field` + `value`, the same pair the control tables receive. Its `value` is `TRecordSingleValue`, **not** `TRecordValue`: a per-type cell renders exactly one value, and `defineProps<T>()` compiles to a runtime prop check, so the wider union would make nine components advertise a shape none of them can draw.
- `IMultiValueCellProps` — `field` + `value: string[]`, `MultiValueCell`'s own contract. A separate interface rather than a widening of the one above, because the two are opposites: it is the only cell taking a list, and every other cell is what it delegates each entry to.

**Inputs.** TEXT/DATE/SELECT share one `blankIsNull` adapter (a blank control means "no value", never `''`). NUMBER keeps a real parse, and unparseable text passes through so the schema reports "Enter a number". BOOLEAN maps to `BaseCheckbox`. RELATION reuses `blankIsNull` over the shared picker.

**Filters.** TEXT is a debounced, trimmed `BaseInput` (matching is always case-insensitive and partial); SELECT a **multiple** `BaseSelect` fed from the field's own metadata, whose model is already the `string[]` filter value and so needs no adapters at all, and which the registry marks `searchable` once the field has more choices than `shouldSearch()`'s threshold; NUMBER/DATE a `BaseRange` with its `type`; RELATION the same picker the form uses, so a filter offers exactly what a record can link to. Only BOOLEAN adds adapters, because the control speaks strings while its filter value is `boolean | null` (`null` = "All", carried by the _absence_ of a choice — clearing emits `''`). **No control knows an operator** — the value is the whole contract, and `FILTER_VALUE_BY_TYPE` maps it to conditions at the serialization boundary.

Every "All" / "— Select —" is a **placeholder plus `clearable`** now, never a synthetic blank option. The cleared value is still `''`, which is why `blankIsNull` and BOOLEAN's adapters are unchanged and the wire format did not move.

**Cells.** `cells/{Text,Number,Boolean,Date,Select,Relation}FieldCell.vue` — one read-only cell per type. BOOLEAN renders an `mdi:check`/`mdi:minus` icon, SELECT a chip, NUMBER/DATE fixed `en-GB` `Intl` formats, RELATION the label the page resolved (or a muted "Unknown record"). Blank values never reach a cell — `DynamicTable` renders the `—` placeholder itself. `RecordNumberCell` and `TimestampCell` belong to `RECORD_COLUMNS` rather than to a field type, which is why they are not named `*FieldCell`.

**`controls/RelationFieldSelect.vue`** is the only control that is a component rather than a registry row, because a relation's candidates are records of another table and no synchronous `props(field)` factory can produce them. One component serves both tables: `placeholder` is "— Select —" when editing and "All" when filtering. It renders **two `BaseSelect` branches** rather than binding a union model, because `multiple` is tied to that model's type by design (`decisions.md`); `multiple` comes from field metadata and is fixed for the control's lifetime, so the branch never swaps under the user. It is also the only control that fetches on **user input** — it hands `BaseSelect` a `loadOptions` that searches the target table server-side, plus `searchable` unconditionally (the cap is on the _seed_, so the option count says nothing about how many records exist), so a record past `RELATION_OPTIONS_LIMIT` is reached by naming it. A linked record the seed list does not offer — beyond the cap, found through a search, or since deleted — is appended as its own option, so opening a form can never drop a link on save.

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

A RELATION field stores a target record's id, or — when `options.multiple` is set — a list of them. Its `options` carry `{ targetTableId, labelFieldKey, multiple }`: the table it points at (**immutable** — retargeting would orphan every stored id, so `updateField` rejects a change with 400), which of that table's fields a linked record reads as (**editable** — pure display), and its cardinality (**one-way** — widening migrates the existing rows in the same transaction, narrowing is a 400).

An id is not readable, so the label is resolved server-side. `server/services/relations.ts` is the only module that knows what a RELATION means, which is what keeps `records.ts` generic. It applies `buildRecordLabel` in three places:

- **`resolveRelationLabels`** — runs after the record list and returns `IRecordPage.relationLabels`, keyed by **field id** then by target record id (per field, because two relations may point at one table through different label fields). One `findMany` per distinct target table, never one per row.

`collectRelationTargets` normalises a stored value through `Array.isArray(v) ? v : [v]`, and that is the **whole** of what several links cost this module: everything below it already works in sets and batches, so a record holding ten targets contributes ten ids to the same one query per table.

- **`assertRelationTargets`** — gates every record write: a value that does not resolve to a live record of its target table is a 400, so a crafted payload cannot store a dangling id.
- **`listRelationOptions(field, search)`** — backs `GET /api/tables/[tableId]/fields/[fieldId]/options[?q=]`, the candidates a picker offers, capped at `RELATION_OPTIONS_LIMIT` and label-ascending. Scoped by the **source field**, so nothing about the target is taken from the client. `?q=` narrows via `buildRecordLabelSearch` — the label field plus the `#number` fallback `buildRecordLabel` uses when it is blank — leaving the ORDER BY untouched, so search and order stay independent. No `SEARCH_MIN_LENGTH` here (see `docs/decisions.md`); the bound is `max(100)` on the term.

Client side, `app/stores/relations.ts` is the single home for both halves — `optionsByField` (a picker's candidates) and `labelsByField` (id → label), both keyed by field id. `RelationFieldSelect` reads the options; `RelationFieldCell` reads the labels.

A resolved label is a **link**: `RelationFieldCell` renders a `<NuxtLink>` whose target is the current URL with the record appended to the `detail` chain (below), so clicking one opens the record-detail dialog. A label that does not resolve — the target was deleted — renders as a `<span>` with a dashed underline and a `title`, never a link. The cell is the same component in the table and inside the dialog, which is what makes nested relations drill: it appends to whatever chain it is being rendered under, without knowing where it is.

---

## 7. Wire formats

### Filters

Plain query params named after the field, the name following from the value's shape:

```
?company=acme&stage=Won&stage=Lost&active=true&contract_value_from=1000&contract_value_to=5000
```

- A **scalar** value (TEXT, BOOLEAN, single-value RELATION) takes the field's bare key; a **list** (SELECT, and any multi-value field) takes that same key **repeated once per value**; a **range** (NUMBER, DATE) spreads to `_from` / `_to` suffixes.
- **A multi-value field always filters as a list**, whatever its type declares — `filterShapeFor(field)` is the override. A multi RELATION therefore rides the same repeated-param format SELECT already used (`?services=clx1&services=clx2`), which is why the param **names** did not move: `scalar` and `list` claim the same single name.
- The record's own columns ride in the same namespace: `?recordNumber=4` as a scalar (partial match, like any text filter), `?createdAt_from=…&updatedAt_to=…` as ranges. All three are accepted `?sort=` keys too.
- A RELATION carries the target record's **id** (`?company=clx…`) — the picker's own value, so a link cannot decode to a label the server would have to re-resolve.
- **How each is compared is the field type's business on the server** (TEXT partially, scalars exactly, a list as `IN (…)`, ranges inclusively) and never travels in the URL. There are no operators anywhere in the project.
- Every filter is ANDed; the values **within** one list filter are ORed. A list is capped at `FILTER_LIST_MAX` (50) and deduplicated, and its values are sorted on serialize so one selection has one canonical URL.
- One value per param — a repeated param is a 400 **for every shape but `list`**, which is the only one that reads repeats.
- An empty value (`?company=`) means "not filtered", never `ILIKE '%%'`.
- Params the table does not own are **ignored, not rejected** — with bare names a typo is indistinguishable from `utm_source`. A malformed **known** param (`?contract_value_from=abc`) is still a 400.

### The open record

One reserved `?detail=` param, owned by the **page** rather than by the list endpoint — it never travels in an API request:

```
?detail=<tableId>.<recordId>,<tableId>.<recordId>
```

The records a detail dialog has open, outermost first. Only the **last** entry is fetched (`GET /api/tables/:tableId/records/:recordId`); the entries before it are the trail Back walks up, so drilling through nested relations is routing rather than state kept on the side — browser Back reverses exactly one step, the dialog survives a refresh, and SSR renders it for a shared link. Both separators sit outside the cuid alphabet. Decoded by `shared/utils/record-detail.ts`, leniently: a malformed entry stops the chain rather than throwing.

`detail` is in `RESERVED_QUERY_PARAMS`, so a field keyed `detail` cannot claim the name. Because `toRecordQueryParams` emits list params only, any list navigation (paging, sorting, filtering) drops the param and closes the dialog.

### Search

One reserved `?search=` param, ANDed with the filters. It is **free text ORed across the table's searchable columns** — the only OR anywhere in the query layer. `SEARCH_MIN_LENGTH` (2) is enforced by the **query schema**, not just the input, so no caller can trigger an unanchored full-table scan with one character; a shorter term is a 400, and the client drops it rather than sending it. `?search=` empty reads as absent, exactly like a filter.

---

## 8. The query layer

`server/services/record-query.ts` is the only SQL in the project: `buildRecordWhere(tableId, fields, filters)`, `buildRecordSearch(...)`, `buildRecordOrderBy(fields, sort)`. Raw because Prisma cannot `orderBy` a JSON path.

**One total map, `FIELD_SQL_BY_TYPE`**, gives each field type:

- `expr` — the JSONB projection a **filter** compares against (`::numeric`/`::boolean` casts; plain text for TEXT/DATE/SELECT/RELATION).
- `sortExpr` — how the column **orders**, when that differs from how it filters. RELATION is the only single-value field type that declares one: a correlated subquery over the target's label field, because it filters on the stored id but orders by the label.
- `filter` — how its value compares: `matchesPartially` (`ILIKE` with escaped wildcards), `matchesExactly` (`=`), `withinRange` (inclusive `>=`/`<=` for whichever bounds are set), `matchesAny` (`IN (…)`).
- `searchPredicate(key, pattern)` — how free-text search matches it, or `null` to opt out. A whole **predicate**, not an expression the caller appends `ILIKE` to: a multi-value column has to ask whether _any element_ matches, which no projection can express. Separate from `expr` because NUMBER and BOOLEAN cast, and neither `numeric` nor `boolean` has an `ILIKE` operator: NUMBER searches the un-cast text, BOOLEAN opts out (searching `e` would match every `false`), RELATION opts out (its stored value is a cuid).

**`MULTI_SQL`** is the cardinality override, consulted by `sqlFor(field)` for a field whose `options.multiple` is set — the same lifting the validation layer applies, in SQL:

- `expr` is `data -> key` rather than `->>`, since `->>` on an array yields the literal `["a","b"]` and would match a filter on `[` or `","`.
- `filter` is `containsAny`: `jsonb_exists_any(expr, ARRAY[…]::text[])`. The **function form**, never the `?|` operator — a literal `?` is the placeholder token on Prisma's other drivers and has a history of being mangled in raw SQL. Like `IN (…)` it is self-parenthesising. It also answers correctly for a bare scalar, which is what keeps a row written before its field's migration from vanishing from its own filter. It is the one comparison in this layer that is **GIN-indexable**.
- `sortExpr` orders by the **first** element (`data -> key ->> 0`; for RELATION, `targetLabel` over that same first id). A list has no intrinsic order, so this is a choice: the first value is the one already visible in the cell, which makes the ordering explicable from what is on screen.
- `searchPredicate` is `EXISTS (SELECT 1 FROM jsonb_array_elements_text(…) WHERE element ILIKE …)` for SELECT, and `null` for RELATION for the reason above — which the array only strengthens.

> **The `jsonb_typeof(…) = 'array'` guard inside that `EXISTS` is load-bearing.** `jsonb_array_elements_text` raises `cannot extract elements from a scalar` on anything else, and that error takes down the **whole list query**, not one row. A field flipped to multi migrates its data, but a row written between the two is a scalar, and so is a JSON `null`.

`RECORD_COLUMN_SQL` is consulted before either map, for the columns of `Record` itself (§5). Those hold one value each, so they build their search predicate at the call site rather than declaring one.

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

`Record.data` is keyed by `Field.key`, never by field id, so renaming a field never rewrites a single row. A **multi-value** field stores a JSON array under that key; widening a field is the one operation that does rewrite rows, in `updateField`'s own transaction (§10). `User` is always read with an explicit `select` so `passwordHash` cannot reach a response. `Table.recordCounter` is never exposed in `tableSelect`.

**Sorting or filtering by a JSONB key is deliberately unindexed** — keys are user-defined per table, so no general index applies. This is the first scaling limit the schema will hit.

**Migrations applied:** `20260723124643_init`, `20260726084538_record_table_created_index`, `20260728134724_drop_redundant_indexes`, `20260729052159_record_number` (hand-written — see `decisions.md`).

---

## 10. Module map

Only the modules whose contract is not obvious from their name.

### `server/`

| Module                                      | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `utils/ownership.ts`                        | `requireOwnedTable` (single scoped query; 404 when missing or foreign) · `requireOwnedTableFields` (same plus the table's field metadata in one round trip — reads need it to resolve sort/filter params) · `requireRecordFields` (the same plus a 400 when the table has no fields — **writes only**, since a field-less table must still list an empty page) · `requireFieldTarget` (a RELATION may only point at an owned table, labelled by a field that table has)                                                                                                                                                                                                                                                                                                                                  |
| `utils/ownership.ts` (cont.)                | `requireOwnedTableWithFields` — the table itself plus its fields from one scoped query, for the record-detail read, which has to **name** a table the page it opened from is not about                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `utils/prisma-errors.ts`                    | `toHttpError(error, { conflict?, notFound })` — the shared `P2002` → 409 / `P2025` → 404 mapping used by all three services                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `utils/auth.ts`                             | bcrypt hash/verify, JWT sign/verify, `auth_token` cookie helpers, `requireUser`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `services/tables.ts`                        | list/create/rename/delete scoped by `userId`. `deleteTable` refuses with 409 when another table's RELATION field targets it. Exports `tableSelect`; `tableListSelect` spreads it and adds the counts only the dashboard needs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `services/fields.ts`                        | list/create/update/delete scoped by `tableId`; derives the immutable `key` (slugify + dedupe), `order`, and DB `options`. Rejects type changes, RELATION retargeting, and narrowing a multi-value field back to a single one (400 each); **widening** a field to multi-value is allowed and runs `widenToList` — one scoped, idempotent `UPDATE` wrapping each stored scalar in an array — inside the same transaction as the metadata change, so the rows and the schema that describes them move together. A new key must be free for **every query param it would claim** — a field called "Page" becomes `page_2`, "Budget from" becomes `budget_from_2` next to a NUMBER `budget`. Exports `fieldSelect` + `toFieldMetadata`, the one place Prisma's untyped `options` JSON is narrowed to `IField` |
| `services/records.ts`                       | paginated list (`$transaction` of two `$queryRaw`s sharing one WHERE fragment) + create/update/delete scoped by `tableId`. `data` is replaced wholesale on update; every write passes `assertRelationTargets` first                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `services/records.ts` → `getRecordDetail`   | one record as `IRecordDetail` — the row, its table's name, its fields, and its own `relationLabels` from the same resolver the list uses. An aggregate on purpose: the dialog draws a record of another table, and the fields are already in hand for the label resolution, so returning them costs nothing and saves two round trips. A missing row is a 404                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `api/tables/[tableId]/records/index.get.ts` | validates with `buildRecordQuerySchema(fields)`, then composes `IRecordQuery` from `parseRecordQueryState(fields, params)` + the validated `pageSize` — **the schema judges, the codec decodes**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### `app/`

| Module                                | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `composables/useApi.ts`               | the `useRequestFetch` seam — its one job is keeping callers off bare `$fetch`                                                                                                                                                                                                                                                                                                                                                                            |
| `composables/useForm.ts`              | form state keyed `Record<string, unknown>`; its dynamic key handling is what lets one composable drive metadata-generated forms                                                                                                                                                                                                                                                                                                                          |
| `composables/useDetailLink.ts`        | the route target that opens a record in the detail dialog, layered onto the current query so the list view it opens over survives. Every way in is this one function — a row's View action and a relation cell alike — and each appends to whatever chain it renders under, so a caller never has to know whether it is opening or drilling                                                                                                              |
| `composables/useRecordDetail.ts`      | the one owner of the record-detail dialog: reads the `detail` chain off the route, fetches only its last entry (keyed on a **string**, never the ref object, which is fresh on every query change), feeds the labels to the relations store, and hands back the route targets for Back and Close. Every control it exposes is a navigation, not a state change                                                                                           |
| `composables/useDeleteConfirm.ts`     | the confirm-then-delete flow every list page repeats. The target is cleared **only on success**, so a failed delete leaves the dialog open                                                                                                                                                                                                                                                                                                               |
| `composables/useDebouncedModel.ts`    | a writable local `draft` of a `v-model` that writes back on a delay, re-synced when the model changes from outside, skipping the write when draft and model already agree. `delay: 0` writes through synchronously, which is what lets `BaseInput` use one code path for both                                                                                                                                                                            |
| `composables/usePopover.ts`           | open state, outside-pointer dismissal and focus restore for a popover. `containerRef` (the outside-click boundary) and `triggerRef` (the focus-restore target) are **separate** refs, since a control may put a clear button beside its trigger. **Owns no Escape listener** — the caller handles it: `@keydown.esc.stop` where focus is inside the panel, and in JS guarded on `open` where the control keeps focus outside it. See `docs/decisions.md` |
| `composables/useAnchoredPosition.ts`  | places a `position: fixed` panel against an anchor in viewport coordinates, flipping above when there is no room below (anchoring by `bottom`, so it grows upward with no second measurement). Reflows on `resize` and on `scroll` **captured at `window`**, which is what keeps a panel pinned to a trigger inside a scroll container                                                                                                                   |
| `composables/useListboxNavigation.ts` | the cursor into a listbox: `activeIndex`, arrow/page/Home/End movement that skips disabled options and never wraps, type-ahead, scroll-into-view, and the re-clamp when the visible list changes — keyed on option **values**, so a `props(field)` factory rebuilding its array does not move the highlight under the user. **Decomposition of `BaseSelect`, not a general-purpose composable**                                                          |
| `composables/useSelectOptions.ts`     | which options a `BaseSelect` shows and what state that list is in — local filtering, or debounced server search with abort + a monotonic request id so an out-of-order response is dropped rather than written. Stale-while-revalidating. **Decomposition of `BaseSelect`, not a general-purpose composable**                                                                                                                                            |
| `utils/format.ts`                     | every `Intl` formatter in one place. Locales are hard-coded `en-GB` and `formatTimestamp` pins `timeZone: 'UTC'` — an `undefined` locale renders differently on server and client, which is a hydration mismatch. The prose date (`1 Jan 2026`) and the column date (`01 Jan 2026`) are two named constants, never one formatter reconfigured per call                                                                                                   |
| `utils/api-error.ts`                  | `getApiErrorMessage` reads Nitro's message off `FetchError.data`; `toPageError` asserts a cause only for a 404                                                                                                                                                                                                                                                                                                                                           |
| `utils/safe-redirect.ts`              | `resolveSafeRedirect` restricts `?redirect` to internal paths                                                                                                                                                                                                                                                                                                                                                                                            |
| `stores/records.ts`                   | **Every action takes the query params from the caller** — the store never mirrors them. `createRecord` returns the page the new record landed on and only refetches when that equals the current page; the page navigates when it differs. An edit refetches the current page rather than splicing. State is cleared when `fetchRecords` is called for a different table. Each fetch forwards `relationLabels` to the relations store                    |
| `stores/tables.ts`                    | `loaded`/`failed` flags + `ensureTables()`, which **never throws** — it sets `failed` and the sidebar reports it inline with a Retry                                                                                                                                                                                                                                                                                                                     |
| `stores/relations.ts`                 | `loadOptions(tableId, fields)` fetches every relation field's candidates in parallel and makes no request at all for a table without relations                                                                                                                                                                                                                                                                                                           |
| `error.vue`                           | the whole-app error boundary. Deliberately **store-free** — it has to render when data fetching is exactly what failed                                                                                                                                                                                                                                                                                                                                   |

### The renderers — `app/components/records/`

- **`DynamicForm.vue`** — renders a form from `IField[]` by walking `FIELD_INPUTS`: `v-bind`s each entry's `props(field)`, passes the value through `toControl`, pushes what the control emits back through `fromControl`. Values flow down as props and changes back up via `update: [key, value]`, so the parent's `useForm` object is never mutated.
- **`DynamicTable.vue`** — renders from `queryFields(fields)` + `IRecord[]`, so **one** `columns` list drives header and body alike. Each cell is a `RecordFieldValue`, which resolves the pair through `app/utils/record-cells.ts` — `cellValue` reads `RECORD_COLUMNS` first and falls through to `record.data`; `cellComponent` likewise falls through to `FIELD_CELLS` — and renders `Not set` for a blank, so no cell component handles null. Shared with the detail dialog, so a value reads identically in both. No branch on a key or a type anywhere in the template. Emits `edit`/`delete`/`sort`; the optional `sort` prop drives `aria-sort` and the header arrow. The row's **View** action emits nothing — it is a `<NuxtLink>` through `useDetailLink`, which is why the component takes a `tableId` prop: it has to address the records it draws, and a generic renderer must not read that off the route itself. Column width is capped by `$column-max-width` in its own style block — one knob, applied to a wrapper inside the cell rather than to the cell (`docs/decisions.md`).
- **`RecordFieldValue.vue`** — one column of one record: `Not set`, or the cell component for that column. The seam that keeps the table and the detail dialog rendering a value the same way. An **empty array is blank** alongside `null` — without that a cleared multi-value field would render as nothing rather than say so.
- **`RecordDetail.vue`** — the detail dialog's body: a `<dl>` over `queryFields(fields)`, the same list `DynamicTable` renders, minus the record number (which names the dialog in its own heading). Values wrap instead of truncating — reading one in full is the point of the dialog.
- **`RecordsFilterPanel.vue`** — the filter drawer. One control per `queryFields(fields)` entry from `FIELD_FILTERS`, bound to `filters[field.key]` falling back to the type's empty value. Rebuilt in field order so URLs stay stable, dropping anything `isFilterValueEmpty`, so the map only ever holds active filters.
- **`RecordsFilterSummary.vue`** — the active filters stated **above** the data. Iterates `queryFields(fields)` and looks each key up in the filter map — never `Object.entries(filters)`, which would surface a key with no field to pair it with — so chip order matches the drawer and the URL.

### The records page

**The URL query is the single source of truth** for filter/sort/page. `queryParams` is `parseRecordQueryState(fields, route.query)` — page, sort and filters in one shot, so the page parses nothing itself. Every control writes back through `toRecordQueryParams`, and one watcher refetches — keyed on `recordQueryKey(queryParams)` rather than on `queryParams` itself, because that computed is a fresh object whenever **any** param moves and the list must not refetch because a dialog opened. Sort and page navigations are **pushed** (back steps through them); live filter edits **replace**, or a few keystrokes would bury the previous page. Records and relation options are fetched **after** fields resolve, in parallel with each other — filters decode against field metadata, so a shared filter URL would otherwise render unfiltered on first paint.

---

## 11. Styling reference

`app/assets/scss/` partials:

| Partial           | Contents                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `_palette.scss`   | the primitive colour ramp as **SCSS variables** (`$gray-200`, `$blue-600`, …)                                           |
| `_variables.scss` | the public token surface: CSS custom properties built from the palette                                                  |
| `_reset.scss`     | reset/normalize + base typography + the global `:focus-visible` baseline                                                |
| `_functions.scss` | the `rem()` helper                                                                                                      |
| `_mixins.scss`    | the shared style fragments + `$breakpoint-shell`; `@use`s `functions` itself and does not re-export it                  |
| `_auth-form.scss` | the shared `.auth-form` block; `@use`s `functions` and `mixins` itself                                                  |
| `_text-link.scss` | the global `.text-link` block; references only custom properties, so it `@use`s nothing                                 |
| `main.scss`       | entry point — `@use`s `variables` / `reset` / `auth-form` / `text-link`, and must **not** re-`@use` functions or mixins |

**Token surface:** semantic colour (`--color-canvas`, `--color-surface`/`-hover`/`-row-hover`/`-disabled`/`-muted`, `--color-text`/`-subtle`/`-on-accent`/`-on-accent-tint`, `--color-accent`/`-hover`/`-active`/`-tint`, `--color-danger*`, `--color-border-subtle`/`--color-border`/`-strong`/`-control`, `--color-focus`, `--color-scrim`, `--shadow-sm`/`-md`), the badge hues (`--color-badge-<name>-bg`/`-border`/`-fg` for each member of `BADGE_COLORS`), layering (`--z-scrim`/`-sidebar`/`-modal`/`-popover`), geometry (`--radius-sm`/`-md`/`-lg`/`-pill`, `--control-height`, `--control-padding-x`, `--header-height`, `--sidebar-width`), type (`--font-size-xs…xl`, `--line-height-tight`/`-base`).

**The badge hues** are the one ramp a component selects at runtime rather than by class. `badgeTint()` (`app/utils/badge-tint.ts`) composes the token _names_ into `var()` references and returns them as inline custom properties (`--badge-bg`/`-border`/`-fg`), so a literal colour still cannot reach a component. A Sass `@each` emitting one modifier per hue was the alternative and was rejected: it duplicates the palette list across SCSS and TypeScript, where adding a colour to one and not the other yields a silently unstyled badge. The three steps are read by two components, not one: `BaseBadge` takes `-bg` and `-fg` (its dot is `currentColor`, so the dot is the `-fg` step), while `BaseColorPicker` takes all three — a swatch is colour with no word beside it, so its edge is the only thing bounding it. Each `-fg` clears 4.5:1 on its own `-bg`, and each `-border` clears 3:1 against both `--color-surface` and `--color-surface-hover` — the second is the binding one, because the picker's trigger takes that wash.

**Mixins:** `focus-ring($offset)`, `below-shell`, `stack($gap)`, `cluster($gap)`, `truncate`, `field-label`, `field-error`, `form-control`, `error-banner`, `page-header`, `page-title`.

`stack($gap)` and `cluster($gap)` are the two layout primitives, a column and a row; neither declares `flex-wrap`. A `page-header` side passed as a `cluster` must carry `min-width: 0` itself — the group, not the `<h1>`, is the header's flex item, and `page-title`'s own `min-width: 0` only governs the title _inside_ the group.

`truncate` is one line of text ending in an ellipsis, and it only does anything on a **bounded** box: a `max-width` of its own (`DynamicTable`'s cells), or `min-width: 0` where it is a flex item that would otherwise refuse to shrink below its content (`AppSidebar`'s table name, `BaseBadge`'s text, `page-title` inside a header group). Forgetting the bound is the failure mode — the rule is present and silently inert.

**`.text-link` is a class, not a mixin** — an inline navigation link _inside a sentence_, the one link look that is not a control. Anything standing on its own in an action row is a `BaseButton` with `to` instead.

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

`ghost`'s horizontal padding is transparent, so nothing paints at its box edge and the padding reads as gap: space a ghost against a neighbour from the **ink**, not the box (`docs/decisions.md`).

`primary`/`secondary`/`danger`/`ghost` are `min-height: var(--control-height)`, and `icon` takes it on **both** axes (`min-width` too, or it stays glyph-wide). `link` alone declares no height at all — it is a text run, and it is what sizes `.table-card__actions` and `.field-row`.

A typed `tone?: 'default' | 'danger'` recolours hover for the `icon`/`link` variants via the internal `--hover-color` custom property, which each variant defaults for itself (`icon` → text, `link` → accent). Per-variant defaults are why this is a custom property rather than a `v-bind`.

#### `variant` is the appearance; `to` is the element

Passing `to` (a path string) makes the root a `<NuxtLink>` — a real `<a href>`, so middle-click, "copy link address" and the SSR'd markup all work — while every variant keeps its exact look. The two axes are independent on purpose: `variant="link"` is _a button that looks like a link_, `to="/x"` is _a link that looks like whatever `variant` says_.

The modes bind **disjoint** props through one `rootProps` computed: button mode emits `type`/`disabled`, link mode emits `to`. `type` is a MIME hint on an anchor and `disabled` does not exist on one, so neither is ever rendered as a link. Everything else arrives by attribute fallthrough and the component forwards nothing by hand — including `target`, `rel`, `external` and `prefetch`, which are declared `NuxtLink` props and so resolve as props even when they fall through. An absolute URL needs no flag either: `NuxtLink` branches on `hasProtocol()` itself and renders a plain `<a rel="noopener noreferrer">` with no router involved.

**`disabled` wins over `to`:** a disabled link renders `<button disabled>`, reusing the native inertness and the existing `&:disabled` rule rather than rebuilding them from `aria-disabled` + `tabindex="-1"` + `pointer-events: none`.

A link activates on **Enter only** — Space scrolls the page. That is correct anchor behaviour, not a regression, and it is the one way a `to` button differs from the buttons beside it.

The chassis gained `text-decoration: none` for this and nothing else. Colour needed no counterpart: `color: inherit` is an author declaration, so it outranks the UA's link and `:visited` colours by cascade origin — and every variant declares its own colour regardless.

### Other atoms worth knowing

- **`BaseInput`** — bound with `:value` + `@input` rather than `v-model`, which would cast a `type="number"` input's value to a number and write `1.5` back while the user is still typing `1.50`; the composition guard is kept by hand so IME input still works. `ariaLabel` and `invalid` serve **grouped** controls where a wrapper owns the visible label and error line. `debounce` and `trim` serve callers that bind props rather than `v-model`, since `<component :is>` cannot pass v-model modifiers. `icon` is an Iconify name — `BaseButton`'s prop by the same name — drawn in a leading gutter inside `.base-input__control`, the relative-positioned box the `<input>` always renders in and the anchor any future decoration (a trailing clear button, a unit suffix) positions against. `form-control`'s chrome stays on the `<input>` rather than moving to that box on purpose: the border, `:focus` colour, focus ring and `--invalid` state are then identical whether a field is decorated or not.
- **`BaseRange`** — the two-bound atom, knowing nothing about filters: one label above a 1fr/1fr grid of bare `BaseInput`s. A required `type` (`number`/`date`) picks the bound's DOM type; a `null` bound means "no bound", never zero. It keeps typed text in local drafts synced by a `watch` that resyncs **only a bound that disagrees with what is on screen** — that is what distinguishes an outside change (clear all, a shared URL, the back button) from the value being echoed back.
- **`BaseModal`** — teleport, backdrop/Esc close, `role="dialog"`, optional `footer` slot outside the scrolling body. `variant`: `dialog` (centered card) / `drawer` (same chrome anchored right, full height). Marks `#__nuxt` `inert` while open, which makes `aria-modal="true"` true rather than a claim.
- **`BaseSelect`** — a listbox **or** a combobox, chosen by `searchable`: single or multiple selection, `clearable`, placeholder, coloured options, and distinct loading / empty / no-results / failed states. Generic over `TModel extends string | string[]`, with `multiple` tied to that type so the two cannot disagree. The panel teleports to `<body>` and is placed by `useAnchoredPosition`.
  - `searchable: false` — a `<button aria-haspopup="listbox">` with native focus and hand-rolled type-ahead.
  - `searchable: true` — an `<input role="combobox">`; the user types **into the control** and the panel lists matches. Search is **independent of where options come from**: locally it filters `options` on the client, with `loadOptions` it asks the server. `loadOptions` is inert without it.
  - The selection is drawn as an **overlay** over the control, never as the input's value, so searching never means clearing what is already chosen. One piece of markup serves both branches; the `<button>` names itself by IDREF to it, the `<input>` describes itself by IDREF to it.
  - **`searchable` is never derived from the option count.** A caller owns the array it passes and can count it — `~/utils/select`'s `shouldSearch()` is the house threshold, applied at the call site.
  - **`multiple` is read through `isMultiple`, never as `props.multiple`.** Its conditional type emits no runtime `Boolean`, so a bare `multiple` attribute arrives as `''` and is falsy — see `decisions.md`.
- **`BaseCheckbox`** — label-wrapped native checkbox with `accent-color`. Its `disabled` is a **declared prop bound to the `<input>`**: attribute fallthrough would put it on the wrapper `<div>`, where it does nothing at all.
- **`BaseBadge`** — `chip` (a **value**, e.g. a SELECT cell — never uppercased, it is user data) / `label` (a **meta marker**, e.g. `required`). An optional `color` tints a chip from `BADGE_COLORS`; it is inert on `label`, which carries its own muted colour. A coloured chip also draws an 8px dot in its `-fg` step — a `::before` with empty `content`, so it adds no accessible object and no DOM node per cell. The dot needs `variant="chip"` **and** a defined `color`, so a `label` never draws one. (A SELECT cell always resolves to a real hue — `badgeColorFor` falls back to `DEFAULT_BADGE_COLOR` — so the undefined-`color` chip is the atom's own contract rather than a state the app reaches today.) It draws no border: the word bounds it, and the dot carries the hue onto the hovered row where the fill washes out.
- **`BaseColorPicker`** — a swatch trigger plus an absolutely-positioned `radiogroup` panel with roving tabindex. No teleport and no anchor measurement: the only surface it opens inside is `BaseModal`'s `dialog` variant, which declares no `overflow` anywhere, so nothing clips it. **Escape is handled on the panel with `.stop`, never on `document`** — `BaseModal`'s own Escape listener _is_ on `document`, and one keypress must not close both. That holds because focus is always inside the panel while it is open, which the roving tabindex requires anyway.
- **`BasePagination`** — `pageCount` is passed in rather than derived, so the `ceil` formula lives only in the store. Owns its internal layout only; the consumer positions it.

### The shell

`app/layouts/default.vue` is a CSS grid of `var(--sidebar-width) minmax(0, 1fr)` under a full-width `var(--header-height)` header. **`minmax(0, 1fr)` plus `min-width: 0` on the main region is load-bearing** — without it the column's min-content width is `DynamicTable`'s full intrinsic width, so it never shrinks, the table's `overflow-x` never engages, and the whole document scrolls sideways.

**The shell owns the viewport, and the document never scrolls:** the grid is `height: 100dvh` with `overflow: hidden`, so its `var(--header-height) 1fr` rows resolve against a definite height and the header cannot scroll away. The sidebar and the main region are the two scroll panes — each `overflow-y: auto` **plus `min-height: 0`**, which is the vertical counterpart of the `min-width: 0` above: a grid item's automatic minimum is its content, so without it the pane grows past the row and its `overflow` never engages. The sidebar is a plain grid item, not `position: sticky` — the fixed shell supplies the height that a `calc(100vh - …)` used to fake. A page that wants to fill the pane instead of scrolling it sets `height: 100%` (see below).

Below `below-shell` the grid collapses to one column and the sidebar becomes `position: fixed` with `top: var(--header-height); bottom: 0` (out of the grid it has no row to take its height from), translated off-canvas **and `visibility: hidden`** (translation alone leaves it off-screen but focusable), opened by a header toggle over a scrim, closing on Escape, scrim click, and route change. Sidebar `z-index: 50` / scrim `40`, both below `BaseModal`'s `100`. `BaseModal` teleports to `<body>`, so the shell's `overflow: hidden` cannot clip a dialog or the filter drawer.

`DynamicTable` splits its rules by job: `--color-border-subtle` between rows (a rule _inside_ a surface), and `--color-border`/`-strong` for the container, the sticky-header rule and the pinned-column edge (the structure). A hovered row takes `--color-surface-row-hover`, deliberately lighter than the control hover, because a SELECT cell's badge draws no border and every badge fill sits within 1.05:1 of `--color-surface-hover`. **Every cell takes the same inset**, `$cell-padding-y $cell-padding-x` (`rem(4) rem(16)`) — header and body, scrolling and pinned, with no per-cell exception. Rows are `height: calc(var(--control-height) + #{$cell-padding-y * 2})` on `tbody td`, not derived from the tallest cell, so a row is exactly a button plus that inset and re-resolves if either moves; the two are one decision (`docs/decisions.md`). `th` padding sits on the `&__sort` button so the whole header cell is a full-height target rather than a ~20px text run — the button's `min-height` is what sizes the header row, so its block padding only has to stay under it. The Actions corner header is the one cell with no button inside, so it declares the pair directly. Its root is the scroll container on **both** axes, and `thead th` is `position: sticky; top: 0` — with an opaque `background` (the padding lives on the inner button, so the cell must paint it) and an inset `box-shadow` standing in for the header rule, because `border-collapse: collapse` paints the collapsed edge with the table rather than with the sticky cell. The **Actions column is pinned** the same way on the other axis: `position: sticky; right: 0` on both its `th` and its `td`, so the fields scroll under it. The corner cell is sticky on both axes and takes `z-index: 2` to sit above the header row and the pinned column alike; its buttons live in a `&__actions-group` wrapper because a `display: flex` `<td>` cannot be sticky (see `decisions.md`).

**The records page fills the pane rather than scrolling it.** `.records-page` is `display: flex; flex-direction: column; height: 100%`; breadcrumbs, the header row, the filter summary and the failure banner are the fixed band; `&__body` is `flex: 1; min-height: 0`. `DynamicTable` takes `flex: 0 1 auto; min-height: 0` from the page, so it sizes to its rows and stops — a short result ends at its last row with the pager directly beneath, a long one shrinks to the pane and scrolls inside itself. Only the rows scroll. The empty states are centred by `margin-block: auto`, not by a `justify-content` on `&__body`, which would move the grid too.

The table list is fetched **by the layout, once per session**, via `ensureTables()`. The layout uses key `app-tables` and the dashboard `dashboard-tables` — **never the same key** (see `decisions.md`).

---

## 12. Manual regression checklist

Until a test suite exists, walk this after any change to the metadata layer:

- Record CRUD across **every** field type.
- A filtered URL loaded cold — it must render filtered on first paint.
- `BaseRange` resyncing on "Clear all" and on the back button.
- Sort and page history; the console for hydration mismatches.
- **Relations:** a link renders as its label rather than an id; sorting that column is alphabetical by label; deleting a target record degrades the cell to a dashed, unclickable "Unknown record"; deleting a targeted table is refused.
- **The record dialog:** a row's View action and a relation link both open it, and the list behind it does **not** refetch; browser Back closes it and Forward reopens it; a `?detail=` URL loaded cold renders the dialog server-side; a relation inside the dialog drills in and `← Back` returns; Escape closes the whole chain and focus lands back on the link that opened it; a target deleted since the page was drawn gives "This record no longer exists." with no Retry; the link's focus ring is not clipped by the cell; `Open in …` is absent when the record shown belongs to the table already on screen.
- **Record columns:** `#9` sorts before `#10` (integer, not text); a number filter matches partially; a created record takes the next number and a deleted one's is never reused; a `Created at` range whose `from` and `to` are the same day still matches records made later that day (the `::date` cast).
- **Search:** a one-character term is rejected; a term matching a NUMBER column's text works; BOOLEAN and RELATION columns do not match.
- **Multi-value SELECT filters:** two choices give `?stage=Won&stage=Lost` (repeated, sorted) and the table shows the union; the summary chip reads "is any of …"; clearing removes the param rather than emptying it; that URL loaded cold renders filtered with both options ticked; a value the field does not offer is a 400.
- **Multi-value fields** (`options.multiple`, SELECT and RELATION):
  - the field form offers "Allow multiple values" for those two types only, and locks it once saved on;
  - widening a field that already holds data leaves every existing value rendering unchanged, and narrowing it back is a 400;
  - a record holding several values shows them on one line in the table and wrapped in the detail dialog; clearing it reads `Not set`, not blank;
  - a required multi field with nothing chosen fails per-field; a repeated value and one past `RECORD_LIST_MAX` are each a 400;
  - the column sorts by its **first** value, blanks last;
  - search matches text inside a multi SELECT's values and does **not** match on `[`, `"` or `,`;
  - a multi RELATION filters as `?services=id1&services=id2`, its summary chip reads "is any of <labels>", and each link in the cell drills into the detail dialog independently — a deleted target degrades to a dashed "Unknown record" while its siblings still link.
- **`BaseSelect`, both branches:** Enter/Space/↑/↓ open with the current value active; ↑/↓/PageDown move a _visibly outlined_ highlight and the list scrolls to follow; a panel near the bottom of the filter drawer flips above and is not clipped; scrolling the drawer keeps it pinned. Non-searchable only: focus moves into the list, Home/End jump, and type-ahead works.
- **Escape — the case that is silent when broken:** focus a **searchable** select **without opening it** → Escape must close the surrounding drawer or dialog. Open it → Escape closes the panel only → Escape again closes the drawer. Repeat on a non-searchable one.
- **Enter in a form:** closed searchable select + Enter → the form submits (the key is not swallowed). Open + Enter → picks, and does not submit.
- **Combobox:** typing anywhere — keystroke or **paste** — opens the panel and filters; local filtering issues **no request**; the value overlay hides while a term is typed and returns when it is cleared; the native placeholder never shows under a selection. In `multiple`, pick an option **with the mouse** and keep typing — the characters must still land in the field; Backspace on an empty term drops one value per press and does not run away when held.
- **Clear:** ✕ clears the value and leaves focus in the control, never on `<body>`.
- **Relation search:** one character searches (no minimum); `%` is matched literally; a bare number finds `#42` when the label field is blank; typing fast then clearing returns to the seed with no stale result winning; with the server unreachable the panel shows "Could not load options." + a working Retry.
- **Colours:** a SELECT choice's hue shows in the trigger, in every option row, and in the table cell.
