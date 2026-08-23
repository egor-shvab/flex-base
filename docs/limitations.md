# Accepted limitations

What this project knowingly does not do, and why each entry is a decision rather than a bug. Rules live in `CLAUDE.md`, contracts in `architecture.md`, and the reasoning these sit on in `decisions.md`.

**Open** entries are in scope for the current phase; **Accepted** entries are not, unless a request says otherwise (`CLAUDE.md` §1). Each carries the trigger that would reopen it, so the decision is not re-taken by accident. A limitation that has been fixed leaves this file — the constraint that outlives it, if any, moves into the `decisions.md` entry that governs it.

---

## Open

### Row actions are three inline icons, where the concept draws one `⋯` menu

The concept's menu holds full sentences. The stated blocker is gone — `usePopover` + `useAnchoredPosition` anchor correctly inside a scrolling, clipping container. What is left is that three targets in a pinned column still fit, so the menu would be work without a user-visible gain. The third button does add one more site where the focus halo crosses a `gap: rem(4)` neighbour — the bargain that row already struck. _Revisit when a fourth row action appears._

## Accepted

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

### Sorting/filtering by a JSONB key is unindexed

Keys are user-defined per table, so no general index applies. _The first scaling ceiling; watch it — revisit at the first table over ~100k records, or the first report of a slow filtered view._ Three limitations sit on top of it and are accepted for the same reason: a **relation label sort** costs one PK lookup per matching row; **free-text search** is unindexable and its cost is paid twice (page query + count), bounded only by `SEARCH_MIN_LENGTH`; and **relation option search** scans the target table the same way, though paid once, over one table, on one expression, under a hard `LIMIT`.

When it does need answering, **the query layer can already take the fix** — stated here so it is not re-derived under load. Because `db/record-sql.ts` composes SQL per field from metadata rather than emitting one fixed query, each remedy plugs into the existing per-type rules: a **GIN index** on `data` helps exactly one comparison, `jsonb_exists_any`, which is the one GIN-indexable operator in the layer; a **per-field expression index** over `data ->> key` is an `expr`/`sortExpr`-shaped decision the registry already owns; and a maintained **`tsvector` column** would replace `buildRecordSearch`'s OR group, which is already a single seam. What is genuinely new is index _lifecycle_ — issuing DDL from `createField`/`deleteField` puts lock waits and half-created indexes inside a user-facing request, and `CONCURRENTLY` cannot run in a transaction. That is the commitment to take deliberately, not the SQL.

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
