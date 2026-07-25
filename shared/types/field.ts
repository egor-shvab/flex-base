export const FIELD_TYPES = ['TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT', 'RELATION'] as const

export type TFieldType = (typeof FIELD_TYPES)[number]

/** Types a user can create in the MVP — RELATION is deferred to a later milestone. */
export const CREATABLE_FIELD_TYPES = ['TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT'] as const

export const FIELD_TYPE_LABELS: Record<TFieldType, string> = {
  TEXT: 'Text',
  NUMBER: 'Number',
  BOOLEAN: 'Checkbox',
  DATE: 'Date',
  SELECT: 'Select',
  RELATION: 'Relation',
}

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
