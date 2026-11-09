import { z } from 'zod'
import type { IFieldTypeModule } from '#shared/field-types/types'

function relationReference(): z.ZodType<string> {
  return z.string().min(1, 'Choose a record')
}

export const RELATION_FIELD_TYPE: IFieldTypeModule<'RELATION'> = {
  label: 'Link to table',
  canBeMultiValue: true,
  filter: { shape: 'scalar', empty: '' },
  value: {
    base: relationReference,
    listBase: relationReference,
    blank: null,
    fromQuery: (raw) => raw,
  },
}
