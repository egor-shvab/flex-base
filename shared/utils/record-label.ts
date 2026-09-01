import type { ILinkedRecord, IRecord } from '#shared/types/record'

/**
 * What names a record when something links to it. The label field is named by the relation
 * field's `options.labelFieldKey`, so resolving one needs no metadata beyond the record; a
 * record with nothing to name it by reads as `null` rather than as its number.
 *
 * **This function never writes a `#`.** The number travels beside the label as `ILinkedRecord`,
 * composed in by `formatLinkedRecord` or `BaseLinkedRecord` — the only two that write one.
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
 * A linked record as one line of text — `#3 Example`, or `#3` alone when nothing names it.
 * For the places that can only hold a string: a filter chip's phrase, and the flat `label` a
 * `BaseSelect` option carries for its trigger, its type-ahead and its accessible name.
 */
export function formatLinkedRecord(linked: ILinkedRecord): string {
  return linked.label === null ? `#${linked.number}` : `#${linked.number} ${linked.label}`
}
