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

/** An empty param (`?company=`) means "not filtered", never a match-everything condition. */
function filterParamValue(query: Record<string, unknown>, name: string): string | null {
  const raw = query[name]
  return typeof raw === 'string' && raw !== '' ? raw : null
}

/**
 * Every value a repeated param carries (`?stage=Won&stage=Lost`). A router hands one repeat over
 * as a bare string and several as an array, so both are read here.
 */
function filterParamValues(query: Record<string, unknown>, name: string): string[] {
  const raw = query[name]
  const list = Array.isArray(raw) ? raw : [raw]

  return list.filter((entry): entry is string => typeof entry === 'string' && entry !== '')
}

/**
 * A decoded bound is whatever the field's value schema produced, so a pair always matches one
 * of the two range shapes. Narrowed by shape rather than field type; anything else is no bound.
 */
function toRange(from: TRecordSingleValue, to: TRecordSingleValue): INumberRange | IDateRange {
  if (typeof from === 'number' || typeof to === 'number') {
    return { from: typeof from === 'number' ? from : null, to: typeof to === 'number' ? to : null }
  }

  return { from: typeof from === 'string' ? from : null, to: typeof to === 'string' ? to : null }
}

/**
 * Every decoded value of a repeated param, deduplicated and capped. The cap is the codec's own,
 * not the schema's: this also runs on the client over an unvalidated `route.query`.
 */
function toList(field: IField, query: Record<string, unknown>, name: string): string[] {
  const schema = buildFilterValueSchema(field)
  const decoded = new Set<string>()

  for (const raw of filterParamValues(query, name)) {
    const parsed = schema.safeParse(raw)
    // Every list-shaped filter carries strings, so the guard proves that to the compiler
    if (parsed.success && typeof parsed.data === 'string') decoded.add(parsed.data)
  }

  return [...decoded].slice(0, FILTER_VALUES_MAX)
}

/**
 * The filter params as one typed value per filtered field, in field order, so the map — and the
 * URL built back from it — stays stable. Shared, so the panel and the server read a link
 * identically. Values that do not decode are dropped; the query schema 400s them first.
 */
function parseFilterValues(fields: IField[], query: Record<string, unknown>): TRecordFilterValues {
  // One decoded value per claimed param — a list shape collects into `listsByKey` instead
  const partsByKey = new Map<string, Partial<Record<TFilterParamPart, TRecordSingleValue>>>()
  const listsByKey = new Map<string, string[]>()
  // The record's own columns filter alongside the table's fields, so the seam is applied here
  // rather than by each caller
  const columns = queryColumns(fields)

  for (const { field, part, name } of claimFilterParams(columns)) {
    // A list claims one param name and reads every repeat, so it collects whole, not by part
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

/**
 * A whole list query from flat params — the exact inverse of `toRecordQueryParams`, read by the
 * page over `route.query` and by the endpoint over its validated params, so the two cannot
 * decode a link differently. Lenient by design: rejecting a bad value is the schema's job.
 */
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
    // `singleParam` collapses an empty param, a repeat and an absence to `undefined`, so
    // `?search=` reads as "not searching". Trimmed as a scalar filter is, so a crafted
    // `?search=%20%20` is blank and this state matches the term the SQL will use.
    search: (singleParam(query.search) ?? '').trim(),
  }
}

/**
 * The inverse, for building a URL: `{ company: 'acme', contract_value_from: '100' }`.
 * A param's name follows from the value's shape — a range spreads to its two bounds,
 * a scalar takes the field's bare key, a list repeats that key once per value.
 */
function toFilterParams(values: TRecordFilterValues): TQueryParams {
  const params: TQueryParams = {}

  for (const [key, value] of Object.entries(values)) {
    if (isFilterValueEmpty(value)) continue

    if (isListFilterValue(value)) {
      // Sorted, so one selection always writes one URL — which keeps `recordQueryKey` from
      // reporting a change nobody made
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

/**
 * Serializes the client's query state to flat params — the same shape for the page URL
 * and the API request, so a shared link and the fetch behind it can never diverge.
 * Defaults are omitted, keeping an unfiltered view a clean link.
 */
export function toRecordQueryParams(state: IRecordQueryState): TQueryParams {
  const params: TQueryParams = {}

  // A filter never writes a reserved param — the counterpart of `claimFilterParams` never
  // reading one back. Dropped rather than left for the assignments below to overwrite: those
  // only fire when a value differs from its default, so on the default view nothing would.
  for (const [name, value] of Object.entries(toFilterParams(state.filters))) {
    if (!isReservedParam(name)) params[name] = value
  }

  if (state.search) params.search = state.search
  if (state.page > 1) params.page = String(state.page)
  if (state.sort.key !== DEFAULT_SORT_KEY) params.sort = state.sort.key
  // `dir`, not `direction`: the param spelling is frozen because a shared link outlives any
  // rename, so the state field and the param it writes disagree on purpose (`CLAUDE.md` §6).
  if (state.sort.direction !== DEFAULT_SORT_DIRECTION) params.dir = state.sort.direction

  return params
}

/**
 * A stable string identifying a list query, for watchers that must fire on a *changed* query
 * rather than a changed object: `parseRecordQueryState` returns a fresh object on every
 * `route.query` change, so a watcher on it would refetch when the detail dialog moves. Keys are
 * sorted, and a repeated param's values were sorted on the way out, so param order cannot
 * fabricate a change either.
 */
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
