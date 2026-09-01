import type { TFilterValue } from '#shared/types/filter'
import type { TRecordSingleValue, TRecordValue } from '#shared/types/record'

/**
 * A value as the **list** it stands for: an array passes through, a non-empty string becomes one
 * entry, and anything else — blank, `null`, a number, a range — is no list at all.
 *
 * **The one place that question is answered**, by callers asking it for two different reasons —
 * which is why the module is named for the shape rather than either domain (`docs/decisions.md`):
 * three read a **stored** value (`listValue`, the multi-value cell, the relation picker), and
 * `BaseSelect` normalises a **control's own model**.
 *
 * The leniency is contract, not padding: widening a field runs `widenToList` in the same
 * transaction as the metadata, so a bare scalar only survives on a page drawn before that ran —
 * and dropping it would lose an edit the user is about to save. The server's
 * `collectRelationTargets` asks a stricter question, rejecting non-string elements.
 *
 * Typed on `TFilterValue`: the record union and `BaseSelect`'s model are both subsets of it.
 */
export function toValueList(value: TFilterValue): string[] {
  if (Array.isArray(value)) return value

  return typeof value === 'string' && value !== '' ? [value] : []
}

/**
 * The counterpart for every other cell, which renders exactly one value. Whenever
 * `cellComponent` returns `MultiValueCell` the value is `toValueList`; otherwise it is this.
 * Both are pure shape — resolving *which* cell draws a column is `cell-resolver`.
 */
export function toCellSingleValue(value: TRecordValue): TRecordSingleValue {
  return Array.isArray(value) ? (value[0] ?? null) : value
}
