import type { TSortDirection } from '#shared/types/filter'

export const RECORD_NUMBER_KEY = 'recordNumber'
export const CREATED_AT_KEY = 'createdAt'
export const UPDATED_AT_KEY = 'updatedAt'

export const DEFAULT_SORT_KEY = CREATED_AT_KEY

export const DEFAULT_SORT_DIRECTION: TSortDirection = 'desc'

export const DETAIL_PARAM = 'detail'

export const RESERVED_QUERY_PARAMS = [
  'page',
  'pageSize',
  'sort',
  'dir',
  'search',
  DETAIL_PARAM,
] as const

/** Three because that is a trigram: a `gin_trgm_ops` index cannot serve a shorter term. */
export const SEARCH_MIN_LENGTH = 3

export const FILTER_VALUES_MAX = 50

export const RESERVED_FIELD_KEYS = [RECORD_NUMBER_KEY, CREATED_AT_KEY, UPDATED_AT_KEY] as const
