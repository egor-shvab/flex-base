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
2. **`constants/`** — the runtime registries. Values, never logic.
3. **`utils/`** — generic helpers. `filter.ts` (param naming + value-shape predicates) is a pure leaf; `record-query.ts` (the URL codec) additionally uses the value schemas to decode.
4. **`validation/`** — zod schemas and their builders. A schema validates; turning validated params into a domain model is the codec's job, never a `.transform()`.

### Module inventory

**`shared/types/`**

- **`auth.ts`** — `IAuthUser`
- **`table.ts`** — `ITable`, `ITableListItem` (with `_count`)
- **`field.ts`** — `TFieldType`, `IFieldChoice` (`value` + `color`), `IFieldOptions` (SELECT's `choices`; RELATION's `targetTableId` + `labelFieldKey`; both types' `multiple`), `IField`
- **`color.ts`** — `TBadgeColor` — the closed badge palette, a design-system concept rather than a field one, so an atom can consume it without importing field metadata
- **`record.ts`** — `TRecordSingleValue` (**one** value — what a per-type cell renders, what a record column holds, what a decoded filter bound is), `TRecordValue` (that plus `string[]`), `TRecordData`, `IRecord`, `IRecordPage` (records + paging + `relationRefs`), `IRecordRef` (`number` + a nullable `label` — how a linked record reads), `IRecordOption` (that plus the `id` it stores), `IRecordDetailRef` (`tableId` + `recordId`), `IRecordDetail` (that record plus its table, fields and refs), `IRecordQueryState` (page + sort + filters), `IRecordQuery` (the same plus the resolved `pageSize`), `IRecordQueryParams`
- **`range.ts`** — `INumberRange`, `IDateRange` — the two-bound shapes shared by `BaseRange` and the filter codec
- **`filter.ts`** — `TFilterValue` (`TRecordValue` is a subset of this union), `IFilterValueByType`, `TRecordFilterValues`, the shape union (`scalar`/`list`/`range`), `IFilterValueSpec`, `TFilterParamRole` (`value`/`from`/`to`), `IRecordSort`, `TSortDirection`

`TRecordFilterValues` is **the filter model of every layer**: typed values keyed by `Field.key`, sparse — an absent key is unfiltered, and the count of filtered fields is `Object.keys(…).length`.

**`shared/constants/`**

- `field.ts` — `FIELD_TYPES`, `FIELD_TYPE_LABELS`, `BOOLEAN_LABELS`, `MULTI_VALUE_BY_TYPE` (which types may be configured to hold several values — SELECT and RELATION). Every type in `FIELD_TYPES` is creatable; there is no second, narrower list.
- `filter.ts` — `FILTER_VALUE_BY_TYPE`; `DEFAULT_SORT_KEY` (`createdAt`) + `DEFAULT_SORT_DIR` (`desc`); `RESERVED_QUERY_PARAMS` (`page`/`pageSize`/`sort`/`dir`/`search`/`detail`) + `DETAIL_PARAM`; `SEARCH_MIN_LENGTH` (2); `FILTER_VALUES_MAX` (50, the cap on one list-shaped filter's values); `RECORD_NUMBER_KEY` / `CREATED_AT_KEY` / `UPDATED_AT_KEY` + `RESERVED_FIELD_KEYS`.
- `record.ts` — `RECORD_PAGE_SIZE` (50), `RECORD_PAGE_SIZE_MAX` (100), `RELATION_OPTIONS_LIMIT` (200), `UNKNOWN_RECORD_LABEL`, `MULTI_VALUE_MAX_ITEMS` (50, the cap on how many values one multi-value field may hold — `FILTER_VALUES_MAX`'s counterpart on the write side).

**`shared/utils/`**

- `field.ts` — `choiceValues` / `choiceOptions` / `badgeColorFor` (SELECT's choices as strings, as picker options, and as a hue), and **`isMultiValue(field)`** — the one reader of `options.multiple`, guarded by `MULTI_VALUE_BY_TYPE` so a stale flag on a type with no list form cannot reach the schema or the SQL.
- `record-label.ts` — `buildRecordLabel(record, labelFieldKey)`: the one rule for what names a record, used by both server paths so they cannot disagree. A blank, missing or deleted label field reads as **`null`** — never `#<number>`, so the number stays recoverable and cannot be composed in twice. A stored list degrades to its values joined rather than to `["a","b"]`, since a field can be widened after being chosen as a label. Its sibling `formatRecordRef(ref)` writes the flat form (`#3 Example`, or `#3` alone) for the places that can only hold a string.
- `filter.ts` — `recordColumn(key, name, type)` and `queryFields(fields)` (§5); `filterShapeFor(field)` / `emptyFilterValueFor(field)`, the multi-value overrides every caller holding an `IField` reads instead of indexing by type; `filterParamSlots` / `filterParamNames` / `rangeParamName`, all over one private `RANGE_PARAM_SUFFIX`; `claimFilterParams(fields)`, which resolves each param name to at most one field (reserved names first, then fields in order) with `isReservedParam` over the same set, and `filterableFields(fields)`, the fields that claimed at least one param — what the drawer and the summary render from; and the shape predicates `isRangeFilterValue` / `isListFilterValue` / `isScalarFilterValue` / `isFilterValueEmpty`, which need no field metadata. **`isRangeFilterValue` excludes arrays explicitly** — an array is a non-null object, so without that a list value would narrow to a range.

  The param **slots** stay keyed by type and multi-value does not move them: `scalar` and `list` already claim the same single name (a list is that name repeated), and no multi-capable type is `range`. That is what keeps `filterParamNames` callable from `createField`, where only the type is known.

- `record-query.ts` — the URL codec: `parseRecordQueryState(fields, query)`, `parseFilterValues`, `toFilterParams`, `toRecordQueryParams(state)`, shared by the page, the store and the records endpoint so a shared link and the fetch behind it cannot diverge. `parseRecordQueryState` is the exact inverse of `toRecordQueryParams` and is **lenient by design** — rejecting bad input is the schema's job. Decoding goes straight from params to typed values with no intermediate condition model, narrowing a range **by value shape**, never by field type. `recordQueryKey(state)` serializes the same params to a stable string, for watchers that must fire on a changed query rather than a changed object.
- `record-detail.ts` — the `?detail=` codec (§7): `parseDetailChain`, `toDetailParam`, `pushDetail`, `popDetail`, and `withDetailChain(query, chain)`, the one seam every link in the dialog is built from — it layers the chain onto the current query, so the list view a dialog was opened over always survives.
- `query-param.ts` — `singleParam`, the `string | string[] | number` collapse both codecs read a param through.

**`shared/validation/`**

- `auth.ts` — `credentialsSchema` (login and register share it), `registerSchema`.
- `name.ts` — `nameSchema`, the one rule for every user-visible name (1–100 chars); tables and fields build on it so they cannot drift.
- `table.ts` — `tableSchema`.
- `field.ts` — flat `fieldSchema` with a per-type `superRefine`, one schema for client and server. `multiple` is judged against `MULTI_VALUE_BY_TYPE` rather than a hardcoded type pair. Flat at the top level only: a SELECT choice is `{ value, color }`, and uniqueness is judged on `value` alone, since two choices differing only by colour are the same choice. Whether a RELATION's target exists and is owned is a database question, so the server layers `requireFieldTarget` on top.
- `record.ts` — `VALUE_SCHEMA_BY_TYPE` (per type: `base` schema + `blank` value + `fromQuery` decoder + `listBase`), `buildRecordSchema(fields)` (strips unknown keys), `blankValueFor(field)`, `buildFilterValueSchema(field)`, `buildRecordQuerySchema(fields)` (page + pageSize + sort/dir + the filter params the table's fields claim; a **loose** object so the refinement can read filter params without widening the base ones). Required is enforced only where `blank` is `null`, so a BOOLEAN's `false` counts as a value.

  **A multi-value field's schema is its type's own `base` lifted into `z.array`** — the type still says what one value is, cardinality says how many. `blank` becomes `[]`, `required` becomes "at least one", the cap is `MULTI_VALUE_MAX_ITEMS`, and duplicates are rejected rather than deduplicated (`decisions.md`). No type declares a second schema.

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
| `icons.ts`            | `FIELD_TYPE_ICONS: Record<TFieldType, string>`                               | the glyph beside a type's word             |
| `details.ts`          | `FIELD_DETAILS: Record<TFieldType, Component \| null>`                       | how a field's configuration reads          |

**Cardinality is the second axis, and it is a property of the field rather than of its type.** Each of the four control registries keeps its flat per-type entries and gains a total `Record<TFieldType, X | null>` override table — `MULTI_INPUTS`, `MULTI_FILTERS`, `MULTI_SUMMARIES`, and `MULTI_SQL` on the server — plus one resolver every consumer calls instead of indexing:

| Registry              | Resolver                      | Consumer               |
| --------------------- | ----------------------------- | ---------------------- |
| `inputs.ts`           | `inputFor(field)`             | `DynamicForm`          |
| `filters.ts`          | `filterFor(field)`            | `RecordsFilterPanel`   |
| `filter-summaries.ts` | `summaryFor(field)`           | `RecordsFilterSummary` |
| `cells.ts`            | `cellComponent(column)` (§10) | `RecordFieldValue`     |

`null` means "this type has no list form", which `MULTI_VALUE_BY_TYPE` already refuses to configure — the two agree by construction. Because the override tables are total, a new field type still cannot ship without stating its position.

Only two entries are non-`null` anywhere: `MULTI_FILTERS` and `MULTI_SUMMARIES` leave **SELECT** `null`, because a SELECT filter has always been list-shaped, so nothing about filtering it changes when the stored value becomes a list.

**`FIELD_DETAILS` is the one control-adjacent registry with no `MULTI_*` counterpart**, and its `null` means something different from theirs: not "this type has no list form" but "this type is fully described by its own word" — TEXT configures nothing. Cardinality stays out of it because `isMultiValue(field)` already answers for every type, so the field manager renders that part itself rather than two components repeating it. That is also why callers index it directly instead of through a resolver: there is no override for one to consult. `FIELD_TYPE_ICONS` is a plain string map for the same reason — nothing about a glyph changes when a field is widened.

Multi-value **cells** need no override table at all. `cellComponent` returns one shared `MultiValueCell`, which renders each entry through `FIELD_CELLS[field.type]` — a list of values is the list of how each value renders, so a future multi-capable type is covered without a component of its own. It renders **inline** rather than as a flex row, which is load-bearing (`decisions.md`); nothing about the cell puts it on a line — `DynamicTable`'s `white-space: nowrap` does that, and `RecordDetail` simply does not impose it.

`cellComponent` is paired with **`cellValues`** / **`cellSingleValue`** (`app/utils/record-cells.ts`): whenever the first returns `MultiValueCell`, the value is `cellValues`, otherwise it is `cellSingleValue`. `RecordFieldValue` branches on the same `isMultiValue` question to pick the pair. That is what lets each cell declare the exact shape it renders instead of the union of both — and `cellValues` is **the one place** a stored value that is not yet an array is accounted for (a row drawn before `updateField`'s migration ran).

`types.ts` defines the shape both control tables share:

- `IFieldControl<TValue>` — `component` + a `props(field)` factory + optional `toControl`/`fromControl` adapters.
- `TRecordFieldControl` = `Required<IFieldControl<TRecordValue>>`, since a record input always adapts (a DOM control speaks strings and checkboxes, never `TRecordValue`) — which is why `DynamicForm` never branches on an optional adapter.
- `IFieldCellProps` — `field` + `value`. Its `value` is `TRecordSingleValue`, **not** `TRecordValue`: a per-type cell renders exactly one value, and `defineProps<T>()` compiles to a runtime prop check (`decisions.md`).
- `IMultiValueCellProps` — `field` + `value: string[]`, `MultiValueCell`'s own contract. A separate interface rather than a widening, because the two are opposites: it is the only cell taking a list, and every other cell is what it delegates each entry to.

**Inputs.** TEXT/DATE/SELECT share one `blankIsNull` adapter (a blank control means "no value", never `''`). NUMBER keeps a real parse, and unparseable text passes through so the schema reports "Enter a number". BOOLEAN maps to `BaseCheckbox`. RELATION reuses `blankIsNull` over the shared picker.

**Filters.** TEXT is a debounced, trimmed `BaseInput` (matching is always case-insensitive and partial); SELECT a **multiple** `BaseSelect` fed from the field's own metadata, whose model already _is_ the `string[]` filter value and so needs no adapters, marked `searchable` once the field has more choices than `shouldSearch()`'s threshold; NUMBER/DATE a `BaseRange` with its `type`; RELATION the same picker the form uses, so a filter offers exactly what a record can link to. Only BOOLEAN adds adapters, because the control speaks strings while its filter value is `boolean | null` (`null` = "All", carried by the _absence_ of a choice). **No control knows an operator** — the value is the whole contract.

Every "All" / "— Select —" is a **placeholder plus `clearable`**, never a synthetic blank option. The cleared value is still `''`, so the wire format did not move.

**Cells.** `cells/{Text,Number,Boolean,Date,Select,Relation}FieldCell.vue` — one read-only cell per type. BOOLEAN renders an `mdi:check`/`mdi:minus` icon, SELECT a chip, NUMBER/DATE fixed `en-GB` `Intl` formats, RELATION the label the page resolved (or a muted "Unknown record"). Blank values never reach a cell — `DynamicTable` renders the `—` placeholder itself. `RecordNumberCell` and `TimestampCell` belong to `RECORD_COLUMNS` rather than to a field type, which is why they are not named `*FieldCell`.

**`controls/RelationFieldSelect.vue`** is the only control that is a component rather than a registry row, because a relation's candidates are records of another table and no synchronous `props(field)` factory can produce them. One component serves both tables: `placeholder` is "— Select —" when editing and "All" when filtering. It renders **two `BaseSelect` branches** rather than binding a union model, because `multiple` is tied to that model's type by design; `multiple` comes from field metadata and is fixed for the control's lifetime, so the branch never swaps under the user. It is also the only control that fetches on **user input** — it hands `BaseSelect` a `loadOptions` that searches the target table server-side, plus `searchable` unconditionally (the cap is on the _seed_, so the option count says nothing about how many records exist). A linked record the seed list does not offer — beyond the cap, found through a search, or since deleted — is appended as its own option, so opening a form can never drop a link on save.

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

An id is not readable, so how a record reads is resolved server-side. **A relation reads as `#<number>` plus its label**, and the `#` is written only where the number is genuinely known — `formatRecordRef` and `BaseRecordRef`, both of which require one. `server/services/relations.ts` is the only module that knows what a RELATION means, which is what keeps `records.ts` generic. It applies `buildRecordLabel` in three places:

- **`resolveRelationRefs`** — runs after the record list and returns `IRecordPage.relationRefs`, keyed by **field id** then by target record id (per field, because two relations may point at one table through different label fields). One `findMany` per distinct target table, never one per row. `collectRelationTargets` normalises a stored value through `Array.isArray(v) ? v : [v]`, and that is the **whole** of what several links cost this module: everything below it already works in sets and batches.
- **`assertRelationTargets`** — gates every record write: a value that does not resolve to a live record of its target table is a 400, so a crafted payload cannot store a dangling id.
- **`listRelationOptions(field, search)`** — backs `GET /api/tables/[tableId]/fields/[fieldId]/options[?q=]`, capped at `RELATION_OPTIONS_LIMIT` and label-ascending. Scoped by the **source field**, so nothing about the target is taken from the client. `?q=` narrows via `buildRecordLabelSearch` — the label field plus the record's `#number` — leaving the ORDER BY untouched, so search and order stay independent. No `SEARCH_MIN_LENGTH` here (`decisions.md`); the bound is `max(100)` on the term. Note the order is by **label**, so the visible numbers are not ascending and blank-labelled records sort together at the end.

Client side, `app/stores/relations.ts` is the single home for both halves — `optionsByField` (a picker's candidates) and `refsByField` (id → `IRecordRef`), both keyed by field id. `RelationFieldSelect` reads the options; `RelationFieldCell` reads the refs. Both draw the pair through **`BaseRecordRef`**, the one component that writes a `#`; the picker reaches it through `BaseSelect`'s single slot (`decisions.md`), and each option's flat `label` stays `formatRecordRef`'s output so the trigger, the type-ahead and the accessible name all agree with the row.

A resolved reference is a **link**: `RelationFieldCell` renders a `<NuxtLink>` whose target is the current URL with the record appended to the `detail` chain (§7), so clicking one opens the record-detail dialog. A reference that does not resolve — the target was deleted — renders as a `<span>` with a dashed underline and a `title`, never a link and never a `#`: there is no number to state. The cell is the same component in the table and inside the dialog, which is what makes nested relations drill: it appends to whatever chain it is being rendered under, without knowing where it is.

---

## 7. Wire formats

### Filters

Plain query params named after the field, the name following from the value's shape:

```
?company=acme&stage=Won&stage=Lost&active=true&contract_value_from=1000&contract_value_to=5000
```

- A **scalar** value (TEXT, BOOLEAN, single-value RELATION) takes the field's bare key; a **list** (SELECT, and any multi-value field) takes that same key **repeated once per value**; a **range** (NUMBER, DATE) spreads to `_from` / `_to` suffixes.
- **A multi-value field always filters as a list**, whatever its type declares — `filterShapeFor(field)` is the override. A multi RELATION therefore rides the same repeated-param format SELECT already used, which is why the param **names** did not move: `scalar` and `list` claim the same single name.
- The record's own columns ride in the same namespace: `?recordNumber=4` as a scalar (partial match, like any text filter), `?createdAt_from=…&updatedAt_to=…` as ranges. All three are accepted `?sort=` keys too.
- A RELATION carries the target record's **id** (`?company=clx…`) — the picker's own value, so a link cannot decode to a label the server would have to re-resolve.
- **How each is compared is the field type's business on the server** (TEXT partially, scalars exactly, a list as `IN (…)`, ranges inclusively) and never travels in the URL. There are no operators anywhere in the project.
- Every filter is ANDed; the values **within** one list filter are ORed. A list is capped at `FILTER_VALUES_MAX` and deduplicated, and its values are sorted on serialize so one selection has one canonical URL.
- One value per param — a repeated param is a 400 **for every shape but `list`**, which is the only one that reads repeats.
- An empty value (`?company=`) means "not filtered", never `ILIKE '%%'`.
- Params the table does not own are **ignored, not rejected** — with bare names a typo is indistinguishable from `utm_source`. A malformed **known** param (`?contract_value_from=abc`) is still a 400.
- **A reserved param is never a filter, in either direction.** `claimFilterParams` will not hand one to a field, and `toRecordQueryParams` will not write one from a filter value — both read the same `isReservedParam`. A legacy field keyed `search` or `page` is therefore not filterable at all: `filterableFields` subtracts it, so the drawer and the summary render no control for it. Only its **filter** is lost — it still renders as a column and still sorts, because a sort key travels as the _value_ of `?sort=`. A **range** field keyed that way keeps its filter: `page_from`/`page_to` are names of its own.

### The open record

One reserved `?detail=` param, owned by the **page** rather than by the list endpoint — it never travels in an API request:

```
?detail=<tableId>.<recordId>,<tableId>.<recordId>
```

The records a detail dialog has open, outermost first. Only the **last** entry is fetched (`GET /api/tables/:tableId/records/:recordId`); the entries before it are the trail Back walks up, so drilling through nested relations is routing rather than state kept on the side — browser Back reverses exactly one step, the dialog survives a refresh, and SSR renders it for a shared link. Both separators sit outside the cuid alphabet. Decoded leniently: a malformed entry stops the chain rather than throwing.

`detail` is in `RESERVED_QUERY_PARAMS`, so a field keyed `detail` cannot claim the name. Because `toRecordQueryParams` emits list params only, any list navigation (paging, sorting, filtering) drops the param and closes the dialog.

### Search

One reserved `?search=` param, ANDed with the filters. It is **free text ORed across the table's searchable columns** — the only OR anywhere in the query layer. `SEARCH_MIN_LENGTH` (2) is enforced by the **query schema**, not just the input, so no caller can trigger an unanchored full-table scan with one character; a shorter term is a 400, and the client drops it rather than sending it. `?search=` empty reads as absent, exactly like a filter — in the **schema** as well as in the codec, so a hand-written link with a cleared box is not a 400. Blank means empty after trimming, the same test `isFilterValueEmpty` applies to a text filter, and both readers trim before judging.

---

## 8. The query layer

`server/services/record-query.ts` is the only SQL in the project: `buildRecordWhere(tableId, fields, filters)`, `buildRecordSearch(...)`, `buildRecordOrderBy(fields, sort)`. Raw because Prisma cannot `orderBy` a JSON path.

**One total map, `FIELD_SQL_BY_TYPE`**, gives each field type:

- `expr` — the JSONB projection a **filter** compares against (`::numeric`/`::boolean` casts; plain text for TEXT/DATE/SELECT/RELATION).
- `sortExpr` — how the column **orders**, when that differs from how it filters. RELATION is the only single-value type that declares one: a correlated subquery over the target's label field, because it filters on the stored id but orders by the label.
- `filter` — how its value compares: `matchesPartially` (`ILIKE` with escaped wildcards), `matchesExactly` (`=`), `withinRange` (inclusive `>=`/`<=` for whichever bounds are set), `matchesAny` (`IN (…)`).
- `searchPredicate(key, pattern)` — how free-text search matches it, or `null` to opt out. A whole **predicate**, not an expression the caller appends `ILIKE` to, and separate from `expr` for the reasons in `decisions.md`.

**`MULTI_SQL`** is the cardinality override, consulted by `sqlFor(field)` for a field whose `options.multiple` is set — the same lifting the validation layer applies, in SQL:

- `expr` is `data -> key` rather than `->>`, since `->>` on an array yields the literal `["a","b"]` and would match a filter on `[` or `","`.
- `filter` is `containsAny`: `jsonb_exists_any(expr, ARRAY[…]::text[])`. The **function form**, never the `?|` operator (`decisions.md`). Like `IN (…)` it is self-parenthesising, it answers correctly for a bare scalar, and it is the one comparison in this layer that is **GIN-indexable**.
- `sortExpr` orders by the **first** element (`data -> key ->> 0`; for RELATION, `targetLabel` over that same first id).
- `searchPredicate` is `EXISTS (SELECT 1 FROM jsonb_array_elements_text(…) WHERE element ILIKE …)` for SELECT, and `null` for RELATION.

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

`prisma/migrations/` is the history. One of them is hand-written, because a required column over existing rows cannot be generated (`CLAUDE.md` §5, `decisions.md`).

---

## 10. Module map

Only the modules whose contract is not obvious from their name.

### `server/`

- **`utils/ownership.ts`** — `requireOwnedTable` (single scoped query; 404 when missing or foreign) · `requireOwnedTableFields` (same plus the table's field metadata in one round trip — reads need it to resolve sort/filter params) · `requireOwnedTableWithFields` (the table itself plus its fields, for the record-detail read, which has to **name** a table the page it opened from is not about) · `requireRecordFields` (the same plus a 400 when the table has no fields — **writes only**, since a field-less table must still list an empty page) · `requireFieldTarget` (a RELATION may only point at an owned table, labelled by a field that table has)
- **`utils/prisma-errors.ts`** — `toHttpError(error, { conflict?, notFound })` — the shared `P2002` → 409 / `P2025` → 404 mapping used by all three services
- **`utils/auth.ts`** — bcrypt hash/verify, JWT sign/verify, `auth_token` cookie helpers, `requireUser`. `verifyAuthToken` pins `algorithms: ['HS256']`, so the token cannot choose its own
- **`utils/field-key.ts`** — `slugify` (a display name → `^[a-z0-9_]+$`, `field` when nothing survives) + `buildFieldKey(name, type, existing)`. A key must be free for **every query param it would claim**, not only for itself: a field called "Page" becomes `page_2`, "Budget from" becomes `budget_from_2` next to a NUMBER `budget`. Server-only — nothing in the Vue layer derives a key
- **`services/tables.ts`** — list/create/rename/delete scoped by `userId`. `deleteTable` refuses with 409 when another table's RELATION field targets it. Exports `tableSelect`; `tableListSelect` spreads it and adds the counts only the dashboard needs
- **`services/fields.ts`** — list/create/update/delete scoped by `tableId`; derives `order` and the DB `options`, and takes the immutable `key` from `utils/field-key.ts`. Rejects type changes, RELATION retargeting, and narrowing a multi-value field (400 each); **widening** runs `widenToList` — one scoped, idempotent `UPDATE` — inside the same transaction as the metadata change. Exports `fieldSelect` + `toSharedField`, the one place Prisma's untyped `options` JSON is narrowed to `IField`
- **`services/records.ts`** — paginated list (`$transaction` of two `$queryRaw`s sharing one WHERE fragment) + create/update/delete scoped by `tableId`. `data` is replaced wholesale on update; every write passes `assertRelationTargets` first. `getRecordDetail` returns one record as `IRecordDetail` — an aggregate on purpose (`decisions.md`); a missing row is a 404
- **`api/tables/[tableId]/records/index.get.ts`** — validates with `buildRecordQuerySchema(fields)`, then composes `IRecordQuery` from `parseRecordQueryState(fields, params)` + the validated `pageSize` — **the schema judges, the codec decodes**

### `app/`

- **`composables/useApi.ts`** — the `useRequestFetch` seam — its one job is keeping callers off bare `$fetch`
- **`composables/useForm.ts`** — form state keyed `Record<string, unknown>`; its dynamic key handling is what lets one composable drive metadata-generated forms
- **`composables/useDetailLink.ts`** — the route target that opens a record in the detail dialog, layered onto the current query. Every way in is this one function — a row's View action and a relation cell alike — and each appends to whatever chain it renders under, so a caller never has to know whether it is opening or drilling
- **`composables/useRecordDetail.ts`** — the one owner of the record-detail dialog: reads the `detail` chain off the route, fetches only its last entry (keyed on a **string**, never the ref object, which is fresh on every query change), feeds the labels to the relations store, and hands back the route targets for Back and Close. Every control it exposes is a navigation, not a state change
- **`composables/useRecordListQuery.ts`** — the records page's list query. Which action leaves a history entry is a contract: a sort or a page step **pushes**, a filter edit, a search or a clear **replaces**. A search term below `SEARCH_MIN_LENGTH` is dropped rather than sent, and an unchanged term does not navigate at all
- **`composables/useDeleteConfirm.ts`** — the confirm-then-delete flow every list page repeats. The target is cleared **only on success**, so a failed delete leaves the dialog open; a refused one renders its reason in the dialog rather than rethrowing (`decisions.md`)
- **`composables/useDebouncedModel.ts`** — a writable local `draft` of a `v-model` that writes back on a delay, re-synced when the model changes from outside, skipping the write when draft and model already agree. `delay: 0` writes through synchronously, which is what lets `BaseInput` use one code path for both
- **`composables/usePopover.ts`** — open state, outside-pointer dismissal and focus restore. `containerRef` (the outside-click boundary) and `triggerRef` (the focus-restore target) are **separate** refs. **Owns no Escape listener** — the caller handles it (`CLAUDE.md` §7, `decisions.md`)
- **`composables/useAnchoredPosition.ts`** — places a `position: fixed` panel against an anchor in viewport coordinates, flipping above when there is no room below (anchoring by `bottom`, so it grows upward with no second measurement). Reflows on `resize` and on `scroll` **captured at `window`**, which is what keeps a panel pinned inside a scroll container
- **`composables/useListboxNavigation.ts`** — the cursor into a listbox: `activeIndex`, arrow/page/Home/End movement that skips disabled options and never wraps, type-ahead, scroll-into-view, and the re-clamp when the visible list changes — keyed on option **values**, so a `props(field)` factory rebuilding its array does not move the highlight. **Decomposition of `BaseSelect`, not a general-purpose composable**
- **`composables/useSelectOptions.ts`** — which options a `BaseSelect` shows and what state that list is in — local filtering, or debounced server search with abort + a monotonic request id so an out-of-order response is dropped rather than written. Stale-while-revalidating. **Decomposition of `BaseSelect`, not a general-purpose composable**
- **`utils/format.ts`** — every `Intl` formatter in one place. Locales are hard-coded `en-GB` and `formatTimestamp` pins `timeZone: 'UTC'` (`decisions.md`). The prose date (`1 Jan 2026`) and the column date (`01 Jan 2026`) are two named constants, never one formatter reconfigured per call
- **`utils/api-error.ts`** — `getApiErrorMessage` reads Nitro's message off `FetchError.data`; `toPageError` asserts a cause only for a 404
- **`utils/safe-redirect.ts`** — `resolveSafeRedirect` restricts `?redirect` to internal paths
- **`stores/records.ts`** — **Every action takes the query params from the caller** — the store never mirrors them. `createRecord` returns the page the new record landed on and only refetches when that equals the current page. An edit refetches rather than splicing. State is cleared when `fetchRecords` is called for a different table. `fetchRecords` sets `failed` **and rethrows**
- **`stores/tables.ts`** — `loaded`/`failed` flags + `ensureTables()`, which **never throws** — it sets `failed` and the sidebar reports it inline with a Retry. Also owns `bumpCount(tableId, key, delta)`, the one way the cached `_count` moves without a refetch: **`stores/records.ts` and `stores/fields.ts` are its only callers**
- **`stores/relations.ts`** — `loadOptions(tableId, fields)` fetches every relation field's candidates in parallel and makes no request at all for a table without relations. `searchOptions` never writes `optionsByField` (`decisions.md`)
- **`error.vue`** — the whole-app error boundary. Deliberately **store-free** — it has to render when data fetching is exactly what failed

### The renderers — `app/components/records/`

- **`DynamicForm.vue`** — renders a form from `IField[]` by walking `FIELD_INPUTS`: `v-bind`s each entry's `props(field)`, passes the value through `toControl`, pushes what the control emits back through `fromControl`. Values flow down as props and changes back up via `update: [key, value]`, so **the parent's `useForm` object is never mutated**.
- **`DynamicTable.vue`** — renders from `queryFields(fields)` + `IRecord[]`, so **one** `columns` list drives header and body alike. Each cell is a `RecordFieldValue`. No branch on a key or a type anywhere in the template. Emits `edit`/`delete`/`sort`; the optional `sort` prop drives `aria-sort` and the header arrow. The row's **View** action emits nothing — it is a `<NuxtLink>` through `useDetailLink`, which is why the component takes a `tableId` prop: a generic renderer must not read that off the route itself.
- **`RecordFieldValue.vue`** — one column of one record: `Not set`, or the cell component for that column, resolved through `app/utils/record-cells.ts` (`cellValue` reads `RECORD_COLUMNS` first and falls through to `record.data`; `cellComponent` likewise falls through to `FIELD_CELLS`). The seam that keeps the table and the detail dialog rendering a value the same way. An **empty array is blank** alongside `null` — without that a cleared multi-value field would render as nothing rather than say so.
- **`RecordDetail.vue`** — the detail dialog's body: a `<dl>` over `queryFields(fields)`, minus the record number (which names the dialog in its own heading). Values wrap instead of truncating — reading one in full is the point of the dialog. It does that by **not** declaring the table's `white-space: nowrap`, not by overriding a cell.
- **`RecordsFilterPanel.vue`** — the filter drawer. One control per `queryFields(fields)` entry from `FIELD_FILTERS`, bound to `filters[field.key]` falling back to the type's empty value. Rebuilt **in field order** rather than patched per key, so a shared URL is stable whichever control was touched, dropping anything `isFilterValueEmpty`.
- **`RecordsTableSkeleton.vue`** — the body's third state, standing where the rows will be while a fetch is in flight with none to show. A `role="status"` naming itself through `.visually-hidden`, over `aria-hidden` bars. Its row and bar counts are **fixed constants**, never derived from `fields`: mid-navigation those still belong to the table being left, and this is a placeholder rather than a preview of what is coming.
- **`RecordsFilterSummary.vue`** — the active filters stated **above** the data. Iterates `queryFields(fields)` and looks each key up in the filter map — never `Object.entries(filters)`, which would surface a key with no field to pair it with — so chip order matches the drawer and the URL.

### The records page

**The URL query is the single source of truth** for filter/sort/page. `queryParams` is `parseRecordQueryState(fields, route.query)` — page, sort and filters in one shot, so the page parses nothing itself. Every control writes back through `useRecordListQuery`, and one watcher refetches — keyed on `recordQueryKey(queryParams)` rather than on `queryParams` itself, because that computed is a fresh object whenever **any** param moves and the list must not refetch because a dialog opened. Records and relation options are fetched **after** fields resolve, in parallel with each other — filters decode against field metadata, so a shared filter URL would otherwise render unfiltered on first paint.

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

**The badge hues** are the one ramp a component selects at runtime rather than by class. `badgeTint()` (`app/utils/badge-tint.ts`) composes the token _names_ into `var()` references and returns them as inline custom properties (`--badge-bg`/`-border`/`-fg`), so a literal colour still cannot reach a component (`decisions.md`). The three steps are read by two components: `BaseBadge` takes `-bg` and `-fg` (its dot is `currentColor`, so the dot is the `-fg` step), while `BaseColorPicker` takes all three. Each `-fg` clears 4.5:1 on its own `-bg`, and each `-border` clears 3:1 against both `--color-surface` and `--color-surface-hover` — the second is the binding one, because the picker's trigger takes that wash.

**Mixins:** `focus-ring($offset)`, `below-shell`, `stack($gap)`, `cluster($gap)`, `truncate`, `surface-card`, `field-label`, `field-error`, `form-control`, `error-banner`, `page-header`, `page-title`.

`surface-card` is the bordered surface on the canvas — the dashboard's cards and each section of the table settings page. Geometry and colour only: a card that lifts on hover, or wears the ring because a link fills it, declares that itself, since collapsing those in would put a hover state on surfaces that are not interactive.

`stack($gap)` and `cluster($gap)` are the two layout primitives, a column and a row; neither declares `flex-wrap`. A `page-header` side passed as a `cluster` must carry `min-width: 0` itself (`decisions.md`).

`truncate` is one line of text ending in an ellipsis, and it only does anything on a **bounded** box: a `max-width` of its own, or `min-width: 0` where it is a flex item that would otherwise refuse to shrink below its content. Forgetting the bound is the failure mode — the rule is present and silently inert.

**`.text-link` is a class, not a mixin** — an inline navigation link _inside a sentence_, the one link look that is not a control. Anything standing on its own in an action row is a `BaseButton` with `to` instead.

**Focus has two registers, chosen by whether a control has a border of its own.** `focus-ring` is for those that do not — buttons, links, rows, options — and draws a hairline outline; `form-control` is for fields, which recolour their own border to `--color-focus` instead and never take a ring (it would restate the same edge one hairline out). Both then take `--focus-ring-halo`. Within `form-control` the split is the same as before: `:focus` recolours the border, including on programmatic autofocus; the halo is `:focus-visible`, so it says "you are on the keyboard". Where a link fills a card, the **card** wears the ring via `:has(:focus-visible)` and the link suppresses both halves of its own.

### `BaseButton` variants

`.base-button` is a neutral chassis (flex centering, radius, type, `focus-ring`, `:disabled`); the filled look lives in `&--primary`, which the template always emits since `variant` defaults to `'primary'`. **`font-size`/`font-weight` must stay on the chassis** — `--ghost` declares neither, so moving them would drop ghost buttons to the UA default.

| Variant     | Use                                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `primary`   | default filled action                                                                                                              |
| `secondary` | the neutral peer of primary — same geometry so a dialog's footer pair aligns, bordered rather than filled. `ConfirmModal`'s Cancel |
| `danger`    | destructive filled action                                                                                                          |
| `ghost`     | transparent text+icon with a faint `--color-accent-tint` hover                                                                     |
| `icon`      | borderless icon-only; takes `prependIcon` + `label` (aria-label/title)                                                             |
| `link`      | bare text button for row actions — the chrome of a link, the semantics of a button                                                 |

`primary`/`secondary`/`danger`/`ghost` are `min-height: var(--control-height)`; `icon` takes it on **both** axes (`min-width` too, or it stays glyph-wide); `link` declares no height but is floored at 24 on both axes. `ghost`'s horizontal padding is transparent, so it reads as gap — space a ghost against a neighbour from the **ink**, not the box (`decisions.md`).

Any variant takes `prependIcon` and `appendIcon` (iconify names) for an icon before and after the slot. Both render the same `aria-hidden` `.base-button__icon` — the side is DOM order, not a modifier class, since nothing about the two differs visually and the chassis's `gap` already spaces them.

A typed `tone?: 'default' | 'danger'` recolours hover for the `icon`/`link` variants via the internal `--hover-color` custom property, which each variant defaults for itself. Per-variant defaults are why this is a custom property rather than a `v-bind`.

A typed `size?: 'md' | 'sm'` works the same way and is likewise a closed set, not a free-form measurement. `icon` reads its box and glyph from `--icon-box`/`--icon-glyph`; `sm` resteps only those two, so it declares no property of its own and is inert on every other variant. It is the **24×24** step for an icon button sitting inside another control — the select's clear ✕, the filter chip's remove ✕ — where the 36px floor does not fit. `16 + rem(4)` of the variant's padding on each side is exactly 24, which is SC 2.5.8's floor and the boundary case `test/e2e/setup/a11y.ts` measures: neither number moves alone.

**`variant` is the appearance; `to` is the element.** Passing `to` makes the root a `<NuxtLink>` — a real `<a href>` — while every variant keeps its exact look. The modes bind **disjoint** props through one `rootProps` computed: button mode emits `type`/`disabled`, link mode emits `to`. Everything else arrives by attribute fallthrough and the component forwards nothing by hand — including `target`, `rel`, `external` and `prefetch`, which are declared `NuxtLink` props and so resolve as props even when they fall through. **`disabled` wins over `to`**, and a link activates on Enter only (`decisions.md`).

### Other atoms worth knowing

- **`BaseInput`** — bound with `:value` + `@input` rather than `v-model` (`decisions.md`); the composition guard is kept by hand so IME input still works. `ariaLabel` and `invalid` serve **grouped** controls where a wrapper owns the visible label and error line. `debounce` and `trim` serve callers that bind props rather than `v-model`, since `<component :is>` cannot pass v-model modifiers. `icon` is an Iconify name drawn in a leading gutter inside `.base-input__control`, the relative-positioned box any future decoration positions against. `form-control`'s chrome stays on the `<input>` rather than moving to that box on purpose: the border, its `:focus` colour, the halo and the `--invalid` state are then identical whether a field is decorated or not.
- **`BaseRange`** — the two-bound atom, knowing nothing about filters: one label above a 1fr/1fr grid of bare `BaseInput`s. A required `type` (`number`/`date`) picks the bound's DOM type; a blank or unparseable bound is `null`, **never `0`**, or an empty box silently becomes `>= 0`. It keeps typed text in local drafts synced by a `watch` that resyncs **only a bound that disagrees with what is on screen**.
- **`BaseModal`** — teleport, backdrop/Esc close, `role="dialog"`, optional `footer` slot outside the scrolling body. `variant`: `dialog` (centered card) / `drawer` (same chrome anchored right, full height). **Both cap the dialog at the scrim's own content box and make the body the sole scroll pane**, so the header and footer stay put and a dialog taller than the screen is reachable rather than centred off both edges (`decisions.md`). Marks `#__nuxt` `inert` while open, which makes `aria-modal="true"` true rather than a claim. **It owns the sole document-level Escape listener** and releases it on unmount.
- **`BaseSelect`** — a listbox **or** a combobox, chosen by `searchable`: single or multiple selection, `clearable`, placeholder, coloured options, and distinct loading / empty / no-results / failed states. Generic over `TModel extends string | string[]`, with `multiple` tied to that type so the two cannot disagree. The panel teleports to `<body>` and is placed by `useAnchoredPosition`.
  - `searchable: false` — a `<button aria-haspopup="listbox">` with native focus and hand-rolled type-ahead. Its accessible name is _label + value_.
  - `searchable: true` — an `<input role="combobox">`; the user types **into the control** and the panel lists matches. Search is **independent of where options come from**: locally it filters `options`, with `loadOptions` it asks the server. `loadOptions` is inert without it.
  - The selection is drawn as an **overlay** over the control, never as the input's value, so searching never means clearing what is already chosen. One piece of markup serves both branches; the `<button>` names itself by IDREF to it, the `<input>` describes itself by IDREF to it.
  - **`searchable` is never derived from the option count.** `~/utils/select`'s `shouldSearch()` is the house threshold, applied at the call site.
  - **`multiple` is read through `isMultiple`, never as `props.multiple`** (`decisions.md`).
  - Its combobox swallows Escape **only while open**, so a closed select inside the filter drawer does not eat the drawer's own key.
- **`BaseCheckbox`** — label-wrapped native checkbox with `accent-color`. Its `disabled` is a **declared prop bound to the `<input>`**: attribute fallthrough would put it on the wrapper `<div>`, where it does nothing at all.
- **`BaseBadge`** — `chip` (a **value**, e.g. a SELECT cell — never uppercased, it is user data) / `label` (a **meta marker**, e.g. `required`). An optional `color` tints a chip from `BADGE_COLORS` and draws an 8px dot in its `-fg` step; it is inert on `label`. It draws no border: the word bounds it, and the dot carries the hue onto the hovered row where the fill washes out. It truncates itself, because an `inline-flex` box is atomic to the cell containing it (`decisions.md`). It declares **its own `height` and `line-height`** — 24px for a chip, 20px for a label — so no container can resize it (`decisions.md`).
- **`BaseColorPicker`** — a swatch trigger plus an absolutely-positioned `radiogroup` panel with roving tabindex. It takes `useAnchoredPosition` but no teleport: the only surface it opens inside is `BaseModal`'s `dialog` variant, which is itself teleported. **Scrolling ancestors are not what would clip it** — it opens inside two of them (the dialog body, and the choices list in `FieldFormModal`) and survives both, because a `position: fixed` box is clipped by an ancestor's `overflow` only where that ancestor is its containing block. What would break it is a `transform`/`filter`/`contain` anywhere above it, which `.base-modal` must therefore keep declaring none of. **Escape is handled on the panel with `.stop`, never on `document`.** It states its own `maxHeight` rather than taking the composable's default, which describes a scrolling list.
- **`BaseEmptyState`** — an optional `title`, the message as the default slot, an optional `action` slot, and a **required `icon`** drawn in an accent-tinted tile above the copy: an empty state names what is missing, and every one the concept draws opens with that glyph. The icon is `aria-hidden` — the records page renders this component _as_ a `role="status"` live region. Its message keeps a `<p>` wrapper because the root is a flex column: a bare slot would put each run of a message mixing text with an inline `.text-link` on its own line.
- **`BasePagination`** — `pageCount` is passed in rather than derived, so the `ceil` formula lives only in the store. Owns its internal layout only; the consumer positions it.

### The shell

`app/layouts/default.vue` is a CSS grid of `var(--sidebar-width) minmax(0, 1fr)` under a full-width `var(--header-height)` header. **The shell owns the viewport and the document never scrolls:** the grid is `height: 100dvh` with `overflow: hidden`, so its rows resolve against a definite height and the header cannot scroll away. The sidebar and the main region are the two scroll panes, each `overflow-y: auto`.

> **`minmax(0, 1fr)` + `min-width: 0` on the main region, and `min-height: 0` on both panes, are load-bearing** — without them the table never shrinks and the panes' `overflow` never engages (`decisions.md`).

Below `below-shell` the grid collapses to one column and the sidebar becomes `position: fixed` with `top: 0; bottom: 0` — anchored to the viewport rather than to the header it covers, and stating both edges because out of the grid it has no row to take its height from — translated off-canvas **and `visibility: hidden`** (translation alone leaves it off-screen but focusable), opened by a header toggle over a scrim, closing on Escape, scrim click, and route change. Sidebar `z-index: 50` / scrim `40`, both below `BaseModal`'s `100`. `BaseModal` teleports to `<body>`, so the shell's `overflow: hidden` cannot clip a dialog or the filter drawer.

`DynamicTable` splits its rules by job: `--color-border-subtle` between rows (a rule _inside_ a surface), and `--color-border`/`-strong` for the container, the sticky-header rule and the pinned-column edge (the structure). A hovered row takes `--color-surface-row-hover`, deliberately lighter than the control hover. **Every cell takes the same inset**, `$cell-padding-y $cell-padding-x`, with no per-cell exception, and rows are `height: calc(var(--control-height) + #{$cell-padding-y * 2})` on `tbody td` — the two are one decision. Its root is the scroll container on **both** axes: `thead th` is `position: sticky; top: 0` and the Actions column is `position: sticky; right: 0`, with the corner cell sticky on both and above them. Column width is capped by `$column-max-width` on a wrapper **inside** the cell. Every one of these has a failure mode that is invisible until it bites — the sticky edges are shadows rather than borders, the actions cell needs its wrapper to stay a table-cell box, and the cap cannot go on the `td`; all four are in `decisions.md`.

**The records page fills the pane rather than scrolling it.** `.records-page` is `display: flex; flex-direction: column; height: 100%`; breadcrumbs, the header row, the filter summary and the failure banner are the fixed band; `&__body` is `flex: 1; min-height: 0`. `DynamicTable` takes `flex: 0 1 auto; min-height: 0`, so it sizes to its rows and stops — a short result ends at its last row with the pager directly beneath, a long one shrinks to the pane and scrolls inside itself. Only the rows scroll. The empty states are centred by `margin-block: auto`, not by a `justify-content` on `&__body`; the skeleton is `flex: none` instead — it stands in for the table, so it takes the table's place rather than the middle of the pane.

The table list is fetched **by the layout, once per session**, via `ensureTables()` under the key `app-tables`. The dashboard fetches nothing of its own — it renders the same list, and the `_count` on it is kept current by `bumpCount` rather than by a second request. A page that does fetch keys on what it fetches; a layout and a page must **never** share a key (`decisions.md`).

---

## 12. Browser regression checklist

**Playwright owns this list, bar the clauses badged otherwise.** `test/e2e/` automates it against the production build in Chromium (`npm run test:e2e`, and its own CI job). Keep the list current: it is the index of what `test/e2e/` is for, and a behaviour added here without a spec is a gap that will not announce itself.

Two badges appear below, and both mean the line is inventory but another suite is what would catch it:

- **_(integration)_** — SQL semantics: a cast, a projection, an opt-out. A browser cannot answer them any better than a database round trip can, so they are proved in `server/services/record-query.integration.spec.ts`.
- **_(unit)_** — logic a component spec pins in milliseconds. Where a keyboard cursor _lands_ is decided by the same code whatever renders it; only whether it is _painted_ needs a browser.

**Four lines are approximated rather than proven** — hydration mismatches, a focus ring not clipped by its cell, Backspace held down, and a multi-value cell's ellipsis. Each spec says so where it sits, and the register in `decisions.md` carries the reason.

- Record CRUD across **every** field type.
- A filtered URL loaded cold — it must render filtered on first paint.
- Switching tables: while the next table's rows are in flight the body shows the loading skeleton, never "No records yet".
- `BaseRange` resyncing on "Clear all" and on the back button.
- Sort and page history; the console for hydration mismatches.
- **Relations:** a link renders as its number and label rather than an id, in the cell and in a picker's option rows alike; sorting that column is alphabetical by label; deleting a target record degrades the cell to a dashed, unclickable "Unknown record"; deleting a targeted table is refused.
- **The record dialog:** a row's View action and a relation link both open it, and the list behind it does **not** refetch; browser Back closes it and Forward reopens it; a `?detail=` URL loaded cold renders the dialog server-side; a relation inside the dialog drills in and `← Back` returns; Escape closes the whole chain and focus lands back on the link that opened it; a target deleted since the page was drawn gives "This record no longer exists." with no Retry; the link's focus ring is not clipped by the cell; `Open in …` is absent when the record shown belongs to the table already on screen; a badge is the same height in the row and in the dialog, however many are on a line.
- **Record columns:** `#9` sorts before `#10` (integer, not text); a number filter matches partially _(integration)_; a created record takes the next number and a deleted one's is never reused _(integration)_; a `Created at` range whose `from` and `to` are the same day still matches records made later that day — the `::date` cast _(integration)_.
- **Search:** a one-character term is rejected; a term matching a NUMBER column's text works; a BOOLEAN column does not match; a RELATION column matches neither its label nor its stored id _(integration)_.
- **Multi-value SELECT filters:** two choices give `?stage=Won&stage=Lost` (repeated, sorted) and the table shows the union; the summary chip reads "is any of …"; clearing removes the param rather than emptying it; that URL loaded cold renders filtered with both options ticked; a value the field does not offer is a 400.
- **Multi-value fields** (`options.multiple`, SELECT and RELATION):
  - the field form offers "Allow multiple values" for those two types only, and locks it once saved on;
  - widening a field that already holds data leaves every existing value rendering unchanged, and narrowing it back is a 400;
  - a record holding several values shows them on one line in the table and wrapped in the detail dialog, and that one line means the values that **fit, in full** — never every value shrunk to a stub; clearing it reads `Not set`, not blank;
  - a required multi field with nothing chosen fails per-field; a repeated value and one past `MULTI_VALUE_MAX_ITEMS` are each a 400;
  - the column sorts by its **first** value, blanks last;
  - search matches text inside a multi SELECT's values and does **not** match the JSONB punctuation holding them together — `["`, `", "`, `"]` _(integration)_. Note the separator is `", "`: jsonb normalises its text output, so a `","` probe would pass even against a broken projection;
  - a multi RELATION filters as `?services=id1&services=id2`, its summary chip reads "is any of <labels>", and each link in the cell drills into the detail dialog independently — a deleted target degrades to a dashed "Unknown record" while its siblings still link.
- **`BaseSelect`, both branches:** the keyboard cursor is **visibly outlined** — asserted as a real computed outline, which is the half no component spec can see; ↑/↓/PageDown move it and the list scrolls to follow; a panel near the bottom of the filter drawer flips above and is not clipped; scrolling the drawer keeps it pinned. Where the cursor _lands_ — Enter/Space/↑/↓ opening on the current value, Home/End, type-ahead, focus moving into the list — is logic, not paint _(unit)_.
- **Escape — the case that is silent when broken:** focus a **searchable** select **without opening it** → Escape must close the surrounding drawer or dialog. Open it → Escape closes the panel only → Escape again closes the drawer. Repeat on a non-searchable one.
- **Enter in a form:** closed searchable select + Enter → the form submits (the key is not swallowed). Open + Enter → picks, and does not submit.
- **Combobox:** typing anywhere — keystroke or **paste** — opens the panel and filters; local filtering issues **no request**; the value overlay hides while a term is typed and returns when it is cleared; the native placeholder never shows under a selection. In `multiple`, pick an option **with the mouse** and keep typing — the characters must still land in the field; Backspace on an empty term drops one value per press and does not run away when held.
- **Clear:** ✕ clears the value and leaves focus in the control, never on `<body>`.
- **Relation search:** one character searches (no minimum); `%` is matched literally; a bare number finds `#42` when the label field is blank; typing fast then clearing returns to the seed with no stale result winning; with the server unreachable the panel shows "Could not load options." + a working Retry. That Retry is reachable **from the keyboard**: Tab moves into the teleported panel, Shift+Tab returns to the field, Enter retries and leaves focus in the field rather than on `<body>`, and Tab past it closes the panel and carries on to the **next** control — the one clause that rests on how the browser sequences focus after the handler has moved it.
- **Colours:** a SELECT choice's hue shows in the trigger, in every option row, and in the table cell.
- **The table settings page:** a field row states its type, how it is configured and its key, so a table's shape reads without opening a dialog per row; the row actions are icon buttons whose accessible name carries the field's own name; the table can be renamed and deleted from the page named after it — a rename moves the heading and the sidebar together (both read the tables store, so neither refetches), a delete lands on the dashboard, and a table another table's RELATION points at refuses with the blocking field named in the dialog; at 375px the row stacks its actions rather than squeezing the name to nothing.
- **Accessibility:** no `serious` or `critical` axe violation on the dashboard, table settings, the records list, the record form or the filter drawer — and none on the dashboard, the records list or table settings at 375px, where the shell is a different layout.
- **Target size:** nothing interactive below 24×24 on those same screens, with the filter-summary chip's remove button asserted at _exactly_ 24 as the boundary case. Three documented SC 2.5.8 exceptions are encoded in `test/e2e/setup/a11y.ts`; see `CLAUDE.md` §8.
- **The mobile shell** (375×812): the sidebar is `visibility: hidden` until opened, so nothing inside it is reachable; the toggle tracks `aria-expanded`; the open panel is flush with the top of the viewport and as tall as it; navigating or clicking the scrim dismisses it; the records table scrolls inside its own container rather than making the page scroll sideways; a dialog fits the viewport on **both** axes, and one with more content than the screen holds caps its height and scrolls its body — the title stays on screen and the submit button is reached by scrolling.
