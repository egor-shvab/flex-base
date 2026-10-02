import type { z } from 'zod'
import type { IField, TFieldType } from '#shared/types/field'
import type { IFilterValueByType, IFilterValueRules } from '#shared/types/filter'
import type { TRecordSingleValue } from '#shared/types/record'

export interface IValueSchemaRules {
  base: (field: IField) => z.ZodType<TRecordSingleValue>
  listBase: ((field: IField) => z.ZodType<string>) | null
  blank: TRecordSingleValue
  fromQuery: (raw: string) => unknown
}

export interface IFieldTypeModule<K extends TFieldType> {
  label: string
  multiValue: boolean
  filter: IFilterValueRules<IFilterValueByType[K]>
  value: IValueSchemaRules
}
