import { BOOLEAN_FIELD_SQL } from '#server/db/field-types/boolean'
import { DATE_FIELD_SQL } from '#server/db/field-types/date'
import { NUMBER_FIELD_SQL } from '#server/db/field-types/number'
import { RELATION_FIELD_SQL } from '#server/db/field-types/relation'
import { SELECT_FIELD_SQL } from '#server/db/field-types/select'
import { TEXT_FIELD_SQL } from '#server/db/field-types/text'
import type { IFieldSqlModule, IFieldSqlRules } from '#server/db/field-types/types'
import { isMultiValue } from '#shared/field-types/cardinality'
import type { IField, TFieldType } from '#shared/types/field'

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

export const MULTI_SQL: Record<TFieldType, IFieldSqlRules | null> = {
  TEXT: MODULES.TEXT.multi,
  NUMBER: MODULES.NUMBER.multi,
  BOOLEAN: MODULES.BOOLEAN.multi,
  DATE: MODULES.DATE.multi,
  SELECT: MODULES.SELECT.multi,
  RELATION: MODULES.RELATION.multi,
}

export function sqlFor(field: IField): IFieldSqlRules {
  return (isMultiValue(field) ? MULTI_SQL[field.type] : null) ?? FIELD_SQL_BY_TYPE[field.type]
}
