import { Prisma } from '#server/generated/prisma/client'
import { jsonText, matchesText, withinRange } from '#server/db/field-types/fragments'
import type { IFieldSqlModule } from '#server/db/field-types/types'

export const NUMBER_FIELD_SQL: IFieldSqlModule = {
  sql: {
    // Without the cast, `"10" < "9"` would compare as text — but search matches the un-cast
    // text, so typing `100` also finds `1000`, which is what a substring search should do
    expr: (key) => Prisma.sql`(${jsonText(key)})::numeric`,
    searchPredicate: matchesText,
    filter: withinRange,
    sortJoin: null,
    filterIndex: 'btree',
    sortIndex: 'btree',
  },
  multi: null,
}
