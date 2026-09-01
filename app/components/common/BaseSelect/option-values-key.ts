import type { ISelectOption } from '~/types/select'

/**
 * A stable string identifying which options a list is offering, for the two watchers that must
 * fire on a **changed** list rather than a new array.
 *
 * A `props(field)` factory rebuilds both sources on every parent render, so watching identity
 * would re-clamp the cursor and rebuild the label cache for a list nobody touched.
 *
 * **`JSON.stringify`, not a `join`.** A SELECT choice is free text, so a value containing the
 * separator would key the same as two values either side of it — a silent collision showing up
 * as a list that stopped reacting, to save microseconds on a capped list.
 */
export function optionValuesKey(options: ISelectOption[]): string {
  return JSON.stringify(options.map((option) => option.value))
}
