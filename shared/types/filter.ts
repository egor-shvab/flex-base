import type { TFieldType } from '#shared/types/field'
import type { IDateRange, INumberRange } from '#shared/types/range'

export type TSortDirection = 'asc' | 'desc'

export interface IRecordSort {
  /** A `Field.key`, or `DEFAULT_SORT_KEY` for the record's own creation order. */
  key: string
  direction: TSortDirection
}

/**
 * Every value a filter control can hold — one per field, whatever its type. `string[]` is the
 * list shape, which a multi-value field also stores, so `TRecordValue` stays a subset of this.
 * Anything narrowing by `typeof value === 'object'` must exclude arrays (`isRangeFilterValue`).
 */
export type TFilterValue = string | string[] | number | boolean | null | INumberRange | IDateRange

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
  /** Several choices, ORed — picking Won and Lost matches either. */
  SELECT: string[]
  /**
   * The target record's **address** — the number a URL carries, or a cuid from an older link.
   * A string either way, because a URL has nothing else; the server resolves it to the stored
   * id before the comparison.
   */
  RELATION: string
}

/**
 * The filter model of every layer: active filters keyed by `Field.key`. An absent key — or one
 * whose value `isFilterValueEmpty` — is not filtered.
 *
 * **Exactly one value is translated before the SQL is derived**: a RELATION filter carries the
 * target's *address*, and `RelationService.resolveFilterTargets` substitutes the stored id,
 * above `buildRecordWhere` so the SQL never learns there were two forms (`docs/decisions.md`).
 */
export type TRecordFilterValues = Record<string, TFilterValue>

/** What `FILTER_VALUE_BY_TYPE` declares for one field type. */
export interface IFilterValueRules<TValue extends TFilterValue> {
  /**
   * One param named after the field (`scalar`), that param repeated per value (`list`), or a
   * `_from` / `_to` pair (`range`). Drives the params the field claims and how it compares in
   * SQL. `list` shares `scalar`'s name because a repeat carries several values without a
   * delimiter to escape, and a choice's text may contain any character.
   */
  shape: 'scalar' | 'list' | 'range'
  /** What a control shows when its field is not filtered. */
  empty: TValue
}

/** Which part of a field's value a claimed query param carries. */
export type TFilterParamPart = 'value' | 'from' | 'to'
