import { z } from 'zod'
import type { IFieldTypeModule } from '#shared/field-types/types'

export const TEXT_MAX_LENGTH = 1000

export const TEXT_FIELD_TYPE: IFieldTypeModule<'TEXT'> = {
  label: 'Text',
  multiValue: false,
  filter: { shape: 'scalar', empty: '' },
  value: {
    base: () =>
      z.string().trim().max(TEXT_MAX_LENGTH, `Must be at most ${TEXT_MAX_LENGTH} characters`),
    listBase: null,
    blank: null,
    fromQuery: (raw) => raw,
  },
}
