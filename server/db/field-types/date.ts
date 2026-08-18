import { jsonText, matchesText, withinRange } from '#server/db/field-types/fragments'
import type { IFieldSqlModule } from '#server/db/field-types/types'

export const DATE_FIELD_SQL: IFieldSqlModule = {
  // Stored as `YYYY-MM-DD`, so text comparison is already chronological — and searching
  // `2026-07` naturally matches a month
  sql: { expr: jsonText, searchPredicate: matchesText, filter: withinRange },
  multi: null,
}
