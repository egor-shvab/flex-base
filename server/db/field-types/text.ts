import { jsonText, matchesPartially, matchesText } from '#server/db/field-types/fragments'
import type { IFieldSqlModule } from '#server/db/field-types/types'

export const TEXT_FIELD_SQL: IFieldSqlModule = {
  sql: { expr: jsonText, searchPredicate: matchesText, filter: matchesPartially },
  multi: null,
}
