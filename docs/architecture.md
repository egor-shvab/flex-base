# Architecture

How the metadata layer works — the contracts a reader cannot see from a module's name. Rules live in
`CLAUDE.md`, rationale in `decisions.md`, the SCSS layer in `styling.md`.

---

## 1. Auth

Manual: bcrypt + `jsonwebtoken`, no auth library. The JWT (`{ sub: userId, ver }`, HS256, 7 days)
lives in an httpOnly `auth_token` cookie; `verifyAuthToken` pins `algorithms: ['HS256']`. **`ver` is
`User.sessionVersion` at sign-in, matched in `findAuthUser`'s `where`**; logout raises it, so every
token the user holds stops passing at once — on every device, the price of one counter instead of
a session table. A token without `ver` is refused.
`server/middleware/auth.ts` **never rejects** — handlers call `requireUser(event)` for the 401.
`server/middleware/body-limit.ts` refuses an `/api/` body over 1 MiB (413) or without a declared
length (411) from its headers alone, before any handler reads it.
`app/middleware/auth.global.ts` leaves `/ui-test` open (fixtures only). **Only a 401 from
`/api/auth/me` means signed out**; any other failure is a fatal page error and leaves the auth store
uninitialised, so the next navigation asks again. Logout ends in `reloadNuxtApp`, so no store keeps
the previous session's data.

**Access is never in the token.** Membership and the role's permissions are read from the database
on every request (`requireMembership`), so a removed member or a narrowed role takes effect on the
next one. A workspace the caller is not in is a 404, a permission they lack a 403; the owner
(`Workspace.ownerId`) passes every check, and only they delete or hand over the workspace. The
anti-escalation rules — no role, member or invitation beyond the actor's own permissions, never the
owner's membership or one's own — are one set of functions in `shared/utils/permissions.ts`, read
by the services to refuse and by the client to hide. **The role a decision read is repeated in the
write's `where`** — a member's `roleId` and that role's permissions, a role's own permissions — so a
change between check and write writes nothing and answers 409 (`buildChangedMeanwhileError`).

---

## 2. The `shared/` layers

`types/` may `import type` a constant to derive from it. Contracts not visible from a name:

- **`TRecordFilterValues` is the filter model of every layer** — typed values keyed by `Field.key`,
  sparse (an absent key is unfiltered). **One value is translated on the way to SQL, and only one:**
  a RELATION filter's address becomes the stored id (§8).
- **`buildRecordLabel` returns `null`** for a record with nothing to name it by, never `#<number>`;
  a stored list degrades to its values joined. `formatLinkedRecord` writes the flat form
  (`#3 Example`).
- **`address.ts` is the one place a URL segment becomes a row's number.** `parseAddressNumber`
  answers `0` (a value no row holds) for anything that is not a bounded positive integer, so a
  malformed address 404s rather than reaching Prisma as `NaN`; `parseTableAddress` also ignores a
  `-…` suffix. Page and server read the same function.
- **`buildFilterParamClaims` resolves each param name to at most one field** — reserved names
  first, then fields in order. `toFilterableFields` / `toFilterableColumns` are the fields that
  claimed one; the drawer and the summary both render from them. Claims are keyed by type, which
  keeps `toFilterParamNames` callable from `createField`.
- **A multi-value field's schema is its type's `base` lifted into `z.array`** — `blank` → `[]`,
  required → at least one, capped at `MULTI_VALUE_MAX_ITEMS`.
- **`buildRecordSchema` strips unknown keys and enforces required only where `blank` is `null`**, so
  a BOOLEAN `false` is a value. `buildRecordQuerySchema` is a **loose** object so its refinement can
  read filter params.
- **`nameSchema` is the one rule for every user-visible name** (1–100 chars). `fieldInputSchema`
  judges `multiple` against `MULTI_VALUE_BY_TYPE`; whether a RELATION target exists and is owned is
  the server's `requireFieldTarget`.
- **`TBadgeColor` is its own module** so an atom can consume the palette without importing field
  types.

---

## 3. The field-type registries

Three slices — `shared/field-types/` (`IFieldTypeModule`), `server/db/field-types/`
(`IFieldSqlModule`), `app/field-types/` (`IAppFieldType`) — each with one module per type and a
`registry.ts` that is the only file enumerating the types (`CLAUDE.md` §9; why: `decisions.md` → _A
field type is three modules, one per slice, and the bundler is why_). `app/field-types/` sits
outside `~/components`, so nothing in it is globally registered — import it explicitly.

**Indexability** — `filterIndex` / `sortIndex` (`'btree' | 'trigram' | 'gin' | null`) sit on the SQL
_rules_, not the module, so `sqlFor` resolves cardinality for free (a widened SELECT filters through
a GIN where the single one uses a B-tree). The kind follows how the type **compares**; `sortIndex`
is `null` for RELATION, which orders by a value in another row.

**Cardinality** — each control registry has a total `MULTI_*` override (`X | null`) and one resolver
every consumer calls instead of indexing. `null` means "no list form", which `canBeMultiValue` already
refuses to configure. `MULTI_FILTERS` and `MULTI_SUMMARIES` leave SELECT `null` because a SELECT
filter is list-shaped already. `FIELD_CONFIG_SUMMARIES` has no override and its `null` means
"described by its own word" (TEXT); callers index it directly.

**Cells** — `cellComponent` and `readCellValue` live in **`cell-resolver.ts`**, consulting
`RECORD_COLUMNS` first (§5) and falling through to `FIELD_CELLS`. A multi-value field always gets
the shared `MultiValueCell`, which renders each entry through `FIELD_CELLS` — no per-type multi cell
exists. **`registry.ts` must never import `MultiValueCell`** (`decisions.md` → _`cellComponent` is
the one resolver that does not live in its registry file_). The value handed to a cell is
`toValueList` for `MultiValueCell` and `toCellSingleValue` otherwise (`app/utils/value-shape.ts`);
`toValueList` is **the one place** a not-yet-migrated scalar is tolerated, and the multi-value form
control normalises through it too. `IFieldCellProps.value` is `TRecordSingleValue` (`decisions.md` →
_One value union, narrowed by shape — and a prop type is a runtime contract_).

**Controls** — `TRecordFieldControl` is `Required<IFieldControl<TRecordValue>>` because a record
input always adapts, so `RecordForm` never branches on an adapter. Fragment modules hold what a type
composes — `adapters.ts`, `prose.ts`, and the server's `fragments.ts`; `record-sql.ts` keeps only
what does not vary per type. Every "All" / "— Select —" is a placeholder plus `clearable`; the
cleared value is still `''`.

**`relation/RelationFieldSelect.vue`** is the one control that is a component: its candidates are
another table's records. It serves form and filter (`valueBy`: a record input speaks ids, a filter
speaks numbers), renders **two `BaseSelect` branches** because `multiple` is tied to the model's
type, is always `searchable` with a server-side `loadOptions`, and appends a linked record the seed
does not offer so saving a form never drops a link.

---

## 4. Record identity

- **`Record.id`** — a cuid; what relations reference inside `data` (no foreign key), so stable and
  unguessable.
- **`Record.number`** — sequential **per table** (`@@unique([tableId, number])`); what a URL
  addresses and a user reads.

`Table.id` / `Table.number` are the same pair one level up, per workspace. A number is allocated
from the parent's counter (`Table.recordCounter`, `Workspace.tableCounter`) inside the insert's
transaction —
Prisma's atomic `increment` takes the row lock, so concurrent creates queue. The counter is a
**high-water mark**: a deleted row's number is never reused. (Why: `decisions.md` → _Public numbers
address, cuids reference_.)

**A route names a row by either form**, through `buildTableAddressWhere` (`server/db/tables.ts`)
and `buildRecordAddressWhere` (`server/db/records.ts`): an address that parses resolves on the
compound unique, anything else parses to `0` and resolves on `{ id }`. `buildTableAddressWhere`
scopes the workspace; `buildRecordAddressWhere` scopes the table, because a handler factory has
already proved the table is in the caller's workspace. **Only a route carries an address:** `requireFieldTarget` refuses a body `targetTableId` that parses as an
address, or `4` would be stored as a target nothing matches and `assertNotRelationTarget` would stop
guarding it.

**A workspace is addressed only by its `publicId`** — ten random `[a-z0-9]` characters, with no
number form and no id form. `parseWorkspaceAddress` answers `''` for anything else, which matches no
row, so a malformed address is the same 404 as a foreign one. `User.lastWorkspaceId` is written by
`PUT …/visit`, never by a read.

Invisible until they break:

- The ownership helpers return the **resolved** `tableId`; every route builds its `where` from that,
  never from the address it was given.
- **`deleteTable` resolves before it guards** — `assertNotRelationTarget` compares stored cuids, so
  an unresolved address passes the guard and cascades a table relations still point at.

---

## 5. Record columns

`Record #`, `Created at`, `Updated at` appear on every table and behave like fields in a query.
`buildRecordColumn()` builds each as an `IField` under a reserved **camelCase** key, a shape
`slugify` cannot emit (`RESERVED_FIELD_KEYS` states it). `buildQueryColumns(fields)` wraps the
table's fields in them **only where a query is built** (codec, query schema, SQL builders,
`RecordsTable`, filter panel and summary) — **never** where record data is read or written
(`buildRecordSchema`, `RecordForm`, the field manager). Special-casing them per layer instead would be five branches to
forget one.

Only two registries know better:

- **`RECORD_COLUMN_SQL`** (`record-sql.ts`) — every entry declares `expr` and `sortExpr`: the number
  **filters as text** (`4` matches `#14`) but **orders as an integer**; a timestamp **filters as
  `::date`** (an inclusive `to` covers the whole day) but **orders as a timestamp**.
- **`RECORD_COLUMNS`** (`cell-resolver.ts`) — reads `record.number` / `createdAt` / `updatedAt`,
  never `record.data`.

`DEFAULT_SORT_KEY` is `createdAt`, so the default view shows a descending arrow on Created at.

---

## 6. Relations

`options` = `{ targetTableId, labelFieldKey, multiple }`: the target is **immutable** (`updateField`
400s — retargeting would orphan every stored id), the label field is editable, and **only a field
`canLabelRecords` accepts can be it** — not a relation (it would read as an id), not a list; the form
offers only those and `requireFieldTarget` refuses the rest. Cardinality is one-way
(`decisions.md` → _Cardinality is one-way, and a multi-value column sorts by its first value_).

`server/services/relations.ts` is the only module that knows what a RELATION means, which keeps
`records.ts` generic:

- **`resolveLinkedRecords`** — after the list, returns `IRecordPage.linkedRecords` keyed by **field
  id** then target id; one query per distinct target table **and label field**, projecting only
  `data -> labelFieldKey`, never the whole row. The list also passes its **resolved filter**, so a
  filter chip has its record's label even when no row on the page links to it.
- **`assertRelationTargets`** — gates every write: a value that is not a live record of its target
  table is a 400, and so is a **new** link past the caller's read scope on the target (one already
  stored stays, or a record someone else linked onwards could not be saved).
- **`resolveFilterTargets`** — swaps filter addresses for ids before the WHERE is built;
  **unresolved values pass through unchanged** (`decisions.md` → _A relation filter is resolved from
  numbers to ids before the SQL sees it_).
- **`listRelationOptions(field, reach, search)`** — scoped by the **source field** and, under an
  `OWN` read of the target, to the caller's records there; capped at
  `RELATION_OPTIONS_LIMIT`, label-ascending (so numbers are not ascending, blank labels last). `?q=`
  matches the label or `#number` and leaves the ordering alone.

**A link is seen through the caller's access to its target** (`toFieldView`, in the table lookup):
a target they may not read hides the field; a hidden label field, or a target read only in part,
drops `labelFieldKey` from the field they are handed, so labels, the label sort join and the
picker's search all fall back to record numbers without knowing why.

Client side, `app/stores/relations.ts` keeps `linkedByFieldNumber` beside `linkedByField`, keyed the
way a filter addresses. `RelationFieldCell` takes the target table's **number** from the tables
store (a relation stores a cuid, a link needs an address); an unresolvable one degrades to text. A
resolved reference is a `<NuxtLink>` appending to the `detail` chain (§7) — the same cell in table
and dialog, so nested relations drill without knowing where they render. A deleted target is a
dashed `<span>` with no `#`.

---

## 7. Wire formats

### Filters

```
?company=acme&stage=Won&stage=Lost&active=true&contract_value_from=1000&contract_value_to=5000
```

- A **scalar** (TEXT, BOOLEAN, single RELATION) takes the bare key; a **list** (SELECT, any
  multi-value field) repeats the key once per value; a **range** (NUMBER, DATE) uses `_from` /
  `_to`. **A multi-value field always filters as a list** (`filterShapeFor`).
- Record columns share the namespace: `?recordNumber=4`, `?createdAt_from=…`; all three are `?sort=`
  keys.
- A RELATION carries the target's **number**; an older link's cuid still resolves server-side.
- Comparison is the field type's business and never travels (no operators). Filters are ANDed;
  values within one list are ORed, capped at `FILTER_VALUES_MAX`, deduped and sorted.
- A repeated param is a 400 for every shape but `list`. An empty value means unfiltered. Unknown
  params are ignored; a malformed known one is a 400. A reserved name is never a filter in either
  direction (`decisions.md` → _The query schema validates; the codec decodes_).

### The open record

```
?detail=<table>.<record>,<table>.<record>
```

Reserved, owned by the **page**, never sent to the list API. Outermost first; each half is an
address (number or legacy cuid) passed as-is to
`GET /api/workspaces/:workspace/tables/:table/records/:record`, under the page's own workspace. Only the
**last** entry is fetched — the rest is the trail Back walks. Decoded leniently: a malformed entry
ends the chain. `toRecordQueryParams` emits list params only, so any list navigation closes the
dialog.

### Search

Reserved `?search=`, ANDed with the filters, ORed across the table's searchable columns — the only
OR in the query layer. Min length `SEARCH_MIN_LENGTH` (3) in the schema; the client drops a shorter
term. Blank-after-trim is absent (`decisions.md` → _Search is an indexed pre-filter in front of the
exact predicates, not a replacement for them_).

---

## 8. The query layer

`server/db/record-sql.ts` is the only SQL: `buildRecordWhere`, `buildRecordSearch`,
`buildRecordOrderBy` — raw because Prisma cannot `orderBy` a JSON path. Per type,
`FIELD_SQL_BY_TYPE` gives:

- `expr` — the JSONB projection a **filter** compares; NUMBER and BOOLEAN cast through `jsonCast`,
  which reads a value of any other JSON type as NULL rather than raising;
- `sortExpr` — how it **orders**, where that differs;
- `sortJoin` — ordering by a value in **another row** (RELATION only); it beats `sortExpr`, and
  `buildRecordOrderBy` hands the join back (`IRecordOrder`) because only the caller owns `FROM`;
- `filter` — `matchesPartially` (`ILIKE`, escaped wildcards), `matchesExactly`, `withinRange`
  (inclusive), `matchesAny` (`IN`);
- `searchPredicate` — a whole predicate, or `null` to opt out.

`MULTI_SQL` (via `sqlFor`) lifts that for a multi-value field: `expr` is `data -> key` (`->>` on an
array would match `[` or `","`); `filter` is `containsAny`, `(expr ?| ARRAY[…])`, parenthesised and
GIN-indexable on the sub-path; `sortExpr` is the **first** element; `searchPredicate` is an `EXISTS`
over `jsonb_array_elements_text` for SELECT and `null` for RELATION. `RECORD_COLUMN_SQL` is
consulted before either map.

> **The `jsonb_typeof(…) = 'array'` guard inside that `EXISTS` is load-bearing.** On a scalar (a row
> written before the widening, or JSON `null`) `jsonb_array_elements_text` raises, and the error
> takes down the **whole list query**.

> **`buildRecordSearch`'s parentheses are load-bearing.** `withinRange` returns a bare
> `a >= x AND a <= y`; an unparenthesised OR group would bind to its last bound and silently widen
> it.

`buildRecordWhere` opens with `"tableId"` and, for a caller reading only their own records,
`"createdById"` (`IRecordReader`), so no filter or search can reach past either. It walks the
table's **fields**, so a key the table does not own compares against nothing. Search adds an indexed **pre-filter** — `record_search_text(data, "number") ILIKE …` on
`Record_search_trgm_idx` — in front of the exact OR group; the flatten must be a **superset** of
what any type searches, and expression and index must stay byte-identical. `listRecords` composes
one statement, searching or not. The count runs as `SELECT 1 … LIMIT RECORD_COUNT_CAP + 1` over the
same WHERE, reported as `IRecordPage.totalCapped`. Keys and values are bound parameters; keys are
`::text`-cast to pick the `->>` overload. Ordering falls back to `"createdAt"`, `"number"`; an
explicit sort puts blanks `NULLS LAST` and breaks ties on `"createdAt" DESC, "number" DESC`.
**`"number"` is the tie-break that makes paging stable** — unique per table, where `"createdAt"`
is not (a bulk insert shares one timestamp) — and every B-tree that serves an order ends on it.

---

## 9. Data model

`prisma/schema.prisma`; the `datasource` has no inline `url` (Prisma 7 reads it via
`prisma.config.ts`). **A table belongs to one workspace (`Table.workspaceId`)** — fields and
records reach it through their table, and every relation cascades. Access is membership
(`WorkspaceMember`) plus the member's role (`WorkspaceRole.permissions`), whose key carries the
workspace (`(workspaceId, roleId)`), so a member cannot hold another workspace's role; the owner
(`Workspace.ownerId`) holds every permission and is also a member — transfer keeps the old owner
under their role, and the owner cannot leave. An invitation (`WorkspaceInvitation`, one per
workspace and lowercased email) holds its role by the same compound key, so a role still held by a
member or an invitation cannot be deleted (409). `Record.data` is keyed by **`Field.key`**
(immutable), so renaming a field rewrites nothing; a multi-value field stores a JSON array.
Widening and deleting a field are the two operations that rewrite rows. **A delete clears the key
from its table's records in the same transaction** — a freed key goes to the next field of that
name, whatever its type, which would inherit the old values or fail to cast them. It is refused
(409) while a RELATION shows the field as its label (`RelationService.assertNotRelationTarget`).
`Table.recordCounter` is never in `tableSelect`; `Table.recordCount` reaches the wire as
`_count.records` (`decisions.md` → _The count is bounded, and Next does not read the page count_),
`null` for a caller who reads only some of the table's records (`canCountRecords`).

**One index covers `data` for every table:** `Record_search_trgm_idx`, a `gin_trgm_ops` GIN over
`record_search_text(data, "number")`. It, the function and the `pg_trgm` extension are hand-written
in a migration; Prisma cannot express them and ignores them (`migrate diff` reports nothing).

**Per-field indexes are opt-in** (`Field.indexed`); `server/db/field-indexes.ts` owns the wanted set
(from `filterIndex`/`sortIndex`), the DDL, creation, dropping and reaping. Six rules not guessable
from the code:

- **Each index is partial on its field's table** (`WHERE "tableId" = '…'`). PostgreSQL evaluates an
  index expression for every row the index covers, so one over all of `"Record"` would cast another
  workspace's value under the same key and fail that write.
- **A built index is stamped with `INDEX_SHAPE`** (its comment); one without the current stamp
  counts as invalid and is rebuilt. Names cannot tell an older shape apart, so **any change to the
  DDL or an index expression bumps the stamp**, or existing indexes keep the old shape for good.
- **Sorting needs one index per direction.** Order is always `NULLS LAST`; a B-tree read backwards
  gives `DESC NULLS FIRST`, which PostgreSQL will not use. `_sa` and `_sd` are separate; `_f`
  doubles as `_sa` when the filter is an ascending B-tree on the same expression.
- **Names come from `Field.id`.** A key can reach ~100 characters and PostgreSQL truncates
  identifiers past 63 bytes **silently**, so key-based names could collide.
- **The DDL inlines the key where the query binds it** (DDL takes no parameters). They still match
  because an unnamed prepared statement is planned at Bind; only the plan assertions in
  `field-indexes.integration.spec.ts` keep the two generators in step.
- **DDL runs `CONCURRENTLY`, fired and not awaited**; a failure reaches the error log, never the
  caller (`limitations.md`).
- **No cascade reaches an index.** A delete that takes fields with it (a table, a workspace) lists
  the indexed ones first (`listIndexedFieldIds`) and drops their indexes once the rows are gone, or
  each orphan stays on `"Record"` and is maintained on every write.

**`server/plugins/field-indexes.ts` reconciles once at start-up**, not awaited: it is the only repair
for an index built to an older `INDEX_SHAPE`, a failed build, or a sync the process did not live to
finish. While running, one field's DDL is queued per `field.id` in `FieldService`, so overlapping
edits end on the last saved state. Reconcile reports a **reaped** index (failed build, still wanted)
apart from a **dropped** one. `listFieldIndexStats()` is exported and tested with **no caller**.

---

## 10. Module contracts

Only what the name and the code do not say.

### `server/`

- **`db/{tables,fields,records}.ts`** — `toSharedField` is the one place `options` JSON is narrowed,
  `toSharedRecord` the one place `data` is — **projected to the fields it is given, the caller's
  visible ones**, so a hidden value never leaves — and `toJsonData` the one cast back.
- **`db/users.ts`** — `authUserWithHashSelect` is the only select naming the hash, and `toAuthUser`
  the one place it is dropped.
- **`utils/http-errors.ts`** — `toHttpError(error, { conflict?, inUse?, notFound? })` maps `P2002`
  and `P2003` → 409 and `P2025` → 404. **An absent message means "do not map this"**; anything
  unmapped still surfaces as a 500 — so `inUse` goes only on a delete, where a foreign key refusing
  it means the row is still referenced.
- **`utils/workspace-access.ts`** — `requireMembership` resolves the caller's membership from their
  id and the workspace address in **one** query (not a member → 404); `assertAccess` turns a
  missing permission — or `OWNER`, which no role grants — into a 403. Every workspace route reaches both through a factory in
  `utils/handler.ts`, which checks the permission **before** looking up the table.
- **`utils/table-access.ts`** — the table helpers take the membership and read the role's rows
  for the table and its fields in the same query. A field-scoped context carries the **visible**
  `fields` (a hidden one is absent, so validation, filters, sort, search and responses never see
  it), the `editableFields` a write's schema is built from — `GET /fields` names the rest as
  `readOnlyFieldIds` — and each link target's read scope.
  `assertTableHasFields` adds a 400 for a field-less table on **writes only** (a field-less table
  must still list an empty page); `requireWorkspaceTableWithFields` exists for the record-detail
  read, which names a table other than the page's.
- **`utils/error-log.ts`** — an entry is `source` · timestamp · statusCode · name · message · stack ·
  method · path · query **names** · userId and **nothing else**; a client entry nulls status,
  method and query names. `recordErrorEntry` (`error-log-file.ts`) never throws and disables itself
  after a failure, saying so **once on stderr** — path and error code only, never an entry. Rationale: `decisions.md` → _Server errors are recorded from Nitro's `error`
  hook, and only the 5xx ones_.
- **`utils/rate-limit.ts`** — a bounded key map, so the guard cannot become the leak; when full it
  sheds its **oldest** window, since clearing would reset every throttled caller at once. Sign-in is
  limited per address and per lower-cased email, registration per address.
- **`utils/field-key.ts`** — `buildFieldKey` frees a key for **every query param it would claim**:
  "Page" → `page_2`, "Budget from" → `budget_from_2` beside a NUMBER `budget`. Server-only.
- **`services/fields.ts`** — rejects type changes, retargeting and narrowing (400); widening runs
  `widenToList` in the metadata change's transaction.
- **`services/roles.ts`** — every anti-escalation decision reads its ground in two queries
  (the workspace's tables and fields, and the roles in question with their rows) and asks
  `isAccessWithin`. A write resting on it repeats the role's **`updatedAt`** as read, which
  replacing a role's access moves: a role changed under the check is a 409, a stale `If-Match` a 412. `PUT …/roles/:roleId/access` replaces the defaults and every row in one transaction, the
  guarded role update first.
- **`services/records.ts`** — an update **merges** the caller's writable fields over the stored
  `data` (`buildRecordMergeUpdate`), so every other key keeps its value
  (`decisions.md` → _A record update merges over the stored data_).
- **`services/invitations.ts`** — sending to an address already invited **renews** that row (role,
  inviter, a new expiry); whether the address has an account is never read, so the answer cannot
  tell. Accepting **deletes the invitation before creating the membership** in one transaction: a
  second accept racing it waits on the row and finds it gone (404). **An invitation is only as good
  as its sender's authority at accept time**: a sender who left, or whose access no longer
  holds the role it grants (`RoleService.getRoleReach`), makes it 404 and it is dropped. The rate limit lives in the `POST` handler,
  keyed on the inviter.
- **`api/workspaces/[workspaceAddress]/tables/[tableAddress]/records/index.get.ts`** — validates
  with
  `buildRecordQuerySchema(fields)`, then decodes with `parseRecordQueryState`.

### `app/`

- **`api/`** — factories because `useApi()` wraps `useRequestFetch()` and must run during setup. No
  state and no reactivity, which keeps them transport.
- **`composables/useTableLoader.ts`** — fetches table + fields for both table pages but owns
  **neither the `useAsyncData` key nor the 404**; each page keeps both (`table-…`,
  `table-records-…`).
- **`composables/useRecordListQuery.ts`** — **a sort or a page step pushes history; a filter edit,
  search or clear replaces.** An unchanged term does not navigate.
- **`composables/useRecordDetail.ts`** / **`useDetailLink.ts`** — the dialog's only owner: reads
  `detail`, fetches its last entry keyed on a **string** (the query ref is a fresh object on every
  change), and exposes navigations, not state.
- **`composables/useServerAction.ts`** — a user-started write: pending flag, the server's message,
  and the refusal handed to `useAccessResync`. **It catches, never rethrows** — `run` binds to an
  event, where a rejection goes unhandled. `useForm` and `useDeleteConfirm` are built on it.
- **`composables/useDeleteConfirm.ts`** — clears the target **only on success**; a refusal renders
  in the dialog.
- **`composables/useActiveWorkspace.ts`** — the one place a component asks what the caller may do
  (`hasPermission`, `isOwner`), answered from the membership in the workspaces store, which the
  parent page loads during SSR — so a hidden control is hidden on both sides of hydration.
  **Unknown is "no"**: a control appears once allowed, never flickers away.
- **`composables/useAccessResync.ts`** — every failure inside a workspace passes through it:
  `useServerAction` hands it each refused write, the loaders throw through
  `throwPageError`. A 403 refetches the membership, so the narrowed role's controls disappear; a
  workspace 404 drops the workspace from the store before the error page, or `/` would send the
  caller straight back to it.
- **`composables/usePopover.ts`** — `containerRef` (outside-click boundary) and `triggerRef`
  (focus-restore target) are separate. **`useAnchoredPosition.ts`** — flips
  above by anchoring `bottom`, reflows on `scroll` **captured at `window`**.
- **`composables/useMenuNavigation.ts`** — a `role="menu"` panel's roving focus, which **wraps**,
  unlike a listbox's cursor.
- **`components/ui/BaseSelect/useListboxNavigation.ts`** — the cursor never wraps and is keyed
  on option **values**, so a rebuilt options array does not move it. **`useSelectOptions.ts`** —
  out-of-order responses dropped through `createLatestRequest` (`utils/latest-request.ts`), which
  any fetch a user can re-trigger before it answers goes through.
- **`utils/api-error.ts`** — `toPageError` asserts a cause only for a 404, names the workspace
  only from `data.missing` (`INotFoundData`), never from the message, and is always `fatal`: Nuxt
  shows a non-fatal error on the client only on a cold load. **A `FetchError`'s `data` is a
  prototype getter** — read it off the error, never off a spread copy.
- **`pages/w/[workspaceAddress].vue`** — the parent of every page in a workspace: its membership
  fetch (through the workspaces store, which keeps it) is the workspace's one 404, and it records
  the visit once that passed.
  **`utils/safe-redirect.ts`** — `?redirect` is internal paths only.
- **`stores/records.ts`** — **every action takes the query params from the caller**; the store never
  mirrors them (they would have to survive hydration). `createRecord` refetches only when the new
  record lands on the current page; state clears when called for another table; `fetchRecords` is
  last-request-wins (a superseded response or failure is dropped) and otherwise sets `status` to
  `'failed'` **and rethrows**.
- **Edits are conditional writes.** Records, fields and roles carry `updatedAt`; their edit forms
  send the one they opened on as `If-Match` (`buildIfMatchHeaders`), the service puts it in the
  update's `where` (`readIfMatchVersion` on the route), and a miss on a row still there is a **412**
  (`buildStaleWriteError`). The store then refreshes its list, so reopening shows the winner. A new
  editable resource follows the same three steps.
- **`stores/tables.ts`** — `ensureTables()` **never throws** (a failed sidebar must not replace a
  working page); `fetchTables` sets `status` and rethrows, `ensureTables` swallows it, and the
  sidebar's Retry calls `ensureTables` again. An answer for a workspace switched away from is
  dropped, writes included. `applyTableRow(row)` is the one way a cached row moves without a
  refetch.
- **`stores/workspaces.ts`** — `ensureWorkspaces()` never throws, as `ensureTables` does, and
  refetches when the signed-in user is not the one the list was loaded for: logging out does not
  reload the app. `lastWorkspaceAddress` follows visits and deletions locally, so `/` reached later
  in the same visit opens the right workspace without asking the server.
- **`composables/useWorkspaceCollection.ts`** — the list a store holds for one workspace at a
  time (`roles`, `members`, the invitations sent): emptied on a switch, and **an answer or a write
  for a workspace switched away from is dropped**. Lists are oldest first, so an item new to the
  list is appended.
- **`stores/roles.ts`** — `updateRole` on the caller's own role refetches their membership: what
  they may do changed with it.
- **`stores/invitations.ts`** — both sides: `outgoing` (one workspace's, for its inviters) and
  `incoming` (the signed-in user's, which the switcher counts). `ensureIncoming` never throws and
  reloads for another user, as `ensureWorkspaces` does. **An answer refused with a 404 drops the
  invitation** — revoked, expired or answered in another tab.
- **`stores/relations.ts`** — options are **lazy**: the page only `setOptionSource`s, and a picker's
  first mount `ensureOptions` its own field, so a table that is only browsed asks for none; until
  they answer the picker says "Loading records…", never "no records". Caches are `shallowRef`s
  mutated in place and triggered, and are cleared on a table switch by the records store.

### Renderers — `app/components/features/records/`

- **`RecordForm`** — values down as props, changes up as `update: [key, value]`; **the parent's
  `useForm` object is never mutated**. A field in `readOnlyFieldIds` (from `GET /fields`) is shown
  through `RecordFieldValue`, never a control; `RecordFormModal` builds its schema and payload from
  the other fields only, and shows read-only ones only on an edit — a new record holds nothing.
- **`RecordFieldValue`** — the seam that renders a value identically in table and dialog. **An empty
  array is blank** alongside `null`.
- **`RecordDetail`** — wraps values by **not** declaring the table's `white-space: nowrap`.
- **`RecordsFilterPanel`** — rebuilds the filter map **in field order** on every change, dropping
  empties, so a URL is stable whichever control moved.
- **`RecordsFilterSummary`** — iterates `toFilterableColumns`, **never
  `Object.entries(filters)`**, so chips follow the drawer's order and an unowned key never shows.
- **`RecordsTableSkeleton`** — row and bar counts are **fixed constants**, never derived from
  `fields` (mid-navigation those belong to the table being left).

**On the records page the URL is the single source of truth.** `queryState` is
`parseRecordQueryState(fields, route.query)`; one watcher refetches, keyed on
`toRecordQueryKey(queryState)` so opening a dialog does not refetch. Records load **after** the
table loader, because filters decode against field metadata.

---

## 11. Browser regression checklist

What `test/e2e/` exists to cover; a behaviour added here without a spec is a gap that will not
announce itself. _(integration)_ marks SQL semantics proved in `record-sql.integration.spec.ts`,
_(unit)_ logic a component spec pins. Four clauses are approximated rather than proven
(`limitations.md`).

- **Records:** CRUD across every field type; a filtered URL loaded cold renders filtered on first
  paint; switching tables shows the skeleton, never "No records yet"; `BaseRange` resyncs on Clear
  all and Back; sort and page history; no hydration warnings.
- **Record columns:** `#9` before `#10`; number filter partial _(integration)_; numbers never reused
  _(integration)_; a same-day `Created at` range matches later that day _(integration)_.
- **Search:** a one-character term is rejected; NUMBER text matches; BOOLEAN and RELATION do not
  _(integration)_.
- **Relations:** number + label in cell and picker; sort by label; a deleted target degrades to a
  dashed "Unknown record"; deleting a targeted table is refused.
- **Record dialog:** opened from View and from a relation without refetching the list; Back/Forward
  close and reopen; cold `?detail=` renders server-side; drill in and `← Back`; Escape closes the
  chain and returns focus; a deleted target reads "This record no longer exists."; the link's ring
  is not clipped; `Open in …` absent for the current table; badge height equal in row and dialog.
- **Row actions:** Delete in the `⋯` menu; keyboard focus into it; Escape closes the menu alone.
- **Members:** an invited person sees the switcher's count, accepts, and lands in the workspace; a
  role change takes effect on their next page; removal sends them to the workspace's 404; a revoked
  invitation answers "This invitation is no longer valid"; the owner hands a workspace over and
  can then leave it.
- **Permissions:** an Editor gets records but no schema control; a Viewer no change at all; a role
  narrowed mid-session hides its controls on the first 403; a member removed mid-session lands on
  the workspace's 404 and `/` no longer offers it.
- **Multi-value:** the option appears for SELECT and RELATION only and locks once saved; widening
  keeps values, narrowing is a 400; one line in the table (values that fit, in full), wrapped in the
  dialog, cleared reads `Not set`; required/duplicate/over-cap validation; sorts by first value;
  repeated sorted params, "is any of" chips, cold URL; search ignores JSONB punctuation — probe
  `", "`, not `","` _(integration)_; each multi RELATION link drills independently.
- **`BaseSelect`:** the cursor's outline is painted; ↑/↓/PageDown move and scroll it; a panel near
  the drawer bottom flips and stays pinned on scroll; where the cursor lands _(unit)_. **Escape:** a
  focused closed searchable select lets Escape close the drawer; open, Escape closes only the panel
  — both branches. **Enter** submits from a closed select and picks from an open one. **Combobox:**
  typing or pasting opens and filters, local filtering sends no request, the overlay hides while
  typing, mouse picks keep typing in the field, held Backspace removes one value per press.
  **Clear** leaves focus in the control.
- **Relation search:** one character searches; `%` is literal; a bare number finds `#42`; fast
  typing then clearing ends on the seed; offline shows "Could not load options." with a Retry
  reachable by Tab, Shift+Tab, Enter, and Tab past it to the next control.
- **Colours:** a choice's hue in trigger, options and cell.
- **Table settings:** rows state type, configuration and key; icon actions named after the field;
  rename moves heading and sidebar together; delete lands on the dashboard; a targeted table refuses
  naming the field; rows stack at 375px.
- **Sign-out:** logging out on one device signs the user out on another.
- **Server guards:** a page and a successful API response carry the framing, `nosniff` and referrer
  headers; an error keeps Nitro's stricter `DENY`; an oversized body is a 413.
- **Accessibility:** no serious/critical axe violation on dashboard, table settings, records, record
  form, filter drawer, the workspace switcher, every workspace settings section and its dialogs,
  incoming invitations, and at 375px; nothing below 24×24, with the chip remove asserted at exactly 24.
- **Mobile shell (375×812):** sidebar `visibility: hidden` until opened; `aria-expanded` tracks;
  full-height panel; scrim, navigation and Escape dismiss it, but a dialog opened from it takes the
  first Escape; the table scrolls in its own container; a dialog fits both axes and scrolls its
  body.
