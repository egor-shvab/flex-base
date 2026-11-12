# Accepted limitations

What the project knowingly does not do. **Open** entries are in scope; **Accepted** entries are not
unless a request says so (`CLAUDE.md` §1). Each carries the trigger that would reopen it. A fixed
limitation leaves this file; any constraint that outlives it moves into `decisions.md`.

---

## Open

Nothing is open.

---

## Accepted

### The record opens in a modal side sheet, where the reference draws a non-modal panel

`BaseModal`'s `drawer`: scrim, `inert`, focus return, Escape owned by the dialog. Non-modal would
rewrite all four contracts and the record-dialog e2e suite for a restyle. _Reopen if moving between
records with the panel open becomes a need._

### A table's URL carries no slug, only its number

A slug would put a user-authored name into the pathname, which the error log records under a
structural redaction contract. `parseTableAddress` already ignores a `-…` suffix, so adding one
later is cheap. _Reopen if a URL ever becomes visible outside the app._

### A public number is database-local

Numbers collide across databases; cuids do not. _Reopen if import/export, cross-environment seeding
or any multi-database feature ships._

### A URL discloses roughly how much a user has

`/w/…/tables/12` and `#4821` reveal counts every member already sees; a shared screenshot reveals
them outside the workspace too. _Reopen if a table or record is ever shared beyond its workspace._

### Four lines of `architecture.md` §11 are approximated, not proven

A hydration warning (production silences it; the specs assert the SSR HTML and a clean console
instead), a clipped focus ring (asserted structurally), held Backspace (pressed repeatedly instead),
a multi-value cell's ellipsis (paint only). _Revisit if one of the four regresses unnoticed, or a
tool can assert it directly._

### Nitro's own routing is exercised by no test

Integration invokes handlers directly, so path mapping, method suffixes and param extraction are
trusted; Playwright drives them from outside. _Revisit only if a routing bug reaches production._

### A field named entirely in non-ASCII gets the key `field`

`slugify` keeps `^[a-z0-9_]+$`, which is also what guarantees no user key shadows a camelCase record
column. Unicode keys would put percent-encoded names in filter URLs. The field's **name** is
untouched. _Revisit if non-ASCII names become the common case._

### 36px targets are below the Apple HIG / Material touch figure on touch devices

Clears SC 2.5.8 (AA); SC 2.5.5 (AAA) is given up rather than maintain a second geometry under
`pointer: coarse`. _Revisit if touch becomes primary._

### A date field uses the browser's own picker

The reference's calendar panel would be a new component with a keyboard grid and locale rules for a
look. _Reopen when a date field needs a blocked day or a range drawn as one span._

### A select no longer opens the OS-native picker on touch

The price of a listbox that colours, searches and loads asynchronously; a searchable one also raises
the soft keyboard, bounded by `shouldSearch()`. _Revisit if touch becomes primary._

### In `multiple`, the closed control names only the first value

`Enterprise +2`. Filters restate the rest in `RecordsFilterSummary`; the **record form** does not. A
chip row below the control is the cheap fix. _Reopen if record forms with multi-value fields draw a
report._

### A multi-value filter can only mean _any of_, never _all of_

There are no operators. _Revisit only alongside operators as a whole._

### A legacy field keyed like a reserved param cannot be filtered

Only `page`, `pageSize`, `sort`, `dir`, `search`, `detail`, and only fields created before
`createField` refused them. It still renders and sorts. A migration would rewrite every record and
shared link. _Revisit only if a user reports one._

### Deleting a target record leaves a dangling id

It reads "Unknown record"; blocking would scan every table's JSONB on every delete. Deleting a
target **table** is a 409. _Revisit only with a real referential design._

### Renaming a SELECT choice orphans the records holding the old text

They keep their text and render as a neutral badge (`decisions.md` → _A choice's identity is its own
text_). _Reopen if renaming a choice is asked for as a feature — the fix is a rename that rewrites
stored values, not an option id._

### A field nobody opts in is unindexed, and some relation work never is

Sorting or filtering an un-opted field scans (~100–270 ms over 800k rows). Relation option search
always scans its target, bounded by `LIMIT`. A RELATION's **ordering** has no index (the value is in
another row); the join through the filter index closes most of the gap (~171 ms vs 104 ms for plain
text). _Revisit only if that gap matters; a denormalised label is the only remaining fix._

### Deep paging walks every row it skips

`OFFSET` cost, which no index removes. Keyset pagination would change `page`, a closed URL param.
_Revisit only alongside another records-URL change._

### `pg_stat_statements` is not enabled, and that is time-sensitive

It needs `shared_preload_libraries`, so a compose change and a restart, and proves little on a dev
container. It cannot report on any period before it was enabled. _Turn it on with the first real
deployment, not after the first complaint._

### An index that fails to build says so only in the error log

The build is not awaited, so the toggle reports success and the index is simply absent.
`reconcileFieldIndexes` repairs it, but nothing calls it on a schedule. _Revisit with the error-log
sink._

### A record count stops at 1000, and past it the UI says `1000+`

An exact count is `O(rows)` on every list. The pager reads `1–50 of 1000+`; Next still works
(`decisions.md` → _The count is bounded, and Next does not read the page count_). _Revisit only if
an exact total is asked for — as a second, opt-in count, never a higher cap._

### A disabled `BaseButton` with `to` renders `<button disabled>`

It announces as a dimmed button rather than a dimmed link (`decisions.md` → _`BaseButton` renders
the element its role implies_). _Revisit if a disabled link must announce as a link._

### A truncated table cell offers no way to read the full value

Except a relation, via its dialog. Rows have a fixed height, so a multi-value cell shows one line
too: values past the cap give way to an ellipsis, as long TEXT does. The rendered text comes from the cell component, so a tooltip
needs either a fifth registry or a `scrollWidth` + `ResizeObserver` pass per fetch; View is one
click away. _Revisit if something else earns the table a measurement pass._

### The unsorted sort icon is ~1.70:1

Under SC 1.4.11's 3:1, at `opacity: 0.35`; a compliant `0.7` read as clutter. Nothing depends on
seeing it: the header text names the column, the button has a focus ring, and `aria-sort` carries
the state. _Raise it only on a real report._

### A badge's fill is ~1.05:1 against a hovered row

The dot (≥3.1:1) and the word survive; raising fills would break their 4.5:1 text pairings. _Revisit only if the badge palette is retuned._

### The role and pending-invitation caps are counted, not locked

Two creates racing past the count can leave a workspace one over `MAX_WORKSPACE_ROLES` or
`MAX_PENDING_INVITATIONS`. Each cap bounds a list a page renders, which one extra row does not
break. _Reopen if a cap ever guards a cost rather than a list._

### The error log is a local file, and the rate limits are per process

More than one instance needs a real sink, and the in-memory rate limits (client errors,
invitations) split per instance. _Revisit before any real deployment._

### An invitation goes to whoever registers its address first

No address is verified, so anyone can register an invited email nobody has claimed yet and accept
the invitation. _Reopen with the first real deployment: email verification closes it._

### Deleting a workspace is one cascading statement

Its tables, fields and records go in one `DELETE`, which holds its locks for as long as the cascade
runs — instant now, minutes on a workspace of millions of records. _Reopen when a workspace passes a
million records: delete in batches, or mark and reap._

### Registration keeps an email's case

`User.email` is stored as typed, so `Ada@x.com` and `ada@x.com` are two accounts. Invitations are
stored lowercased and matched against the lowercased account email, so either account receives an
invitation sent to either spelling. Normalising sign-up would change who can sign in with what.
_Reopen with email verification, or on the first duplicate-account report._
