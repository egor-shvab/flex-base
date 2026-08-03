import { DEFAULT_SORT_DIR, DEFAULT_SORT_KEY, FILTER_VALUE_BY_TYPE } from '#shared/constants/filter'
import type { IField } from '#shared/types/field'
import type { TFilterParamRole, TFilterValue, TRecordFilterValues } from '#shared/types/filter'
import type { IDateRange, INumberRange } from '#shared/types/range'
import type { IRecordQueryState, TRecordValue } from '#shared/types/record'
import {
  claimFilterParams,
  isFilterValueEmpty,
  isRangeFilterValue,
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
 * A decoded bound is whatever the field's value schema produced — a number for NUMBER, an
 * ISO string for DATE — so a pair always matches one of the two range shapes. Narrowed by
 * shape rather than by field type, and a bound of neither shape simply reads as "no bound".
 */
function toRange(from: TRecordValue, to: TRecordValue): INumberRange | IDateRange {
  if (typeof from === 'number' || typeof to === 'number') {
    return { from: typeof from === 'number' ? from : null, to: typeof to === 'number' ? to : null }
  }

  return { from: typeof from === 'string' ? from : null, to: typeof to === 'string' ? to : null }
}

/**
 * Decodes the filter params into one typed value per filtered field, in field order, so the
 * map — and the URL built back from it — stays stable. Shared, so the client's panel and the
 * server's query read a link identically. Values that do not decode are dropped; the query
 * schema rejects them as a 400 first.
 */
function parseFilterValues(fields: IField[], query: Record<string, unknown>): TRecordFilterValues {
  const partsByKey = new Map<string, Partial<Record<TFilterParamRole, TRecordValue>>>()
  // The record's own columns filter alongside its table's fields, so the seam is applied
  // here rather than by each caller — the page and the endpoint decode a link identically
  const columns = queryFields(fields)

  for (const { field, role, name } of claimFilterParams(columns)) {
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
    const parts = partsByKey.get(field.key)
    if (parts === undefined) continue

    const value: TFilterValue =
      FILTER_VALUE_BY_TYPE[field.type].shape === 'range'
        ? toRange(parts.from ?? null, parts.to ?? null)
        : (parts.value ?? null)

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
    // so `?search=` reads as "not searching" exactly like an absent one
    search: singleParam(query.search) ?? '',
  }
}

/**
 * The inverse, for building a URL: `{ company: 'acme', contract_value_from: '100' }`.
 * A param's name follows from the value's shape — a range spreads to its two bounds,
 * a scalar takes the field's bare key.
 */
function toFilterParams(values: TRecordFilterValues): Record<string, string> {
  const params: Record<string, string> = {}

  for (const [key, value] of Object.entries(values)) {
    if (isFilterValueEmpty(value)) continue

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
export function toRecordQueryParams(state: IRecordQueryState): Record<string, string> {
  const params: Record<string, string> = { ...toFilterParams(state.filters) }

  // After the filter spread, like the three below: a legacy field keyed `search` must not
  // overwrite the reserved param (`claimFilterParams` already stops it being read back)
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
 * fabricate a change either.
 */
export function recordQueryKey(state: IRecordQueryState): string {
  const params = toRecordQueryParams(state)

  return Object.keys(params)
    .sort()
    .map((name) => `${name}=${params[name]}`)
    .join('&')
}
