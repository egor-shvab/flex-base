import type { Component } from 'vue'
import type { IField, TFieldType } from '#shared/types/field'
import type { IFilterValueByType, TFilterValue } from '#shared/types/filter'
import type { ILinkedRecord, TRecordSingleValue, TRecordValue } from '#shared/types/record'

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
 * `TRecordValue` — so both directions are mandatory and `RecordForm` never branches.
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
 * `MultiValueCell`'s own contract. Separate from `IFieldCellProps` rather than a widening of
 * it, because the two are opposites: this is the only cell that takes a list, and every other
 * one is the thing it delegates each entry to.
 *
 * Always a real array — `toValueList` normalises at the seam, so the pre-migration scalar case
 * is handled in one place instead of in every cell that might meet one.
 */
export interface IMultiValueCellProps {
  field: IField
  value: string[]
}

/** What a summariser may need beyond the value itself. Only RELATION uses it. */
export interface IFilterSummaryContext {
  linkedRecordFor: (fieldId: string, recordId: string) => ILinkedRecord | undefined
}

/**
 * What a *config* summariser may need beyond the field itself. Only RELATION uses it, and only
 * because a target table's name is not in the field's own metadata — the same reason its filter
 * summary takes `IFilterSummaryContext`. The caller owns the store; a registry entry resolving
 * one itself would read Pinia's module-global instance rather than the app's, which is not a
 * thing to do under SSR.
 */
export interface IFieldConfigSummaryContext {
  tableName: (tableId: string) => string | undefined
}

/**
 * How one field's *configuration* reads beside its type — a SELECT's choice count, a RELATION's
 * target — so a field list can be read without opening a dialog per row.
 *
 * No value of any kind: a config summary is about metadata, which is what separates it from
 * `TFilterSummary` and from `IFieldCellProps` alike. Cardinality is deliberately not its
 * business either — `isMultiValue(field)` answers that for every type, so the caller renders
 * that part itself rather than every entry repeating it.
 */
export type TFieldConfigSummary = (field: IField, ctx: IFieldConfigSummaryContext) => string

/**
 * What an active filter reads as in the summary line above the table.
 *
 * The value parameter is widened to `TFilterValue` rather than indexed per type, and
 * narrowed inside. Indexing a mapped type by a union in *parameter* position collapses to
 * an intersection, which would make the map uncallable for an arbitrary field — the same
 * reason `IFieldControl.fromControl` and the server's `TFilterSql` widen theirs. Validation
 * guarantees the shape, so the guard branches are guards rather than behaviour.
 */
export type TFilterSummary = (
  value: TFilterValue,
  field: IField,
  ctx: IFilterSummaryContext,
) => string

/**
 * The whole client half of one field type: how it is edited, filtered, displayed, named and
 * described. Its two siblings are the isomorphic half in `#shared/field-types` and the SQL half
 * in `#server/db/field-types` — three modules, one per slice, split by what each bundle may
 * contain rather than by concern (`CLAUDE.md` §9).
 *
 * **Every key is required and nullable, never optional**, so a new field type states its
 * position on each axis rather than inheriting one by omission. The two `multi*` entries are
 * `null` for a type with no list form — which `multiValue` in the shared module already
 * refuses to configure. `configSummary`'s `null` means something different: not "no list form"
 * but "fully described by its own word", which is why it has no multi counterpart at all —
 * `isMultiValue(field)` answers cardinality for every type, so the field manager renders that
 * part itself rather than two entries repeating it.
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
