# Roadmap

The source of truth for what is being built next. Statuses: `[ ]` not started · `[~]` in progress · `[x]` done.

This file says only _what_ and _in what order_ — contracts belong in `docs/architecture.md`, rationale in `docs/decisions.md`, rules in `CLAUDE.md` §2.

---

## Current phase

**Nothing is queued.** The architectural restructuring phase is finished and the feature set is done, so the next phase is a decision rather than a backlog — read `CLAUDE.md` §1 for what is deliberately out of scope before adding to this file.

The gates below are the only things that would open work on their own. Everything else starts with a request.

---

## Parked

Listed with the trigger that would unpark them, so the decision is not re-taken by accident. Each one's reasoning lives in `docs/decisions.md`; do not re-derive it here.

- **Feature folders for the frontend.** _Unpark at a fourth domain_ — with three, one of which belongs to none of them, the move costs more review than it returns.
- **An index strategy for the JSONB ceiling.** _Unpark at the first table over ~100k records, or the first report of a slow filtered view._ The query layer can already take the fix; what needs deciding is index lifecycle.
- **Row actions are three inline icons where the concept draws one `⋯` menu.** _Unpark at a fourth row action_ — three targets still fit, so the menu would be work with no user-visible gain.
