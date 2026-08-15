import type { Component } from 'vue'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import type { TRecordSingleValue, TRecordValue } from '#shared/types/record'

/**
 * How one field type's value drives a `Base*` control — the shape both per-type control
 * tables share. `TValue` is the value the field's own model speaks: a record value when
 * the control edits a record, a filter value when it expresses a filter.
 *
 * The adapters exist only for a control whose model is a different shape, so a filter
 * whose value passes straight through omits both. Only `fromControl` is tied to `TValue`
 * — it is the direction that lands back in the model, and a widened parameter is what
 * keeps the map callable for any field.
 */
export interface IFieldControl<TValue extends TFilterValue> {
  component: Component
  props: (field: IField) => Record<string, unknown>
  toControl?: (value: TFilterValue) => TFilterValue
  fromControl?: (model: TFilterValue) => TValue
}

/**
 * A record input always adapts — a DOM control speaks strings and checkboxes, never
 * `TRecordValue` — so both directions are mandatory and `DynamicForm` never branches.
 */
export type TRecordFieldControl = Required<IFieldControl<TRecordValue>>

/**
 * Uniform contract every field cell component honours — the same `(field, value)` pair the
 * control tables get. Blank values never reach a cell. Most cells read the value alone; a
 * relation needs the field to know which link it is resolving.
 *
 * **`TRecordSingleValue`, not `TRecordValue`.** A per-type cell renders exactly one value:
 * `MultiValueCell` is what a list resolves to, and it hands each entry back to one of these.
 * Declaring the wider union here would be a type that no cell honours — and because
 * `defineProps<T>()` compiles to a *runtime* prop check, it would also add `Array` to the
 * accepted types of nine components that cannot render one.
 */
export interface IFieldCellProps {
  field: IField
  value: TRecordSingleValue
}

/**
 * What a field-detail component receives: the field and nothing else. It states how one type is
 * *configured* — a SELECT's choice count, a RELATION's target — beside the type's own word, so
 * a field list can be read without opening a dialog per row.
 *
 * No `value`, which is what separates it from `IFieldCellProps`: a detail is about the field's
 * metadata, and no record is involved.
 *
 * Cardinality is deliberately **not** its business. `isMultiValue(field)` is guarded by
 * `MULTI_VALUE_BY_TYPE` and answers for any type, so the caller renders that part itself rather
 * than every detail component repeating it.
 */
export interface IFieldDetailProps {
  field: IField
}

/**
 * `MultiValueCell`'s own contract. Separate from `IFieldCellProps` rather than a widening of
 * it, because the two are opposites: this is the only cell that takes a list, and every other
 * one is the thing it delegates each entry to.
 *
 * Always a real array — `cellValues` normalises at the seam, so the pre-migration scalar case
 * is handled in one place instead of in every cell that might meet one.
 */
export interface IMultiValueCellProps {
  field: IField
  value: string[]
}
