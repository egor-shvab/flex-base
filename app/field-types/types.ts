import type { Component } from 'vue'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import type { TRecordValue } from '#shared/types/record'

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
 */
export interface IFieldCellProps {
  field: IField
  value: TRecordValue
}
