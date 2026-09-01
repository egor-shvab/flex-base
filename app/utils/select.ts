/**
 * Above this many options, offering a search box is worth its own weight. Below it a text
 * field in front of a three-choice picker is noise — and on touch it raises a soft keyboard
 * for nothing.
 */
const SEARCHABLE_OPTION_THRESHOLD = 8

/**
 * Whether a select of this many options should be searchable.
 *
 * **One caller** — the SELECT registry entry. A module of its own because
 * `field-types/select/index.ts` imports `BaseSelect.vue`, so a spec there would run in the
 * `nuxt` project where these assertions run in `unit` (`CLAUDE.md` §10).
 *
 * A **predicate, not the number**: the threshold is this module's business. It lives at the
 * call site rather than inside `BaseSelect` because a caller owns the array it passes.
 *
 * Not for a list that arrives after mount — a `searchable` flipping once a fetch lands swaps
 * the focused element out from under the user (`FieldFormModal` hardcodes it instead). Nor for
 * RELATION, whose seed list is capped, so the option count says nothing.
 */
export function shouldSearch(optionCount: number): boolean {
  return optionCount > SEARCHABLE_OPTION_THRESHOLD
}
