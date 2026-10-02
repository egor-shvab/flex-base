import type { TFieldType } from '#shared/types/field'
import type { IDateRange, INumberRange } from '#shared/types/range'

export type TSortDirection = 'asc' | 'desc'

export interface IRecordSort {
  key: string
  direction: TSortDirection
}

export type TFilterValue = string | string[] | number | boolean | null | INumberRange | IDateRange

export interface IFilterValueByType extends Record<TFieldType, TFilterValue> {
  TEXT: string
  NUMBER: INumberRange
  BOOLEAN: boolean | null
  DATE: IDateRange
  SELECT: string[]
  RELATION: string
}

export type TRecordFilterValues = Record<string, TFilterValue>

export interface IFilterValueRules<TValue extends TFilterValue> {
  shape: 'scalar' | 'list' | 'range'
  empty: TValue
}

export type TFilterParamPart = 'value' | 'from' | 'to'
