import type { IRecord, IRecordRef } from '#shared/types/record'

/**
 * What names a record when something links to it. The label field is named by the relation
 * field's own `options.labelFieldKey`, so resolving one needs no metadata beyond the record
 * itself — and a record with nothing to name it by reads as `null` rather than as its number.
 *
 * **This function never writes a `#`.** The number travels beside the label as `IRecordRef` and
 * is composed in by `formatRecordRef` or `BaseRecordRef`, the only two places that write one.
 * Folding it in here is what used to make it unrecoverable, so appending it produced `#3 #3`.
 */
export function buildRecordLabel(
  record: Pick<IRecord, 'number' | 'data'>,
  labelFieldKey?: string,
): string | null {
  const value = labelFieldKey === undefined ? undefined : record.data[labelFieldKey]

  // A multi-value field is not offered as a label — one is chosen to name a record, and a
  // list does not name anything. It is still reachable, because a field already serving as
  // some relation's label can be widened afterwards, so it degrades here rather than
  // rendering `["a","b"]` through `String()`.
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : null
  }

  if (value === null || value === undefined || value === '') return null

  return String(value)
}

/**
 * A reference as one line of text — `#3 Example`, or `#3` alone when nothing names the record.
 * For the places that can only hold a string: a filter chip's phrase, and the flat `label` a
 * `BaseSelect` option carries for its trigger, its type-ahead and its accessible name.
 */
export function formatRecordRef(ref: IRecordRef): string {
  return ref.label === null ? `#${ref.number}` : `#${ref.number} ${ref.label}`
}
