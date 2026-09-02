# Accepted limitations

What this project knowingly does not do, and why each entry is a decision rather than a bug. Rules live in `CLAUDE.md`, contracts in `architecture.md`, and the reasoning these sit on in `decisions.md`.

**Open** entries are in scope for the current phase; **Accepted** entries are not, unless a request says otherwise (`CLAUDE.md` §1). Each carries the trigger that would reopen it, so the decision is not re-taken by accident. A limitation that has been fixed leaves this file — the constraint that outlives it, if any, moves into the `decisions.md` entry that governs it.

---

## Open

### Row actions are three inline icons, where the concept draws one `⋯` menu

The concept's menu holds full sentences. The stated blocker is gone — `usePopover` + `useAnchoredPosition` anchor correctly inside a scrolling, clipping container. What is left is that three targets in a pinned column still fit, so the menu would be work without a user-visible gain. The third button does add one more site where the focus halo crosses a `gap: rem(4)` neighbour — the bargain that row already struck. _Revisit when a fourth row action appears._

## Accepted

### A table's URL carries no slug, only its number

`/tables/12`, never `/tables/12-deals`. A slug reads better and would be free to resolve — `parseTableAddress` already ignores a `-…` suffix, so adding one later costs a single function — but it would put a **user-authored table name into the pathname**, and `error-log.ts` records pathnames under a redaction contract that is deliberately structural: it never reaches for user data, so it cannot forget to. Shipping the slug means adding a normalisation step at both ends and maintaining it forever, and the payoff is cosmetic here — one user per workspace, no sharing, and the table's name is already the page heading.

_Reopen if a URL ever becomes visible outside the app: a sharing feature, a public link, or anything that puts a path in front of someone who is not its owner._

### A public number is database-local

A cuid survives a move between environments; `Table.number` and `Record.number` collide, because each database allocates its own from 1. Nothing exports or imports data today, so nothing is broken — but a number is not an identifier to carry across databases.

_Reopen if import/export, seeding between environments, or any multi-database feature ships._

### A URL discloses roughly how much a user has

`/tables/12` says the account has at least twelve tables, and `#4821` says the table has had that many records. Both were previously unguessable behind cuids. The counts are already visible to the owner throughout the UI, so what changed is that a shared screenshot or link discloses them too.

_Reopen if a table or record is ever shared with someone who should not see the owner's volume._

### Four lines of `architecture.md` §11 are approximated, not proven

Playwright covers the rest. What it cannot reach: a **hydration-mismatch warning**, which a production build silences (the specs assert the SSR HTML is correct and the console clean instead); a **clipped focus ring**, asserted structurally as the focused link's box sitting inside its cell's; **Backspace held down**, which no Playwright API reproduces — pressed repeatedly instead; and **a multi-value cell's ellipsis**, which is paint with no DOM consequence. Running against a dev build recovers the first at the cost of testing something other than what ships.

### Nitro's own routing is exercised by no test

The integration suite imports each handler and invokes it with a constructed `H3Event`, so `requireUser` → ownership → zod → service all run against a real database, but the path-to-handler mapping, the method suffix convention and route-param extraction are taken on trust. Covering them meant booting the whole app per run, which costs a Nuxt build for a layer that is generated rather than written — and which Playwright drives from the outside anyway. _Revisit only if a routing bug reaches production._

### A field named entirely in non-ASCII gets the key `field`

`slugify` keeps `^[a-z0-9_]+$` and nothing else, so "Компания", "会社" and "🎯" all reduce to nothing and take the `field` fallback. The charset is not incidental: the camelCase record columns cannot be shadowed by a user key _because_ this cannot emit one, and the raw-SQL note rests on the same sentence. Unicode keys would be SQL-safe (keys are always bound as parameters) but would put percent-encoded names in every filter URL and retire both arguments. The key is machine-facing — the field's **name** is untouched. _Revisit only if non-ASCII names become the common case._

### 36px targets are below the Apple HIG / Material touch figure on touch devices

A flat 36 was chosen over a `@media (pointer: coarse)` override restoring 44: a second geometry mode means every derived height has to hold at two values, and the app's touch use is secondary. Clears SC 2.5.8 (24×24) with 50% margin; it is SC 2.5.5 **AAA** that is given up. _Revisit if touch becomes a primary surface._

### A select no longer opens the OS-native picker on touch

A searchable one also raises the soft keyboard where a `<button>` did not. The price of a listbox that can render a choice's colour, search, and load asynchronously — none of which a `<select>` can do. Every option row is `--control-height`, so SC 2.5.8 is clear either way; the keyboard half is bounded by `shouldSearch()`, which keeps short pickers on the button branch. _Revisit if touch becomes a primary surface._

### In `multiple`, the closed control shows a count, not which values are chosen

Chips would make the control's height content-dependent, which `useAnchoredPosition` does not observe. In a filter the information is restated in `RecordsFilterSummary` above the table; in the **record form** it is not, which is the one place multi-value reads as less than single-value did. A chip row _below_ the control, leaving its height fixed, is the cheap fix if it is ever wanted. _The form case is the one worth revisiting._

### A multi-value filter can only mean _any of_, never _all of_

There are no operators anywhere in this project, so a filter's value is its whole contract and "has any" is the only question its shape can ask. Expressing "has all" needs an operator in the URL, in every control and in the SQL map — reopening a load-bearing decision to serve one comparison. Users do want it; the answer is a design change, not a patch. _Revisit only alongside operators as a whole._

### A multi-value cell shows one line in the table

Values past the width cap are cut off. A row has a fixed height, so wrapping would clip the second line rather than reveal it, and a `+2` affordance still needs a measurement the cell has no reason to take. The values that fit are drawn in full and the rest give way to an ellipsis, exactly as a long TEXT value always has.

### A legacy field keyed like a reserved param cannot be filtered

Nothing on screen says why. Only `page`, `pageSize`, `sort`, `dir`, `search` and `detail` are affected, and `createField` has refused those keys since the filter param format landed — so no field the app can create is in this state, only older data. Both alternatives cost more: a migration renaming user field keys rewrites the JSONB key of every record and every link already shared; an explanation in the drawer is UI built for a state that should not exist. The field still renders and still sorts.

### Deleting a target record leaves a dangling id

It reads as "Unknown record". Blocking it would mean a JSONB scan of every table on every delete. Deleting a target **table** is refused with a 409 instead. _Revisit only with a real referential design._

### Renaming a SELECT choice orphans the records holding the old text

Those records then render as a neutral badge. A choice's identity is its own text, so the whole SQL layer stays out of it. The stale value keeps its text rather than blanking, and nothing errors. An option id buys nothing for colour.

### A field nobody opts in is unindexed

Keys are user-defined per table, so no general index applies; a field carries one only once someone ticks it (`architecture.md` §9). Until then, sorting or filtering by it scans — around 100–270 ms over 800k rows, depending on the comparison. That is the shape of the ceiling, and opting in is the answer to it.

Two things stay unindexed whatever a field opts into. **Relation option search** scans its target table — over one table, on one expression, under a hard `LIMIT`, so it is bounded. And a **relation's ordering** has no index that could serve it, because the value it sorts by is in another row; the join it uses instead closes most of that gap (`decisions.md`).

### Deep paging walks every row it skips

`OFFSET` is the cost, so page 2000 reads the 100 000 rows before it — about 17 ms at 1M, and **an index does not help**, because the sort is not what is slow. Keyset pagination would make it flat, but `page` is in `RESERVED_QUERY_PARAMS`: the records URL is a closed vocabulary precisely because a shared link outlives any refactor, so this is a decision about link stability rather than about speed. _Revisit only alongside another change to the records URL._

### `pg_stat_statements` is not enabled, and that is time-sensitive

`fieldIndexStats()` answers "is this index used", but nothing answers "which queries are actually slow here" — that needs the extension, which needs `shared_preload_libraries` and therefore a `docker-compose.yml` change and a database restart. It is left off because the project has no deployment target, and turning it on for a development container proves little. **The cost of deferring is asymmetric:** it cannot report on any period before it was switched on, so a slow first week is unrecoverable. _Turn it on as part of the first real deployment, not after the first complaint._

### An index that fails to build says so only in the error log

Index DDL is fired from the request and not awaited (`decisions.md`), so a failure has no response to land in: the toggle reports success, the index is simply absent, and the sorting or filtering it was for stays slow. Nothing surfaces that in the UI. `reconcileFieldIndexes` fixes it, and the next save of that field would too — but **nothing calls either on a schedule**, which waits on the same deployment story as the error-log sink. _Revisit together with that._

### A RELATION cannot be sorted from an index

It filters from one and no index orders it, because the value it orders by — the target's label — is not in the row being sorted. What closes most of that gap is the **join** the ordering now brings with it (`decisions.md`), which probes the very column the filter index covers: 1 528 ms as a per-row subquery, 384 ms joined, **171 ms** joined with the field opted in. So opting a relation in speeds its ordering as well as its filter, through the filter index rather than a sort one.

What is left is that 171 ms against a 104 ms plain-text sort on the same table — the residue is the cost of ordering 800k rows at all, not of the relation. _Revisit only if that gap starts to matter; a denormalised label is the only thing left that would close it, and it costs derived data that can go stale._

### A record count stops at 1000, and past it the UI says `1000+`

An exact `COUNT(*)` is `O(rows)`, no index shortens it, and it was charged to every list view — including the unfiltered default, whose page query is otherwise trivial. Counting to `RECORD_COUNT_CAP + 1` is flat at any table size, at the price of a total that stops being a number. The pager reads `1–50 of 1000+` and drops "of N pages"; the filter summary reads `1000+ matching records`. Paging past the cap still works, because Next follows whether the page came back full rather than the page count (`decisions.md`). _Revisit if an exact total past the cap is ever actually asked for — the fix is a second, opt-in count, not raising the cap, which would put the cost back on every view._

### A disabled `BaseButton` with `to` renders `<button disabled>`

It announces as _button, dimmed_ rather than _link, dimmed_. Rebuilding it by hand to keep the `<a>` costs three mechanisms where the platform gives one (`decisions.md` → _`BaseButton` renders the element its role implies_).

### A truncated table cell offers no way to read the full value

No `title`, no expand affordance — **except for a relation**, whose dialog shows the target in full. The rendered text is produced by the cell _component_ (a label resolved from a store, `Yes`/`No`, a formatted date), so it is not recoverable from the raw value. Both routes to it buy a **pointer-only** tooltip: a text projection per field type is a fifth registry against the "only cells are components" contract, and reading it back off the DOM means a `scrollWidth` pass over every cell plus a `ResizeObserver`, re-run on every fetch. Against that, the View action is one click away on every row. _Revisit if something else earns the table a measurement pass, which would make the tooltip nearly free._

### The unsorted sort icon is ~1.67:1

That is under the 3:1 SC 1.4.11 floor for non-text UI. `--color-text-secondary` at `opacity: 0.35`. A compliant `0.7` was shipped first and read as clutter — the glyph repeats on every column at once. Nothing depends on seeing it: the header's own text names the column, the button is in the tab order with a visible focus ring, and sort state reaches assistive tech through `aria-sort` on the `th`. It is an affordance hint, not a control boundary — unlike `--color-border-control`, which is why that token carries the floor and this does not. _Raise it only on a real report of users missing the affordance._

### A badge's fill is ~1.1:1 against a hovered row

The pill shape barely reads there. The badge draws no border by design. The dot (its `-fg` step, ≥6:1 on that row) and the word both survive, and neither the fill nor the dot is the meaning. Raising the fills to bound the pill would break their 4.5:1 text pairings.

### The error log is a local file, and the rate limit in front of it is per process

Both halves now report — Nitro's hook for a server fault, `api/client-errors.post.ts` for a browser one — but a rotating file is per-machine and nobody is told it grew, so more than one instance means a real sink is needed; the same instance count splits the client-error rate limit into one allowance each, since it is an in-memory map. Both wait on the same infrastructure, which is why neither was built speculatively. _Revisit before any real deployment._
