import type { TSortDirection } from '#shared/types/filter'

/**
 * The record's own columns, which sort and filter alongside a table's fields. Their keys are
 * camelCase, which `slugify` can never emit, so a field key can never shadow one.
 */
export const RECORD_NUMBER_KEY = 'recordNumber'
export const CREATED_AT_KEY = 'createdAt'
export const UPDATED_AT_KEY = 'updatedAt'

/** Sorting falls back to the record's own creation order, which every table has. */
export const DEFAULT_SORT_KEY = CREATED_AT_KEY

/** Newest first: a record added now belongs at the top of page 1, not the end of the last. */
export const DEFAULT_SORT_DIRECTION: TSortDirection = 'desc'

/**
 * The record open in the detail dialog, and the trail of records it was reached through.
 * Owned by the page rather than the list endpoint — the list request never carries it.
 */
export const DETAIL_PARAM = 'detail'

/**
 * Query params the records URL owns — the list endpoint's, plus the page's own dialog state.
 * A field key must never shadow one, or its filter would fight pagination, sorting or the
 * open dialog for the same name.
 */
export const RESERVED_QUERY_PARAMS = [
  'page',
  'pageSize',
  'sort',
  'dir',
  'search',
  DETAIL_PARAM,
] as const

/**
 * Below this, a search is not run at all. **Three because that is a trigram**: a `gin_trgm_ops`
 * GIN cannot serve a shorter term, which then scans every row to narrow almost nothing. The
 * floor lives in the query schema, not only the input, so it holds for any caller.
 */
export const SEARCH_MIN_LENGTH = 3

/**
 * How many values one list-shaped filter may carry. A repeated param is the only place a single
 * filter grows without bound, and every value becomes a term of an `IN (…)`, so a crafted URL
 * would compose arbitrarily large SQL. A ceiling, not a product rule.
 */
export const FILTER_VALUES_MAX = 50

/**
 * The same keys, as the field-key guard reads them. `slugify` emits only `^[a-z0-9_]+$`, so
 * these are already unreachable — the reservation keeps that true if the slug rules change.
 */
export const RESERVED_FIELD_KEYS = [RECORD_NUMBER_KEY, CREATED_AT_KEY, UPDATED_AT_KEY] as const
