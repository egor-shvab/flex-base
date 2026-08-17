# Architecture review — proposals

A staging document, not a fourth permanent reference. Each entry here is a **proposal awaiting a
decision**. When one is accepted and lands, its rule moves to `CLAUDE.md`, its contract to
`architecture.md`, its rationale to `decisions.md`, and its row leaves this file. When one is
rejected, only the rejection moves — into `decisions.md`. When the register empties, delete it.
Nothing here is a plan of record until it appears in `roadmap.md`.

Scope: structural change only — layering, module boundaries, dependency direction, where a
responsibility lives. Renames, formatting and single-helper extractions are out of scope by
request.

---

## 0. What the review found

The codebase is **not** organically evolved. It follows one pattern deliberately: metadata-driven
registries typed as total `Record<TFieldType, …>` maps, ownership pushed into the `where` clause,
URL as the single source of truth for list and dialog state, a four-layer `shared/` with a
declared import direction, and four test projects split by what a spec _needs_ rather than what it
_is_. Those are the right calls and none of the proposals below disturbs them.

So the honest answer to "what would we decide differently from the beginning" is narrow, and it is
mostly about **where things live rather than how they work**. The first theme — three server layers
present but only two named — is closed: `server/db/` now holds persistence and the direction
`api → services → db` is lint-enforced. So is the second half of the next one: ownership is now
obtained from a handler factory rather than remembered. Three remain:

1. **The client/server contract is a convention, not a structure.** It is currently correct at
   every one of ~21 client call sites, and nothing but review keeps it that way (P3).
2. **The extension axis is scattered.** A field type is the one thing this platform is designed to
   be extended by, and defining one means editing thirteen places across three roots (P4).
3. **One client-side cache duplicates a framework the app already runs** (P5, P6).

Everything after P7 is either taste, deferred, or gated behind a trigger — labelled as such.

**Ranked by value ÷ risk:** P6, P7, P3, P4, P10, P9, P5, P8, P11. (P1 and P2 have landed.)

---

## P3 — A declared client↔server contract, and one API client module per resource

**Problem.** There is no contract between the two halves of the app. There are 21 hand-written
pairs of a URL string and an asserted response type, spread over seven client files:

```
app/stores/tables.ts        4    app/stores/relations.ts      2
app/stores/fields.ts        4    app/composables/useTableLoader.ts   1
app/stores/records.ts       4    app/composables/useRecordDetail.ts  1
app/stores/auth.ts          4    app/components/modals/FieldFormModal.vue  1
```

Three distinct problems ride on that:

1. **The response type is asserted, not derived.** `api<{ tables: ITableListItem[] }>('/api/tables')`
   is a claim about a handler the compiler never looks at. Change `index.get.ts` to return
   `{ items }` and everything still compiles; the page breaks at runtime.
2. **The route shape is duplicated.** `/api/tables/${tableId}/fields/${fieldId}/options` is written
   in two stores, and the whole route tree is restated across seven client files plus the e2e
   specs. A route rename is a find-and-replace across layers.
3. **A component performs transport.** `FieldFormModal.vue` calls `useApi()` and fetches another
   table's fields directly. `decisions.md` explains _why_ it bypasses the fields store — that
   reasoning is sound — but the conclusion drawn was "fetch from the component", when the actual
   gap is that there is no transport layer below the stores to reach for.

**Proposed shape.** A thin API layer, and stores that hold only state.

```
shared/types/api.ts     the response shapes, one per endpoint — the contract both sides satisfy
app/api/
  client.ts             useApi()'s current job (the useRequestFetch seam)
  paths.ts              every route as a function: tables(), table(id), fieldOptions(tableId, fieldId)
  tables.ts  fields.ts  records.ts  relations.ts  auth.ts
```

Each resource module exports one function per endpoint, typed from `shared/types/api.ts`:

```ts
export const listFields = (tableId: string) => api<IFieldsResponse>(paths.fields(tableId))
```

Handlers assert against the same declaration — `satisfies IFieldsResponse` on the returned object,
or an explicit return type — so a handler and its caller cannot drift without a compile error.
Stores lose every URL and every response generic; `FieldFormModal` calls `listFields(targetTableId)`
and no longer knows a route exists.

**Alternative considered.** Nitro already infers route types for `$fetch`, so a leaner variant is to
delete the explicit generics and let inference do the work. Rejected as the primary route: it does
not cover the path builders, `useRequestFetch()`'s typing does not carry the inference reliably
through the cookie-forwarding seam, and inference gives the client no declaration to test or read.
The declaration is the point.

**Affected.** New `app/api/*` (~6 files) and `shared/types/api.ts`; all five stores;
`useTableLoader`, `useRecordDetail`; `FieldFormModal.vue`; `useApi.ts` folds into `app/api/client.ts`;
all 19 handlers gain a `satisfies` or a return type. Store specs stop stubbing URLs and stub the
API module instead — which is the seam they wanted all along.

**Why it is an improvement.** The frontend/backend boundary becomes a thing that exists in one file
rather than an agreement re-made at each call site. Route renames become one edit. Components stop
doing transport. And the store specs' current dependence on `registerEndpoint` with a literal path
turns into a typed stub.

**Risks / downsides.** `shared/types/api.ts` is a second place a response shape is written, so it
can drift from the handler unless the `satisfies` is actually applied at all 19 — a mechanical but
real discipline. It also makes `shared/` the home of a boundary contract, which is a new job for
that directory and should be stated in `CLAUDE.md` §3 rather than left implicit. Mild risk of the
API modules turning into a second store layer; the guard is that they hold no state and no
reactivity — they are functions over `$fetch` and nothing else.

**Complexity.** Medium. Wide but shallow; no logic changes.

**Depends on.** Nothing — P2 has landed, so handler return types are already clean. Should land before P5, which
needs a transport seam to move the record writes to.

---

## P4 — A field type is a module, not thirteen registry entries

**Problem.** The field type is _the_ extension axis of a low-code platform, and defining one is
currently spread across three roots and thirteen declaration sites. `CLAUDE.md` §9 lists them, which
is itself the tell — the checklist exists because the structure does not carry the answer:

| Where                             | What                                                                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`            | the enum member                                                                                                                                                                             |
| `shared/constants/field.ts`       | `FIELD_TYPES`, `FIELD_TYPE_LABELS`, `MULTI_VALUE_BY_TYPE`                                                                                                                                   |
| `shared/constants/filter.ts`      | `FILTER_VALUE_BY_TYPE`                                                                                                                                                                      |
| `shared/validation/field.ts`      | the `superRefine` branch for its options                                                                                                                                                    |
| `shared/validation/record.ts`     | `VALUE_SCHEMA_BY_TYPE`                                                                                                                                                                      |
| `server/services/record-query.ts` | `FIELD_SQL_BY_TYPE`, `MULTI_SQL`                                                                                                                                                            |
| `app/field-types/`                | `FIELD_INPUTS` + `MULTI_INPUTS`, `FIELD_FILTERS` + `MULTI_FILTERS`, `FIELD_CELLS`, `FILTER_SUMMARIES` + `MULTI_SUMMARIES`, `FIELD_TYPE_ICONS`, `FIELD_CONFIG_SUMMARIES`, one cell component |

Totality makes this **safe** — every map is a total `Record<TFieldType, …>`, so a missing entry is a
compile error, and that mechanism should be preserved exactly. What it does not make it is
**cohesive**: no file answers "what is a DATE field", and reading one type's behaviour means opening
nine files and reading one line of each. Deleting a type means finding thirteen lines. The same
shape repeats a second time for record columns (`RECORD_COLUMN_SQL` on the server, `RECORD_COLUMNS`
on the client, `recordColumn()`/`queryColumns` in shared).

**Proposed shape.** Invert it: one module per type per layer, and registries that assemble rather
than declare.

```
shared/field-types/
  text.ts number.ts boolean.ts date.ts select.ts relation.ts   ← label, value schema (+ list form),
                                                                 filter shape + empty, multi capability
  registry.ts                                                   ← the only file listing all six;
                                                                   rebuilds today's maps from them
server/field-types/
  text.ts … relation.ts     ← expr / sortExpr / filter / searchPredicate, and the multi variant
  registry.ts               ← FIELD_SQL_BY_TYPE, MULTI_SQL, sqlFor
app/field-types/
  text/ number/ … relation/ ← input, filter, cell, summary, icon, config summary, multi overrides
  registry.ts               ← the six maps + inputFor / filterFor / summaryFor / cellComponent
```

Consumers keep importing the assembled maps and resolvers, so **not one call site outside
`field-types/` changes**. Adding a type becomes three new files and three lines in three registries;
the compile-error-on-omission property is unchanged, because the registries are still total literals.

**Why it is three slices and not one folder.** It cannot be one folder, and the reason is the
bundler, not taste. A module holding both the value schema and the SQL rules would pull
`Prisma.Sql` — and therefore the Prisma client — into the browser bundle the moment the form
imports the schema. `.vue` cells cannot enter the Nitro bundle for the mirror-image reason. Three
co-located slices with one file per type in each is the closest correct approximation, and the
constraint is worth writing into `CLAUDE.md` §9 whether or not this proposal lands.

**Affected.** `app/field-types/*` (restructured, ~20 files), new `shared/field-types/` and
`server/field-types/`; `shared/constants/{field,filter}.ts` and `shared/validation/record.ts` shrink
to re-exports or disappear; `server/services/record-query.ts` keeps only the builders. Consumers:
unchanged. Specs: the registry specs move with their registries; the two structural invariant specs
(`MULTI_INPUTS` vs `MULTI_VALUE_BY_TYPE`, `MULTI_SQL` likewise) become **stronger**, because both
halves now sit in one file per type.

**Why it is an improvement.** Cohesion on the axis the product is designed to grow along. A type
becomes readable, reviewable and deletable as a unit. The `MULTI_*` override tables stop being four
separate parallel maps a reader has to align by eye and become a second key in one object.
`CLAUDE.md` §9's thirteen-row checklist collapses to "three files and three registry lines", which
is the version a checklist should be.

**Risks / downsides.** The largest diff of the set, and it touches the most carefully-reasoned code
in the project — `decisions.md` records why `cellComponent` cannot live in `cells.ts` (a cycle
through `MultiValueCell`), and a naive per-type restructure can reintroduce exactly that cycle. The
registry files must remain the only place the six types are enumerated, or totality silently
degrades into six independent files that can each forget an entry. There is also a real argument
for **not** doing this: the current design already prevents the failure mode, so the gain is
cohesion rather than correctness, and it is only worth its cost if new field types are actually
expected. **Recommendation: gate it on that.** If the next phase adds a field type, do this first;
if not, take P1–P3 and leave this.

**Complexity.** Medium–large. No behaviour change; the whole suite should pass untouched, which is
also the safety net that makes it feasible.

**Depends on.** Nothing — the server slice lands in `server/field-types/`, beside `db/`.

---

## P5 — Retire the records store; the list is `useAsyncData`'s job

**Problem.** `app/stores/records.ts` is a global Pinia singleton used by exactly one page. It holds
`records`, `total`, `page`, `pageSize`, `pending`, `failed` and a `loadedTableId` guard whose sole
purpose is clearing state that leaked between tables — that is, it hand-rolls a keyed cache. Nuxt
already ships one: `useAsyncData` keyed on the table and the query gives pending, error, refresh,
SSR-payload transfer and per-key isolation for free, and the page already uses it for the table
metadata and for the detail dialog.

The consequence is visible in the page: an `await useAsyncData(...)` for the first load, plus a
`watch(queryKey)` that re-invokes the store for every subsequent one, plus a deliberate
rethrow-then-swallow dance so the two paths can report the same failure differently
(`decisions.md` → "A failed refetch is visible, not silent"). That entry is careful and correct, and
it is describing the seam between two caches doing one job.

**Proposed shape.** A `useRecordList(tableId, queryState)` composable owning one
`useAsyncData` keyed on `records-${tableId}-${queryKey}`, returning `records`, `total`, `page`,
`pageCount`, `pending`, `failed`, `refresh`. Writes move to `app/api/records.ts` (P3) and the page
calls them directly, refreshing afterwards. The store is deleted.

**Affected.** `app/stores/records.ts` (deleted), new `app/composables/useRecordList.ts`,
`app/pages/tables/[tableId]/index.vue` (the `useAsyncData` + watcher pair collapses into one call),
`app/stores/records.nuxt.spec.ts` → a composable spec.

**Why it is an improvement.** One cache instead of two. The watcher, the rethrow-and-swallow pair
and the `loadedTableId` guard all disappear, and each of them exists only because a singleton store
is holding page-scoped state. The four-state body (skeleton / fieldless / empty / table) reads off
one source instead of correlating `pending` against `records.length` across two owners.

**Risks / downsides.** This is the **riskiest proposal in the set**, and the risk is precise: three
separate entries in `decisions.md` pin behaviour that depends on the exact interleaving of "rows
cleared" and "fetch in flight" — the skeleton must appear while switching tables, an in-place
refetch must keep its rows and say "Filtering…", and the empty state must be suppressed while
`failed`. `useAsyncData` changing keys does not preserve previous data by default, so reproducing
"keep the rows during an in-place refetch" needs deliberate work. Those behaviours are covered by
e2e specs, so a regression will be caught — but they are the cost, and if they cannot be reproduced
cleanly the correct outcome is to abandon this proposal, not to weaken them.

**Complexity.** Medium, with a high chance of being fiddly at the end rather than the start.

**Depends on.** P3 (needs somewhere for the write calls to go). Should not be attempted before the
e2e suite is green and being run.

---

## P6 — Counts come from the server, not from client-side arithmetic

**Problem.** `tablesStore.adjustCachedCount(tableId, key, delta)` maintains a server-derived
projection by hand on the client. `stores/fields.ts` and `stores/records.ts` both write into the
tables store after their own writes succeed — a cross-domain write in both directions, plus a
`Math.max(0, …)` floor whose own comment admits the count can be wrong when two tabs disagree.

**Proposed shape.** The endpoints that change a count return the affected table's counts, and the
client stores what it was told:

- `POST/DELETE /api/tables/:id/records` and `.../fields` return `{ …, table: ITableListItem }`
  (or just `{ counts }`), and the tables store gets one `applyTableCounts(row)` action.

**Affected.** Four handlers, `server/services/{fields,records}.ts`, `shared/types/api.ts` (P3),
`app/stores/{tables,fields,records}.ts`.

**Why it is an improvement.** Removes two cross-store writes and the only place in the client where
a server-owned number is computed rather than received. The floor, the delta arithmetic and the
"two tabs disagree" caveat all go away because the client stops guessing.

**Risks / downsides.** One extra `COUNT` per write, on a table already being written — negligible,
and it can ride the same transaction. If P3 has not landed, the response shape change has no
contract to be declared in.

**Complexity.** Small.

**Depends on.** P3 (naturally; can be done without it at the cost of two more hand-written response
types).

---

## P7 — Scope by location: component-private composables live with their component

**Problem.** `app/composables/` holds three different scopes in one flat directory:

- genuinely app-wide: `useApi`, `useForm`, `useDeleteConfirm`, `useDebouncedModel`, `usePopover`,
  `useAnchoredPosition`
- **component-private**: `useListboxNavigation` and `useSelectOptions`, both of which carry an
  explicit "**Decomposition of `BaseSelect`, not a general-purpose composable**" warning in their
  own doc comments and in `architecture.md`
- records-domain: `useRecordListQuery`, `useRecordDetail`, `useDetailLink`, `useTableLoader`

The middle group's intended scope is stated only in prose. Anything in the app can import them, and
nothing signals that doing so is a mistake.

**Proposed shape.** Promote the component to a directory and put its private parts inside it:

```
app/components/common/BaseSelect/
  BaseSelect.vue
  useListboxNavigation.ts   useSelectOptions.ts
  *.nuxt.spec.ts            (the four existing files)  select-harness.ts
```

Nuxt's `components: [{ path: '~/components', pathPrefix: false }]` resolves `BaseSelect.vue` inside
a nested directory unchanged, so no template moves. `app/composables/` is then app-wide composables
only, and the records-domain four either stay (if P8 is declined) or move with their feature.

**Sub-note, not a separate proposal.** With the directory in place, one further seam inside
`BaseSelect` becomes cheap: `selected` / `seen` / `commit` / `choose` / `clear` / `valueText` /
`valueBadge` is ~60 lines of pure model logic that currently needs the Nuxt project to test because
it lives in an SFC. Extracted as `useSelectSelection`, it is testable in the `unit` project in
milliseconds. This is **not** the `BaseSelectPanel` split `decisions.md` rejected — that rejection
stands and this review agrees with it; the panel's keyboard dispatchers, IDREFs and teleport are
genuinely one cohesive unit.

**Affected.** `app/components/common/BaseSelect.vue` → a directory; two composables and five spec
files move; `test/select-harness.ts` moves; import paths in `field-types/{inputs,filters}.ts` and
`controls/RelationFieldSelect.vue` update.

**Why it is an improvement.** A file's directory states its scope, which is the only form of that
statement a reader cannot skip. It also stops `composables/` reading as "twelve interchangeable
things" when it is really three groups.

**Risks / downsides.** Vitest include globs are `{app,shared}/**/*.nuxt.spec.ts`, so the moved specs
stay in project — worth verifying rather than assuming. Nothing else.

**Complexity.** Small.

**Depends on.** Nothing.

---

## P8 — Feature folders for the frontend

**Problem.** The records feature is spread across six top-level directories:
`pages/tables/[tableId]/index.vue`, `components/records/`, `field-types/`, `stores/records.ts`,
`stores/relations.ts`, `composables/useRecord*.ts` + `useDetailLink.ts`, `utils/record-value.ts`.
Understanding or changing it means traversing all six, and the boundary between the **design system**
(`components/common/`, ten `Base*` atoms with no domain knowledge) and **domain UI** is currently
one directory level rather than a real seam.

**Proposed shape.**

```
app/
  components/common/     the design system — Base* only, no domain imports
  features/
    records/   components/ composables/ api/
    fields/    components/ composables/ api/
    tables/    components/ composables/ api/
  field-types/           stays: it is cross-feature by construction
  pages/ layouts/ middleware/ assets/ utils/
```

with `components: [{ path: '~/components', pathPrefix: false }, { path: '~/features', pathPrefix: false }]`.

**Why it would be an improvement.** Co-location; a feature becomes movable and deletable as a unit;
the design-system boundary becomes physical and therefore lintable ("nothing under
`components/common/` may import `#shared/types/field`" is a rule you can actually write).

**Risks / downsides, and the recommendation.** This is the most taste-driven entry in the register
and the one I would **not** do yet. Three reasons: it fights the Nuxt directory conventions every
reader of this codebase already knows; the payoff scales with the number of features and there are
three, one of which (`field-types/`) legitimately refuses to belong to any of them; and P3 and P4
both change what "the records feature" even contains, so doing this first means doing it twice. A
half-measure — some domain code in `features/`, some still in `components/records/` — would be worse
than either end state.

**Complexity.** Large, and almost entirely in review rather than in code.

**Depends on.** P3, P4, P5. Revisit **only** once those have landed, or when a fourth domain appears.

---

## P9 — Decide what `services/` means about h3, then make it true

**Problem.** `CLAUDE.md` §3 describes `server/services/` as "generic, framework-agnostic business
logic". It is not: all four services import `createError` from `h3` and throw HTTP errors directly,
and the status-code policy is scattered — `toHttpError` maps `P2002`→409 / `P2025`→404 while each
service carries its own `{ conflict, notFound }` message bag, and the domain-specific codes (400 for
a type change, 400 for retargeting a relation, 409 for deleting a relation target, 400 for a
dangling link) are inline `createError` calls across three files.

Two coherent answers, and the current state is neither:

- **(a) Full separation.** Services throw domain errors (`ConflictError`, `NotFoundError`,
  `InvalidInputError`); one mapper at the API boundary — a Nitro plugin or the P2 factories —
  turns them into HTTP. Services become independent of the transport and of h3 entirely.
- **(b) Honest coupling.** Keep throwing `createError`, delete the "framework-agnostic" claim from
  `CLAUDE.md`, and consolidate the status-code policy into one `server/http-errors.ts` that names
  every code the app can produce, so the 404-not-403 rule and the 409 set are readable in one place
  instead of inferred from four files.

**Recommendation: (b).** There is exactly one transport and no plan for a second, so (a) buys
portability nobody has asked for and adds an indirection between throwing and answering — precisely
the speculative generality `CLAUDE.md` §1 rules out. What (b) buys is real and small: one file
stating the status-code policy, and a documented claim that matches the code.

**Affected.** (b): new `server/http-errors.ts`; `server/utils/prisma-errors.ts` folds into it; the
four services; `CLAUDE.md` §3.

**Risks / downsides.** (b) is close to a rename and will read as one — its value is entirely in the
consolidated policy file, so if that file ends up as six re-exports it was not worth doing. (a) is a
genuine architectural change and remains available later; nothing here forecloses it.

**Complexity.** (b) small; (a) medium.

**Depends on.** Nothing.

---

## P10 — An error sink is a port; the client has none at all

**Problem.** `server/utils/error-log-file.ts` appends to `logs/server-errors.log` and rotates it —
a concrete infrastructure implementation reached directly by `server/plugins/error-log.ts`. It is
per-machine, nobody is told when it grows, and more than one process means lost errors. The browser
half does not exist: a client-side exception is reported nowhere. `decisions.md` → Accepted
limitations already carries this with "_Revisit before any real deployment_".

The pure half is already correctly separated (`error-log.ts` — `isLoggableServerError`,
`buildErrorLogEntry`, `formatErrorLogLine`, with a redaction contract). What is missing is the seam
between it and where an entry goes.

**Proposed shape.** A one-method sink interface — `write(entry: IErrorLogEntry): void` — with the
file writer as the default implementation and the plugin resolving it from runtime config. Then a
client boundary: `app/plugins/error-report.client.ts` hooking `vue:error` and
`window.onunhandledrejection`, posting through one `POST /api/client-errors` handler into the same
sink, under the **same redaction contract** — which is the part that must not be reinvented.

**Affected.** `server/utils/error-log-file.ts` (becomes one implementation of the port), new
`server/utils/error-sink.ts`, `server/plugins/error-log.ts`, new client plugin and endpoint,
`decisions.md` (the redaction contract grows a client clause and its limitation row shrinks).

**Why it is an improvement.** Swapping the destination becomes configuration rather than an edit,
and the client stops being a blind spot. The redaction contract — currently the strongest thing
about this subsystem — gets applied to a second source instead of being duplicated for it.

**Risks / downsides.** A public `POST /api/client-errors` is an unauthenticated write surface and
needs a rate limit and a hard body cap, or it is an amplification vector. That guard is the
substance of the work, not an afterthought.

**Complexity.** Small–medium.

**Depends on.** Nothing.

---

## P11 — The JSONB ceiling: pick the index strategy before it is urgent

**Problem.** Every filter and sort on a user-defined field is an unindexed expression over
`Record.data`. `decisions.md` names this the first scaling ceiling and accepts three consequences on
top of it (unindexable free-text search paid twice, a per-row PK lookup for a relation-label sort,
a scan per relation-option search). The architectural question is not "is it slow yet" — it is
**whether the current query layer can accommodate the fix**, because if it cannot, the fix arrives
as a rewrite under load.

**The good news, stated so it is not re-derived later:** it can. Because `record-query.ts` composes
SQL per field from metadata rather than emitting one fixed query, every remedy below plugs into the
existing per-type rules:

- a **GIN index** on `data` helps exactly one comparison — `jsonb_exists_any`, the multi-value
  filter, which `record-query.ts` already notes is the one GIN-indexable operator in the layer;
- a **per-field expression index** (`CREATE INDEX … ON "Record" ((data ->> 'key'))`) is a
  `sortExpr`/`expr`-shaped decision the registry already owns;
- a **maintained `tsvector` column** would replace `buildRecordSearch`'s OR group, which is already
  a single seam.

**Proposed shape (the decision, not the build).** Add index lifecycle to the field service: on
`createField`, and on delete, issue a `CREATE INDEX CONCURRENTLY` / `DROP INDEX` for the field's
projection — gated behind a per-table row-count threshold so small tables pay nothing. That makes
DDL part of a metadata write, which is a genuine architectural commitment and should be taken
deliberately.

**Risks / downsides.** DDL inside a user-facing request is a new failure mode (lock waits,
`CONCURRENTLY` cannot run in a transaction, a half-created index on failure); index count grows with
fields × tables and so does write amplification; and none of it helps free-text search, which needs
the separate `tsvector` answer. This is the one entry where doing nothing is defensible for a long
time.

**Complexity.** Large.

**Depends on.** A measurement. **Gate: revisit at the first table over ~100k records, or the
first report of a slow filtered view — not before.**

---

## Considered and recommended against

Recorded here so the reasoning is not re-derived; on acceptance of this review these move to
`decisions.md`.

**A repository layer per entity.** Services call Prisma directly, are unit-tested against
`test/prisma-mock.ts` and integration-tested against real PostgreSQL. A `TableRepository` /
`FieldRepository` / `RecordRepository` would be four pass-through classes over an ORM that is
already a repository, and would obscure the §5 rule that makes ownership safe — "ownership lives in
the `where` clause" is readable in a service and hidden behind a method signature in a repository.
What is genuinely wanted from that pattern — one home for select shapes, row mappers and SQL — is
P1, without the indirection.

**Splitting `shared/` by domain** (`shared/record/`, `shared/field/`, …) instead of by layer. The
present split (`types` → `constants` → `utils` → `validation`, importable only downward) is a
mechanically checkable rule, and it is the thing keeping the isomorphic layer honest. A domain split
trades it for cohesion the layer cannot actually deliver: record, field and filter are densely
mutually referential here by design — `queryColumns` synthesises `IField`s for record columns,
`filterShapeFor` reads field metadata, the record schema builds from filter claims — so
domain folders would import each other in both directions on day one. Keep the layers.

**Full hexagonal / DDD on the server** (use-case objects, ports and adapters, a DI container). One
transport, one database, no second consumer. Every seam it would add is available later at the same
cost, and `CLAUDE.md` §1's YAGNI rule rules it out today. P9(a) is the one piece of it worth keeping
on the table.

**Splitting `BaseSelect.vue` or the records page further.** Both rejections in `decisions.md` were
re-examined and both hold: the panel's Escape handling, `aria-activedescendant` IDREFs, teleport and
sole focusable are coupled to the parent's keyboard dispatchers, and the records page's four body
states are one decision that scattering would hide. P7's directory move and its `useSelectSelection`
sub-note are the parts that do pay, and neither is the split those entries rejected.

---

## Sequencing

```
P3 ─┬─ P5
    ├─ P6
    └─ P8 (defer)

P4  — gated on a new field type
P7, P9, P10  — independent, any time
P11          — gated on measurement
```

The first pass in flight is **P7 → P3 → P6**. Everything after that is a judgement call, and
P4, P5, P8 and P11 each carry an explicit gate above.
