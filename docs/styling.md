# Styling reference

How the SCSS layer fits together beyond what the partials say themselves. The rules are `CLAUDE.md`
§8; the reasons are `decisions.md` → _Styling & tokens_.

## Tokens

`_variables.scss` is the list; what it does not say: radii go by job — `xs` marker, `sm` badge or
option, `md` control, `lg` panel, `xl` page-sized card; in the type scale `md` is cell text and
`body` is running text. **Text a person types into is `--font-size-control`**, never `md` — it
becomes 16px under `pointer: coarse`, below which iOS zooms the page on focus. There is no pressed (`-active`) step. `--color-glyph-faint` is the
one colour exempt from the 3:1 non-text floor, because it is never the sole cue. `_mixins.scss`
`@use`s `functions` itself and does not re-export it.

**Badge hues** are selected at runtime: `buildBadgeTint()` (`app/utils/badge-tint.ts`) composes token
**names** into inline `--badge-bg` / `-dot` / `-fg`. Each `-fg` clears 4.5:1 on its `-bg`; each
`-dot` clears 3:1 on `--color-surface` and `--color-surface-row-hover`. On `--color-surface-hover` a
dot falls to ~2.87:1, **so nothing drawing one may sit on that wash.**

## Mixins and shared classes

Check `_mixins.scss` before writing a declaration block. What its names do not say:

- **`visually-hidden`** is `.g-visually-hidden` for text hidden at one breakpoint only.
- **`truncate`** works only on a **bounded** box — a `max-width`, or `min-width: 0` on a flex item.
  Without the bound it is silently inert.
- **`stack` / `cluster`** declare no `flex-wrap`. A heading group inside a `cluster` needs its own
  `min-width: 0` (`decisions.md` → _The header group needs `min-width: 0`, same as the panes_).
- **`BaseCard`** is every card: border, radius and surface, with `#header` / `#footer` slots that
  own the chrome. Geometry and colour only; a card that lifts on hover or wears a ring declares
  that itself. A list goes inside it, never as its `tag` — a header in a `<ul>` is invalid.
- **`BaseListRow`** (in `BaseList`) is an entity row — fields, members, roles, a dashboard table —
  and **`BaseDetailRow`** (in `BaseDetailList`) a term/value row; a block styles only what it puts
  in their slots. Below the shell a list row's `#trailing` wraps under the name unless it is
  `inlineTrailing` — a trailing that collapses to one `⋯` below compact (fields) stays. A `BaseDetailRow` with `labelFor` holds a control and does not clip;
  `variant="wrap"` wraps a value that must stay whole (a record's field), and a `flush` list drops
  the side padding outside a card. A page opens with **`BasePageHead`** (crumbs, `h1`, its action at the right edge, a description line) and sets
  its own margin below it — below compact the step back, title and actions share one row, so a head
  button with an icon takes `iconOnlyBelowCompact`; the heading above a card is **`BaseSectionHead`**; a titled action with
  a description (Danger zone) is **`BaseActionRow`**, and `tone="danger"` on it and its `BaseCard`
  turns the edges red.
- **`popover-panel`** is the one floating surface (select list, colour grid, `BaseMenu`). A
  `role="menu"` is **`BaseMenu`** with **`BaseMenuItem`**s: choosing an item closes it and returns
  focus, unless the item is `keep-open`; `checked` (even `false`) makes it a `menuitemradio`.
- **`form-control`** is the whole text-field chrome, with its focus half in **`control-focus`** for
  a bordered non-text control (`BaseCheckbox`). Its `:focus` recolours the border (programmatic
  focus included), while the halo is `:focus-visible` only.
- **`BaseFieldMessage`** is the line under a field — hint and error share **one** line, the error
  replacing the hint. Without an `id` it is a standalone line (a failed load's alert, its retry in
  `#action`). **A failed load** is a `BaseErrorBanner` for a whole page, that line inside a block,
  and a `keep-open` item inside a menu.
- **`BaseNavItem`** is a vertical-navigation row (the sidebar, settings sections); `NuxtLink`'s
  `aria-current` marks the page, `active` a section spanning several routes. A person or a
  workspace is **`BaseAvatar`** + **`BaseIdentity`** — round for a person, square for a workspace.
- **A link that fills a card:** the **card** wears the ring via `:has(:focus-visible)`, and the link
  suppresses both halves of its own.
- **`BaseCenteredPanel`** is the surface outside the shell (the auth layout, `error.vue`); below
  `$breakpoint-compact` its card dissolves into the page.

## `BaseButton` variants

- `primary` — the one thing a surface is for, filled accent
- `secondary` — anything reversible, bordered in `--color-border-control`
- `danger` — destructive filled action, only inside a confirmation
- `ghost` — toolbars and page headers; ink text, grey plate on hover; `selected` makes it an
  accent-tinted plate
- `icon` — icon-only, named by `label`; any variant with a leading icon can turn icon-only below
  compact (`iconOnlyBelowCompact`), its hidden label still naming it
- `link` — accent text over `--color-accent-underline`, for a sentence, a banner or a row of one-off
  actions

**`font-size`/`font-weight` must stay on the `.base-button` chassis** — `--ghost` declares neither.
Every sized variant has a 1px border (transparent where unseen), so swapping variants never moves a
row. `icon` takes `--control-height` on **both** axes; `link` has none but is floored at 24×24.
`ghost`'s padding reads as gap (`decisions.md` → _A ghost button's padding is spacing, so the gaps
beside it are unequal on purpose_).

- `tone: 'danger'` retargets `icon`'s hover and `link` outright.
- `size: 'sm'` acts on `icon` alone. It is the 24×24 button inside another control (select clear,
  chip remove): a 16px glyph + `rem(3)` padding + 1px border on each side is exactly 24, the
  boundary `test/e2e/setup/a11y.ts` measures — **neither number moves alone**.
- **Disabled is never opacity:** filled variants become a grey plate, every variant takes
  `--color-text-disabled`, and `link` loses its underline. `selected` is inert outside `ghost` and
  sets no ARIA.
- **`loading`** (filled variants only) makes the button inert at once but keeps its idle look; the
  spinner waits `INDICATOR_DELAY_MS` and then stays at least `INDICATOR_MIN_DURATION_MS`
  (`useDelayedFlag`), so a fast request shows none. It takes the leading icon's box, or sits over
  the label's transparent glyphs — the width never changes. **`busy`** is the same wait without a
  spinner, for a button blocked by another's request (Cancel, Discard): inert at once, disabled-looking
  only after the delay. `disabled` wins over both. Any other indicator that blinks on a fast load uses
  the same composable.
- **`to` makes the root a `<NuxtLink>`** with an unchanged look; **`disabled`, `loading` and `busy` win
  over `to`** (`decisions.md` → _`BaseButton` renders the element its role implies_).

## Atoms — traps only

- **`BaseInput`** — `debounce` and `trim` exist because `<component :is>` cannot pass v-model
  modifiers. `form-control`'s chrome stays on the `<input>`, not on the `.base-input__control` box,
  so a decorated field looks identical.
- **`BaseRange`** — a blank or unparseable bound is `null`, **never `0`**, or an empty box becomes
  `>= 0`.
- **`BaseModal`** — marks `#__nuxt` `inert` while open, which makes `aria-modal` true. `subtitle`
  and the `leading` slot never join the accessible name. A destructive footer action is placed far
  left by its caller.
- **`BaseSelect`** — read `isMultiple`, never `props.multiple` (`decisions.md` → _`multiple` is
  tied to the model's type, and is read through `isMultiple`_).
- **`BaseSegmented`** — always one value, so no empty state and no `disabled`. The chosen plate's
  `--color-border-control-hover` edge is what makes the state 3:1. Given `links` instead of
  `options` it is a `<nav>`, the current page (`aria-current`) taking the chosen plate.
- **`BaseCheckbox`** — the check is drawn as an **icon** (`forced-colors` drops fills but keeps
  `currentColor`). The label is the 36px target.
- **`BaseBadge`** — `chip` is a user value (never uppercased), `label` a mono uppercase meta marker
  that ignores `color`. It declares its own `height` and `line-height` (`decisions.md` → _A table
  column's width cap lives on a wrapper, not on the cell_).
- **`BaseColorPicker`** — not teleported; its `position: fixed` panel **breaks under any ancestor
  `transform`/`filter`/`contain`**, which is why `BaseModal`'s animation leaves no resting
  transform.
- **`BaseErrorBanner`** — **renders nothing without a message** (two e2e cases count zero alerts). A
  slotted message makes the caller own presence: gate it with `v-if`.
- **`BaseEmptyState`** — the icon is `aria-hidden` (the records page renders the component as a
  `role="status"` region); the message keeps its `<p>` so inline links stay on one line.

## The shell

`app/layouts/default.vue` has **no desktop header**: the sidebar holds `AppMark` on top and the
user + Log out at the bottom, and only its middle scrolls; the `<header>` is the narrow-viewport
bar. The shell owns the viewport — `100dvh`, `overflow: hidden`, the main region the scroll pane —
and the `minmax(0, …)` + `min-width: 0` + `min-height: 0` trio is load-bearing (`decisions.md` →
_The viewport lock lives in the shell, not in the records page_). Dialogs teleport, so the shell's
`overflow` cannot clip them. The page is `viewport-fit=cover`, so **a surface touching a screen edge
pads by `env(safe-area-inset-*)` on that edge** — the header, main pane, sidebar, centred panel and
bottom sheet do.

`RecordsTable`: a blank is an `aria-hidden` dash plus a visually hidden "Not set" inside a
`position: relative` box (or the hidden text escapes the scroll container). The `⋯` menu panel is
**teleported** — the pinned cell is a stacking context and would paint it under later rows. Its
sticky, row-height and width rules: `decisions.md`.

The records page fills the pane: `.records-page` is a `height: 100%` column whose `&__body` is
`flex: 1; min-height: 0`; the table sizes to its rows (`decisions.md` → _The records grid sizes to
its rows, not to the pane_); the skeleton is `flex: none`.
