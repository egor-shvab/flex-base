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
  // Several choices at once, ORed — the only list-shaped *filter* a single-value field has.
  // Search still matches the stored text, which is the choice's own label.
  sql: { expr: jsonText, searchPredicate: matchesText, filter: matchesAny },
  // The stored list is compared for overlap with the filtered one, and searched element-wise
  multi: {
    expr: jsonArray,
    sortExpr: firstElement,
    searchPredicate: matchesAnyElement,
    filter: containsAny,
  },
}
