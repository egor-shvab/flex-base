# Roadmap

The source of truth for what is being built next. Statuses: `[ ]` not started · `[~]` in progress · `[x]` done.

Keep this file current — see `CLAUDE.md` §2 for the rules that govern it. Rationale belongs in `docs/decisions.md`, contracts in `docs/architecture.md`; this file says only _what_ and _in what order_.

---

## Current phase — none scheduled

**Nothing is in progress.** The Open-limitations phase is finished: of the eight **Open** rows in `docs/decisions.md`, five were fixed, two were narrowed to **Accepted** with the reasoning recorded, and the last is the parked `⋯` menu below, which carries its own unpark trigger rather than a stage. `npm audit` reports zero.

The next phase is a decision, not a backlog. The two sections below are what it would be drawn from — and the register itself, if a row's "revisit" condition comes true.

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
- [x] **The test suite** — four projects (`unit`, `nuxt`, `integration`, `e2e`), 1436 tests, each layer gated by its own CI job.
- [x] **The test-suite audit and its six stages** — the gates that did not run, the checklist that overstated, the surfaces nothing covered, the WCAG 2.2 AA gate, the duplicated cases removed, and the suite's shape. Coverage is one merged, honest report at 98.8%.
- [x] **The Open limitations, in four stages** — the colour popover's flip, one launcher for the built output (`npm run preview` works on Windows), `_count` invalidated at the source; `BaseSelect`'s Retry reachable from the keyboard and its status region outliving the panel; a multi-value cell that truncates like every other cell; and the dependency advisories, 17 to zero inside the declared semver ranges.

Detail lives where it belongs: contracts in `docs/architecture.md`, rationale and the limitations register in `docs/decisions.md`, and the rest in git history.
