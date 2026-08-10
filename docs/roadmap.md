# Roadmap

The source of truth for what is being built next. Statuses: `[ ]` not started · `[~]` in progress · `[x]` done.

Keep this file current — see `CLAUDE.md` §2 for the rules that govern it. Rationale belongs in `docs/decisions.md`, contracts in `docs/architecture.md`; this file says only _what_ and _in what order_.

---

## Current phase — test-suite hardening

The four suites exist and all four are green: **1071** tests in `unit` + `nuxt` (9s), **137** in `integration` (12s), **100** in `e2e` (1.5m) — 1308 in total, 14.7k lines of spec over 10.3k lines of source, 90% lines covered in the measured scope. The pyramid is the right shape (82 / 11 / 8) and the specs read well: each one names a behaviour, most carry the reason the behaviour is load-bearing, and the four-project split is documented and obeyed.

What this phase fixes is narrower and mostly not about writing more tests. Three things came out of the audit:

1. **Two gates do not actually run.** Playwright specs are outside `npm run typecheck`, and the coverage report calls twenty exercised files 0%.
2. **The docs claim more than the suite keeps.** `docs/architecture.md` §12 says every line is automated; several are not.
3. **A few surfaces a user can reach are tested nowhere** — the error boundary among them.

Stages run in order of value per hour, not by layer. Stage A is an afternoon and removes two blind spots; Stage F is optional polish.

### Stage A — Close the gates that silently do not run

**Done — three gates that did not run now do, and the coverage report stopped lying.**

- [x] **`test/e2e/**` was never type-checked.** No Nuxt-generated project claims it and Playwright transpiles without checking, so ~1.8k lines of spec sat outside the type gate. `typecheck` is now `nuxt typecheck && tsc -p test/e2e/tsconfig.json` — a separate invocation rather than a root reference, because `nuxt typecheck` runs `vue-tsc -b` and the e2e project's two shared helpers already belong to the server project. Verified by breaking a type and watching it fail.
- [x] **Coverage reported twenty exercised files as 0%.** `server/api/**` and `server/middleware/**` are now merged in from the `integration` run via blob reports (`coverage:collect`), with the scope shared through `vitest.coverage.config.ts`. **90.12% → 98.34% statements, 89.51% → 98.31% lines** — the same suite, honestly measured.
- [x] **CI never produced a coverage report.** The integration job now runs `coverage:collect` and uploads `coverage/` as an artefact. Still no threshold gate — see Stage G.
- [x] **CI's integration and e2e jobs would have aborted before running a test.** Both invoked npm scripts beginning with `db:up`, which binds host port 5432 — already held by the job's own PostgreSQL service container. Found while wiring the coverage job; this `ci.yml` has never landed on `main`/`develop`, so it had never been exercised. CI now calls `vitest`/`playwright`/`coverage:collect` directly, which is the shape `CLAUDE.md` §10 always described.

### Stage B — Make `docs/architecture.md` §12 true again

**Done — five gaps closed, three clauses re-pointed, and §12 no longer claims more than the suite keeps.** Every new case was verified by breaking the thing it guards and watching it go red.

- [x] **The `::date` cast** — a same-day `Created at` range now executes against PostgreSQL in `record-query.integration.spec.ts`, not just as SQL _text_. `test/integration/seed.ts`'s `createRecord` gained optional `createdAt`/`updatedAt`, settable only on create because `@updatedAt` overwrites on every update. Rows are timestamped at **midday** so `::date` reads as the same calendar day whatever offset the driver applies.
- [x] **Search must not match a multi SELECT's JSONB punctuation.** Three probes — `["`, `", "`, `"]`. The mutation check earned its keep here: the obvious `","` probe passes even against a broken projection, because **jsonb normalises its text output** to `["renewal", "urgent"]` with a space after the comma. Recorded in §12 so the next person does not write the vacuous version.
- [x] **Search must not match a RELATION column**, by its label or by its stored id — with the positive half beside it, or the case would pass against a table nothing could find.
- [x] **A panel stays pinned while the filter drawer scrolls.** Asserted as a delta: the panel must move by exactly what its trigger moved. Without the capture-phase scroll listener the trigger travels 485px and the panel travels 0.
- [x] **A multi-value field is one line in the table and wrapped in the dialog** — both surfaces in one case, since either alone would pass against a component that wrapped, or truncated, everywhere.
- [x] Re-pointed the clauses the browser does not own. §12 badges them _(integration)_ and its preamble says what the badge means; `CLAUDE.md` §10 lists the three new behaviours.

### Stage C — Surfaces nothing tests

**Done — nine items, including the one production fix the stage carried.** No module or user-visible surface is now untested, and the last two endpoint gaps are closed.

- [x] **A refused delete says why.** `useDeleteConfirm` catches instead of re-throwing and exposes the server's message; `ConfirmModal` renders it; all three delete flows gained it from one change. Closes the Open limitation in `docs/decisions.md`, which now carries the reversal and why it is the opposite call from `fetchRecords`. Driven in the running app: deleting a targeted table shows _"Services" in "Masters" links to this table_, the table survives, and the unhandled promise rejection is gone.
- [x] **`app/error.vue` and the page-level 404** — a new `error-page.spec.ts`, including the branch that must **not** blame the table: a malformed `?sort=` is a 400 that says the address could not be read, where the old copy claimed a table that had just loaded did not exist.
- [x] **The records page's failure banner** — in `list-query.spec.ts`, cutting the route _after_ the SSR load, since `failed` is set by a client-side refetch. Both the banner and its recovery link.
- [x] **`FieldFormModal`** — 12 cases over the choices editor, the multi-value lock, the type lock and the relation label picker. Mutation-checked: a shallow spread instead of the deep copy lets an edit rename the store's own metadata, and the spec catches it.
- [x] **`RelationFieldSelect`** — 12 cases. Mutation-checked on the load-bearing one: dropping the `unlisted` branch fails exactly the three cases that guard a link being silently discarded on save.
- [x] **`RecordDetail` and `RecordDetailModal`** — the column set the dialog shares with `DynamicTable`, and the modal's four states plus the one link that leaves the page.
- [x] **The off-canvas sidebar** — a new `mobile-shell.spec.ts` at 375×812, pinning that nothing inside is reachable while closed. `test.use` scopes the viewport to that file, so Stage D's project is still free to absorb it.
- [x] **The two multi-value 400s**, now proven at the endpoint rather than only at the schema — and the cap itself is accepted, so an off-by-one floor cannot pass.
- [x] **`server/api/tables/index.post`** — the fifteenth endpoint, in the 401 loop and in a new `server/api/tables.integration.spec.ts` covering ownership, the 409 and both name bounds.

### Stage D — The non-functional gates the rules already demand

`CLAUDE.md` step 5 of the definition of done is a manual checklist today. It should be a gate for the paths that matter.

- [ ] **Automated accessibility smoke.** `@axe-core/playwright` over five screens (dashboard, table settings, records list, record form dialog, filter drawer). Serious/critical violations fail; nothing else. This is the cheapest possible version and it catches the regressions a human walk misses.
- [ ] **Target size.** Nothing asserts the 24×24 floor or the 36px house floor. One helper that measures every interactive element on those same five screens, with the filter-summary chip's remove button as the documented exception.
- [ ] **A mobile viewport project in `playwright.config.ts`.** The `below-shell` breakpoint (900px) governs a whole layout mode that no test has ever rendered. A handful of cases, not a mirror of the desktop suite.

### Stage E — Trim what is paid for twice

Removal, not addition. Roughly 10 e2e cases and a minute of nobody's time, but the reason to do it is that a redundant slow test teaches the wrong lesson about where a case belongs.

- [ ] **`select-keyboard.spec.ts`, the non-searchable group.** Eight cases (Enter/Space/↑/↓ opening, opening on the current value, arrow movement, Home/End, type-ahead) restate `BaseSelect.nuxt.spec.ts` almost assertion for assertion. The file's own docblock states the rule they break: "The logic is pinned in happy-dom already." Keep one case proving the highlight is _visibly_ marked, plus the scroll-following, panel-flip and Escape-layering cases, which are genuinely browser-only.
- [ ] **`filters-multi.spec.ts` → "one choice reads as a plain equality instead"** duplicates `filter-summaries.spec.ts`. The wording is unit-covered; the URL and union behaviour is what earns a browser.
- [ ] The two entries already listed under _Optional cleanup_ (registry key-presence tests; the search threshold restated three times) fold into this stage.

### Stage F — Structure and maintainability

- [ ] **A shared mount helper.** ~160 hand-written `wrapper.unmount()` calls across six files, plus `document.body.innerHTML = ''` teardown hacks. One `test/mount.ts` that tracks instances and unmounts in `afterEach` deletes all of it, and removes the failure mode where a forgotten unmount leaks a listener into the next case — the exact bug Stage 3 already found once in `useAnchoredPosition`.
- [ ] **Split `BaseSelect.nuxt.spec.ts`** (924 lines, twice the next largest). Its harness (`select`, `open`, `keydown`, the panel queries) is reusable; the concerns — ARIA, keyboard, searching, status, clearing — are already separate `describe`s and would be separate files with no rewriting.
- [ ] **Hoist the duplicated e2e helpers.** `openRecordForm`, `combo`, `companies`/`expectCompanies` and `idOf` are redefined in three or four spec files each; they belong beside `confirmDeletion` in `test/e2e/setup/`.
- [ ] **Settle the selector policy.** `CLAUDE.md` §10 says roles and accessible names, never `data-testid` — but the suite reaches for `.filter-summary__chip`, `.records-page__empty`, `.pagination__count`, `.base-select__value` and `tbody tr td:nth-child(2)` throughout, which is the same coupling with worse readability and no accessibility payoff. Either give those surfaces real roles and names (a `status` region for the pager count, a list for the chips) or write the exception into §10. Silence is what let it spread.
- [ ] **Tighten three assertions that do not check what their names claim.** `records-crud.spec.ts` → "fails per-field when required and nothing is chosen" asserts only that the dialog is still open; "blocks the form until it is filled, naming the field" never checks the name; `select-combobox.spec.ts` → "stops at empty rather than running away" is documented as an approximation but reads as a proof.
- [ ] **Simplify the request counter** in `record-dialog.spec.ts` → "does not refetch the list behind it": the outer regex over `pathname + url` is dead weight over the inner condition that actually decides.
- [ ] **Replace the 20 ms `setTimeout`** in `useRecordDetail.nuxt.spec.ts` — the suite's only wall-clock wait, and the only place a slow machine can turn a pass into a failure. `vi.waitFor` on the observable it is really waiting for.

### Stage G — Considered and deliberately not doing

Recorded so it is not re-litigated. Move an item up only with a reason that has changed.

- **Parallel e2e / integration.** Both serialize on one database. At 1.5m and 12s the wall-clock saving does not pay for per-worker database provisioning.
- **A hard coverage threshold.** The suite is comprehensive because specs are written to pin behaviour, not to move a number; a gate would invite the opposite. Revisit only if coverage drifts down over several months — which Stage A's report is what makes visible.
- **More browsers.** The suite is about this app's behaviour, not about browser differences.
- **Mutation testing, component snapshots, visual regression.** No evidence any of them would catch something the current suite misses, and each adds a maintenance surface.

### Follow-ups from the testing phase

- [ ] **`npm run preview` is broken on Windows.** The same hoisting bug `test/e2e/setup/serve.mjs` works around; a launcher script would fix the documented command too.

---

## Done

- [x] Vitest set up as two projects (`unit`, `nuxt`), wired into CI.
- [x] `shared/` fully covered — utils, validation, constants.
- [x] The SQL builder covered by asserting on the generated fragments.
- [x] `app/` covered — every composable, store, field-type registry and util, plus the ten components that carry logic.
- [x] Test-coverage audit establishing the stages above.
- [x] Stage 2 — `server/services/` and `server/utils/` covered against a stubbed prisma client. Headline coverage 74% → 89%.
- [x] Stage 3 — the last untested logic under `app/`, and the records page reduced to orchestration. Headline coverage 89% → 90%.
- [x] Stage 4 — an `integration` project against real PostgreSQL: 137 tests over the route handlers, the SQL layer, the widening migration and the record counter, gated by its own CI job.
- [x] Stage 5 — Playwright over the production build: 100 tests automating the §12 checklist, gated by its own CI job. Four suites, 1308 tests, every layer gated.
- [x] Test-architecture audit over the finished suite — established the stages above.
- [x] Stage A — the e2e type gate, one merged coverage report (90% → 98%, the jump being measurement rather than new tests), a coverage artefact in CI, and the `db:up`-versus-service-container collision that would have stopped both database-backed CI jobs.
- [x] Stage B — five behaviours §12 claimed and nothing tested: the `::date` cast, a multi SELECT's JSONB punctuation, RELATION search, the drawer-scroll pin and the detail dialog's wrap. Each verified by mutation; §12 now badges what the browser does not own.
- [x] Stage C — the last untested surfaces: the error boundary, the failure banner, the off-canvas shell, four components and the two remaining endpoint gaps — plus the production fix that makes a refused delete explain itself.

---

## After testing

Not started, not scheduled. Listed so the direction is visible, not as a commitment.

- [ ] Work through the **Open** entries in `docs/decisions.md` → Accepted limitations.
- [ ] Add some form of error reporting — there is no client or server error sink today.
