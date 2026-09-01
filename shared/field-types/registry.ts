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

/**
 * **The only file that enumerates the field types.** Each module is pinned to its own key, so
 * one annotated for the wrong type fails here rather than declaring the wrong filter shape
 * downstream.
 *
 * Every map below is an explicit total literal rather than `Object.fromEntries`, which would
 * need a cast and lose `FILTER_VALUE_BY_TYPE`'s per-key relation to `IFilterValueByType[K]`.
 * Totality is the point: adding a `TFieldType` is a compile error until every map declares it.
 */
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

/**
 * Which types a field may be configured to hold several values of. `isMultiValue`
 * (`#shared/field-types/cardinality`) is the only reader; nothing else consults the flag.
 */
export const MULTI_VALUE_BY_TYPE: Record<TFieldType, boolean> = {
  TEXT: MODULES.TEXT.multiValue,
  NUMBER: MODULES.NUMBER.multiValue,
  BOOLEAN: MODULES.BOOLEAN.multiValue,
  DATE: MODULES.DATE.multiValue,
  SELECT: MODULES.SELECT.multiValue,
  RELATION: MODULES.RELATION.multiValue,
}

/**
 * The single per-field-type branch point for filtering. No operator anywhere: a type declares
 * the *shape* of its value, that shape names its query params, and the server derives the
 * comparison from the type and the same shape.
 */
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

/** The single per-field-type branch point for record values. */
export const VALUE_SCHEMA_BY_TYPE: Record<TFieldType, IValueSchemaRules> = {
  TEXT: MODULES.TEXT.value,
  NUMBER: MODULES.NUMBER.value,
  BOOLEAN: MODULES.BOOLEAN.value,
  DATE: MODULES.DATE.value,
  SELECT: MODULES.SELECT.value,
  RELATION: MODULES.RELATION.value,
}
