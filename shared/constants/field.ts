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

/**
 * Which types a field may be configured to hold several values of. Cardinality is a per-field
 * setting (`options.multiple`) rather than a second field type, so an existing single-value
 * field can be widened in place — a type never can, since `updateField` rejects type changes.
 *
 * Total, so a new `TFieldType` must state its position rather than silently inheriting `false`.
 * `isMultiValue` in `#shared/utils/field` is the only reader; nothing else consults the flag.
 */
export const MULTI_VALUE_BY_TYPE: Record<TFieldType, boolean> = {
  TEXT: false,
  NUMBER: false,
  BOOLEAN: false,
  DATE: false,
  // Several of the field's own choices at once
  SELECT: true,
  // Several target records at once
  RELATION: true,
}
