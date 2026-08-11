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
- [x] **The off-canvas sidebar** — a new `mobile-shell.spec.ts` at 375×812, pinning that nothing inside is reachable while closed. `test.use` scopes the viewport to that file, which Stage D then settled on as the permanent arrangement.
- [x] **The two multi-value 400s**, now proven at the endpoint rather than only at the schema — and the cap itself is accepted, so an off-by-one floor cannot pass.
- [x] **`server/api/tables/index.post`** — the fifteenth endpoint, in the 401 loop and in a new `server/api/tables.integration.spec.ts` covering ownership, the 409 and both name bounds.

### Stage D — The non-functional gates the rules already demand

**Done — the accessibility promise in `CLAUDE.md` §8 is a gate rather than a review item, and it found a real failure on its first run.**

- [x] **Automated accessibility smoke.** `@axe-core/playwright` over the five screens, blocking on `serious`/`critical`. **All five pass clean** — no rule is disabled, and the one that ever has to be belongs in `test/e2e/setup/a11y.ts` with its reason. Proved able to fail: an icon button stripped of its label reports `button-name (critical) × 1`.
- [x] **Target size — and it caught shipping code.** `BaseButton --link` was the only variant with no floor: ~18px tall across nine call sites, with row actions 8px apart, so SC 2.5.8's _Spacing_ exception could not carry them. Fixed on **both axes**, the second of which the gate itself found — "Edit" measured 23×24 once only the height was floored. Reverting the fix turns the gate red with every control named and measured.
- [x] **Mobile coverage without a project.** Decided against a second Playwright project: it would either duplicate the desktop suite at 375px, where most specs assume the desktop layout, or select only the one file that `test.use({ viewport })` already covers. `mobile-shell.spec.ts` grew instead — the records table scrolling inside its own container, a dialog fitting the viewport, and both gates run again at mobile width, where the shell is a different layout with a control the desktop never renders. **Do not re-add the project without a reason these three cases cannot meet.**

### Stage E — Trim what is paid for twice

**Done — 12 cases removed, none of them covering anything.** Every deletion was checked against the named case that covers it at a cheaper layer, and what stayed was checked for the opposite: that it fails where the cheaper layer cannot.

- [x] **`select-keyboard.spec.ts`, the non-searchable group** — eight cases down to one. All eight had a counterpart in `BaseSelect.nuxt.spec.ts`, run and confirmed passing before deleting. The survivor asserts the cursor's **computed outline**, not its class: removing the `--active` outline rule turns it red while all 71 component cases stay green, which is the proof it was not duplicated.
- [x] **`filters-multi.spec.ts` → "one choice reads as a plain equality instead"** — the wording matrix belongs to `filter-summaries.spec.ts`; one chip case is enough to prove the summary reaches the page.
- [x] **The three registry key-presence tests** — compile-enforced, verified by deleting a key and watching `TS2741`. A test that cannot fail reads as coverage.
- [x] **The search threshold, restated three times** — the two registry specs now assert agreement with `shouldSearch` (still fails a hardcode; survives the number moving), and the e2e docblock no longer names it. `app/utils/select.spec.ts` owns the boundary alone.
- [x] `docs/architecture.md` §12 gained a second badge, _(unit)_, for the clauses that moved down — the same treatment Stage B gave _(integration)_.

### Stage F — Structure and maintainability

- [ ] **A fresh clone fails `npm run format:check` on Windows.** There is no `.gitattributes` and `core.autocrlf` is `true`, so git rewrites the LF-committed files to CRLF on checkout, while Prettier's `endOfLine` defaults to `lf` and flags every one of them. CI never sees it — Linux checks out LF — so the first thing a Windows contributor meets is a red format gate on code they have not touched, and every file they _do_ touch reports a phantom modification with an empty diff. A committed `.gitattributes` (`* text=auto eol=lf`) fixes both. Found in Stage E, when a file restored by `git checkout` started failing a check it had passed minutes earlier.
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
- [x] Stage D — the WCAG 2.2 AA promise turned into a gate: axe over seven screens and a 24×24 target floor, both proved able to fail, and the `BaseButton --link` variant that had been below the floor all along.
- [x] Stage E — 12 duplicated cases removed (1120 → 1117 unit+nuxt, 131 → 123 e2e), each checked against the case that already covered it, and the one survivor checked for the opposite.

---

## After testing

Not started, not scheduled. Listed so the direction is visible, not as a commitment.

- [ ] Work through the **Open** entries in `docs/decisions.md` → Accepted limitations.
- [ ] Add some form of error reporting — there is no client or server error sink today.
