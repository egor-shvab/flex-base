# Roadmap

The source of truth for what is being built next. Statuses: `[ ]` not started · `[~]` in progress · `[x]` done.

This file says only _what_ and _in what order_ — contracts belong in `docs/architecture.md`, rationale in `docs/decisions.md`, rules in `CLAUDE.md` §2.

---

## Current phase — none scheduled

The refactoring & cleanup phase is closed: its findings are in the code, and the constraints worth
keeping moved into `docs/decisions.md` as they landed.

The next phase is a decision rather than a backlog — drawn from the parked item below, or from
`docs/decisions.md` → **Accepted limitations** when a row's _revisit_ condition comes true. One
**Open** row is left there, and it is the same one parked here.

---

## Parked

Listed with the trigger that would unpark them, so the decision is not re-taken by accident.

- **Row actions are three inline icons where the concept draws one `⋯` menu.** The blocker is gone —
  `usePopover` + `useAnchoredPosition` anchor correctly inside a clipping container. What remains is
  that three targets still fit, so the menu would be work with no user-visible gain. **Unpark at a
  fourth row action.**
