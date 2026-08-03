# Decisions & accepted limitations

Why the code is shaped the way it is. Each entry exists because the alternative looks obviously better until you know the reason — treat these as **load-bearing**: do not "clean them up" without reading the entry.

Rules live in `CLAUDE.md`; contracts live in `architecture.md`.

---

## Tooling & module resolution

### Everything except components is imported explicitly

`imports: { autoImport: false }` (app) and `nitro: { imports: { autoImport: false } }` (server) also stop Nuxt generating the global `.d.ts` declarations, so a missing import is a `vue-tsc` error at build time rather than a silently resolved global.

The component scan (`components: [{ path: '~/components', pathPrefix: false }]`) is deliberately **kept**: it is what makes `<LazyRecordFormModal>` code-split for free, and it keeps framework components (`<NuxtLink>`, `<NuxtPage>`, `<Icon>`) working. `pathPrefix: false` is why `common/BaseInput.vue` registers as `<BaseInput>`.

### Server code must not import from `#imports`

`.nuxt/types/nitro-routes.d.ts` pulls every `server/api/**` handler into the **app** TypeScript project (to type `$fetch` route responses), and `#imports` resolves to the app's module there — so `defineEventHandler` would not be found. `h3` and `nitropack` are therefore declared as direct dependencies; they resolve identically in both projects. Keep their versions in step with the ones Nuxt resolves.

### `#server` is server-only

Nuxt's import protection rejects it in app and shared code. The Vue layer reaches the server through `$fetch`/`useApi()`. `#server` is a Nuxt built-in alias (registered in `@nuxt/schema`'s alias defaults alongside `#shared`), so it resolves for `vue-tsc` and the Nitro bundler alike.

### Relative imports are a lint error under `app/`, `server/`, `shared/`

`no-restricted-imports` is scoped to those three directories specifically so the root config files can keep their own relative paths.

### `ofetch` is declared; `vue-router` is not

`app/utils/api-error.ts` imports `FetchError` from `ofetch` by name; without the declaration it resolves only through npm hoisting of Nuxt's tree, so a hoisting change would silently break `typecheck`. `vue-router` is deliberately **not** declared — nothing imports it, and Nuxt owns the version.

### `@iconify-json/mdi` is declared even though nothing imports it

`@nuxt/icon`'s default `serverBundle: 'auto'` serves an installed collection from disk and otherwise falls back to the public Iconify API — so without the package every icon in the app is a runtime fetch of a third-party host, on a render path that has no fallback if it is slow or unreachable. It is the one dependency whose purpose is its mere presence; dropping it does not fail a build, it just quietly puts the icons back on the network.

No `icon: { … }` block in `nuxt.config.ts`: `serverBundle: 'local'` would only restate what `auto` already resolves to, and it would not keep the remote fallback away if the package were ever dropped.

### `@nuxt/fonts` was removed

The app ships no webfonts, and the module tries to resolve the `Segoe UI` / `Roboto` names in `_reset.scss`'s system stack from font providers. Re-add it if and when a real webfont exists — not before.

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

Every user's records share one physical `Record` table, so a global sequence would:

- number rows across all tenants (a table would read `1, 47, 2931`);
- leak platform-wide row volume through the counter;
- make ids enumerable;

—all while still not giving the per-table `1..n` that makes a number readable in the first place. So `id` stays an unguessable `cuid()` for reference and addressing, and `number` is a separate display column (`architecture.md` §4).

`number` is allocated inside the insert's own transaction via Prisma's atomic `{ increment: 1 }`, which takes the row lock, so concurrent creates queue rather than race — no retry loop. It is a **high-water mark, not a count**: deleting a record never frees its number.

### The redundant single-column indexes were dropped — do not re-add them

`Table_userId_idx`, `Field_tableId_idx` and `Record_tableId_idx` were each subsumed by the left prefix of the composite index above them, and only cost write throughput. `drop_redundant_indexes` removed all three; `EXPLAIN` confirmed the plans are unchanged, and the record list improved (the composite supplies the ordering, so its `Sort` node is gone).

`@@index([tableId, createdAt])` stays even though the default ordering is `DESC` — Postgres scans a btree backwards.

### The `record_number` migration is hand-written

`Record.number` is required over existing rows, so the column is added nullable, backfilled with `ROW_NUMBER() OVER (PARTITION BY "tableId" ORDER BY "createdAt", id)`, then set `NOT NULL`. `prisma migrate dev` cannot generate that and refuses the diff outright.

**This generalizes:** use `--create-only` and edit the SQL for any future required column over existing data.

---

## The metadata layer

### There are no operators, anywhere

A filter's **value** is the whole contract. How a value is compared is the field type's business, declared once in `FIELD_SQL_BY_TYPE` on the server — it never travels in the URL, no control knows it, and no user can pick one. This is what keeps the filter drawer, the URL codec, the summary chips and the SQL builder from each needing a per-operator branch.

### `FILTER_VALUE_BY_TYPE` and `VALUE_SCHEMA_BY_TYPE` stay split

They look like one table split across two layers. Merging them would be a **cycle**: `shared/utils/filter.ts` imports the constant, and `shared/validation/record.ts` imports `shared/utils/filter.ts`. The split is load-bearing.

### The query schema validates; the codec decodes

`buildRecordQuerySchema` has no `.transform()`. Turning validated params into an `IRecordQuery` is `parseRecordQueryState`'s job — which is what keeps the `utils → validation` dependency direction acyclic. The endpoint composes the two: the schema judges, the codec decodes.

`parseRecordQueryState` is lenient by design and is the **exact inverse** of `toRecordQueryParams`, used by both the page (over `route.query`) and the endpoint (over its validated params), so a link cannot decode two ways.

### Unknown query params are ignored, not rejected

Filter params are named after the field with no prefix, so a typo is indistinguishable from `utm_source`. A stray param must not break the page. A malformed **known** param is still a 400.

### Inputs and filters are data; only cells are components

A cell carries markup and scoped styles (an icon, tabular figures), not just a value, so a `format | component` union would be worse than one uniform contract. Inputs and filters carry neither — they name a `Base*` control plus adapters, so they stay rows in a table.

**`RelationFieldSelect` is the one exception**, because a relation's candidates are records of another table and no synchronous `props(field)` factory can produce them. The rule that follows: a type whose control needs data beyond its own metadata gets a component in `field-types/controls/`; everything else stays a row.

### RELATION's target table is immutable; its label field is not

Retargeting would orphan every stored id, so `updateField` rejects it with 400. The label field is pure display and freely editable. RELATION-typed fields are excluded from the label candidates — a link labelled by a link would read as an id.

### The record's own columns go through one seam

`queryFields(fields)` wraps a table's fields in `Record #` / `Created at` / `Updated at` **only where a query is built**, never where record data is read or written. Special-casing them at each layer instead would have meant a branch in the codec, the schema, the SQL builder, the table and the filter panel — five places to forget one.

The reserved keys are **camelCase**, a shape `slugify` can never emit, so no user field can shadow one. `RESERVED_FIELD_KEYS` states the reservation rather than relying on that luck.

### `searchExpr` is separate from `expr`

NUMBER and BOOLEAN cast in their filter projection, and neither `numeric` nor `boolean` has an `ILIKE` operator. NUMBER searches the un-cast text; BOOLEAN opts out (searching `e` would match every `false`); RELATION opts out because its stored value is a cuid, and matching the label instead would run `targetLabel`'s correlated subquery against every row — the count query has no `LIMIT`.

### `buildRecordSearch`'s parentheses are load-bearing

`withinRange` returns a bare `a >= x AND a <= y` with no parentheses of its own, which is safe only while every sibling is `AND`. Search is the only OR in the query layer, and unparenthesised it would bind to the last bound of a range filter and silently widen it.

### `SEARCH_MIN_LENGTH` is enforced by the schema, not the input

An unanchored `ILIKE` over user-defined JSON keys is unindexable and the count query cannot stop early, so a one-character term is a full-table scan paid twice. Enforcing it client-side only would leave the endpoint open to any caller.

---

## Frontend

### A layout and a page must never share a `useAsyncData` key

`useAsyncData` does **not** dedupe a layout against a page in one SSR render: it fires two requests and warns `NUXT_E3004`, with the page's closure silently never called. Hence `app-tables` (layout) and `dashboard-tables` (page). The dashboard's handler is client-only, so counts refresh when you return Home while SSR still costs exactly one request.

### `ensureTables()` never throws

A rejection in the layout's async setup would replace the page with an error boundary for what is chrome, not content — the sidebar failing to list tables should not take down a records page that loaded fine. It sets `failed` instead, and the sidebar reports it inline with a Retry.

### `app/error.vue` is store-free

It has to render when data fetching is exactly what failed.

It exists because both inner pages forwarded the upstream `statusCode` but hard-coded `statusMessage: 'Table not found'` — so a malformed `?search=`/`?sort=` returned 400, failed Nuxt's `is404` check, and rendered the 500 template claiming a table that had just loaded did not exist. `toPageError` now asserts a cause only for a 404.

### The records store never mirrors query params

A mirrored copy would have to survive SSR hydration to stay correct. Every action takes them from the caller, and the URL stays the single source of truth.

`createRecord` returns the page the new record landed on and only refetches when that equals the current page; the page navigates when it differs. Otherwise the URL would show one page while the table showed another, or the refetch would happen twice.

### A failed refetch is visible, not silent

`records.ts` sets `failed` in a `catch` that rethrows; the page's `watch` swallows the rejection (an unhandled one in a watcher left the table showing rows that no longer matched the URL) and shows a banner. **The empty state is suppressed while `failed`** — an empty result and an unknown result are indistinguishable in the store, and "No records yet" would be a guess.

### `BaseInput` binds `:value` + `@input`, not `v-model`

`v-model` would cast a `type="number"` input's value to a number and write `1.5` back while the user is still typing `1.50`. The composition guard `v-model` provides is kept by hand, so IME input still works.

`BaseRange` applies the same reasoning to both bounds: its watcher resyncs **only a bound that disagrees with what is on screen**, which is what distinguishes an outside change (clear all, a shared URL, the back button) from the value being echoed back. Dates run through the same drafts even though their round trip is lossless — that is what lets one component serve both types.

### Locales and time zones are hard-coded

`en-GB` everywhere, and `formatTimestamp` pins `timeZone: 'UTC'`. An `undefined` locale renders differently on the server and in the browser — a hydration mismatch. `DateFieldCell` gets away with no zone because it parses a date-only value as local midnight, the same wall-clock everywhere; a real timestamp does not.

Pinning UTC also keeps the displayed day equal to the day the filter matches on, since that compares `::date`.

### The active-table check compares `route.params.tableId`, not the path

`/tables/:id` is a string prefix of `/tables/:id/records`, so a path check is ambiguous. The param marks the table active on both inner pages.

### `AppBreadcrumbs` is prop-driven

Each page passes its own `IBreadcrumb[]` because the pages already hold the `ITable` they fetched — which is also what produces their 404. Deriving the name from the store in the layout would quietly delete that guard.

### `FieldFormModal` fetches the target's fields outside the fields store

That store holds the table being edited; loading another table's fields into it would clobber the page behind the modal.

---

## Styling

### The token layer is three layers, and the build enforces the boundary

`_palette.scss` holds primitives as SCSS variables. Because `additionalData` injects only `functions` and `mixins`, a component **cannot** reference `$blue-600` without an `@use` it will never have. Components consume `var(--color-*)` and nothing else — that is a compile-time fact, not a convention.

### Surfaces are split even where two share a value

`--color-surface-hover` / `-disabled` / `-muted` are separate tokens today with the same value. The previous single `--color-bg` meant page background, row hover, disabled fill and chip fill at once; re-collapsing them just relocates that bug.

### `--color-border-control` is separate from `--color-border-strong`

A divider only has to be visible; a control's outline is the only thing identifying the control, so it carries the 3:1 non-text contrast floor. Neither `$gray-200` (1.3:1) nor `$gray-300` (1.66:1) clears it — `$gray-400` (3.17:1) exists for exactly this. `BaseButton --secondary` is surface-on-surface, so its border is load-bearing.

### Breakpoints live in `_mixins.scss`, in `em`

A media query cannot read a custom property, and `additionalData` injects that file into every SFC. `em` rather than `px` so it honours the browser's font-size setting.

### Focus is never removed, only restyled

`_reset.scss` carries a zero-specificity baseline — `:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible` — so nothing can end up with no ring, and any component rule overrides it without a fight. Component rings use `outline`, not `box-shadow`, so an ancestor's `overflow` cannot clip them.

### Every sized control is one height; `link` alone has none

There is a single control height and no secondary size. `primary`/`secondary`/`danger`/`ghost` take it as `min-height`, `icon` takes it on both axes, `BaseCheckbox` gives it to the whole label row, `AppSidebar` to its items, `DynamicTable` to its sort button. `--link` is the one exception and is not an oversight: it is a text run with the semantics of a button, and it is what sizes `.table-card__actions` and `.field-row` — giving it a height would grow both surfaces for no gain, since neither is a standalone target.

The heights that are _derived_ from the control rather than equal to it are all in one direction — a control plus its own inset — and are written that way rather than as literals: `DynamicTable`'s `tbody td` is `calc(var(--control-height) + rem(8))` against an action cell inset of `rem(4)`. Anything that instead restates the number by hand will drift the next time the token moves, which is exactly what happened at 44px.

`BaseModal`'s header padding (`rem(10)`) and `DynamicTable`'s action-cell padding (`rem(4)`) are the two insets that keep those bands from gaining an empty strip around a control. Both are deliberate and both are load-bearing. The layout's sidebar toggle is hand-rolled rather than a `BaseButton`, so it restates `--control-height` explicitly — the one place the token is duplicated instead of inherited.

### The control height is 36px, and 44px was never the AA bar

WCAG 2.2 **AA** is SC 2.5.8 _Target Size (Minimum)_: **24×24 CSS px**. 36px clears it with 50% margin. The 44×44 the design system used to carry is SC 2.5.5 _Target Size (Enhanced)_, which is **AAA**, and also the Apple HIG touch figure — it was being quoted in `CLAUDE.md` under a "WCAG 2.2 AA" heading as though it were the requirement. It was not.

The drop to 36 is a density decision, and it is safe because it never touches a content box: every control lost 8px of height _and_ 8px of block padding together, so text has exactly the room it had at 44. `form-control` went `rem(10)` → `rem(6)`, `DynamicTable`'s sort button and its Actions corner header the same, rows `rem(52)` → the calc above. Anything that trims the height without trimming the padding clips instead of compacting.

`--header-height` moved 64 → 56 in the same change, keeping the 10px-per-side slack it had around a 44px control. Its only consumers are the shell grid row and the off-canvas sidebar's `top`, both token references.

The focus ring was left at `3px` width / `2px` offset. An outline paints outside the border box, so its geometry is independent of the control height, and the places where a 5px halo crosses into a neighbour (`DynamicTable`'s actions `gap: rem(4)` and its action-cell inset, `AppSidebar`'s `gap: rem(2)`, and the records header's ghost pair at the same `rem(4)` — see below) were true at 44 and are unchanged — more conspicuous against a smaller box, not newly broken.

### A ghost button's padding is spacing, so the gaps beside it are unequal on purpose

`ghost` is `padding: 0 rem(12)` over a transparent background: nothing paints at its box edge, so that padding reads as part of the gap. In the records header the row's `cluster` at `rem(16)` therefore put **40px** of visible space between Settings and Filters (12 + 16 + 12) and **28px** between Filters and the bordered search box (12 + 16 + 0) — the two controls that belong together looked the furthest apart.

The ghost pair sits in its own `cluster(4)`: 12 + 4 + 12 is the same 28. **The two gaps in that row are deliberately different numbers producing equal space** — normalising them back to one value is the regression, and it will look like a tidy-up.

The cost is a fourth site where the 5px focus halo crosses into a neighbour (above): Settings' ring overlaps Filters' box by 1px. The identical trade-off was already accepted at the identical `rem(4)` in `DynamicTable`'s row actions, so this is the existing bargain, not a new one.

### The header group needs `min-width: 0`, same as the panes

The two table headers group the `<h1>` with its primary action, so the **group** — not the title — is `page-header`'s flex item. `page-title` still carries `min-width: 0`, and that is still what lets the text shrink _inside_ the group; it does nothing for the group itself. A flex item's automatic minimum is its content-based minimum, and a nowrap flex container's min-content size is the sum of its items' contributions — which for a `white-space: nowrap` heading is the whole untruncated table name. `overflow: hidden` on the `<h1>` does not rescue it: `overflow` zeroes a box's own _automatic minimum_, not its min-content _contribution_ to its parent's intrinsic size. Without `min-width: 0` on the group the header refuses to shrink and a long name runs past the pane instead of ellipsising. It reads like a redundant line and is not.

**Rejected: `flex: 1` on the group.** That implies `flex-basis: 0`, so the group's base size stops being its content, it never reaches `page-header`'s wrap threshold, and the title starts ellipsising at widths where it would have fitted whole. `justify-content: space-between` already pushes the right-hand cluster to the edge; nothing needs to grow.

The primary button in that group takes `flex: none`, through a page-owned class (`&__create`, the same shape as `&__search`) rather than a bare `.base-button` selector — a page must not reach for another component's internal class name. Shrink is distributed in proportion to flex base size, so an unfrozen button reaches its min-content and wraps "Add record" onto two lines; `.base-button` declares no `white-space`, and `--primary` is `min-height` precisely so a long label wraps rather than overflows. Freezing the button sends every pixel of the deficit to the title, which is the one child that can absorb it.

### `BaseButton` renders the element its role implies

One component, one stylesheet. A `BaseLinkButton` would have been a second copy of six variants' worth of SCSS kept in step by hand, and the two would have drifted the first time a token moved.

Rejected: a separate `href` prop — `NuxtLink` already resolves an absolute URL to a plain `<a href rel="noopener noreferrer">` with no router involvement, so `href` would be a second prop meaning the same thing, plus a decision at every call site. Rejected: a polymorphic `as`/`is` — an open element set with no caller asking for it, and it would let a call site emit a `<div>` that looks like a button, which is the bug this component exists to prevent.

`to` is typed `string`, not vue-router's `RouteLocationRaw`: that package is deliberately undeclared, and every link in the app is a plain path. `NuxtLink` is imported from `#components` rather than resolved by name — only components _in templates_ are ambient; one referenced from script is imported like anything else.

`disabled` wins over `to` because a disabled link is not a link. Every alternative rebuilds the native attribute out of `aria-disabled` + `tabindex="-1"` + `pointer-events: none` — three mechanisms for one, taking the control out of the tab order by hand, and needing a selector for a state nothing else in the app expresses that way. A JS click guard was rejected separately: `stopImmediatePropagation` ordering against fallthrough listeners is not something a component can rely on, and `NuxtLink` installs its own handler you cannot get in front of.

### `text-link` is a class, not a mixin

It had three `@include`s and no per-site variation, which is a shared block, not a fragment. Converting the two page-header links to `BaseButton` with `to` took it to two, both of them prose links inside a sentence — so `_text-link.scss` carries the one look and `_mixins.scss` no longer carries a mixin whose whole body was a fixed declaration list.

That conversion was the point rather than a side effect: at 14px × `--line-height-base` with no padding those two header links were ~21px tall, standing alone in an action cluster rather than inline in prose, so SC 2.5.8's inline exception did not cover them. They were the only targets in the app under 24×24.

### The viewport lock lives in the shell, not in the records page

`app/layouts/default.vue` is `height: 100dvh; overflow: hidden`, and the sidebar and main region scroll their own content. The alternative — leaving the shell in document flow and giving the records page a `height: calc(100vh - var(--header-height) - …)` — was rejected on two counts: the page would have to restate the shell's own padding and header height and stay in step with them by hand, and it would still let the brand bar scroll away above the table, which is half of what makes a long list tiring to use. Putting it in the shell also deleted the sidebar's `position: sticky` + `calc(100vh - var(--header-height))`, which existed only to fake the height the fixed shell now supplies.

`dvh`, not `vh`: on mobile a collapsing URL bar leaves a `100vh` shell overhanging the visible area, which is exactly where the pager lives.

The consequence to know: **`min-height: 0` on the two panes is load-bearing.** A grid or flex item's automatic minimum is its content, so an item holding a 50-row table grows past its row and the `overflow-y: auto` beside it never fires. It reads like a redundant line and is not.

### The records grid sizes to its rows, not to the pane

`DynamicTable` takes `flex: 0 1 auto` from the records page, so its height is the height of its content, capped by the space left in the pane: a few rows end at the last row with the pager directly beneath, and a full page shrinks to the pane and scrolls inside itself.

It was `flex: 1` first, on the reasoning that a pager welded to the bottom edge gives the page a stable frame. That was wrong, and visibly so — with seven records the grid was a mostly-empty box with a void between the last row and the pager. **Do not restore it.** The frame is not worth the void.

`flex-basis: auto` is the load-bearing third of the shorthand: it makes the flex base size the grid's own content height, which is what a `max-height` or a measured height would have had to approximate. Nothing here states a height, so the behaviour re-resolves for free on resize, at any breakpoint, and when the filter summary or the error banner takes a slice of the pane.

The empty states are centred with `margin-block: auto` on the child rather than `justify-content: center` on `&__body`, because the parent cannot centre one child without lifting a short grid off the top as well. That rule is nested (`&__body &__empty`) so it outranks `BaseEmptyState`'s own `margin` — flat, the two selectors tie and the winner falls to stylesheet order across components.

### The sticky table header's rule is a shadow, not a border

`thead th` in `DynamicTable` carries `box-shadow: inset 0 -1px 0 var(--color-border)` where every other cell edge is a `border-bottom`. Under `border-collapse: collapse` the collapsed edge between the header row and the first body row is painted by the **table**, not by the cell, so a sticky `th`'s `border-bottom` scrolls away with the rows and the pinned header ends up floating. `border-collapse: separate` would fix the border and cost the single-hairline grid the table is built on, so the shadow stays. For the same reason the `th` carries its own opaque `background`: its padding lives on the inner `&__sort` button, so only the cell can paint the full width the rows scroll under.

### The pinned Actions column needs a wrapper inside the cell

The action buttons' flex row lives on a `div.dynamic-table__actions-group` **inside** the `<td>`, not on the `<td>` itself, and that is load-bearing rather than tidiness. A `<td>` with `display: flex` is not a table-cell box, so CSS generates an anonymous table-cell around it; the sticky box's containing block becomes that anonymous cell, which shrink-wraps it, and a sticky box cannot move outside its containing block. `position: sticky; right: 0` would clamp to zero movement and the column simply would not pin. Putting the flex on a wrapper keeps the `<td>` a real table cell — which the column's `width: rem(1)` + `white-space: nowrap` shrink-to-fit also assumes.

Its left edge is `box-shadow: inset 1px 0 0` for the same reason the sticky header's rule is a shadow: under `border-collapse: collapse` a real border is painted by the table, not the cell, so it would scroll away instead of riding with the pinned column. The hairline is permanent rather than appearing on scroll — a scroll-aware shadow would put a scroll listener and reactive state into a component that is otherwise pure CSS, and in this design borders already do the structural work.

It is the one divider drawn in `--color-border-strong` rather than `--color-border`: separating a frozen column from columns sliding underneath it is a heavier job than ruling off a row. **A tinted fill was considered and rejected** — `--color-surface-muted` is the same value as `--color-surface-hover`, so filling the column would have swallowed the row hover exactly where the buttons are, and `--color-accent-tint` reads as "selected" everywhere else in the app (active sidebar item, filter chips), which a permanently pinned column is not. The column earns its emphasis from the divider and a wider gutter (`$pinned-gutter`, a component-local `rem(20)` — one component's measure, not a design token the rest of the app reads) instead.

That gutter is also what the `&.dynamic-table__actions-head` rule exists for: it is the only header with no sort button to carry the inset, so `th { padding: 0 }` would otherwise leave its label flat against the divider while the buttons a row below sit a full gutter in.

The pinned cells paint opaque backgrounds, so `tbody tr:hover` has to repaint the actions cell explicitly; without it the hovered row shows a white notch at its right edge.

Two rules are nested inside the generic ones they override — `&.dynamic-table__actions` inside `tbody td`, and `&.dynamic-table__actions-head` inside `thead th` — spelling the class out instead of using `&__…`, which would resolve against the wrong parent. That is specificity, not style: `.dynamic-table tbody td` outranks a bare `.dynamic-table__actions`, so the same declarations written as a sibling block are silently dead. The actions cell's `padding-block: rem(4)` is exactly that case, and it is load-bearing: as a real table cell the row `height` is only a _minimum_, so at the generic `rem(6)` a 36px button pushes every row to 49px. Moving either rule back out of its parent will grow the rows again.

### `DynamicTable` rows have an explicit height

`height: calc(var(--control-height) + rem(8))` on `tbody td`, not derived from the tallest cell — otherwise the action cell's buttons define the row, and a button plus the generic `rem(6)` padding sets it rather than the design doing so. The `rem(8)` is the action cell's own `2 × rem(4)`, so the row is exactly a button plus its inset: 44px at the current 36px control. A bordered row measures 45px; the last row drops its border and measures 44.

It is the app's **first and only `calc()`**, and deliberately so. Written as a literal it was a magic number calibrated against a token three files away, and it went stale the moment that token moved — the `calc` is what makes the relationship survive the next density change instead of quietly mis-sizing every row.

### `BaseSelect` pins `height`, not `min-height`

Chrome ignores `line-height` on `<select>`, which otherwise leaves it 1px taller than the inputs beside it.

### `BaseBadge --chip` is never uppercased

It displays a **value** — SELECT choices are user data. `--label` is the uppercase variant, and it marks metadata (`required`), never content.

### Never ship a dead control

The header deliberately has no global "Search everything" box: cross-table search is not built, and a dead input is worse than a gap. The principle outlives the instance — if cross-table search is built, the box arrives with it.

### A SELECT choice is coloured from a closed palette, not a free colour picker

A custom hex picker was the alternative, and it loses on all three axes the codebase already cares about.

It breaks the token boundary `_palette.scss` exists to enforce: components consume `var(--color-*)` and the build makes a primitive unreachable, so an arbitrary colour would have to arrive as a literal. `BaseButton`'s `tone` prop is the precedent — it **replaced** a free-form `hoverColor` string for exactly this reason.

It breaks the contrast guarantee. A badge needs 4.5:1 text on its fill; with a closed set every pairing is authored and verified once, while a free picker needs runtime luminance maths and still lets a user choose a pairing that fails.

And it stores the wrong thing. What is persisted is a **name** (`"blue"`), not a value, so the colour survives a re-theme, and dark mode remains reachable. The upgrade path is preserved either way: widening the enum to accept a hex later needs no data migration, because the stored names stay valid members of whatever union replaces it.

### A choice's identity is its own text

`Record.data` stores the choice string, not an option id. That keeps the whole SQL layer, the filter constants and the URL codec out of this change — SELECT still filters, sorts and searches on the stored text.

The cost is that renaming a choice orphans the records holding the old one. That was already true before colours existed; it is now also true of the colour, and it is recorded below rather than fixed, because a stable option id buys nothing for colour and rewrites `record-query.ts` to get there.

### The badge palette is selected in JavaScript, by token name

`badgeTint()` builds `var(--color-badge-<name>-bg)` from the colour prop and returns inline custom properties. A Sass `@each` emitting one modifier class per hue would keep the selection in CSS, but it needs the palette list to exist in both SCSS and TypeScript — and the failure mode of that duplication is silent: add a colour to the enum, forget the stylesheet, and the badge renders unstyled with no error anywhere. Composing the name keeps `_variables.scss` the single definition, and a literal colour still never reaches a component.

### `BaseColorPicker` handles Escape on its panel, never on `document`

It opens inside `BaseModal`, whose Escape listener is on `document`. Two document-level listeners cannot be ordered reliably — `stopPropagation` between listeners on the _same_ node does nothing, and registration order is an accident of mount order. Handling the key on the panel with `.stop` means the event never reaches `document` at all, so one Escape closes the popover and leaves the dialog open. The precondition is that focus is inside the panel while it is open, which the roving tabindex requires regardless.

No `useDismissable` was extracted and `BaseModal` was not refactored, though an earlier plan called for both. The justification had been that a popover would be the third hand-rolled document-Escape listener — but because the popover deliberately does _not_ register one, the count stays at two and the extraction would have had a single consumer. Extracting on the first occurrence is the speculative build `CLAUDE.md` §1 rules out; the trigger still fires the day a second popover appears.

---

## Accepted limitations

The register referenced by `CLAUDE.md` §1. **Open** entries are in scope for the current phase; **Accepted** entries are not, unless a request says otherwise.

| Limitation                                                                                                                        | Why it stands                                                                                                                                                                                                                                                                                  | Status                                                     |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **No focus management in dialogs** — focus is not moved into a dialog on open, nor restored on close                              | `BaseModal`'s `inert` on `#__nuxt` already keeps Tab inside; the remaining edge cases (nested modals teleporting out of the sidebar, the sidebar auto-closing on route change, breakpoint crossing mid-animation, honouring existing `autofocus`) are a piece of work in their own right       | **Open** — WCAG 2.2 AA gap                                 |
| **No test suite**                                                                                                                 | CI + total `Record<TFieldType, …>` registries have carried it so far                                                                                                                                                                                                                           | **Open** — top priority (`CLAUDE.md` §10)                  |
| **36px targets are below the Apple HIG / Material touch figure on touch devices**                                                 | A flat 36 was chosen over a `@media (pointer: coarse)` override restoring 44: a second geometry mode means every derived height has to hold at two values, and the app's touch use is secondary. Clears WCAG 2.2 AA (SC 2.5.8, 24×24) with 50% margin; it is SC 2.5.5 **AAA** that is given up | **Accepted** — revisit if touch becomes a primary surface  |
| **Relation picker has no search and lists at most `RELATION_OPTIONS_LIMIT` (200) candidates**                                     | A value outside the list is still shown as its own option, so editing never drops a link silently                                                                                                                                                                                              | **Open** — UX                                              |
| **`_count.records` drifts between Home visits**                                                                                   | `records.ts` is independent of `tables.ts`                                                                                                                                                                                                                                                     | **Open** — small                                           |
| **Deleting a target record leaves a dangling id** that reads as "Unknown record"                                                  | Blocking it would mean a JSONB scan of every table on every delete. Deleting a target **table** is refused with a 409 instead                                                                                                                                                                  | **Accepted** — revisit only with a real referential design |
| **Sorting/filtering by a JSONB key is unindexed**                                                                                 | Keys are user-defined per table, so no general index applies                                                                                                                                                                                                                                   | **Accepted** — the first scaling ceiling; watch it         |
| **Relation label sort costs one PK lookup per matching row**                                                                      | On top of the unindexed JSONB path above                                                                                                                                                                                                                                                       | **Accepted** — same ceiling                                |
| **Free-text search is unindexable and its cost is paid twice** (page query + count)                                               | Unanchored `ILIKE` over user-defined JSON keys. `SEARCH_MIN_LENGTH` bounds the worst case                                                                                                                                                                                                      | **Accepted** — same ceiling                                |
| **A disabled `BaseButton` with `to` renders `<button disabled>`**, so it announces as _button, dimmed_ rather than _link, dimmed_ | Every alternative rebuilds native `disabled` out of `aria-disabled` + `tabindex="-1"` + `pointer-events: none`, taking the control out of the tab order by hand for a state the rest of the app expresses natively                                                                             | **Accepted**                                               |
| **No error reporting or observability**                                                                                           | Nothing beyond `createError` responses; no client or server error sink exists                                                                                                                                                                                                                  | **Accepted** — revisit before any real deployment          |
| **Renaming a SELECT choice orphans the records holding the old text**, which then render as a neutral badge                       | A choice's identity is its own text, so the whole SQL layer stays out of it. The stale value keeps its text rather than blanking, and nothing errors                                                                                                                                           | **Accepted** — an option id buys nothing for colour        |
| **Choice colours do not show in the record form or the filter dropdown**, only in table cells                                     | Both are a native `<select>`, and `<option>` fills are not styleable across browsers. Showing colour there means a full ARIA listbox — and inside `DynamicTable`, whose scroll container would clip it                                                                                         | **Open** — UX, wants a custom listbox                      |
| **The colour popover always opens below its trigger and never flips**                                                             | It is 254×110 inside a centred dialog, so the case needs a viewport short enough to matter. Flipping means measuring, which is the anchor-positioning machinery the app has so far not needed                                                                                                  | **Open** — small                                           |
