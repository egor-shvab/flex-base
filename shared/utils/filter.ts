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

function recordColumn(key: string, name: string, type: TFieldType): IField {
  return { id: key, key, name, type, required: false, options: null, order: 0, indexed: false }
}

const RECORD_NUMBER_FIELD = recordColumn(RECORD_NUMBER_KEY, 'Record #', 'TEXT')

const CREATED_AT_FIELD = recordColumn(CREATED_AT_KEY, 'Created at', 'DATE')
const UPDATED_AT_FIELD = recordColumn(UPDATED_AT_KEY, 'Updated at', 'DATE')

export function queryColumns(fields: IField[]): IField[] {
  return [RECORD_NUMBER_FIELD, ...fields, CREATED_AT_FIELD, UPDATED_AT_FIELD]
}

export function filterShapeFor(field: IField): IFilterValueRules<TFilterValue>['shape'] {
  return isMultiValue(field) ? 'list' : FILTER_VALUE_BY_TYPE[field.type].shape
}

export function emptyFilterValueFor(field: IField): TFilterValue {
  return isMultiValue(field) ? [] : FILTER_VALUE_BY_TYPE[field.type].empty
}

const RANGE_PARAM_SUFFIX = { from: '_from', to: '_to' } as const

export function rangeParamName(fieldKey: string, bound: keyof INumberRange): string {
  return `${fieldKey}${RANGE_PARAM_SUFFIX[bound]}`
}

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

  return [{ part: 'value', name: fieldKey }]
}

export function filterParamNames(fieldKey: string, type: TFieldType): string[] {
  return filterParamClaims(fieldKey, type).map((claim) => claim.name)
}

const RESERVED_PARAM_NAMES: ReadonlySet<string> = new Set(RESERVED_QUERY_PARAMS)

export function isReservedParam(name: string): boolean {
  return RESERVED_PARAM_NAMES.has(name)
}

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

export function filterableFields(fields: IField[]): IField[] {
  // By identity, not key: two legacy fields can share one key
  const claimingFields = new Set(claimFilterParams(fields).map((claim) => claim.field))

  return fields.filter((field) => claimingFields.has(field))
}

export function filterableColumns(fields: IField[]): IField[] {
  return filterableFields(queryColumns(fields))
}

/** `!Array.isArray` is load-bearing: an array is a non-null object too. */
export function isRangeFilterValue(value: TFilterValue): value is INumberRange | IDateRange {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isListFilterValue(value: TFilterValue): value is string[] {
  return Array.isArray(value)
}

export function isScalarFilterValue(
  value: TFilterValue,
): value is string | number | boolean | null {
  return !isRangeFilterValue(value) && !isListFilterValue(value)
}

export function isFilterValueEmpty(value: TFilterValue): boolean {
  if (value === null) return true
  if (isListFilterValue(value)) return value.length === 0
  if (isRangeFilterValue(value)) return value.from === null && value.to === null
  return typeof value === 'string' ? value.trim() === '' : false
}

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
