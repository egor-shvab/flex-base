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
URL as the single source of truth for list and dialog state, a layered `shared/` with a
declared import direction, and four test projects split by what a spec _needs_ rather than what it
_is_. Those are the right calls and none of the proposals below disturbs them.

So the honest answer to "what would we decide differently from the beginning" is narrow, and it is
mostly about **where things live rather than how they work**. Every theme it found is now closed:
three server layers present but only two named; ownership remembered rather than obtained; a
client/server contract inferred rather than declared; and the extension axis scattered across
thirteen declaration sites, which P4 collapsed into a module per type per slice.

One candidate theme — a client-side cache said to duplicate a framework the app already runs — did
not survive inspection. Half of it was real and is closed: a server-derived count maintained by
client-side arithmetic. The other half was the records store, and counting what that store actually
holds rejected it; see **Considered and recommended against**.

What is left is gated behind a stated trigger — labelled as such.

**Two entries remain, and neither is ranked ahead of doing nothing:** P8 (whose own entry argues
against taking it) and P11 (gated on a measurement). P1–P4, P6, P7, P9 and P10 have landed; P5 was
rejected.

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

**Depends on.** P4, which has landed — so the gate is open and the recommendation above is now the only thing holding it. Revisit at a fourth domain. P7 has already taken the cheap half of it — a component's private modules now sit with the component.

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
P8   — gate open (P4 landed); recommended against until a fourth domain
P11  — gated on measurement
```

Two entries left, one of them arguing against itself. This register is something to read when a
gate opens rather than a queue to work through — and it is close enough to empty to delete once
P11 is answered either way.
