import { Prisma } from '#server/generated/prisma/client'
import { jsonText, matchesText, withinRange } from '#server/db/field-types/fragments'
import type { IFieldSqlModule } from '#server/db/field-types/types'

export const NUMBER_FIELD_SQL: IFieldSqlModule = {
  sql: {
    expr: (key) => Prisma.sql`(${jsonText(key)})::numeric`,
    searchPredicate: matchesText,
    filter: withinRange,
    sortJoin: null,
    filterIndex: 'btree',
    sortIndex: 'btree',
  },
  multi: null,
}
