import {
  CREATED_AT_KEY,
  RECORD_NUMBER_KEY,
  RESERVED_QUERY_PARAMS,
  UPDATED_AT_KEY,
} from '#shared/constants/filter'
import { isMultiValue } from '#shared/field-types/cardinality'
import { FILTER_VALUE_BY_TYPE } from '#shared/field-types/registry'
import type { IDateRange, INumberRange } from '#shared/types/range'
import type { IField, TFieldType } from '#shared/types/field'
import type {
  IFilterValueRules,
  TFilterParamPart,
  TFilterValue,
  TRecordFilterValues,
} from '#shared/types/filter'

/**
 * One column of `Record` itself, as the query layer sees it. Declaring these as ordinary
 * `IField`s lets the filter control, the URL codec, the query schema and the match count treat
 * them like any other column — only the SQL projection knows they are not JSONB. `order` is
 * inert; `queryColumns` fixes where each sits.
 */
function recordColumn(key: string, name: string, type: TFieldType): IField {
  // `indexed` is inert too: real columns, already covered by the table's own indexes
  return { id: key, key, name, type, required: false, options: null, order: 0, indexed: false }
}

/** A partial match, so typing `4` finds `#4`, `#14` and `#42` alike. */
const RECORD_NUMBER_FIELD = recordColumn(RECORD_NUMBER_KEY, 'Record #', 'TEXT')

/** Timestamps filter as `DATE`, which gives each one an inclusive from/to range of days. */
const CREATED_AT_FIELD = recordColumn(CREATED_AT_KEY, 'Created at', 'DATE')
const UPDATED_AT_FIELD = recordColumn(UPDATED_AT_KEY, 'Updated at', 'DATE')

/**
 * A table's own fields bracketed by the record's own columns, in presentation order — the table
 * and the filter drawer both render from this. Applied wherever a *query* is built, never where
 * a record's data is read or written.
 */
export function queryColumns(fields: IField[]): IField[] {
  return [RECORD_NUMBER_FIELD, ...fields, CREATED_AT_FIELD, UPDATED_AT_FIELD]
}

/**
 * A **field's** filter value shape, which is not a function of its type alone: a multi-value
 * field filters as a list whatever its type says. `FILTER_VALUE_BY_TYPE` is the single-value
 * case, and this is the one place multi overrides it.
 */
export function filterShapeFor(field: IField): IFilterValueRules<TFilterValue>['shape'] {
  return isMultiValue(field) ? 'list' : FILTER_VALUE_BY_TYPE[field.type].shape
}

/** The same override for "not filtered" — an empty list rather than the type's empty scalar. */
export function emptyFilterValueFor(field: IField): TFilterValue {
  return isMultiValue(field) ? [] : FILTER_VALUE_BY_TYPE[field.type].empty
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
 * The params a field's filter claims, tagged with the part of the value each carries. The one
 * definition of that mapping, read by the collision guard, the query schema and the URL codec.
 *
 * **Keyed by type rather than by field, and multi-value does not change that**: `scalar` and
 * `list` claim the same single name, and no type `MULTI_VALUE_BY_TYPE` allows is `range`. That
 * is what keeps `filterParamNames` callable from `createField`, where only the type is known.
 */
function filterParamClaims(
  fieldKey: string,
  type: TFieldType,
): { part: TFilterParamPart; name: string }[] {
  if (FILTER_VALUE_BY_TYPE[type].shape === 'range') {
    return [
      { part: 'from', name: rangeParamName(fieldKey, 'from') },
      { part: 'to', name: rangeParamName(fieldKey, 'to') },
    ]
  }

  // `scalar` and `list` share this: a list is the same param, repeated
  return [{ part: 'value', name: fieldKey }]
}

/** Just the names — what the field-key collision guard needs. */
export function filterParamNames(fieldKey: string, type: TFieldType): string[] {
  return filterParamClaims(fieldKey, type).map((claim) => claim.name)
}

const RESERVED_PARAM_NAMES: ReadonlySet<string> = new Set(RESERVED_QUERY_PARAMS)

/**
 * A param the records URL owns. One definition read by both halves of the codec: a reserved
 * name is never claimed by a field on the way in, and never written from one on the way out.
 */
export function isReservedParam(name: string): boolean {
  return RESERVED_PARAM_NAMES.has(name)
}

/**
 * A table's fields mapped to the params they own, skipping any name already claimed — reserved
 * first, then fields in order. `createField` refuses colliding keys; this keeps older ones
 * deterministic.
 */
export function claimFilterParams(
  fields: IField[],
): { field: IField; part: TFilterParamPart; name: string }[] {
  const takenNames = new Set<string>(RESERVED_PARAM_NAMES)
  const claims = []

  for (const field of fields) {
    for (const { part, name } of filterParamClaims(field.key, field.type)) {
      if (takenNames.has(name)) continue
      takenNames.add(name)
      claims.push({ field, part, name })
    }
  }

  return claims
}

/**
 * The columns whose filter can round-trip — every field claiming at least one param. A legacy
 * field keyed like a reserved one claims nothing, so its value cannot survive the URL, and the
 * drawer renders from this rather than `queryColumns` so no dead control is offered.
 *
 * Only *filtering* is affected: such a field still sorts and renders, since the sort key travels
 * as the **value** of `?sort=`. `createField` refuses these keys, so this only subtracts for
 * older data.
 */
export function filterableFields(fields: IField[]): IField[] {
  // By identity, not key: two legacy fields can share one, and `claimFilterParams` resolves to
  // the *first* — the one that must keep its control
  const claimingFields = new Set(claimFilterParams(fields).map((claim) => claim.field))

  return fields.filter((field) => claimingFields.has(field))
}

/**
 * The columns a table's filter surfaces render — `queryColumns` minus anything whose filter
 * could not round-trip. The drawer and the summary both read this rather than composing the
 * pair themselves, so a filter one can set and the other cannot chip is unreachable.
 */
export function filterableColumns(fields: IField[]): IField[] {
  return filterableFields(queryColumns(fields))
}

/**
 * `!Array.isArray` is load-bearing: an array *is* a non-null object, so without it a
 * list-shaped value narrows to a range and is read for bounds it does not have.
 */
export function isRangeFilterValue(value: TFilterValue): value is INumberRange | IDateRange {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isListFilterValue(value: TFilterValue): value is string[] {
  return Array.isArray(value)
}

/**
 * Neither a range nor a list — the shapes a scalar comparison accepts. Stated positively so a
 * comparison guards on what it *wants* rather than on whichever shapes existed when it was
 * written.
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

/**
 * The filter map with one column's value replaced, **rebuilt in column order rather than patched
 * per key** — which is what makes the serialized URL stable whichever control the user touched.
 *
 * Anything `isFilterValueEmpty` is dropped, so the map only holds active filters and "clear this
 * one" needs no separate path. Both filter surfaces go through here.
 */
export function withFilterValue(
  columns: IField[],
  filters: TRecordFilterValues,
  key: string,
  value: TFilterValue,
): TRecordFilterValues {
  const next: TRecordFilterValues = {}

  for (const column of columns) {
    const candidate = column.key === key ? value : filters[column.key]
    if (candidate !== undefined && !isFilterValueEmpty(candidate)) next[column.key] = candidate
  }

  return next
}
