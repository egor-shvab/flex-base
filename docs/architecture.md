# Architecture

How the metadata layer works. Rules live in `CLAUDE.md`; rationale and rejected alternatives live in `decisions.md`; the SCSS layer is `styling.md`.

---

## 1. Stack

- **Frontend:** Nuxt 4, Vue 3, TypeScript, Pinia, SCSS (`sass-embedded`).
- **Backend:** Nitro via `server/api` routes.
- **Database:** PostgreSQL 17 (Docker) through Prisma 7 (`@prisma/client` + `@prisma/adapter-pg`).
- **Auth:** manual — bcrypt for password hashing, `jsonwebtoken` for tokens, no auth library. The JWT (`{ sub: userId }`, HS256, 7 days) lives in an httpOnly `auth_token` cookie. `server/middleware/auth.ts` resolves it to `event.context.user` on every request and **never rejects**; handlers call `requireUser(event)` to enforce 401. Client side: `app/stores/auth.ts` + `app/middleware/auth.global.ts` handle session restore and redirects both ways; requests go through `app/api/` and its `useApi()` seam, so cookies are forwarded during SSR.
- **Validation:** zod, shared between client and server.

---

## 2. The `shared/` layers

Each folder has one job, and the dependency order is what keeps them honest — a file may only import from layers above it.

1. **`types/`** — declarations only, erased at build time. They may `import type` a constant purely to derive from it (`TFieldType` is `typeof FIELD_TYPES[number]`); because both directions are type-only, that reference costs nothing at runtime.
2. **`field-types/`** — one module per field type plus the registry that assembles them (§3). Read by `utils/` and `validation/`, **never the reverse** — a lint rule holds that, because the reverse edge is the cycle that used to keep the filter and value tables in separate layers (`decisions.md` → _One module per type, because what cycled was moved out_). The one folder outside `validation/` that may import zod.
3. **`constants/`** — the runtime registries. Values, never logic.
4. **`utils/`** — generic helpers. `filter.ts` (param naming + value-shape predicates) is a pure leaf; `record-query.ts` (the URL codec) additionally uses the value schemas to decode.
5. **`validation/`** — zod schemas and their builders. A schema validates; turning validated params into a domain model is the codec's job, never a `.transform()`.

### Contracts not obvious from a module's name

The folders themselves are readable from `ls`; these are the rules a reader cannot see there.

- **`TRecordFilterValues` is the filter model of every layer** — typed values keyed by `Field.key`,
  sparse: an absent key is unfiltered, and the count of filtered fields is `Object.keys(…).length`.
- **`isRangeFilterValue` excludes arrays explicitly.** An array is a non-null object, so without that
  test a list value narrows to a range.
- **`buildRecordLabel` returns `null`** for a record with nothing to name it by — never
  `#<number>`, so the number stays recoverable and cannot be composed in twice. A stored list
  degrades to its values joined. Its sibling `formatLinkedRecord` writes the flat form (`#3 Example`)
  for the places that can only hold a string.
- **`parseRecordQueryState` is the exact inverse of `toRecordQueryParams`**, and lenient by design —
  rejecting bad input is the schema's job. The page (over `route.query`) and the records endpoint
  (over its validated params) both decode through it, so a link cannot decode two ways.
  `recordQueryKey` serializes the same params to a stable string, for watchers that must fire on a
  changed query rather than a changed object.
- **`claimFilterParams` resolves each param name to at most one field** — reserved names first, then
  fields in order — and `filterableFields` is the set that claimed at least one, which is what the
  drawer and the summary render from. Both halves read one `isReservedParam`. The param **claims**
  stay keyed by type: `scalar` and `list` claim the same single name and no multi-capable type is
  `range`, which is what keeps `filterParamNames` callable from `createField`, where only the type is
  known.
- **A multi-value field's schema is its type's own `base` lifted into `z.array`** — the type still
  says what one value is, cardinality says how many. `blank` becomes `[]`, `required` becomes "at
  least one", the cap is `MULTI_VALUE_MAX_ITEMS`, and duplicates are rejected rather than
  deduplicated (`decisions.md` → _Multi is a lifting of the single-value spec, not a second set of specs_). No type declares a second schema.
- **`buildRecordSchema` strips unknown keys, and required is enforced only where `blank` is `null`**,
  so a BOOLEAN's `false` counts as a value. `buildRecordQuerySchema` is a **loose** object, so its
  refinement can read filter params without widening the base ones.
- **`nameSchema` is the one rule for every user-visible name** (1–100 characters); tables and fields
  build on it so they cannot drift. `fieldInputSchema` is likewise one schema for client and server,
  judging `multiple` against `MULTI_VALUE_BY_TYPE` rather than a hardcoded type pair — whether a
  RELATION's target exists and is owned is a database question, so the server layers
  `requireFieldTarget` on top.
- **`TBadgeColor` is its own module rather than part of field metadata** — the closed badge palette
  is a design-system concept, so an atom can consume it without importing field types.
- **Every type in `FIELD_TYPES` is creatable**; there is no second, narrower list. `BOOLEAN_LABELS`
  is the single source for `Yes`/`No`, so a checkbox cannot say "Yes" in one place and "True" in
  another, and the `search` param borrows TEXT's own `TEXT_MAX_LENGTH`.

---

## 3. The field-type registries

A field type is **three modules and three registry lines** (`CLAUDE.md` §9), one per slice, because a single module holding all of it would drag `Prisma.Sql` into the browser bundle and `.vue` cells into the Nitro one. Each slice has one module per type and one assembler that is the only file enumerating the six; every map it exports is a total `Record<TFieldType, …>` literal, so a new type is a compile error until all three assemblers declare it.

| Slice                    | Per type                            | Assembler                                                                                                                     |
| ------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `shared/field-types/`    | `<type>.ts` — `IFieldTypeModule`    | `registry.ts` — `FIELD_TYPES` + `FIELD_TYPE_LABELS` · `MULTI_VALUE_BY_TYPE` · `FILTER_VALUE_BY_TYPE` · `VALUE_SCHEMA_BY_TYPE` |
| `server/db/field-types/` | `<type>.ts` — `IFieldSqlModule`     | `registry.ts` → `FIELD_SQL_BY_TYPE`, `MULTI_SQL`, `sqlFor`                                                                    |
| `app/field-types/`       | `<type>/index.ts` — `IAppFieldType` | `registry.ts` (below)                                                                                                         |

`app/field-types/` holds the entire per-field-type surface of the client, deliberately outside `~/components` so nothing there is globally registered — these are only ever reached through the assemblers. `registry.ts` exports `FIELD_INPUTS` (editing a record), `FIELD_FILTERS` (filtering), `FIELD_CELLS` (displaying), `FILTER_SUMMARIES` (how an active filter reads), `FIELD_TYPE_ICONS` (the glyph beside a type's word), `FIELD_CONFIG_SUMMARIES` (how a field's configuration reads), the private `MULTI_INPUTS` / `MULTI_FILTERS` / `MULTI_SUMMARIES`, and the resolvers `inputFor` / `filterFor` / `summaryFor`. `record-columns.ts` (`RECORD_COLUMNS`, §5) sits beside them and belongs to no type.

**Cardinality is the second axis, and it is a property of the field rather than of its type.** Each control registry keeps its flat per-type entries and gains a total `Record<TFieldType, X | null>` override table — `MULTI_INPUTS`, `MULTI_FILTERS`, `MULTI_SUMMARIES`, and `MULTI_SQL` on the server — plus one resolver every consumer calls instead of indexing:

| Registry      | Resolver                  | Consumer               |
| ------------- | ------------------------- | ---------------------- |
| `registry.ts` | `inputFor(field)`         | `DynamicForm`          |
| `registry.ts` | `filterFor(field)`        | `RecordsFilterPanel`   |
| `registry.ts` | `summaryFor(field)`       | `RecordsFilterSummary` |
| `registry.ts` | `cellComponent(column)`\* | `RecordFieldValue`     |

\* The three others sit in the file they resolve; `cellComponent` cannot, and lives in `cell-resolver.ts` — see below.

`null` means "this type has no list form", which `multiValue` in the shared module already refuses to configure — the two agree by construction. Because the override tables are total, a new field type still cannot ship without stating its position. The two halves sit in **different slices**, so nothing but a spec joins them (`CLAUDE.md` §10).

Only two entries are non-`null` anywhere: `MULTI_FILTERS` and `MULTI_SUMMARIES` leave **SELECT** `null`, because a SELECT filter has always been list-shaped, so nothing about filtering it changes when the stored value becomes a list.

**`FIELD_CONFIG_SUMMARIES` is the one control-adjacent registry with no `MULTI_*` counterpart**, and its `null` means something different from theirs: not "this type has no list form" but "this type is fully described by its own word" — TEXT configures nothing. Cardinality stays out of it because `isMultiValue(field)` already answers for every type, so the field manager renders that part itself rather than two components repeating it. That is also why callers index it directly instead of through a resolver: there is no override for one to consult. `FIELD_TYPE_ICONS` is a plain string map for the same reason — nothing about a glyph changes when a field is widened.

Multi-value **cells** need no override table at all. `cellComponent` returns one shared `MultiValueCell`, which renders each entry through `FIELD_CELLS[field.type]` — a list of values is the list of how each value renders, so a future multi-capable type is covered without a component of its own. It renders **inline** rather than as a flex row, which is load-bearing (`decisions.md` → _A table column's width cap lives on a wrapper, not on the cell_); nothing about the cell puts it on a line — `DynamicTable`'s `white-space: nowrap` does that, and `RecordDetail` simply does not impose it.

`cellComponent` lives in **`app/field-types/cell-resolver.ts`** alongside `readCellValue` — the two halves that read the registries. It is the one resolver not folded into the file it resolves, because `MultiValueCell` imports `FIELD_CELLS` back out of `registry.ts` and merging would make the two import each other (`decisions.md` → _`cellComponent` is the one resolver that does not live in its registry file_). **`registry.ts` must therefore never import `MultiValueCell`**; that component and the two record-column cells are what `cells/` still holds, since none of the three belongs to a field type.

It is paired with **`toValueList`** / **`toCellSingleValue`** (both `app/utils/record-value.ts`, since both are pure shape): whenever the first returns `MultiValueCell`, the value is `toValueList`, otherwise it is `toCellSingleValue`. `RecordFieldValue` branches on the same `isMultiValue` question to pick the pair. That is what lets each cell declare the exact shape it renders instead of the union of both — and `toValueList` is **the one place** a stored value that is not yet an array is accounted for (a row drawn before `updateField`'s migration ran). It sits outside the cell registry because the multi-value **form control** normalises through the same function.

`types.ts` defines the shapes the modules and both control tables share:

- `IAppFieldType<K>` — one type's whole client surface: `input`, `multiInput`, `filter`, `multiFilter`, `cell`, `summary`, `multiSummary`, `icon`, `configSummary`. Required-and-nullable keys, never optional, so a new type states its position on each axis.
- `IFieldControl<TValue>` — `component` + a `props(field)` factory + optional `toControl`/`fromControl` adapters.
- `TRecordFieldControl` = `Required<IFieldControl<TRecordValue>>`, since a record input always adapts (a DOM control speaks strings and checkboxes, never `TRecordValue`) — which is why `DynamicForm` never branches on an optional adapter.
- `TFilterSummary` + `IFilterSummaryContext` — a summariser and the one thing it may need beyond its value (only RELATION uses it, to resolve a linked record).
- `IFieldCellProps` — `field` + `value`. Its `value` is `TRecordSingleValue`, **not** `TRecordValue`: a per-type cell renders exactly one value, and `defineProps<T>()` compiles to a runtime prop check (`decisions.md` → _One value union, narrowed by shape_).
- `IMultiValueCellProps` — `field` + `value: string[]`, `MultiValueCell`'s own contract. A separate interface rather than a widening, because the two are opposites: it is the only cell taking a list, and every other cell is what it delegates each entry to.

Three fragment modules keep the per-type modules to their own wording: **`adapters.ts`** (`blankIsNull`, shared by every type whose blank control means "no value" rather than `''`; `listValue`, its list counterpart), **`prose.ts`** (`summariseRange`, `summariseList`, `summariseLinkedRecord`), and the server's **`fragments.ts`** — the projections (`jsonText`, `jsonArray`, the array guard), the comparators (`matchesPartially` / `matchesExactly` / `matchesAny` / `containsAny` / `withinRange`), the search predicates and `targetLabel` / `firstElement`. `record-sql.ts` keeps only what is not per-type: `RECORD_COLUMN_SQL` and the `buildRecord*` builders.

**Inputs.** TEXT/DATE/SELECT/RELATION share `blankIsNull`. NUMBER keeps a real parse, and unparseable text passes through so the schema reports "Enter a number". BOOLEAN maps to `BaseCheckbox`.

**Filters.** TEXT is a debounced, trimmed `BaseInput` (matching is always case-insensitive and partial); SELECT a **multiple** `BaseSelect` fed from the field's own metadata, whose model already _is_ the `string[]` filter value and so needs no adapters, marked `searchable` once the field has more choices than `shouldSearch()`'s threshold; NUMBER/DATE a `BaseRange` with its `type`; RELATION the same picker the form uses, so a filter offers exactly what a record can link to. Only BOOLEAN adds adapters, because the control speaks strings while its filter value is `boolean | null` (`null` = "All", carried by the _absence_ of a choice). **No control knows an operator** — the value is the whole contract.

Every "All" / "— Select —" is a **placeholder plus `clearable`**, never a synthetic blank option. The cleared value is still `''`, so the wire format did not move. Each type's own module writes its props once for both tables — the placeholder is the parameter, since "All" narrows a list where "— Select —" fills a field.

**Cells.** `{text,number,boolean,date,select,relation}/*FieldCell.vue` — one read-only cell per type, beside the module that names it. BOOLEAN renders an `mdi:check`/`mdi:minus` icon, SELECT a chip, NUMBER/DATE fixed `en-GB` `Intl` formats, RELATION the label the page resolved (or a muted "Unknown record"). Blank values never reach a cell — `DynamicTable` renders the `—` placeholder itself. `RecordNumberCell` and `TimestampCell` belong to `RECORD_COLUMNS` rather than to a field type, which is why they stay in `cells/` and are not named `*FieldCell`.

**`relation/RelationFieldSelect.vue`** is the only control that is a component rather than a registry row, because a relation's candidates are records of another table and no synchronous `props(field)` factory can produce them. One component serves both tables: `placeholder` is "— Select —" when editing and "All" when filtering. It renders **two `BaseSelect` branches** rather than binding a union model, because `multiple` is tied to that model's type by design; `multiple` comes from field metadata and is fixed for the control's lifetime, so the branch never swaps under the user. It is also the only control that fetches on **user input** — it hands `BaseSelect` a `loadOptions` that searches the target table server-side, plus `searchable` unconditionally (the cap is on the _seed_, so the option count says nothing about how many records exist). Everything the two branches agree on is bound once through a `selectProps` computed; only the model and `multiple` are per-branch. How one option row reads is its own component (`RelationOptionLabel`), because slot content compiles in the caller's scope and so cannot be hoisted alongside the props — and, like everything in `field-types/`, it must be **imported explicitly**. A linked record the seed list does not offer — beyond the cap, found through a search, or since deleted — is appended as its own option, so opening a form can never drop a link on save.

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

`queryColumns(fields)` returns them around a table's own fields in presentation order — `Record # | …fields… | Created at | Updated at` — and is applied wherever a **query** is built: the codec, the query schema, `buildRecordWhere`/`buildRecordOrderBy`, `DynamicTable`, `RecordsFilterPanel`, `RecordsFilterSummary`. It is **never** applied where record **data** is read or written (`buildRecordSchema`, `DynamicForm`, the field manager), since none of it is part of that data — which is what makes these columns generic and read-only.

Because they look like ordinary fields, the filter controls, the URL format, the badge count and "Clear all" all work on them unchanged. Only two registries know better:

- **`RECORD_COLUMN_SQL`** (`server/db/record-sql.ts`) — the projection, since these live outside `data`. Every entry declares both an `expr` and a `sortExpr`: the number **filters as text** (`4` matches `#4`, `#14`, `#42`) but **orders as an integer** (`#9` before `#10`); a timestamp **filters as `::date`**, so an inclusive `to` bound covers that whole day instead of stopping at its midnight, but **orders as a timestamp**, so two records made on one day still order by time.
- **`RECORD_COLUMNS`** (`app/field-types/record-columns.ts`) — where the value comes from (`record.number` / `record.createdAt` / `record.updatedAt`, never `record.data`) and which cell renders it. `DynamicTable` consults it first and falls through to `FIELD_CELLS`, so it never learns which columns exist.

Since `DEFAULT_SORT_KEY` is `createdAt`, the default view shows an active descending arrow on the Created at header — the table's default ordering is visible rather than implicit.

---

## 6. Relations

A RELATION field stores a target record's id, or — when `options.multiple` is set — a list of them. Its `options` carry `{ targetTableId, labelFieldKey, multiple }`: the table it points at (**immutable** — retargeting would orphan every stored id, so `updateField` rejects a change with 400), which of that table's fields a linked record reads as (**editable** — pure display), and its cardinality (**one-way** — widening migrates the existing rows in the same transaction, narrowing is a 400).

An id is not readable, so how a record reads is resolved server-side. **A relation reads as `#<number>` plus its label**, and the `#` is written only where the number is genuinely known — `formatLinkedRecord` and `BaseLinkedRecord`, both of which require one. `server/services/relations.ts` is the only module that knows what a RELATION means, which is what keeps `records.ts` generic. It applies `buildRecordLabel` in three places:

- **`RelationService.resolveLinkedRecords`** — runs after the record list and returns `IRecordPage.linkedRecords`, keyed by **field id** then by target record id (per field, because two relations may point at one table through different label fields). One `findMany` per distinct target table, never one per row. `RelationService.collectRelationTargets` normalises a stored value through `Array.isArray(v) ? v : [v]`, and that is the **whole** of what several links cost this module: everything below it already works in sets and batches.
- **`RelationService.assertRelationTargets`** — gates every record write: a value that does not resolve to a live record of its target table is a 400, so a crafted payload cannot store a dangling id.
- **`RelationService.listRelationOptions(field, search)`** — backs `GET /api/tables/[tableId]/fields/[fieldId]/options[?q=]`, capped at `RELATION_OPTIONS_LIMIT` and label-ascending. Scoped by the **source field**, so nothing about the target is taken from the client. `?q=` narrows via `buildRecordLabelSearch` — the label field plus the record's `#number` — leaving the ORDER BY untouched, so search and order stay independent. No `SEARCH_MIN_LENGTH` here (`decisions.md` → _Relation option search deliberately does not enforce `SEARCH_MIN_LENGTH`_); the bound is `max(100)` on the term. Note the order is by **label**, so the visible numbers are not ascending and blank-labelled records sort together at the end.

Client side, `app/stores/relations.ts` is the single home for both halves — `optionsByField` (a picker's candidates) and `linkedByField` (id → `ILinkedRecord`), both keyed by field id. `RelationFieldSelect` reads the options; `RelationFieldCell` reads the linked records. Both draw the pair through **`BaseLinkedRecord`**, the one component that writes a `#`; the picker reaches it through `BaseSelect`'s single slot (`decisions.md` → _`BaseSelect` has one slot, and it replaces an option's text rather than its row_), and each option's flat `label` stays `formatLinkedRecord`'s output so the trigger, the type-ahead and the accessible name all agree with the row.

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

`server/db/record-sql.ts` is the only SQL in the project: `buildRecordWhere(tableId, fields, filters)`, `buildRecordSearch(...)`, `buildRecordOrderBy(fields, sort)`. Raw because Prisma cannot `orderBy` a JSON path.

**One total map, `FIELD_SQL_BY_TYPE`**, gives each field type:

- `expr` — the JSONB projection a **filter** compares against (`::numeric`/`::boolean` casts; plain text for TEXT/DATE/SELECT/RELATION).
- `sortExpr` — how the column **orders**, when that differs from how it filters. RELATION is the only single-value type that declares one: a correlated subquery over the target's label field, because it filters on the stored id but orders by the label.
- `filter` — how its value compares: `matchesPartially` (`ILIKE` with escaped wildcards), `matchesExactly` (`=`), `withinRange` (inclusive `>=`/`<=` for whichever bounds are set), `matchesAny` (`IN (…)`).
- `searchPredicate(key, pattern)` — how free-text search matches it, or `null` to opt out. A whole **predicate**, not an expression the caller appends `ILIKE` to, and separate from `expr` for the reasons in `decisions.md`.

**`MULTI_SQL`** is the cardinality override, consulted by `sqlFor(field)` for a field whose `options.multiple` is set — the same lifting the validation layer applies, in SQL:

- `expr` is `data -> key` rather than `->>`, since `->>` on an array yields the literal `["a","b"]` and would match a filter on `[` or `","`.
- `filter` is `containsAny`: `jsonb_exists_any(expr, ARRAY[…]::text[])`. The **function form**, never the `?|` operator (`decisions.md` → _`jsonb_exists_any`, never the `?|` operator_). Like `IN (…)` it is self-parenthesising, it answers correctly for a bare scalar, and it is the one comparison in this layer that is **GIN-indexable**.
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

`Record.data` is keyed by `Field.key`, never by field id, so renaming a field never rewrites a single row. A **multi-value** field stores a JSON array under that key; widening a field is the one operation that does rewrite rows, in `updateField`'s own transaction (§10). `Table.recordCounter` is never exposed in `tableSelect`.

**No index covers a JSONB key**, and that is deliberate — `limitations.md` carries the reason, the ceiling it sets, its trigger, and the remedies that fit this query layer.

`prisma/migrations/` is the history. One of them is hand-written, because a required column over existing rows cannot be generated (`CLAUDE.md` §5, `decisions.md`).

---

## 10. Module map

Only the modules whose contract is not obvious from their name.

### `server/`

Three layers, dependencies pointing one way — `api` → `services` → `db` — with `utils/` cross-cutting (`CLAUDE.md` §3). `db/` is the only place a `select` shape, a row→domain mapper, the Prisma client or a `Prisma.Sql` fragment lives, which is what keeps a service readable as a rule rather than as a query.

- **`db/tables.ts`** · **`db/fields.ts`** · **`db/records.ts`** — the `select` shapes and the row→domain mappers. `toSharedField` is the one place Prisma's untyped `options` JSON is narrowed to `IField`; `toSharedRecord` the one place its JSONB `data` column is; `toJsonData` the one cast back. `tableListSelect` spreads `tableSelect` and adds the counts only the dashboard needs
- **`db/users.ts`** — `authUserSelect` (`id`, `email`) and `authUserWithHashSelect`, the only select that names the hash. `toAuthUser` is the one place it is dropped, so "a user row never leaves with its hash" is a property of one function rather than of every call site
- **`db/record-sql.ts`** — the SQL layer (§8): `RECORD_COLUMN_SQL` and the `buildRecord*` builders. Named for what it is: `shared/utils/record-query.ts` is the URL codec, and the two used to share a name
- **`db/field-types/`** — the per-type SQL rules the builders compose (§3). Inside `db/` because `Prisma.Sql` lives nowhere else
- **`db/prisma-errors.ts`** — `isUniqueViolation` / `isMissingRow`: what a Prisma fault **is**, never what it becomes. No `h3` here, and a lint rule keeps it that way
- **`utils/http-errors.ts`** — `toHttpError(error, { conflict?, notFound? })` — where that classification becomes a response: the shared `P2002` → 409 / `P2025` → 404 mapping every service raises through. **An absent message means "do not map this"**, so a service whose writes cannot raise a code carries no wording for it; anything unrecognised — or unmapped — passes through untouched and still surfaces as a 500
- **`utils/handler.ts`** — the four factories every table-scoped route is declared with, one per `require*` helper below: `defineTableHandler` (the table) · `defineFieldsHandler` (its fields + `tableId`) · `defineTableWithFieldsHandler` (both) · `defineRecordWriteHandler` (fields, non-empty). **The ownership check is what produces the context**, so a route cannot be written without it; each stays generic in its return type, so Nitro still infers what a route answers with. `[tableId].patch` and `[tableId].delete` use none of them on purpose — their services take a `userId` and scope on it in their own `where` clause (`decisions.md` → _Ownership is obtained, not remembered_)
- **`utils/ownership.ts`** — `requireOwnedTable` (single scoped query; 404 when missing or foreign) · `requireOwnedTableFields` (same plus the table's field metadata in one round trip — reads need it to resolve sort/filter params) · `requireOwnedTableWithFields` (the table itself plus its fields, for the record-detail read, which has to **name** a table the page it opened from is not about) · `requireRecordFields` (the same plus a 400 when the table has no fields — **writes only**, since a field-less table must still list an empty page) · `requireFieldTarget` (a RELATION may only point at an owned table, labelled by a field that table has)
- **`utils/auth.ts`** — bcrypt hash/verify, JWT sign/verify, `auth_token` cookie helpers, `requireUser`. `verifyAuthToken` pins `algorithms: ['HS256']`, so the token cannot choose its own
- **`utils/error-log.ts`** + **`utils/error-log-file.ts`** — the error sink, fed by **two sources**: `plugins/error-log.ts` off Nitro's `error` hook, and `api/client-errors.post.ts` off the browser. The first module is pure: `isLoggableServerError` (5xx and unclassified only), `readErrorLogRequest`, `buildErrorLogEntry` / `buildClientErrorLogEntry` (timestamp injected), `formatErrorLogLine` (NDJSON). One entry leads with `source` (`server` / `client`) and carries timestamp · statusCode · name · message · stack · method · path · query **names** · userId, and **nothing else is ever read** — not headers, not the body, not query values, not `error.data`, not the user's email. A client entry nulls the status, the method and the query names, cuts any query off the reported path, and takes its user id from the cookie rather than from the report. The second module owns `recordErrorEntry`, the one write path both sources go through; it appends to `logs/server-errors.log`, rotates at 5 MB over 5 generations, never throws, and switches itself off after a failure. Both contracts are in `decisions.md`
- **`utils/rate-limit.ts`** — a fixed-window counter with `now` injected and a bounded key map, so the guard cannot become the leak. One caller: the client-error endpoint
- **`utils/field-key.ts`** — `slugify` (a display name → `^[a-z0-9_]+$`, `field` when nothing survives) + `buildFieldKey(name, type, existing)`. A key must be free for **every query param it would claim**, not only for itself: a field called "Page" becomes `page_2`, "Budget from" becomes `budget_from_2` next to a NUMBER `budget`. Server-only — nothing in the Vue layer derives a key
- **`services/auth.ts`** — `AuthService`: `registerUser` · `authenticateUser` · `findAuthUser`, the three reads of the `User` model. Registration runs no uniqueness pre-check (`decisions.md`); both credential failures raise the same 401. The cookie and the JWT stay in the handlers, because a service takes no `H3Event`
- **`services/tables.ts`** — `TableService`: list/create/rename/delete scoped by `userId`. `deleteTable` refuses with 409 when another table's RELATION field targets it
- **`services/fields.ts`** — `FieldService`: list/create/update/delete scoped by `tableId`; derives `order` and the DB `options`, and takes the immutable `key` from `utils/field-key.ts`. Rejects type changes, RELATION retargeting, and narrowing a multi-value field (400 each); **widening** runs `widenToList` — one scoped, idempotent `UPDATE` — inside the same transaction as the metadata change
- **`services/records.ts`** — `RecordService`: paginated list (`$transaction` of two `$queryRaw`s sharing one WHERE fragment) + create/update/delete scoped by `tableId`. `data` is replaced wholesale on update; every write passes `RelationService.assertRelationTargets` first. `getRecordDetail` returns one record as `IRecordDetail` — an aggregate on purpose (`decisions.md` → _The detail endpoint returns an aggregate, not just the record_); a missing row is a 404
- **`api/tables/[tableId]/records/index.get.ts`** — validates with `buildRecordQuerySchema(fields)`, then composes `IRecordQuery` from `parseRecordQueryState(fields, params)` + the validated `pageSize` — **the schema judges, the codec decodes**

### `app/`

- **`api/`** — the transport layer. `client.ts` is the `useRequestFetch` seam, whose one job is keeping callers off bare `$fetch`; `paths.ts` is every route the client calls; and one `use*Api()` per resource returns a function per endpoint, typed from `#shared/types/api`. Each is a **factory** rather than plain functions because `useApi()` wraps `useRequestFetch()` and must be called during setup. They hold no state and no reactivity — that is what keeps them transport rather than a second store layer
- **`composables/useTableLoader.ts`** — the table and its fields, fetched together, which is what both table screens open with. It owns **neither the `useAsyncData` nor the error**: the two pages must key differently (a layout and a page must never share one) and the 404 is each page's own answer, so both stay at the call site
- **`composables/useForm.ts`** — form state keyed `Record<string, unknown>`; its dynamic key handling is what lets one composable drive metadata-generated forms
- **`composables/useDetailLink.ts`** — the route target that opens a record in the detail dialog, layered onto the current query. Every way in is this one function — a row's View action and a relation cell alike — and each appends to whatever chain it renders under, so a caller never has to know whether it is opening or drilling
- **`composables/useRecordDetail.ts`** — the one owner of the record-detail dialog: reads the `detail` chain off the route, fetches only its last entry (keyed on a **string**, never the ref object, which is fresh on every query change), feeds the labels to the relations store, and hands back the route targets for Back and Close. Every control it exposes is a navigation, not a state change
- **`composables/useRecordListQuery.ts`** — the records page's list query. Which action leaves a history entry is a contract: a sort or a page step **pushes**, a filter edit, a search or a clear **replaces**. A search term below `SEARCH_MIN_LENGTH` is dropped rather than sent, and an unchanged term does not navigate at all
- **`composables/useDeleteConfirm.ts`** — the confirm-then-delete flow every list page repeats. The target is cleared **only on success**, so a failed delete leaves the dialog open; a refused one renders its reason in the dialog rather than rethrowing (`decisions.md` → _`useDeleteConfirm` catches instead of re-throwing_)
- **`composables/useDebouncedModel.ts`** — a writable local `draft` of a `v-model` that writes back on a delay, re-synced when the model changes from outside, skipping the write when draft and model already agree. `delay: 0` writes through synchronously, which is what lets `BaseInput` use one code path for both
- **`composables/usePopover.ts`** — open state, outside-pointer dismissal and focus restore. `containerRef` (the outside-click boundary) and `triggerRef` (the focus-restore target) are **separate** refs. **Owns no Escape listener** — the caller handles it (`CLAUDE.md` §7, `decisions.md`)
- **`composables/useAnchoredPosition.ts`** — places a `position: fixed` panel against an anchor in viewport coordinates, flipping above when there is no room below (anchoring by `bottom`, so it grows upward with no second measurement). Reflows on `resize` and on `scroll` **captured at `window`**, which is what keeps a panel pinned inside a scroll container
- **`components/common/BaseSelect/useListboxNavigation.ts`** — the cursor into a listbox: `activeIndex`, arrow/page/Home/End movement that skips disabled options and never wraps, type-ahead, scroll-into-view, and the re-clamp when the visible list changes — keyed on option **values**, so a `props(field)` factory rebuilding its array does not move the highlight
- **`components/common/BaseSelect/useSelectOptions.ts`** — which options a `BaseSelect` shows and what state that list is in — local filtering, or debounced server search with abort + a monotonic request id so an out-of-order response is dropped rather than written. Stale-while-revalidating
- **`utils/format.ts`** — every `Intl` formatter in one place. Locales are hard-coded `en-GB` and `formatTimestamp` pins `timeZone: 'UTC'` (`decisions.md` → _Locales and time zones are hard-coded_). The prose date (`1 Jan 2026`) and the column date (`01 Jan 2026`) are two named constants, never one formatter reconfigured per call
- **`utils/api-error.ts`** — `getApiErrorMessage` reads Nitro's message off `FetchError.data`; `toPageError` asserts a cause only for a 404
- **`utils/safe-redirect.ts`** — `resolveSafeRedirect` restricts `?redirect` to internal paths
- **`stores/records.ts`** — **Every action takes the query params from the caller** — the store never mirrors them. `createRecord` returns the page the new record landed on and only refetches when that equals the current page. An edit refetches rather than splicing. State is cleared when `fetchRecords` is called for a different table. `fetchRecords` sets `failed` **and rethrows**
- **`stores/tables.ts`** — `loaded`/`failed` flags + `ensureTables()`, which **never throws** — it sets `failed` and the sidebar reports it inline with a Retry. Also owns `applyTableRow(row)`, the one way a cached row moves without a refetch — **`stores/records.ts` and `stores/fields.ts` are its only callers**, each passing back the row the write answered with. A row for a table the list does not hold is ignored rather than inserted
- **`stores/relations.ts`** — `loadOptions(tableId, fields)` fetches every relation field's candidates in parallel and makes no request at all for a table without relations. `searchOptions` never writes `optionsByField` (`decisions.md` → _`RelationFieldSelect` gets its `tableId` from the store, not from `IField`_)
- **`error.vue`** — the whole-app error boundary. Deliberately **store-free** — it has to render when data fetching is exactly what failed

### The renderers — `app/components/records/`

- **`DynamicForm.vue`** — renders a form from `IField[]` by walking `FIELD_INPUTS`: `v-bind`s each entry's `props(field)`, passes the value through `toControl`, pushes what the control emits back through `fromControl`. Values flow down as props and changes back up via `update: [key, value]`, so **the parent's `useForm` object is never mutated**.
- **`DynamicTable.vue`** — renders from `queryColumns(fields)` + `IRecord[]`, so **one** `columns` list drives header and body alike. Each cell is a `RecordFieldValue`. No branch on a key or a type anywhere in the template. Emits `edit`/`delete`/`sort`; the optional `sort` prop drives `aria-sort` and the header arrow. The row's **View** action emits nothing — it is a `<NuxtLink>` through `useDetailLink`, which is why the component takes a `tableId` prop: a generic renderer must not read that off the route itself.
- **`RecordFieldValue.vue`** — one column of one record: `Not set`, or the cell component for that column, resolved through `app/field-types/cell-resolver.ts` (`readCellValue` reads `RECORD_COLUMNS` first and falls through to `record.data`; `cellComponent` likewise falls through to `FIELD_CELLS`). The seam that keeps the table and the detail dialog rendering a value the same way. An **empty array is blank** alongside `null` — without that a cleared multi-value field would render as nothing rather than say so.
- **`RecordDetail.vue`** — the detail dialog's body: a `<dl>` over `queryColumns(fields)`, minus the record number (which names the dialog in its own heading). Values wrap instead of truncating — reading one in full is the point of the dialog. It does that by **not** declaring the table's `white-space: nowrap`, not by overriding a cell.
- **`RecordsFilterPanel.vue`** — the filter drawer. One control per `queryColumns(fields)` entry from `FIELD_FILTERS`, bound to `filters[field.key]` falling back to the type's empty value. Rebuilt **in field order** rather than patched per key, so a shared URL is stable whichever control was touched, dropping anything `isFilterValueEmpty`.
- **`RecordsTableSkeleton.vue`** — the body's third state, standing where the rows will be while a fetch is in flight with none to show. A `role="status"` naming itself through `.visually-hidden`, over `aria-hidden` bars. Its row and bar counts are **fixed constants**, never derived from `fields`: mid-navigation those still belong to the table being left, and this is a placeholder rather than a preview of what is coming.
- **`RecordsFilterSummary.vue`** — the active filters stated **above** the data. Iterates `queryColumns(fields)` and looks each key up in the filter map — never `Object.entries(filters)`, which would surface a key with no field to pair it with — so chip order matches the drawer and the URL.

### `app/components/fields/`

Surfaces that render field **metadata** rather than records, which is what keeps them out of the
directory above.

- **`TableFieldList.vue`** — the settings page's field rows: type, configuration and key per row, so a table's shape reads without opening a dialog per field. Nothing branches on a type — the word, the glyph and the configuration line all come from registries, the cardinality from `isMultiValue`. It emits `create`/`edit`/`delete`; the section heading, the count and the primary "Add field" stay on the page, because `.section-head` is shared with the Table section above it.

### The two table pages

Both open with **`useTableLoader`** (above), under their own keys — `table-…` and `table-records-…`.

**On the records page the URL query is the single source of truth** for filter/sort/page. `queryState` is `parseRecordQueryState(fields, route.query)` — page, sort and filters in one shot, so the page parses nothing itself. Every control writes back through `useRecordListQuery`, and one watcher refetches — keyed on `recordQueryKey(queryState)` rather than on `queryState` itself, because that computed is a fresh object whenever **any** param moves and the list must not refetch because a dialog opened. Records and relation options are fetched **after** the loader resolves, in parallel with each other — filters decode against field metadata, so a shared filter URL would otherwise render unfiltered on first paint.

---

## 11. Browser regression checklist

**Playwright owns this list, bar the clauses badged otherwise.** `test/e2e/` automates it against the production build in Chromium (`npm run test:e2e`, and its own CI job). Keep the list current: it is the index of what `test/e2e/` is for, and a behaviour added here without a spec is a gap that will not announce itself.

Two badges appear below, and both mean the line is inventory but another suite is what would catch it:

- **_(integration)_** — SQL semantics: a cast, a projection, an opt-out. A browser cannot answer them any better than a database round trip can, so they are proved in `server/db/record-sql.integration.spec.ts`.
- **_(unit)_** — logic a component spec pins in milliseconds. Where a keyboard cursor _lands_ is decided by the same code whatever renders it; only whether it is _painted_ needs a browser.

**Four lines are approximated rather than proven** — hydration mismatches, a focus ring not clipped by its cell, Backspace held down, and a multi-value cell's ellipsis. Each spec says so where it sits, and `limitations.md` carries the reason.

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
- **The mobile shell** (375×812): the sidebar is `visibility: hidden` until opened, so nothing inside it is reachable; the toggle tracks `aria-expanded`; the open panel is flush with the top of the viewport and as tall as it; navigating or clicking the scrim dismisses it, and so does Escape — but a dialog opened from inside the panel takes the first press on its own, and the panel closes on the second; the records table scrolls inside its own container rather than making the page scroll sideways; a dialog fits the viewport on **both** axes, and one with more content than the screen holds caps its height and scrolls its body — the title stays on screen and the submit button is reached by scrolling.
