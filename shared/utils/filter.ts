import {
  CREATED_AT_KEY,
  FILTER_VALUE_BY_TYPE,
  RECORD_NUMBER_KEY,
  RESERVED_QUERY_PARAMS,
  UPDATED_AT_KEY,
} from '#shared/constants/filter'
import type { IDateRange, INumberRange } from '#shared/types/range'
import type { IField, TFieldType } from '#shared/types/field'
import type { TFilterParamRole, TFilterValue } from '#shared/types/filter'

/**
 * One column of `Record` itself, as the query layer sees it: a read-only field over a real
 * column rather than a key of `data`. Declaring these as ordinary `IField`s is what lets the
 * filter control, the URL codec, the query schema and the match count treat them like any
 * other column — only the SQL projection knows they are not JSONB. `order` is inert here,
 * since `queryFields` fixes where each one sits.
 */
function recordColumn(key: string, name: string, type: TFieldType): IField {
  return { id: key, key, name, type, required: false, options: null, order: 0 }
}

/** A partial match, so typing `4` finds `#4`, `#14` and `#42` alike. */
export const RECORD_NUMBER_FIELD = recordColumn(RECORD_NUMBER_KEY, 'Record #', 'TEXT')

/** Timestamps filter as `DATE`, which gives each one an inclusive from/to range of days. */
const CREATED_AT_FIELD = recordColumn(CREATED_AT_KEY, 'Created at', 'DATE')
const UPDATED_AT_FIELD = recordColumn(UPDATED_AT_KEY, 'Updated at', 'DATE')

/**
 * A table's own fields plus the record's own columns that filter and sort alongside them, in
 * the order they are presented — the table and the filter drawer both render from this, so the
 * number leads and the timestamps trail rather than pushing a table's own data to the right.
 *
 * Applied wherever a *query* is built — never where a record's data is read or written, since
 * nothing here is part of that data.
 */
export function queryFields(fields: IField[]): IField[] {
  return [RECORD_NUMBER_FIELD, ...fields, CREATED_AT_FIELD, UPDATED_AT_FIELD]
}

/**
 * Filters travel as plain query params named after the field: a scalar takes the field's
 * bare key, a list repeats that same key once per value, a range spreads to these two
 * suffixes — `?company=acme&stage=Won&stage=Lost&contract_value_from=100`.
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

  // `scalar` and `list` share this: a list is the same param, repeated
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

/**
 * `!Array.isArray` is load-bearing, not defensive: an array *is* a non-null object, so
 * without it a list-shaped value would narrow to a range and be read for bounds it does
 * not have. Every guard over `TFilterValue` has to separate the two object shapes.
 */
export function isRangeFilterValue(value: TFilterValue): value is INumberRange | IDateRange {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isListFilterValue(value: TFilterValue): value is string[] {
  return Array.isArray(value)
}

/**
 * Neither a range nor a list — the single-value shapes a scalar comparison can accept.
 * Stated positively so a comparison guards on what it *wants* rather than on the one other
 * shape that existed when it was written; a third shape has now been added once.
 */
export function isScalarFilterValue(
  value: TFilterValue,
): value is string | number | boolean | null {
  return !isRangeFilterValue(value) && !isListFilterValue(value)
}

/** "Not filtered", whatever the value's shape — a blank input never reaches the query. */
export function isFilterValueEmpty(value: TFilterValue): boolean {
  if (value === null) return true
  if (isListFilterValue(value)) return value.length === 0
  if (isRangeFilterValue(value)) return value.from === null && value.to === null
  return typeof value === 'string' ? value.trim() === '' : false
}
