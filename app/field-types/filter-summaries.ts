import { BOOLEAN_LABELS } from '#shared/constants/field'
import { UNKNOWN_RECORD_LABEL } from '#shared/constants/record'
import type { IField, TFieldType } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import type { IRecordRef } from '#shared/types/record'
import { isMultiValue } from '#shared/utils/field'
import { isListFilterValue, isRangeFilterValue } from '#shared/utils/filter'
import { formatRecordRef } from '#shared/utils/record-label'
import { formatDateProse, formatNumber } from '~/utils/format'

/**
 * What an active filter reads as in the summary line above the table — the per-field-type
 * branch point for *describing* a filter, as `FIELD_FILTERS` is for editing one.
 *
 * These are plain functions rather than components, unlike `FIELD_CELLS`. The reason cells
 * stayed components is that they carry markup and scoped styles; a summary fragment is a
 * bare string inside a chip, so it collapses into a formatter the way `FIELD_INPUTS` did.
 *
 * **Record columns need no override here.** `recordNumber` is TEXT-typed and reads
 * "Record # contains 4", which is accurate — it genuinely substring-matches; `createdAt` /
 * `updatedAt` are DATE-typed and their names already read as phrases. Unlike
 * `RECORD_COLUMN_SQL` and `RECORD_COLUMNS`, which exist because those columns live outside
 * `data`, nothing about describing them differs.
 */

/** What a summariser may need beyond the value itself. Only RELATION uses it. */
export interface IFilterSummaryContext {
  refFor: (fieldId: string, recordId: string) => IRecordRef | undefined
}

/**
 * The value parameter is widened to `TFilterValue` rather than indexed per type, and
 * narrowed inside. Indexing a mapped type by a union in *parameter* position collapses to
 * an intersection, which would make the map uncallable for an arbitrary field — the same
 * reason `IFieldControl.fromControl` and the server's `TFilterSql` widen theirs. Validation
 * guarantees the shape, so the guard branches are guards rather than behaviour.
 */
type TFilterSummary = (value: TFilterValue, field: IField, ctx: IFilterSummaryContext) => string

/**
 * Both range types share this, parameterised by how a bound is written — the precedent for
 * a shared fragment across registry entries is `blankIsNull` in `inputs.ts`.
 *
 * The wording tracks what the SQL actually does: bounds are **inclusive**, so "or more" and
 * "from" are true where "above" and "after" would not be.
 */
function summariseRange(
  value: TFilterValue,
  format: (bound: string | number) => string,
  both: (from: string, to: string) => string,
  lower: (from: string) => string,
  upper: (to: string) => string,
): string {
  if (!isRangeFilterValue(value)) return ''

  const { from, to } = value
  if (from !== null && to !== null) return both(format(from), format(to))
  if (from !== null) return lower(format(from))
  if (to !== null) return upper(format(to))
  return ''
}

/**
 * Every list-shaped filter reads the same way, parameterised by how one entry is written —
 * the precedent is `summariseRange` above. One value reads as an equality because that is what
 * it is; several read as the OR the SQL actually runs, rather than a count the user must
 * expand. There is no "all of" spelling, because there is no operator to express it.
 */
function summariseList(value: TFilterValue, entry: (value: string) => string): string {
  if (!isListFilterValue(value) || value.length === 0) return ''

  const entries = value.map(entry)

  return entries.length === 1 ? `is ${entries[0]}` : `is any of ${entries.join(', ')}`
}

export const FILTER_SUMMARIES: Record<TFieldType, TFilterSummary> = {
  TEXT: (value) => `contains ${String(value)}`,

  NUMBER: (value) =>
    summariseRange(
      value,
      (bound) => formatNumber(Number(bound)),
      (from, to) => `between ${from} and ${to}`,
      (from) => `${from} or more`,
      (to) => `${to} or less`,
    ),

  BOOLEAN: (value) => (value === true ? BOOLEAN_LABELS.true : BOOLEAN_LABELS.false),

  DATE: (value) =>
    summariseRange(
      value,
      (bound) => formatDateProse(String(bound)),
      (from, to) => `between ${from} and ${to}`,
      (from) => `from ${from}`,
      (to) => `until ${to}`,
    ),

  // Always list-shaped: a choice is its own text, so a filtered value needs no resolving
  SELECT: (value) => summariseList(value, (choice) => choice),

  // The only entry needing state beyond its own value. A filtered id outside the capped
  // candidate list resolves to nothing, and degrades the same way a cell does.
  RELATION: (value, field, ctx) => `is ${summariseRef(ctx, field, String(value))}`,
}

/**
 * How one linked record reads inside a chip: the flat form, because a summary is a string by
 * contract. Nothing resolved means there is no number to state either, so it degrades whole.
 */
function summariseRef(ctx: IFilterSummaryContext, field: IField, recordId: string): string {
  const ref = ctx.refFor(field.id, recordId)

  return ref === undefined ? UNKNOWN_RECORD_LABEL : formatRecordRef(ref)
}

/**
 * How a **multi-value** field's filter reads. Only RELATION needs an entry: a multi field
 * filters as a list, and SELECT's summary already is one — the same reason `MULTI_FILTERS`
 * leaves it alone.
 */
const MULTI_SUMMARIES: Record<TFieldType, TFilterSummary | null> = {
  TEXT: null,
  NUMBER: null,
  BOOLEAN: null,
  DATE: null,
  SELECT: null,
  RELATION: (value, field, ctx) => summariseList(value, (id) => summariseRef(ctx, field, id)),
}

/** How one field's active filter reads — the summary-side twin of `inputFor`/`filterFor`. */
export function summaryFor(field: IField): TFilterSummary {
  return (isMultiValue(field) ? MULTI_SUMMARIES[field.type] : null) ?? FILTER_SUMMARIES[field.type]
}
