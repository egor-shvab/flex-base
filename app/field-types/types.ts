import type { Component } from 'vue'
import type { IField, TFieldType } from '#shared/types/field'
import type { IFilterValueByType, TFilterValue } from '#shared/types/filter'
import type { ILinkedRecord, TRecordSingleValue, TRecordValue } from '#shared/types/record'

/**
 * How one field type's value drives a `Base*` control. `TValue` is what the field's own model
 * speaks — a record value, or a filter value.
 *
 * The adapters exist only where the control's model is a different shape, so a filter passing
 * straight through omits both. Only `fromControl` is tied to `TValue`: it is the direction that
 * lands back in the model, and a widened parameter keeps the map callable for any field.
 */
export interface IFieldControl<TValue extends TFilterValue> {
  component: Component
  props: (field: IField) => Record<string, unknown>
  toControl?: (value: TFilterValue) => TFilterValue
  fromControl?: (model: TFilterValue) => TValue
}

/**
 * A record input always adapts — a DOM control speaks strings and checkboxes, never
 * `TRecordValue` — so both directions are mandatory and `RecordForm` never branches.
 */
export type TRecordFieldControl = Required<IFieldControl<TRecordValue>>

/**
 * The contract every field cell honours — the `(field, value)` pair the control tables also
 * get. Blank values never reach a cell; a relation needs the field to know which link it is
 * resolving.
 *
 * **`TRecordSingleValue`, not `TRecordValue`.** A per-type cell renders exactly one value —
 * `MultiValueCell` hands each entry of a list back to one of these. The wider union would be a
 * type no cell honours, and since `defineProps<T>()` compiles to a *runtime* check it would add
 * `Array` to the accepted types of components that cannot render one.
 */
export interface IFieldCellProps {
  field: IField
  value: TRecordSingleValue
}

/**
 * `MultiValueCell`'s own contract — separate from `IFieldCellProps` rather than a widening of
 * it, since the two are opposites. Always a real array: `toValueList` normalises at the seam,
 * so the pre-migration scalar is handled in one place.
 */
export interface IMultiValueCellProps {
  field: IField
  value: string[]
}

/**
 * What a summariser may need beyond the value. Only RELATION uses it, and needs **both
 * directions**: a filter value is an address — a number going forward, a cuid in an older link.
 * The same rule `resolveFilterTargets` applies, so a chip cannot disagree with its rows.
 */
export interface IFilterSummaryContext {
  linkedRecordByNumber: (fieldId: string, number: number) => ILinkedRecord | undefined
  linkedRecordFor: (fieldId: string, recordId: string) => ILinkedRecord | undefined
}

/**
 * What a *config* summariser may need beyond the field. Only RELATION uses it, because a target
 * table's name is not in the field's metadata. The caller owns the store: a registry entry
 * resolving one would read Pinia's module-global instance rather than the app's, which is not
 * safe under SSR.
 */
export interface IFieldConfigSummaryContext {
  tableName: (tableId: string) => string | undefined
}

/**
 * How one field's *configuration* reads beside its type — a SELECT's choice count, a RELATION's
 * target. No value of any kind: a config summary is about metadata, which is what separates it
 * from `TFilterSummary`. Cardinality is not its business either; `isMultiValue(field)` answers
 * that for every type.
 */
export type TFieldConfigSummary = (field: IField, ctx: IFieldConfigSummaryContext) => string

/**
 * What an active filter reads as in the summary line above the table.
 *
 * The value parameter is widened to `TFilterValue` and narrowed inside: indexing a mapped type
 * by a union in *parameter* position collapses to an intersection, which would make the map
 * uncallable for an arbitrary field — the same reason `IFieldControl.fromControl` and the
 * server's `TFilterSql` widen theirs. Validation guarantees the shape.
 */
export type TFilterSummary = (
  value: TFilterValue,
  field: IField,
  ctx: IFilterSummaryContext,
) => string

/**
 * The whole client half of one field type. Its siblings are the isomorphic half in
 * `#shared/field-types` and the SQL half in `#server/db/field-types` — three modules split by
 * what each bundle may contain rather than by concern (`CLAUDE.md` §9).
 *
 * **Every key is required and nullable, never optional**, so a new type states its position on
 * each axis rather than inheriting one by omission. The `multi*` entries are `null` for a type
 * with no list form; `configSummary`'s `null` means instead "fully described by its own word",
 * which is why it has no multi counterpart.
 */
export interface IAppFieldType<K extends TFieldType> {
  input: TRecordFieldControl
  multiInput: TRecordFieldControl | null
  filter: IFieldControl<IFilterValueByType[K]>
  multiFilter: IFieldControl<TFilterValue> | null
  cell: Component
  summary: TFilterSummary
  multiSummary: TFilterSummary | null
  /** The glyph shown beside the type's word — never instead of it. */
  icon: string
  configSummary: TFieldConfigSummary | null
}
