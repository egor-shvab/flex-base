import { BOOLEAN_FIELD_TYPE } from '#shared/field-types/boolean'
import { DATE_FIELD_TYPE } from '#shared/field-types/date'
import { NUMBER_FIELD_TYPE } from '#shared/field-types/number'
import { RELATION_FIELD_TYPE } from '#shared/field-types/relation'
import { SELECT_FIELD_TYPE } from '#shared/field-types/select'
import { TEXT_FIELD_TYPE } from '#shared/field-types/text'
import type { IFieldTypeModule, IValueSchemaRules } from '#shared/field-types/types'
import type { TFieldType } from '#shared/types/field'
import type { IFilterValueByType, IFilterValueRules } from '#shared/types/filter'

export const FIELD_TYPES = ['TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT', 'RELATION'] as const

const MODULES: { [K in TFieldType]: IFieldTypeModule<K> } = {
  TEXT: TEXT_FIELD_TYPE,
  NUMBER: NUMBER_FIELD_TYPE,
  BOOLEAN: BOOLEAN_FIELD_TYPE,
  DATE: DATE_FIELD_TYPE,
  SELECT: SELECT_FIELD_TYPE,
  RELATION: RELATION_FIELD_TYPE,
}

export const FIELD_TYPE_LABELS: Record<TFieldType, string> = {
  TEXT: MODULES.TEXT.label,
  NUMBER: MODULES.NUMBER.label,
  BOOLEAN: MODULES.BOOLEAN.label,
  DATE: MODULES.DATE.label,
  SELECT: MODULES.SELECT.label,
  RELATION: MODULES.RELATION.label,
}

export const MULTI_VALUE_BY_TYPE: Record<TFieldType, boolean> = {
  TEXT: MODULES.TEXT.multiValue,
  NUMBER: MODULES.NUMBER.multiValue,
  BOOLEAN: MODULES.BOOLEAN.multiValue,
  DATE: MODULES.DATE.multiValue,
  SELECT: MODULES.SELECT.multiValue,
  RELATION: MODULES.RELATION.multiValue,
}

export const FILTER_VALUE_BY_TYPE: {
  [K in TFieldType]: IFilterValueRules<IFilterValueByType[K]>
} = {
  TEXT: MODULES.TEXT.filter,
  NUMBER: MODULES.NUMBER.filter,
  BOOLEAN: MODULES.BOOLEAN.filter,
  DATE: MODULES.DATE.filter,
  SELECT: MODULES.SELECT.filter,
  RELATION: MODULES.RELATION.filter,
}

export const VALUE_SCHEMA_BY_TYPE: Record<TFieldType, IValueSchemaRules> = {
  TEXT: MODULES.TEXT.value,
  NUMBER: MODULES.NUMBER.value,
  BOOLEAN: MODULES.BOOLEAN.value,
  DATE: MODULES.DATE.value,
  SELECT: MODULES.SELECT.value,
  RELATION: MODULES.RELATION.value,
}
