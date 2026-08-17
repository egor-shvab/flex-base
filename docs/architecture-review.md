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
obtained from a handler factory rather than remembered, and the client/server contract is now declared in `shared/types/api.ts` and annotated on every handler. **One theme remains:**

**The extension axis is scattered.** A field type is the one thing this platform is designed to be
extended by, and defining one means editing thirteen places across three roots (P4).

The last theme — a client-side cache said to duplicate a framework the app already runs — did not
survive inspection. Half of it was real and is closed: a server-derived count maintained by
client-side arithmetic. The other half was the records store, and counting what that store actually
holds rejected it; see **Considered and recommended against**.

Everything left is gated behind a stated trigger — labelled as such.

**Ranked by value ÷ risk:** P4, P8, P11 — all three gated. (P1, P2, P3, P6, P7, P9 and P10 have landed; P5 was rejected.)

---

## P4 — A field type is a module, not thirteen registry entries

**Problem.** The field type is _the_ extension axis of a low-code platform, and defining one is
currently spread across three roots and thirteen declaration sites. `CLAUDE.md` §9 lists them, which
is itself the tell — the checklist exists because the structure does not carry the answer:

| Where                         | What                                                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`        | the enum member                                                                                                                                                                             |
| `shared/constants/field.ts`   | `FIELD_TYPES`, `FIELD_TYPE_LABELS`, `MULTI_VALUE_BY_TYPE`                                                                                                                                   |
| `shared/constants/filter.ts`  | `FILTER_VALUE_BY_TYPE`                                                                                                                                                                      |
| `shared/validation/field.ts`  | the `superRefine` branch for its options                                                                                                                                                    |
| `shared/validation/record.ts` | `VALUE_SCHEMA_BY_TYPE`                                                                                                                                                                      |
| `server/db/record-sql.ts`     | `FIELD_SQL_BY_TYPE`, `MULTI_SQL`                                                                                                                                                            |
| `app/field-types/`            | `FIELD_INPUTS` + `MULTI_INPUTS`, `FIELD_FILTERS` + `MULTI_FILTERS`, `FIELD_CELLS`, `FILTER_SUMMARIES` + `MULTI_SUMMARIES`, `FIELD_TYPE_ICONS`, `FIELD_CONFIG_SUMMARIES`, one cell component |

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
to re-exports or disappear; `server/db/record-sql.ts` keeps only the builders. Consumers:
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

**Depends on.** P4 (P5 was rejected). Revisit **only** once it has landed, or when a fourth domain appears. P7 has already taken the cheap half of it — a component's private modules now sit with the component.

---

## P11 — The JSONB ceiling: pick the index strategy before it is urgent

**Problem.** Every filter and sort on a user-defined field is an unindexed expression over
`Record.data`. `decisions.md` names this the first scaling ceiling and accepts three consequences on
top of it (unindexable free-text search paid twice, a per-row PK lookup for a relation-label sort,
a scan per relation-option search). The architectural question is not "is it slow yet" — it is
**whether the current query layer can accommodate the fix**, because if it cannot, the fix arrives
as a rewrite under load.

**The good news, stated so it is not re-derived later:** it can. Because `db/record-sql.ts` composes
SQL per field from metadata rather than emitting one fixed query, every remedy below plugs into the
existing per-type rules:

- a **GIN index** on `data` helps exactly one comparison — `jsonb_exists_any`, the multi-value
  filter, which `db/record-sql.ts` already notes is the one GIN-indexable operator in the layer;
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

**Retiring the records store for `useAsyncData`** (this was P5). The premise — that the store
duplicates a framework the app already runs — is about a third true. Its spec pins 25 behaviours, of
which roughly seven are that cache; the rest are paging arithmetic and write orchestration
`useAsyncData` has no opinion about, and they would relocate to a composable reading `total` and
`page` out of `data.value` rather than disappear. `useAsyncData` additionally discards `data` on
error, so keeping the rows under a failure banner would need a shadow ref — the state the change
existed to delete. Recorded in `decisions.md`, including the one seam that _would_ have worked.

**Splitting `BaseSelect.vue` or the records page further.** Both rejections in `decisions.md` were
re-examined and both hold: the panel's Escape handling, `aria-activedescendant` IDREFs, teleport and
sole focusable are coupled to the parent's keyboard dispatchers, and the records page's four body
states are one decision that scattering would hide. P7's directory move and its `useSelectSelection`
sub-note are the parts that do pay, and neither is the split those entries rejected.

---

## Sequencing

```
P4   — gated on a new field type
P8   — gated on P4, or on a fourth domain
P11  — gated on measurement
```

**Nothing here is unblocked.** Every remaining entry carries an explicit gate above, so this register
is now something to read when a gate opens rather than a queue to work through.
