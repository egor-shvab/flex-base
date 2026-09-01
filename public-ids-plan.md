# Public identifiers plan

Replace the cuids in the address bar with per-tenant numbers: `/tables/cmses…?detail=cmses….cmshq…`
becomes `/tables/12-deals?detail=3.48`.

**Two stages, and they are separable.** Stage 1 moves _addressing_ — the table path, the record
detail chain, and the HTTP paths behind them. Stage 2 moves the one remaining cuid in the query
string, a RELATION filter's value, which is a harder problem because it has to be translated back
into an id before the SQL layer sees it. Stage 1 ships and is useful on its own; Stage 2 without
Stage 1 is pointless.

Per `CLAUDE.md` §2, each task gets a `**Status:** done — YYYY-MM-DD` line as the **first line of
its own block** when it passes the definition of done; a task with no such line has not been
started. Task numbers are stable identifiers, not a running order — the authoritative order is the
**Sequencing summary** near the end.

---

## 1. The rule this establishes

> **Paths address, payloads reference.**
>
> A URL — browser or HTTP — addresses a resource by a number that is readable and scoped to its
> owner. A payload references a row by the cuid that row actually stores.

This is a **correction to the addressing half** of `decisions.md` → _`Record.number` instead of an
auto-incrementing PK_, which currently reads "`id` stays an unguessable `cuid()` for reference and
addressing". The reference half is unchanged and must stay unchanged: `Record.data` holds target
cuids, `Field.options.targetTableId` holds a table cuid, `linkedRecords` is keyed by record id, and
`server/db/field-indexes.ts` names indexes from the table cuid. None of that moves.

**What this does not buy.** Cuids stay visible in API responses and therefore in DevTools —
`ITable.id` is what a RELATION field's config stores, `IRecord.id` is what a relation value stores.
The deliverable is a readable URL, not a hidden id. If the goal were the latter, this plan does not
achieve it and a different one would be needed.

---

## 2. Scope

**In:**

| Entity | Public identifier                          | Why                                            |
| ------ | ------------------------------------------ | ---------------------------------------------- |
| Table  | **new** `Table.number`, unique per user    | It is in the address bar                       |
| Record | existing `Record.number`, unique per table | It is in the address bar, and already computed |
| Field  | **none** — keeps its cuid in API paths     | It never reaches the address bar               |

**Fields deliberately get no number.** Field ids appear only in `/api/tables/:t/fields/:fieldId`,
never in the browser. A field already has two identifiers (`id` and the immutable, per-table-unique
`key`); a third would be a `CLAUDE.md` §6 "one meaning per word" violation with no surface asking
for it. _Revisit if a field ever gets its own page._ If it does, the identifier to reach for is
`Field.key`, not a new number — it is already immutable and already unique per table.

**Out:** migrating stored relation values in `Record.data` from cuids to numbers. It rewrites every
JSONB row holding a relation, forces the per-field btree/GIN expression indexes to rebuild, and
changes what `assertRelationTargets` and `resolveLinkedRecords` compare — for a value no user ever
reads. Explicitly rejected, not deferred.

---

## 3. Decisions needed before implementation starts

**D-a. Is a compatibility redirect for existing cuid links wanted?** The two forms are trivially
distinguishable (`^\d+`), so a shim is cheap: resolve by id, 301 to the numeric form, same for each
`?detail=` entry. **Default assumption in this plan: no shim, clean break** — the app is
pre-launch, single-user, and every URL is regenerable from the sidebar. If real bookmarks exist,
add T11 and the cost is roughly one route middleware plus two e2e cases.

**D-b. Does the slug ship (T9), and if so what happens to the error log?** `/tables/12-deals`
puts a **user-authored table name into the pathname**, and `server/utils/error-log.ts` records
pathnames. `decisions.md` states that redaction there is _structural_ — method, pathname, query
param **names**, user id — precisely so that no filter list can be forgotten. A slug quietly makes
the pathname carry user content. **This plan's answer is T9's second half: strip the slug before
logging, at both ends**, mirroring the existing "cut at the first `?`" rule and its
belt-and-braces property that neither end relies on the other being careful. If that is judged not
worth it, drop T9 and ship `/tables/12`.

**D-c. Does `Table.number` restart per user at 1, or continue globally?** This plan says **per
user, from 1** (`@@unique([userId, number])`). Two users both having `/tables/1` is intended: a
global sequence would leak platform-wide table volume through the counter, which is the same
argument `decisions.md` already makes for `Record.number`.

---

# Stage 1 — numeric addressing for tables and records

### T1. Schema and migration: `Table.number`, `User.tableCounter`

**Status:** done — 2026-08-31, with changes — the counter is seeded from `MAX("number")`, not
`COUNT(*)` as first written below (a high-water mark stays right over a set with gaps, and it is
what the `record_number` precedent uses). One consequence the plan missed also landed here:
`test/integration/seed.ts`'s own `createTable` had to allocate a number by hand, or a required
column with no default breaks every seeded table in the integration and e2e suites.

**What.** Mirror the `Record.number` / `Table.recordCounter` pair one level up.

```prisma
model User {
  // High-water mark for Table.number, allocated by createTable inside the insert's own
  // transaction — the same contract Table.recordCounter gives Record.number one level down.
  tableCounter Int @default(0)
}

model Table {
  // The id a user reads, and what the URL addresses: sequential per user, so one account runs
  // 1..n however many tables the platform holds. Identity stays on the cuid — a relation's
  // options.targetTableId references that, never this.
  number Int

  @@unique([userId, number])
}
```

The new unique index also covers a lookup by `userId` alone through its left prefix, exactly as the
schema comment on `@@unique([userId, name])` already records — so **no `@@index([userId, number])`,
and the existing "do not re-add the redundant single-column indexes" rule is unaffected.**

**Migration — hand-written, `--create-only`.** Prisma refuses a required column over existing rows,
the same way it refused `record_number`:

```sql
ALTER TABLE "User" ADD COLUMN "tableCounter" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Table" ADD COLUMN "number" INTEGER;

UPDATE "Table" SET "number" = ordered.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt", id) AS rn
  FROM "Table"
) AS ordered
WHERE "Table".id = ordered.id;

UPDATE "User" AS u
SET "tableCounter" = COALESCE((SELECT MAX("number") FROM "Table" WHERE "userId" = u.id), 0);

ALTER TABLE "Table" ALTER COLUMN "number" SET NOT NULL;
CREATE UNIQUE INDEX "Table_userId_number_key" ON "Table"("userId", "number");
```

**`ORDER BY "createdAt", id` is not arbitrary** — it is `record_number`'s backfill order, and it is
also `listTables`'s `orderBy`, so after the migration a user's table numbers ascend in the order
the sidebar already draws them.

**Migration cost, judged against the table this will eventually run on** (`CLAUDE.md` §5): the
`ADD COLUMN`s are instant (no default rewrite in PG11+); the two `UPDATE`s rewrite rows;
`SET NOT NULL` takes an `ACCESS EXCLUSIVE` lock and scans. At current scale all of it is
milliseconds. If it ever needs to run on a large `Table`, the standard avoidance is
`ADD CONSTRAINT … CHECK ("number" IS NOT NULL) NOT VALID` → `VALIDATE CONSTRAINT` → `SET NOT NULL`,
which PG12+ satisfies from the valid check without a second scan. Note also that
`CREATE UNIQUE INDEX CONCURRENTLY` cannot run inside a migration's transaction — if it is ever
needed, it has to be issued outside one.

**`test/integration/seed.ts` lands in this task.** Its `createTable` writes
`data: { userId, name }`; a required `number` with no default breaks every seeded table in the
integration **and** e2e suites. Mirror the `createRecord` beside it, which already maintains
`recordCounter` by hand for the same reason.

**Tests.** `test/integration/` — after `migrate deploy`, every seeded table has a distinct
`number ≥ 1` within its user and the owner's `tableCounter` equals the highest.

---

### T2. `TableService.createTable` allocates the number

**Status:** done — 2026-08-31, with a follow-up landed in T4 — the counter increment made this the
first write ever issued against `User`, which **exposed a latent bug in the e2e fixture** and turned
82 cases red. `currentUserId` resolved the signed-in account with an unordered `findFirstOrThrow`,
and the suite holds two accounts (the sign-up case registers one that only `global-setup` clears);
an `UPDATE` moves a row in physical scan order, so seeding began filing tables under the wrong
account and every table-scoped case 404'd. Fixed by resolving on `E2E_USER.email`. **The lesson
generalises: writing to a row can reorder an unordered read anywhere.**

**What.** The same transaction shape as `RecordService.createRecord`:

```ts
const table = await prisma.$transaction(async (tx) => {
  const { tableCounter } = await tx.user.update({
    where: { id: userId },
    data: { tableCounter: { increment: 1 } },
    select: { tableCounter: true },
  })

  return tx.table.create({ data: { userId, name, number: tableCounter }, select: tableListSelect })
})
```

**Why a counter and not `MAX(number) + 1`.** The atomic increment takes the `User` row lock, so two
concurrent creates queue instead of racing for one number and no retry loop is needed — the
identical argument `architecture.md` §4 makes for records. Table creates are rare, so holding a
`User` row lock for the length of one insert costs nothing.

**A failed create leaves no gap** — a duplicate name raises `P2002` inside the transaction, so the
increment rolls back with it. Gaps come only from deletes, which is the high-water-mark contract:
deleting table 3 must not hand `/tables/3` to a different table later.

`toHttpError`'s existing `P2002` → 409 mapping is unchanged; the new unique index cannot be the one
that fires, because the number is server-allocated.

**Tests.** `server/services/tables.spec.ts` (stub) — the create issues the increment before the
insert, in one transaction. `tables.integration.spec.ts` — concurrent `createTable` calls for one
user get distinct numbers, mirroring the existing record-counter concurrency case.

---

### T3. Shared types and the wire contract

**Status:** done — 2026-08-31, with changes — `IOpenRecord` was **moved to T7**, and the tests were
more than type-level. Both are written into the task below.

**What.**

- `ITable` gains `number: number`. `tableSelect` / `toSharedTable` carry it, so `ITableListItem`
  and every response built on it get it for free.
- `IRecordDetail.table` widens from `Pick<ITable, 'id' | 'name'>` to
  `Pick<ITable, 'id' | 'number' | 'name'>` — the dialog's "Open in …" link needs the number, and
  `id` stays because the dialog is also where a cross-table relation is resolved.
  `RecordService.getRecordDetail`'s first parameter widens with it.
- `IRecord` is **unchanged** — it keeps both `id` (what a relation references) and `number`.

**`IOpenRecord` is deliberately not here — it belongs to T7.** `useRecordDetail` calls
`api.detail(openRecord.tableId, openRecord.recordId)`, and the record endpoint addresses by cuid
until T6. A numeric chain landed here would force a number→cuid resolution in the client, which is
the one thing this design exists to avoid.

**Additive by design, and its first consumer is T8.** Nothing reads `ITable.number` when this
lands — T4–T7 build toward the sidebar links and the relation cell's cuid→number lookup. That is
staging, not dead code. What it buys immediately is that T1/T2's allocation becomes observable at
the boundary instead of only through `psql`.

**Doc obligation for this task:** `architecture.md` §4 gains the table half of record identity; the
`ITable` comment states which of the two identifiers each field is.

**Tests.** `npm run typecheck` names most of the work — six test doubles carry a table shape and
must gain `number` (the two nuxt store/loader builders, the two detail builders,
`records.spec.ts`'s `table`, and `tables.spec.ts`'s untyped `tableRow`). **Not type-level only:**
add an endpoint-level case to `server/api/tables.integration.spec.ts` asserting `GET /api/tables`
hands back `1, 2, 3` per caller — the counterpart to the service-level `table numbers` block, and
the first proof the number survives the whole stack.

**No shared table fixture.** The six doubles are three different shapes across two projects, each
with spec-local defaults; one builder cannot serve them. _Revisit at a seventh site._

---

### T4. Route params: one parser, one guard, no new throw site

**Status:** done — 2026-08-31, with changes — the module is `shared/utils/address.ts` (not
`table-address.ts`), and the slug-tolerant parser is the **page's alone**: the server only ever
receives a bare number, so it takes the strict one. Both corrections are written into the task
below. Also carried T2's e2e fixture fix, which was blocking the suite.

**What.** `server/utils/route.ts` gains a sibling to `routeParam`, and the address format gets one
shared decoder both sides read.

`shared/utils/address.ts` (new — **`address.ts`, not `table-address.ts`**: it holds the plain
record-number parser too, and `address` is already this work's word for the concept):

```ts
/** The number a URL segment addresses, or 0. Digits only, bounded to a PostgreSQL Int. */
export function parseAddressNumber(raw: string): number
/** `12` and `12-deals` both address table 12; the slug is decoration and is never resolved. */
export function parseTableAddress(raw: string): number
/** The inverse — what a link is built from. */
export function toTableAddress(table: Pick<ITable, 'number'>): string
```

It is **shared** so that the bound and the notion of "valid" cannot drift between the page reading
`route.params` and the server reading a route param.

**The two parsers split by surface, and the server only ever needs the strict one.** A slug appears
only in the _browser_ URL, which is a Nuxt page route; the client builds API paths from
`apiPath.table(tableNumber)`, so `/api/tables/:tableId` receives a bare number. `parseTableAddress`
is therefore the page's, `parseAddressNumber` the server's — one shared bound, two entry points.

**No zod here.** `shared/utils/` sits above `validation/` in the layer order and may not import it
(`architecture.md` §2), which is also what keeps this callable from `route.ts`.

`server/utils/route.ts`:

```ts
export function numericRouteParam(event: H3Event, name: string): number
```

**The sentinel is `0`, and this is the point** — the existing `''` fallback in `routeParam` exists
because an `undefined` in a Prisma `where` **drops the condition** and silently widens a scoped
query. The numeric analogue is worse, not better: `Number('abc')` is `NaN` and
`Number('99999999999999999999')` overflows a PG `Int`, and both reach Prisma as a thrown 500 rather
than a 404. So the parser accepts `^\d+` only, bounds the result to `[1, 2147483647]`, and answers
`0` for everything else — a value no row can hold, which turns a malformed address into the 404 the
ownership helpers already produce. **No new `createError` site**, and one place to reason about.

Cases the parser must pin: `12` · `12-deals` · `012` (accept, 12) · `0` · `-1` · `1.5` · `1e3` ·
`abc` · `` · `2147483648` · a 40-digit number.

**Tests.** `server/utils/route.spec.ts` and `shared/utils/table-address.spec.ts`, unit project, the
full case list above. This is the task where a missing case is a 500 in production, so the table of
cases is the deliverable.

---

### T5. Ownership resolves a table by number **or** by cuid

**Status:** done — 2026-08-31, with changes — the task was re-scoped from "helpers take a number"
to "helpers accept either form", because the flip cannot be staged (see below). The id/number
entry-point split was dropped as unnecessary. E2E is the proof it is non-breaking: it drives the
app entirely through cuid URLs and stayed green at 140.

**Why both, rather than a flip.** The four `require*` helpers are called from one place — the
handler factories — so converting them to take a number would flip `/api/tables/:tableId` for
tables, fields **and** records at once. There is no per-resource staging: they share the segment.
That single commit would break the client, 37 integration param sites and the whole e2e suite, and
`useRecordDetail` would drag T7 in with it — making T5–T8 one ~50-file change with no green
checkpoint. So the server learns the second form first, and the client flips later against a server
that already understands it.

**What.** One private resolver in `server/utils/ownership.ts` is the only place that knows there
are two forms:

```ts
function tableWhere(userId: string, address: string): Prisma.TableWhereUniqueInput {
  const number = parseAddressNumber(address)

  return number === 0 ? { id: address, userId } : { userId_number: { userId, number } }
}
```

- **Unambiguous by construction** — a cuid is never all digits — so no caller has to say which
  form it holds, and the helpers keep taking a `string` (renamed `tableId` → `address`).
- **Both branches scope the owner inside the `where`**, so §5 is untouched: what changes is which
  column identifies the row, never whether ownership is part of the query. The compound unique
  serves its branch exactly as `{ id, userId }` serves the other.
- **A malformed address takes the id branch and matches nothing** — `parseAddressNumber` (T4)
  answers `0` for `12abc`, `0`, empty, and anything past a PostgreSQL `Int` — so every mistyped
  link still 404s rather than making Prisma throw.

**`requireOwnedTableFields` and `requireRecordFields` return `{ tableId, fields }`.** The resolved
cuid, never the address given: routes below build their own `where` from it, so handing `"12"`
through would land a number where a cuid belongs. This is the only change with teeth; the rest is
mechanical. `handler.ts` destructures it in two factories and is otherwise untouched.

**`requireFieldTarget` needs no split.** The earlier draft called for separate id- and number-based
entry points so this helper — which resolves `input.targetTableId`, a cuid out of field options —
could not be handed the wrong kind. One resolver that reads both makes the split unnecessary: it
keeps passing a cuid and takes the branch it always did. Fewer functions, nothing to confuse.

**Tests.** `server/utils/ownership.spec.ts` asserts the `where` **argument** for each form (a
fetch-then-compare rewrite would return the right table while losing the §5 property), including
that each malformed address lands on the id branch.
`server/api/ownership.integration.spec.ts` proves what a stub cannot: both forms answer
identically, a number only another account holds is a 404, and each account has its own table `1`.
**Note that last one when writing such a case** — asking for a number the caller also owns
correctly returns _their_ row, so a cross-account test must pick a number the caller does not have.

**Left open, to settle after T8:** whether the server keeps accepting cuids. While it does, this
doubles as the D-a compatibility shim and old bookmarks resolve; dropping it is a small, isolated
removal of one branch.

---

### T6. Records and the factory-free table writes accept an address too

**Status:** done — 2026-08-31, with changes — the factories needed nothing (T5's resolver already
reads both forms), `numericRouteParam` was **deleted** rather than adopted, and the segment rename
was **deferred**. All three are written below.

**What T5 left.** Three routes bypass the handler factories: `[tableId].patch` and
`[tableId].delete` (factory-free by design — their services scope on `userId` themselves) and the
three record routes, which read a `recordId` off the route. T6 finishes the server half so the
whole API understands both address forms.

**Two rules, one per model, side by side in `db/`** — which is what makes them read as one idea
rather than two coincidences:

- `tableWhere(userId, address)` **moves** from `server/utils/ownership.ts` to `server/db/tables.ts`.
- `recordWhere(tableId, address)` joins it in `server/db/records.ts`, **scoped by its table rather
  than by its owner**: a handler factory has already proven that table belongs to the caller, so
  the table id _is_ the ownership scope by then. That asymmetry is the design, not an oversight.

**The trap this task exists for.** `TableService.deleteTable` used its argument twice — once for
the delete, once for `assertNotRelationTarget`, which compares `options.targetTableId` and so
stores a **cuid**. Hand it a number and it matches no reference: the guard passes, and the delete
cascades a table every relation still points at. Nothing errors; the links simply go blank. So
`deleteTable` **resolves the address to the id before it guards** — a third query on a rare,
irreversible operation, which is the right trade against a guard that silently stops guarding.
`renameTable` uses its argument once, so it stays one query. `getTableListRow` is untouched: all
four callers hand it an already-resolved id.

**`numericRouteParam` was deleted.** T4 added it expecting routes to parse their own params; the
dual-accept design put parsing inside the where-builders, leaving it with no caller — and no future
one, since dropping cuid support removes a branch from `tableWhere` rather than moving parsing back
to the routes. `parseTableAddress` is the opposite case: still unused, but T8's page reads
`route.params` through it.

**The `[tableId]` → `[tableNumber]` rename is deferred**, reversing the note this task used to
carry. The param now legitimately holds _either_ form, so `[tableNumber]` would be a name that
lies — the very fault the rename exists to fix. `[tableAddress]` is the durable name, but renaming
~12 files twice is worse than once: do it after the post-T8 decision on whether cuids stay.

**Rejected: collapsing `defineFieldsHandler` into `defineTableWithFieldsHandler`.** With the table
always resolved they differ only in what they select, so merging would drop the factory count from
four to three. A real simplification, and out of scope — it changes a documented rule for a reason
unrelated to identifiers. _Revisit as its own change._

**Tests.** The load-bearing one is an integration twin of _"refuses while a relation still points
at it"_ addressing the table **by number**: without the resolve-first fix it fails by _deleting the
table_ rather than by answering 409. Verified by temporarily reverting the fix — it caught it.
Unit specs pin the `where` argument for both forms on every service that takes an address; the
records integration spec proves a record reads and writes by either form and that record `1` of one
table is not record `1` of another.

### T7. The `?detail=` chain

**What.** `shared/utils/record-detail.ts` — the format becomes
`?detail=<tableNumber>.<recordNumber>,…`.

**`IOpenRecord` becomes `{ tableNumber: number; recordNumber: number }` here, not in T3.** It has
to follow T6: `useRecordDetail` calls `api.detail(…)` with whatever the chain holds, so the chain
may only carry numbers once the endpoint accepts them. Both names are deliberate and neither
overloads a taken word — `recordNumber` is already the name of this exact value in
`RECORD_NUMBER_KEY`, so it is one meaning in two places rather than a second meaning.

- `parseOpenRecord` parses two strict integers through the same bounds T4 uses. It already returns
  `null` on a malformed entry, and `parseDetailChain` already **stops** at one rather than skipping
  it — both behaviours are kept exactly as they are, and the leniency contract does not change.
- `toDetailParam` writes numbers.
- The comment "Both separators are outside the cuid alphabet" is rewritten, not appended to: `.`
  and `,` are outside the digit alphabet, which is a stronger guarantee than the one it replaces.

**A cuid-shaped entry must decode to nothing**, so an old bookmark degrades to a closed dialog
rather than a request for table `NaN`. That falls out of the strict parse for free — but it is the
case to write a test for, because it is the one an implementation is most likely to get wrong by
using `parseInt`, which happily reads `12abc` as `12`.

**Tests.** `shared/utils/record-detail.spec.ts` (unit) — round-trip, the stop-at-bad-entry rule
re-pinned against numeric entries, and the cuid-entry case above.

---

### T8. The client: pages, links, stores, api modules

**What.** Follow the `npm run typecheck` error list from T3. The sites, so none is missed:

**Addressing**

- `app/api/paths.ts` — `table`, `fields`, `field`, `fieldOptions`, `records`, `record` take a
  `tableNumber: number`; `record` takes a `recordNumber: number`. Field ids stay cuids (§2).
- `app/api/tables.ts`, `fields.ts`, `records.ts`, `relations.ts` — parameter types only.
- `app/stores/tables.ts` — `renameTable`, `deleteTable`, `applyTableRow`, `tableRow` are keyed by
  number. **`applyTableRow` must keep matching on `id`**: it replaces a row the server just
  answered with, and identity is the right key for that.
  **New:** `tableNumber(tableId: string): number | undefined`, the cuid→number lookup T8's relation
  cell needs (below), sitting beside the existing `tableRow` as the second place `tables` is read
  by identity.
- `app/stores/fields.ts`, `records.ts` — `tableId: string` → `tableNumber: number` throughout,
  including `loadedTableId` (rename to `loadedTableNumber`; it is a cache key, and a key that says
  `Id` while holding a number is exactly the drift `CLAUDE.md` §6 is about).
- `app/stores/relations.ts` — `loadOptions(tableNumber, fields)`; `tableIdByField` becomes
  `tableNumberByField`.

**Links**

- `app/pages/index.vue`, `app/components/app/AppSidebar.vue` — `/tables/${toTableAddress(table)}`.
  `AppSidebar`'s active-route comparison is by route param, so it compares the parsed number.
- `app/pages/tables/[tableId]/index.vue` + `settings.vue` — `route.params.tableId` goes through
  `parseTableAddress`; the `useAsyncData` keys become `table-records-${tableNumber}` and
  `table-${tableNumber}` (still distinct — a layout and a page must not share a key).
- `app/composables/useTableLoader.ts` — the loader both table screens open with takes a
  `tableNumber`. It returns `ITable`, which now carries the resolved `id` as well, so a caller
  needing the cuid has one without a second request.
- `app/components/records/RecordsTable.vue` — prop `tableId: string` → `tableNumber: number`; the
  row link becomes `detailLinkTo({ tableNumber, recordNumber: record.number })`.
- `app/components/modals/RecordDetailModal.vue` — `currentTableId` → `currentTableNumber`, and
  `openInTableTo` builds `/tables/${toTableAddress(detail.table)}?detail=…`.
- `app/field-types/relation/RelationFieldCell.vue` — **the one non-mechanical site.** Its link
  target is built from `field.options.targetTableId`, a cuid, and it needs that table's number.
  Resolve it through `useTablesStore().tableNumber(targetTableId)`: the tables store holds every
  table the user owns, so it answers even for a field belonging to a table the current page is not
  about — which is the case that rules out feeding the number through the relation-options response
  instead, since the detail dialog drills into fields that never pass through `loadOptions`
  (`decisions.md` records exactly this about `linkedByField`). The target record's number is already
  in hand as `linkedRecord.number`.
  Reading a store from a component is fine here — the SSR objection in `IFieldConfigSummaryContext`
  is about a **registry entry** resolving Pinia's module-global instance, and this component already
  calls `useRelationsStore()`.
  **Degradation:** if `ensureTables` failed the number is unknown, and the cell must fall through to
  its existing non-link text rather than rendering a broken link — the same shape as the
  deleted-target case it already handles.

**Tests.** `useDetailLink.nuxt.spec.ts` and `useRecordDetail.nuxt.spec.ts` re-pinned on numeric
chains; a new `nuxt` case for the relation cell's fallback when the tables store is empty.

---

### T9. The readable slug — `/tables/12-deals`

**Status note:** this task is separable and can be dropped without affecting anything above it.

**What.** Two halves, and the second is not optional if the first ships.

1. `toTableAddress` appends a slug derived from `Table.name`; `parseTableAddress` reads the leading
   integer and **ignores everything after it**, so renaming a table never breaks a link and no
   redirect is needed.

   The slug helper is **new, in `shared/utils/table-address.ts`** — it is emphatically **not**
   `server/utils/field-key.ts`'s `slugify`. That function's `^[a-z0-9_]+$` output is load-bearing
   for field keys, for `RESERVED_FIELD_KEYS`, and for index naming in `field-indexes.ts`; a URL slug
   wants hyphens. Sharing one function would let a URL-cosmetics change silently rename database
   indexes. Two functions, two contracts, and `slugify` keeps its meaning (`CLAUDE.md` §6).

   Cap the slug (~40 chars) and allow it to be empty — a table named entirely in non-ASCII gives
   `/tables/12`, which is correct and needs no special case.

2. **Strip the slug before it reaches the error log.** `server/utils/error-log.ts` records the
   pathname, and `decisions.md` states that its redaction is _structural_ — nothing reaches for
   user data, so nothing can forget to. A slug puts a user-authored table name into that pathname.
   Cut it at both ends, the same way the query string is already cut at the first `?` and for the
   same belt-and-braces reason (neither end relies on the other being careful):
   - `server/utils/error-log.ts` — normalise `/tables/12-anything` to `/tables/12` when building an
     entry, for both the Nitro-hook source and the client-report source.
   - `app/plugins/error-report.client.ts` — send the normalised path, not raw
     `window.location.pathname`.

**Tests.** `error-log.spec.ts` — a path carrying a slug is recorded without it, for both sources.
`table-address.spec.ts` — the round trip, the empty-slug case, and that a wrong slug still resolves.

---

### T10. Stage 1 tests

**Unit (`vitest.unit.config.ts`)**

- `shared/utils/table-address.spec.ts` — new; the case table from T4 plus T9's slug cases.
- `shared/utils/record-detail.spec.ts` — numeric chain, stop-at-bad-entry, cuid entry decodes to
  nothing.
- `server/utils/route.spec.ts` — `numericRouteParam`, the full malformed-input table.
- `server/utils/ownership.spec.ts` — the `where` shape of each helper, and that the id-based and
  number-based entry points are distinct.
- `server/services/tables.spec.ts` — the counter increment and the insert are one transaction.
- `server/services/records.spec.ts` — the record `where` scopes on `tableId_number`.

**Nuxt (`vitest.nuxt.config.ts`)**

- `useDetailLink.nuxt.spec.ts`, `useRecordDetail.nuxt.spec.ts` — numeric chains.
- New: the relation cell falls back to plain text when the target table's number is unknown.

**Integration (`vitest.integration.config.ts`)**

- `tables.integration.spec.ts` — concurrent creates get distinct numbers; numbers are not recycled
  after a delete; the number is per user (two users both reach 1).
- `ownership.integration.spec.ts` — a foreign table number is a 404; a malformed one is a 404, not
  a 500.
- `records.integration.spec.ts` — the detail read and all three writes address by number.
- A migration check: after `migrate deploy`, backfilled numbers are dense from 1 per user and
  `User.tableCounter` matches the maximum.

**End-to-end (`playwright.config.ts`)**

- **A table number is not reproducible across e2e cases.** The per-case fixture truncates
  `Table`/`Field`/`Record` but spares `User` (it holds the suite's cookie), so `tableCounter`
  climbs for the whole run and the first table of a case is not table 1. Every URL must come from
  the seeded fixture; **no spec may hardcode `/tables/1`.**
- `test/e2e/setup/fixtures.ts` — `ISeededTable` gains `number`; `url` is built from
  `toTableAddress`. This is the single change that carries most of the suite: 13 call sites build a
  URL from `table.id` today, and they become `${table.url}` / `${table.url}/settings`. Add a
  `settingsUrl` to the fixture rather than string-concatenating in eight specs.
- `record-dialog.spec.ts` — the two hand-built `?detail=${people.id}.${adaId}` URLs become
  `${people.number}.${ada.number}`. `createRecords` already returns `{ id, number }[]`, so nothing
  in `test/integration/seed.ts` changes; what changes is this spec's own
  `prisma.record.findFirstOrThrow`, which selects `{ id: true }` and now needs `number` too. Note
  the record's **`id` must stay** in the seeded `owner: adaId` value — that is a stored relation
  value, not an address.
- `error-page.spec.ts` — `/tables/does-not-exist` still 404s (now via the `0` sentinel); **add**
  `/tables/999999` (well-formed, unowned) and `/tables/0`.
- `auth.spec.ts` — `/tables/whatever?stage=Won` still redirects to login and back; the path is
  never resolved before the guard runs, so this should pass unchanged. Verify rather than assume.
- **No new entry in `architecture.md` §11.** Nothing here is a behaviour only a browser can answer;
  these are existing e2e cases re-addressed, and the new assertions belong to the projects above.
  Resist the pull to add a "URLs are numeric" e2e case — `expect.poll` on the table after a
  navigation is what the URL assertions already ride on.

**The e2e trap to re-read before touching those specs:** a URL assertion resolves the moment the
address bar moves, while the rows behind it refetch asynchronously. Every table assertion stays on
`expect.poll`.

---

### T11. Old-link compatibility — conditional on D-a

**What (only if D-a says yes).** A route middleware that detects a cuid-shaped `tableId` param,
resolves it to a number through an endpoint scoped to the caller, and `navigateTo(…, { redirectCode: 301 })`
to the numeric form — doing the same for each `?detail=` entry. Add two e2e cases: an old table URL
and an old detail URL both land on the numeric equivalent with the view intact.

**If D-a says no, this task is dropped and the break is recorded in `docs/limitations.md`** (D3)
rather than left in a commit message — `CLAUDE.md` §2, step 7.

---

# Stage 2 — relation filter values

The remaining cuid in the address bar: `?company=cmses…` should read `?company=48`.

**The constraint that shapes the whole stage.** `parseRecordQueryState` is a **pure, synchronous,
shared** codec, and the client and the server must decode a link identically (`architecture.md`
§2). Number→cuid resolution is I/O. It therefore cannot live in the codec, and the decoded filter
model on both sides has to carry the number.

**And the SQL must not learn about it.** The obvious alternative — comparing through a subquery
against `"Record"."number"` — defeats RELATION's `filterIndex: 'btree'` (and the multi-value
`'gin'`), because the planner can no longer probe the indexed expression with a constant. That
regresses the indexing work in `9ad109b` / `7119e55` for a cosmetic gain. **Rejected.** The
substitution happens above `buildRecordWhere`, which is left byte-for-byte as it is.

---

### T12. A filter value schema that can differ from the stored value schema

**What.** Today `buildFilterValueSchema` reuses `value.base` / `value.fromQuery`. For RELATION the
two must now diverge: a **stored** value is a cuid, a **filter** value is a record number.

`IFieldTypeModule` gains one key beside `value`:

```ts
/**
 * The rules for this type's *filter* value, when they differ from its stored value's — `null`
 * where a filter carries exactly what a record stores, which is every type but RELATION.
 */
filterValue: IValueSchemaRules | null
```

Required and nullable, never optional, so a new field type states its position (`CLAUDE.md` §9).
`shared/field-types/registry.ts` gains one total `FILTER_VALUE_SCHEMA_BY_TYPE` map;
`buildFilterValueSchema` reads it and falls back to `VALUE_SCHEMA_BY_TYPE`.

**RELATION's filter value stays a `string`, and this is deliberate.** It holds the digits of a
record number, not a `number`. Making `IFilterValueByType['RELATION']` numeric would force
`TFilterValue` to admit `number[]`, which would ripple through `isListFilterValue`, `toList`,
`matchesAny`, `containsAny` and every list-shaped consumer for no gain — a URL carries strings
either way. What changes is only the **schema**: `z.string().regex(/^\d+$/)` with the same bounds as
T4, in place of `relationId()`'s `min(1)`.

That change is load-bearing rather than cosmetic: without it `?company=abc` passes validation,
resolves to nothing, and silently returns an empty list — where `architecture.md` §7 promises that
a malformed **known** param is a 400.

**Tests.** `shared/validation/record.spec.ts` — a RELATION filter param accepts digits and rejects a
cuid, while a RELATION **record value** still accepts a cuid and rejects digits-only… (it must not:
a cuid schema is `min(1)`, so `"48"` remains a valid stored value and the server's
`assertRelationTargets` is what rejects it — assert that division rather than inventing a cuid
regex). Plus a registry-completeness case beside the existing `MULTI_INPUTS` / `MULTI_SQL`
invariants: **`filterValue` is non-null exactly where a type's filter is not its stored value**.

---

### T13. The client speaks numbers

**What.**

- `app/field-types/relation/RelationFieldSelect.vue` gains `valueBy: 'id' | 'number'` (default
  `'id'`). The `input` / `multiInput` entries keep the default — a record still stores a cuid. The
  `filter` / `multiFilter` entries in `app/field-types/relation/index.ts` pass `valueBy: 'number'`.
  The component already reads `optionsFor(fieldId)`, whose `IRecordOption` carries **both** `id`
  and `number`, so the mapping is local to it and no adapter is needed. (Adapters are pure value
  functions with no store access, which is why the prop is the right seam and `blankIsNull` is not.)
- `app/stores/relations.ts` — a reverse index maintained inside `cacheLinkedRecords`, and
  `linkedRecordByNumber(fieldId, number)` beside the existing `linkedRecordFor`. Merge-only and
  unbounded like its sibling, for the reason already recorded in `decisions.md`.
- `IFilterSummaryContext` gains `linkedRecordByNumber`; RELATION's `summary` / `multiSummary` use
  it. `RecordsFilterSummary` supplies it from the store.

**Unchanged, and worth stating so it is not "fixed":** a filtered number outside the capped
candidate list still resolves to nothing and degrades to a placeholder — exactly today's behaviour
with a cuid, so this is not a regression introduced here.

**Tests.** `nuxt` project — the relation filter control round-trips a number through the URL; the
filter summary renders a label for a seeded target and a placeholder for an unseeded one.

---

### T14. The server resolves numbers to ids above the SQL

**What.** One new member on the module that already owns what a RELATION means:

```ts
RelationService.resolveFilterTargets(
  fields: IField[],
  filters: TRecordFilterValues,
): Promise<{ filters: TRecordFilterValues; impossible: boolean }>
```

- Batched: one `findMany` per **distinct target table**, `where: { tableId, number: { in: […] } }`,
  served by `@@unique([tableId, number])`. Never one query per value and never one per row —
  `CLAUDE.md` §5.
- Returns a copy of the filter map with each RELATION entry's numbers replaced by the resolved
  cuids. Every other entry passes through untouched.
- Called from `RecordService.listRecords` immediately before `buildRecordWhere`, so the handler
  stays thin and `buildRecordWhere` never learns that a relation filter was ever anything else.

**The trap this task exists to avoid.** A relation filter whose numbers resolve to **nothing** must
match nothing. It must not become an absent filter: `matchesExactly` and `containsAny` both answer
`null` for an empty value, `buildRecordWhere` skips a `null` condition, and the list would silently
**widen to every row in the table** — no error, no empty state, just the wrong data, which is the
single worst failure mode available here.

So resolution reports it: `impossible` is true when a relation filter was requested with values and
**none** of them resolved. `listRecords` then returns an empty page without issuing any query at all
— `records: []`, `total: 0`, `totalCapped: false`, the requested `page` and `pageSize`,
`linkedRecords: {}`. Cheaper than a `FALSE` predicate and impossible to get subtly wrong.

A **partial** miss is not impossible: a list filter keeps the values that resolved and drops the
ones that did not, which is what "any of" means.

**Unchanged:** record **writes** still carry cuids in their body (`assertRelationTargets`,
`buildRecordSchema`), because that is the stored value. Only the query string moved.

**Tests.**

- `server/services/relations.spec.ts` (stub) — one query per distinct target table; the substituted
  map; `impossible` on a total miss; a partial miss keeps the survivors.
- `server/services/records.integration.spec.ts` — a numeric relation filter returns the same rows
  the cuid filter used to; a filter naming a deleted record returns zero rows **and the count is
  zero, not the table's size** (the widening regression, pinned where it would actually show).
- `server/db/record-sql.spec.ts` — **unchanged, and that is the assertion.** If a case in that file
  needs editing, the substitution leaked into the SQL layer and the design is wrong.
- `field-indexes.integration.spec.ts` — **a new case**, in the existing `a declared index is one
the planner actually uses` block: an opted-in RELATION filter is served by its B-tree, and a
  widened one by its GIN. That block covers TEXT, NUMBER and a widened SELECT today and has **no
  RELATION case at all**, which means the property this whole stage is designed around is currently
  unguarded. Worth adding even if Stage 2 is dropped.
- `test/e2e/filters-multi.spec.ts` and `relations.spec.ts` — numeric filter params in the URL.

---

# Documentation

Each task above carries its own doc edits under step 8 of the definition of done. These are the
cross-cutting rewrites that belong to no single task; they land with the last task of their stage.

### D1. `decisions.md` — correct the identifier decision

**The one that must not be skipped.** `### Record.number instead of an auto-incrementing PK`
currently ends "So `id` stays an unguessable `cuid()` for reference and addressing, and `number` is
a separate display column." That sentence becomes wrong the moment T6 lands.

**Rewrite it, do not append a correction beside it** (`CLAUDE.md` §12). What survives: why a global
sequence was rejected (cross-tenant numbering, leaked row volume, enumerable ids) — that argument is
unchanged and now applies to `Table.number` too. What changes: `number` is no longer "purely
display"; it is the **public address**, and the cuid is the **reference**.

Then one new entry — `### Public numbers address, cuids reference` — carrying, in the short form the
file uses:

- The rule from §1 of this plan, and the two things that stay cuids (stored relation values,
  `field-indexes.ts` naming).
- **Why the enumeration risk is acceptable, and what it is conditional on.** A cuid is unguessable,
  so a `where` that lost its `userId` used to leak rows nobody could address; with numbers the same
  bug is a `for i in 1..n` sweep. What makes it acceptable is that ownership is not forgettable —
  `server/utils/handler.ts`'s factories produce the context from the check. That is now
  **load-bearing for security, not just for tidiness**, and the note belongs next to the factories'
  own doc comment as well.
- The `0` sentinel and why it is not a thrown 404 (T4).
- Why fields get no number, with `Field.key` named as the identifier to reach for if that changes.
- **Rejected:** numbering `Record.data`'s relation values; a global sequence; a central id-mapping
  layer.

### D2. `decisions.md` — the Stage 2 asymmetry

`### A relation filter is resolved from numbers to ids before the SQL sees it`, covering: the pure
shared codec that cannot do I/O; the index that a subquery would defeat (with the `filterIndex`
values named); and the widening trap with its remedy. Without this entry, someone will "simplify"
`resolveFilterTargets` away and the failure is invisible — the list just comes back wrong.

### D3. `architecture.md`

- **§4 Record identity** → the section now covers both entities. Table numbering, its counter, and
  the same high-water-mark contract.
- **§6 Relations** → `RelationFieldCell`'s link is built from the target table's **number**,
  resolved through the tables store, and why that source rather than the options response.
- **§7 Wire formats** → the `?detail=` format; the "outside the cuid alphabet" sentence; and, at
  Stage 2, the bullet reading "A RELATION carries the target record's **id** (`?company=clx…`)".
- **§2** → the `TRecordFilterValues` bullet currently ends "nothing translates it into anything
  else". Stage 2 makes that false. Rewrite it to name the one translation and where it happens.
- **§3** → the `filterValue` key in the field-type module contract.
- **§10 Module map** → `shared/utils/table-address.ts`.
- **§11** → unchanged (T10).

### D4. `CLAUDE.md` and `limitations.md`

- **§5** — a table-scoped route param is a number, parsed through `numericRouteParam`, with the
  sentinel rule stated beside the existing `''` one.
- **§9** — the `filterValue` key in the three-module table.
- **`limitations.md`, Accepted** — three new entries, each with the trigger that reopens it:
  - **Public numbers are database-local.** A cuid survives a move between environments; a number
    collides. _Trigger: any import/export or multi-environment feature._
  - **A URL discloses how many tables or records exist.** `/tables/12` implies at least twelve.
    _Trigger: a sharing feature that shows a URL to someone other than its owner._
  - **Existing cuid links break** — only if D-a lands as "no shim".

---

## Sequencing summary

**Stage 1:** T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → (T9) → T10 → (T11) → D1, D3, D4.

T3 before T4–T8 on purpose: it makes `npm run typecheck` enumerate every call site the rest of the
stage has to visit, which is a better work queue than a grep. T1 and T2 are the only pair that must
land together — a schema with a required column and no allocator is a broken create.

T9 and T11 are conditional (D-b, D-a) and can be dropped without disturbing anything.

**Stage 2:** T12 → T13 → T14 → T15 is folded into each → D2, plus D3's §2/§7 edits.

**Between the stages the app is coherent**, not half-migrated: the path and the detail chain are
numeric, and a relation filter still carries a cuid. That is a visible inconsistency in the query
string and it is the reason Stage 2 should not be left indefinitely — but nothing is broken while
it waits.

---

## What this plan does not cover

- Any change to how records are counted, paged, sorted, searched or indexed. The SQL layer is
  untouched by design, and T14's test list says so explicitly.
- Field addressing (§2), stored relation values (§2), and the `field-indexes.ts` naming scheme.
- Keyset pagination, which the retired database plan deferred with its own trigger. It shares a
  surface with this work (both change the URL contract) and neither depends on the other.
- Any UI that would _display_ a table number. Nothing on screen has asked for one; the number's job
  here is to be readable in the address bar.

---

## Completeness review

Checked against the layers this repository actually has, so a reader can see what was looked for
rather than trusting that nothing was missed.

| Layer                              | Touched by                                                          |
| ---------------------------------- | ------------------------------------------------------------------- |
| `prisma/schema.prisma` + migration | T1                                                                  |
| `server/db/`                       | T3 (`tables.ts` select/mapper) — **not** `record-sql.ts`, by design |
| `server/services/`                 | T2, T6, T14                                                         |
| `server/utils/`                    | T4, T5, T6, T9 (`error-log.ts`)                                     |
| `server/api/`                      | T6 — every route under `tables/`                                    |
| `shared/types/`                    | T3, T12                                                             |
| `shared/field-types/`              | T12                                                                 |
| `shared/utils/`                    | T4 (new `table-address.ts`), T7                                     |
| `shared/validation/`               | T12                                                                 |
| `app/api/`                         | T8                                                                  |
| `app/stores/`                      | T8, T13                                                             |
| `app/composables/`                 | T8 (`useRecordDetail`, `useDetailLink`, `useTableLoader`)           |
| `app/pages/`, `app/components/`    | T8                                                                  |
| `app/field-types/`                 | T8 (cell), T13 (filter control, summaries)                          |
| `app/plugins/`                     | T9                                                                  |
| `test/` fixtures + seed            | T10                                                                 |
| all four test projects             | T10, T15 (folded into T12–T14)                                      |
| `docs/` + `CLAUDE.md`              | D1–D4                                                               |

**Deliberately not touched, each for a stated reason:** `server/db/record-sql.ts` and
`server/db/field-types/` (T14's design constraint), `server/db/field-indexes.ts` (§1),
`shared/constants/filter.ts` (the reserved params do not move), `app/assets/scss/` and
`docs/concept-d-workspace.html` (nothing visual changes), `README.md`.

**Three risks that would not show up as a failing test unless the listed test is written:**

1. A relation filter that resolves to nothing **widening the list to the whole table** — T14, and
   the integration case asserting `total` is zero rather than the table's size.
2. A malformed numeric route param reaching Prisma as `NaN` or an `Int` overflow, producing a 500
   where a 404 is owed — T4's case table.
3. A slug carrying a user-authored table name into the error log, defeating a redaction contract
   that is documented as structural — T9's second half.
