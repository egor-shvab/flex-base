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
  // Filters on the stored id — which is what a filter's address has been resolved to by the
  // time the SQL is built — but reads and orders by its label.
  // Not searchable: the stored value is a cuid, and matching the label instead would mean
  // joining the target table into the *count* query too, which has no LIMIT to stop it.
  sql: {
    expr: jsonText,
    searchPredicate: notSearchable,
    // The only type that orders by a value in another row, so the only one that joins
    sortJoin: targetLabelJoin,
    filter: matchesExactly,
    filterIndex: 'btree',
    // **No index orders this column**, because the value it orders by is not in it. The join
    // does probe the `filterIndex` above, which is why opting a relation in speeds its
    // ordering as well as its filter.
    sortIndex: null,
  },
  // Same comparison over ids; still not searchable, for the reason above — which the array
  // only strengthens, since matching labels would mean reading every link of every row
  multi: {
    expr: jsonArray,
    sortJoin: targetLabelJoin,
    searchPredicate: notSearchable,
    filter: containsAny,
    filterIndex: 'gin',
    sortIndex: null,
  },
}
