import type { TFieldType } from '#shared/types/field'

export const FIELD_TYPES = ['TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT', 'RELATION'] as const

export const FIELD_TYPE_LABELS: Record<TFieldType, string> = {
  TEXT: 'Text',
  NUMBER: 'Number',
  BOOLEAN: 'Checkbox',
  DATE: 'Date',
  SELECT: 'Select',
  RELATION: 'Link to table',
}
