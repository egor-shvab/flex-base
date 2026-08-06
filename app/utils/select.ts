/**
 * Above this many options, offering a search box is worth its own weight. Below it a text
 * field in front of a three-choice picker is noise — and on touch it raises a soft keyboard
 * for nothing.
 */
const SEARCHABLE_OPTION_THRESHOLD = 8

/**
 * Whether a select of this many options should be searchable.
 *
 * A **predicate, not the number**: what the two field-type registries duplicate is the
 * comparison, not the literal. It lives at the call site rather than inside `BaseSelect`
 * because a caller owns the `options` array it passes and can therefore count it — the atom
 * counting for itself was the implicit behaviour this replaced.
 *
 * Not for a list that arrives after mount: a `searchable` that flips once a fetch lands
 * swaps the focused element out from under the user (see `FieldFormModal`, which hardcodes
 * it instead).
 */
export function shouldSearch(optionCount: number): boolean {
  return optionCount > SEARCHABLE_OPTION_THRESHOLD
}
