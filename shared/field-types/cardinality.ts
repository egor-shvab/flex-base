import { MULTI_VALUE_BY_TYPE } from '#shared/field-types/registry'
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
