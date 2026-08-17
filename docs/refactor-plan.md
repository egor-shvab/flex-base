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
