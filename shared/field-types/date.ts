import { z } from 'zod'
import type { IFieldTypeModule } from '#shared/field-types/types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const DATE_FIELD_TYPE: IFieldTypeModule<'DATE'> = {
  label: 'Date',
  multiValue: false,
  filter: { shape: 'range', empty: { from: null, to: null } },
  value: {
    base: () => z.string().regex(ISO_DATE, 'Enter a valid date'),
    listBase: null,
    blank: null,
    fromQuery: (raw) => raw,
  },
}
