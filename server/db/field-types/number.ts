import { jsonCast, matchesText, withinRange } from '#server/db/field-types/fragments'
import type { IFieldSqlModule } from '#server/db/field-types/types'

export const NUMBER_FIELD_SQL: IFieldSqlModule = {
  sql: {
    expr: (key) => jsonCast(key, 'number'),
    searchPredicate: matchesText,
    filter: withinRange,
    sortJoin: null,
    filterIndex: 'btree',
    sortIndex: 'btree',
  },
  multi: null,
}
