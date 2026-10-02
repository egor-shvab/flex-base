import { UNKNOWN_RECORD_LABEL } from '#shared/constants/record'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import { isListFilterValue, isRangeFilterValue } from '#shared/utils/filter'
import { formatLinkedRecord } from '#shared/utils/record-label'
import type { IFilterSummaryContext } from '~/field-types/types'

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

export function summariseList(value: TFilterValue, entry: (value: string) => string): string {
  if (!isListFilterValue(value) || value.length === 0) return ''

  const entries = value.map(entry)

  return entries.length === 1 ? `is ${entries[0]}` : `is any of ${entries.join(', ')}`
}

export function summariseLinkedRecord(
  ctx: IFilterSummaryContext,
  field: IField,
  address: string,
): string {
  const ref =
    ctx.linkedRecordByNumber(field.id, Number(address)) ?? ctx.linkedRecordFor(field.id, address)

  return ref === undefined ? UNKNOWN_RECORD_LABEL : formatLinkedRecord(ref)
}
