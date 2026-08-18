import { Prisma } from '#server/generated/prisma/client'
import { jsonText, matchesExactly, notSearchable } from '#server/db/field-types/fragments'
import type { IFieldSqlModule } from '#server/db/field-types/types'

export const BOOLEAN_FIELD_SQL: IFieldSqlModule = {
  sql: {
    expr: (key) => Prisma.sql`(${jsonText(key)})::boolean`,
    // Not searchable: the stored text is `true`/`false`, so searching `e` would match every
    // record that has the value `false`
    searchPredicate: notSearchable,
    filter: matchesExactly,
  },
  multi: null,
}
