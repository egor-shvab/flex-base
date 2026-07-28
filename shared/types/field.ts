import type { FIELD_TYPES } from '#shared/constants/field'

export type TFieldType = (typeof FIELD_TYPES)[number]

export interface IFieldOptions {
  choices?: string[]
  targetTableId?: string
}

export interface IField {
  id: string
  name: string
  key: string
  type: TFieldType
  required: boolean
  options: IFieldOptions | null
  order: number
}
