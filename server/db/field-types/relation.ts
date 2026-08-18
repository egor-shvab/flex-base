import {
  containsAny,
  jsonArray,
  jsonText,
  matchesExactly,
  notSearchable,
  targetLabel,
} from '#server/db/field-types/fragments'
import type { IFieldSqlModule } from '#server/db/field-types/types'

export const RELATION_FIELD_SQL: IFieldSqlModule = {
  // Filters on the stored id — the picker's own value — but reads and orders by its label.
  // Not searchable: the stored value is a cuid, and matching the label instead would mean
  // `targetLabel`'s correlated subquery per row — two detoasts, a PK descent and a random
  // heap read — against every row, since the count query has no LIMIT.
  sql: {
    expr: jsonText,
    searchPredicate: notSearchable,
    sortExpr: targetLabel,
    filter: matchesExactly,
  },
  // Same comparison over ids; still not searchable, for the reason above — which the array
  // only strengthens, since matching labels would mean the subquery once per link per row
  multi: {
    expr: jsonArray,
    sortExpr: targetLabel,
    searchPredicate: notSearchable,
    filter: containsAny,
  },
}
