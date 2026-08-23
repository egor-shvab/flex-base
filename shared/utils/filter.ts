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
 * One column of `Record` itself, as the query layer sees it: a read-only field over a real
 * column rather than a key of `data`. Declaring these as ordinary `IField`s is what lets the
 * filter control, the URL codec, the query schema and the match count treat them like any
 * other column — only the SQL projection knows they are not JSONB. `order` is inert here,
 * since `queryColumns` fixes where each one sits.
 */
function recordColumn(key: string, name: string, type: TFieldType): IField {
  return { id: key, key, name, type, required: false, options: null, order: 0 }
}

/** A partial match, so typing `4` finds `#4`, `#14` and `#42` alike. */
const RECORD_NUMBER_FIELD = recordColumn(RECORD_NUMBER_KEY, 'Record #', 'TEXT')

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
export function queryColumns(fields: IField[]): IField[] {
  return [RECORD_NUMBER_FIELD, ...fields, CREATED_AT_FIELD, UPDATED_AT_FIELD]
}

/**
 * A **field's** filter value shape, which is not a function of its type alone: a multi-value
 * field filters as a list whatever its type says, because "matches this one value" is not a
 * question that can be asked of a column holding several.
 *
 * The shape a field type declares in `FILTER_VALUE_BY_TYPE` is the single-value case; this is
 * the one place multi overrides it, and every caller that has an `IField` reads it here.
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
 * The params a field's filter claims, each tagged with the part of the value it carries.
 * The one definition of that mapping — the field-key collision guard, the query schema and
 * the URL codec all read it, so they cannot disagree about which name belongs to whom.
 *
 * **Keyed by type rather than by field on purpose, and multi-value does not change that.**
 * `scalar` and `list` already claim the same single param name (a list is that name repeated),
 * and no type `MULTI_VALUE_BY_TYPE` allows is `range` — so the claims a field makes are the
 * same whether it holds one value or several. That is what keeps `filterParamNames` callable
 * from `createField`, where the field row does not exist yet and only its type is known.
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
 * Maps a table's fields to the query params they own, skipping any name already claimed —
 * reserved params first, then fields in order. Field keys created since the param format
 * landed cannot collide (see `createField`); this keeps older keys deterministic.
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
 * The columns whose filter can actually round-trip — every field claiming at least one param.
 * A legacy field keyed like a reserved one (`search`, `page`, …) claims nothing at all, so its
 * value can never survive the URL; the filter drawer and the summary render from this rather
 * than from `queryColumns` so that no control is offered for a filter that cannot be applied.
 *
 * Only *filtering* is affected. Such a field still sorts and still renders as a column: the
 * sort key travels as the **value** of `?sort=`, where a reserved name collides with nothing.
 *
 * `createField` has refused these keys since the param format landed, so this only ever
 * subtracts anything for data older than that.
 */
export function filterableFields(fields: IField[]): IField[] {
  // By identity rather than by key: two legacy fields can share a key, and `claimFilterParams`
  // resolves that to the *first* of them — which is the one that must keep its control
  const claimingFields = new Set(claimFilterParams(fields).map((claim) => claim.field))

  return fields.filter((field) => claimingFields.has(field))
}

/**
 * The columns a table's filter surfaces render — its own fields bracketed by the record's own
 * columns (`queryColumns`), minus any whose filter could not round-trip through the URL
 * (`filterableFields`).
 *
 * The drawer and the summary both read this rather than composing the pair themselves, so a
 * filter one can set and the other cannot chip is not a state either can reach on its own.
 * Distinct from `filterableFields`, which answers the narrower question this is built from: of
 * *these* fields, which claim a param at all.
 */
export function filterableColumns(fields: IField[]): IField[] {
  return filterableFields(queryColumns(fields))
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

/**
 * The filter map with one column's value replaced — **rebuilt in column order rather than patched
 * per key**, which is the whole point: the URL a filter serializes to is then stable whichever
 * control the user touched, so two people narrowing the same way share the same link.
 *
 * Anything `isFilterValueEmpty` is dropped rather than stored, so the map only ever holds active
 * filters and "clear this one" needs no separate path — passing `emptyFilterValueFor(field)`
 * removes it. Both filter surfaces go through here, so neither can lose the ordering on its own.
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
