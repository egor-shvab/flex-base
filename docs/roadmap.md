# Roadmap

The source of truth for what is being built next. Statuses: `[ ]` not started · `[~]` in progress · `[x]` done.

This file says only _what_ and _in what order_ — contracts belong in `docs/architecture.md`, rationale in `docs/decisions.md`, rules in `CLAUDE.md` §2.

---

## Current phase — none scheduled

- [x] `BaseBadge` declares its own height, so a container's line-height no longer resizes it.

**Nothing else is in progress.** The feature set and the test suite are done, and the Open-limitations phase is finished: one **Open** row is left in `docs/decisions.md`, and it is the parked item below rather than a stage.

The next phase is a decision, not a backlog. It would be drawn from the parked item, or from the register when a row's "revisit" condition comes true.

---

## Parked

Listed with the trigger that would unpark them, so the decision is not re-taken by accident.

- **Row actions are three inline icons where the concept draws one `⋯` menu.** The blocker is gone — `usePopover` + `useAnchoredPosition` anchor correctly inside a clipping container. What remains is that three targets still fit, so the menu would be work with no user-visible gain. **Unpark at a fourth row action.**
