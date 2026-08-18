import { z } from 'zod'
import type { IFieldTypeModule } from '#shared/field-types/types'

/**
 * How a BOOLEAN reads to a user, everywhere it is shown — the cell, the filter control
 * and the filter summary. One source, so a checkbox can never say "Yes" in one place
 * and "True" in another.
 */
export const BOOLEAN_LABELS = { true: 'Yes', false: 'No' } as const

export const BOOLEAN_FIELD_TYPE: IFieldTypeModule<'BOOLEAN'> = {
  label: 'Checkbox',
  multiValue: false,
  /** `null` is "All" — a two-state control cannot express "either". */
  filter: { shape: 'scalar', empty: null },
  value: {
    base: () => z.boolean(),
    listBase: null,
    // `false` is a real value, so a checkbox is never "missing" and `required` is a no-op
    blank: false,
    fromQuery: (raw) => raw === 'true',
  },
}
