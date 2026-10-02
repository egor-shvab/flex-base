import { jsonText, matchesText, withinRange } from '#server/db/field-types/fragments'
import type { IFieldSqlModule } from '#server/db/field-types/types'

export const DATE_FIELD_SQL: IFieldSqlModule = {
  sql: {
    expr: jsonText,
    searchPredicate: matchesText,
    filter: withinRange,
    sortJoin: null,
    filterIndex: 'btree',
    sortIndex: 'btree',
  },
  multi: null,
}
