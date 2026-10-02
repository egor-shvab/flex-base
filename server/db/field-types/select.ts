import {
  containsAny,
  firstElement,
  jsonArray,
  jsonText,
  matchesAny,
  matchesAnyElement,
  matchesText,
} from '#server/db/field-types/fragments'
import type { IFieldSqlModule } from '#server/db/field-types/types'

export const SELECT_FIELD_SQL: IFieldSqlModule = {
  sql: {
    expr: jsonText,
    searchPredicate: matchesText,
    filter: matchesAny,
    sortJoin: null,
    filterIndex: 'btree',
    sortIndex: 'btree',
  },
  multi: {
    expr: jsonArray,
    sortExpr: firstElement,
    searchPredicate: matchesAnyElement,
    filter: containsAny,
    sortJoin: null,
    filterIndex: 'gin',
    sortIndex: 'btree',
  },
}
