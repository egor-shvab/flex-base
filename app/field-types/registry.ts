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
  TFieldConfigSummary,
  TFilterSummary,
  TRecordFieldControl,
} from '~/field-types/types'

/**
 * **The only file that enumerates the field types on the client.** Each module is pinned to its
 * own key, so one annotated for the wrong type fails here rather than handing the filter panel a
 * control whose value shape does not match. Every map below is a total literal, so adding a
 * `TFieldType` is a compile error until this file declares it.
 *
 * **This file may never import `MultiValueCell`**, which reads `FIELD_CELLS` back out of here —
 * hence `cellComponent` living in `cell-resolver.ts` (`docs/decisions.md`).
 *
 * Module scope plus each module's `markRaw` keep Vue from deep-proxying the component objects.
 */
const MODULES: { [K in TFieldType]: IAppFieldType<K> } = {
  TEXT: TEXT_APP_FIELD_TYPE,
  NUMBER: NUMBER_APP_FIELD_TYPE,
  BOOLEAN: BOOLEAN_APP_FIELD_TYPE,
  DATE: DATE_APP_FIELD_TYPE,
  SELECT: SELECT_APP_FIELD_TYPE,
  RELATION: RELATION_APP_FIELD_TYPE,
}

/**
 * Editing a record. Each entry is data, not a component: a `Base*` control, a props factory,
 * and the two adapters between the DOM's value and `TRecordValue`.
 */
export const FIELD_INPUTS: Record<TFieldType, TRecordFieldControl> = {
  TEXT: MODULES.TEXT.input,
  NUMBER: MODULES.NUMBER.input,
  BOOLEAN: MODULES.BOOLEAN.input,
  DATE: MODULES.DATE.input,
  SELECT: MODULES.SELECT.input,
  RELATION: MODULES.RELATION.input,
}

/**
 * Editing a field that holds **several** values — the same control with `multiple` set and the
 * list adapter. `null` is a type with no list form, which `MULTI_VALUE_BY_TYPE` already refuses.
 */
const MULTI_INPUTS: Record<TFieldType, TRecordFieldControl | null> = {
  TEXT: MODULES.TEXT.multiInput,
  NUMBER: MODULES.NUMBER.multiInput,
  BOOLEAN: MODULES.BOOLEAN.multiInput,
  DATE: MODULES.DATE.multiInput,
  SELECT: MODULES.SELECT.multiInput,
  RELATION: MODULES.RELATION.multiInput,
}

/**
 * Filtering — the only place the filter panel learns field types exist. **No control knows an
 * operator**: the value is the whole contract, and `FILTER_VALUE_BY_TYPE` maps it to conditions
 * at the serialization boundary.
 */
export const FIELD_FILTERS: { [K in TFieldType]: IFieldControl<IFilterValueByType[K]> } = {
  TEXT: MODULES.TEXT.filter,
  NUMBER: MODULES.NUMBER.filter,
  BOOLEAN: MODULES.BOOLEAN.filter,
  DATE: MODULES.DATE.filter,
  SELECT: MODULES.SELECT.filter,
  RELATION: MODULES.RELATION.filter,
}

/**
 * Filtering a **multi-value** field. It can only be asked whether it holds any of the filtered
 * values, so its filter is list-shaped whatever its type says — which SELECT's already is.
 */
const MULTI_FILTERS: Record<TFieldType, IFieldControl<TFilterValue> | null> = {
  TEXT: MODULES.TEXT.multiFilter,
  NUMBER: MODULES.NUMBER.multiFilter,
  BOOLEAN: MODULES.BOOLEAN.multiFilter,
  DATE: MODULES.DATE.multiFilter,
  SELECT: MODULES.SELECT.multiFilter,
  RELATION: MODULES.RELATION.multiFilter,
}

/**
 * Displaying a record. Cells stay components rather than formatters: a boolean renders an icon
 * and a number needs tabular figures, so they carry markup and scoped styles. Every one honours
 * `IFieldCellProps`.
 */
export const FIELD_CELLS: Record<TFieldType, Component> = {
  TEXT: MODULES.TEXT.cell,
  NUMBER: MODULES.NUMBER.cell,
  BOOLEAN: MODULES.BOOLEAN.cell,
  DATE: MODULES.DATE.cell,
  SELECT: MODULES.SELECT.cell,
  RELATION: MODULES.RELATION.cell,
}

/**
 * *Describing* a filter, as `FIELD_FILTERS` is for editing one. Plain functions rather than
 * components, because a summary fragment is a bare string inside a chip.
 *
 * **Record columns need no override here.** `recordNumber` is TEXT-typed and genuinely
 * substring-matches; the timestamps are DATE-typed and their names already read as phrases.
 */
export const FILTER_SUMMARIES: Record<TFieldType, TFilterSummary> = {
  TEXT: MODULES.TEXT.summary,
  NUMBER: MODULES.NUMBER.summary,
  BOOLEAN: MODULES.BOOLEAN.summary,
  DATE: MODULES.DATE.summary,
  SELECT: MODULES.SELECT.summary,
  RELATION: MODULES.RELATION.summary,
}

/**
 * How a **multi-value** field's filter reads. Only RELATION needs an entry — SELECT's summary
 * is already list-shaped, the same reason `MULTI_FILTERS` leaves it alone.
 */
const MULTI_SUMMARIES: Record<TFieldType, TFilterSummary | null> = {
  TEXT: MODULES.TEXT.multiSummary,
  NUMBER: MODULES.NUMBER.multiSummary,
  BOOLEAN: MODULES.BOOLEAN.multiSummary,
  DATE: MODULES.DATE.multiSummary,
  SELECT: MODULES.SELECT.multiSummary,
  RELATION: MODULES.RELATION.multiSummary,
}

/**
 * The glyph each field type is drawn with — never without the type's word beside it. Plain
 * strings, so there is nothing for Vue to proxy and no `markRaw` to forget.
 */
export const FIELD_TYPE_ICONS: Record<TFieldType, string> = {
  TEXT: MODULES.TEXT.icon,
  NUMBER: MODULES.NUMBER.icon,
  BOOLEAN: MODULES.BOOLEAN.icon,
  DATE: MODULES.DATE.icon,
  SELECT: MODULES.SELECT.icon,
  RELATION: MODULES.RELATION.icon,
}

/**
 * How a field's *configuration* reads beside its type, so a table's shape can be read without
 * opening a dialog per row. A phrase, not a component.
 *
 * The one control-adjacent registry with **no `MULTI_*` counterpart**: `isMultiValue(field)`
 * answers cardinality for every type, so the caller renders that part itself — which is also
 * why callers index this map directly rather than through a resolver.
 */
export const FIELD_CONFIG_SUMMARIES: Record<TFieldType, TFieldConfigSummary | null> = {
  TEXT: MODULES.TEXT.configSummary,
  NUMBER: MODULES.NUMBER.configSummary,
  BOOLEAN: MODULES.BOOLEAN.configSummary,
  DATE: MODULES.DATE.configSummary,
  SELECT: MODULES.SELECT.configSummary,
  RELATION: MODULES.RELATION.configSummary,
}

/**
 * The control that edits one field — the single place cardinality is resolved on the form side,
 * so `RecordForm` never learns that `multiple` exists.
 */
export function inputFor(field: IField): TRecordFieldControl {
  return (isMultiValue(field) ? MULTI_INPUTS[field.type] : null) ?? FIELD_INPUTS[field.type]
}

/**
 * The control that filters one field — the filter-side twin of `inputFor`, and the only place
 * the drawer's cardinality branch lives.
 */
export function filterFor(field: IField): IFieldControl<TFilterValue> {
  return (isMultiValue(field) ? MULTI_FILTERS[field.type] : null) ?? FIELD_FILTERS[field.type]
}

/** How one field's active filter reads — the summary-side twin of `inputFor`/`filterFor`. */
export function summaryFor(field: IField): TFilterSummary {
  return (isMultiValue(field) ? MULTI_SUMMARIES[field.type] : null) ?? FILTER_SUMMARIES[field.type]
}
