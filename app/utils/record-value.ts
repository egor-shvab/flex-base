import type { TFilterValue } from '#shared/types/filter'
import type { TRecordSingleValue, TRecordValue } from '#shared/types/record'

/**
 * A stored value as the **list** a multi-value field holds.
 *
 * **The one place a value that is not yet an array is accounted for.** Widening a field runs
 * `widenToList`, which rewrites its rows in the same transaction as the metadata — so a bare
 * scalar only survives on a page drawn before that ran. Two callers meet one: the form control,
 * where dropping the value would lose an edit the user is about to save back, and the cell, where
 * it would render as nothing.
 *
 * Not defensive padding, and not the server's job: `collectRelationTargets` normalises the same
 * shape but rejects non-string *elements* as it goes, which is a stricter question than this one.
 *
 * Typed on `TFilterValue` rather than `TRecordValue` — the record union is a subset of it, so one
 * signature serves the control adapters and the cell alike.
 */
export function toValueList(value: TFilterValue): string[] {
  if (Array.isArray(value)) return value

  return typeof value === 'string' && value !== '' ? [value] : []
}

/**
 * The counterpart for every other cell, which renders exactly one value.
 *
 * The two are a pair: whenever `cellComponent` returns `MultiValueCell` the value is
 * `toValueList`, and otherwise it is this. They live together because both are pure shape —
 * resolving *which* cell draws a column reads the registries, and is `~/field-types/cell-resolver`.
 */
export function toCellSingleValue(value: TRecordValue): TRecordSingleValue {
  return Array.isArray(value) ? (value[0] ?? null) : value
}
