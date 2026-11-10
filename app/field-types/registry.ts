import type { Component } from 'vue'
import { isMultiValue } from '#shared/field-types/cardinality'
import type { IField, TFieldType } from '#shared/types/field'
import type { IFilterValueByType, TFilterValue } from '#shared/types/filter'
import { BOOLEAN_APP_FIELD_TYPE } from '~/field-types/boolean'
import { DATE_APP_FIELD_TYPE } from '~/field-types/date'
import { NUMBER_APP_FIELD_TYPE } from '~/field-types/number'
import { RELATION_APP_FIELD_TYPE } from '~/field-types/relation'
import { SELECT_APP_FIELD_TYPE } from '~/field-types/select'
import { TEXT_APP_FIELD_TYPE } from '~/field-types/text'
import type {
  IAppFieldType,
  IFieldControl,
  TCellAlign,
  TFieldConfigSummary,
  TFilterSummary,
  TRecordFieldControl,
} from '~/field-types/types'

/**
 * Must never import `MultiValueCell`, which reads `FIELD_CELLS` back out of here — hence
 * `cellComponent` living in `cell-resolver.ts`.
 */
const MODULES: { [K in TFieldType]: IAppFieldType<K> } = {
  TEXT: TEXT_APP_FIELD_TYPE,
  NUMBER: NUMBER_APP_FIELD_TYPE,
  BOOLEAN: BOOLEAN_APP_FIELD_TYPE,
  DATE: DATE_APP_FIELD_TYPE,
  SELECT: SELECT_APP_FIELD_TYPE,
  RELATION: RELATION_APP_FIELD_TYPE,
}

export const FIELD_INPUTS: Record<TFieldType, TRecordFieldControl> = {
  TEXT: MODULES.TEXT.input,
  NUMBER: MODULES.NUMBER.input,
  BOOLEAN: MODULES.BOOLEAN.input,
  DATE: MODULES.DATE.input,
  SELECT: MODULES.SELECT.input,
  RELATION: MODULES.RELATION.input,
}

const MULTI_INPUTS: Record<TFieldType, TRecordFieldControl | null> = {
  TEXT: MODULES.TEXT.multiInput,
  NUMBER: MODULES.NUMBER.multiInput,
  BOOLEAN: MODULES.BOOLEAN.multiInput,
  DATE: MODULES.DATE.multiInput,
  SELECT: MODULES.SELECT.multiInput,
  RELATION: MODULES.RELATION.multiInput,
}

export const FIELD_FILTERS: { [K in TFieldType]: IFieldControl<IFilterValueByType[K]> } = {
  TEXT: MODULES.TEXT.filter,
  NUMBER: MODULES.NUMBER.filter,
  BOOLEAN: MODULES.BOOLEAN.filter,
  DATE: MODULES.DATE.filter,
  SELECT: MODULES.SELECT.filter,
  RELATION: MODULES.RELATION.filter,
}

const MULTI_FILTERS: Record<TFieldType, IFieldControl<TFilterValue> | null> = {
  TEXT: MODULES.TEXT.multiFilter,
  NUMBER: MODULES.NUMBER.multiFilter,
  BOOLEAN: MODULES.BOOLEAN.multiFilter,
  DATE: MODULES.DATE.multiFilter,
  SELECT: MODULES.SELECT.multiFilter,
  RELATION: MODULES.RELATION.multiFilter,
}

export const FIELD_CELLS: Record<TFieldType, Component> = {
  TEXT: MODULES.TEXT.cell,
  NUMBER: MODULES.NUMBER.cell,
  BOOLEAN: MODULES.BOOLEAN.cell,
  DATE: MODULES.DATE.cell,
  SELECT: MODULES.SELECT.cell,
  RELATION: MODULES.RELATION.cell,
}

export const FILTER_SUMMARIES: Record<TFieldType, TFilterSummary> = {
  TEXT: MODULES.TEXT.summary,
  NUMBER: MODULES.NUMBER.summary,
  BOOLEAN: MODULES.BOOLEAN.summary,
  DATE: MODULES.DATE.summary,
  SELECT: MODULES.SELECT.summary,
  RELATION: MODULES.RELATION.summary,
}

const MULTI_SUMMARIES: Record<TFieldType, TFilterSummary | null> = {
  TEXT: MODULES.TEXT.multiSummary,
  NUMBER: MODULES.NUMBER.multiSummary,
  BOOLEAN: MODULES.BOOLEAN.multiSummary,
  DATE: MODULES.DATE.multiSummary,
  SELECT: MODULES.SELECT.multiSummary,
  RELATION: MODULES.RELATION.multiSummary,
}

export const FIELD_TYPE_ICONS: Record<TFieldType, string> = {
  TEXT: MODULES.TEXT.icon,
  NUMBER: MODULES.NUMBER.icon,
  BOOLEAN: MODULES.BOOLEAN.icon,
  DATE: MODULES.DATE.icon,
  SELECT: MODULES.SELECT.icon,
  RELATION: MODULES.RELATION.icon,
}

const FIELD_CELL_ALIGN: Record<TFieldType, TCellAlign> = {
  TEXT: MODULES.TEXT.align,
  NUMBER: MODULES.NUMBER.align,
  BOOLEAN: MODULES.BOOLEAN.align,
  DATE: MODULES.DATE.align,
  SELECT: MODULES.SELECT.align,
  RELATION: MODULES.RELATION.align,
}

export const FIELD_CONFIG_SUMMARIES: Record<TFieldType, TFieldConfigSummary | null> = {
  TEXT: MODULES.TEXT.configSummary,
  NUMBER: MODULES.NUMBER.configSummary,
  BOOLEAN: MODULES.BOOLEAN.configSummary,
  DATE: MODULES.DATE.configSummary,
  SELECT: MODULES.SELECT.configSummary,
  RELATION: MODULES.RELATION.configSummary,
}

export function inputFor(field: IField): TRecordFieldControl {
  return (isMultiValue(field) ? MULTI_INPUTS[field.type] : null) ?? FIELD_INPUTS[field.type]
}

export function filterFor(field: IField): IFieldControl<TFilterValue> {
  return (isMultiValue(field) ? MULTI_FILTERS[field.type] : null) ?? FIELD_FILTERS[field.type]
}

export function alignFor(field: IField): TCellAlign {
  return FIELD_CELL_ALIGN[field.type]
}

export function summaryFor(field: IField): TFilterSummary {
  return (isMultiValue(field) ? MULTI_SUMMARIES[field.type] : null) ?? FILTER_SUMMARIES[field.type]
}
