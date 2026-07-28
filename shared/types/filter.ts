import type { TFieldType } from '#shared/types/field'
import type { IDateRange, INumberRange } from '#shared/types/range'

export type TSortDirection = 'asc' | 'desc'

export interface IRecordSort {
  /** A `Field.key`, or `DEFAULT_SORT_KEY` for the record's own creation order. */
  key: string
  dir: TSortDirection
}

/** Every value a filter control can hold — one per field, whatever its type. */
export type TFilterValue = string | number | boolean | null | INumberRange | IDateRange

/**
 * The value shape each field type's control speaks. Extending the total `Record` makes a
 * missing field type a compile error, so a new type cannot ship without declaring one.
 */
export interface IFilterValueByType extends Record<TFieldType, TFilterValue> {
  TEXT: string
  NUMBER: INumberRange
  /** `null` is "All" — a two-state control cannot express "either". */
  BOOLEAN: boolean | null
  DATE: IDateRange
  SELECT: string
  RELATION: string
}

/**
 * The filter model of every layer: active filters keyed by `Field.key`. A key that is
 * absent — or whose value `isFilterValueEmpty` — is not filtered. The UI holds this, the
 * URL carries it, and the SQL is derived from it; nothing translates it into anything else.
 */
export type TRecordFilterValues = Record<string, TFilterValue>

/** What `FILTER_VALUE_BY_TYPE` declares for one field type. */
export interface IFilterValueSpec<TValue extends TFilterValue> {
  /**
   * One param named after the field (`scalar`) or a `_from` / `_to` pair (`range`).
   * Drives both the params the field claims and how its value compares in SQL.
   */
  shape: 'scalar' | 'range'
  /** What a control shows when its field is not filtered. */
  empty: TValue
}

/** Which part of a field's value a claimed query param carries. */
export type TFilterParamRole = 'value' | 'from' | 'to'
