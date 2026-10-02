import type { FIELD_TYPES } from '#shared/field-types/registry'
import type { TBadgeColor } from '#shared/types/color'

export type TFieldType = (typeof FIELD_TYPES)[number]

export interface IFieldChoice {
  value: string
  color: TBadgeColor
}

export interface IFieldOptions {
  choices?: IFieldChoice[]
  targetTableId?: string
  labelFieldKey?: string
  multiple?: boolean
}

export interface IField {
  id: string
  name: string
  key: string
  type: TFieldType
  required: boolean
  options: IFieldOptions | null
  order: number
  indexed: boolean
}
