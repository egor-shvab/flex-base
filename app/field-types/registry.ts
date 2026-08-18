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
  TFilterSummary,
  TRecordFieldControl,
} from '~/field-types/types'

/**
 * **The only file that enumerates the field types on the client.** Each module is pinned to its
 * own key, so a module annotated for the wrong one fails here rather than handing the filter
 * panel a control whose value shape does not match.
 *
 * Every map below is a total literal assembled from it, so `DynamicForm`, `DynamicTable` and
 * the filter panel never learn which types there are — and adding a `TFieldType` is a compile
 * error until this file declares it.
 *
 * **This file may never import `MultiValueCell`.** That component reads `FIELD_CELLS` back out
 * of here to render each entry of a list, so importing it would make the two import each other —
 * which is why `cellComponent` lives in `cell-resolver.ts` and not beside the map it consults
 * (`docs/decisions.md`).
 *
 * Module scope + the `markRaw` each module applies keep Vue from deep-proxying the component
 * objects and stop the maps being rebuilt on every render.
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
 * The per-field-type branch point for editing a record. Each entry is data, not a component: a
 * `Base*` control, a props factory, and the two adapters between the DOM's value and
 * `TRecordValue`.
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
 * How a field is edited when it holds **several** values — the same control with `multiple`
 * set and the list adapter in place of the scalar one. `null` means the type has no list form,
 * which `MULTI_VALUE_BY_TYPE` already refuses to configure.
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
 * The per-field-type branch point for filtering, and the only place the filter panel learns
 * that field types exist. **No control knows an operator** — the value is the whole contract,
 * and `FILTER_VALUE_BY_TYPE` maps it to conditions at the serialization boundary.
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
 * How a **multi-value** field is filtered. A field holding several values can only be asked
 * whether it holds any of the filtered ones, so its filter is list-shaped whatever its type
 * says — which SELECT's already was, leaving RELATION as the only entry that has to move.
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
 * The per-field-type branch point for displaying a record. Cells stay components rather than
 * collapsing into a `format()` like the inputs did: a boolean renders an icon and a number
 * needs tabular figures, so they carry markup and scoped styles, not just a string. Every one
 * honours `IFieldCellProps`.
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
 * What an active filter reads as in the summary line above the table — the per-field-type
 * branch point for *describing* a filter, as `FIELD_FILTERS` is for editing one.
 *
 * These are plain functions rather than components, unlike `FIELD_CELLS`. The reason cells
 * stayed components is that they carry markup and scoped styles; a summary fragment is a bare
 * string inside a chip, so it collapses into a formatter the way the inputs did.
 *
 * **Record columns need no override here.** `recordNumber` is TEXT-typed and reads
 * "Record # contains 4", which is accurate — it genuinely substring-matches; `createdAt` /
 * `updatedAt` are DATE-typed and their names already read as phrases. Unlike
 * `RECORD_COLUMN_SQL` and `RECORD_COLUMNS`, which exist because those columns live outside
 * `data`, nothing about describing them differs.
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
 * How a **multi-value** field's filter reads. Only RELATION needs an entry: a multi field
 * filters as a list, and SELECT's summary already is one — the same reason `MULTI_FILTERS`
 * leaves it alone.
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
 * The glyph each field type is drawn with. An icon never appears without the type's word beside
 * it — it is the scannable column down a field list, not a replacement for saying what the type
 * is. Plain strings, so there is nothing for Vue to proxy and no `markRaw` to forget.
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
 * How a field's *configuration* reads beside its type — what the field manager shows so a
 * table's shape can be read without opening a dialog per row. Every entry honours
 * `IFieldConfigSummaryProps`.
 *
 * The one control-adjacent registry with **no `MULTI_*` counterpart**: cardinality is answered
 * for every type by `isMultiValue(field)`, so the caller renders that part itself instead of
 * two components repeating it. That is also why callers index this map directly rather than
 * through a resolver — there is no override for one to consult.
 */
export const FIELD_CONFIG_SUMMARIES: Record<TFieldType, Component | null> = {
  TEXT: MODULES.TEXT.configSummary,
  NUMBER: MODULES.NUMBER.configSummary,
  BOOLEAN: MODULES.BOOLEAN.configSummary,
  DATE: MODULES.DATE.configSummary,
  SELECT: MODULES.SELECT.configSummary,
  RELATION: MODULES.RELATION.configSummary,
}

/**
 * The control that edits one field — the single place a field's cardinality is resolved on the
 * form side, so `DynamicForm` never learns that `multiple` exists any more than it knows which
 * field types there are.
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
