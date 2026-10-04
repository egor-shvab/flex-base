# Decisions

Why the code is shaped the way it is. Each entry exists because the alternative looks obviously
better until you know the reason — treat these as **load-bearing**: do not "clean them up" without
reading the entry. Rules live in `CLAUDE.md`, contracts in `architecture.md`, known gaps in
`limitations.md`.

---

## Tooling & module resolution

### Everything except components is imported explicitly

`autoImport: false` (app and Nitro) also stops Nuxt generating the global `.d.ts` declarations, so a
missing import has no global to resolve against and fails `vue-tsc`. The component scan stays
(`pathPrefix: false`): it code-splits `<Lazy…>` for free and keeps `<NuxtLink>` / `<Icon>` working.

**Server code must not import from `#imports`:** `.nuxt/types/nitro-routes.d.ts` pulls every handler
into the **app** TS project, where `#imports` is the app's module and `defineEventHandler` is not
found. Hence `h3` and `nitropack` are direct dependencies — keep their versions in step with Nuxt's.
**`#server` is server-only:** Nuxt's import protection rejects it in app and shared code.

### An alias-prefixed `no-restricted-imports` pattern must be a `regex`, not a `group`

`group` patterns use gitignore syntax, where a leading `#` starts a comment — `#server/services/*`
matches nothing and the rule silently enforces nothing; escaping does not help. Only the relative
patterns (`./*`, `../**`) may be groups. Verify a new rule by writing a violating file and watching
ESLint fail.

### `ofetch` is declared; `vue-router` is not

`app/utils/api-error.ts` imports `FetchError` by name; undeclared, it resolves only through npm
hoisting and a hoisting change breaks `typecheck`. `vue-router` stays undeclared — nothing imports
it and Nuxt owns the version.

### `@iconify-json/material-symbols` is declared even though nothing imports it

`@nuxt/icon` serves an installed collection from disk and otherwise fetches each icon from the
public Iconify API at runtime. Dropping the package fails no build; it just puts every icon back on
a third-party host. One family only — Material Symbols, outline-rounded names — as the design
reference draws. No `icon: {}` block: `serverBundle: 'local'` would only restate `auto`.

### Webfonts come from `@fontsource`, and `@nuxt/image` is not installed

Archivo and IBM Plex Mono are imported per weight in `nuxt.config.ts`'s `css`, so no font host sits
on the render path. Rejected: the reference's Google Fonts `<link>` (third-party request), and
`@nuxt/fonts` (a module for two import lines). **A weight that is not imported is synthesised by the
browser** — keep `font-weight` within Archivo 400–700 and Plex Mono 400–500, or add the import.

The app renders no images, so `@nuxt/image` was removed. Re-add it, and its performance rule in
`CLAUDE.md` §7, when a real image exists.

### The built output is started by one launcher, and its import must stay dynamic

`.output/server/index.mjs` sets `globalThis._importMeta_` in its module body, but ESM hoists
imports, so the bundled Prisma client evaluates first and shims `__dirname` from the placeholder
`file:///_entry.js` — fatal on Windows (`ERR_INVALID_FILE_URL_PATH`). `scripts/serve-output.mjs`
sets it before a **dynamic** import. **Making that import static reintroduces the crash.**
`scripts/preview.mjs` is the same launcher plus the root `.env`, kept separate because loading
`.env` is the one thing the e2e suite must never do.

### `.gitattributes` pins `eol=lf`, and the index must not be renormalised

Without it, `core.autocrlf: true` on Windows checks out CRLF and a fresh clone fails `format:check`
with empty diffs. **Never run `git add --renormalize`**: the index is already `i/lf`; only the
checkout was ever wrong.

---

## Testing

### `unit` and `nuxt` are separate projects, not one with a mixed environment

A `node` config cannot load a store at all (`useApi()` puts `#imports` in the graph); one all-`nuxt`
project makes every fast spec pay a Nuxt build. Rejected: a per-file `@vitest-environment nuxt`
pragma (the Nuxt environment is also Vite plugins, with no file-level form), and hand-stubbing
`#imports` (a second definition free to drift). `@nuxt/test-utils/module` is not in `nuxt.config.ts`
— it is DevTools integration, not needed to run the environment.

### Specs are colocated, and the project is named by suffix

The generated `.nuxt/tsconfig.*.json` already include `app/`, `server/` and `shared/`, so a
colocated spec is type-checked with no config; a `tests/` tree would need its own. `*.nuxt.spec.ts`
makes the slow specs visible in a listing. The shared `IField` builder is test-only, so it lives in
`test/fixtures.ts`.

### The SQL builder is unit-testable because it never executes

`server/db/record-sql.ts` uses `Prisma.sql` / `Prisma.join` and no client, so `.text` and `.values`
can be asserted offline — pinning the layer where a mistake (a widened filter, an unescaped
wildcard) costs most. It needs `prisma generate` to have run (`postinstall`).

### A duplicated test is a cost, not insurance

A slow copy one layer up is read as the place to add cases; a check the compiler already enforces (a
total `Record<TFieldType, …>`) can only be green; a restated constant turns a design change into a
broken build — assert agreement with `shouldSearch()` instead (`app/utils/select.spec.ts` owns that
boundary). Keep only the half a layer uniquely answers (e.g. the cursor's painted outline, since
`test.css` is `false`). **Do not restore a deleted duplicate out of caution.**

### A spec never ends with `wrapper.unmount()`

A failing case never reaches its last line, so its component stays mounted into the next one — that
is how a `window` listener leaked across cases. `mountTracked` + one `afterEach(unmountAll)` tears
down regardless.

### The accessibility gate blocks on serious and critical only

Admitting `moderate`/`minor` means a long disable list or a gate that is never green. Raise the bar
by narrowing `BLOCKING_IMPACTS` in `test/e2e/setup/a11y.ts`; a rule ever turned off goes in that
file with its reason, never at a call site.

### Coverage is merged from two runs, not collected in one

`server/api/` and `server/middleware/` are reachable only from `integration`; folding it into
`test.projects` would make `npm run test` want a database. Each run writes a blob and
`vitest run --merge-reports --coverage` merges. Rejected: excluding those globs (files at 0% teach
readers to skim red). Load-bearing:

- **Merge with `vitest run --merge-reports`, never bare `vitest`** — merging refuses watch mode,
  which bare `vitest` enables only in a developer's TTY.
- **The scope lives in `vitest.coverage.config.ts`**, imported **with its `.ts` extension**
  (`configLoader: 'native'` cannot resolve it otherwise).
- **The integration run measures the server half only** — `app/field-types/**` imports `.vue`, which
  node cannot transform.
- **`.vitest-reports/` holds nothing but blob files** — `readBlobs` throws on a subdirectory and
  merges every file it finds.

### Decided against, in testing scope

Revisit only with a reason that has changed: parallel e2e/integration (one database); a hard
coverage threshold (it invites writing to the number); more browsers; mutation testing, snapshots,
visual regression; a mobile Playwright project (`test.use({ viewport })` in `mobile-shell.spec.ts`
covers it).

---

## API & data access

### A record's fields live in one JSONB column, not in an EAV table or per-table columns

Measured, not argued. EAV was slower on every axis (≈8× on filters and writes, 3× storage).
Per-table physical columns read faster but did nothing for the count every list pays, cost catalog
space per empty table, turn `createField` into `ALTER TABLE` in a request, and retire `CLAUDE.md`
§1's "a new field needs no new code". The price — no index until a field asks for one — is what the
indexing rules manage.

### Ownership lives in the `where` clause, not around the query

Fetch-then-check is TOCTOU and one forgotten branch from a leak; scoping in the query makes "not
yours" and "not there" one path, which is what makes 404-never-403 free (a 403 would confirm the row
exists). Ownership lives only on `Table.userId` — a denormalized `userId` on `Field`/`Record` could
not be kept honest. The helpers live in `server/utils/ownership.ts` and read `db/`, never
`services/`.

### Ownership is obtained, not remembered

The factories in `server/utils/handler.ts` produce the route context **from** the ownership check,
so no table or field can be reached without it; lint refuses `#server/utils/auth` under
`server/api/tables/*/**`. One factory per `require*` helper — rejected: one factory with an options
bag (the branch comes back, as a flag). Each is **generic in its return type**; flattening to
`unknown` would silently widen every response type. `[tableAddress].patch`/`.delete` use none: their
services take a `userId` and scope on it in their own `where`, so the signature already requires
ownership.

### A service is one plain object, not loose exports and not a class

The call site names the layer (`FieldService.createField`). Full method names stay — the object
qualifies, it does not abbreviate. Members are module-scope functions listed in the object, so **no
member depends on `this`** (a destructured method would throw). The literal is the public surface
(`widenToList`, `assertNotRelationTarget` are absent). No annotation, no `satisfies`, no
`Object.freeze`.

### The four count-moving writes repeat their counts call, and that is the end state

Each ends `table: await TableService.getTableListRow(…)`. Every extraction is worse: a helper in
`utils/` cannot import services (lint), which also rules out a factory in `handler.ts`; a service
calling `TableService` couples fields and records to a count for nothing.

### Registration has no uniqueness pre-check

`findUnique`-then-`create` races: both requests see nothing and the loser becomes an unmapped 500.
The `create` is the check, and `P2002` becomes the 409. A duplicate pays a bcrypt hash first, which
also removes a timing tell.

### The persistence layer does not speak HTTP

`db/` classifies (`isUniqueViolation`, `isMissingRow`); `utils/http-errors.ts` maps. The `h3` ban on
`server/db/**` needs **`paths`** — an import of a package is invisible to alias patterns. Rejected:
a central message registry (most messages **are** the business rule and belong beside it); domain
errors with a boundary mapper (`createError` with extra steps, one transport).

### Public numbers address, cuids reference

**Paths address, payloads reference.** A URL names a row by its per-parent public number; a payload,
`Record.data`, `targetTableId`, `linkedRecords` and index names use the cuid. A global sequence was
rejected: it numbers across tenants and leaks platform volume.

**An address is a number _or_ an id, permanently — a rule, not a migration aid.** It costs two
functions (`tableWhere`, `recordWhere`); a cuid is never all digits, so the forms cannot collide.
**Do not "clean it up":** ids are in API responses regardless, so dropping the id form hides nothing
and breaks every copied link.

**The enumeration risk is accepted on one condition:** with numbers, a `where` that loses its
`userId` becomes a `1..n` sweep of every tenant. What makes that acceptable is that ownership cannot
be forgotten — **the handler factories are load-bearing for security.** Fields get no number; if one
ever needs a public name it is `key`. Rejected: renumbering stored relation values (rewrites every
JSONB row and rebuilds indexes for a value nobody reads); a central id-mapping service.

### A relation filter is resolved from numbers to ids before the SQL sees it

`RelationService.resolveFilterTargets` runs in `listRecords` just before `buildRecordWhere`, so rows
and count share one resolved map. Not in the codec: it is pure and shared with the client;
resolution is I/O. Rejected: comparing through a subquery on `"Record"."number"` — same rows, but
the indexed expression stops being used (only a plan shows it; `field-indexes.integration.spec.ts`
asserts one).

**Every requested value survives, resolved or not.** Dropping an unresolved one can empty a list
filter; `containsAny` answers `null` for an empty list, `buildRecordWhere` skips `null`, and the
list **widens to the whole table** silently. A passed-through number matches nothing, because
`assertRelationTargets` guarantees stored values are live cuids. The integration spec asserts the
count too.

### The redundant single-column indexes were dropped — do not re-add them

`Table_userId_idx`, `Field_tableId_idx`, `Record_tableId_idx` were left prefixes of composites and
cost only writes. `@@index([tableId, createdAt])` serves the `DESC` default — Postgres scans a
B-tree backwards.

### The `record_number` migration is hand-written

A required column over existing rows: added nullable, backfilled with
`ROW_NUMBER() OVER (PARTITION BY "tableId" ORDER BY "createdAt", id)`, set `NOT NULL`. `migrate dev`
cannot generate it; use `--create-only` for any future one (`CLAUDE.md` §5).

### Server errors are recorded from Nitro's `error` hook, and only the 5xx ones

A Nitro plugin, not a per-handler wrapper: h3's `onError` reaches every route, the auth middleware
and SSR, so a handler logging for itself would only duplicate it.

- **The hook stays synchronous and unawaited.** Nitro fires it with `callHookParallel` without
  awaiting it into the response — the only reason the sink may touch disk.
- **Only 5xx or status-less errors are logged.** Every 4xx is a deliberate outcome, and a zod 400
  carries `error.data.issues`, which echoes the submitted value.
- **The redaction is structural, not a scrub.** An entry is built from method, pathname, query
  parameter **names** and `context.user.id` only — never headers (`auth_token`), body (passwords),
  query values, `error.data` or email. Rejected: logging the event and stripping known-sensitive
  keys — a filter list is something a later change forgets to extend.
- **The browser reports through the same contract** (`api/client-errors.post.ts`): every entry leads
  with `source`; the user id comes **from the cookie**, never the body; the path is cut at the first
  `?`; the report is a closed schema. Both sources write through `recordErrorEntry`.
- **The endpoint is unauthenticated on purpose** (an error on the login page is worth having), so it
  carries its own guards: the **`content-length` check runs before the body is read and refuses a
  missing length** (or chunked encoding is an uncapped path into memory); the **rate limit keys on
  the socket address, not `x-forwarded-for`** (a spoofable header would make it opt-out; behind a
  proxy it fails too strict, which is the right direction).
- **The client plugin's `.catch(() => {})` is the loop breaker** — an unhandled rejection from the
  report would be reported again forever.
- **`utils/error-log-file.ts`:** NDJSON, so a multi-line stack is one line; `writeSync`, not a
  stream, so the last entry before a crash is not lost; the descriptor is closed before renaming
  (Windows refuses to rename an open file); generations rotate highest-first.
- Rejected: an `IErrorSink` interface — one destination; swapping it is an edit to
  `recordErrorEntry`.

---

## The metadata layer

### The client/server contract is declared, not inferred

`shared/types/api.ts` names each response envelope; the handler annotates its return type with it
and `app/api/` reads it, so renaming a key fails to compile on both sides. Rejected: Nitro's
route-type inference — it cannot type the path builders and does not carry through the
`useRequestFetch` seam. Only envelopes are declared there (`IRecordPage`, `IRecordDetail` are whole
responses already). Store specs still stub with `registerEndpoint`, not by mocking `app/api/` — that
module is transport, not a seam.

### A row's timestamps are mapped, not left to `JSON.stringify`

`ITable` declares ISO strings and Prisma returns `Date`s; agreeing through `toJSON` is a contract no
type checker watches. `db/` maps them; the wire output is byte-identical.

### There are no operators, anywhere

A filter's **value** is its whole contract; how it compares is the field type's business, declared
once in `FIELD_SQL_BY_TYPE`. No operator travels in the URL or appears in a control, which is what
keeps the drawer, codec, summary and SQL free of per-operator branches. Consequence: a multi-value
filter can mean only _any of_ (`limitations.md`).

### A record reference is a number plus a nullable label, never a pre-flattened string

`ILinkedRecord` is `{ number, label: string | null }`, because only a renderer knows whether it can
style the two apart and `#3 Example` cannot be taken back apart. Hence `buildRecordLabel` answers
`null` rather than `#<number>` (else `#3 #3`). **Only `formatLinkedRecord` and `BaseLinkedRecord`
write a `#`, and both require a real number**; a deleted target degrades to `UNKNOWN_RECORD_LABEL`
with no number. A relation sorts by label, not by number — sorting by number would reorder every
picker to match a tiebreaker.

### A field type is three modules, one per slice, and the bundler is why

One folder per type is what cohesion wants and the build refuses: a module holding the value schema
and the SQL rules drags `Prisma.Sql` into the browser bundle, and `.vue` cells cannot enter Nitro.
**The split is by what each bundle may contain, never by concern** — the test for any further split.
Consequence: the filter summaries share a module with cells, so `summaries.nuxt.spec.ts` runs in
`nuxt`; do not split summaries back out to save its startup.

Inside `shared/`, a type's filter shape and value schema share one module because the per-type
folder imports nothing from `utils/` or `validation/`; **a lint rule keeps that cycle dissolved** —
one import back recreates it and still compiles. Co-location does not make the `MULTI_*` invariant
specs redundant (`CLAUDE.md` §10).

### `cellComponent` is the one resolver that does not live in its registry file

It returns `MultiValueCell`, which imports `FIELD_CELLS` from `registry.ts`; moving `cellComponent`
into `registry.ts` to match `inputFor`/`filterFor`/`summaryFor` creates a cycle. **`registry.ts`
must never import `MultiValueCell`.**

### Inputs, filters and config summaries are data; only cells are components

A cell carries markup and scoped styles, so it is a component; an input or filter names a `Base*`
control plus adapters, so it is a row; a config summary is a function returning a string, with its
context supplied by the caller — a registry entry reading a store itself would use Pinia's
module-global instance, a cross-request hazard under SSR. `RelationFieldSelect` is the one exception
(its candidates come from another table).

### A choice's identity is its own text

`Record.data` stores the choice string, not an option id, so the SQL layer, filter constants and
codec stay out of colour. Cost: renaming a choice orphans old records (`limitations.md`). An option
id buys nothing for colour and rewrites `record-sql.ts`.

### A SELECT choice is coloured from a closed palette, not a free colour picker

A hex picker would put a literal colour past the token boundary, lose the authored 4.5:1 text
pairings, and store a value that cannot follow a re-theme. A **name** (`"blue"`) is stored, so a
later widening needs no migration. The fourth hue is stored as **`yellow`** although the design
reference calls it `amber` — a stored name is a closed vocabulary (`CLAUDE.md` §6); only its values
were retuned.

### Multi-value is a per-field flag, not a pair of new field types

`MULTI_SELECT`/`MULTI_RELATION` members fail on the only conversion anyone needs: `updateField`
rejects a type change, so a single relation could never become multi without re-entering every link.
A flag can be flipped with a migration. The compiler's guarantee moved rather than vanished:
`MULTI_VALUE_BY_TYPE` and every `MULTI_*` table are total, and `isMultiValue(field)` is the single
reader, whose guard keeps a stale `options.multiple` on an incapable type out of the schema and SQL.

### Multi is a lifting of the single-value spec, not a second set of specs

"Several" is one uniform transformation of "one": `base` → `z.array(base)`, `=` → `?|`, a cell → a
row of that cell, `BaseSelect` → `BaseSelect multiple`. The branch exists once per registry, in its
resolver; nothing downstream learns `multiple` exists. Duplicates in a stored list are **rejected,
not deduplicated** — no control can produce one, and a `.transform()` does not belong in a layer
that only judges.

### One value union, narrowed by shape — and a prop type is a runtime contract

`TRecordValue` includes `string[]` and stays a subset of `TFilterValue`, so the existing shape
guards serve both sides. `isRangeFilterValue` must exclude arrays (an array is a non-null object).
**`defineProps<T>()` compiles to a runtime prop check**, so `IFieldCellProps.value` stays
`TRecordSingleValue`: widening it would admit `Array` into every per-type cell and switch off a
check that catches routing bugs — `MultiValueCell` takes its own props. `listBase` exists because
only a string-valued type can be stored as a JSON array. Blankness includes `[]`, or a cleared multi
field renders as nothing instead of "Not set".

### Cardinality is one-way, and a multi-value column sorts by its first value

Widening runs `widenToList` — one scoped, idempotent `UPDATE` that skips arrays and JSON `null` —
**inside `updateField`'s transaction**, so metadata and rows cannot disagree. Narrowing is a 400:
lossy, with no non-arbitrary survivor. A row written before the flip can still be a scalar, so
`toValueList` (client) and `collectRelationTargets` (server, which also rejects non-string elements)
tolerate one. Sorting by the first value is the one visible in the cell; rejected: making the column
unsortable (threads `sortable` through table, schema and SQL) and ordering by length.

### A multi-value filter is a repeated param, not a delimited one

`?stage=Won&stage=Lost`. A choice is free text, so any delimiter needs escaping, which fails
silently. "A repeated param is a 400" became per-shape: only a `list` claim reads repeats. Values
are sorted on serialize so one selection has one URL. `FILTER_VALUES_MAX` caps it in the schema
(each value is an `IN` term), and the codec caps and dedupes independently because it also runs over
an unvalidated `route.query`.

### The `?|` operator, never the `jsonb_exists_any` function

PostgreSQL matches **operators** to index operator classes, never the equivalent function, and an
opaque function also gets no selectivity estimate (it guesses a third of the table). So
`containsAny` emits `?|` and `widenToList` tests `data ? key`. A literal `?` is safe:
`@prisma/adapter-pg` binds `$1`. The operator answers correctly for a bare scalar — not a substitute
for the migration. If a driver ever mangles `?`, the fallback is `@>` with an OR per value. A GIN
serving it must be on the **sub-path** `(data->'key')`.

### `searchPredicate` is a predicate, and it is separate from `expr`

A multi-value column asks whether _any element_ matches, which no projection plus `ILIKE` can
express; substring-matching the raw `["Won","Lost"]` lets `","` match every row. It is separate from
`expr` because NUMBER and BOOLEAN cast there and neither type has `ILIKE`: NUMBER searches the
un-cast text, BOOLEAN opts out (`e` matches every `false`), RELATION opts out (it stores a cuid, and
matching labels would drag the target table into the unbounded count). **The
`jsonb_typeof(…) = 'array'` guard must be inside the function's argument** (a `CASE`) — as a sibling
`AND` it is not guaranteed to run first.

### The query schema validates; the codec decodes

`buildRecordQuerySchema` has no `.transform()`; `parseRecordQueryState` — lenient, the exact inverse
of `toRecordQueryParams`, shared by page and endpoint — builds the domain model. That keeps
`utils → validation` acyclic and means a link cannot decode two ways.

- **Unknown params are ignored, not rejected** — with bare field names a typo is indistinguishable
  from `utm_source`. A malformed **known** param is a 400.
- **A reserved param is refused symmetrically.** The encoder **drops** reserved names rather than
  writing them last (the reserved writes are conditional, so a legacy field keyed `search` would
  otherwise become a site-wide search); `claimFilterParams` seeds its set with them. The drop is per
  param name, so a NUMBER keyed `page` keeps `page_from`/`page_to`. Such a field claims nothing, so
  `filterableFields` removes its control (no dead control) but it still renders and sorts.
- **A blank `?search=` is absent**, in the schema as in the codec (a preprocess maps
  blank-after-trim to `undefined` before the length floor). `?search=a` is still a 400.

### Search is an indexed pre-filter in front of the exact predicates, not a replacement for them

`record_search_text(data, "number") ILIKE …` against the trigram GIN is ANDed in front of the
per-type OR group, which still decides. Replacing the group would drop NUMBER (stored as a JSON
number) and add RELATION cuids. So the flatten must be a **superset**: over-inclusion is free,
omission is a row search can never return with no error — the superset test guards it. The
expression and the index are one contract (matched structurally), and `record_search_text` must stay
`IMMUTABLE` with a pinned `search_path`.

**`SEARCH_MIN_LENGTH` (3) is enforced by the schema**, because a shorter term cannot use the trigram
index and the count cannot stop early; it moves only if the index does. A spec should derive its
term from the constant.

**A search is the same query shape as any list; the planner chooses.** A `MATERIALIZED` CTE forcing
search first made cost track the match count (7.4 s vs 2.7 ms on a common term); unhinted, the
planner picked correctly at every selectivity tried, stale statistics included. Accepted: one
mid-selectivity search + RELATION sort is ~28% slower.

### Relation option search deliberately does **not** enforce `SEARCH_MIN_LENGTH`

None of the floor's reasons hold there: one expression over one table, no count query, a hard
`LIMIT RELATION_OPTIONS_LIMIT`, a debounce. A floor would make one typed character show the
unfiltered seed (looks broken). The bound is `max(100)` on the term. Do not harmonise the two on the
strength of the word "search".

### A relation orders through a joined derived table, not a subquery per row

A per-row label subquery cost ~1.5 s over 800k rows; a join costs ~0.4 s, ~0.17 s with the field
opted in (the join probes `data ->> key`, which the relation's _filter_ index covers). **The join
must be a derived table exposing renamed columns** (`target_id`, `target_label`): a plain self-join
on `"Record"` makes every unqualified column ambiguous. It is `LEFT` and narrowed to the target
table, so a dangling or foreign link keeps its row and sorts last. `sortIndex` stays `null`.

### An index is opted into per field, and built out of band

Rejected: threshold-driven (indexes what nobody sorts by) and usage-driven (needs counters off the
request path). Keep the set small: the first index over `data` ends heap-only-tuple updates for the
whole table. `CREATE INDEX CONCURRENTLY` is fired and **not awaited** (it can run for minutes); a
failure is **recorded straight to the sink, never rethrown** — off the request path an uncaught
throw would take the process down. `reconcileFieldIndexes` drops an **invalid** index from a failed
build first, or `IF NOT EXISTS` would skip the rebuild forever. The per-direction and naming rules
are `architecture.md` §9.

### The count is bounded, and Next does not read the page count

An exact `COUNT(*)` is `O(rows)` on every list view; counting to `RECORD_COUNT_CAP + 1` is flat, and
the extra row separates "exactly the cap" from "more". Past the cap `pageCount` is a floor, so
**Next follows whether the page came back full**, never `page >= pageCount`. `Table.recordCounter`
is a high-water mark, not a count.

### Type-only imports are invisible to HMR, and `compiler-sfc` caches resolved types

`import type` is erased, so it is no edge in Vite's graph, and `@vue/compiler-sfc` caches resolved
type scopes. **A type in a Vue prop warning that does not match the source means a stale dev
server** — restart it. The toolchain emits a runtime `type` only for primitive unions, so an absent
type on an array prop is normal.

---

## Frontend

### A layout and a page must never share a `useAsyncData` key

It does not dedupe a layout against a page in one SSR render: two requests, warning `NUXT_E3004`,
and the page's closure is silently never called. The layout owns `app-tables`.

### A cached count is received, not computed

The four writes that move a table's `_count` answer with the refreshed list row, which
`applyTableRow` stores. Rejected: client-side delta arithmetic (needs a floor at zero, drifts across
tabs, makes two stores write into a third). Edits move no count, so they do not carry it; which
writes do is this paragraph, not a type. A row for a table the list does not hold is **ignored,
never inserted** — an empty list is legitimate (`ensureTables()` never throws), and inserting would
leave the sidebar listing one table.

### A failed refetch is visible, not silent

`fetchRecords` sets `failed` and **rethrows**; the page's `watch` swallows it and shows a banner,
and the initial load needs the rejection for `useAsyncData`'s 404. The empty state is suppressed
while `failed`, and while a fetch is in flight **with no rows to show** (switching tables clears
rows before the outgoing page unmounts) — that state is `RecordsTableSkeleton`. Conditioned on the
row count, not on `pending`: an in-place refetch keeps its rows and says "Filtering…". Opposite call
from `useDeleteConfirm`: the rule is whether anyone is listening.

### The records page is not split further, and its length is not the reason to

Every seam traded markup for plumbing: the header needs most of the page's bindings, the four
dialogs need more props than markup, and the body's four states are one decision. A split must buy
separation — as `TableFieldList` did (self-contained markup, one prop) — not move lines.

### Both metadata renderers resolve their controls through one composable

`useFieldControls` resolves registry entries inside a `computed`, so each control's `props(field)`
factory runs once per field-list change, not per render — its spec pins the call count. **No
identity defaults for a missing adapter**: the composable is generic so `RecordForm` keeps required
adapters (`TRecordFieldControl`) and the drawer optional ones.

### `useDeleteConfirm` catches instead of re-throwing

Every call site binds `confirm` straight to `@confirm`, so a rethrow was an unhandled rejection
behind a silent dialog. The message clears on two paths: a `watch` on `target`, and at the start of
`confirm()` because a retry keeps the same target.

### `useForm` watches a composite field deeply, and the flag is conditional

A field whose `initial` is an object or array is watched `deep` (an in-place `push` is invisible to
`Object.is`, so its error never cleared — SELECT choices). Not unconditional: `deep` should answer a
shape, and the shape is read off `initial`.

### `app/error.vue` is store-free

It must render when data fetching is what failed. **"Go back" reads `history.state.back`**, never
`window.history.back()`, which would leave the app from a cold-loaded error URL; with no entry it
goes Home. Three wordings — 404, other 4xx, 5xx — decided by `toPageError` and echoed by the page,
so a 5xx never blames the user's link.

### `stores/fields.ts` and `stores/relations.ts` carry no per-table guard

**Fields:** clearing on a table switch would show "This table has no fields yet" for a round trip,
since `pending` is false while the loader runs. The page body's state order — skeleton tested before
the fieldless state — is what covers the gap. **Relations:** `linkedByField` is keyed by field id
and the detail dialog caches fields of other tables, so there is no correct key to clear on;
merge-only for one session is the design.

### The records store is not a duplicated cache, and `useAsyncData` would not replace it

Most of what its spec pins is paging arithmetic and write orchestration (`isDefaultView`, the page a
created record lands on, `lastPage` step-back, in-place edit, refetching the page it is actually
on), which would only move. **`useAsyncData` discards `data` on error**, and a failed refetch here
keeps its rows under the banner. If revisited, key on `tableId` and pass the query through `watch`.

### In `getApiErrorMessage`, blank counts as absent

`??` lets `statusMessage: ''` win and render an empty error box. Candidates go through a `nonBlank`
`typeof` guard — not `||`, which would let a non-string through.

### Locales and time zones are hard-coded

`en-GB` everywhere, and `formatTimestamp` pins `timeZone: 'UTC'`: an `undefined` locale differs
between server and browser (hydration mismatch), and UTC keeps the displayed day equal to the day a
`::date` filter matches. `DateFieldCell` needs no zone because a date-only value parses to local
midnight.

### The active-table check compares `route.params.tableId`, not the path

`/tables/:id` is a prefix of `/tables/:id/settings`; the param marks the table active on both.

### `BaseBreadcrumbs` is prop-driven

Pages pass the `ITable` they fetched, which is also what produces their 404; deriving the name in
the layout from the store would delete that guard.

### `FieldFormModal` fetches the target's fields outside the fields store

That store holds the table being edited; loading another table's fields would clobber the page
behind the modal. Both of the form's fetches **catch** and drive a four-way `empty-label` (an empty
list and an unanswered request look the same by `.length`); the target's fields carry a monotonic
request id, as `useSelectOptions` does.

### The open record lives in the URL, not in a store

A relation is a link, and a link needs an `href`: `?detail=` makes the cell a real `<a>` and gives
Back/Forward, refresh and SSR'd shared links for free. A row's View is a `<NuxtLink>` for the same
reason (hence `RecordsTable`'s `tableId` prop — a generic renderer must not read the route). A cell
**behind** an open dialog would append to the chain, but `inert` makes it unreachable. The detail
endpoint returns an **aggregate** (record, table name, fields, linked records) because the dialog
needs all three and the server needs the fields anyway. The title is static (`Record details`,
`{table} · #{number}` subtitle): a label is a property of the relation field, so a shared link could
not reproduce it.

---

## Components

### `BaseButton` renders the element its role implies

One component, one stylesheet: `variant` is the appearance, `to` the element. Rejected: a
`BaseLinkButton` (a second copy of six variants), an `href` prop (`NuxtLink` already handles
absolute URLs), a polymorphic `as` (lets a call site emit a `<div>` button). `to` takes a path or a
`{ query }` patch, never `RouteLocationRaw` (`vue-router` stays undeclared); `NuxtLink` is imported
from `#components`. **`disabled` wins over `to`** — every alternative rebuilds native `disabled`
from three mechanisms, and a JS click guard cannot get in front of `NuxtLink`'s handler
(`limitations.md`). A link activates on Enter only.

### An atom's `disabled` must be a declared prop, never attribute fallthrough

Fallthrough puts `disabled` on the wrapper `<div>`, where it does nothing: the control looks locked
and stays operable. Declare native form attributes and bind them to the **inner control**.

### `BaseInput` binds `:value` + `@input`, not `v-model`

`v-model` casts a `type="number"` value and writes `1.5` back while the user types `1.50`. The IME
composition guard is kept by hand. `BaseRange` resyncs **only a bound that disagrees with the
screen**, which separates an outside change from an echo.

### `BaseSelect` is an ARIA listbox **or** a combobox, never a `<select>`

A native `<select>` cannot colour options, search, load asynchronously, or state
loading/empty/failed. `searchable` picks the root only: `false` is a
`<button aria-haspopup="listbox">` named _label + value_, `true` an `<input role="combobox">`.
Costs, all deliberate: the OS-native touch picker (`limitations.md`); arrow keys changing a closed
value (they open instead, or a filter would fire a request per press). Hand-rolled type-ahead (500
ms buffer) on the button branch **must stay**.

- **The search input is the control and the selection is an overlay**, never the input's value — so
  searching never clears a choice and no restore-on-close exists. Rejected: APG's editable combobox.
- **`aria-labelledby="${id}-label ${id}"` must not cross to the input branch** — on an `<input>` it
  names from the value, changing with every keystroke; the input uses `aria-describedby` to the
  overlay instead.
- **The chevron is a 24×24 `<button>` with `tabindex="-1"` + `aria-hidden`.** The control already
  opens/closes from the keyboard, so a tab stop would be redundant and a name would announce one
  control twice. A click inside the combobox only opens (closing would make the middle of a term
  unreachable).
- **Opening on type is driven by the model, not `keydown`** — a printable-key test misses paste, IME
  and drop. `v-model` here needs no composition guard; do not copy `BaseInput`'s.
- **The panel teleports to `<body>`** because `inert` on `#__nuxt` is inherited; the native
  `popover` attribute changes paint order, not ancestry, so it cannot substitute.
- **Async options are stale-while-revalidating** under a `Searching…` row; the seed shows whenever
  the term is empty.
- **The blank option is a placeholder plus `clearable`**, never a real option; clearing still emits
  `''`, so the wire format and `blankIsNull` did not move.
- `BaseSelect` no longer pins `height` (its trigger is a `<button>` now) — do not re-pin it when it
  looks a pixel off.

### `searchable` is an explicit prop, and the threshold lives at the call site

Derived from `loadOptions` or the option count, search would be welded to the data source and
impossible to turn off; search and async are orthogonal. `shouldSearch()` exports the **predicate**,
not the number. A list fetched after mount hardcodes `searchable` — a derived value would swap
`<button>` for `<input>` under the user's focus. `loadOptions` is passed through **only when
`searchable`**, or a half-built async machine (dead `retry`, dead abort) ships. Rejected:
`searchable: 'auto'`; letting `loadOptions` imply `searchable`.

### `multiple` is tied to the model's type, and is read through `isMultiple`

`multiple?: TModel extends string[] ? true : false`, so a scalar model cannot be bound multi. The
cost: with no `Boolean` constructor to emit, a bare `<BaseSelect multiple />` arrives as `''` —
**falsy** — and `vue-tsc` cannot see it. **Never read `props.multiple`; read `isMultiple`.**
Internally selection is always a `string[]`, normalised through `toValueList`
(`app/utils/value-shape.ts`, named for shape so a generic atom imports no record-domain module — do
not duplicate it in the atom).

In `multiple` the control shows `Enterprise +2` ("and 2 more" to assistive tech), not chips: chips
make the height content-dependent, which `useAnchoredPosition` does not observe, and they would
shift every control below them in the drawer.

`BaseSelect` has one slot, `option-label`, **inside** `.base-select__option-label`: slot content
compiles in the caller's scope, so a row-level slot would lose the scoped truncation rules. No slot
for the value overlay — `valueText` is also the accessible name.

### Escape is swallowed only while something of ours is open

**Two `document`-level Escape listeners exist, and no more** — `BaseModal`'s and the shell's. The
shell's returns early inside an `inert` subtree, so the sidebar's own "Add a table" dialog takes the
first press. **`usePopover` registers no Escape listener and must never grow one:**

- where focus lives inside the panel, `@keydown.esc.stop` on the panel (`BaseColorPicker`,
  `RecordRowMenu`, the non-searchable select) — the panel exists only while open. Two document
  listeners could not be ordered instead;
- where the control keeps focus outside its panel (the combobox), `.stop` is wrong — the drawer
  could never close by keyboard while it has focus — so JS stops propagation only when `open`.

`.stop` survives the teleport: the panel is a DOM child of `<body>`, so its keydown still bubbles to
`document`.

**Tab moves into the panel before past the control**, because the teleport puts the panel's one
focusable (the failed state's Retry) after the whole app. Forward only; leaving the panel does not
cancel the default; `retry()` and `clear()` hand focus back to the control before unmounting the
button pressed.

### The active option's indicator is a 2px accent edge, and only the keyboard creates one

Under `aria-activedescendant` the option is not focused, so `:focus-visible` never matches, and a
wash alone is ~1.05:1 and equal to pointer hover. Hence the hover grey plus an **inset** 2px
`--color-accent` edge (a `box-shadow`, so `forced-colors` gets an inset outline — that media block
is not dead code).

**`activeIndex === -1` is a real state:** opening, the pointer or options arriving create no cursor
(a ring before navigation reads as a choice made); an arrow that opens the list does. **Enter with
no cursor does nothing.** Opening scrolls to the selection without highlighting it. **The re-clamp
watcher is `flush: 'post'`**; keying it on `active` instead re-clamps a cursor a printable key just
placed.

### `BaseSelect` is not split further, and its length is not the reason to

It is already decomposed: `usePopover` and `useAnchoredPosition` (split by consumer —
`BaseColorPicker` took one before the other; extracted only at a second consumer), and
`useListboxNavigation` / `useSelectOptions`, extracted for SRP and kept in `BaseSelect/` because a
directory can decline imports a comment cannot. `usePopover` keeps `containerRef` and `triggerRef`
separate — they differ once a clear button sits beside the trigger. The remaining seam, a
`BaseSelectPanel`, would split Escape, IDREFs, teleport and Retry from the two keyboard dispatchers
they depend on.

### `RelationFieldSelect` gets its `tableId` from the store, not from `IField`

`IField` has no `tableId`, and adding one would force `recordColumn()`'s synthetic fields to invent
one. `loadOptions(tableId, fields)` records it per field. `searchOptions` never writes
`optionsByField` (the seed others read) but does `cacheLabels`.

### A coloured badge carries a dot, not a border

The badge fill all but vanishes on a hovered row; the 6px `-dot` step clears 3:1 there and on white.
The dot is a `::before` with **empty** `content` (no accessibility object; a glyph would be a text
icon and reach the tree). **Do not simplify `variant === 'chip' && color !== undefined` to
`color !== undefined`** — a SELECT cell always has a colour, and the first half is what keeps
`--label` dotless. `BaseColorPicker`'s swatches keep their border: a swatch has no word to bound it.

### The badge palette is selected in JavaScript, by token name

`badgeTint()` composes `var(--color-badge-<name>-bg)` and returns inline custom properties. A Sass
`@each` would need the palette in both SCSS and TS, and a colour added to only one renders unstyled
with no error.

---

## Styling & tokens

### The token layer is three layers, and the build enforces the boundary

Primitives are SCSS variables in `_palette.scss`; `additionalData` injects only `functions` and
`mixins`, so a component **cannot** reach `$green-600` — a compile-time fact, not a convention.

### Colour tokens are split by job, not by value

- **Surfaces:** `--color-surface-hover` / `-disabled` / `-muted` share a value but are separate
  tokens; one `--color-bg` once meant four things.
- **Row wash ≠ control wash:** `--color-surface-row-hover` (`$gray-25`) is lighter because a hovered
  row is where a badge must survive — the `-dot` step clears 3:1 on `$gray-25` but not on
  `$gray-100`. Raising badge fills would break their 4.5:1 text.
- **Borders by job:** `-subtle` inside a surface, plain structural, `-strong` against the scrim,
  `-control` the only one with a floor (3:1 non-text). `$gray-450` exists for it, which is why
  inputs are darker-edged than the reference draws.
- **The accent and danger tints are opaque**, because each lands on both `--color-surface` and
  `--color-canvas` and an alpha tint would render differently on each.

### The sort icon is muted with `opacity`, not a colour step

It must mute whatever colour it inherits (secondary at rest, accent on hover); a fixed step mutes
only one. `0.35` sits under 3:1 deliberately (`limitations.md`). Text still uses colour tokens,
never opacity. Glyphs: `swap_vert`, `arrow_upward`, `arrow_downward`.

### Focus is never removed, only restyled

`_reset.scss` carries a zero-specificity `:where(…):focus-visible` baseline so nothing ends up bare.
**Two layers:** the indicator is `--color-focus` (a step lighter than the accent, floored at 3.23:1
against the halo — the pairing to check if it moves; the reference's `#2f9e6b` fails it), and
`--focus-ring-halo` is decoration.

**Where the indicator goes depends on whether the control has an edge:** a button, link, row or
option takes `focus-ring` (an outline); a form control takes `control-focus`, which recolours its
own border and suppresses the ring — both would draw two edges a hairline apart. Hence `CLAUDE.md`
§8's mutual exclusion. `control-focus` restores an outline under `forced-colors` (borders flatten
and shadows vanish) — not dead code. **Never move the indicator into the halo**: a `box-shadow` is
clipped by `overflow` and outranked by a component's own shadow. A component with its own
`box-shadow` composes the halo in one declaration; an inset ring sets `--focus-ring-halo: none`
(`BaseSelect`'s clear button).

### A truncating cell clips with `overflow: clip`, not `hidden`

`hidden` clips a descendant's focus ring (a relation link inside a cell). `clip` truncates the same
but honours `overflow-clip-margin`, written as `rem(4)` because **Chrome drops it to 0 for any
`calc()` or `var()`** — so it must move by hand if `--focus-ring-halo` does.

### The control height is 36px, and 44px was never the AA bar

AA is SC 2.5.8 (24×24); 44×44 is SC 2.5.5, AAA. Dropping from 44 removed 8px of height **and** 8px
of padding together — trimming height alone clips text. Every control that edits or commits a value
is one height; compact chrome (pager 30px, chip remove 24px) is the only tier below, and only for
navigation or a remove inside another surface. Derived heights are written as control + inset, never
a literal.

`--link` is the exception with no height, floored at 24 on **both** axes ("Edit" is 23px wide): row
actions sit 8px apart, so the spacing exception cannot carry them, and at 36 a text button would
read as filled.

### A ghost button's padding is spacing, so the gaps beside it are unequal on purpose

A ghost's padding is transparent, so it reads as gap: space it from its neighbour's **ink**. In the
records toolbar the ghost Filters sits `rem(10)` from the search, reading as the reference's 22px.
Normalising that gap is the regression; a `selected` ghost paints its plate and its padding stops
being gap.

### The header group needs `min-width: 0`, same as the panes

Where the `<h1>` shares a group with a second line, the **group** is the flex item, and its
automatic minimum is the whole untruncated nowrap title; `overflow: hidden` on the `<h1>` does not
change the group's min-content. Rejected: `flex: 1` on the group (pushes the action to the far
edge). The primary button takes `flex: none` through a page-owned class, or it shrinks and wraps its
label.

### `text-link` is a class, not a mixin

No per-site variation, so a shared block. It is the one look for a link **inside a sentence**; a
link standing alone in an action row is a `BaseButton` with `to` (header links at 21px failed SC
2.5.8's inline exception).

### The viewport lock lives in the shell, not in the records page

`app/layouts/default.vue` is `height: 100dvh; overflow: hidden`, and the panes scroll themselves.
Rejected: a `calc(100vh - …)` page height (restates the shell's header and padding, and lets the bar
scroll away). **`dvh`, never `vh`, app-wide** — a collapsing mobile URL bar leaves a `100vh` box
overhanging where the pager lives. **`min-width: 0` and `min-height: 0` on the panes are
load-bearing**: without them the main column's minimum is the table's full width and a pane of 50
rows outgrows its row, so neither `overflow` fires.

### A dialog caps against the scrim, and only its body scrolls

`.base-modal__dialog` is `max-height: 100%` of the scrim's **content box** (so it excludes the scrim
padding and re-resolves where `--drawer` zeroes it — a `calc(100dvh - …)` would restate it); the
body is `flex: 1; overflow-y: auto`. Uncapped, a tall dialog is centred off both edges in an
unscrollable shell. The scrim carries `max-height: 100dvh` because `inset: 0` sizes a fixed box to
the large viewport. Form actions sit in the pinned footer, the submit joined to its `<form>` by the
`form` attribute so Enter still submits. Below `below-compact` every variant is a bottom sheet
capped at 90%, with no grabber (it could not be swiped). The entry animation leaves no resting
`transform` (`animation-fill-mode: none`), which would contain the colour picker's fixed panel.

### The records grid sizes to its rows, not to the pane

`RecordsTable` takes `flex: 0 1 auto`: `flex-basis: auto` makes its content height the base, capped
by the pane. `flex: 1` left a void between seven rows and the pager — **do not restore it.** Empty
states centre with `margin-block: auto` on the child (nested so it outranks `BaseEmptyState`'s own
margin), not `justify-content` on the parent.

### `RecordsTable`'s sticky edges and row height

- **The sticky header's rule is an inset `box-shadow`**, not a border: under
  `border-collapse: collapse` the table paints that edge and it scrolls away. The `th` paints its
  own opaque background.
- **The pinned Actions column needs a wrapper `div` inside the `<td>`.** A `display: flex` `<td>` is
  not a table-cell box; the anonymous cell around it becomes the sticky containing block and
  `right: 0` cannot move. Its edge is a permanent `--color-border-subtle` hairline plus
  `--shadow-pinned-edge`. Rejected: a tinted fill (swallows row hover or reads as "selected"). The
  pinned cells are opaque, so `tbody tr:hover` repaints the actions cell. The corner header's
  padding rule is nested inside `thead th` for specificity — moved out, it silently stops applying.
- **Rows have an explicit height**, `calc(var(--control-height) + #{$cell-padding-y * 2})` on
  `tbody td`, and it is one decision with `$cell-padding-y`: a cell treats `height` as a minimum, so
  raising the padding alone grows every row. Written against the variable so it cannot drift.

### A table column's width cap lives on a wrapper, not on the cell

Under `table-layout: auto` one long value stretches its column off screen; `$column-max-width` caps
it, and `$content-max-width` subtracts the cell padding so value- and header-bounded columns match.
**The cap cannot go on the `td`** — `max-width` on a cell is undefined (CSS 2.2 §17.5.2) and
ignored; a block child's `max-width` does bound the column, so the inner wrapper is load-bearing
markup. Rejected: `table-layout: fixed` (needs a width per column, which metadata does not have); a
`--*` token (one component's measure); capping the sort button (it is `width: 100%` as the
whole-cell target, so the cap sits on its label).

- **`BaseBadge` truncates itself:** an `inline-flex` box is atomic, so the cell's `text-overflow`
  cannot ellipsise it. It also declares its own `height` **and `line-height`** (22px chip, 20px
  label), or it inherits each container's leading — the reason `test.css: false` cannot see it and
  only Playwright does.
- **`MultiValueCell` is `display: inline`:** as `inline-flex` a list was one atomic box,
  hard-clipped. Inline, the values that fit are drawn in full and the next gives way to an ellipsis.
  `RecordDetail` gets wrapping simply by not setting `white-space: nowrap`. The ellipsis is paint
  only — not machine-checkable (`limitations.md`).

---

## Decided against, structurally

Revisit only with a reason that has changed.

- **A repository layer per entity.** Prisma is already a repository; pass-through classes would hide
  "ownership lives in the `where` clause" behind method signatures. The wanted half — one home for
  selects, mappers and SQL — is `server/db/`.
- **Splitting `shared/` by domain.** Record, field and filter reference each other by design
  (`queryColumns`, `filterShapeFor`, the record schema), so domain folders would import each other
  on day one; the layer split is mechanically checkable. `field-types/` earned its folder by being
  acyclic.
- **Hexagonal / DDD on the server.** One transport, one database, no second consumer; every seam is
  available later at the same cost.
- **Feature folders for the frontend.** It fights Nuxt's conventions, and there are three features,
  one of which (`field-types/`) belongs to none. _Revisit at a fourth domain._ A component's private
  modules already sit with it (`BaseSelect/`).
- **Prefixing functions by sync/async.** `await` already marks it, the axis is near-constant per
  layer, and it would displace the role vocabulary in `CLAUDE.md` §6 and swallow the closed
  `*For(field)` family.
