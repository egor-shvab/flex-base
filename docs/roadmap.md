# Roadmap

The source of truth for what is being built next. Statuses: `[ ]` not started · `[~]` in progress · `[x]` done.

Keep this file current — see `CLAUDE.md` §2 for the rules that govern it. Rationale belongs in `docs/decisions.md`, contracts in `docs/architecture.md`; this file says only _what_ and _in what order_.

---

## Current phase — the Open limitations

The testing phase is finished: four suites, every layer gated, and the accessibility promise machine-checked. What is left is the register `CLAUDE.md` §1 points at — the **Open** entries in `docs/decisions.md`, which are in scope by definition.

There were eight; **five are left**. Each row there already carries its own diagnosis, so this phase is mostly execution; the stages are ordered by how much is still undecided. Read the row before starting the item — the "why it stands" column is the specification.

### Stage 1 — Three fixes whose answer is already known ✅

Independent, small, and none needed a decision first.

- [x] **The colour popover never flips above its trigger.** `BaseColorPicker` now takes `useAnchoredPosition` and states its own `maxHeight`; it still renders in place rather than teleporting.
- [x] **`npm run preview` cannot start on Windows.** One launcher, `scripts/serve-output.mjs`, with `scripts/preview.mjs` loading `.env` in front of it. `test/e2e/setup/serve.mjs` is gone and Playwright starts the shared one.
- [x] **`_count.records` drifts between Home visits.** `tables.ts` owns `bumpCount`; the records and fields stores are its only callers. The dashboard's unconditional refetch went with it, and `_count.fields` was fixed alongside so removing it was safe.

### Stage 2 — The two accessibility gaps in `BaseSelect`

Same component, and the fixes are likely to touch the same code, so they go together.

- [ ] **`Retry` in the dropdown is pointer-only** — it lives in the teleported panel, and `Tab` dismisses the panel before focus reaches it. Needs `Tab` to move _within_ the panel first, or a roving tabindex across it. Not a dead control today (editing the term re-issues the search), but the button itself is unreachable.
- [ ] **The panel's `role="status"` mounts together with its first message**, so "Searching…" and "No options" are probably never announced — a live region inserted in the same frame as its content is not reliably read. Needs a region that outlives the panel.

Both are invisible to Stage D's axe gate, which is why they are still here: axe checks that a name and a role exist, not that focus can reach the control or that an announcement lands.

### Stage 3 — Reading a value the table truncates

Two rows of the register share one fix: a truncated cell offers no way to see the whole value, and a multi-value cell shows one line so later values are cut off.

- [ ] **Settle the approach before writing anything.** The register rejects the obvious route — a text projection per field type — because it would be a fifth registry against the "only cells are components" contract in `CLAUDE.md` §9. The alternative worth pricing first is to make the existing escape hatch _discoverable_: the record dialog already shows every value in full and wrapped, so an affordance on a truncated cell may close both rows without a new registry. Record the decision in `docs/decisions.md`.
- [ ] **Apply it to both rows**, or narrow them if the chosen fix only serves one.

### Stage 4 — Dependency vulnerabilities

- [ ] **`npm audit` reports 17** (1 critical, 11 high) across `nuxt`, `prisma`, `sharp`, `undici` and their transitive deps — none from anything this project imports directly. Last checked while adding `@axe-core/playwright`. Kept out of the stages above because a fix means version bumps that can move the build and the generated Prisma client, so it wants its own full-suite verification rather than riding along with a UI change.

---

## Parked

Listed with the trigger that would unpark them, so the decision is not re-taken by accident.

- **Row actions are three inline icons where the concept draws one `⋯` menu.** The blocker is gone — `usePopover` + `useAnchoredPosition` anchor correctly inside a clipping container. What remains is that three 36×36 targets still fit, so the menu would be work with no user-visible gain. **Unpark at a fourth row action.**

## Decided against

Recorded so they are not re-litigated. Move one up only with a reason that has changed.

- **Parallel e2e / integration.** Both serialize on one database; at 1.7m and 12s the saving does not pay for per-worker provisioning.
- **A hard coverage threshold.** Specs here are written to pin behaviour, not to move a number, and a gate invites the opposite. Revisit only if coverage drifts down over months — the merged report is what makes that visible.
- **More browsers.** The suite is about this app's behaviour, not browser differences.
- **Mutation testing, component snapshots, visual regression.** No evidence any would catch something the current suite misses, and each adds a maintenance surface.
- **A mobile Playwright project.** `test.use({ viewport })` in `mobile-shell.spec.ts` gives the same coverage; a project would either duplicate the desktop suite at 375px or select that one file.

---

## Done

- [x] **The feature set** — auth, per-user isolation, custom tables and typed fields, record CRUD, generated forms and tables, filtering, sorting, search, relations, record columns.
- [x] **The test suite** — four projects (`unit`, `nuxt`, `integration`, `e2e`), 1392 tests, each layer gated by its own CI job.
- [x] **The test-suite audit and its six stages** — the gates that did not run, the checklist that overstated, the surfaces nothing covered, the WCAG 2.2 AA gate, the duplicated cases removed, and the suite's shape. Coverage is one merged, honest report at 98.8%.

Detail lives where it belongs: contracts in `docs/architecture.md`, rationale and the limitations register in `docs/decisions.md`, and the rest in git history.
