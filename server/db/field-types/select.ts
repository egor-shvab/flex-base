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
  sql: {
    expr: jsonText,
    searchPredicate: matchesText,
    filter: matchesAny,
    sortJoin: null,
    // `IN (…)` is a set of equalities, which is what a B-tree answers best
    filterIndex: 'btree',
    sortIndex: 'btree',
  },
  // The stored list is compared for overlap with the filtered one, and searched element-wise
  multi: {
    expr: jsonArray,
    sortExpr: firstElement,
    searchPredicate: matchesAnyElement,
    filter: containsAny,
    sortJoin: null,
    // `?|` asks about the elements inside the stored array, which only GIN indexes — and on the
    // sub-path `expr` projects to, never on `data` as a whole
    filterIndex: 'gin',
    // …while the ordering is over one extracted element, which is an ordinary scalar again
    sortIndex: 'btree',
  },
}
