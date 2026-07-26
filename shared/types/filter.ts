import type { TFieldType } from '#shared/types/field'
import type { TRecordValue } from '#shared/types/record'

export const FILTER_OPERATORS = ['eq', 'contains', 'gte', 'lte'] as const

export type TFilterOperator = (typeof FILTER_OPERATORS)[number]

/**
 * The single per-field-type branch point for filtering: which operators a type may be
 * filtered with. Typed as a total `Record`, so adding a `TFieldType` fails to compile
 * until its operators are declared. Each filter control implies its own operator, so
 * nothing in the UI reads this to build a picker — it drives server validation and,
 * through `PARAM_SUFFIX_BY_OPERATOR`, the query params a field claims.
 *
 * Invariant: no two operators of one type may share a param suffix, or the field would
 * claim the same param name twice.
 */
export const FILTER_OPERATORS_BY_TYPE: Record<TFieldType, readonly TFilterOperator[]> = {
  TEXT: ['contains'],
  NUMBER: ['gte', 'lte'],
  BOOLEAN: ['eq'],
  DATE: ['gte', 'lte'],
  SELECT: ['eq'],
  // Placeholder until the RELATION milestone — RELATION is not creatable yet
  RELATION: ['eq'],
}

/** One condition. A field may contribute several (a range is `gte` + `lte`); all are ANDed. */
export interface IRecordFilter {
  key: string
  op: TFilterOperator
  value: TRecordValue
}

export type TSortDirection = 'asc' | 'desc'

/** Sorting falls back to the record's own creation order, which every table has. */
export const DEFAULT_SORT_KEY = 'createdAt'

export interface IRecordSort {
  /** A `Field.key`, or `DEFAULT_SORT_KEY` for the record's own creation order. */
  key: string
  dir: TSortDirection
}

/**
 * Filters travel as plain query params named after the field, with the operator implied
 * by the name: `?company=acme&contract_value_from=100&contract_value_to=500`.
 */
const PARAM_SUFFIX_BY_OPERATOR: Record<TFilterOperator, string> = {
  contains: '',
  eq: '',
  gte: '_from',
  lte: '_to',
}

export function filterParamName(fieldKey: string, op: TFilterOperator): string {
  return `${fieldKey}${PARAM_SUFFIX_BY_OPERATOR[op]}`
}

/** Every param name a field of this type claims — used by the codec and the key guard. */
export function filterParamNames(fieldKey: string, type: TFieldType): string[] {
  return FILTER_OPERATORS_BY_TYPE[type].map((op) => filterParamName(fieldKey, op))
}

/**
 * Query params the list endpoint owns. A field key must never shadow one, or its filter
 * would fight pagination or sorting for the same name.
 */
export const RESERVED_QUERY_PARAMS = ['page', 'pageSize', 'sort', 'dir'] as const
