# Refactoring & cleanup plan

The working detail behind the **refactoring & cleanup** phase in `docs/roadmap.md`. The roadmap
holds the ordered task list and its statuses; this file holds the _why_, the affected files and the
risk for each one, so the roadmap can stay the one-line register `CLAUDE.md` §12 requires.

**This document is temporary.** It is the output of one full-codebase audit, not a permanent
reference. **Delete it when the phase closes** — anything in it that outlives the work (a constraint
that must not be cleaned up, a contract someone could break) belongs in `docs/decisions.md` or
`docs/architecture.md` and must be moved there as the task lands, not left here.

`CLAUDE.md`'s routing header carries a line pointing here, marked temporary. That line goes when
this file does.

---

## Ground rules

- **Every task ends at the definition of done in `CLAUDE.md` §2** — `format` → `eslint` → `build` →
  `test`, with tests added or updated for changed logic, and a manual check in the running app for
  anything visual. Not restated per task.
- **Do the phases in order.** Within a phase, tasks are independent unless a `Depends on` line says
  otherwise, so each can land as its own commit.
- No new features. No behaviour change except where a task says so explicitly — Phase 1's Escape
  guard was one such exception, and every remaining task is behaviour-neutral.

---

## What the audit found clean

Recorded so it is not re-audited. Every file under `app/`, `server/`, `shared/`, `test/`, `scripts/`
and the root configs was read.

- **No dead modules.** Every `.vue` under `app/components/` and `app/field-types/` is referenced;
  every exported symbol has a consumer.
- **Four exported types have no external importer** — `TUrlQueryValue`, `TSelectStatus`,
  `IRelationTarget`, `IErrorLogEntry`. **None is dead:** each names the shape of an exported
  function's parameter or return value. Leave them exported.
- **No debug code, no commented-out code, no `TODO`/`FIXME`, no `console.*`, no `any`, no
  `@ts-ignore`** anywhere in project code.
- **No circular imports.** The `shared/` layer order (`types` → `constants` → `utils` →
  `validation`) holds; `ownership.ts` → `services` is one-directional as documented.
- The test rig (`test/mount.ts`, `test/prisma-mock.ts`, `test/select-harness.ts`,
  `test/disposable-database.ts`, `test/fixtures.ts`) has no duplication worth removing.
- **Considered and rejected:** splitting `shared/utils/filter.ts` into a record-column module and a
  filter-param module. The two halves are 25 lines and 130, they share `FILTER_VALUE_BY_TYPE` and
  `IField`, and the split would rewrite imports in nine files to separate concerns nobody has to
  hold apart. Cohesive enough as it stands.

---

## Phase 3 — Duplication in the render layer

Larger single-file edits. Each is contained to one component.

### 3.1 — Collapse `RelationFieldSelect`'s duplicated template

- _Problem:_ `app/field-types/controls/RelationFieldSelect.vue` renders two `<BaseSelect>` blocks
  that differ only in `v-model` and `:multiple`. Nine attributes and the entire `#option-label` slot
  body — including a nested `v-if`/`v-else` — are written out twice. The slot also calls
  `linkedRecordOf(option.value)` twice per option row, in the `v-if` and again in the `v-bind`.
- _Change:_ keep **both branches** — `decisions.md` explains why `multiple` is tied to the model's
  type and must not be bound as a union — but hoist the shared attributes into one computed object
  bound with `v-bind`, and reduce the double `linkedRecordOf` call to one.
- _Why:_ the decision record justifies two branches, never two copies of their attribute list. As it
  stands, adding a prop means remembering to add it twice.
- _Risk:_ **medium.** `RelationFieldSelect.nuxt.spec.ts` plus `test/e2e/relations.spec.ts` cover both
  branches; run the e2e suite for this one.

### 3.2 — Resolve each field's control once per render

- _Problem:_ `RecordsFilterPanel` calls `filterFor(field)` in three places (`controls`,
  `controlValue`, `filterValue`) and `DynamicForm` calls `inputFor(field)` in three (`controls`,
  `controlValue`, `applyValue`) — so the resolver runs three times per field on every render instead
  of once, and the `controls` computed already holds the answer.
- _Change:_ carry `toControl`/`fromControl` on the entries the `controls` computed already builds,
  and read them from there.
- _Why:_ the `controls` computed exists precisely because "`props` is a factory" (its own comment);
  the adapters were left out of it by omission.
- _Risk:_ **low.** Behaviour-identical; both components have `*.nuxt.spec.ts` coverage.

### 3.3 — One server-error banner

- _Problem:_ `<p v-if="serverError" role="alert" class="…__server-error">{{ serverError }}</p>` is
  written in five places — `FieldFormModal`, `RecordFormModal`, `TableFormModal`,
  `pages/auth/login.vue`, `pages/auth/register.vue` — each paired with its own
  `&__server-error { @include error-banner; }` rule (in three SFCs and in `_auth-form.scss`). One of
  the five orders its attributes differently, which is how a copy drifts.
- _Change:_ either a `BaseFormError` atom taking the message, or a global `.form-error` class in its
  own partial (the precedent `_text-link.scss` and `_visually-hidden.scss` set for a block with no
  per-site variation). `error-banner` stays a mixin — `ConfirmModal`, `RecordDetailModal` and the
  records page use it for banners that are not form errors.
- _Why:_ `role="alert"` on this element is an accessibility contract, and it is currently asserted
  five times by hand.
- _Risk:_ **low–medium.** The e2e suite reads these by role; keep the element and the role identical.

### 3.4 — Two small SCSS blocks that are copies

- _Problem:_ (a) `app/layouts/auth.vue` and `app/error.vue` declare the same centred-card shell —
  flex centring, `min-height: 100vh`, `rem(16)` padding, `--color-canvas`, then a `max-width` card
  with `--radius-lg`, `--color-surface`, `--shadow-sm`. Seven declarations each, identical.
  (b) `AppSidebar`'s `&__item` and `&__add` share seven declarations (flex row, `gap: rem(12)`,
  `min-height: var(--control-height)`, `padding: 0 rem(12)`, `--radius-md`, `--font-size-md`,
  `focus-ring`).
- _Change:_ (a) a `centered-card` mixin in `_mixins.scss`. (b) a shared placeholder or a base class
  the modifier extends inside `AppSidebar`.
- _Why:_ `CLAUDE.md` §8: "A declaration block that would be a second copy belongs in `_mixins.scss`."
- _Risk:_ **low.** Visual only — walk both surfaces.

---

## Phase 4 — Module boundaries

Relocation, no logic change.

### 4.1 — Move `app/utils/record-cells.ts` into `app/field-types/`

- _Problem:_ `CLAUDE.md` §9 and `architecture.md` §3 both say `app/field-types/` holds **everything**
  per-field-type. `app/utils/record-cells.ts` imports `FIELD_CELLS`, `RECORD_COLUMNS` and
  `MultiValueCell`, is about nothing but resolving a column to a cell and a value, and is imported by
  exactly one component (`RecordFieldValue.vue`). It is the field-type layer's resolver sitting one
  directory outside it — the same relationship `inputFor` / `filterFor` / `summaryFor` have to their
  registries, and those all live inside.
- _Change:_ move to `app/field-types/` (its own module, beside `cells.ts` — do not merge, the
  registry and its resolver are different reasons to change). Update the one importer, the spec
  (`record-cells.nuxt.spec.ts` moves with it), and the `architecture.md` §3/§10 references.
- _Why:_ the stated rule is what makes "adding a field type touches exactly these places" checkable.
  One resolver living elsewhere breaks the guarantee by a directory.
- _Depends on:_ 2.2 (same file). _Risk:_ **low.** Aliased imports, so nothing relative breaks.

### 4.2 — Consider moving `RECORD_NUMBER_FIELD` out of shipped code

- _Problem:_ `shared/utils/filter.ts:25` exports `RECORD_NUMBER_FIELD`; `queryColumns` is its only
  non-spec reader, and the export exists because two specs use it as a fixture. Its two siblings
  (`CREATED_AT_FIELD`, `UPDATED_AT_FIELD`) are correctly private.
- _Change:_ un-export it and add a builder to `test/fixtures.ts`, which is where field fixtures
  belong (`CLAUDE.md` §10).
- _Why:_ small, but it is the only place a shipped module widened its surface for a test.
- _Risk:_ **low.** Optional — skip if the phase is running long.

---

## Phase 5 — Page decomposition

The two largest pages. Last, because they touch the most and Phases 2–3 shrink them first.

### 5.1 — Extract the shared table-page bootstrap

- _Problem:_ `app/pages/tables/[tableId]/index.vue` and `.../settings.vue` open with the same twelve
  lines: `route.params.tableId as string`, a `useAsyncData` whose body is
  `Promise.all([api<{ table }>(…), fieldsStore.fetchFields(tableId)])` returning the table response,
  then `if (error.value) throw createError(toPageError(error.value))`, then a `breadcrumbs` computed
  starting `{ label: 'Home', to: '/' }`.
- _Change:_ a `useTablePage({ key })` composable returning `tableId`, `table` and the fetch's `error`
  already thrown. **The key must stay a parameter** — `table-records-${id}` and `table-${id}` are
  deliberately different, and `decisions.md` forbids a shared key. The settings page's `table`
  additionally prefers the tables-store row over the fetched one so a rename moves the heading
  without a refetch; that preference is the settings page's, not the composable's, so it stays where
  it is or arrives as an option.
- _Why:_ the 404 behaviour of both table screens is one rule written twice.
- _Risk:_ **medium.** The `useAsyncData` key rule and the settings page's store-preference are both
  load-bearing and easy to flatten by accident. Read the two `decisions.md` entries first.

### 5.2 — Extract the field list from `settings.vue`

- _Problem:_ `app/pages/tables/[tableId]/settings.vue` is 516 lines and holds three unrelated things:
  the page shell, the table detail card, and the field list. The field list is a self-contained
  unit — ~50 lines of markup plus ~110 lines of `.field-list` / `.field-row` SCSS, with its own
  icon/type/config-summary/key composition and its own responsive rules.
- _Change:_ a `TableFieldList.vue` (or a `FieldRow.vue` under a new `app/components/fields/`) taking
  `fields` and emitting `edit`/`delete`. Everything else stays on the page.
- _Why:_ SRP — the page currently changes for a table-rename reason and a field-row-rendering reason.
- _Depends on:_ 5.1 (same file). _Risk:_ **medium.** `test/e2e/table-setup.spec.ts` drives this
  surface by accessible name and asserts the 375px stacking; the names and the SCSS must move intact.
  Run `test:e2e`.

### 5.3 — Reassess `pages/tables/[tableId]/index.vue` after 5.1

- _Problem:_ 425 lines, five inline `Lazy*` dialogs, four composables wired up. Whether it is still
  too big is only answerable once 5.1 has taken the bootstrap out.
- _Change:_ **decide, do not pre-plan.** If it warrants a split, the record-form / confirm / detail
  dialog trio is the natural seam.
- _Depends on:_ 5.1. _Risk:_ **medium**, if done at all.

---

## Phase 6 — Deferred, and final validation

### 6.1 — `BaseSelect.vue` (1005 lines): evaluate, do not split on sight

- _Problem:_ the largest file in the project. It is **already decomposed** — `usePopover`,
  `useAnchoredPosition`, `useListboxNavigation` and `useSelectOptions` came out of it, and two of
  those carry an explicit "not a general-purpose composable" warning. What is left is one control
  with two branches, two keyboard dispatchers, a teleported panel and the ARIA wiring that ties them
  together.
- _The candidate:_ a `BaseSelectPanel.vue` taking `visibleOptions` / `activeIndex` / `selected` and
  emitting `choose`, moving ~70 lines of markup and ~90 of SCSS.
- _Against it:_ the panel's Escape handling, its `aria-activedescendant` IDREFs, its teleport and its
  one focusable (Retry) are all coupled to the parent's keyboard dispatchers; four spec files plus
  `test/e2e/select-combobox.spec.ts` and `select-keyboard.spec.ts` read its DOM directly.
- _Change:_ **none unless a concrete need appears.** Length alone is not a reason here; the file's
  concerns have already been separated once, and this split would trade one large cohesive component
  for two coupled ones.
- _Risk:_ **high** if attempted. Recorded so it is not re-litigated from the line count.

### 6.2 — Watch item: `BaseSelect`'s `seen` map

- _Problem:_ the `seen` watcher `JSON.stringify`s `[...props.options, ...visibleOptions]` on every
  reactive tick and then rebuilds the whole `Map`. `useListboxNavigation` runs a second
  `JSON.stringify` over the same values for its own watch key. At `RELATION_OPTIONS_LIMIT` (200) this
  is two full serialisations per change.
- _Change:_ **none now.** Not measurable at the current cap. If a shared `optionValuesKey(options)`
  helper is wanted for readability, that is Phase 2 work, not a fix.
- _Risk:_ n/a — recorded, not scheduled.

### 6.3 — Final pass

- Re-read `docs/architecture.md` and `docs/decisions.md` against everything Phases 1–5 moved, and fix
  only what a change made wrong (`CLAUDE.md` §12 — rewrite or delete, never append a correction
  beside it).
- Move anything from this file that must outlive the phase into `decisions.md` or `architecture.md`.
- Run the full set once, in order: `npm run format` · `npx eslint .` · `npm run build` ·
  `npm run test` · `npm run test:integration` · `npm run test:e2e`.
- Delete `docs/refactor-plan.md` and both pointers to it — `docs/roadmap.md`'s, and the temporary
  line in `CLAUDE.md`'s routing header.
