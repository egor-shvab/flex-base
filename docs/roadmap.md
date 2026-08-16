# Roadmap

The source of truth for what is being built next. Statuses: `[ ]` not started · `[~]` in progress · `[x]` done.

This file says only _what_ and _in what order_ — contracts belong in `docs/architecture.md`, rationale in `docs/decisions.md`, rules in `CLAUDE.md` §2.

---

## Current phase — refactoring & cleanup

A full-codebase audit turned into ordered work: no new features, and no behaviour change except
where a task says so. **Why each task exists, the files it touches and its risk are in
`docs/refactor-plan.md`** — read the task's entry there before starting it. That file is deleted when
this phase closes.

Phases run in order; tasks within one are independent unless the plan says otherwise.

### Phase 1 — Debris and stale documentation

- [x] 1.1 Remove the stray `+` at the top of `BaseCheckbox.vue`
- [x] 1.2 Correct `CLAUDE.md` §2's account of `typecheck` and `build`
- [x] 1.3 Reconcile `architecture.md` §2 and §11 with the modules they describe
- [x] 1.4 Guard the shell's Escape listener while a dialog is open, and correct the three documents claiming `BaseModal` held the only one
- [x] 1.5 Drop the stale type-scale comment in `_variables.scss`
- [x] 1.6 Remove `@nuxt/image`, which nothing uses
- [x] 1.7 Move `eslint` out of `dependencies`
- [x] 1.8 Route `docs/refactor-plan.md` from `CLAUDE.md`

### Phase 2 — Single-source constants and shared helpers

- [x] 2.1 One debounce constant, replacing three declarations and a default
- [x] 2.2 One scalar→list normaliser, replacing `toList` and `toCellValueList`
- [x] 2.3 One route-param reader for the 13 API handlers
- [x] 2.4 One filter-map rebuild, shared by the filter drawer and the summary
- [x] 2.5 Deduplicate the four registry `props(field)` factories
- [x] 2.6 One "N matching records" phrase — the duplicated "Delete table" dialog body was left alone, being markup rather than a string

### Phase 3 — Duplication in the render layer

- [ ] 3.1 Collapse `RelationFieldSelect`'s duplicated template
- [ ] 3.2 Resolve each field's control once per render, not three times
- [ ] 3.3 One server-error banner, replacing five hand-written copies
- [ ] 3.4 Two duplicated SCSS blocks: the centred card, and the sidebar item

### Phase 4 — Module boundaries

- [ ] 4.1 Move `app/utils/record-cells.ts` into `app/field-types/`
- [ ] 4.2 Move `RECORD_NUMBER_FIELD` out of shipped code into `test/fixtures.ts`

### Phase 5 — Page decomposition

- [ ] 5.1 Extract the shared table-page bootstrap into `useTablePage`
- [ ] 5.2 Extract the field list from `settings.vue`
- [ ] 5.3 Reassess `pages/tables/[tableId]/index.vue` once 5.1 has landed

### Phase 6 — Deferred, and final validation

- [ ] 6.1 `BaseSelect.vue`: evaluated and **deferred** — do not split on line count alone
- [ ] 6.2 `BaseSelect`'s `seen` map: recorded as a watch item, not scheduled
- [ ] 6.3 Final pass — reconcile the docs, run every suite, delete `docs/refactor-plan.md`

---

## Parked

Listed with the trigger that would unpark them, so the decision is not re-taken by accident.

- **Row actions are three inline icons where the concept draws one `⋯` menu.** The blocker is gone —
  `usePopover` + `useAnchoredPosition` anchor correctly inside a clipping container. What remains is
  that three targets still fit, so the menu would be work with no user-visible gain. **Unpark at a
  fourth row action.**
