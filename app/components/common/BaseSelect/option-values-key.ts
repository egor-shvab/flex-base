import type { ISelectOption } from '~/types/select'

/**
 * A stable string identifying which options a list is offering, for the two watchers that must
 * fire on a **changed** list rather than a new array.
 *
 * Both sources rebuild their array on every parent render — a `props(field)` factory returns a
 * fresh one each time — so watching identity would be pure churn: the cursor would re-clamp and
 * the label cache would rebuild for a list nobody touched.
 *
 * **`JSON.stringify`, deliberately, and not a `join`.** A separator is cheaper, but a value
 * containing it would key the same as two values either side of it, and a SELECT choice is
 * free text. The saving is microseconds on a list capped at `RELATION_OPTIONS_LIMIT`; the
 * collision is silent and would show up as a list that stopped reacting.
 */
export function optionValuesKey(options: ISelectOption[]): string {
  return JSON.stringify(options.map((option) => option.value))
}
