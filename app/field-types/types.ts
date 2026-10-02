import type { Component } from 'vue'
import type { IField, TFieldType } from '#shared/types/field'
import type { IFilterValueByType, TFilterValue } from '#shared/types/filter'
import type { ILinkedRecord, TRecordSingleValue, TRecordValue } from '#shared/types/record'

export interface IFieldControl<TValue extends TFilterValue> {
  component: Component
  props: (field: IField) => Record<string, unknown>
  toControl?: (value: TFilterValue) => TFilterValue
  fromControl?: (model: TFilterValue) => TValue
}

export type TRecordFieldControl = Required<IFieldControl<TRecordValue>>

/**
 * `TRecordSingleValue`, not `TRecordValue`: `defineProps<T>()` compiles to a runtime check, and
 * the wider union would accept `Array` in cells that cannot render one.
 */
export interface IFieldCellProps {
  field: IField
  value: TRecordSingleValue
}

export interface IMultiValueCellProps {
  field: IField
  value: string[]
}

export interface IFilterSummaryContext {
  linkedRecordByNumber: (fieldId: string, number: number) => ILinkedRecord | undefined
  linkedRecordFor: (fieldId: string, recordId: string) => ILinkedRecord | undefined
}

/**
 * Supplied by the caller: a registry entry would read Pinia's SSR-unsafe module-global instance.
 */
export interface IFieldConfigSummaryContext {
  tableName: (tableId: string) => string | undefined
}

export type TFieldConfigSummary = (field: IField, ctx: IFieldConfigSummaryContext) => string

/**
 * `value` is widened to `TFilterValue`: indexing a mapped type by a union in parameter position
 * collapses to an intersection.
 */
export type TFilterSummary = (
  value: TFilterValue,
  field: IField,
  ctx: IFilterSummaryContext,
) => string

export type TCellAlign = 'start' | 'end'

export interface IAppFieldType<K extends TFieldType> {
  input: TRecordFieldControl
  multiInput: TRecordFieldControl | null
  filter: IFieldControl<IFilterValueByType[K]>
  multiFilter: IFieldControl<TFilterValue> | null
  cell: Component
  summary: TFilterSummary
  multiSummary: TFilterSummary | null
  icon: string
  align: TCellAlign
  configSummary: TFieldConfigSummary | null
}
