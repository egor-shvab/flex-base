# Database & query performance plan

Target: stay fast and comfortable at **100k records per table and 1M+ overall**, with priority
order **search > filtering > sorting > writes**.

**T1 is implemented; everything else is not.** The stated priority order is reflected in what lands in Phase 1;
**the authoritative execution order is the Sequencing summary near the end**, which is not the
numbering order — T9–T11 were added during review and sit in Phase 1 despite their numbers.
Task numbers are stable identifiers, not a running order.

Per `CLAUDE.md` §2, each task gets a `**Status:** done — YYYY-MM-DD` line as the **first line of
its own block** when it passes the definition of done; a task with no such line has not been
started. A task is not done until its own tests pass (T9), so T9 is not a stage to reach.

---

## 1. How the numbers here were produced

A throwaway database (`flexbase_scale_bench`, since dropped) on the project's own
`postgres:17-alpine` container — 128 MB `shared_buffers`, 4 MB `work_mem`, i.e. modest, so the
figures are conservative rather than flattering. 1,000,000 records across 41 tables, 800k in the
hot one, 9 fields each, ~360 B/record after compression. Warm cache,
`EXPLAIN (ANALYZE, BUFFERS)`, single runs.

**Treat these as orders of magnitude, not benchmarks.** Single runs on a laptop container carry
real variance — the relation-label sort measured 393 ms and 784 ms on two runs of the same query
at 100k. What is reliable is the _shape_: which plan the planner picks, and whether cost grows
with table size or stays flat.

Two caveats to carry forward:

- The synthetic `notes` field compressed unusually well (repeated text), so **no row TOASTed**.
  Real long-text records will TOAST, and every `data ->> key` on a TOASTed row detoasts the whole
  document. That cost is **not** in these numbers and would make the JSONB-side figures worse.
- Where a figure below is marked _projected_, it was reasoned from the measured 100k/1M pairs
  rather than measured directly.

## 2. Measured baseline at 1M records

Current schema and indexes, no changes:

| Query                                    | Time         | Plan chosen                              |
| ---------------------------------------- | ------------ | ---------------------------------------- |
| Default list, page 1                     | **0.15 ms**  | Index scan — already optimal             |
| Filter `stage IN (…)`, default sort      | **0.33 ms**  | Index scan, `LIMIT` exits early          |
| `COUNT(*)` unfiltered                    | **61 ms**    | Parallel seq scan — paid on every load   |
| Sort by a JSONB key, page 1              | **1 156 ms** | Parallel seq scan + top-N                |
| Deep page (offset 100 000), JSONB sort   | **836 ms**   | Seq scan + external merge, 21 MB to disk |
| Deep page (offset 100 000), default sort | **38 ms**    | Index scan, walks 100 050 rows           |
| `COUNT(*)` with a text filter            | **395 ms**   | Parallel seq scan                        |
| **Free-text search** (7-column OR)       | **1 940 ms** | Index scan + per-row filter              |
| **Relation label sort**                  | **2 771 ms** | Seq scan + 800 000 PK lookups            |

The two headline numbers — **search at ~2 s and relation sort at ~2.8 s** — are the ones that
make the app feel broken. Note also that `COUNT(*)` at 61 ms is charged to _every_ list view
including the unfiltered default, which is otherwise a 0.15 ms query.

## 3. Measured effect of the proposed changes, at 1M

| Query                                    | Before     | After                | Change                           |
| ---------------------------------------- | ---------- | -------------------- | -------------------------------- |
| Free-text search                         | 1 940 ms   | **53 ms**            | trigram GIN + search-first shape |
| Free-text search, rare term              | —          | **4 ms**             | same                             |
| Search `COUNT(*)`                        | 395 ms     | **159 ms**           | same                             |
| Sort by JSONB key, page 1                | 1 156 ms   | **0.41 ms**          | expression index (T3)            |
| Number-range filter                      | scan-bound | **2.6 ms**           | expression index (T3)            |
| Number-range `COUNT(*)`                  | scan-bound | **0.23 ms**          | expression index (T3)            |
| `COUNT(*)` unfiltered                    | 61 ms      | **0.56 ms**          | capped count (T4)                |
| Multi-value filter, rare value (at 100k) | 34.7 ms    | **0.11 ms**          | GIN + operator form (T1)         |
| Deep page, JSONB sort                    | 836 ms     | 162 ms → **0.18 ms** | expression index → keyset (T5)   |
| Relation label sort                      | 2 771 ms   | unfixed              | needs T6                         |

## 4. The single most important scheduling fact

**Migrations that are free today are outages at 1M rows.** Measured on the 1M dataset:

- `ALTER TABLE … ADD COLUMN … GENERATED ALWAYS AS (…) STORED` — **~2.5 minutes** holding
  `ACCESS EXCLUSIVE`, which blocks every read and write to `Record`. I observed a second
  `ALTER` queue behind the first for its whole duration.
- `CREATE INDEX` (trigram GIN, non-concurrent) — **~137 s**, also blocking writes.
- `CREATE INDEX` (B-tree expression) — ~2.3 s, 82 MB.

At the current 155 records all of these are milliseconds. **This is the argument for doing the
structural work now rather than "when it hurts": the schema changes are the part that gets
dramatically more expensive with growth, while the _value_ of the indexes only arrives later.**
Do the migrations now; the indexes then cost nothing but disk until they start earning.

---

## Phase 1 — do now

### T1. Correct the multi-value filter, and the documentation that describes it

**Status:** done — 2026-08-31

**What.** Two things, in order:

1. Fix the false claim in `server/db/field-types/fragments.ts`, `docs/decisions.md`
   (_`jsonb_exists_any`, never the `?|` operator_), `docs/architecture.md` §8 and
   `docs/limitations.md`. All four state that `jsonb_exists_any` is GIN-indexable. It is not.
2. Make the comparison actually indexable.

**Why.** Measured at 100k, same data, same GIN index, same predicate:

```
data->'tags' ?| ARRAY['unicorn']                  → Bitmap Index Scan,  0.106 ms
jsonb_exists_any(data->'tags', ARRAY['unicorn'])  → Parallel Seq Scan, 34.700 ms
```

**327×.** Postgres matches _operators_ to index operator classes; it never matches the
equivalent function call. A GIN index cannot serve `jsonb_exists_any` in any form.

The documentation error is the more dangerous half: `limitations.md` banks a GIN index as the
remedy to reach for under load, and that remedy does not work as written.

**Which queries.** Every multi-value SELECT and RELATION filter (`containsAny`).

**Scaling.** Without a fix, every multi-value filter is a full scan forever — ~35 ms at 100k,
~350 ms at 1M _(projected)_. With it, sub-millisecond and flat.

**The spike is done — `?|` survives, and the operator form is confirmed indexable.** Run through
the real Prisma client against `flexbase_test`, 50 000 seeded rows, one
`CREATE INDEX … USING gin ((data->'tags'))`, asserting on the `EXPLAIN` plan:

| Predicate, issued via `$queryRaw`                   | Plan                 | Estimated rows |
| --------------------------------------------------- | -------------------- | -------------- |
| `data->'tags' ?\| ARRAY[$1]::text[]`                | **Bitmap Heap Scan** | 5              |
| `data->'tags' @> $1::jsonb`                         | **Bitmap Heap Scan** | 5              |
| `jsonb_exists_any(data->'tags', ARRAY[$1]::text[])` | **Seq Scan**         | 16 667         |

All three returned identical rows (10 of 50 000), so the swap is semantics-preserving. A literal
`?|` and a bare `?` both passed through `$queryRaw` untouched, including with bound parameters
composed via `Prisma.join` and with a parameter appearing _before_ the operator — the placement
where placeholder rewriting would have shown up. The `?`-mangling hazard in `decisions.md` is
real for other drivers and simply does not apply to `@prisma/adapter-pg`.

**A second finding, not anticipated:** the function form does not merely lose the index, it also
**destroys the planner's row estimate** — 16 667 (a blind 1-in-3 guess) against the operator
form's 5, actual 10. Postgres has no selectivity statistics for an opaque function call. A row
estimate that wrong propagates into join and sort choices elsewhere in the same query, so the
cost is not confined to the one predicate.

**Decision: use `?|`.** The `@>` fallback is no longer needed, though it remains equally
indexable if a future driver change ever makes `?` unsafe again — worth one line in
`decisions.md` so the alternative is not re-derived.

**Note the index expression.** A GIN on `data` does **not** serve this — it must be on the
sub-path, `USING gin ((data->'tags'))`, which makes it a per-field index and therefore part of
T3's lifecycle, not a single global index.

---

### T2. Free-text search: a generated column with a trigram GIN, and a search-first query shape

**What.** Three parts:

1. An `IMMUTABLE` SQL function flattening every string value (and array element) of `data` into
   one text blob — deliberately values only, never keys or JSON punctuation, so a search for
   `","` or `[` cannot match.
2. A trigram GIN **on that expression, with no stored column** (requires the `pg_trgm` extension):

   ```sql
   CREATE INDEX … ON "Record" USING gin ((record_search_text(data)) gin_trgm_ops)
   ```

   **Decided in review — the expression form, not the `GENERATED … STORED` column originally
   planned.** Three reasons, and the first is decisive: **Prisma cannot declare a generated column
   in `schema.prisma`**, so a stored column would live outside the schema and put
   `prisma migrate` into permanent drift. It also avoids the full-table rewrite under
   `ACCESS EXCLUSIVE` (~2.5 min at 1M, §4) and avoids duplicating every string value on disk.

   The cost is rigidity: the query must repeat that exact expression for the planner to match it,
   and the function is recomputed per write rather than stored. T3 already demands the same
   discipline — one generator for both the DDL and the query fragment — so this is the same rule
   applied twice rather than a new one.

3. **A change to the query shape in `buildRecordWhere` / `listRecords`** — see below.

**Why.** Measured: 1 940 ms → **53 ms**, and 4 ms for a rare term.

**Part 3 is not optional, and it is the non-obvious half.** Adding the index alone gave only
1 940 → 625 ms, because the planner faced a choice it cannot win: use the index that satisfies
`ORDER BY "createdAt"` and then filter (it scanned 41 275 rows to find 50), or use the GIN and
then sort. It picked the former. Forcing the search to resolve first via a
`WITH hits AS MATERIALIZED (…)` CTE and sorting the result gave **53 ms**.

> **Contract:** a search query must resolve its GIN predicate _before_ ordering. An `ORDER BY`
> on a different column will otherwise out-compete the search index in the planner, and the
> symptom is a query that is merely slow rather than obviously wrong.

**Which queries.** `buildRecordSearch`, and both legs of `listRecords` (page + count). Replaces
the current 7-arm `ILIKE` OR group entirely.

**Scaling.** The current search is `O(rows × searchable fields)` and unindexable. Trigram GIN is
roughly `O(matches)`. At 100k, ~200 ms → ~5 ms _(projected from the 1M pair)_; at 1M, measured
1 940 → 53 ms.

**Trade-offs.**

- **Index size — not measured at 1M, do not assume.** At 100k a trigram GIN over a _single_
  field was 38 MB against an 87 MB heap. The full-document index proposed here covers every
  string value, so it will be substantially larger, and the 1M build did not complete in time to
  size it. **Measure it on real data before committing disk.** The expression form at least keeps
  this to the index alone — a stored column would have duplicated every string value on top.
- **Write cost.** GIN maintenance is the expensive kind. Measured at 100k, writes went from
  ~61 ms to ~205 ms per 5 000 records with five indexes present. This is the deliberate trade
  the stated priority order (writes last) accepts.
- **Migration.** The `ADD COLUMN … GENERATED` is a full-table rewrite under `ACCESS EXCLUSIVE`
  — ~2.5 min at 1M, milliseconds now. **Do it now.** See §4.
- **`SEARCH_MIN_LENGTH`.** Trigram indexes need ≥3 characters to be useful; the current floor is 2. A 2-character term will fall back to a scan. Consider raising the floor to 3 — a
  user-visible change, so it is a product decision, not a silent one.
- **The function must pin its `search_path`.** A function used in a generated column or an index
  expression is evaluated with whatever `search_path` the session carries. Declare it
  `IMMUTABLE STRICT PARALLEL SAFE` **and** `SET search_path = pg_catalog, pg_temp`, with every
  operator and function it calls schema-qualified. Without that, the stored value depends on
  session state — which is both a correctness bug and a known privilege-escalation shape.
- **Backup/restore ordering.** A generated column depending on a user-defined function makes
  `pg_restore` order-sensitive: the function must exist before the table. Worth one check against
  a real dump before this is load-bearing.

**If the stored column is ever reconsidered**, the blocker to clear first is Prisma drift, not the
lock: confirm what `prisma migrate dev` does with a `GENERATED … STORED` column it cannot express
in `schema.prisma`. The stored form's only real advantage is not recomputing the function per
write — a writes-last concern under the stated priority order.

**Rejected alternative: `tsvector` full-text search.** Faster and smaller than trigram, but it is
**word-based, not substring-based**. Today `search=ont` matches "Contact"; under FTS it would
not. That is a behaviour regression for a search box users have already learned. Trigram
preserves current semantics exactly, which is why it is the recommendation. FTS remains worth
revisiting _later_ if relevance ranking is ever wanted — it is the only one of the two that can
rank — but it should be an explicit product decision, not a performance side effect.

---

### T3. Per-field expression indexes for sorting and filtering

**What.** A B-tree expression index per indexed field, shaped
`("tableId", <the field's expr>, "createdAt")` — the third column matching the existing
blanks-last, newest-first tie-break so the index can satisfy the whole `ORDER BY`.

**Why.** Measured at 1M: sort by a JSONB key **1 156 ms → 0.41 ms**; a narrow number-range filter
from scan-bound to **2.6 ms**, and its count to **0.23 ms**.

**Which queries.** `buildRecordOrderBy` under any explicit field sort, and every `withinRange` /
`matchesPartially` / `matchesExactly` filter.

**This is the task with real architectural weight, and the design decision is _lifecycle_, not
SQL.** The index expression is already derivable — `sqlFor(field).expr` / `sortExpr` produce
exactly the expression the index needs, so the registry already owns it. What is new is _when_
indexes get created.

Issuing DDL from `createField` puts lock waits and half-created indexes inside a user-facing
request, and `CREATE INDEX CONCURRENTLY` cannot run inside a transaction — so it cannot share
`updateField`'s transaction either. Three options:

| Option                       | Shape                                                                                                                         | Verdict                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **A. DDL in `createField`**  | synchronous `CREATE INDEX` on field creation                                                                                  | **Rejected** — DDL in a request, and it indexes fields nobody sorts by |
| **B. Background reconciler** | a job compares desired indexes (from `Field` rows) to `pg_indexes` and issues `CREATE INDEX CONCURRENTLY` outside any request | **Recommended**                                                        |
| **C. Explicit user action**  | an "optimise this field" control in table settings                                                                            | Possible later; B makes it unnecessary                                 |

**Recommendation: B, but do not index every field.** Indexing all fields of all tables is what
makes writes collapse and disk explode. Index a field when it is _worth_ indexing. Simplest
defensible policy to start: index a field only when the table exceeds a row threshold **and** the
field has actually been sorted or filtered on. That requires recording field usage — a small
counter, updated out-of-band, not in the request path.

**Scaling.** Each index is ~80 MB per 1M rows (measured, for a text field). Ten indexed fields on
a 1M-row table ≈ 800 MB of index against a 432 MB heap. This is precisely why the policy must be
selective rather than automatic.

**Trade-offs.**

- Every index slows writes and consumes disk — accepted per the stated priority order, but only
  where the index earns it.
- `CONCURRENTLY` can leave an **invalid index** behind if it fails; the reconciler must detect
  `pg_index.indisvalid = false`, drop, and retry. This is the part that most often gets missed.
- A field's index must be dropped when the field is deleted, or it lingers forever slowing writes
  for a column nothing reads. `deleteField` is currently a one-row delete — keep it that way and
  let the reconciler handle removal.
- **Every index over `data` defeats HOT updates.** This is the sharpest edge in the whole plan
  and it is not obvious. Today an `updateRecord` that rewrites `data` can often be a
  heap-only-tuple update — no index maintenance, cheap vacuum. The moment _any_ index covers an
  expression over `data`, every update to that row must write to every such index. So T3's cost
  is not "writes get a bit slower per index"; it is a **change in the kind of update the table
  does**, which compounds into table bloat and autovacuum load (see T11). It is still the right
  trade under the stated priority order — but it is the reason the index set must stay small,
  not merely a reason to prefer fewer indexes.

**Two implementation hazards to settle before writing the reconciler:**

- **Index names must be ≤63 bytes, and Postgres truncates silently.** Field _names_ allow 100
  characters (`shared/validation/name.ts`), and `slugify` maps them roughly 1:1 into keys, so
  `rec_idx_<tableId>_<fieldKey>` can reach ~130 characters. Truncation would let two long keys on
  one table collide into the same index name — a failure that looks like "the reconciler keeps
  recreating an index". **Name the index from `Field.id` instead** (`rec_idx_<field.id>`, a cuid,
  33 characters total): globally unique, immutable, and it makes index→field lookup trivial for
  both creation and reaping.
- **The expression must match the query byte-for-byte.** The planner matches an expression index
  structurally. `sqlFor(field).expr` must therefore be the _single_ source for both the index DDL
  and the query fragment, or the index is built and silently never used — the exact failure this
  plan was written to catch. This is a strong argument for generating both from one function
  rather than writing the DDL by hand.

**A bonus worth knowing.** An expression index also gives Postgres **statistics on that
expression**. Today `data->>'key'` has no statistics at all, so the planner guesses — the same
blindness that gave `jsonb_exists_any` a 16 667-row estimate against an actual 10 (T1). So T3
improves plan _quality_ for the indexed field, not only access path, and that benefit reaches
queries that combine the field with others.

**Related, and currently unaddressed elsewhere in this plan:** `listRelationOptions`
(`server/services/relations.ts`) runs an unanchored `ILIKE` over the target table's label field
via `buildRecordLabelSearch`. It is bounded by `RELATION_OPTIONS_LIMIT` and one expression, so it
is far cheaper than the record search — but it is the same unindexed shape and will degrade on a
large target table. A trigram index on the label field is the same remedy; fold it into the
reconciler's rules rather than treating it as a separate mechanism.

---

### T4. Cap the count instead of computing it exactly

**What.** Replace `SELECT COUNT(*)` with a count over a bounded subquery:

```sql
SELECT COUNT(*)::int FROM (SELECT 1 FROM "Record" WHERE … LIMIT 1001) c
```

and have the UI render `1000+` when the cap is hit.

**Why.** Measured at 1M: unfiltered count **61 ms → 0.56 ms**. That 61 ms is charged to every
list view, including the default unfiltered one whose page query is 0.15 ms — the count is
currently ~99% of the cost of loading a table.

**Which queries.** The second leg of `listRecords`; surfaces in `BasePagination`'s `1–50 of N`
label, `pageCount`, and `RecordsFilterPanel` / `RecordsFilterSummary`'s "N matching records".

**Scaling.** Exact `COUNT(*)` is inherently `O(rows)` and cannot be indexed away. Capped count is
`O(cap)` — flat at any table size. This is the only count strategy that does not degrade.

**Trade-offs.** This is a **user-visible change**: past the cap, the UI shows `1000+` rather than
a number, and `pageCount` becomes unknown. The existing pager is Prev/Next only (no page-number
jumping), so "Page X of Y" is the one label that suffers — it becomes "Page X" with Next enabled
while a full page came back. Choose the cap deliberately; 1 000 is a starting point, not a rule.

`Table.recordCounter` is **not** a substitute — it is a high-water mark that never decrements, so
it is not a row count and must not be displayed as one.

**T2 and T4 compose, and that is where the search figure really lands.** §3 lists the search
count at 159 ms because that was measured as an _exact_ count over the trigram index. Under T4 the
same count stops at the cap, so it becomes a bounded index scan — the 159 ms is an upper bound
that T4 removes, not a residual cost. Sequence T2 before T4 and re-measure rather than assuming
either figure.

**Consider `COUNT(*) OVER ()` before adding a second query.** `listRecords` currently issues the
page and the count as two statements sharing one `WHERE` fragment. Once T2 introduces a
materialised CTE, both legs can read from it, and a window count over the already-materialised
hits avoids evaluating the predicate twice. Worth measuring against the two-statement form — it
is not automatically faster, and the current shape has the virtue that the two cannot disagree.

**This breaks tests that assert on visible labels.** The e2e suite selects by accessible name and
`docs/architecture.md` §11 pins the pager and the records empty state (both `role="status"`).
`1–50 of 1234` and "N matching records" are exactly the strings T4 changes. Those updates are part
of T4, not follow-up work — see T9.

---

### T9. Tests

Not optional and not a follow-up: `CLAUDE.md` §10 binds changes to `server/db/`,
`server/services/` and `shared/` to ship with tests, and every task above touches at least one.
Which project each lands in is decided by what it needs (§10's table), not by what it is.

| Change            | Project        | What it pins                                                                            |
| ----------------- | -------------- | --------------------------------------------------------------------------------------- |
| T1 `?\|` fragment | `unit`         | `record-sql.spec.ts` — the emitted `.text`/`.values`, asserted without a connection     |
| T1 semantics      | `integration`  | the operator returns what the function form returned — the swap is behaviour-preserving |
| T2 search CTE     | `unit`         | the materialised-CTE shape and its parenthesisation                                     |
| T2 search results | `integration`  | the same terms match the same rows as the `ILIKE` OR group it replaces                  |
| T3 index DDL      | `unit`         | the DDL expression is byte-identical to the query fragment, from the one generator      |
| T3 reconciler     | `integration`  | creates, reaps on field delete, and recovers from an invalid index                      |
| T4 capped count   | `unit`         | the bounded-subquery shape; `integration` for the cap actually capping                  |
| T4 labels         | `nuxt` + `e2e` | `BasePagination` / filter-summary copy, and the `role="status"` assertions in §11       |

**One new category, and it is the most valuable test in this plan: assert on the query plan.**

Every failure this plan exists to prevent is invisible to all four existing layers. An index that
is present but unused returns _correct_ results, passes every unit, integration and e2e test, and
only shows up as latency under data volume the test suite never has. That is precisely how the
`jsonb_exists_any` claim survived in the documentation for so long.

The spike proved the technique works through the real client: seed enough rows for the planner to
have a reason, `ANALYZE`, then run `EXPLAIN` via `$queryRaw` and assert on the plan text.

- **Assert structurally, never on timings** — that the index name appears, and that `Seq Scan`
  does not. Timings are non-deterministic and `CLAUDE.md` §10 forbids depending on them.
- These belong to `integration`: they need a real planner and real statistics.
- **Seed inside the case, never in `beforeAll`.** `test/integration/setup.ts` truncates in
  `beforeEach`, so a `beforeAll` seed is gone before the first assertion — and an `EXPLAIN`
  assertion against an empty table can still pass while proving nothing. This cost the spike one
  wasted run; it will cost the next person the same unless it is written down.
- Keep the set small — one per indexed access path, not one per field type.

---

### T10. Know whether the indexes are actually working

Without this, T3's selective-index policy is unmeasurable and the whole plan is unfalsifiable in
production. Two cheap reads, no new infrastructure:

- **`pg_stat_user_indexes.idx_scan`** — an index with a scan count stuck at zero is dead weight:
  it is slowing every write and returning nothing. This is the direct feedback loop for "which
  fields deserve an index", and it turns T3's policy from a guess into a measurement.
- **`pg_stat_statements`** (an extension; needs `shared_preload_libraries`) — the actual slow
  queries in production, rather than the ones this plan predicted. Enable it before release; it
  cannot answer questions about a period when it was not running.

The reconciler should also surface **invalid indexes** (`pg_index.indisvalid = false`), since a
failed `CONCURRENTLY` build is otherwise silent and leaves an index that costs writes while
serving no reads.

**Scope discipline:** this is a diagnostic surface, not a feature. Two SQL views and a way to
read them. Building a dashboard for it would be exactly the speculative work `CLAUDE.md` §1 rules
out.

---

### T11. Table maintenance under a heavier index set

T3 changes how this table ages, and that consequence needs owning rather than discovering.

**The mechanism.** Once expression indexes cover `data`, an `updateRecord` can no longer be a
heap-only-tuple update (see T3): every update writes to every such index and leaves a dead tuple
behind. More dead tuples plus more indexes means more autovacuum work, and autovacuum's default
thresholds are tuned for tables far smaller than a million rows — at 1M, the default 20% scale
factor means vacuum waits for ~200 000 dead tuples before acting.

**What to do, in order of confidence:**

- Lower `autovacuum_vacuum_scale_factor` for `Record` specifically (a per-table storage
  parameter, not a global change) once the table is large. A fixed threshold behaves better than
  a percentage at this size.
- Raise `maintenance_work_mem` for the session that builds indexes — it materially changes build
  time, and the measured ~137 s trigram build was on the container default.
- **Be sceptical of `fillfactor`.** Lowering it preserves HOT updates, but T3's expression
  indexes defeat HOT regardless, so the usual benefit largely does not apply here. Do not cargo-
  cult it — measure before setting it.

**Deliberately not decided here:** connection pooling. It matters at scale but is a deployment
concern rather than a query one, and the project has no deployment target yet
(`docs/limitations.md` already parks the error-log sink on the same reasoning).

---

## Phase 2 — deferred, with stated triggers

### T5. Keyset pagination

**What.** Replace `OFFSET` with a `WHERE (sort_expr, "createdAt") > (:last_sort, :last_created)`
cursor.

**Why.** Measured at 1M, page 2000: `OFFSET` **162 ms** even _with_ the expression index, because
the index scan still walks all 100 050 preceding rows. Keyset: **0.178 ms**, and flat at any
depth.

**Why it is cheaper than it looks.** `BasePagination` is already **Prev/Next only** — there is no
page-number jumping to lose. The UI is keyset-shaped today.

**Why it is still deferred.** `page` is in `RESERVED_QUERY_PARAMS`, and per `CLAUDE.md` §6 URL
query params are a **closed vocabulary** because a shared link outlives any refactor. Moving to a
cursor changes what a shared URL means. That is a product decision about link stability, not a
performance one.

**Trigger.** When deep paging is observed in practice, or together with any other change to the
records URL contract. Note T3's expression index already takes page 2000 from 836 ms to 162 ms,
which buys a lot of time.

---

### T6. The relation label sort

**What.** Currently `targetLabel` is a correlated subquery per row: measured **2 771 ms** at 1M
(seq scan + 800 000 PK lookups). Rewriting it as a `LEFT JOIN` measured 393 → 232 ms at 100k —
better, but still hash-joining the whole target table, and not a fix.

The real fix is to **stop computing the label at query time**: maintain the target's label
alongside the stored id, so the sort reads a local column. That means a denormalised value kept
current when the target record's label field changes — a trigger, or a write-path update in
`RecordService`.

**Why deferred.** It is the only item here that introduces **derived data that can go stale**,
and staleness in a label is user-visible. It needs a real design: what updates it, what happens
when the label field itself is changed (`labelFieldKey` is editable), and what happens to the
existing "dangling id reads as Unknown record" behaviour. That design is not a performance patch.

**Trigger.** Before any table with a relation column and >100k rows becomes sortable by it in
practice. This is the **worst-scaling query in the system** — it should be added to
`docs/limitations.md` now (T8) even though the fix is deferred, because right now it is only
implied there.

---

### T7. Explicitly rejected

**Per-table physical columns.** Measured 67× faster on filtered page-1 reads at 100k, and it is
still the wrong shape: it gave **no improvement on the count** (23 ms vs JSONB's 20 ms), 2 000
empty tables cost 47 MB on disk + 20 MB catalog before a single row, and it turns every
`createField` / `deleteField` into `ALTER TABLE` inside a user request. It also deletes the
property the whole registry architecture exists to provide (`CLAUDE.md` §1).

**EAV.** Measured strictly worse on every axis at 100k: 7.7× slower on a 3-filter query
(173 ms vs 22 ms), 8× slower on writes, 3× the storage, and _slower_ than JSONB even at fetching
one record (9 index lookups vs 1 heap fetch).

**Partitioning `Record` by `tableId`.** Tenant tables are created at runtime, so this needs
dynamic partition DDL — reintroducing exactly the catalog-scale and DDL-in-request problems that
rule out physical columns. Revisit only if a single table's row count, rather than the total,
becomes the bottleneck.

---

## T8. Documentation

A separate task, run **after** the implementation tasks land, so it documents what was built
rather than what was planned. Governed by `CLAUDE.md` §12 — one home per fact, no inventories, no
changelog, no drifting numbers.

| Document               | Change                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/decisions.md`    | **Rewrite** _`jsonb_exists_any`, never the `?\|` operator_ — the "only GIN-indexable comparison" claim is false and must not survive as a corrected-beside-the-original note (§12: rewrite, never append). Record what T1 settled and why. Add: why search resolves before ordering; why the count is capped; why per-field indexes are reconciled out-of-band. |
| `docs/architecture.md` | §8: the search-first CTE shape, the `record_search_text` expression index, the capped count. §9: the indexing strategy and which indexes exist by rule. **T1's share is done** — the `containsAny` bullet now states the operator form.                                                                                                                         |
| `docs/limitations.md`  | **Remove** _Sorting/filtering by a JSONB key is unindexed_ — its remedies become the shipped design. **Add** the relation label sort (T6) with its measured cost and trigger. **Add** the capped count as an accepted limitation. Re-file the multi-value GIN claim.                                                                                            |
| `CLAUDE.md` §5         | Add the index-lifecycle rule: DDL never runs inside a user-facing request; `CONCURRENTLY` never inside a transaction; a failed concurrent build leaves an invalid index that must be reaped.                                                                                                                                                                    |
| `CLAUDE.md` §9         | A new field type must now also state whether and how it is indexable — the fourth thing a type declares.                                                                                                                                                                                                                                                        |
| `CLAUDE.md` §10        | The plan-assertion test category: what it is for (an unused index is invisible to every other layer), that it asserts structurally and never on timings, that it belongs to `integration`, and that its seed must live inside the case because `setup.ts` truncates in `beforeEach`.                                                                            |
| `README.md`            | If `pg_stat_statements` needs `shared_preload_libraries`, the local `docker-compose.yml` and the setup steps change — that is a developer-facing fact and belongs where the commands are.                                                                                                                                                                       |

**Constraints that must be written down or they will be "cleaned up":**

- A search query must resolve its GIN predicate **before** ordering, or the planner picks the
  ordering index and the search index goes unused. Failure mode: slow, not wrong.
- `jsonb_exists_any` is **not** GIN-indexable; only the operator form is. It also destroys the
  planner's row estimate, so the cost is not confined to the one predicate.
- A GIN for a multi-value filter must be on the **sub-path** (`(data->'tags')`), not on `data`.
- The `record_search_text` function must stay `IMMUTABLE` **and pin its `search_path`**, or the
  generated column is both unbuildable and unsafe.
- An index expression must be byte-identical to the query fragment, so both come from one
  generator. A mismatch builds an index that is silently never used.
- Index names come from `Field.id`, not from the field key — 63-byte identifiers truncate
  silently and long keys would collide.
- Index DDL never runs inside a request or a transaction.
- Any index over `data` defeats HOT updates for the whole table — the reason the index set stays
  small, and the input to the autovacuum settings.
- `Table.recordCounter` is a high-water mark, not a row count.

---

## Sequencing summary

Execution order, which is not the numbering order — T9/T10/T11 were added in review:

| Order | Task                                     | Priority served    | Do now?                                              |
| ----- | ---------------------------------------- | ------------------ | ---------------------------------------------------- |
| 1     | T1 Multi-value filter + doc correction   | filtering          | **Yes** — cheap, and the docs are actively wrong     |
| 2     | T2 Trigram search column + search-first  | **search**         | **Yes** — migration is free now, costly later        |
| 3     | T4 Capped count                          | all list views     | **Yes** — after T2, so the two are measured together |
| 4     | T3 Expression indexes + reconciler       | filtering, sorting | **Yes** for the mechanism; selective on which fields |
| 5     | T10 Index-usage visibility               | —                  | **Yes** — T3's policy is unmeasurable without it     |
| 6     | T11 Maintenance settings                 | writes             | Settings now; tune when the table is large           |
| —     | T9 Tests                                 | —                  | **Inside each task above**, never after              |
| —     | T5 Keyset pagination                     | sorting at depth   | Deferred — URL contract decision                     |
| —     | T6 Relation label denormalisation        | sorting            | Deferred — needs a staleness design                  |
| —     | T7 Physical columns / EAV / partitioning | —                  | Rejected, with measurements                          |
| last  | T8 Documentation                         | —                  | After the implementation tasks land                  |

Two ordering notes: **T4 before T3**, because the capped count is a small change that removes the
largest fixed cost from every list view, and doing it before the index work keeps the two sets of
measurements separable. **T9 is not a step** — a task is not done until its own tests pass
(`CLAUDE.md` §2, step 4).

## Decisions needed before implementation starts

1. ~~**Does `?|` survive Prisma's `adapter-pg`?**~~ **Settled — yes.** Spike run against
   `flexbase_test` with 50 000 rows; `?|` passes through `$queryRaw` intact and is served by a
   GIN index, `jsonb_exists_any` provably is not. T1 uses the operator form. See T1 for the plans.
2. ~~**Is `1000+` acceptable in the pager and filter summary?**~~ **Settled — yes, cap at 1000.**
   Pager reads `1–50 of 1000+`, filter summary `1000+ matching records`. Existing e2e assertions
   use 60-record fixtures, so they are unaffected.
3. ~~**Raise `SEARCH_MIN_LENGTH` from 2 to 3?**~~ **Settled — yes, raise to 3 with T2**, so every
   search uses the index rather than falling back to a scan.
4. **What policy decides that a field gets an index?** T3's selectivity rule — the difference
   between a healthy index set and 800 MB of indexes on a 432 MB table. T10 is what turns this
   from a standing guess into something the data answers, so it can start deliberately crude.
5. **Enable `pg_stat_statements`?** It needs `shared_preload_libraries` and therefore a
   `docker-compose.yml` change and a restart. Cheap now, and it cannot answer questions about any
   period before it was switched on — which is the whole reason to decide it before release.

## What this plan does not cover

Stated so the gaps are chosen rather than overlooked:

- **Concurrency and lock behaviour under load.** Everything here was measured single-user. The
  record-counter transaction in `createRecord` takes a row lock on `Table`, which serialises
  concurrent creates within one table by design — fine for correctness, unmeasured for
  throughput. Writes are the lowest stated priority, so this is a knowing deferral.
- **TOAST.** Flagged in §1 and never measured, because the synthetic data compressed too well.
  Real records with long text will behave worse than every JSONB figure here.
- **Aggregation and reporting.** `SUM`/`AVG` over a JSONB field is the workload where this
  storage model is weakest and no index helps. Nothing in the product does it today; if reporting
  is ever a feature, it deserves its own analysis rather than an extrapolation from this one.
- **Anything above the database.** HTTP caching, SSR payload size, and the client-side store are
  untouched here, and at some point one of them becomes the limit instead.
