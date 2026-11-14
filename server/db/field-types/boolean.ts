import { jsonCast, matchesExactly, notSearchable } from '#server/db/field-types/fragments'
import type { IFieldSqlModule } from '#server/db/field-types/types'

export const BOOLEAN_FIELD_SQL: IFieldSqlModule = {
  sql: {
    expr: (key) => jsonCast(key, 'boolean'),
    searchPredicate: notSearchable,
    filter: matchesExactly,
    sortJoin: null,
    filterIndex: 'btree',
    sortIndex: 'btree',
  },
  multi: null,
}
