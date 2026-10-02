import {
  DEFAULT_SORT_DIRECTION,
  DEFAULT_SORT_KEY,
  FILTER_VALUES_MAX,
} from '#shared/constants/filter'
import type { IField } from '#shared/types/field'
import type { TFilterParamPart, TFilterValue, TRecordFilterValues } from '#shared/types/filter'
import type { TQueryParams } from '#shared/types/query'
import type { IDateRange, INumberRange } from '#shared/types/range'
import type { IRecordQueryState, TRecordSingleValue } from '#shared/types/record'
import {
  claimFilterParams,
  filterShapeFor,
  isFilterValueEmpty,
  isListFilterValue,
  isRangeFilterValue,
  isReservedParam,
  queryColumns,
  rangeParamName,
} from '#shared/utils/filter'
import { singleParam } from '#shared/utils/query-param'
import { buildFilterValueSchema } from '#shared/validation/record'

function filterParamValue(query: Record<string, unknown>, name: string): string | null {
  const raw = query[name]
  return typeof raw === 'string' && raw !== '' ? raw : null
}

function filterParamValues(query: Record<string, unknown>, name: string): string[] {
  const raw = query[name]
  const list = Array.isArray(raw) ? raw : [raw]

  return list.filter((entry): entry is string => typeof entry === 'string' && entry !== '')
}

function toRange(from: TRecordSingleValue, to: TRecordSingleValue): INumberRange | IDateRange {
  if (typeof from === 'number' || typeof to === 'number') {
    return { from: typeof from === 'number' ? from : null, to: typeof to === 'number' ? to : null }
  }

  return { from: typeof from === 'string' ? from : null, to: typeof to === 'string' ? to : null }
}

function toList(field: IField, query: Record<string, unknown>, name: string): string[] {
  const schema = buildFilterValueSchema(field)
  const decoded = new Set<string>()

  for (const raw of filterParamValues(query, name)) {
    const parsed = schema.safeParse(raw)
    if (parsed.success && typeof parsed.data === 'string') decoded.add(parsed.data)
  }

  return [...decoded].slice(0, FILTER_VALUES_MAX)
}

function parseFilterValues(fields: IField[], query: Record<string, unknown>): TRecordFilterValues {
  const partsByKey = new Map<string, Partial<Record<TFilterParamPart, TRecordSingleValue>>>()
  const listsByKey = new Map<string, string[]>()
  const columns = queryColumns(fields)

  for (const { field, part, name } of claimFilterParams(columns)) {
    if (filterShapeFor(field) === 'list') {
      listsByKey.set(field.key, toList(field, query, name))
      continue
    }

    const raw = filterParamValue(query, name)
    if (raw === null) continue

    const parsed = buildFilterValueSchema(field).safeParse(raw)
    if (!parsed.success) continue

    const parts = partsByKey.get(field.key) ?? {}
    parts[part] = parsed.data
    partsByKey.set(field.key, parts)
  }

  const values: TRecordFilterValues = {}

  for (const field of columns) {
    const shape = filterShapeFor(field)

    if (shape === 'list') {
      const list = listsByKey.get(field.key)
      if (list !== undefined && !isFilterValueEmpty(list)) values[field.key] = list
      continue
    }

    const parts = partsByKey.get(field.key)
    if (parts === undefined) continue

    const value: TFilterValue =
      shape === 'range' ? toRange(parts.from ?? null, parts.to ?? null) : (parts.value ?? null)

    if (!isFilterValueEmpty(value)) values[field.key] = value
  }

  return values
}

export function parseRecordQueryState(
  fields: IField[],
  query: Record<string, unknown>,
): IRecordQueryState {
  const page = Number(singleParam(query.page) ?? 1)
  const direction = singleParam(query.dir)

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    sort: {
      key: singleParam(query.sort) ?? DEFAULT_SORT_KEY,
      direction: direction === 'asc' || direction === 'desc' ? direction : DEFAULT_SORT_DIRECTION,
    },
    filters: parseFilterValues(fields, query),
    search: (singleParam(query.search) ?? '').trim(),
  }
}

function toFilterParams(values: TRecordFilterValues): TQueryParams {
  const params: TQueryParams = {}

  for (const [key, value] of Object.entries(values)) {
    if (isFilterValueEmpty(value)) continue

    if (isListFilterValue(value)) {
      params[key] = [...value].sort()
      continue
    }

    if (isRangeFilterValue(value)) {
      if (value.from !== null) params[rangeParamName(key, 'from')] = String(value.from)
      if (value.to !== null) params[rangeParamName(key, 'to')] = String(value.to)
      continue
    }

    params[key] = typeof value === 'string' ? value.trim() : String(value)
  }

  return params
}

export function toRecordQueryParams(state: IRecordQueryState): TQueryParams {
  const params: TQueryParams = {}

  // Dropped rather than left for the assignments below to overwrite: those only fire when a
  // value differs from its default
  for (const [name, value] of Object.entries(toFilterParams(state.filters))) {
    if (!isReservedParam(name)) params[name] = value
  }

  if (state.search) params.search = state.search
  if (state.page > 1) params.page = String(state.page)
  if (state.sort.key !== DEFAULT_SORT_KEY) params.sort = state.sort.key
  if (state.sort.direction !== DEFAULT_SORT_DIRECTION) params.dir = state.sort.direction

  return params
}

export function recordQueryKey(state: IRecordQueryState): string {
  const params = toRecordQueryParams(state)

  return Object.keys(params)
    .sort()
    .map((name) => {
      const value = params[name]
      return `${name}=${Array.isArray(value) ? value.join(',') : value}`
    })
    .join('&')
}
