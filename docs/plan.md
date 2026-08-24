# Implementation Plan

Frontend review, August 2026. Source: an end-to-end read of `app/` and the `shared/` layers it
depends on. Tasks are ordered; work them in order unless a task says otherwise.

**Marking progress:** each task block below takes a `**Status:**` line as its **first line** the
moment steps 1–8 of the definition of done pass for it (`CLAUDE.md` §2). A task with no such line
has not been started. Mark per task, before reporting it and before starting the next.

**This plan authorises no commits.** Leave finished work uncommitted (`CLAUDE.md` §2).

---

## Goal

Close two user-visible defects, then retire the duplication that has passed `CLAUDE.md` §6's
second-occurrence trigger, then a short tail of consistency and hygiene items. Nothing here changes
an architectural decision — every task either restores a rule the project already states or removes
a copy of logic that already has a home.

---

## Implementation Order

### P1 — `useForm` clears errors for array fields

**Status:** done — 2026-08-23

**Goal:**
Editing a composite (array/object) form field clears that field's error and the form-level server
error, as `useForm`'s own contract and `CLAUDE.md` §7 already promise.

**Changes:**
`app/composables/useForm.ts` registers one watcher per key of `initial`:

```ts
fieldKeys.forEach((key) => watch(() => form[key], () => { … }))
```

A getter returning a reactive object is compared by `Object.is` and tracks only the property read,
so mutating the array (`push`, `splice`, editing an element) never fires it. Verified against this
project's Vue: only the scalar key fired.

Pass `{ deep: true }` **only** for keys whose initial value is a non-null object, so the blanket
deep-watch `CLAUDE.md` §7 forbids is not introduced:

```ts
const isComposite = typeof options.initial[key] === 'object' && options.initial[key] !== null
watch(() => form[key], clearFor(key), isComposite ? { deep: true } : undefined)
```

Add a short comment stating why the flag is conditional — it reads as removable otherwise.

**Files / areas:**

- `app/composables/useForm.ts`
- `app/composables/useForm.spec.ts` — all 11 existing cases use scalar fields, which is why this
  survived. Add cases for an array field: `push`, `splice`, and mutating an element, each clearing
  both the field error and `serverError`.
- `docs/decisions.md` (Frontend section) — one entry for the conditional deep flag.

**Reason:**
In `FieldFormModal`, `choices` is the only array field, and `shared/validation/field.ts` puts three
messages on `path: ['choices']` ("Add at least one choice", "Choices must be unique", "Choice
cannot be empty"). Fixing a duplicate choice leaves the error text on screen; `serverError` persists
for the same reason. The only way to clear either is to touch an unrelated field or resubmit.

**Verification:**
New unit cases pass. Manually: create a SELECT field with two identical choices, submit, rename one
— the error must disappear on the keystroke.

---

### P2 — `FieldFormModal`'s two fetches state their condition

**Status:** done, with changes — 2026-08-23. The plan's preferred `loadOptions` route does not work:
`useSelectOptions` only calls the loader for a **typed term** (`runOptionsRequest` returns early on
`''`, and its watcher is not `immediate`), so a loader can never seed a list. The fallback was taken
instead, improved: each select derives a four-way `empty-label` from its own status, and a failure
also renders a message plus Retry **beside** the control rather than inside a panel the user would
have to open to find it — the shape `AppSidebar` already uses when this same list fails there.

**Goal:**
Neither relation select claims the user has no tables / no fields when the request is in flight or
has failed. No unhandled rejections.

**Changes:**

Two async surfaces currently have no `catch`, no loading state and no failure state:

1. `onMounted(() => tablesStore.fetchTables())` — on failure the "Links to table" select renders
   `empty-label="No other tables yet"`. It also shows that copy for the whole in-flight window, and
   refetches the full table list (with `_count` aggregates) on **every** dialog open, including for
   TEXT/BOOLEAN fields where `targetOptions` is never rendered.
2. `watch(() => form.targetTableId, async (id) => { … await fieldsApi.list(id) … })` — on failure
   "Show which field" reads "That table has no fields to label by", and the form cannot be submitted
   (the schema requires `labelFieldKey`) with nothing on screen explaining why.

Both rejections currently reach the `unhandledrejection` listener in
`app/plugins/error-report.client.ts` and are shipped to `/api/client-errors`.

**Preferred approach — route both through `BaseSelect`'s `loadOptions`.**
`app/components/common/BaseSelect/useSelectOptions.ts` already models exactly this lifecycle
(`idle | loading | ready | failed`) and `BaseSelect` already renders the status row with a working
Retry. Converting `targetOptions` and `labelOptions` to loaders gets loading, empty and failure copy
for free, and removes the `onMounted` fetch — options then load when the panel opens, and only for
RELATION.

**Fallback if the loader route proves wrong:** wrap both in `try`/`catch`, hold a `failed` ref per
fetch, and swap `emptyLabel` for failure copy plus a retry control. More code, and it reimplements
what `useSelectOptions` does.

Either way: gate the tables fetch on `form.type === 'RELATION'`.

**Files / areas:**

- `app/components/modals/FieldFormModal.vue`
- `app/components/modals/FieldFormModal.nuxt.spec.ts` — add cases for the failed and in-flight
  states of both selects.
- `docs/architecture.md` §11 — add a browser-checklist line only if a state is added that a spec
  cannot see; otherwise leave it.

**Reason:**
`CLAUDE.md` §7: _"Every async surface states its condition. Loading, empty, and error are distinct
states with distinct copy — never infer 'empty' from 'unknown'."_ Both surfaces infer empty from
unknown, and one of them makes a false claim about the user's own data.

**Verification:**
Component specs for both failure paths. Manually, with the server stopped: opening the field dialog
on a RELATION field must show a failure message and a working Retry in each select, never "No other
tables yet" / "That table has no fields to label by". Opening the dialog for a TEXT field must issue
no table-list request.

**Dependencies / considerations:**
`docs/decisions.md` → _"`FieldFormModal` fetches the target's fields outside the fields store"_ still
holds and must not be undone — the target's fields stay out of `useFieldsStore` whichever approach
is taken. `decisions.md` → _"`searchable` is an explicit prop, and the threshold lives at the call
site"_ explains why both selects hardcode `searchable`; keep that.

---

### P3 — Documentation drift

**Status:** done, with changes — 2026-08-23. Item 1 was in **two** files, not the one named:
`app/field-types/types.ts` and `app/field-types/cells/MultiValueCell.vue`. Item 2 done as written.
Item 3 was moot, P2 having landed. Three passages beyond the plan were also corrected, each a
statement that was already false: the `FieldFormModal` spec's header still said the table list is
refreshed "on mount" (drift P2 introduced), and `CLAUDE.md` §7 credited `useForm` with a `reset`
member it has never returned — no call site uses one.

**Goal:**
Three stale passages corrected, so a grep for a named symbol finds it and a contract list is
complete.

**Changes:**

1. `app/field-types/types.ts` — `IMultiValueCellProps`'s TSDoc says _"`toCellValueList` normalises
   at the seam"_. The function is `toValueList` (`app/utils/record-value.ts`). Rename in the prose.
2. `docs/architecture.md` §3 — the `IAppFieldType<K>` key list reads `input`, `multiInput`,
   `filter`, `multiFilter`, `cell`, `icon`, `configSummary`, omitting `summary` and `multiSummary`.
   Add the two. (`CLAUDE.md` §9's table is already correct; do not duplicate it here, just complete
   the list.)
3. If **P2 is deferred rather than done**, add an entry to `docs/limitations.md` recording that the
   two `FieldFormModal` fetches state no condition, with the trigger that would reopen it. If P2 is
   done, no entry is needed.

**Files / areas:**
`app/field-types/types.ts`, `docs/architecture.md` §3, `docs/limitations.md` (conditionally).

**Reason:**
`CLAUDE.md` §12: when a change makes a passage wrong, rewrite it. A stale symbol name is the exact
failure mode §12 warns about — nothing fails, the reader is simply sent nowhere.

**Verification:**
`grep -rn "toCellValueList"` returns nothing.

**Dependencies / considerations:**
Item 3 depends on the outcome of P2.

---

### P4 — One helper for the filterable column list

**Status:** done — 2026-08-23. `filterableFields` stayed exported as the underlying rule, with
`filterableColumns` as the composed seam. Three `docs/architecture.md` passages were corrected
alongside; two of them (§10's panel and summary entries) credited `queryColumns` for a list that was
already `filterableFields` over it, so they were wrong before this change too.

**Goal:**
The filter drawer and the filter summary cannot drift on which columns are filterable.

**Changes:**
`RecordsFilterPanel.vue` and `RecordsFilterSummary.vue` each compute
`filterableFields(queryColumns(props.fields))` identically, and each then passes the result to
`withFilterValue`. `RecordsFilterSummary`'s comment ("The same columns the drawer offers") states
the coupling without enforcing it.

Export one helper beside `filterableFields` in `shared/utils/filter.ts`:

```ts
export function filterableColumns(fields: IField[]): IField[] {
  return filterableFields(queryColumns(fields))
}
```

Both components call it.

**Files / areas:**
`shared/utils/filter.ts`, `shared/utils/filter.spec.ts`,
`app/components/records/RecordsFilterPanel.vue`, `app/components/records/RecordsFilterSummary.vue`.

**Reason:**
`CLAUDE.md` §6's second-occurrence DRY trigger. Turns a comment into a function.

**Verification:**
Existing panel and summary specs pass unchanged; add one unit case for the new helper.

---

### P5 — One implementation of scalar-or-list → list

**Status:** done — 2026-08-23, in two passes. First pass folded `RelationFieldSelect` into
`toValueList` and left `BaseSelect`'s copy, reasoning that an atom should not import from a
record-domain module. **P5a superseded that** — the coupling objection was real but the fix was to
give the primitive an honest home, not to keep a second copy. See P5a below for the end state; the
first pass's `docs/decisions.md` entry was replaced rather than added to.

---

### P5a — …and a neutrally-named home for it (follow-up to P5)

**Status:** done — 2026-08-23. `app/utils/record-value.ts` → `app/utils/value-shape.ts`, keeping
`toValueList` and `toCellSingleValue` together (they are documented in three places as a pair).
`BaseSelect` now calls `toValueList` like every other consumer, so there is one implementation.
Verified with the full suite plus `test:e2e` (140 pass), since this changes the selection path of
every select in the app.

**Goal:**
`toValueList`'s claim to be "the one place" a non-array stored value is accounted for is true again.

**Changes:**
Three implementations of the same normalisation (array → itself; `''` → `[]`; string → `[string]`):

- `app/utils/record-value.ts` → `toValueList` — the documented one
- `app/components/common/BaseSelect/BaseSelect.vue` → `selected`
- `app/field-types/relation/RelationFieldSelect.vue` → `linkedIds`

**Do at minimum:** `RelationFieldSelect` calls `toValueList(model.value)`. It is already record-domain
code, so there is no layering objection.

**Decide deliberately for `BaseSelect`:** it is a generic atom in `components/common/`, and importing
`~/utils/record-value` (a record-shaped name) into it is a layering smell. Two acceptable outcomes,
and either must be taken explicitly:

- move the primitive to a neutral module (e.g. `app/utils/value-list.ts`) that `record-value.ts`
  re-exports or imports, and have `BaseSelect` use that; **or**
- keep `BaseSelect`'s own copy, record why in `docs/decisions.md` (Components section), and **fix
  `toValueList`'s TSDoc** so it no longer claims exclusivity it does not have.

**Files / areas:**
`app/field-types/relation/RelationFieldSelect.vue`, `app/utils/record-value.ts`,
`app/components/common/BaseSelect/BaseSelect.vue`, `docs/decisions.md`.

**Reason:**
The TSDoc on `toValueList` is currently false, which costs more than the lines saved — the next
reader will believe it.

**Verification:**
`RelationFieldSelect.nuxt.spec.ts` and the four `BaseSelect` spec files pass unchanged.

**Dependencies / considerations:**
The `BaseSelect` half is a **decision to take, not a foregone conclusion.** Do not silently pick one.

---

### P6 — `useFieldControls` for the two metadata-driven renderers

**Goal:**
One home for "resolve a field's control, apply its adapters both ways".

**Changes:**
`app/components/records/DynamicForm.vue` and `app/components/records/RecordsFilterPanel.vue` repeat
the same six moves in the same order: map fields → destructure
`{ component, props: propsFor, toControl, fromControl }` → call `propsFor(field)` once → a local
`TXControl` type → a `controlValue()` → an `applyValue()`/`filterValue()`. Their templates are
near-identical `<component :is>` loops.

The only real difference is that a record control's adapters are `Required` (`TRecordFieldControl`)
while a filter's are optional — expressible with identity defaults:

```ts
// app/composables/useFieldControls.ts
export function useFieldControls(
  fields: () => IField[],
  resolve: (field: IField) => IFieldControl<TFilterValue>,
) { … }
```

Callers become `useFieldControls(() => props.fields, inputFor)` and
`useFieldControls(() => columns.value, filterFor)`. The identity defaults collapse
`RecordsFilterPanel`'s two `control.toControl ? … : …` branches; `DynamicForm` keeps compiling
because its adapters are always present.

Keep the templates in their own components — only the setup logic moves.

**Files / areas:**
new `app/composables/useFieldControls.ts` + its spec, `app/components/records/DynamicForm.vue`,
`app/components/records/RecordsFilterPanel.vue`.

**Reason:**
`CLAUDE.md` §6's second-occurrence trigger, and the "resolve `props(field)` once, not per render"
performance property currently lives in two places.

**Verification:**
`DynamicForm.nuxt.spec.ts` and `RecordsFilterPanel.nuxt.spec.ts` pass unchanged — the contracts they
pin (values flow down as props, the parent's `useForm` object is never mutated, the drawer rebuilds
in field order) are exactly what must survive.

**Dependencies / considerations:**
`docs/decisions.md` → _"`useListboxNavigation` was extracted for SRP, not DRY"_ records a preference
against extracting at one consumer. This is **two** consumers with an identical shape, so §6 governs
rather than that entry — but confirm that reading before starting. If it is rejected, still unify
`RecordsFilterPanel`'s two identity-adapter branches.

---

### P7 — Store guards and one dependency move

**Goal:**
Two singleton stores state their own per-table invariants instead of relying on a sibling's render
order; one dev-only package leaves `dependencies`.

**Changes:**

1. **`app/stores/fields.ts` has no `loadedTableId` guard**, unlike `app/stores/records.ts`. Between
   navigating to table B and its fetch landing, `fields` holds table A's fields. The records page
   survives only because its template checks `rowsLoading` **ahead** of `hasFields` — a real
   invariant currently held by template ordering in one file. Add the same guard the records store
   uses so the invariant lives in the store.
2. **`app/stores/relations.ts` never clears.** `optionsByField`, `linkedByField` and
   `tableIdByField` grow for the session with no per-table guard, where the records store has an
   explicit one. Not a bug (field ids are cuids, and stale labels are an accepted limitation), but
   an inconsistency between two stores solving the same problem. Either add the guard, or write one
   sentence in the store explaining why unbounded merge-only caching is correct here — a plausible
   reason is that `RecordFieldValue` must still resolve a label for a record it can no longer fetch.
   **Take one of the two explicitly.**
3. **`@nuxt/eslint` is in `dependencies`.** It is a lint-only Nuxt module that nothing imports at
   runtime. `docs/decisions.md` documents why each unusual direct dependency is declared, which is
   what makes this one read as an oversight. Move it to `devDependencies`.

**Files / areas:**
`app/stores/fields.ts` (+ spec), `app/stores/relations.ts` (+ spec), `package.json`,
`package-lock.json`, possibly `docs/decisions.md` for item 2.

**Reason:**
Consistency between stores that face the same singleton-across-tables problem, and dependency
hygiene.

**Verification:**
`npm run build` passes after the dependency move (proves nothing at runtime imported it). Store specs
cover the new guard: fetching for a different table clears the previous table's state.

**Dependencies / considerations:**
Item 2 is a **decision to take, not a foregone conclusion.**

---

## Deferred / Optional

Identified, not scheduled. Each needs a judgement call that was not settled during the review.

- **`useEntityFormModal` composable.** The create-or-edit dialog state machine —
  `type TXModal = { mode: 'create' } | { mode: 'edit'; x: X }`, `openCreateX`, `openEditX`, a
  branching `submitX`, and `@saved`/`@close` both nulling the ref — is written three times
  (`app/pages/index.vue`, `app/pages/tables/[tableId]/settings.vue`,
  `app/pages/tables/[tableId]/index.vue`; the settings page carries it twice). §6's trigger has
  fired. It would remove ~15 lines per page and make "close on saved and on close" one decision
  instead of five. **Blocked on:** confirming that `docs/decisions.md` → _"The records page is not
  split further"_ does not cover it. That entry rejects splitting the page into **components** on
  the grounds that each seam trades markup for plumbing; a composable carries no markup and no
  props, so it reads as a different trade — but this was not settled.
- **`optionValuesKey(options)` helper.** `JSON.stringify(options.map(o => o.value))` is used as a
  watch key in `BaseSelect.vue` and `useListboxNavigation.ts`. Both uses are load-bearing and
  commented, but both build a throwaway JSON string per dependency tick.
  `options.map(o => o.value).join('�')` in a shared module inside `BaseSelect/` (already the
  home for component-private modules, `CLAUDE.md` §7) is cheaper and names the intent.
- **Bound `BaseSelect`'s `seen` map.** It accumulates every option ever rendered for the component's
  lifetime and rebuilds the whole `Map` on each change — unbounded for a relation picker in a filter
  drawer that stays mounted across many searches. Its purpose only needs the currently **selected**
  values plus the current list. Latent, not observed.
- **`toPageError` and 5xx.** `app/utils/api-error.ts` maps every non-404 to "That web address could
  not be read." Correct for the 400 case its TSDoc describes, but the records page also wraps
  `recordsStore.fetchRecords` in `useAsyncData`, so a 500 renders as a claim about the URL. A
  `statusCode >= 500` branch with generic copy would close it. Arguably below the bar.

---

## Rejected

Considered during the review and ruled out. Do not reconsider without a new reason.

- **Splitting `BaseSelect.vue`** (1037 lines). Already rejected in `docs/decisions.md` with the right
  argument, the setup block is sectioned, and the two genuinely separable pieces
  (`useSelectOptions`, `useListboxNavigation`) are already out.
- **Splitting the records page into components.** Rejected in `docs/decisions.md`; every candidate
  seam trades markup for plumbing.
- **Retiring the records store in favour of `useAsyncData`.** Rejected in `docs/decisions.md` on the
  numbers; most of what the store holds is paging arithmetic and write orchestration, and
  `useAsyncData` discards data on error.
- **Feature folders, a repository layer, hexagonal/DDD on the server, splitting `shared/` by
  domain.** All four are in `docs/decisions.md` → _Decided against, structurally_.
- **Making the flat field-type registries (`FIELD_INPUTS`, `FIELD_FILTERS`, `FILTER_SUMMARIES`)
  private** to match the `MULTI_*` tables. They are exported because the spec files assert on them
  directly; that is a legitimate consumer.
- **Merging `cellComponent` back into `registry.ts`.** It would create a cycle with
  `MultiValueCell`; the reason is recorded in `docs/decisions.md`.

---

## Final Verification

Run in order, after each task and once at the end (`CLAUDE.md` §2):

- [ ] `npm run format`
- [ ] `npx eslint .` passes
- [ ] `npm run build` passes (this is the only step exercising Vite/Nitro bundling, and the only
      proof that nothing imported `@nuxt/eslint` at runtime)
- [ ] `npm run test` passes, with new or updated specs covering: the `useForm` array-field case (P1),
      both `FieldFormModal` failure states (P2), `filterableColumns` (P4), `useFieldControls` (P6),
      and the store guards (P7)
- [ ] `npm run test:e2e` passes — P2 touches two selects inside a dialog, so the axe and target-size
      gates apply
- [ ] Keyboard walk over the field dialog: both relation selects reachable, Retry reachable from the
      keyboard in the failure state, focus ring visible (P2 only; still a manual step)
- [ ] Verified in the running dev server: create and edit a SELECT field with duplicate choices (P1),
      and a RELATION field with the API unreachable (P2)
- [ ] `grep -rn "toCellValueList"` returns nothing (P3)
- [ ] Every task above carries a `**Status:**` line stating what actually happened
- [ ] Work left uncommitted; a Conventional Commit message suggested rather than made
