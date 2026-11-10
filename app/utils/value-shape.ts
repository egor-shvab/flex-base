import type { TFilterValue } from '#shared/types/filter'
import type { TRecordSingleValue, TRecordValue } from '#shared/types/record'

export function toValueList(value: TFilterValue): string[] {
  if (Array.isArray(value)) return value

  return typeof value === 'string' && value !== '' ? [value] : []
}

export function toCellSingleValue(value: TRecordValue): TRecordSingleValue {
  return Array.isArray(value) ? (value[0] ?? null) : value
}
