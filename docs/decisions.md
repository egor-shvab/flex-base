# Decisions & accepted limitations

Why the code is shaped the way it is. Each entry exists because the alternative looks obviously better until you know the reason — treat these as **load-bearing**: do not "clean them up" without reading the entry.

Rules live in `CLAUDE.md`; contracts live in `architecture.md`.

---

## Tooling & module resolution

### Everything except components is imported explicitly

`imports: { autoImport: false }` (app) and `nitro: { imports: { autoImport: false } }` (server) also stop Nuxt generating the global `.d.ts` declarations, so a missing import is a `vue-tsc` error at build time rather than a silently resolved global.

The component scan (`components: [{ path: '~/components', pathPrefix: false }]`) is deliberately **kept**: it is what code-splits `<LazyRecordFormModal>` for free and what keeps `<NuxtLink>` / `<NuxtPage>` / `<Icon>` working. `pathPrefix: false` is why `common/BaseInput.vue` registers as `<BaseInput>`.

### Server code must not import from `#imports`

`.nuxt/types/nitro-routes.d.ts` pulls every `server/api/**` handler into the **app** TypeScript project (to type `$fetch` route responses), and `#imports` resolves to the app's module there — so `defineEventHandler` would not be found. `h3` and `nitropack` are therefore direct dependencies; they resolve identically in both projects. Keep their versions in step with the ones Nuxt resolves.

### `#server` is server-only

Nuxt's import protection rejects it in app and shared code. The Vue layer reaches the server through `$fetch`/`useApi()`. `#server` is a Nuxt built-in alias (registered in `@nuxt/schema`'s alias defaults alongside `#shared`), so it resolves for `vue-tsc` and the Nitro bundler alike.

### Relative imports are a lint error under `app/`, `server/`, `shared/`

`no-restricted-imports` is scoped to those three directories specifically so the root config files can keep their own relative paths.

### `ofetch` is declared; `vue-router` is not

`app/utils/api-error.ts` imports `FetchError` from `ofetch` by name; without the declaration it resolves only through npm hoisting of Nuxt's tree, so a hoisting change would silently break `typecheck`. `vue-router` is deliberately **not** declared — nothing imports it, and Nuxt owns the version.

### `@iconify-json/mdi` is declared even though nothing imports it

`@nuxt/icon`'s default `serverBundle: 'auto'` serves an installed collection from disk and otherwise falls back to the public Iconify API — so without the package every icon is a runtime fetch of a third-party host, on a render path with no fallback if it is slow or unreachable. Dropping it fails no build; it just quietly puts the icons back on the network.

No `icon: { … }` block in `nuxt.config.ts`: `serverBundle: 'local'` would only restate what `auto` already resolves to, and would not keep the remote fallback away if the package were ever dropped.

### `@nuxt/fonts` and `@nuxt/image` were removed

Neither had anything to work on. The app ships no webfonts, and `@nuxt/fonts` tries to resolve the `Segoe UI` / `Roboto` names in `_reset.scss`'s system stack from font providers. It renders no images either — no `<NuxtImg>`, no `<img>`, and `public/` holds only a favicon — so `@nuxt/image` was a module in the build graph and a runtime dependency paying for nothing.

Re-add either if and when there is a real webfont or a real image, and the rule it carried in `CLAUDE.md` comes back with it — not before. Contrast `@iconify-json/mdi` above, which nothing imports and which is kept precisely because dropping it changes what ships.

### The built output is started by one launcher, and its import must stay dynamic

`.output/server/index.mjs` assigns `globalThis._importMeta_` in its module **body**, but ESM hoists imports — so the chunk carrying the bundled Prisma client evaluates first, finds it unset, and falls back to the placeholder `file:///_entry.js`. Prisma then shims `__dirname` through `fileURLToPath()` on it: harmless on POSIX, fatal on Windows, where a relative file URL throws `ERR_INVALID_FILE_URL_PATH`.

`scripts/serve-output.mjs` assigns `_importMeta_` before a **dynamic** import, which is not hoisted. **Making that import static reintroduces the crash.** `scripts/preview.mjs` is the same launcher with the root `.env` loaded first — two files rather than one flag, because loading `.env` is the one thing the e2e suite must never do (it points at the development database, and the suite truncates between cases).

### `.gitattributes` pins `eol=lf`, and nothing was renormalised

`core.autocrlf` is `true` on Windows and Prettier's `endOfLine` defaults to `lf`, so git rewrote every checked-out file to CRLF and Prettier then rejected all of them — a fresh clone failed `npm run format:check` before a line was written, with every touched file reporting a modification whose diff was empty. CI never saw it: Linux checks out LF.

**No `git add --renormalize` was run, and none should be.** `git ls-files --eol` reported the whole index as `i/lf` already — the blobs were always right, only checkout was wrong.

---

## Testing

### The suite is two Vitest projects, not one with a mixed environment

A single `environment: 'node'` config held exactly as long as the covered surface was `shared/` and the SQL builder. It stopped holding at the stores: each calls `useApi()` at store-setup time, so `#imports` is in the import graph and the module cannot even be **loaded** in the node project.

The split keeps both properties instead of trading one for the other — the node project still runs in under a second, and the Nuxt startup cost is paid only by the specs that need it. Three alternatives were rejected:

- **A per-file `// @vitest-environment nuxt` pragma.** The Nuxt environment is not only an environment — `defineVitestConfig` also installs the Vite plugins that resolve `#imports`, compile SFCs and transform `mockNuxtImport`. There is no file-level form of that, and it would hide the cost.
- **One project on `environment: 'nuxt'` throughout.** It would make every existing spec pay a Nuxt build for aliases it already had. The fast half is the half run most often.
- **Hand-stubbing `#imports` in the node project.** A second definition of `useRequestFetch`, `useRoute` and `useAsyncData`, free to drift from the real ones without failing anything. The point of the real environment is that the app under test is configured by `nuxt.config.ts` and nothing else.

**Playwright is deliberately not part of this** — a browser is what E2E needs, and none of these specs are E2E.

### `@nuxt/test-utils/module` is not in `nuxt.config.ts`

It is not required to run `environment: 'nuxt'`; its job is Vitest integration inside Nuxt DevTools. Adding it would put a test concern into the config that describes the shipped app.

### Specs are colocated, and the project is named by suffix

`.nuxt/tsconfig.shared.json` includes `../shared/**/*` and `.nuxt/tsconfig.server.json` includes `../server/**/*`, so a colocated `*.spec.ts` is type-checked by `npm run typecheck` with **no** tsconfig change. A top-level `tests/` tree sits outside every generated `include` and would need its own config plus a `references` entry — new configuration to restore what colocation gets for free. Nuxt's own `test/nuxt/**` convention was rejected for the same reason plus one more: it puts a spec several directories from its subject.

`*.nuxt.spec.ts` names the project in the file name instead, so which specs are slow is readable from a directory listing rather than from two config files.

The one thing that does not fit inside a source directory is the shared `IField` builder: it is test-only, so it lives in `test/fixtures.ts` and is reached as `~~/test/fixtures`. Being outside `app`/`server`/`shared` also keeps it clear of `no-restricted-imports`.

### The SQL builder is unit-testable because it never executes

`server/services/record-query.ts` imports `Prisma` from the generated client for `Prisma.sql` / `Prisma.join` alone — no client instance. Its exports return `Prisma.Sql`, whose `.text` (numbered `$1…$n` placeholders) and `.values` can be asserted on with no connection. That is what lets the layer where a mistake is most expensive — a filter that silently widens, a wildcard that is not escaped — be pinned without a database. The suite therefore needs `prisma generate` to have run, which `postinstall` covers.

### A duplicated test is a cost, not insurance

Runtime was never the argument. Three reasons a second copy one layer up is worth deleting:

- **A slow copy teaches the wrong lesson.** A browser spec that opens by saying the logic is pinned in happy-dom already, then re-tests the logic, is read by the next person as the place to add cases.
- **A test that cannot fail reads as coverage.** An "entry for every field type" check over a `Record<TFieldType, …>` object literal is enforced by the compiler (`TS2741`) and can only ever be green.
- **A restated constant turns a design decision into a broken build.** A spec encoding the search threshold as a literal fails when the number moves; asserting the registry _agrees with_ `shouldSearch()` still catches a hardcode and survives it. `app/utils/select.spec.ts` owns that boundary and is the only place that should.

What stays is the half that is not duplicated — e.g. the keyboard cursor's **paint**: `test.css` is `false`, so a component spec sees the `--active` class and never the outline it draws. Removing the outline rule leaves every component case green and turns the one browser case red, which is the shape every e2e case here should have. **Do not restore a deleted duplicate out of caution.** Depth belongs at the cheapest layer that can answer the question.

### The accessibility gate blocks on serious and critical only

Admitting `moderate` and `minor` on first introduction meant either a long list of disabled rules or a stage that never landed, and neither is a gate. The bar is raised by narrowing `BLOCKING_IMPACTS` in `test/e2e/setup/a11y.ts`, not by adding exclusions. Nothing is disabled today; a rule that ever has to be turned off belongs in that file with its reason beside it, never silently at a call site.

It does **not** replace the keyboard walk in the definition of done: axe decides a name, a role, a contrast ratio, and cannot tell whether a focus order makes sense.

### Coverage is merged from two runs, not collected in one

`server/api/` and `server/middleware/` are reachable only from the `integration` project. Folding that project into `test.projects` would produce one report in one run — and would make `npm run test` want a database, which is the property the split exists to protect. So each run writes a **blob report** and `vitest run --merge-reports --coverage` merges the coverage maps.

Rejected alongside it: dropping those globs from `coverage.include` and documenting where they are proven instead. Less work and less honest — files at 0% teach a reader to skim red rows, and the next genuinely uncovered file arrives in a report nobody trusts.

Four constraints are load-bearing:

- **The merge step is `vitest run --merge-reports`, never bare `vitest`.** Watch mode defaults to `!isCI && process.stdin.isTTY && !isAgent`, and merging refuses to run under it — so a bare `vitest` works in CI, in a pipe and under an agent, and fails in the one place it matters: a developer's terminal. `run` forces `watch` off unconditionally.
- **The scope lives in `vitest.coverage.config.ts`**, a fragment rather than a runnable config, because two `include` lists would drift the first time a directory was added. It is named `*.config.ts` only so `tsconfig.tools.json`'s glob type-checks it, and its importers name it **with the `.ts` extension** — Vite's `configLoader: 'native'` cannot resolve an extensionless relative specifier and warns on every run until it is spelled out.
- **The integration run measures the server half only.** Given `app/**` it would have to transform `app/field-types/*.ts` — which import `.vue` files — in a node environment with no Vue plugin. Nothing is lost: merging unions the file sets.
- **`.vitest-reports/` may contain nothing but blob files.** Vitest's `readBlobs` throws on any subdirectory and merges every file it finds, so the two fixed `--outputFile.blob` paths are what keep a stale or foreign file out of the report.

The merge step's summary line counts the root projects only, though every test is listed and reported. The two collect steps print their own accurate totals just above it.

### Decided against, in testing scope

Recorded so they are not re-litigated. Revisit only with a reason that has changed.

- **Parallel e2e / integration.** Both serialize on one database; the saving does not pay for per-worker provisioning.
- **A hard coverage threshold.** Specs here are written to pin behaviour, not to move a number, and a gate invites the opposite. Revisit only if coverage drifts down over months — the merged report is what makes that visible.
- **More browsers.** The suite is about this app's behaviour, not browser differences.
- **Mutation testing, component snapshots, visual regression.** No evidence any would catch something the current suite misses, and each adds a maintenance surface.
- **A mobile Playwright project.** `test.use({ viewport })` in `mobile-shell.spec.ts` gives the same coverage; a project would either duplicate the desktop suite at 375px or select that one file.

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

Every user's records share one physical `Record` table, so a global sequence would number rows across all tenants (a table would read `1, 47, 2931`), leak platform-wide row volume through the counter, and make ids enumerable — all while still not giving the per-table `1..n` that makes a number readable. So `id` stays an unguessable `cuid()` for reference and addressing, and `number` is a separate display column.

`number` is allocated inside the insert's own transaction via Prisma's atomic `{ increment: 1 }`, which takes the row lock, so concurrent creates queue rather than race — no retry loop. It is a **high-water mark, not a count**: deleting a record never frees its number.

### The redundant single-column indexes were dropped — do not re-add them

`Table_userId_idx`, `Field_tableId_idx` and `Record_tableId_idx` were each subsumed by the left prefix of the composite index above them, and only cost write throughput. `EXPLAIN` confirmed the plans are unchanged, and the record list improved (the composite supplies the ordering, so its `Sort` node is gone).

`@@index([tableId, createdAt])` stays even though the default ordering is `DESC` — Postgres scans a btree backwards.

### The `record_number` migration is hand-written

`Record.number` is required over existing rows, so the column is added nullable, backfilled with `ROW_NUMBER() OVER (PARTITION BY "tableId" ORDER BY "createdAt", id)`, then set `NOT NULL`. `prisma migrate dev` cannot generate that and refuses the diff outright.

**This generalizes:** use `--create-only` and edit the SQL for any future required column over existing data.

### Server errors are recorded from Nitro's `error` hook, and only the 5xx ones

The sink is a Nitro plugin, not a wrapper around each handler: h3's `onError` reaches every route, `middleware/auth.ts` and the SSR renderer alike, so nothing has to opt in and a handler that logged for itself would only duplicate it.

**The hook must stay synchronous and unawaited.** Nitro's `captureError` fires it with `callHookParallel` without awaiting it into the response and catches its own rejections — that is the entire reason the sink may write to a file at all. Making the handler `async`, or awaiting it anywhere, puts disk I/O on the response path.

**Only a 5xx or an error with no status is logged.** Every 4xx here is a deliberate outcome — `requireUser`'s 401, the 404 standing in for another user's row, a 409 on a duplicate name, a zod 400 — so logging them would bury the faults beneath them. It also settles the one real leak: a zod rejection carries `error.data.issues`, which echoes the submitted value.

**The redaction is structural, not a scrub.** The entry is built from `event.method`, the pathname, the query parameter **names**, and `context.user.id`. Headers are never read (they carry `auth_token`), nor the body (it carries a password on the login route), nor query values, nor `error.data`, nor the user's email. A filter list is something a later change forgets to extend; not reaching for the data cannot be forgotten. **Rejected: logging the whole event and stripping known-sensitive keys.**

**NDJSON, because a stack is multi-line.** `JSON.stringify` escapes it, so one error is always exactly one line and no reader downstream needs a multi-line rule.

Two things in `utils/error-log-file.ts` look like tidying opportunities and are not. **The write is `writeSync`, not a buffered stream** — a stream loses its tail when the process dies, and the entry worth having is the last one before a crash; the hook only fires on a fault, so this is never a hot path. And **the descriptor is closed before the first rename**, because Windows refuses to rename an open file. Rotation walks the generations highest-first for the same class of reason: the other direction copies the newest file over all five.

---

## The metadata layer

### There are no operators, anywhere

A filter's **value** is the whole contract. How a value is compared is the field type's business, declared once in `FIELD_SQL_BY_TYPE` on the server — it never travels in the URL, no control knows it, and no user can pick one. This is what keeps the filter drawer, the URL codec, the summary chips and the SQL builder from each needing a per-operator branch.

### A record reference is a number plus a nullable label, never a pre-flattened string

A relation travels as `ILinkedRecord` — `{ number, label: string | null }` — because a renderer is the only layer that knows whether it can style the two apart, and a flattened `#3 Example` can never be taken back apart. `buildRecordLabel` therefore returns `null` for a record with nothing to name it by; it used to return `#<number>`, which made the number unrecoverable from the label and turned "state the number too" into `#3 #3`.

**Only `formatLinkedRecord` and `BaseLinkedRecord` write a `#`, and both require a real number.** That is what makes the doubling structurally impossible, and it also settles the deleted-target case: an unresolvable id resolves to nothing at all, so it degrades to `UNKNOWN_RECORD_LABEL` with no number — the app genuinely does not know one.

The visible `#N` is **not** the sort key: `targetLabel` orders by the target's label field, blanks last, so a column of blank-labelled records shows numbers in no particular order. Sorting by number instead would reorder every existing picker and every relation column to match a tiebreaker rather than a name.

### A multi-value filter is a repeated param, not a delimited one

`?stage=Won&stage=Lost`. Comma-joining was rejected: a choice's value is free user text and may contain any character, so any delimiter needs escaping, and escaping user text into a separator is a silent-corruption failure mode rather than a loud one.

This does not overturn "a repeated param is a 400" — it makes it a **per-shape** rule. A scalar or range claim given an array is still malformed and still 400s; only a `list` claim reads repeats. Values are **sorted on serialize**, so one selection always writes one URL and `recordQueryKey` cannot report a change nobody made.

The bounds: `FILTER_VALUES_MAX` (50) in the schema, because a repeated param is the one place a single filter can grow without limit and every value becomes a term of an `IN (…)`; and the codec caps and deduplicates independently, because it also runs client-side over an unvalidated `route.query`.

### Multi-value is a per-field flag, not a pair of new field types

`MULTI_SELECT` and `MULTI_RELATION` as `FieldType` members is what the type system wants — two new members would make the compiler walk you through every total registry. **It fails on the only conversion anyone actually needs.** `updateField` rejects a type change, and correctly, so a relation field already linking each master to one service could never become multi-valued: the user would have to create a second field, re-enter every link by hand, and delete the first. A flag can be flipped with a migration; a type cannot. The upgrade path _is_ the feature.

It also avoids doubling the user's type list (`Select` / `Multi-select` / `Link to table` / `Links to table`) and carrying two near-identical rows in every registry.

**What replaces the compiler's guarantee:** `MULTI_VALUE_BY_TYPE` is a total `Record<TFieldType, boolean>`, and each affected registry gains a total `Record<TFieldType, X | null>` override table. A seventh field type still cannot ship without declaring its position — the totality moved, it was not given up. `isMultiValue(field)` is the single reader, and its guard is why a stale `options.multiple` on a type with no list form can never reach the schema or the SQL.

### Multi is a lifting of the single-value spec, not a second set of specs

Every layer treats "several" as the same uniform transformation of "one": `base` → `z.array(base)`, `= x` → `jsonb_exists_any`, one cell → a row of that cell, `BaseSelect` → `BaseSelect multiple`. So no field type declares a second schema, cell or summary. The branch exists once per registry — in `sqlFor` / `inputFor` / `filterFor` / `summaryFor` / `cellComponent` / `filterShapeFor` — and nothing downstream learns that `multiple` exists, which is what keeps this from being a `switch` on cardinality in every renderer.

**Multi-value cells need no override table at all.** `MultiValueCell` renders each entry through `FIELD_CELLS[field.type]`, because a list of values is exactly the list of how each value renders. A future multi-capable type is covered without a component.

Duplicates in a stored list are **rejected, not deduplicated**: a control cannot produce one (picking a chosen option toggles it off), so a repeat is a crafted payload, and rejecting keeps a `.transform()` out of a layer that only judges.

### One value union, narrowed by shape — and a prop type is a runtime contract

`TRecordValue` is widened with `string[]`, reversing an earlier decision that a record holds one value per field. The consequence to know is that **`TRecordValue` stayed a subset of `TFilterValue`**, so `IFieldControl<TValue extends TFilterValue>` needed no change and the shape guards that already existed for filters were the ones the record side needed too.

Those guards are load-bearing on both sides now. `isRangeFilterValue` narrowed on `typeof value === 'object' && value !== null`, which an array passes — so without `!Array.isArray` a list-shaped filter decodes as a range and is read for bounds it does not have. `isScalarFilterValue` exists so a comparison guards on the shape it _wants_ rather than on the one other shape that happened to exist when it was written.

**`TRecordSingleValue` is the narrow half, and it is not a lint-level preference.** `defineProps<T>()` compiles to a _runtime_ prop declaration, so widening `IFieldCellProps.value` would add `Array` to the accepted types of every per-type cell that can never legitimately receive one — turning off a check that would otherwise catch a real routing bug. `MultiValueCell` takes its own `IMultiValueCellProps` with a plain `string[]`: a separate interface, not a widening, because the two contracts are opposites. The same reasoning narrowed `RECORD_COLUMNS.value`, `VALUE_SCHEMA_BY_TYPE.base` / `blank`, `buildFilterValueSchema` and `toRange`.

`IValueSchemaRules.listBase` came out of the same pass: `z.array(base)` over a `ZodType<TRecordSingleValue>` yields `TRecordSingleValue[]`, not `string[]`, and the cast that hid the gap was hiding a real one — only a type whose values are strings _can_ be stored as a JSON array, and nothing said which those were.

The other place it bites is blankness: `RecordFieldValue` had `value === null || value === undefined`, and an empty array passes neither. Without the array case a cleared multi field renders as an empty cell rather than "Not set" — a silent difference between "no value" and "we did not draw anything".

### Cardinality is one-way, and a multi-value column sorts by its first value

Single → multi runs `widenToList` — one scoped `UPDATE` wrapping each stored scalar in an array — **inside `updateField`'s own transaction**, so the metadata and the rows it describes can never disagree. It is idempotent and skips a value that is already an array or is JSON `null`, so a retry is safe and `[null]` is never written where there was no value.

Multi → single is a 400, in the same shape as `Relation target cannot be changed`. It is lossy, and there is no non-arbitrary answer to which of several values survives. A softer rule — allow it when no record holds more than one — costs a JSONB scan of the table on every field save to buy a case nobody has asked for.

The consequence, and the reason the migration exists: a value written **before** the flip is a bare scalar. Two places tolerate one where a list is expected — `toValueList` (`app/utils/record-value.ts`), which the multi-value form control and the cell both normalise through, and `collectRelationTargets` on the server. Not defensive padding: a form opened from a stale page must not drop the value it is about to save back. The server keeps its own because it rejects non-string _elements_ as it goes, which is a stricter question than the client's.

**Sorting by the first value** is a choice, since a list has no intrinsic order. Opting out of sorting is the most honest and was rejected on cost: `DynamicTable` makes every header a sort button unconditionally, so it would need a `sortable` notion threaded through the table, the query schema and `buildRecordOrderBy`. `jsonb_array_length` orders by how many, which nobody asked. The first value wins because it is explicable from the screen — it is the one already visible in the cell.

### `jsonb_exists_any`, never the `?|` operator

A literal `?` in raw SQL is the parameter placeholder on Prisma's other drivers and has a long history of being mangled. The function forms `jsonb_exists` / `jsonb_exists_any` mean exactly the same thing and are unambiguous everywhere; `widenToList`'s key test is `jsonb_exists(data, key)` for the same reason. Two properties worth knowing:

- It answers **correctly for a bare scalar** (`'"abc"'::jsonb` contains `abc`), which keeps an un-migrated row from disappearing from its own filter. Do not lean on that as a substitute for the migration — display and validation still want one shape.
- It is the **only GIN-indexable comparison** in the query layer, so it is the one filter that could eventually escape the unindexed-JSONB ceiling.

### The multi-value search guard is not defensive

`jsonb_array_elements_text` raises `cannot extract elements from a scalar` on anything that is not an array, including a JSON `null`. It is a **set-returning function in `FROM`**, so that error aborts the entire list query, not the row: one legacy scalar would turn every search on that table into a 500.

Hence `CASE WHEN jsonb_typeof(…) = 'array' … ELSE '[]'::jsonb END` inside the call. Writing the type test as an `AND` beside the `EXISTS` does **not** work — SQL does not guarantee evaluation order between `AND` operands, so the planner is free to run the function first. The guard has to be inside the argument.

### `searchPredicate` is a predicate, and it is separate from `expr`

It was `searchExpr`, returning an expression that `buildRecordSearch` appended `ILIKE ${pattern}` to. A multi-value column cannot be matched that way — the question is whether _any element_ matches, which no projection can express. Rejected: substring-matching the raw `["Won","Lost"]` text, which "works" and also lets a term of `","` or `[` match every multi-valued row. That is a lie rather than a near miss.

It stays separate from `expr` because NUMBER and BOOLEAN cast in their filter projection and neither `numeric` nor `boolean` has an `ILIKE` operator: NUMBER searches the un-cast text, BOOLEAN opts out (searching `e` would match every `false`), and RELATION opts out because its stored value is a cuid — matching the label instead would run `targetLabel`'s correlated subquery against every row, and the count query has no `LIMIT`.

### `buildRecordSearch`'s parentheses are load-bearing

`withinRange` returns a bare `a >= x AND a <= y` with no parentheses of its own, which is safe only while every sibling is `AND`. Search is the only OR in the query layer, and unparenthesised it would bind to the last bound of a range filter and silently widen it.

### `FILTER_VALUE_BY_TYPE` and `VALUE_SCHEMA_BY_TYPE` stay split

They look like one table split across two layers. Merging them would be a **cycle**: `shared/utils/filter.ts` imports the constant, and `shared/validation/record.ts` imports `shared/utils/filter.ts`.

### The query schema validates; the codec decodes

`buildRecordQuerySchema` has no `.transform()`. Turning validated params into an `IRecordQuery` is `parseRecordQueryState`'s job, which is what keeps the `utils → validation` dependency direction acyclic. The endpoint composes the two: the schema judges, the codec decodes.

`parseRecordQueryState` is lenient by design and is the **exact inverse** of `toRecordQueryParams`, used by both the page (over `route.query`) and the endpoint (over its validated params), so a link cannot decode two ways.

### Unknown query params are ignored, not rejected

Filter params are named after the field with no prefix, so a typo is indistinguishable from `utm_source`. A stray param must not break the page. A malformed **known** param is still a 400.

### A reserved param is refused symmetrically, and a field that claims none renders no control

`claimFilterParams` always seeded its claimed set with `RESERVED_QUERY_PARAMS`, so a field keyed `search` could never be **read** back from a URL. The encoder relied on something weaker — it spread the filter params first and let the reserved assignments below overwrite them — but those assignments are conditional (`page` only above 1, `search` only when non-empty), so on the default view a legacy field keyed `search` wrote its value into the free-text search param and the server ran it as a site-wide search. `detail` was worse: nothing writes it, so such a field leaked into the dialog param unconditionally.

Both halves now read one `isReservedParam`, and the encoder **drops** those names rather than overwriting them. Ordering is not a contract; a set membership test is. The drop is per **param name**, exactly as the claim is — so a NUMBER field keyed `page` keeps its filter under `page_from`/`page_to`, names nothing has reserved.

That leaves the control. A scalar field keyed `search` claimed no param, yet the drawer rendered its filter anyway, because both filter surfaces built from every column — a dead control, which `CLAUDE.md` §7 forbids. `filterableFields` is the narrowing both surfaces now apply. It narrows **filtering only**: such a field still renders as a table column and still sorts, because a sort key travels as the _value_ of `?sort=`, where a reserved name collides with nothing. Removing it from the table as well would hide user data to fix a URL problem.

### A blank `?search=` is absent, not a zero-length term

`z.string().trim().min(SEARCH_MIN_LENGTH).optional()` treats `''` as _present_, so the floor ran and answered a 400 — while `parseRecordQueryState` read the same link as "not searching", and every filter param already reads an empty value that way. The divergence itself was the defect: the whole point of the codec is that both sides read a link identically.

A preprocess maps a blank param to `undefined` before the floor runs, and blank means empty **after trimming** — the same test `isFilterValueEmpty` applies to a text filter. The floor did not move: `?search=a` is still a 400, because a term that is too short is a different thing from a term that is not there.

### `SEARCH_MIN_LENGTH` is enforced by the schema, not the input

An unanchored `ILIKE` over user-defined JSON keys is unindexable and the count query cannot stop early, so a one-character term is a full-table scan paid twice. Enforcing it client-side only would leave the endpoint open to any caller.

### Relation option search deliberately does **not** enforce `SEARCH_MIN_LENGTH`

Read the reason the floor exists rather than the name of the constant. Not one half of it holds for `/fields/:fieldId/options?q=`: it is one expression over one table chosen by the field's own metadata, not an OR across every searchable column; there is no count query, so nothing is paid twice; there is a hard `LIMIT RELATION_OPTIONS_LIMIT`; and a 300 ms debounce bounds the request rate. A one-character term costs exactly what the **zero**-character term this endpoint already serves unconditionally costs.

There is a real UX cost too: with a floor, typing one character either shows the unfiltered seed (a lie — it looks like the search did nothing) or needs a third "keep typing" state. The bound that applies here is `max(100)` on the term. Stated explicitly so nobody later harmonises the two on the strength of the shared word "search".

### `cellComponent` is the one resolver that does not live in its registry file

`inputFor` sits in `inputs.ts`, `filterFor` in `filters.ts`, `summaryFor` in `filter-summaries.ts`. `cellComponent` sits in `cell-resolver.ts`, and folding it into `cells.ts` to match — which looks like the obvious tidy-up, and which `architecture.md` §3's table appears to invite — creates a **cycle**: it returns `MultiValueCell` for a multi-value field, and that component imports `FIELD_CELLS` back out of `cells.ts` to render each entry.

`cells.ts` naming only the six per-type cells, and never the shared one, is what keeps the directory acyclic. The split is by what each half reads: `cell-resolver.ts` for the two functions that consult the registries, `~/utils/record-value` for the two that only shape a value.

### Inputs and filters are data; only cells are components

A cell carries markup and scoped styles (an icon, tabular figures), not just a value, so a `format | component` union would be worse than one uniform contract. Inputs and filters carry neither — they name a `Base*` control plus adapters, so they stay rows in a table.

**`RelationFieldSelect` is the one exception**, because a relation's candidates are records of another table and no synchronous `props(field)` factory can produce them. The rule that follows: a type whose control needs data beyond its own metadata gets a component in `field-types/controls/`; everything else stays a row.

### RELATION's target table is immutable; its label field is not

Retargeting would orphan every stored id, so `updateField` rejects it with 400. The label field is pure display and freely editable. RELATION-typed fields are excluded from the label candidates — a link labelled by a link would read as an id.

### The record's own columns go through one seam

`queryColumns(fields)` wraps a table's fields in `Record #` / `Created at` / `Updated at` **only where a query is built**, never where record data is read or written. Special-casing them at each layer instead would mean a branch in the codec, the schema, the SQL builder, the table and the filter panel — five places to forget one.

The reserved keys are **camelCase**, a shape `slugify` can never emit, so no user field can shadow one. `RESERVED_FIELD_KEYS` states the reservation rather than relying on that luck.

### A choice's identity is its own text

`Record.data` stores the choice string, not an option id. That keeps the whole SQL layer, the filter constants and the URL codec out of the colour change — SELECT still filters, sorts and searches on the stored text. The cost is that renaming a choice orphans the records holding the old one, which is recorded in the register rather than fixed: a stable option id buys nothing for colour and rewrites `record-query.ts` to get there.

### A SELECT choice is coloured from a closed palette, not a free colour picker

A custom hex picker loses on all three axes the codebase already cares about:

- It **breaks the token boundary** `_palette.scss` exists to enforce — an arbitrary colour would have to arrive as a literal. `BaseButton`'s `tone` prop is the precedent; it replaced a free-form `hoverColor` string for exactly this reason.
- It **breaks the contrast guarantee.** A badge needs 4.5:1 text on its fill; with a closed set every pairing is authored and verified once, while a free picker needs runtime luminance maths and still lets a user choose a pairing that fails.
- It **stores the wrong thing.** What is persisted is a **name** (`"blue"`), so the colour survives a re-theme and dark mode stays reachable. Widening the enum to accept a hex later needs no data migration, because the stored names stay valid members of whatever union replaces it.

### Type-only imports are invisible to HMR, and `compiler-sfc` caches resolved types

Worth recording because it cost a bug report that looked like a code defect and was not.

Widening `TRecordValue` changed no runtime module: `app/field-types/types.ts` imports it with `import type`, which is erased, so it is **not an edge in Vite's module graph**. `@vue/compiler-sfc` additionally caches resolved type scopes per file, so a dev server running across that edit kept generating cell props from the pre-widening union — including for a component created **after** the edit.

**A type name in a Vue prop warning that does not match the current source means the dev server is stale, not that the source is wrong** — the fix is a full restart. Corollary for reading built output: this toolchain emits a runtime `type` only for primitive unions, so an absent type on an array-typed prop is normal, not a resolution failure.

---

## Frontend

### A layout and a page must never share a `useAsyncData` key

`useAsyncData` does **not** dedupe a layout against a page in one SSR render: it fires two requests and warns `NUXT_E3004`, with the page's closure silently never called. The layout owns `app-tables` and every page keys on what it is actually fetching. The rule is about the key space, not about any one page.

### `ensureTables()` never throws

A rejection in the layout's async setup would replace the page with an error boundary for what is chrome, not content — the sidebar failing to list tables should not take down a records page that loaded fine. It sets `failed` instead, and the sidebar reports it inline with a Retry.

### A failed refetch is visible, not silent

`records.ts` sets `failed` in a `catch` that **rethrows**; the page's `watch` swallows the rejection and shows a banner. Both halves are needed: an unhandled rejection in a watcher left the table showing rows that no longer matched the URL, and the initial load still needs the rejection for `useAsyncData` to produce the 404. **The empty state is suppressed while `failed`** — an empty result and an unknown result are indistinguishable in the store, and "No records yet" would be a guess.

**And suppressed the same way while a fetch is in flight with no rows to show**, which is the same guess about a different unknown: `fetchRecords` clears the previous table's rows _before_ requesting the next one's, and the outgoing page stays mounted until the incoming one's `setup` resolves, so switching tables emptied the body of the page still on screen. `RecordsTableSkeleton` takes that state. Deliberately conditioned on the row count rather than on `pending` alone — an **in-place** refetch (sort, page, a filter over rows already drawn) keeps its rows and states itself through the summary's "Filtering…", because a table that blanks and rebuilds on every sort reads as heavier than one that does not.

This is the opposite call from `useDeleteConfirm`. The rule is not "swallow" or "throw"; it is whether anyone is listening.

### `useDeleteConfirm` catches instead of re-throwing

**Every call site binds `confirm` directly to a template's `@confirm`**, so there was no caller to catch anything — a refused delete became an unhandled promise rejection while the dialog sat open saying nothing. Re-throwing is only a contract worth keeping where someone is positioned to honour it.

The catch lives in the composable rather than in the three pages because the alternative is the same `try`/`catch` written three times. The message is cleared on two paths, and both are needed: a `watch` on `target` covers dismissing the dialog or opening it on something else, while `confirm()` clears at the start because a **retry keeps the same target** and would otherwise show the previous attempt's message while the next one is in flight.

### `app/error.vue` is store-free

It has to render when data fetching is exactly what failed.

It exists because both inner pages forwarded the upstream `statusCode` but hard-coded `statusMessage: 'Table not found'` — so a malformed `?search=`/`?sort=` returned 400, failed Nuxt's `is404` check, and rendered the 500 template claiming a table that had just loaded did not exist. `toPageError` now asserts a cause only for a 404.

### The records store never mirrors query params

A mirrored copy would have to survive SSR hydration to stay correct. Every action takes them from the caller, and the URL stays the single source of truth.

`createRecord` returns the page the new record landed on and only refetches when that equals the current page; the page navigates when it differs. Otherwise the URL would show one page while the table showed another, or the refetch would happen twice.

### In `getApiErrorMessage`, blank counts as absent

The chain was three `??`s, and `??` skips only `null`/`undefined` — so a response carrying `statusMessage: ''` won the chain and rendered an **empty** error box, the one failure mode worse than a generic message because it looks like the form simply did nothing. The candidates now go through a `nonBlank` guard, which also closes the hole from the other side: `data` is untyped at runtime, so a non-string `statusMessage` used to be returned unchanged from a `string`-typed function. `||` is wrong for the same reason it is usually wrong here — it is the explicit `typeof` check that makes a number or an object fall through rather than stringify.

### Locales and time zones are hard-coded

`en-GB` everywhere, and `formatTimestamp` pins `timeZone: 'UTC'`. An `undefined` locale renders differently on the server and in the browser — a hydration mismatch. `DateFieldCell` gets away with no zone because it parses a date-only value as local midnight, the same wall-clock everywhere; a real timestamp does not. Pinning UTC also keeps the displayed day equal to the day the filter matches on, since that compares `::date`.

### The active-table check compares `route.params.tableId`, not the path

`/tables/:id` is a string prefix of `/tables/:id/settings`, so a path check is ambiguous — and an equality check would drop the highlight on the settings page. The param marks the table active on both.

### `AppBreadcrumbs` is prop-driven

Each page passes its own `IBreadcrumb[]` because the pages already hold the `ITable` they fetched — which is also what produces their 404. Deriving the name from the store in the layout would quietly delete that guard.

### `FieldFormModal` fetches the target's fields outside the fields store

That store holds the table being edited; loading another table's fields into it would clobber the page behind the modal.

### The open record lives in the URL, not in a store

A `recordDetail` store would have been fewer moving parts, and it was rejected: a relation is a **link** in the concept, and a link needs an `href`. Putting the chain in `?detail=` makes the cell a real `<a>` — middle-click, "copy link address" and the SSR'd markup all work — and buys three things a store cannot: browser Back closes the dialog (and Forward reopens it), a refresh or a shared link renders the same dialog server-side, and the drill-down trail is history rather than a stack to maintain. A store would still have left the link an `href="#"`.

### Reading a record is a link, everywhere

The View action in a row could have been a button emitting `view`, as every other row action is. It is a `<NuxtLink>` for the same reason a relation is: the dialog **is** a URL. It also keeps `DynamicTable` out of the business of navigation. The cost is the `tableId` prop — reading it from the route inside the component would have coupled a generic renderer to a URL shape that is not its to know.

### The chain appends from wherever a relation cell renders

`RelationFieldCell` builds its target from `route.query` alone, so a cell **behind** an open dialog also appends to the chain — its `href` reads `?detail=A,A`. Unreachable in practice: `BaseModal` marks `#__nuxt` `inert` while open, which takes the whole table out of pointer, keyboard and accessibility reach, and the hrefs are recomputed the moment the dialog closes. Making them differ would mean telling the cell where it is rendering, to change a link nobody can follow.

### The detail endpoint returns an aggregate, not just the record

`GET /api/tables/:tableId/records/:recordId` answers with the record **plus** its table's name, its fields and its linked records. Strictly three resources — but the dialog needs all three at once, and `resolveLinkedRecords` needs the fields server-side regardless, so returning them costs nothing while saving two round trips and two more loading states.

### The dialog's title is static

`Record details`, with `{table} · #{number}` as the first line of the body — not the label the user clicked. A record's label is a property of the **relation field** (`options.labelFieldKey`), not of the table it lives in, so it is only knowable on the click path: a shared `?detail=` link could not reproduce it, and the same dialog would carry two titles depending on how it was reached. The label is still on screen — it is one of the record's own values.

---

## Components

### `BaseButton` renders the element its role implies

One component, one stylesheet. A `BaseLinkButton` would have been a second copy of six variants' worth of SCSS kept in step by hand. Passing `to` makes the root a `<NuxtLink>` while every variant keeps its look: `variant="link"` is _a button that looks like a link_, `to="/x"` is _a link that looks like whatever `variant` says_.

Rejected: a separate `href` prop — `NuxtLink` already resolves an absolute URL to a plain `<a href rel="noopener noreferrer">`, so it would be a second prop meaning the same thing plus a decision at every call site. Rejected: a polymorphic `as`/`is` — an open element set with no caller asking for it, which would let a call site emit a `<div>` that looks like a button, the bug this component exists to prevent.

`to` accepts a **path string or a `{ query }` patch**, but never vue-router's `RouteLocationRaw` — that package stays undeclared. The query form exists because a row's View action changes one param of the route it is already on, and the page, sort and filters around it have to survive; serializing that by hand would either drop them or rebuild the codec at the call site. `NuxtLink` is imported from `#components`, because only components _in templates_ are ambient.

**`disabled` wins over `to`:** a disabled link is not a link. Every alternative rebuilds native `disabled` out of `aria-disabled` + `tabindex="-1"` + `pointer-events: none` — three mechanisms for one, taking the control out of the tab order by hand. A JS click guard was rejected separately: `stopImmediatePropagation` ordering against fallthrough listeners is not something a component can rely on, and `NuxtLink` installs its own handler you cannot get in front of.

A link activates on **Enter only** — Space scrolls the page. That is correct anchor behaviour and the one way a `to` button differs from the buttons beside it.

### An atom's `disabled` must be a declared prop, never attribute fallthrough

`BaseCheckbox` had no `disabled` prop, so `:disabled` landed on the wrapping `<div>` by fallthrough, where the attribute means nothing: the control looked plausible and stayed fully operable, with only a server 400 behind it. That is the "dead control" failure inverted — not a control that cannot act, but a lock that does not lock. The rule generalises to every atom with a wrapper element: a native form attribute has to be declared and bound to the **inner control**.

### `BaseInput` binds `:value` + `@input`, not `v-model`

`v-model` would cast a `type="number"` input's value to a number and write `1.5` back while the user is still typing `1.50`. The composition guard `v-model` provides is kept by hand, so IME input still works.

`BaseRange` applies the same reasoning to both bounds: its watcher resyncs **only a bound that disagrees with what is on screen**, which is what distinguishes an outside change (clear all, a shared URL, the back button) from the value being echoed back. Dates run through the same drafts even though their round trip is lossless — that is what lets one component serve both types.

### `BaseSelect` is an ARIA listbox **or** a combobox, never a `<select>`

A native `<select>` cannot render a choice's colour (`<option>` fills are not styleable across browsers), cannot search, cannot load asynchronously, and has nowhere to put "loading" / "no results" / "could not load" as distinct states. All four were wanted at once. Rejected: a native `<select>` with a colour swatch beside it — the swatch cannot follow the open dropdown, which is exactly where the choice is made.

`searchable` picks the control's root, and only the root — the clear button, the chevron, the teleported panel, the status row and the `role="listbox"` `<ul>` are shared. `false` gives a `<button aria-haspopup="listbox">` whose accessible name is label + value, the way a `<select>` announces; `true` gives an `<input role="combobox">`.

What it cost, all of it deliberate: **the OS-native picker on touch** (and `searchable` raises the soft keyboard where a `<button>` did not); **arrow keys changing the value while closed**, which the ARIA pattern replaces with opening the list, since a filter changing under an unseen arrow key would fire a request per press; and **type-ahead**, which is _not_ given up — reimplemented by hand (500 ms buffer, match on the option's label) for the non-searchable branch, and it must stay. Where there is a search box, the search box _is_ the type-ahead.

### The search input is in the control, not in the panel

A select where you click to open and then move to a second field to type is a select wearing a search box. **The selection renders as an overlay over the control, never as the input's value:** searching never means clearing what is already chosen, there is no restore-on-close or restore-on-blur to get wrong, and one piece of markup serves single and multiple alike. The native `placeholder` handles the empty case, so it can never show underneath a selection.

Rejected: APG's editable-combobox flavour, where the input's value **is** the selected label. It needs restore-on-close logic, forces the user to erase the current value before searching, and has no multi-select story at all.

**The chevron toggles; a click in the field never closes.** Clicking a text field places the caret, so closing on it would make the middle of a term unreachable — which leaves the searchable branch with no pointer route out unless the arrow is a target of its own. It is a `<button type="button">` sized to 24×24, because it performs an action and the target-size floor is about what a pointer must hit.

**And it is `tabindex="-1"` + `aria-hidden`, which is the part that looks like an oversight.** The toggle is a pointer convenience for something the control already does from the keyboard — ↓/Enter/Space open, Escape and Alt+↑ close — so SC 2.1.1 is satisfied by the control, not by this element. Making it tabbable would put a stop between every select and the next field for a function already bound to the keys; giving it a name without `aria-hidden` would announce one control twice, in a listbox pattern where the arrow is chrome rather than a second widget. Rejected in the other direction too: a click handler on a `<span>`, which conforms only for as long as the `aria-hidden` stays — the element would then be an unnamed, roleless target, and nothing in the markup would say it acts.

Two ARIA consequences that are easy to get backwards:

- **`aria-labelledby="${id}-label ${id}"` must not cross to the input branch.** On a `<button>` that self-reference folds the element's _content_ into its name; on an `<input>` the same construct computes from the element's **value**, so the accessible name would change with every keystroke. The button points at the overlay by IDREF instead.
- **The selection has to be announced somewhere.** On an `<input>` the accessible value is the search term, so `aria-describedby` points at the same visible overlay — a description is the right slot for "what is currently chosen", and pointing at the visible copy beats keeping a hidden second one in step with it.

### `searchable` is an explicit prop, and the threshold lives at the call site

It was derived — `loadOptions !== undefined || options.length > 8` — which welded search to the data source and made it impossible to turn off. Two things were wrong: **search and async are orthogonal** (local options deserve filtering too), and the docblock defending it was factually false — every call site owns the `options` array it passes and can count it. `shouldSearch()` in `app/utils/select.ts` exports the **predicate, not the number**, because what the registries would otherwise duplicate is the comparison rather than the literal.

Rejected: a tri-state `searchable?: boolean | 'auto'`, which keeps the threshold inside the component — the very thing being removed.

**Not for a list that arrives after mount.** `FieldFormModal`'s relation selects hardcode `searchable`: both lists are fetched, so a derived value would start `false`, render a `<button>`, then flip to an `<input>` when the fetch lands — swapping the focused element out from under the user. A stable branch beats an accurate one.

### `multiple` is tied to the model's type, and is read through `isMultiple`

`multiple?: TModel extends string[] ? true : false`. A plain `multiple?: boolean` would let `<BaseSelect v-model="aStringRef" multiple />` compile and then misbehave — a worse type system than the single-select generic it replaced.

That conditional type has a runtime cost that is invisible until it bites: Vue casts a bare attribute to `true` only for a prop it knows is `Boolean`, and the conditional gives the SFC compiler no constructor to emit, so `<BaseSelect multiple />` arrives as `''`, which is **falsy**, and the control silently runs in single mode. `vue-tsc` cannot catch it — the template checker reads a bare attribute as `true`, so the types agree with each other and disagree with the runtime.

`isMultiple` (`props.multiple !== undefined && props.multiple !== false`) makes both spellings mean the same thing. **Never read `props.multiple` directly.** Widening the prop to a plain `boolean` would fix the cast and give back exactly the mismatch the conditional prevents, so the type stays and the read moved.

Internally selection is **always** a `string[]`, whatever the model's shape: one normalisation in, one `commit` out, and keyboard, rendering and ARIA are written once. That is the whole cost of multi mode.

### In `multiple`, the control shows a count, not chips

One selection reads as itself; several read as "3 selected". Chips were rejected on a structural argument: they make the control's height a function of its content, and **nothing in the positioning layer observes that**. `useAnchoredPosition` measures on open, on `resize` and on capture-phase `scroll` — the moment a chip wrapped to a second row the control would grow, the panel would not move, and it would visibly detach from the field. Fixing that means a `ResizeObserver` in a composable whose other consumer has no use for one.

Independently sufficient: the control height is a design invariant, and in the filter drawer every control below a growing chip field would shift down as the user picks — moving the control they were aiming at.

### `BaseSelect` has one slot, and it replaces an option's text rather than its row

`option-label` sits **inside** `.base-select__option-label`, not around the `<li>`. Slot content compiles in the caller's scope, so this component's scoped rules cannot reach it — a row-level slot would silently hand out `min-width: 0` and `@include truncate` with it, and a long option would stop ellipsizing in a narrow panel. Keeping the slot inside leaves the row, its classes, its ARIA and the check icon the component's own, and leaves the default rendering byte-identical for every caller that passes nothing. A coloured option stays outside it: a badge is already the whole of its row.

A second slot for the **value overlay** was rejected. `valueText` is not only display — it is the non-searchable branch's accessible name and the searchable branch's `aria-describedby` — so a flat string is the right thing there, and a 36px overlay is the wrong place for styled sub-parts.

This is also why `ISelectOption` did not grow a `number`: the only caller that needs one (`RelationFieldSelect`) resolves it from the relations store by `option.value`, which additionally covers `BaseSelect`'s `{ value, label: value }` fallback for an option it has never rendered.

### Escape is swallowed only while something of ours is open

**Two `document`-level Escape listeners exist, and no more** — `BaseModal`'s, and the shell's for the off-canvas sidebar. One keypress must dismiss one thing, which puts a rule on each of them.

The shell's returns early while it finds itself inside an `inert` subtree, which is what `BaseModal` marks `#__nuxt` with while a dialog is open — so the layout answers "a dialog owns this key" without knowing what a dialog is, and without restating an id that is not its own. Reachable rather than theoretical: the sidebar's own "Add a table" opens a dialog over the open panel, and one press closed both until the guard landed.

A popover must never eat an Escape that belongs to the dialog around it either. **`usePopover` registers no Escape listener and must never grow one** — the key is the caller's, in one of two spellings:

- **Where focus lives inside the panel, `@keydown.esc.stop` on the panel says so structurally** — the panel only exists while open, so the handler cannot fire otherwise. That is `BaseColorPicker` and `BaseSelect`'s non-searchable branch. Two document-level listeners could not be ordered instead: `stopPropagation` between listeners on the _same_ node does nothing, and registration order is an accident of mount order.
- **Where the control keeps focus outside its panel, the modifier is actively wrong.** A combobox holds focus in its input whether the list is open or shut, so an unconditional `.stop` would mean _the filter drawer can never be closed by keyboard while any searchable select has focus_. The condition is not expressible as a modifier, so that branch handles the key in JS and calls `stopPropagation()` only when `open`.

The invariant is the sentence, not the spelling.

`.stop` survives the Teleport, which looks like it should not: the panel is a real DOM child of `<body>`, so a keydown inside it bubbles panel → body → html → document, and stopping it at the panel means `BaseModal`'s listener never sees it. Teleport moves the node, not the event path.

### `usePopover` and `useAnchoredPosition` are two composables, split by reason to change

`usePopover` owns open state, outside-pointer dismissal and focus restore; `useAnchoredPosition` owns measurement, flipping and reflow. The seam is real because their consumer sets differ — `BaseColorPicker` took the first before it took the second. Merging them would have made that retrofit an all-or-nothing change to a working control.

`usePopover` exposes `containerRef` and `triggerRef` **separately** — the outside-click boundary and the focus-restore target are not the same element once a control puts a clear button beside its trigger. Inferring the second from the first with a `querySelector` was tried and rejected: it made the ordering of two buttons load-bearing and invisible.

The extraction waited for a second consumer on purpose. Extracting on the first occurrence is the speculative build `CLAUDE.md` §1 rules out.

### `useListboxNavigation` was extracted for SRP, not DRY

The rule above does **not** bind here: it rejects a _DRY_-motivated extraction with one consumer and no size problem. This is decomposition of an SFC that had grown to two control branches, two keyboard dispatchers, a search model, an async pipeline and a popover — the same case as `useSelectOptions`, and both carry the "not a general-purpose composable" warning for the same reason.

`typeAhead` lives in it despite being called from only one branch: its whole effect is `setActive(index)`, so it shares the composable's single reason to change. Splitting a twenty-line function with one consumer into a third file is the over-fragmentation SRP is supposed to prevent.

### The select panel teleports to `<body>`, and the native `popover` attribute cannot substitute

`BaseModal` marks `#__nuxt` `inert` while a dialog is open, and `inert` is inherited by the entire subtree. A panel rendered in place is therefore unfocusable inside the very drawer it belongs to — and the native `popover` attribute does **not** rescue it, because top-layer promotion changes paint order, not DOM ancestry. Teleporting to `<body>` makes the panel a sibling of the app root, which is the only escape. Clearing the drawer's `overflow-y: auto` is a second benefit, not the reason; both together are why `useAnchoredPosition` works in viewport coordinates with `position: fixed`.

### Tab moves _into_ the panel before it moves past the control

That same teleport puts the panel after the entire app in the browser's tab order, so nothing in it is reachable by tabbing. It holds exactly one focusable — the failed state's `Retry` — which is why this is a special case in the combobox's `Tab` branch rather than a roving tabindex: a roving index manages a set, and one control is not a set. Three edges decide the shape:

- **Only forward.** Shift+Tab from the field closes and leaves, because backwards means leaving; reversing into a panel you have not been in yet reads as a trap.
- **Out of the panel, the default is not cancelled.** `dismiss()` restores focus to the control synchronously and the browser sequences from _there_, so one press leaves the select the way Tab does everywhere else. Cancelling it and focusing by hand would be one press short of the exit the user asked for.
- **Escape needs nothing new** — it bubbles from the button to the panel's own `.stop` handler.

The reachability fix is only half of it: `retry()` sets the status to `loading` synchronously, which unmounts the button being pressed, so the click handler hands focus back to the control first — exactly as `clear()` does for the ✕ that disappears with the value it clears.

### Opening on type is driven by the model, not by `keydown`

A printable-key test (`event.key.length === 1 && !ctrl && !meta && !alt`) is wrong for at least three real inputs: **paste** (`Ctrl+V` is excluded by definition, and the pasted text fires no keydown of its own), **IME composition** (the keydown is `Process`, never the composed character), and text **dropped** into the field. Watching the model catches every path by construction.

It also means this input needs no composition guard: `v-model` already withholds the write until a composition commits. `BaseInput` hand-rolls one only because it binds `:value` + `@input` to dodge the `type="number"` cast — do not copy that here.

### A click inside a searchable control never closes the panel

On the non-searchable branch a click on the trigger toggles, as a button should. On the combobox branch it only ever opens: a click inside a text field places the caret, and closing on it would make it impossible to click into the middle of a term being edited. The chevron therefore stays decorative on both branches, so the combobox offers no pointer close — accepted rather than fixed, since a real toggle button would add a third focusable inside a 36px control for a case that outside-click and Escape already cover.

### The async option list is stale-while-revalidating

While a request is in flight the previous results stay on screen under an explicit `Searching…` row, rather than blanking — the condition is still stated, which is what `CLAUDE.md` §7 asks for, and emptying the list every debounce window would flicker for no information gained. The seed (`props.options`) is what shows whenever the search box is empty, so a failed search or a cleared term always lands on a usable list.

`loadOptions` is passed through **only when `searchable`**. Handing it a loader nothing can call would leave a half-built async machine — `status` pinned at `idle`, `retry` unreachable, the abort and request-id pair dead code. One ternary, and "never ship a dead control" holds a layer below the UI. Rejected: letting `loadOptions` imply `searchable`, which would re-couple the two props and silently override an explicit `false`.

### The active option's indicator is an inset outline, and only the keyboard creates one

Under `aria-activedescendant` the active option is not focused, so `:focus-visible` — and with it the `focus-ring` mixin — can never match it. A background wash fails twice over: `--color-surface-hover` on `--color-surface` is ~1.05:1, under SC 1.4.11's 3:1 floor for a non-text indicator, and it is indistinguishable from the pointer hover on the same row. Hence a real outline in `--color-focus`, written out rather than `@include`d, with a negative offset so the scrolling list cannot clip it.

**`activeIndex === -1` is a real state, not just the value before the first open.** The cursor is a position the keyboard asked for: ↑/↓ and Page (through `moveCursor`, which _reveals_ on the current value before it walks), Home/End, type-ahead, and a term narrowing the list. Opening does not create one — a ring drawn before the user has navigated reads as a choice already made — and neither does the pointer or a set of options merely arriving, which is why the re-clamp watcher returns early rather than falling through to `nextEnabledIndex(0, 1)`. An arrow that _opens_ the list does place the cursor: it is a navigation key, and the alternative costs a press on the most common keyboard path.

Three consequences to leave alone. **`Enter` with no cursor does nothing** — there is no cursor precisely because the user has not chosen anything to commit; a fallback to the top option would commit a row nobody was shown. **Opening scrolls to the selected option without highlighting it**, which is why `scrollIntoView` is public on the composable. And **the re-clamp watcher is `flush: 'post'`**: a typed term narrows the list in the same tick that opens the panel, and the watcher is created before the one that opens it, so a pre-flush run sees `active` still false and skips the seed. Keying it on `active` instead reintroduces the bug from the other side — opening then re-clamps a cursor a printable key has just placed.

### The blank option became a placeholder, and the wire format did not move

`— Select —` / `All` used to be real `<option value="">` entries because a native select had nowhere else to put them. They are placeholders now, with `clearable` as the way back. Clearing still emits `''`, which is why `blankIsNull` in `inputs.ts` and the BOOLEAN filter's adapters are **unchanged**, `isFilterValueEmpty` still drops it, and a shared filter URL means exactly what it meant before.

The em-dash spellings went with them: they existed to make a fake choice read as not-a-choice, which a muted placeholder carries on its own. `FieldFormModal`'s **Type** select is the exception that proves the rule — it never had a blank option, its model is `TFieldType`, and it is therefore neither clearable nor placeholdered.

### `BaseSelect` no longer pins `height` — the reason expired

It used to, because Chrome ignores `line-height` on `<select>` and left it 1px taller than the inputs beside it. Its trigger is a `<button>` now, so `form-control`'s `min-height` applies like every other control. Recorded rather than deleted, or the next person to find a select a pixel off will re-pin it.

### `RelationFieldSelect` gets its `tableId` from the store, not from `IField`

`IField` carries no `tableId`, and adding one is wrong: `recordColumn()` synthesises `IField`s for `Record #` / `Created at` / `Updated at` that belong to no field row and would have to invent one, poisoning a type the query layer keeps honest. `loadOptions(tableId, fields)` already receives it, so the relations store records it per field.

`searchOptions` deliberately does **not** write `optionsByField` — that is the seed every other consumer reads, and a search result would clobber it. It does call `cacheLabels`, so a record found only through a search still renders as its label in a cell afterwards.

### A coloured badge carries a dot, not a border

`BaseBadge` had a 1px border whose only job was surviving the hovered row. With the row wash lightened that job is gone, and the badge matches the design concept: fill, word, and an 8px dot in the `-fg` step.

The dot is a `::before` with **empty** `content`, not an `<i>`: an empty pseudo-element contributes no accessible object, which is correct because the colour is redundant with the word beside it, and `DynamicTable` renders one badge per SELECT cell so a real node would cost one per cell. A glyph (`content: '●'`) is wrong twice over — `CLAUDE.md` §8 bans text glyphs as icons, and a non-empty `content` string _does_ reach the accessibility tree.

The guard is `variant === 'chip' && color !== undefined`, so `--label` never draws one: it is a metadata marker with no hue to signal. **Do not "simplify" it to `color !== undefined`** — a SELECT cell always resolves to a real hue (`badgeColorFor` falls back to `DEFAULT_BADGE_COLOR`, so a renamed choice renders grey with a grey dot), which makes the first half look redundant, and `--label` is what the second half is for.

The padding moved `rem(1) rem(7)` → `rem(2) rem(8)` in the same change, absorbing the pixel the border gave up so the box keeps the size the row height is built around. Do not "tidy" it back to a round number.

`BaseColorPicker` keeps the border on its swatches, and that asymmetry is the point: a swatch is pure colour with no word beside it, so its edge is the only thing bounding it. It is the sole consumer of the `-border` step.

### The badge palette is selected in JavaScript, by token name

`badgeTint()` builds `var(--color-badge-<name>-bg)` from the colour prop and returns inline custom properties. A Sass `@each` emitting one modifier class per hue would keep the selection in CSS, but needs the palette list to exist in both SCSS and TypeScript — and the failure mode of that duplication is silent: add a colour to the enum, forget the stylesheet, and the badge renders unstyled with no error anywhere. Composing the name keeps `_variables.scss` the single definition, and a literal colour still never reaches a component.

### `BaseBadge --chip` is never uppercased

It displays a **value** — SELECT choices are user data. `--label` is the uppercase variant, and it marks metadata (`required`), never content.

### Never ship a dead control

The header deliberately has no global "Search everything" box: cross-table search is not built, and a dead input is worse than a gap. The principle outlives the instance — if cross-table search is built, the box arrives with it.

---

## Styling & tokens

### The token layer is three layers, and the build enforces the boundary

`_palette.scss` holds primitives as SCSS variables. Because `additionalData` injects only `functions` and `mixins`, a component **cannot** reference `$blue-600` without an `@use` it will never have. Components consume `var(--color-*)` and nothing else — a compile-time fact, not a convention.

### Surfaces are split even where two share a value

`--color-surface-hover` / `-disabled` / `-muted` are separate tokens with the same value, and `--color-surface-row-hover` / `--color-canvas` are a second such pair. The previous single `--color-bg` meant page background, row hover, disabled fill and chip fill at once; re-collapsing them just relocates that bug.

### The row wash is not the control wash

`--color-surface-row-hover` (`$gray-50`) is lighter than `--color-surface-hover` (`$gray-100`) because a hovered row is the one surface a **badge** has to survive. Every badge fill sits within 1.05:1 of `$gray-100`, so a row painted at the control-hover value erases the badge outright. Raising the badge fills instead would break their 4.5:1 text pairings; giving the badge a border back is what that change removed. The row moved because it is the only one of the three with no other job.

### The border ramp is four steps, by job

`-subtle` is a rule **inside** a surface (a table's row divider), plain is structural (the box itself), `-strong` is a heavier structural job (a pinned column against columns sliding under it), and `-control` is the only one carrying a contrast floor: a control's outline is the only thing identifying the control, so it needs 3:1 non-text. Neither `$gray-200` (1.3:1) nor `$gray-300` (1.66:1) clears that — `$gray-400` (3.17:1) exists for exactly this. A row rule has no floor at all, which is why `-subtle` can be as light as it is.

### The accent and danger tints are opaque

Both were `rgb(… / 8%)`. A translucent tint composites against whatever is under it, and each of these lands on `--color-surface` _and_ `--color-canvas` — the ghost button's hover, the filter chip and the error banner all appear on both. Flat steps make the two renderings identical; the danger banner on canvas went 4.66:1 → 4.92:1 as a side effect. The comment that used to justify the alpha form ("a custom property's alpha cannot be modified in CSS") explained why they were _spelled out_, not why they were translucent.

### The sort icon is muted with `opacity`, not a colour step

`BaseInput` carries the general rule — a muted foreground is a colour token, because placeholder text at `opacity: 0.6` measured ~2.4:1. `DynamicTable`'s sort icon is the deliberate exception: it has to mute **whatever colour it currently inherits** (the header's secondary text at rest, `--color-accent` under the pointer). A fixed colour step can only mute one of the two, and restoring the other costs a `color: inherit` override that then has to out-specify the `--active` modifier.

The value is `0.35`, deliberately under the 3:1 SC 1.4.11 bar — a considered trade recorded in the register. `0.7` (compliant) was shipped first and read as visual clutter across four columns at once. The `BaseInput` rule still stands for **text**, which needs 4.5:1 and cannot reach it through transparency.

The glyph is `mdi:code-tags` under `transform: rotate(90deg)`, not the nominally correct `mdi:unfold-more-horizontal`. Turned a quarter turn, `code-tags` is a chevron pointing up stacked over one pointing down, and its two halves are more open and further apart — which is what makes it read as an affordance at 14px. `--active` resets the rotation, because the sorted column's arrow must stay upright.

### Breakpoints live in `_mixins.scss`, in `em`

A media query cannot read a custom property, and `additionalData` injects that file into every SFC. `em` rather than `px` so it honours the browser's font-size setting.

### Focus is never removed, only restyled

`_reset.scss` carries a zero-specificity baseline — `:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible` — so nothing can end up with no ring, and any component rule overrides it without a fight.

**The state is two layers, and the split is the load-bearing part.** The indicator is `--color-focus` — `$blue-500`, a step lighter than the accent so it reads as a signal rather than a second border, and floored by the halo drawn against it at 3.63:1 rather than by the page behind it, which is the pairing to check if it ever moves. Behind it sits `--focus-ring-halo`, the pale glow taken from the concept's search field.

**Where that indicator is drawn depends on whether the control already has an edge.** A button, link, row or option has none, so `focus-ring` gives it a hairline `outline`. A form control has one, so `form-control` recolours **that** border and suppresses the ring: drawing both puts two blue edges a hairline apart, which reads as a rendering fault rather than as emphasis. The two mixins are therefore mutually exclusive — a control that takes `form-control` must never also take `focus-ring`.

That leaves fields with **no** outline, and both of their signals are ones `forced-colors` mode erases: every border resolves to the same system colour and `box-shadow` is not painted. `form-control` restores a real outline inside `@media (forced-colors: active)` for exactly that reason. Removing it looks like dead code in every normal rendering and takes the focus state away from the users least able to spare it. The halo is a `box-shadow`, which means an ancestor's `overflow` can clip it and a component's own shadow outranks it in the zero-specificity baseline — both acceptable **only** because it carries nothing. Never move the indicator into the shadow to save a declaration: the states where the glow silently vanishes are exactly the ones where a ring is needed most, a truncating table cell first among them.

Two consequences worth knowing. A component that sets its own `box-shadow` **and** wants the glow must compose them in one declaration — `pages/index.vue`'s table card is the only such site. A control whose ring is inset (a negative offset, because it sits inside another control) sets `--focus-ring-halo: none`, since a glow there spreads outward over whatever encloses it — `BaseSelect`'s clear button is the only such site.

### A truncating cell clips with `overflow: clip`, not `hidden`

`overflow: hidden` clips a **descendant's** focus ring along with the text. That went unnoticed while every focusable thing in the table owned its own box; a relation cell puts a link _inside_ the wrapper, and its ring was invisible on all four sides.

`clip` truncates identically — the ellipsis is still computed at the content edge — but honours `overflow-clip-margin`, which lets the ring paint outside the box while the text stays in it. The margin is written as `rem(4)` — the focus state's whole reach, which is the halo's spread with the ring inside it — because **Chrome drops `overflow-clip-margin` to 0 for any `calc()`**, `var()` included. It is the one place that geometry is restated rather than referenced, so it has to move when `--focus-ring-halo` does.

### The control height is 36px, and 44px was never the AA bar

WCAG 2.2 **AA** is SC 2.5.8 _Target Size (Minimum)_: **24×24 CSS px**, which 36 clears with 50% margin. The 44×44 the design system used to carry is SC 2.5.5 _Target Size (Enhanced)_, which is **AAA** — it was being quoted under a "WCAG 2.2 AA" heading as though it were the requirement.

The drop is a density decision, and it is safe because it never touches a content box: every control lost 8px of height _and_ 8px of block padding together, so text has exactly the room it had at 44. **Anything that trims the height without trimming the padding clips instead of compacting.** `--header-height` moved 64 → 56 in the same change, keeping the slack it had around a 44px control.

The focus state's geometry did not move with it: it paints outside the border box, so its reach is independent of the control height. The places where its halo crosses into a neighbour were true at 44 and are unchanged — more conspicuous against a smaller box, not newly broken.

### Every sized control is one height; `link` alone has none

There is a single control height and no secondary size. `primary`/`secondary`/`danger`/`ghost` take it as `min-height`, `icon` takes it on both axes, `BaseCheckbox` gives it to the whole label row, `AppSidebar` to its items, `DynamicTable` to its sort button. `--link` is the exception and not an oversight: it is a text run with the semantics of a button, and it is what sizes `.table-card__actions` and `.field-row` — giving it the full height would grow both surfaces for no gain.

Heights _derived_ from the control are all in one direction — a control plus its own inset — and are written that way rather than as literals. Anything that restates the number by hand drifts the next time the token moves, which is exactly what happened at 44px.

### `--link` gained a target floor rather than an exemption

It was the one `BaseButton` variant with no `min-height`: ~18px tall, used by every row action. Row actions sit 8px apart, so SC 2.5.8's _Spacing_ exception could not carry them, and `RecordDetailModal`'s Back link had already hand-rolled `min-height: rem(24)` for the same reason — which is what marked the shared variant as an oversight.

**Both axes**, for the reason `--icon` already states: the button is content-sized, so a short label is narrow however tall it is ("Edit" measured 23×24 after the height was floored). The floor is 24 rather than `--control-height`: at 36 a bare text button would read as a filled one, and 24 is the actual AA requirement.

### A ghost button's padding is spacing, so the gaps beside it are unequal on purpose

`ghost` is `padding: 0 rem(12)` over a transparent background: nothing paints at its box edge, so that padding reads as part of the gap. In the records header a uniform `cluster` at `rem(16)` therefore put **40px** of visible space between Settings and Filters (12 + 16 + 12) and **28px** between Filters and the bordered search box (12 + 16 + 0) — the two controls that belong together looked the furthest apart.

The ghost pair sits in its own `cluster(4)`: 12 + 4 + 12 is the same 28. **The two gaps in that row are deliberately different numbers producing equal space** — normalising them back to one value is the regression, and it will look like a tidy-up.

### The header group needs `min-width: 0`, same as the panes

The two table headers group the `<h1>` with its primary action, so the **group** — not the title — is `page-header`'s flex item. `page-title`'s own `min-width: 0` lets the text shrink _inside_ the group and does nothing for the group itself. A flex item's automatic minimum is its content-based minimum, and a nowrap flex container's min-content size is the sum of its items' contributions — for a `white-space: nowrap` heading, the whole untruncated table name. `overflow: hidden` on the `<h1>` does not rescue it: `overflow` zeroes a box's own _automatic minimum_, not its min-content _contribution_ to its parent. It reads like a redundant line and is not.

**Rejected: `flex: 1` on the group.** That implies `flex-basis: 0`, so the group's base size stops being its content, it never reaches the wrap threshold, and the title starts ellipsising at widths where it would have fitted whole.

The primary button takes `flex: none`, through a page-owned class rather than a bare `.base-button` selector — a page must not reach for another component's internal class name. Shrink is distributed in proportion to flex base size, so an unfrozen button reaches its min-content and wraps its label onto two lines; freezing it sends every pixel of the deficit to the title, which is the one child that can absorb it.

### `text-link` is a class, not a mixin

It had three `@include`s and no per-site variation, which is a shared block, not a fragment. Converting the two page-header links to `BaseButton` with `to` was the point rather than a side effect: at 14px with no padding they were ~21px tall, standing alone in an action cluster rather than inline in prose, so SC 2.5.8's inline exception did not cover them. `.text-link` now carries the one look — a link _inside a sentence_ — and anything standing on its own in an action row is a `BaseButton` with `to`.

### The viewport lock lives in the shell, not in the records page

`app/layouts/default.vue` is `height: 100dvh; overflow: hidden`, and the sidebar and main region scroll their own content. The alternative — leaving the shell in document flow and giving the records page a `height: calc(100vh - …)` — was rejected on two counts: the page would have to restate the shell's own padding and header height and stay in step with them by hand, and it would still let the brand bar scroll away above the table. It also deleted the sidebar's `position: sticky` + `calc()`, which existed only to fake the height the fixed shell now supplies.

`dvh`, not `vh`: on mobile a collapsing URL bar leaves a `100vh` shell overhanging the visible area, which is exactly where the pager lives. **That holds app-wide, not just here** — the auth layout and `error.vue` render outside the shell and own the viewport themselves, through `centred-viewport`, which takes the same unit. A `100vh` anywhere in this project is now the anomaly.

**`min-width: 0` and `min-height: 0` on the panes are load-bearing.** A grid or flex item's automatic minimum is its content, so without them the main column's min-content width is `DynamicTable`'s full intrinsic width (the table's `overflow-x` never engages and the document scrolls sideways), and a pane holding 50 rows grows past its row so the `overflow-y: auto` beside it never fires. Both read like redundant lines and are not.

### A dialog caps against the scrim, and only its body scrolls

`.base-modal__dialog` is `max-height: 100%` and a flex column; `.base-modal__body` is `flex: 1; overflow-y: auto`. Uncapped, a dialog taller than the screen is **centred while overflowing both edges** — and the shell is `height: 100dvh; overflow: hidden`, so nothing can be scrolled to reach its header or its submit button. The percentage is the load-bearing part: it resolves against the scrim's content box, so it excludes the scrim's `rem(16)` padding already and re-resolves for free where `--drawer` zeroes it. A `calc(100dvh - rem(32))` would restate that padding by hand and drift from it — the same trap as the records page restating the shell's header height.

The scrim carries `max-height: 100dvh` because `inset: 0` on a fixed box sizes it to the _large_ viewport, which would put the bottom of a capped dialog under an expanded mobile URL bar.

The body needs no `min-height: 0`: `overflow-y: auto` already zeroes a flex item's automatic minimum size. That is why this rule worked in `--drawer` for as long as it lived there, and hoisting it left the drawer with only the two declarations that make it a drawer.

A submit button inside the body scrolls out of view on a short screen, which is how forms behave everywhere and leaves it reachable — the complaint was that it was **unreachable**. Moving the four form dialogs' buttons into the pinned `footer` would repurpose a slot the concept draws for a secondary link. Rejected outright: a bottom-sheet or full-screen dialog below a new breakpoint, for one layout that a viewport-relative cap already handles at every width.

### The records grid sizes to its rows, not to the pane

`DynamicTable` takes `flex: 0 1 auto` from the records page, so its height is its content's, capped by the space left in the pane: a few rows end at the last row with the pager directly beneath, a full page shrinks to the pane and scrolls inside itself.

It was `flex: 1` first, on the reasoning that a pager welded to the bottom edge gives the page a stable frame. That was visibly wrong — with seven records the grid was a mostly-empty box with a void between the last row and the pager. **Do not restore it.**

`flex-basis: auto` is the load-bearing third of the shorthand: it makes the flex base size the grid's own content height, which a `max-height` or a measured height would have had to approximate. Nothing states a height, so the behaviour re-resolves for free on resize and when the filter summary or the error banner takes a slice of the pane.

The empty states are centred with `margin-block: auto` on the child rather than `justify-content: center` on the parent, because the parent cannot centre one child without lifting a short grid off the top as well. That rule is nested so it outranks `BaseEmptyState`'s own `margin` — flat, the two selectors tie and the winner falls to stylesheet order across components.

### The sticky table header's rule is a shadow, not a border

`thead th` carries `box-shadow: inset 0 -1px 0 var(--color-border)` where every other cell edge is a `border-bottom`. Under `border-collapse: collapse` the collapsed edge between the header row and the first body row is painted by the **table**, not by the cell, so a sticky `th`'s `border-bottom` scrolls away with the rows and the pinned header floats. `border-collapse: separate` would fix the border and cost the single-hairline grid the table is built on. For the same reason the `th` carries its own opaque `background`: its padding lives on the inner sort button, so only the cell can paint the full width the rows scroll under.

### The pinned Actions column needs a wrapper inside the cell

The action buttons' flex row lives on a `div` **inside** the `<td>`, not on the `<td>` itself, and that is load-bearing rather than tidiness. A `<td>` with `display: flex` is not a table-cell box, so CSS generates an anonymous table-cell around it; the sticky box's containing block becomes that anonymous cell, which shrink-wraps it, and a sticky box cannot move outside its containing block — `position: sticky; right: 0` would clamp to zero movement and the column simply would not pin.

Its left edge is a `box-shadow` for the same reason the sticky header's rule is. The hairline is permanent rather than appearing on scroll — a scroll-aware shadow would put a scroll listener and reactive state into a component that is otherwise pure CSS, and in this design borders already do the structural work.

It is the one divider drawn in `--color-border-strong`: separating a frozen column from columns sliding underneath it is a heavier job than ruling off a row. **A tinted fill was rejected** — `--color-surface-muted` equals `--color-surface-hover`, so filling the column would swallow the row hover exactly where the buttons are, and `--color-accent-tint` reads as "selected" everywhere else in the app. **A wider gutter was tried and dropped**: the extra 4px read as a misalignment against the header label rather than as breathing room. Every cell now takes the same inset, with no per-cell exception.

The Actions corner header still needs its own padding rule, because it is the only header with no sort button to carry the inset. It is nested inside `thead th` and spells its class out rather than being written as a sibling `&__…` block: that is specificity, not style — `.dynamic-table thead th` outranks a bare class, so the same declarations written as a sibling block are silently dead. Moving it out of its parent will not error; it will simply stop applying.

The pinned cells paint opaque backgrounds, so `tbody tr:hover` has to repaint the actions cell explicitly, or the hovered row shows a white notch at its right edge.

### `DynamicTable` rows have an explicit height, and it is one decision with the cell inset

`height: calc(var(--control-height) + #{$cell-padding-y * 2})` on `tbody td`, not derived from the tallest cell — otherwise the action cell's buttons define the row rather than the design doing so. A row is one control plus the cell inset on both sides.

**The height and `$cell-padding-y` are one decision, not two.** A table cell treats `height` as a minimum, so the action cell's buttons only land _on_ the row height if the padding the height was built from is the padding the cell actually has. Raising `$cell-padding-y` without the `calc` following it grows every row; the `calc` is written against the variable precisely so it cannot be raised alone.

It is the app's **first and only `calc()`**, and deliberately so. Written as a literal it was a magic number calibrated against a token three files away, and it went stale the moment that token moved.

### A table column's width cap lives on a wrapper, not on the cell

`DynamicTable` sizes columns from content under the browser's default `table-layout: auto`. A table's columns are user-defined, so no field's content is bounded from above: one long TEXT value stretches its column to the width of that value and pushes the rest of the grid out of the viewport. `$column-max-width` caps it, and `$content-max-width` derives the per-box figure by subtracting the cell's own padding twice, so a column bounded by a **value** and one bounded by its **header name** land on the same width.

**The cap cannot go on the `td`.** CSS 2.2 §17.5.2 leaves the effect of `min-width`/`max-width` on table cells explicitly undefined, and under `table-layout: auto` browsers ignore it — the column is sized by the cell's max-content contribution, which the declaration never touches. A **block child's** `max-width` does bound that contribution, so the inner cell wrapper is load-bearing markup: deleting it silently restores the unbounded behaviour with the SCSS still in place.

**Rejected: `table-layout: fixed`.** It discards content-driven sizing and needs an explicit width per column — a figure the metadata layer has no source for, since a field carries a type and a name, not a display width.

**Rejected: a `--*` token.** One component's measure, and `CLAUDE.md` §8 admits tokens only as coherent semantic sets.

**Rejected: capping the sort button instead of its label.** That button is deliberately `width: 100%` so the whole header cell is the sort target; a `max-width` on it stops it short of the cell edge whenever a column has widened past the cap. The cap sits on the label instead, which leaves the gap and the sort icon outside the bounded box — a column bounded by its header name can run slightly over. Closing that gap means encoding the icon's rendered size in the table's stylesheet.

**`BaseBadge` truncates itself.** A badge is `display: inline-flex`, so it is an atomic inline box to the cell containing it: `text-overflow` cannot ellipsise it, and an overflowing badge is hard-clipped mid-pill with the ellipsis painted over its own fill. An inner `&__text` wrapper plus `max-width: 100%` moves the truncation inside the badge. This is why the badge, not `DynamicTable`, owns the rule.

**`MultiValueCell` is `display: inline` for the same reason, from the other side.** It was `inline-flex`, which made a whole list one atomic box — so an over-full list was hard-clipped at the cell edge with nothing to say values were missing, and the entries did not even shrink, because a flex item's automatic minimum floors it at its own content. Plain inline puts the entries in the cell's own inline formatting context, where the cap already applies: the values that fit are drawn in full and the first that does not gives way to an ellipsis. `gap` goes with the flex box, replaced by a margin on adjacent siblings.

Two consequences. **`RecordDetail` no longer overrides the cell's layout** — what put the list on one line was always `DynamicTable`'s `white-space: nowrap`, so the dialog only has to not impose it and to space the wrapped rows with a `line-height`, since inline content has no `row-gap`. And **the ellipsis is not machine-checkable**: the dropped badge keeps its box, its client rects and its `checkVisibility()`, so it is paint and nothing else — it is one of the approximated clauses in `architecture.md` §12.

**`BaseBadge` declares its own `height` and `line-height`, and the second is what matters.** An `inline-flex` box with neither is sized by the line-height it _inherits_, so a badge was 25px in a table cell, 21.5px in a `BaseSelect` overlay and 32px in `RecordDetail` — where the `line-height` above spaces the wrapped rows and the pills standing on them grew with it. Declaring the pair ends the inheritance at the badge, which leaves a container free to set leading for its own rows. **Rejected: normalising line-height at each call site** — one rule spread over every container that will ever hold a badge, and silent when the next one forgets. Only Playwright can see this: `test.css` is `false` in both Vitest projects, so a component spec reading a height reads nothing.

---

## Accepted limitations

The register referenced by `CLAUDE.md` §1. **Open** entries are in scope for the current phase; **Accepted** entries are not, unless a request says otherwise. A limitation that has been fixed leaves the register — the constraint that outlives it, if any, moves into the entry above that governs it.

### Open

**Row actions are three inline icons, where the concept draws one `⋯` menu** of full sentences. The stated blocker is gone — `usePopover` + `useAnchoredPosition` anchor correctly inside a scrolling, clipping container. What is left is that three targets in a pinned column still fit, so the menu would be work without a user-visible gain. The third button does add one more site where the focus halo crosses a `gap: rem(4)` neighbour — the bargain that row already struck. _Revisit when a fourth row action appears._

### Accepted

**Four lines of `architecture.md` §12 are approximated, not proven.** Playwright covers the rest. What it cannot reach: a **hydration-mismatch warning**, which a production build silences (the specs assert the SSR HTML is correct and the console clean instead); a **clipped focus ring**, asserted structurally as the focused link's box sitting inside its cell's; **Backspace held down**, which no Playwright API reproduces — pressed repeatedly instead; and **a multi-value cell's ellipsis**, which is paint with no DOM consequence. Running against a dev build recovers the first at the cost of testing something other than what ships.

**Nitro's own routing is exercised by no test.** The integration suite imports each handler and invokes it with a constructed `H3Event`, so `requireUser` → ownership → zod → service all run against a real database, but the path-to-handler mapping, the method suffix convention and route-param extraction are taken on trust. Covering them meant booting the whole app per run, which costs a Nuxt build for a layer that is generated rather than written — and which Playwright drives from the outside anyway. _Revisit only if a routing bug reaches production._

**A field named entirely in non-ASCII gets the key `field`.** `slugify` keeps `^[a-z0-9_]+$` and nothing else, so "Компания", "会社" and "🎯" all reduce to nothing and take the `field` fallback. The charset is not incidental: the camelCase record columns cannot be shadowed by a user key _because_ this cannot emit one, and the raw-SQL note rests on the same sentence. Unicode keys would be SQL-safe (keys are always bound as parameters) but would put percent-encoded names in every filter URL and retire both arguments. The key is machine-facing — the field's **name** is untouched. _Revisit only if non-ASCII names become the common case._

**36px targets are below the Apple HIG / Material touch figure on touch devices.** A flat 36 was chosen over a `@media (pointer: coarse)` override restoring 44: a second geometry mode means every derived height has to hold at two values, and the app's touch use is secondary. Clears SC 2.5.8 (24×24) with 50% margin; it is SC 2.5.5 **AAA** that is given up. _Revisit if touch becomes a primary surface._

**A select no longer opens the OS-native picker on touch**, and a searchable one raises the soft keyboard where a `<button>` did not. The price of a listbox that can render a choice's colour, search, and load asynchronously — none of which a `<select>` can do. Every option row is `--control-height`, so SC 2.5.8 is clear either way; the keyboard half is bounded by `shouldSearch()`, which keeps short pickers on the button branch. _Revisit if touch becomes a primary surface._

**In `multiple`, the closed control shows a count, not which values are chosen.** Chips would make the control's height content-dependent, which `useAnchoredPosition` does not observe. In a filter the information is restated in `RecordsFilterSummary` above the table; in the **record form** it is not, which is the one place multi-value reads as less than single-value did. A chip row _below_ the control, leaving its height fixed, is the cheap fix if it is ever wanted. _The form case is the one worth revisiting._

**A multi-value filter can only mean _any of_, never _all of_.** There are no operators anywhere in this project, so a filter's value is its whole contract and "has any" is the only question its shape can ask. Expressing "has all" needs an operator in the URL, in every control and in the SQL map — reopening a load-bearing decision to serve one comparison. Users do want it; the answer is a design change, not a patch. _Revisit only alongside operators as a whole._

**A multi-value cell shows one line in the table**, so values past the width cap are cut off. A row has a fixed height, so wrapping would clip the second line rather than reveal it, and a `+2` affordance still needs a measurement the cell has no reason to take. The values that fit are drawn in full and the rest give way to an ellipsis, exactly as a long TEXT value always has.

**A legacy field keyed like a reserved param cannot be filtered**, and nothing on screen says why. Only `page`, `pageSize`, `sort`, `dir`, `search` and `detail` are affected, and `createField` has refused those keys since the filter param format landed — so no field the app can create is in this state, only older data. Both alternatives cost more: a migration renaming user field keys rewrites the JSONB key of every record and every link already shared; an explanation in the drawer is UI built for a state that should not exist. The field still renders and still sorts.

**Deleting a target record leaves a dangling id** that reads as "Unknown record". Blocking it would mean a JSONB scan of every table on every delete. Deleting a target **table** is refused with a 409 instead. _Revisit only with a real referential design._

**Renaming a SELECT choice orphans the records holding the old text**, which then render as a neutral badge. A choice's identity is its own text, so the whole SQL layer stays out of it. The stale value keeps its text rather than blanking, and nothing errors. An option id buys nothing for colour.

**Sorting/filtering by a JSONB key is unindexed.** Keys are user-defined per table, so no general index applies. _The first scaling ceiling; watch it._ Three limitations sit on top of it and are accepted for the same reason: a **relation label sort** costs one PK lookup per matching row; **free-text search** is unindexable and its cost is paid twice (page query + count), bounded only by `SEARCH_MIN_LENGTH`; and **relation option search** scans the target table the same way, though paid once, over one table, on one expression, under a hard `LIMIT`.

**A disabled `BaseButton` with `to` renders `<button disabled>`**, so it announces as _button, dimmed_ rather than _link, dimmed_. Every alternative rebuilds native `disabled` out of `aria-disabled` + `tabindex="-1"` + `pointer-events: none`, taking the control out of the tab order by hand for a state the rest of the app expresses natively.

**A truncated table cell offers no way to read the full value** — no `title`, no expand affordance, **except for a relation**, whose dialog shows the target in full. The rendered text is produced by the cell _component_ (a label resolved from a store, `Yes`/`No`, a formatted date), so it is not recoverable from the raw value. Both routes to it buy a **pointer-only** tooltip: a text projection per field type is a fifth registry against the "only cells are components" contract, and reading it back off the DOM means a `scrollWidth` pass over every cell plus a `ResizeObserver`, re-run on every fetch. Against that, the View action is one click away on every row. _Revisit if something else earns the table a measurement pass, which would make the tooltip nearly free._

**The unsorted sort icon is ~1.67:1**, under the 3:1 SC 1.4.11 floor for non-text UI. `--color-text-secondary` at `opacity: 0.35`. A compliant `0.7` was shipped first and read as clutter — the glyph repeats on every column at once. Nothing depends on seeing it: the header's own text names the column, the button is in the tab order with a visible focus ring, and sort state reaches assistive tech through `aria-sort` on the `th`. It is an affordance hint, not a control boundary — unlike `--color-border-control`, which is why that token carries the floor and this does not. _Raise it only on a real report of users missing the affordance._

**A badge's fill is ~1.1:1 against a hovered row**, so the pill shape barely reads there. The badge draws no border by design. The dot (its `-fg` step, ≥6:1 on that row) and the word both survive, and neither the fill nor the dot is the meaning. Raising the fills to bound the pill would break their 4.5:1 text pairings.

**Nothing reports the client's errors, and the server's log is a local file.** The server half is covered — `plugins/error-log.ts` records every 5xx — but a rotating file is per-machine and nobody is told it grew, so more than one process means a real sink. The browser side has nothing at all. _Revisit before any real deployment._
