import type { FIELD_TYPES } from '#shared/constants/field'

export type TFieldType = (typeof FIELD_TYPES)[number]

export interface IFieldOptions {
  choices?: string[]
  /** RELATION: the table its values point at. Immutable — changing it would orphan every id. */
  targetTableId?: string
  /** RELATION: which of the target's fields labels a linked record, in the UI and in ORDER BY. */
  labelFieldKey?: string
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
