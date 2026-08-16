# Roadmap

The source of truth for what is being built next. Statuses: `[ ]` not started · `[~]` in progress · `[x]` done.

This file says only _what_ and _in what order_ — contracts belong in `docs/architecture.md`, rationale in `docs/decisions.md`, rules in `CLAUDE.md` §2.

---

## Current phase — none scheduled

**Nothing is in progress.** The feature set and the test suite are done, the Open-limitations phase is finished, and the naming-clarity phase has landed — its rules now live in `CLAUDE.md` §6, where new code is judged against them.

The next phase is a decision, not a backlog. It would be drawn from the parked item below, or from `docs/decisions.md` → **Accepted limitations** when a row's "revisit" condition comes true.

---

## Parked

Listed with the trigger that would unpark them, so the decision is not re-taken by accident.

- **Row actions are three inline icons where the concept draws one `⋯` menu.** The blocker is gone — `usePopover` + `useAnchoredPosition` anchor correctly inside a clipping container. What remains is that three targets still fit, so the menu would be work with no user-visible gain. **Unpark at a fourth row action.**
