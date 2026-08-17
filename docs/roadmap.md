# Roadmap

The source of truth for what is being built next. Statuses: `[ ]` not started · `[~]` in progress · `[x]` done.

This file says only _what_ and _in what order_ — contracts belong in `docs/architecture.md`, rationale in `docs/decisions.md`, rules in `CLAUDE.md` §2.

---

## Current phase — architectural restructuring (proposed, not approved)

Every item below is a proposal from `docs/architecture-review.md`, which carries the problem, the
shape, the affected modules, the risks and the gate for each. **Nothing here is approved yet**; the
order is the recommended one, not a commitment. An item that is accepted keeps its line here and
loses its entry there; an item that is rejected leaves both.

### First pass — structural, no behaviour change

- [x] **P1** — Name the server's three layers: `api/` → `services/` → `db/`, ending the
      `utils → services` edge and re-shelving `record-query.ts` as SQL rather than as a service.
- [x] **P2** — Ownership-bound handler factories, so a table-scoped request cannot reach its data
      without having proven ownership of it.
- [x] **P7** — Component-private composables move next to their component (`BaseSelect/`).
- [ ] **P6** — Record and field counts are returned by the server instead of computed on the client;
      `adjustCachedCount` goes.
- [x] **P3** — A declared client↔server contract and one API client module per resource; stores and
      components stop holding URLs and asserting response shapes.

### Discovered

- [ ] **The write handlers' happy paths are never driven through the handler**, only through their
      services. `ownership.integration.spec.ts` runs every endpoint as a stranger (404) and
      anonymous (401), but its owner pass is read-only on purpose — a delete mid-loop would pull
      rows out from under it. Add an owner-write pass over its own rows, so a handler that passed
      the wrong id or param name to a service would be caught. Surfaced by P2: the preamble those
      files used to share now lives in the factory, so what is left reads 0% instead of ~60%.

### Second pass — each behind a stated judgement call

- [ ] **P9** — Consolidate the status-code policy into one file and make `CLAUDE.md` §3's
      "framework-agnostic services" claim true or drop it. _Recommended variant: (b)._
- [ ] **P10** — An error-sink port behind the file writer, plus a client-side error boundary
      reporting through the same redaction contract.
- [ ] **P4** — A field type becomes three co-located modules instead of thirteen registry entries.
      _Gate: do this when the next field type is scheduled, not before._
- [ ] **P5** — Retire the records store; the list becomes one `useAsyncData` behind `useRecordList`.
      _Gate: only with the e2e suite green — three `decisions.md` entries pin behaviour it touches._
- [ ] **P8** — Feature folders for the frontend. _Gate: after P3/P4/P5, or at a fourth domain._
- [ ] **P11** — Index strategy for the JSONB ceiling. _Gate: first table over ~100k records, or the
      first report of a slow filtered view._

---

## Parked

Listed with the trigger that would unpark them, so the decision is not re-taken by accident.

- **Row actions are three inline icons where the concept draws one `⋯` menu.** The blocker is gone —
  `usePopover` + `useAnchoredPosition` anchor correctly inside a clipping container. What remains is
  that three targets still fit, so the menu would be work with no user-visible gain. **Unpark at a
  fourth row action.**
