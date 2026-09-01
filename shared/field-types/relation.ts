import { z } from 'zod'
import type { IFieldTypeModule } from '#shared/field-types/types'

/**
 * A reference to a target record — the same schema whether a field holds one or several.
 *
 * Deliberately no narrower than "non-empty". A stored value is the target's **id**, but a
 * *filter* value is its **address** (the number a URL carries, or an id from an older link),
 * and this one schema validates both: whether the reference resolves is a database question,
 * which `assertRelationTargets` answers for a write and `resolveFilterTargets` for a filter.
 */
function relationReference(): z.ZodType<string> {
  return z.string().min(1, 'Choose a record')
}

export const RELATION_FIELD_TYPE: IFieldTypeModule<'RELATION'> = {
  label: 'Link to table',
  // Several target records at once
  multiValue: true,
  // The target record's address — a picker offers the candidates, so it compares exactly once
  // the server has resolved it back to the stored id
  filter: { shape: 'scalar', empty: '' },
  value: {
    base: relationReference,
    listBase: relationReference,
    blank: null,
    fromQuery: (raw) => raw,
  },
}
