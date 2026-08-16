import { DEFAULT_SORT_DIR, DEFAULT_SORT_KEY, FILTER_VALUES_MAX } from '#shared/constants/filter'
import type { IField } from '#shared/types/field'
import type { TFilterParamRole, TFilterValue, TRecordFilterValues } from '#shared/types/filter'
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
  queryFields,
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
 * Every value a repeated param carries (`?stage=Won&stage=Lost`). A router hands one repeat
 * over as a bare string and several as an array, so both are read here; empties are dropped
 * for the same reason `filterParamValue` drops them.
 */
function filterParamValues(query: Record<string, unknown>, name: string): string[] {
  const raw = query[name]
  const list = Array.isArray(raw) ? raw : [raw]

  return list.filter((entry): entry is string => typeof entry === 'string' && entry !== '')
}

/**
 * A decoded bound is whatever the field's value schema produced — a number for NUMBER, an
 * ISO string for DATE — so a pair always matches one of the two range shapes. Narrowed by
 * shape rather than by field type, and a bound of neither shape simply reads as "no bound".
 */
function toRange(from: TRecordSingleValue, to: TRecordSingleValue): INumberRange | IDateRange {
  if (typeof from === 'number' || typeof to === 'number') {
    return { from: typeof from === 'number' ? from : null, to: typeof to === 'number' ? to : null }
  }

  return { from: typeof from === 'string' ? from : null, to: typeof to === 'string' ? to : null }
}

/**
 * Every decoded value of a repeated param, deduplicated and capped. The cap is the codec's
 * own, not a restatement of the schema's: this reader also runs on the client over an
 * unvalidated `route.query`, where nothing has rejected a crafted link yet.
 */
function toList(field: IField, query: Record<string, unknown>, name: string): string[] {
  const schema = buildFilterValueSchema(field)
  const decoded = new Set<string>()

  for (const raw of filterParamValues(query, name)) {
    const parsed = schema.safeParse(raw)
    // Every list-shaped filter carries strings — a SELECT choice, or a relation target's id —
    // so the guard is what proves that to the compiler rather than a narrowing that can fail
    if (parsed.success && typeof parsed.data === 'string') decoded.add(parsed.data)
  }

  return [...decoded].slice(0, FILTER_VALUES_MAX)
}

/**
 * Decodes the filter params into one typed value per filtered field, in field order, so the
 * map — and the URL built back from it — stays stable. Shared, so the client's panel and the
 * server's query read a link identically. Values that do not decode are dropped; the query
 * schema rejects them as a 400 first.
 */
function parseFilterValues(fields: IField[], query: Record<string, unknown>): TRecordFilterValues {
  // One decoded value per claimed param — a repeat is only read by a list shape, which
  // collects into `listsByKey` instead, so nothing here is ever an array
  const partsByKey = new Map<string, Partial<Record<TFilterParamRole, TRecordSingleValue>>>()
  const listsByKey = new Map<string, string[]>()
  // The record's own columns filter alongside its table's fields, so the seam is applied
  // here rather than by each caller — the page and the endpoint decode a link identically
  const columns = queryFields(fields)

  for (const { field, role, name } of claimFilterParams(columns)) {
    // A list claims one param name and reads every repeat of it, so it collects whole
    // rather than by role — there is only ever one slot
    if (filterShapeFor(field) === 'list') {
      listsByKey.set(field.key, toList(field, query, name))
      continue
    }

    const raw = filterParamValue(query, name)
    if (raw === null) continue

    const parsed = buildFilterValueSchema(field).safeParse(raw)
    if (!parsed.success) continue

    const parts = partsByKey.get(field.key) ?? {}
    parts[role] = parsed.data
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
 * Reads a whole list query from flat params — the exact inverse of `toRecordQueryParams`,
 * used by the records page over `route.query` and by the records endpoint over the params
 * its schema validated, so the page and the API can never decode a link differently.
 * Lenient by design: rejecting an unknown sort key or a malformed value is the schema's job.
 */
export function parseRecordQueryState(
  fields: IField[],
  query: Record<string, unknown>,
): IRecordQueryState {
  const page = Number(singleParam(query.page) ?? 1)
  const dir = singleParam(query.dir)

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    sort: {
      key: singleParam(query.sort) ?? DEFAULT_SORT_KEY,
      dir: dir === 'asc' || dir === 'desc' ? dir : DEFAULT_SORT_DIR,
    },
    filters: parseFilterValues(fields, query),
    // `singleParam` already collapses an empty param, a repeat and an absence to `undefined`,
    // so `?search=` reads as "not searching" exactly like an absent one. Trimmed for the same
    // reason a scalar filter is — a crafted `?search=%20%20` is blank, not a two-space term —
    // which also keeps this state matching the term the schema and the SQL will actually use.
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
      // Sorted, so the same selection always writes the same URL however it was clicked —
      // which is what keeps `recordQueryKey` from reporting a change nobody made
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

  // A filter never writes a reserved param — the exact counterpart of `claimFilterParams`
  // never reading one back, so a legacy field keyed `search` or `detail` can neither leak its
  // value into the reserved slot nor claim one. Dropped rather than left to be overwritten by
  // the assignments below: those only fire when the value differs from its default, so on the
  // default view (`search: ''`, `page: 1`) there is nothing to overwrite it with.
  for (const [name, value] of Object.entries(toFilterParams(state.filters))) {
    if (!isReservedParam(name)) params[name] = value
  }

  if (state.search) params.search = state.search
  if (state.page > 1) params.page = String(state.page)
  if (state.sort.key !== DEFAULT_SORT_KEY) params.sort = state.sort.key
  if (state.sort.dir !== DEFAULT_SORT_DIR) params.dir = state.sort.dir

  return params
}

/**
 * A stable string identifying a list query, for watchers that must fire on a *changed* query
 * rather than on a changed object. `parseRecordQueryState` returns a fresh object on every
 * `route.query` change, so a watcher on it would refetch the whole list when a param the list
 * does not own — the open detail dialog — moves. Keys are sorted, so param order cannot
 * fabricate a change either; a repeated param's values were already sorted on the way out,
 * so `?stage=Won&stage=Lost` and `?stage=Lost&stage=Won` key identically.
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
