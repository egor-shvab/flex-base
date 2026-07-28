import { FILTER_VALUE_BY_TYPE, RESERVED_QUERY_PARAMS } from '#shared/constants/filter'
import type { IDateRange, INumberRange } from '#shared/types/range'
import type { IField, TFieldType } from '#shared/types/field'
import type { TFilterParamRole, TFilterValue } from '#shared/types/filter'

/**
 * Filters travel as plain query params named after the field: a scalar takes the field's
 * bare key, a range spreads to these two suffixes —
 * `?company=acme&contract_value_from=100&contract_value_to=500`.
 */
const RANGE_PARAM_SUFFIX = { from: '_from', to: '_to' } as const

export function rangeParamName(fieldKey: string, bound: keyof INumberRange): string {
  return `${fieldKey}${RANGE_PARAM_SUFFIX[bound]}`
}

/**
 * The params a field's filter claims, each tagged with the part of the value it carries.
 * The one definition of that mapping — the field-key collision guard, the query schema and
 * the URL codec all read it, so they cannot disagree about which name belongs to whom.
 */
function filterParamSlots(
  fieldKey: string,
  type: TFieldType,
): { role: TFilterParamRole; name: string }[] {
  if (FILTER_VALUE_BY_TYPE[type].shape === 'range') {
    return [
      { role: 'from', name: rangeParamName(fieldKey, 'from') },
      { role: 'to', name: rangeParamName(fieldKey, 'to') },
    ]
  }

  return [{ role: 'value', name: fieldKey }]
}

/** Just the names — what the field-key collision guard needs. */
export function filterParamNames(fieldKey: string, type: TFieldType): string[] {
  return filterParamSlots(fieldKey, type).map((slot) => slot.name)
}

/**
 * Maps a table's fields to the query params they own, skipping any name already claimed —
 * reserved params first, then fields in order. Field keys created since the param format
 * landed cannot collide (see `createField`); this keeps older keys deterministic.
 */
export function claimFilterParams(
  fields: IField[],
): { field: IField; role: TFilterParamRole; name: string }[] {
  const claimed = new Set<string>(RESERVED_QUERY_PARAMS)
  const slots = []

  for (const field of fields) {
    for (const { role, name } of filterParamSlots(field.key, field.type)) {
      if (claimed.has(name)) continue
      claimed.add(name)
      slots.push({ field, role, name })
    }
  }

  return slots
}

export function isRangeFilterValue(value: TFilterValue): value is INumberRange | IDateRange {
  return typeof value === 'object' && value !== null
}

/** "Not filtered", whatever the value's shape — a blank input never reaches the query. */
export function isFilterValueEmpty(value: TFilterValue): boolean {
  if (value === null) return true
  if (isRangeFilterValue(value)) return value.from === null && value.to === null
  return typeof value === 'string' ? value.trim() === '' : false
}
