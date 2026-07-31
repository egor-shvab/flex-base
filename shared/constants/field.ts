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

/**
 * How a BOOLEAN reads to a user, everywhere it is shown — the cell, the filter control
 * and the filter summary. One source, so a checkbox can never say "Yes" in one place
 * and "True" in another.
 */
export const BOOLEAN_LABELS = { true: 'Yes', false: 'No' } as const
