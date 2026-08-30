/**
 * Above this many options, offering a search box is worth its own weight. Below it a text
 * field in front of a three-choice picker is noise — and on touch it raises a soft keyboard
 * for nothing.
 */
const SEARCHABLE_OPTION_THRESHOLD = 8

/**
 * Whether a select of this many options should be searchable.
 *
 * **One caller** — the SELECT registry entry. It stays a module of its own because
 * `field-types/select/index.ts` imports `BaseSelect.vue`, so a spec of the rule stated there
 * would run in the `nuxt` project; here the same assertions run in `unit` (`CLAUDE.md` §10).
 *
 * A **predicate, not the number**: the threshold is this module's business, so a caller asks
 * the question rather than restating the comparison. It lives at the call site rather than
 * inside `BaseSelect` because a caller owns the `options` array it passes and can therefore
 * count it — the atom counting for itself was the implicit behaviour this replaced.
 *
 * Not for a list that arrives after mount: a `searchable` that flips once a fetch lands
 * swaps the focused element out from under the user (see `FieldFormModal`, which hardcodes
 * it instead). RELATION does not reach for it either — its seed list is capped, so the
 * option count says nothing about how many records the target table holds.
 */
export function shouldSearch(optionCount: number): boolean {
  return optionCount > SEARCHABLE_OPTION_THRESHOLD
}
