import { z } from 'zod'
import type { IFieldTypeModule } from '#shared/field-types/types'

export const NUMBER_FIELD_TYPE: IFieldTypeModule<'NUMBER'> = {
  label: 'Number',
  multiValue: false,
  filter: { shape: 'range', empty: { from: null, to: null } },
  value: {
    base: () => z.number('Enter a number').finite('Enter a number'),
    listBase: null,
    blank: null,
    fromQuery: (raw) => Number(raw),
  },
}
