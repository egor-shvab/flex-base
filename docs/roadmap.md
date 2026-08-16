# Roadmap

The source of truth for what is being built next. Statuses: `[ ]` not started · `[~]` in progress · `[x]` done.

This file says only _what_ and _in what order_ — contracts belong in `docs/architecture.md`, rationale in `docs/decisions.md`, rules in `CLAUDE.md` §2.

---

## Current phase — server error logging

Closing the server half of the **No error reporting or observability** row in `docs/decisions.md` → **Accepted limitations**.

- [x] Record every unhandled 5xx to `logs/server-errors.log` from Nitro's `error` hook, with a fixed redaction contract and size-based rotation.

The client half stays open, and its own row says so. The next phase after this is a decision, not a backlog — drawn from the parked item below, or from the register when a row's "revisit" condition comes true.

---

## Parked

Listed with the trigger that would unpark them, so the decision is not re-taken by accident.

- **Row actions are three inline icons where the concept draws one `⋯` menu.** The blocker is gone — `usePopover` + `useAnchoredPosition` anchor correctly inside a clipping container. What remains is that three targets still fit, so the menu would be work with no user-visible gain. **Unpark at a fourth row action.**
