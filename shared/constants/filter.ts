import type { TFieldType } from '#shared/types/field'
import type { IFilterValueByType, IFilterValueSpec, TSortDirection } from '#shared/types/filter'

/** Sorting falls back to the record's own creation order, which every table has. */
export const DEFAULT_SORT_KEY = 'createdAt'

/** Newest first: a record added now belongs at the top of page 1, not the end of the last. */
export const DEFAULT_SORT_DIR: TSortDirection = 'desc'

/**
 * Query params the list endpoint owns. A field key must never shadow one, or its filter
 * would fight pagination or sorting for the same name.
 */
export const RESERVED_QUERY_PARAMS = ['page', 'pageSize', 'sort', 'dir'] as const

/**
 * The single per-field-type branch point for filtering. Typed as a total `Record`, so
 * adding a `TFieldType` fails to compile until its filter value is declared. There is no
 * operator anywhere: a type declares the *shape* of its value, that shape names its query
 * params, and the server derives the comparison from the type and the same shape.
 */
export const FILTER_VALUE_BY_TYPE: {
  [K in TFieldType]: IFilterValueSpec<IFilterValueByType[K]>
} = {
  TEXT: { shape: 'scalar', empty: '' },
  NUMBER: { shape: 'range', empty: { from: null, to: null } },
  BOOLEAN: { shape: 'scalar', empty: null },
  DATE: { shape: 'range', empty: { from: null, to: null } },
  SELECT: { shape: 'scalar', empty: '' },
  // The target record's id — a picker offers the candidates, so it compares exactly
  RELATION: { shape: 'scalar', empty: '' },
}
