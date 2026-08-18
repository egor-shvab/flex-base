import { z } from 'zod'
import type { IFieldTypeModule } from '#shared/field-types/types'

/** A target record's id — the same schema whether a field holds one or several. */
function relationId(): z.ZodType<string> {
  return z.string().min(1, 'Choose a record')
}

export const RELATION_FIELD_TYPE: IFieldTypeModule<'RELATION'> = {
  label: 'Link to table',
  // Several target records at once
  multiValue: true,
  // The target record's id — a picker offers the candidates, so it compares exactly
  filter: { shape: 'scalar', empty: '' },
  value: {
    // A target record's id. That the record exists is a database question, so the server
    // layers `assertRelationTargets` on top of what is knowable here.
    base: relationId,
    listBase: relationId,
    blank: null,
    fromQuery: (raw) => raw,
  },
}
