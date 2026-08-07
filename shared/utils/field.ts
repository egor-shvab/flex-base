import { DEFAULT_BADGE_COLOR } from '#shared/constants/color'
import { MULTI_VALUE_BY_TYPE } from '#shared/constants/field'
import type { TBadgeColor } from '#shared/types/color'
import type { IField } from '#shared/types/field'

/**
 * Whether this field holds a list of values rather than one — the single seam every layer
 * reads, so the flag is interpreted in exactly one place.
 *
 * Cardinality is a property of the **field**, not of its type: two SELECT fields on one table
 * may disagree. That is why the registries keyed by `TFieldType` alone are consulted through
 * a resolver that takes an `IField` (`sqlFor`, `inputFor`, `filterFor`, `summaryFor`,
 * `filterShapeFor`) rather than being indexed directly.
 *
 * The `MULTI_VALUE_BY_TYPE` guard is what stops a stale or crafted `options.multiple` on a
 * type that has no list behaviour from reaching the schema or the SQL.
 */
export function isMultiValue(field: IField): boolean {
  return MULTI_VALUE_BY_TYPE[field.type] && field.options?.multiple === true
}

/**
 * A SELECT's choices as bare strings — what the record schema validates against and what
 * the form and filter controls list. Three call sites read this shape, so the unwrapping
 * lives here rather than being mapped inline in each of them.
 */
export function choiceValues(field: IField): string[] {
  return (field.options?.choices ?? []).map((choice) => choice.value)
}

/**
 * A SELECT's choices as a picker offers them — the same strings as `choiceValues`, but with
 * the colour kept. Structurally an `ISelectOption`, which is what puts a choice's hue in the
 * form and the filter drawer rather than only in a table cell.
 *
 * A choice's `value` is also its label: its own text is its identity (see `docs/decisions.md`).
 */
export function choiceOptions(
  field: IField,
): { value: string; label: string; color: TBadgeColor }[] {
  return (field.options?.choices ?? []).map((choice) => ({
    value: choice.value,
    label: choice.value,
    color: choice.color,
  }))
}

/**
 * The colour a stored value renders in. A value the field no longer offers — renamed or
 * deleted after records were written — falls back to the neutral default rather than
 * disappearing, so a stale cell still shows its text.
 */
export function badgeColorFor(field: IField, value: string): TBadgeColor {
  return (
    field.options?.choices?.find((choice) => choice.value === value)?.color ?? DEFAULT_BADGE_COLOR
  )
}
