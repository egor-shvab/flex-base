import { BOOLEAN_FIELD_SQL } from '#server/db/field-types/boolean'
import { DATE_FIELD_SQL } from '#server/db/field-types/date'
import { NUMBER_FIELD_SQL } from '#server/db/field-types/number'
import { RELATION_FIELD_SQL } from '#server/db/field-types/relation'
import { SELECT_FIELD_SQL } from '#server/db/field-types/select'
import { TEXT_FIELD_SQL } from '#server/db/field-types/text'
import type { IFieldSqlModule, IFieldSqlRules } from '#server/db/field-types/types'
import { isMultiValue } from '#shared/field-types/cardinality'
import type { IField, TFieldType } from '#shared/types/field'

/**
 * **The only file that enumerates the field types on the SQL side.** Total, so a new field
 * type must declare how it projects, how it compares and whether it is searchable. There is no
 * operator to look up: the field type says how it compares, and the value's shape says with
 * how many bounds.
 */
const MODULES: Record<TFieldType, IFieldSqlModule> = {
  TEXT: TEXT_FIELD_SQL,
  NUMBER: NUMBER_FIELD_SQL,
  BOOLEAN: BOOLEAN_FIELD_SQL,
  DATE: DATE_FIELD_SQL,
  SELECT: SELECT_FIELD_SQL,
  RELATION: RELATION_FIELD_SQL,
}

export const FIELD_SQL_BY_TYPE: Record<TFieldType, IFieldSqlRules> = {
  TEXT: MODULES.TEXT.sql,
  NUMBER: MODULES.NUMBER.sql,
  BOOLEAN: MODULES.BOOLEAN.sql,
  DATE: MODULES.DATE.sql,
  SELECT: MODULES.SELECT.sql,
  RELATION: MODULES.RELATION.sql,
}

/**
 * How a field behaves when it holds **several** values. Consulted before `FIELD_SQL_BY_TYPE`
 * for a field whose `options.multiple` is set; `null` means the type has no multi form.
 */
export const MULTI_SQL: Record<TFieldType, IFieldSqlRules | null> = {
  TEXT: MODULES.TEXT.multi,
  NUMBER: MODULES.NUMBER.multi,
  BOOLEAN: MODULES.BOOLEAN.multi,
  DATE: MODULES.DATE.multi,
  SELECT: MODULES.SELECT.multi,
  RELATION: MODULES.RELATION.multi,
}

/**
 * The one place a field's cardinality is resolved into SQL behaviour. Every projection,
 * comparison and ordering goes through it, so no builder branches on `multiple` itself.
 */
export function sqlFor(field: IField): IFieldSqlRules {
  return (isMultiValue(field) ? MULTI_SQL[field.type] : null) ?? FIELD_SQL_BY_TYPE[field.type]
}
