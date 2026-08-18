import { UNKNOWN_RECORD_LABEL } from '#shared/constants/record'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import { isListFilterValue, isRangeFilterValue } from '#shared/utils/filter'
import { formatLinkedRecord } from '#shared/utils/record-label'
import type { IFilterSummaryContext } from '~/field-types/types'

/**
 * The phrasings a filter summary is written from — the fragments more than one field type
 * shares, kept here so a type's own module reads as its own wording rather than as a
 * near-copy of its neighbour's.
 */

/**
 * Both range types share this, parameterised by how a bound is written.
 *
 * The wording tracks what the SQL actually does: bounds are **inclusive**, so "or more" and
 * "from" are true where "above" and "after" would not be.
 */
export function summariseRange(
  value: TFilterValue,
  format: (bound: string | number) => string,
  both: (from: string, to: string) => string,
  lower: (from: string) => string,
  upper: (to: string) => string,
): string {
  if (!isRangeFilterValue(value)) return ''

  const { from, to } = value
  if (from !== null && to !== null) return both(format(from), format(to))
  if (from !== null) return lower(format(from))
  if (to !== null) return upper(format(to))
  return ''
}

/**
 * Every list-shaped filter reads the same way, parameterised by how one entry is written.
 * One value reads as an equality because that is what it is; several read as the OR the SQL
 * actually runs, rather than a count the user must expand. There is no "all of" spelling,
 * because there is no operator to express it.
 */
export function summariseList(value: TFilterValue, entry: (value: string) => string): string {
  if (!isListFilterValue(value) || value.length === 0) return ''

  const entries = value.map(entry)

  return entries.length === 1 ? `is ${entries[0]}` : `is any of ${entries.join(', ')}`
}

/**
 * How one linked record reads inside a chip: the flat form, because a summary is a string by
 * contract. Nothing resolved means there is no number to state either, so it degrades whole.
 */
export function summariseLinkedRecord(
  ctx: IFilterSummaryContext,
  field: IField,
  recordId: string,
): string {
  const ref = ctx.linkedRecordFor(field.id, recordId)

  return ref === undefined ? UNKNOWN_RECORD_LABEL : formatLinkedRecord(ref)
}
