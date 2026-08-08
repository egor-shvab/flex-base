# ROADMAP

The source of truth for what is being built next. Statuses: `[ ]` not started · `[~]` in progress · `[x]` done.

Keep this file current — see `CLAUDE.md` §2 for the rules that govern it. Rationale belongs in `docs/decisions.md`, contracts in `docs/architecture.md`; this file says only _what_ and _in what order_.

---

## Current phase — testing

The feature set is complete. `shared/` and `app/` are covered; the server business layer and everything that needs a running database or a browser are not. Stages run in order: each one removes a class of risk that the next stage would otherwise be a poor tool for.

### Stage 1 — Make the gap visible

- [x] Extend `coverage.include` in `vitest.config.ts` to `server/utils/**`, `server/middleware/**`, `server/api/**`, `app/middleware/**` — these were unmeasured, which is why `server/utils/ownership.ts` sat at 0% unnoticed. The headline figure fell from 84% to 74% as ~20 hidden files entered the report.

### Stage 2 — Server unit coverage (no new infrastructure)

The four service modules and `ownership.ts` were at 0%. This is the only layer where wrong logic corrupts stored data. **Done — `server/services/` and `server/utils/` are now at 100% lines**, bar the documented shape guards in `record-query.ts`.

- [x] Decided: stub the prisma singleton (`test/prisma-mock.ts`), test each module in place, production code otherwise untouched. `CLAUDE.md` §10 updated to say what a stub may and may not prove.
- [x] `services/fields.ts` — the `updateField` write guards (type change, relation retarget, multi→single narrowing), `buildOptions` per type, metadata narrowing, field ordering.
- [x] `services/relations.ts` — relation-target collection (legacy scalar values, blanks, dedupe, grouping by target table), label resolution, the write-time referential check.
- [x] `services/tables.ts` — the 409 raised when a table is still a relation target.
- [x] `services/records.ts` — record DTO narrowing and the pagination arithmetic.
- [x] `utils/ownership.ts` — relation-target validation and the fieldless-table rejection.
- [x] `utils/auth.ts` — the non-JWT half: the auth-cookie attribute contract, cookie clearing, `requireUser`, one password round trip.
- [x] Assert the `MULTI_SQL` ↔ `MULTI_VALUE_BY_TYPE` invariant, the counterpart of the `MULTI_INPUTS` one already pinned. A mismatch silently makes a multi-value field unfilterable.

### Stage 3 — Smaller unit gaps

**Done — no module under `app/` holds untested logic now.**

- [x] `useAnchoredPosition` — the animation-frame coalescing on scroll/resize. Fixed a listener leak in its spec while there: the composable cleans up in `onBeforeUnmount`, which never registers under a bare `effectScope`, so every case was leaving a window listener behind.
- [x] `BasePagination` — the range label at its boundaries.
- [x] Extracted the records page's query logic into `useRecordListQuery` (sort flip, search floor, history replace-vs-push, empty-state copy) and covered it.
- [x] Client route guard — the redirect round trip, and an authenticated user bounced off `/auth`.

### Stage 4 — Integration tests (route handlers + real database)

Nothing at any level currently runs an h3 handler or touches PostgreSQL. Needs a decision first, because it needs infrastructure `npm run test` deliberately does not have.

- [ ] Decide: add an `integration` Vitest project against the Docker PostgreSQL (separate CI job, own npm script), or defer. **If deferred, record it in `docs/decisions.md` → Accepted limitations as Open** — the register currently implies E2E is all that remains, which is untrue of `server/`.
- [ ] Route handlers: the 404-never-403 ownership rule across tables, fields, records and relation options; 401 from `requireUser`; zod 400s; the auth endpoints (generic 401, duplicate-email 409, no password hash in any response, cookie set).
- [ ] The records endpoint composing the query schema and the shared codec the same way the page does.
- [ ] Against the database: the generated SQL actually executing on PostgreSQL; record-number allocation under concurrent creates; the `widenToList` migration (idempotent, non-destructive, transactional); unique-constraint 409s; table-delete cascade and refusal.
- [ ] Server auth middleware — absent, invalid, and since-deleted-user tokens.

### Stage 5 — End-to-end (Playwright)

Start only once Stages 2 and 4 are settled — otherwise E2E becomes the first thing to ever exercise ownership scoping and data migrations, which it is the wrong tool for.

- [ ] Set up Playwright over the auth-gated pages.
- [ ] Cover the browser-only behaviour listed in `docs/architecture.md` §12 — a filtered URL rendering filtered on first paint, focus restoration, the detail chain under Back/Forward.

### Optional cleanup

Low value, no urgency — do it only when touching these files anyway.

- [ ] Drop the key-presence half of the three "entry for every field type" registry tests; the total `Record<TFieldType, …>` types already enforce it at compile time.
- [ ] Assert that the SELECT registries _consult_ the search threshold rather than restating its value in three places.

---

## Done

- [x] Vitest set up as two projects (`unit`, `nuxt`), wired into CI.
- [x] `shared/` fully covered — utils, validation, constants.
- [x] The SQL builder covered by asserting on the generated fragments.
- [x] `app/` covered — every composable, store, field-type registry and util, plus the ten components that carry logic.
- [x] Test-coverage audit establishing the stages above.
- [x] Stage 2 — `server/services/` and `server/utils/` covered against a stubbed prisma client. Headline coverage 74% → 89%.
- [x] Stage 3 — the last untested logic under `app/`, and the records page reduced to orchestration. Headline coverage 89% → 90%.

---

## After testing

Not started, not scheduled. Listed so the direction is visible, not as a commitment.

- [ ] Work through the **Open** entries in `docs/decisions.md` → Accepted limitations.
- [ ] Add some form of error reporting — there is no client or server error sink today.
