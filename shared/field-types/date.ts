import { z } from 'zod'
import type { IFieldTypeModule } from '#shared/field-types/types'

export const DATE_FIELD_TYPE: IFieldTypeModule<'DATE'> = {
  label: 'Date',
  canBeMultiValue: false,
  filter: { shape: 'range', empty: { from: null, to: null } },
  value: {
    // `z.iso.date()`, not a pattern: `2024-02-31` matches `\d{4}-\d{2}-\d{2}` but is no day
    base: () => z.iso.date('Enter a valid date'),
    listBase: null,
    blank: null,
    fromQuery: (raw) => raw,
  },
}
