# Roadmap

The source of truth for what is being built next. Statuses: `[ ]` not started · `[~]` in progress · `[x]` done.

This file says only _what_ and _in what order_ — contracts belong in `docs/architecture.md`, rationale in `docs/decisions.md`, rules in `CLAUDE.md` §2.

---

## Current phase — architectural restructuring

Every item below comes from `docs/architecture-review.md`, which carries the problem, the shape,
the affected modules, the risks and the gate for each. An item that lands keeps its line here and
loses its entry there; an item that is rejected leaves both.

### First pass — structural, no behaviour change (done)

- [x] **P1** — Name the server's three layers: `api/` → `services/` → `db/`, ending the
      `utils → services` edge and re-shelving `record-query.ts` as SQL rather than as a service.
- [x] **P2** — Ownership-bound handler factories, so a table-scoped request cannot reach its data
      without having proven ownership of it.
- [x] **P7** — Component-private composables move next to their component (`BaseSelect/`).
- [x] **P6** — Record and field counts are returned by the server instead of computed on the client;
      `adjustCachedCount` goes.
- [x] **P3** — A declared client↔server contract and one API client module per resource; stores and
      components stop holding URLs and asserting response shapes.

### Discovered

- [x] **Every write handler is now driven through its own success path.** `fields/[fieldId].patch`
      and `records/[recordId].patch` were reached only as a stranger or anonymously, so a handler
      passing the wrong id to its service would not have been caught. Each new case asserts the
      named row changed **and that a sibling did not**, which is the half that fails on a mis-wired
      param. `server/api/fields.integration.spec.ts` is new — the field endpoints had no
      handler-layer home.

### Second pass — everything left is gated

Each open item names the trigger that would start it. P8 is the only one whose gate has opened —
and its own entry argued against taking it, so the next phase is a decision rather than a backlog.

- [x] **P9** — `server/db/` stops speaking HTTP: it classifies a Prisma fault, `utils/http-errors.ts`
      maps it, and a lint rule holds the boundary. **Shape changed on inspection** — the central
      status-code file variant (b) proposed was rejected, since most messages are the rule itself;
      `CLAUDE.md` §3's "framework-agnostic" claim was corrected rather than made true.
- [x] **P10** — Client errors reported through the server's sink, under the same redaction
      contract. No sink port: one shared write path, since there is one destination.
- [x] **P4** — A field type is a module per slice instead of thirteen scattered registry entries;
      the registries assemble rather than declare. **Shape changed on inspection** — the SQL slice
      landed in `server/db/field-types/`, not a top-level `server/field-types/`, since `db/` is the
      only place `Prisma.Sql` may live.
      Its gate ("when the next field type is scheduled") was lifted by decision, not met.
- [~] **P5** — **Rejected on inspection, not deferred.** Of the 25 behaviours the records store's
  spec pins, ~7 are the cache `useAsyncData` would replace; the rest are paging and write
  orchestration that would only relocate. `useAsyncData` also discards data on error, so keeping
  the rows under a failure banner needs back the state the change would remove. Reasoning in
  `docs/decisions.md`; do not re-derive it.
- [ ] **P8** — Feature folders for the frontend. _Gate: P4 has landed, so this one is open — take it at a fourth domain, or when the three that exist stop being legible._
- [ ] **P11** — Index strategy for the JSONB ceiling. _Gate: first table over ~100k records, or the
      first report of a slow filtered view._

---

## Parked

Listed with the trigger that would unpark them, so the decision is not re-taken by accident.

- **Row actions are three inline icons where the concept draws one `⋯` menu.** The blocker is gone —
  `usePopover` + `useAnchoredPosition` anchor correctly inside a clipping container. What remains is
  that three targets still fit, so the menu would be work with no user-visible gain. **Unpark at a
  fourth row action.**
