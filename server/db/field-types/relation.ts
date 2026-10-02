import {
  containsAny,
  jsonArray,
  jsonText,
  matchesExactly,
  notSearchable,
  targetLabelJoin,
} from '#server/db/field-types/fragments'
import type { IFieldSqlModule } from '#server/db/field-types/types'

export const RELATION_FIELD_SQL: IFieldSqlModule = {
  sql: {
    expr: jsonText,
    searchPredicate: notSearchable,
    sortJoin: targetLabelJoin,
    filter: matchesExactly,
    filterIndex: 'btree',
    sortIndex: null,
  },
  multi: {
    expr: jsonArray,
    sortJoin: targetLabelJoin,
    searchPredicate: notSearchable,
    filter: containsAny,
    filterIndex: 'gin',
    sortIndex: null,
  },
}
