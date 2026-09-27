# Redesign plan — moving the app to `docs/design/`

The stages below take the app from its current look (blue accent, system font, full-width header) to the reference in `docs/design/`. Run **one stage per session**, in order. Each stage is a complete change under `CLAUDE.md` §2's definition of done — format, lint, build, test, the keyboard walk, a look in the dev server — and is marked here with a `**Status:**` line before it is reported. When every stage is marked, offer to delete this file (§2, _Marking a plan task done_).

The redesign changes **how the app looks, never what it does.** A mocked element whose feature does not exist is not built (§1), and nothing here moves data, URLs or API shapes.

---

## 1. The reference, file by file

Open the files through a static server (`CLAUDE.md` §8) — they are templates rendered by `support.js`, and `file://` shows raw `{{ … }}`. Each page mock has a Desktop / Mobile toggle at the bottom right.

| File                             | App surface it governs                                                           | Out of scope in it — do not build                                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `FlexBase Design System.dc.html` | tokens, every atom, table anatomy, overlays, sidebar, shell anatomy, the 9 rules | switch, radio, date/time picker, media input, calendar and board views, action bar, toasts, summary footer, the 12 field types we lack  |
| `Clients Table.dc.html`          | `pages/tables/[tableAddress]/index.vue`, `RecordsTable`, filter summary + drawer | view switcher (Table/Calendar/Kanban), row-selection column, bulk bar, column footer, **filter operator rows**                          |
| `Table Settings.dc.html`         | `pages/tables/[tableAddress]/settings.vue`, `TableFieldList`, `ConfirmModal`     | drag handles / field reordering, the `primary` marker, "Last record added"                                                              |
| `Home.dc.html`                   | `pages/index.vue`                                                                | workspace name, Invite people, 7/30-day toggle, stat tiles, Members and Activity panels, "last edited" and owner columns, table sorting |
| `Auth.dc.html`                   | `layouts/auth.vue`, `pages/auth/*`                                               | full name, "Keep me signed in", Forgot password, Google / SAML SSO, terms line, reset-link state                                        |
| `Error.dc.html`                  | `app/error.vue`                                                                  | request id + timestamp + Copy, the "Check the trash" secondary line                                                                     |
| `User Settings.dc.html`          | —                                                                                | the whole page (profile, notifications, security)                                                                                       |
| `Workspace Settings.dc.html`     | —                                                                                | the whole page (workspaces, members, roles)                                                                                             |

Every shell mock shows a workspace switcher, Members and Workspace settings in the sidebar: all three are out of scope (Stage 11 says what takes their place).

## 2. What actually changes

| Area          | Now                                                           | Target                                                                                                                                    |
| ------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Colour        | cool grey ramp, blue accent `#1C64D8`, blue focus             | pure grey ramp (canvas `#F6F6F7`, raised `#FAFAFA`, hover `#F0F0F2`), green accent `#1C6B4A`, green focus, danger `#B42318`               |
| Badge palette | 10 hues × bg / border / fg                                    | the same 10 hues retuned, × bg / **dot** / fg — the dot replaces the border step                                                          |
| Type          | system-ui, 16px controls and body                             | Archivo + IBM Plex Mono; 14px controls and cells, 15px running text, 32px page title, 13/12/11 for secondary, meta and markers            |
| Geometry      | radii 4 / 8 / 12                                              | 4 marker · 6 badge/option · 8 control · 10 panel/card/table/modal · 12 auth card and sheet                                                |
| Elevation     | two shadows                                                   | sm (hover) · md (popover) · lg (dialog); scrim `#18181B` at 40%                                                                           |
| Icons         | Material Design Icons (`mdi:`)                                | Material Symbols Rounded, outline                                                                                                         |
| Buttons       | ghost is accent-coloured; disabled is 60% opacity             | ghost is neutral text with a grey glyph; a _selected_ ghost; disabled is a grey plate; a loading state                                    |
| Shell         | full-width header (brand, email, Log out) over sidebar + main | no desktop header: 248px raised sidebar with the product mark on top and the user block at the bottom; breadcrumb row inside the page     |
| Tables        | radius 8, white header, 3 inline icon actions                 | radius 10, raised header row with type glyphs, mono record numbers, right-aligned numbers, blank shown as a dash, open / edit / ⋯ actions |
| Overlays      | one 420px dialog, a 360px drawer, actions in the body         | 400 / 480 / 640 widths, 52px header, 16px body, actions in a pinned footer, a side sheet for the record, a bottom sheet under 640px       |
| Pages         | card grid on Home; 24px titles                                | a table list panel on Home; 32px titles with the primary action beside them; settings as label/value panels                               |

Unchanged, because the reference agrees with the code: the 36px control height, the 44px table row, the 8px control radius, `rem()` sizing on a 16px root, the one-value select trigger with a count, "no operators", and every behaviour contract in `docs/decisions.md` → _Components_.

## 3. Decisions this plan takes

Where the reference conflicts with a project rule or with scope, the plan takes the side below. Each is a recommendation — confirm or override before the stage named, and propose the matching reference edit (`CLAUDE.md` §8).

| #   | Conflict                                                                                                                                                         | Resolution                                                                                                                                                                                                                                            | Stage |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| D1  | Control borders are drawn `#D1D1D6` (1.52:1) with a `#A1A1AA` hover (2.56:1) — both under the 3:1 non-text floor the reference itself states in rule 09.         | `--color-border-control` becomes `#8D8D96` (3.29:1 on white, 3.15:1 on `#FAFAFA`); hover darkens to `#6D6D77`. `#D1D1D6` stays as `--color-border-strong`, a divider.                                                                                 | 1     |
| D2  | The focus green `#2F9E6B` is 2.93:1 against its own halo `#E6F2EB`, breaking the pairing `decisions.md` → _Focus is never removed_ floors the indicator on.      | `--color-focus: #2C9665` (3.23:1 on the halo, 3.01:1 on the selected-ghost halo `#D9ECDF`, 3.71:1 on white). The reference draws focus as a `box-shadow` ring; the code keeps the outline as the indicator.                                           | 1     |
| D3  | Webfonts come from Google Fonts.                                                                                                                                 | Self-hosted from npm, so no third-party host sits on the render path (the reason `@iconify-json/*` is installed). Archivo has no Cyrillic — Cyrillic text falls back to the stack, as it does in the reference.                                       | 2     |
| D4  | Icons are Material Symbols Rounded.                                                                                                                              | Switch the whole app to Iconify's `material-symbols` set (outline, rounded names); drop `mdi`. One icon family, never two.                                                                                                                            | 3     |
| D5  | The reference allows "compact chrome" at 24–30px (filter chips, pagination cells); `CLAUDE.md` §8 floors every sized control at 36.                              | Adopt the compact tier for chips and pager cells only, still ≥ 24 on both axes. Its 20px chip-remove button is under the floor — it stays 24 (`size="sm"`).                                                                                           | 9, 12 |
| D6  | The colour picker trigger is a 26px square.                                                                                                                      | Draw a 26px square inside a 36px hit area — it edits a value, and rule 07 puts those at 36.                                                                                                                                                           | 7     |
| D7  | The record opens in a **non-modal** side panel (no scrim, page stays live, Tab not trapped).                                                                     | Keep it modal and restyle it as a right-hand side sheet. Non-modal would rewrite `BaseModal`'s `inert`, focus-return and Escape contracts and the record-dialog e2e suite — feature work, not a restyle. Register it in `limitations.md` as Accepted. | 16    |
| D8  | The filter drawer mock uses field / operator / value rows; the reference's own rule 03 and `decisions.md` → _There are no operators, anywhere_ forbid operators. | Keep one control per field. Take the drawer's chrome only — header, intro line, footer with the matching count and the actions.                                                                                                                       | 16    |
| D9  | The date field has a calendar-panel picker.                                                                                                                      | Keep the native `<input type="date">`, restyled with the reference's box. A calendar panel is a new component with its own keyboard grid. Register it in `limitations.md` as Accepted.                                                                | 5     |
| D10 | The palette names its fourth hue `amber`; the stored name is `yellow`.                                                                                           | Keep `yellow` — a stored name is a closed vocabulary (`CLAUDE.md` §6). Only its values are retuned.                                                                                                                                                   | 7     |
| D11 | Dialogs become bottom sheets under 640px; `decisions.md` → _A dialog caps against the scrim_ rejected exactly that.                                              | Adopt it inside `BaseModal` alone, with a new named breakpoint, and without the grabber: a grabber that cannot be swiped is a dead control. Rewrite that decision.                                                                                    | 10    |
| D12 | Form actions move into the pinned footer; the same decision kept them in the body.                                                                               | Adopt the footer (Cancel + primary on the right, destructive on the left).                                                                                                                                                                            | 15    |
| D13 | Home rows carry no Rename / Delete; the card grid has both.                                                                                                      | Follow the reference: Home rows are links, and Rename / Delete live on the settings page, where both already are.                                                                                                                                     | 18    |
| D14 | Row actions are open, edit and a `⋯` menu (the **Open** row in `limitations.md`).                                                                                | Build the menu, with Delete inside it. Its own stage, so it can be declined without disturbing the table stage.                                                                                                                                       | 14    |

## 4. Rules for every stage

- **Tokens only.** Components read `var(--*)`; a literal colour never reaches an SFC. A new token arrives **in the stage that first consumes it**, as part of a coherent ramp (`CLAUDE.md` §8) — Stage 1 retunes the existing tokens and adds only those it has a consumer for.
- **Labels are a closed vocabulary** (`CLAUDE.md` §6): the e2e suite selects by them. Keep the current accessible names unless a stage below names the change; a stage that does change one updates the specs in the same change. Playwright's `name` matches a substring, so `"Filters 2"` still answers to `"Filters"`.
- **The accessibility floors hold.** Focus stays an outline (or a recoloured border for fields) with the halo carrying nothing; `forced-colors` keeps its outline; 4.5:1 text, 3:1 non-text, 24×24 targets. Never add a fourth exception to `test/e2e/setup/a11y.ts`.
- **Docs move with the contract.** A stage that changes a rule in `docs/styling.md` or `docs/decisions.md` rewrites that passage (never appends beside it). A source comment that still cites "the concept" is rewritten when its file is touched.
- **Specs move with the markup.** Update the colocated specs that assert a class, a label or a structure the stage changes; add a case for a new prop or a new atom.
- **No new behaviour rides along.** A stage that finds a bug records or fixes it separately, and a reference element with no feature behind it is left out.
- **Light theme only.** The reference defines no dark palette; the user menu's "Appearance" row is out of scope.

---

## 5. Stages

### Stage 1 — Foundations: colour, type scale, geometry and elevation tokens

**Change**

- `_palette.scss`: replace the neutral, accent and danger primitives with the reference ramps (Foundations → _Neutrals_, _Accent and status_), plus the D1 control step and the D2 focus step. Retune the ten badge hues to the reference's _Categorical palette_ values, renaming each `-border` primitive `-dot` (the three steps become bg / dot / fg; `yellow` keeps its name — D10). Refresh the contrast notes in the file header.
- `_variables.scss`, retuned in place:
  - surfaces — canvas `#F6F6F7`; surface white; `-hover`, `-disabled` and `-muted` `#F0F0F2`; `-row-hover` `#FAFAFA`;
  - text — `#18181B` / `#5C5C66` / `#6D6D77`;
  - borders — `-subtle` `#EDEDEF`, plain `#E4E4E7`, `-strong` `#D1D1D6`, `-control` per D1;
  - accent — `#1C6B4A`, hover `#165C3F`; `-active` takes the hover value, since the reference draws no pressed state; tint `#E6F2EB`; `-underline` `#B9DBC8`; `-on-accent-tint` `#165C3F`;
  - danger — `#B42318`, hover and active `#941A11`, tint `#FDECEB`;
  - `--color-focus` per D2; the halo stays `0 0 0 rem(4)` of the accent tint;
  - scrim `rgb(24 24 27 / 40%)`; `--shadow-sm` and `--shadow-md` per the reference's _Elevation_ (`--shadow-lg` waits for Stage 10);
  - radius ramp `--radius-xs` 4 · `-sm` 6 · `-md` 8 · `-lg` 10 · `-xl` 12 · `-pill`.
  - type — `--font-sans` (`Archivo, Helvetica, Arial, sans-serif`), `--font-mono` (`'IBM Plex Mono', ui-monospace, monospace`), and the scale as a set: `2xs` 11 · `xs` 12 · `sm` 13 · `md` 14 · `body` 15 · `lg` 18 · `xl` 24 · `2xl` 32 — the type ramp ships whole, as it does today — and `--letter-spacing-display: -0.025em` for the page title.
- `_reset.scss`: `body` takes `--font-sans` and `--font-size-body`; the global `:focus-visible` baseline reads the new focus token (no structural change).
- Point the consumers the new steps need **now**, one line each: `centred-card` → `--radius-xl`; `BaseBadge --label` and the skeleton bar → `--radius-xs`; the `<h1>` users of `page-title` → `--font-size-2xl` + `--letter-spacing-display`; the two machine-made values already on screen — `BaseLinkedRecord`'s `#number` and `TableFieldList`'s field key — → `--font-mono`.
- Rename every `--color-badge-*-border` consumer to `-dot` (`badgeTint()`, `BaseColorPicker`, their specs); `BaseBadge`'s own dot stays `currentColor` until Stage 7.

**Files** `app/assets/scss/_palette.scss`, `_variables.scss`, `_reset.scss`, `_mixins.scss` (`centred-card`, `page-title`), `app/utils/badge-tint.ts` + spec, `BaseColorPicker.vue`, `BaseBadge.vue`, `RecordsTableSkeleton.vue`, `BaseLinkedRecord.vue`, `TableFieldList.vue`.

**Result** The whole app turns grey-and-green with the new scale in one change, because every component already reads tokens. The shell, the pages and the components keep their current structure; some look transitional until their stage lands, which is expected.

**Depends on** nothing.

**Watch for**

- Moving `--font-size-md` 16 → 14 and `-sm` 14 → 13 compacts every control and secondary line at once. `form-control`'s block padding is sized against 16px text (`_mixins.scss`); with 14px text the box still binds at 36, so leave the padding and re-check in the dev server that nothing clips.
- `--color-text-subtle` on `--color-surface-hover` is exactly 4.50:1 — never put it on anything darker.
- Rewrite `docs/decisions.md` → _Focus is never removed_ (the `$blue-500` paragraph), _The border ramp is four steps_ (the new values and ratios), _A coloured badge carries a dot_ (the step it reads) and `docs/styling.md` → _Tokens_ (the six ramps, the dot step, the new type and radius ramps).

**Not in this stage** fonts (Stage 2), icons (Stage 3), any component geometry beyond the lines above, new tokens without a consumer (`--shadow-lg`, `--color-surface-raised`, `--color-text-disabled`, …).

---

### Stage 2 — Webfonts

**Change** Install Archivo (400, 500, 600, 700) and IBM Plex Mono (400, 500) from npm — `@fontsource/archivo` and `@fontsource/ibm-plex-mono`, or `@nuxt/fonts` with a local provider if it resolves both without a network call. Load only those weights and the `latin` + `latin-ext` subsets (Plex Mono also `cyrillic`), with `font-display: swap`.

**Files** `package.json`, `nuxt.config.ts` (`css` or `modules`), `app/assets/scss/main.scss` if the faces are `@use`d there.

**Result** The reference's typefaces render everywhere, with no request to a third-party host.

**Depends on** Stage 1 (`--font-sans` / `--font-mono` exist).

**Watch for** Rewrite `docs/decisions.md` → _Neither `@nuxt/fonts` nor `@nuxt/image` is installed_ — a real webfont now exists, so the fonts half flips and the image half stays. Update `CLAUDE.md` §7's _No image pipeline ships_ pointer and §11's module / dependency lists. Check that the build does not inline every subset into the CSS.

**Not in this stage** spreading `--font-mono` further — each component adopts it in its own stage.

---

### Stage 3 — Icon set

**Change** Replace `@iconify-json/mdi` with `@iconify-json/material-symbols` and rename every `mdi:*` reference to its outline-rounded Material Symbols equivalent, taking the glyph the reference draws for the same job — e.g. `settings`, `filter_list`, `search`, `add`, `close`, `edit`, `delete`, `open_in_full` for View, `table`, `home`, `chevron_left/right`, `expand_more`, `check`, `menu`, the field-type glyphs (`text_fields`, `numbers`, `check_box`, `calendar_today`, `radio_button_checked`, `arrow_outward`) and the sort glyphs `swap_vert` / `arrow_upward` / `arrow_downward`. Glyph size stays per call site (18–20px).

**Files** `package.json`; every `.vue` using `<Icon>` or a `*Icon` prop; `app/field-types/*/index.ts` (`icon`); `app/field-types/registry.ts` (`FIELD_TYPE_ICONS`); any spec asserting an icon name.

**Result** One icon family matching the reference, still served from disk.

**Depends on** nothing structurally; after Stage 1 so glyph colour and size are judged against the new chrome.

**Watch for**

- The sort icon drops the rotated `mdi:code-tags` trick for `swap_vert`: rewrite the third paragraph of `docs/decisions.md` → _The sort icon is muted with `opacity`_, and re-measure the `limitations.md` entry _The unsorted sort icon is ~1.67:1_ with the new glyph and colours.
- Rewrite `docs/decisions.md` → _`@iconify-json/mdi` is declared_ for the new package, and update `CLAUDE.md` §8's `<Icon name="mdi:close" />` example and §11's dependency note.

**Not in this stage** moving or adding icons — a glyph with no current counterpart (the table header's type glyphs, the logo mark, `logout`, `more_horiz`, `expand_less`, `error`, `warning`) arrives with the stage that places it.

---

### Stage 4 — `BaseButton`

**Change**

- Chassis: `--font-size-md` (14px), weight 500, gap 8, a 1px border on every sized variant (transparent where it is not drawn) so swapping variants never reflows a row.
- `secondary`: border `--color-border-control` (D1), hover `#FAFAFA` via a new `--color-surface-raised` + the darker control border.
- `ghost`: neutral — `--color-text` with a `--color-text-secondary` glyph, hover `--color-surface-hover`. New `selected` prop: accent tint plate, `-underline` edge, accent text — _a ghost holding state_ (the records page's Filter with an active count). A selected button is never disabled.
- `icon`: hover plate `--color-surface-hover` + `--color-text`; `tone="danger"` hovers to the danger tint and colour.
- `link`: accent, weight 500, underline in `--color-accent-underline` at `text-underline-offset: 3px`, full accent on hover. Keeps its 24×24 floor.
- `danger`: the new danger ramp.
- `:disabled`: a grey plate (`--color-surface-disabled`, `--color-border`, new `--color-text-disabled` `#A1A1AA`) instead of 60% opacity, on every variant.
- New `loading` prop: a 12px spinner before the label, `aria-busy="true"`, the control inert but not greyed; the label stays, so the width does not jump. Reduced motion stops the spin.

**Files** `app/components/common/BaseButton.vue` + spec; `_variables.scss` (the two new tokens).

**Result** Every button in the app matches the reference's seven variants and five states.

**Depends on** Stages 1 and 3.

**Watch for**

- Focus stays `focus-ring` (outline + halo): the reference's box-shadow ring is drawn as an outline in the D2 colour. The primary's outline sits on its own green fill at offset 0 — check it reads, and move the offset to `rem(1)` if it does not.
- Rewrite `docs/styling.md` → _`BaseButton` variants_ (the table, `selected`, `loading`, the ghost's colour) and check `docs/decisions.md` → _A ghost button's padding is spacing_ still holds (it does: the padding is still transparent).

**Not in this stage** call sites adopting `selected` (Stage 12) or `loading` (Stages 15, 19).

---

### Stage 5 — Text fields: `form-control`, `BaseInput`, `BaseRange`, `BaseCheckbox`

**Change**

- `form-control` mixin: 14px value text, `--color-border-control` border with the darker hover border (new `--color-border-control-hover`) and a `--color-surface-raised` hover fill; disabled `--color-surface-disabled` + `--color-border`; the invalid border unchanged. The focus and `forced-colors` rules stay as they are.
- `field-label`: 13px, weight 500, `--color-text` (the reference labels in ink, not grey). `field-error`: 12px. `BaseInput` gains an optional `hint` shown on the error's line; the error replaces the hint rather than stacking under it.
- `BaseInput`: 18px leading glyph in a 12px gutter; the date type keeps the native control (D9).
- `BaseRange`: an en dash between the two halves instead of a gap.
- `BaseCheckbox`: a drawn 18px box (radius 6, control border, accent fill with a white check when on, the error border) over a visually hidden native input, the whole 36px label row as the target, 9px gap, 14px label. The input stays the focus target, so the ring is drawn on the box through `:focus-visible` on the input.

**Files** `_mixins.scss`; `BaseInput.vue`, `BaseRange.vue`, `BaseCheckbox.vue` + specs; `FieldFormModal.vue` if it adopts `hint` for its two hand-rolled hint lines.

**Result** Every typed field and checkbox matches the reference's _Text input_ and _Checkbox_ matrices.

**Depends on** Stage 1.

**Watch for**

- The checkbox's `disabled` stays a declared prop bound to the `<input>` (`decisions.md` → _An atom's `disabled` must be a declared prop_), and the invalid state must stay visible under `forced-colors`.
- Register D9 in `limitations.md` (Accepted, trigger: a date field that must show a range or a calendar the browser cannot).
- Rewrite `docs/styling.md` → _Other atoms_ (`BaseInput`'s `hint`, `BaseCheckbox`'s drawn box) and the `form-control` note under _Mixins_.

**Not in this stage** `BaseSelect` (Stage 6), even though it shares `form-control` — check only that it still renders correctly.

---

### Stage 6 — `BaseSelect`

**Change**

- Trigger: 14px value, caret `expand_more` (flipping to `expand_less` while open), the clear as a 24px icon button left of the caret; the open state keeps the focus border rather than an accent one.
- The value overlay: a SELECT value renders as its badge; a relation shows the label with its `#number` in mono beside it, and the number never truncates; in `multiple`, the first value followed by a `+N` counter — never a bare "3 selected". Only the main text truncates.
- Panel: radius 10, `--shadow-md`, 6px inner padding, 2px row gap. Option rows keep the 36px height (rule 07; the reference's 34 is its own inconsistency), radius 6, 9px gap.
- Option states: pointer hover `--color-surface-hover`; selected the accent tint + check; selected-and-hovered a deeper tint (new `--color-accent-tint-strong` `#D9ECDF`); the keyboard row the hover grey with a 2px inset accent edge.
- The four panel states (no options, no matches with the query quoted back, loading skeleton rows at option height, failed with Retry) keep the panel's width and take the reference's copy and layout.

**Files** `BaseSelect/BaseSelect.vue` and its four spec files over `select-harness`; `RelationOptionLabel.vue`; `_variables.scss`.

**Result** Every select, filter and relation picker matches the reference's _Select_ section.

**Depends on** Stages 1, 3, 4, 5.

**Watch for**

- The keyboard row's indicator changes from an inset outline to a 2px inset edge — still ≥ 3:1 (accent on `#F0F0F2` is 5.67:1), but a `box-shadow`, which `forced-colors` does not paint. Keep an outline for that mode, and rewrite `decisions.md` → _The active option's indicator is an inset outline_ to match.
- The `+N` trigger changes the non-searchable branch's accessible name (it is built from `valueText`): make it read "Enterprise and 1 more", not "+1", and rewrite `decisions.md` → _In `multiple`, the control shows a count, not chips_. Update the select e2e specs that assert the old name.
- The trigger's height stays fixed whatever it holds — that is what the count design protects.

**Not in this stage** the searchable behaviour, keyboard model or positioning — styling and the value overlay only.

---

### Stage 7 — Badges and the colour picker

**Change**

- `BaseBadge` `chip`: 22px tall, radius 6, 12px weight 500, the dot a 6px **square** (radius 2) in the `-dot` step. `label`: the reference's marker — 20px, radius 4, 11px weight 500 on `--color-surface-muted`.
- `BaseColorPicker`: the trigger is a 26px tinted square with its own `-dot` step as the edge (dashed when empty) inside a 36px hit area (D6); the panel is the 5 × 2 grid of 22px swatches, 8px gap, the picked one ringed in the accent without changing size.

**Files** `BaseBadge.vue`, `BaseColorPicker.vue` + specs; `app/utils/badge-tint.ts` if a step is read differently.

**Result** A value, a filter and a picker show a choice identically, and the picker matches the reference.

**Depends on** Stage 1 (the `-dot` step).

**Watch for** The dot is now the `-dot` step, not `currentColor`: rewrite `decisions.md` → _A coloured badge carries a dot, not a border_ (geometry, step and the 22px height the padding note describes) and `docs/styling.md` → _Tokens_ / _Other atoms_ (`BaseBadge`'s heights). Each dot clears 3:1 on white and on `--color-surface-row-hover` — re-verify the latter if the row hover moves.

**Not in this stage** where badges are placed (table, field list) — their stages.

---

### Stage 8 — Segmented control, and the BOOLEAN filter

**Change** A new `BaseSegmented` atom: a 36px track with 28px segments, radius 8 / 6, 13px labels, two to five options, one plate on the selected segment, optional leading glyph. Semantics: a `radiogroup` of radios with roving tabindex — one tab stop, arrows move and select. Exactly one segment is always selected; the whole control disables, never a single segment. Then switch the BOOLEAN **filter** control in `app/field-types/boolean/index.ts` from `BaseSelect` to `BaseSegmented` with All / Yes / No, All being the absent param.

**Files** new `app/components/common/BaseSegmented.vue` + spec; `_mixins.scss` (a `segmented-track` mixin — Stage 19 draws the same track); `app/field-types/boolean/index.ts` and its adapters' spec; the e2e cases that drive a BOOLEAN filter.

**Result** The boolean filter reads the reference's way, every answer visible at once.

**Depends on** Stages 1, 5.

**Watch for** The adapters must still emit what `isFilterValueEmpty` drops for All, so the URL is unchanged (`decisions.md` → _The blank option is a placeholder_). The BOOLEAN **input** stays a checkbox — a value you save is a square.

**Not in this stage** a view switcher, the Home period toggle or any other use the reference shows for out-of-scope features.

---

### Stage 9 — Feedback and navigation atoms

**Change**

- `BaseErrorBanner`: radius 10, 12px × 14px padding, a `--color-danger-edge` border (new, `#F0C8C4`), a leading `error` glyph, 14px text in the danger ink. Still renders nothing without a message.
- `BaseEmptyState`: 40px icon tile (radius 10, accent tint), 15px title weight 600, 13px secondary message, one action — the reference's _Empty and loading states_.
- `BaseBreadcrumbs`: 13px, 28px row, `--color-text-secondary` links with an ink hover, the last step in ink weight 500; a 16px chevron separator; each step truncates at 120px and keeps its full name in `title`. Under 640px the trail becomes one back step to the parent — through a new `$breakpoint-compact` (40em) + `below-compact` mixin in `_mixins.scss`, the compact layout Stage 10 reuses for bottom sheets.
- `BasePagination`: "Showing 1–25 of 248" on the left; on the right 30px bordered cells — previous, a window of page numbers in mono with `…`, next — the current page filled with the accent (D5). When the total is capped (`1000+`), number only the pages that are known and leave Next driven by `hasNext`, as today.
- `RecordsTableSkeleton`: the table's frame (radius 10, the raised header row) with 12px bars at radius 4.

**Files** the five components + specs; `_variables.scss`; `_mixins.scss` (the breakpoint).

**Result** Every state surface and the two navigation atoms match the reference.

**Depends on** Stages 1, 3, 4.

**Watch for**

- The pager's accessible names stay "Previous" and "Next" (as `label` on icon buttons); page cells take `aria-current="page"`. The count keeps `role="status"`.
- D5 changes `CLAUDE.md` §8's house floor wording and `decisions.md` → _Every sized control is one height_: add the compact tier (24–30px, chips and pager cells only) there, never as a gate exception.
- The pager's page-number window is new logic: it lives in a pure util with a unit test, not in the template.

**Not in this stage** success or warning banners, toasts — no feature has one.

---

### Stage 10 — `BaseModal`

**Change**

- Chrome: radius 10, a real border (`--color-border-strong`), new `--shadow-lg`; a 52px header with a `--color-border-subtle` divider, 16px (`lg`) weight 600 title, an optional subtitle line; 16px body padding; the footer 12px × 16px with actions on the right and a destructive action at the far left.
- A `size` prop — `sm` 400 (confirmations), `md` 480 (default), `lg` 640 — replacing the fixed 420.
- The `drawer` variant becomes the side sheet: right, full height, 440px capped at the viewport, a left edge shadow.
- Motion: fade with a 4px rise for the dialog, slide from the edge for the sheet, ≤160ms, none under reduced motion.
- Below `below-compact` (Stage 9): every variant arrives from the bottom — full width, radius 12 on the top corners, capped at 90% height, the footer pinned above the safe area (D11).

**Files** `BaseModal.vue` + spec; `_variables.scss`.

**Result** Every overlay shares the reference's anatomy; the consumers change only in Stages 15–16.

**Depends on** Stages 1, 4, 9 (the breakpoint).

**Watch for**

- `inert`, focus-in / focus-return, the Escape listener and `aria-modal` are untouched. `.base-modal` must still declare no `transform`, `filter` or `contain` — the colour picker's `position: fixed` panel depends on it (`styling.md`). Animate the **dialog**, and make sure the animation leaves no `transform` on it once it ends (`animation-fill-mode: none`).
- Rewrite `decisions.md` → _A dialog caps against the scrim_ (the bottom-sheet paragraph) and `styling.md` → `BaseModal`.

**Not in this stage** moving any consumer's buttons into the footer (Stage 15).

---

### Stage 11 — The shell: layout and sidebar

**Change**

- `layouts/default.vue`: drop the desktop header. The grid becomes sidebar (248px, `--sidebar-width`) + main, full height. The main pane's gutter follows the mocks (18px top, 24px sides). Below `below-shell` a slim top bar appears with the menu toggle and the product mark; the off-canvas behaviour — `visibility`, scrim, Escape, closing on navigation — is unchanged.
- `AppSidebar.vue`, on `--color-surface-raised` with a right border:
  - top: the product mark — a 28px accent tile with the `table` glyph and "FlexBase" — linking Home. It stands where the out-of-scope workspace switcher is drawn;
  - Home; an 11px uppercase "Tables" group label (renamed from "Your tables"; the nav's `aria-label` stays "Your tables"); table rows at 36px with glyph, name and a mono count, the active one tinted with accent text; "Add a table" in the accent;
  - bottom, pinned: the user block — an initials avatar, the email, and a `logout` icon button labelled "Log out". No menu: Log out is its only in-scope entry.
- The empty and failed states keep their copy.

**Files** `app/layouts/default.vue`, `app/components/app/AppSidebar.vue`; a small `toInitials` helper in `app/utils/` with a unit test; `_variables.scss` (`--sidebar-width`, `--header-height` now meaning the mobile bar only).

**Result** The frame of every authenticated screen matches the reference's _Shell anatomy_ and _Sidebar_.

**Depends on** Stages 1, 3, 4.

**Watch for**

- The viewport lock and the `minmax(0, 1fr)` / `min-width: 0` / `min-height: 0` rules are load-bearing (`styling.md` → _The shell_); keep them through the header's removal. The mobile-shell e2e suite covers the off-canvas contract — "Log out" moves from the header into the sidebar; the auth spec's `/log out/i` button still matches the icon button's label, but a narrow-viewport path must open the sidebar first.
- Rewrite `styling.md` → _The shell_ (no desktop header; what `--header-height` now sizes).

**Not in this stage** breadcrumbs or page headers — they belong to the pages (Stages 12, 17, 18).

---

### Stage 12 — Records page: header, toolbar and filter summary

**Change**

- The breadcrumb row with the page action on its right (Settings, a ghost button); the title (32px, the display tracking) with "Add record" primary directly beside it.
- The toolbar row: search (a 300px `BaseInput` with the `search` glyph, placeholder "Search records", `aria-label` unchanged) and Filters as a `selected` ghost whenever filters are active, the active count in an accent pill after the label.
- `RecordsFilterSummary`: 28px pill chips on white with a plain border — the field in weight 600, then its phrase — each with its 24px round remove (D5); "Clear all" as the link-style action at the end; the "Showing … :" prefix kept in 13px secondary.
- The pager row beneath the table as in the mock; the body's empty states and failure banner take their Stage 9 looks unchanged.

**Files** `pages/tables/[tableAddress]/index.vue`, `RecordsFilterSummary.vue` + spec, `_mixins.scss` (`page-header` / `page-title`, reused by Stages 17–18).

**Result** Everything above and below the grid matches `Clients Table.dc.html`.

**Depends on** Stages 4, 5, 9, 11.

**Watch for**

- The page is a flex column filling the pane, with only the rows scrolling (`styling.md` → _The records page_); the new rows join the fixed band.
- `decisions.md` → _A ghost button's padding is spacing_ describes the old Settings / Filters / search row. Settings moves to the breadcrumb row, so re-derive the spacing for the new pair and rewrite the entry.
- Labels kept: "Filters", "Add record", "Show all records" in the empty state. "Clear all" replaces the summary's "Show all records" link — update the `filters-multi` e2e case that clicks it.

**Not in this stage** the grid itself (Stage 13).

---

### Stage 13 — `RecordsTable` and the cells

**Change**

- Chrome: radius 10; the header row on `--color-surface-raised` with 13px weight 600 secondary labels, each preceded by its field type's glyph from `FIELD_TYPE_ICONS`; the record-number column headed `#` in mono; the sort glyph per Stage 3; row dividers `--color-border-subtle`; the pinned Actions column with a 1px divider and a soft left edge shadow instead of the `-strong` inset rule.
- Rows stay 44px (36 + 2 × 4); hover `--color-surface-row-hover`.
- Cells: record numbers and every figure in `--font-mono` 13px; **number columns right-aligned**, header included. Blank renders as an em dash in `--color-text-subtle`, with visually hidden "Not set" beside it so the accessible name — and the e2e selectors — are unchanged. A relation renders as the reference's reference chip (mono `#number` + label); a dead one keeps its dashed treatment. Timestamps in mono.
- Alignment is per field type, so it is declared in the app registry — a new total `FIELD_CELL_ALIGN: Record<TFieldType, 'start' | 'end'>` in `app/field-types/registry.ts`, each type's `IAppFieldType` gaining `align`, read through one resolver. Never a type check in `RecordsTable` (`CLAUDE.md` §9).

**Files** `RecordsTable.vue`, `RecordFieldValue.vue`, `app/field-types/**/*Cell.vue`, `BaseLinkedRecord.vue`, `app/field-types/registry.ts` + `types.ts`, their specs; `_variables.scss` if the edge shadow needs a token.

**Result** The grid matches the reference's _Table anatomy_ and _What happens when a value does not fit_ for the six types the app has.

**Depends on** Stages 1–3, 7.

**Watch for**

- The sticky header, the pinned column's wrapper, the `overflow: clip` cell cap and the row-height/inset pair are all load-bearing (`decisions.md` → the four `RecordsTable` entries). Restyle them; do not restructure them.
- `align` is a registry contract: update `docs/architecture.md` §3 and `CLAUDE.md` §9's row for `app/field-types/<type>/index.ts`.
- Rewrite `styling.md`'s `RecordsTable` paragraph (the pinned edge is now a divider + shadow).

**Not in this stage** the row actions' composition (Stage 14), a selection column, a summary footer, views.

---

### Stage 14 — Row actions: open, edit and a `⋯` menu (D14)

**Change** The Actions cell becomes `open_in_full` (the existing "View record" link, name kept), `edit` ("Edit record") and a `more_horiz` button opening a menu built on `usePopover` + `useAnchoredPosition`, teleported out of the clipping table. The menu holds "Delete record" in the danger colour; choosing it opens the existing confirm dialog.

**Files** `RecordsTable.vue`; a small menu component (in `common/` as `BaseMenu` if a second consumer is foreseeable, otherwise in `RecordsTable/`); the records-crud e2e cases for Delete (now `menuitem`); specs.

**Result** The actions column matches the reference and closes the **Open** row in `limitations.md`.

**Depends on** Stage 13.

**Watch for** A menu follows the popover rules: Escape only while open, handled on the panel, focus back to the `⋯` button (`CLAUDE.md` §7, `decisions.md` → _Escape is swallowed only while something of ours is open_). Delete the `limitations.md` row; if the constraint about the halo crossing neighbours still applies, it moves to a `decisions.md` entry.

**Not in this stage** further row actions — the reference's menu carries nothing else the app can do.

---

### Stage 15 — Form and confirm dialogs

**Change**

- `TableFormModal`, `RecordFormModal`, `FieldFormModal`: actions move into `BaseModal`'s footer — Cancel (secondary) and the primary on the right — with the submit button bound to its form by the `form` attribute. Sizes: table `md`, field `md`, record `lg`. The primary uses `loading` while pending.
- `FieldFormModal` in detail: the choices list as the reference draws it (colour square, input, remove), "Allow multiple values" with the locked hint, the indexing checkbox with its cost line, the computed-style muted plates only where a value is read-only.
- `ConfirmModal`: `size="sm"`; the title asks and the button answers (the existing titles and `confirmLabel` already do); a leading `warning` glyph as in the Table Settings mock; Cancel receives initial focus — `BaseModal` focuses `[autofocus]`, so set it on Cancel.

**Files** the four modal components, `RecordForm.vue`, their specs; the e2e cases that submit these forms.

**Result** Every task dialog and confirmation matches the reference's _Modal_ and _Dialog_ anatomy.

**Depends on** Stages 4, 5, 7, 10.

**Watch for** The form's server error banner stays inside the form, above the fields. Rewrite the last paragraph of `decisions.md` → _A dialog caps against the scrim_ (D12).

**Not in this stage** the filter drawer or the record panel (Stage 16).

---

### Stage 16 — Filter drawer and record side sheet

**Change**

- `RecordsFilterPanel`: the side sheet with the reference's header ("Filters" + close), a one-line intro in 13px secondary, one control per field (D8), and a footer — "Clear all" on the left, the matching count, and a Done button (primary) closing the sheet on the right.
- `RecordDetailModal`: the side sheet (D7). The header title stays "Record details" (`decisions.md` → _The dialog's title is static_) and `{table} · #{number}` moves into the header subtitle in mono. The Back link sits under the header. `RecordDetail`'s label/value rows take the reference's side-panel layout (13px labels, 14px values, `--color-border-subtle` rules).

**Files** `RecordsFilterPanel.vue`, `RecordDetailModal.vue`, `RecordDetail.vue`, their specs; `limitations.md`.

**Result** Both sheets match the reference's _Side panel_ and _Drawer_.

**Depends on** Stages 8, 10, 13.

**Watch for** Register D7 in `limitations.md` (Accepted: "The record opens in a modal side sheet, where the reference draws a non-modal panel", trigger: selecting another row with the record open becomes a need). "Done" is a new label — nothing selects by it yet.

**Not in this stage** operators, "Add filter" rows, or a Reset that differs from Clear all.

---

### Stage 17 — Table settings page

**Change** Match `Table Settings.dc.html`:

- the breadcrumb row with "Records" (ghost, `table` glyph) on its right; the 32px title with "Add field" primary beside it, moved up from the Fields section head;
- an 11px mono uppercase "Table settings" eyebrow under the title;
- the Table panel as label/value rows — Name, Records, Fields (the field count), Created, Address (`/tables/N` in mono) — with Rename and Delete table in its footer;
- the Fields section head with its count;
- `TableFieldList` rows: the 32px type-glyph tile, the name, `required` as a marker badge, the meta line (type · config summary · key in mono), edit and delete icon buttons.

**Files** `pages/tables/[tableAddress]/settings.vue`, `TableFieldList.vue` + spec; the table-setup e2e cases.

**Result** The settings page matches its mock minus the out-of-scope parts.

**Depends on** Stages 4, 7, 9, 12 (`page-header` / `page-title`).

**Watch for** The Records row stays omitted while the count is unknown — its comment says why. No drag handle: reordering fields is not a feature (`Field.order` exists, but nothing edits it).

**Not in this stage** the `primary` marker, "Last record added".

---

### Stage 18 — Home

**Change** Match `Home.dc.html` minus what §1 excludes: the breadcrumb row, the 32px title with a meta line ("6 tables · 2 009 records", from the list already loaded), "Add table" primary beside it, and one "Tables" panel — rows linking each table: glyph tile, name, "N fields", the record count in mono, a chevron — with a total row. The empty state keeps its copy and action (D13).

**Files** `pages/index.vue`; the relations and table-setup e2e cases that rename or delete from a Home card (move them to the settings page).

**Result** Home is the reference's table list.

**Depends on** Stages 9, 12.

**Watch for** The dashboard still fetches nothing of its own (`styling.md` → _The shell_, last paragraph). A row is one link filling the row, so the focus ring belongs to the row, drawn the way the table card's is today; that `:has(:focus-visible)` rule moves with it.

**Not in this stage** stat tiles, members, activity, period toggles, sorting.

---

### Stage 19 — Auth and error pages

**Change**

- `layouts/auth.vue`: the product mark centred above a 412px card (radius 12, border, 24px padding) on the canvas.
- `login.vue` / `register.vue`: a 22px title with a one-line subtitle; a switch between the two pages drawn with the `segmented-track` mixin but built as two links (`aria-current="page"` on the active one) — each is a route, so `BaseSegmented`'s radiogroup semantics would be wrong; labels and hints per the mock; the primary full width with a trailing arrow and `loading` while pending.
- `error.vue`: the product mark above the card; a 40px icon tile, "Error 404" as a mono eyebrow, the title and message, "Go back" (secondary) and "Back to home" (primary).

**Files** `layouts/auth.vue`, `pages/auth/login.vue`, `register.vue`, `app/error.vue`, `_auth-form.scss`, `_mixins.scss` (`centred-card`); the auth and error-page e2e specs.

**Result** The screens outside the shell match their mocks.

**Depends on** Stages 4, 5, 8 (the track mixin).

**Watch for**

- Keep the verbs "Log in" and "Register" — the auth spec selects by them, and the heading may grow to "Log in to FlexBase" without breaking a substring match. "Back to your tables" becomes "Back to home"; update the error-page spec.
- `error.vue` stays store-free (`decisions.md` → _`app/error.vue` is store-free_). "Go back" uses history and must fall back to Home when there is none.

**Not in this stage** password reveal, "Keep me signed in", Forgot password, SSO, request id / Copy.

---

### Stage 20 — Consistency pass and close-out

**Change**

- Grep for what the redesign should have removed: unused tokens (`--color-accent-active` if nothing reads it, …), literal sizes that should be tokens, any `mdi:`, any comment citing "the concept". Delete what is dead.
- Walk every screen at 1440, 1024, 768 and 360 wide against its mock, plus every overlay and every async state (loading, empty, failed). Fix drift in the stage's own terms.
- Run `npm run test:e2e` — the axe and target-size gates — and walk the keyboard path of each page.
- Settle the documentation: `docs/styling.md` describes the finished layer, `CLAUDE.md` §8's transition sentence ("Until `docs/design-plan.md` is complete …") goes, `CLAUDE.md` §1 returns to "no phase is in progress" and §3's tree drops this file, and every decision marked by an earlier stage has been rewritten.

**Depends on** every stage.

**Result** The app matches `docs/design/` within the scope and rules above; this file is ready to delete.

**Not in this stage** new features, a dark theme, or out-of-scope screens.
