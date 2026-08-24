import type { TFilterValue } from '#shared/types/filter'
import type { TRecordSingleValue, TRecordValue } from '#shared/types/record'

/**
 * A value as the **list** it stands for: an array passes through, a non-empty string becomes one
 * entry, and anything else — blank, `null`, a number, a range — is no list at all.
 *
 * **The one place that question is answered.** Four callers ask it, and two of them ask for
 * different reasons, which is why this module is named for the shape rather than for either
 * domain (`docs/decisions.md`):
 *
 * - three read a **stored** value — `listValue` in `~/field-types/adapters`, the multi-value cell,
 *   and the relation picker;
 * - one normalises a **control's own model** — `BaseSelect`, whose selection is internally always
 *   a list whatever its model's arity.
 *
 * The leniency is what the stored-value callers need, and it is part of the contract rather than
 * padding: widening a field runs `widenToList`, which rewrites its rows in the same transaction as
 * the metadata, so a bare scalar only survives on a page drawn before that ran. Dropping it would
 * lose an edit the user is about to save back, and render a cell as nothing.
 *
 * Not the server's job either: `collectRelationTargets` normalises the same shape but rejects
 * non-string *elements* as it goes, which is a stricter question than this one.
 *
 * Typed on `TFilterValue` rather than `TRecordValue` — the record union is a subset of it, and so
 * is `BaseSelect`'s `string | string[]` model, so one signature serves every caller above.
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
