import { z } from 'zod'
import type { IFieldTypeModule } from '#shared/field-types/types'

export const BOOLEAN_LABELS = { true: 'Yes', false: 'No' } as const

export const BOOLEAN_FIELD_TYPE: IFieldTypeModule<'BOOLEAN'> = {
  label: 'Checkbox',
  multiValue: false,
  filter: { shape: 'scalar', empty: null },
  value: {
    base: () => z.boolean(),
    listBase: null,
    blank: false,
    fromQuery: (raw) => raw === 'true',
  },
}
