import { MULTI_VALUE_BY_TYPE } from '#shared/field-types/registry'
import type { IField } from '#shared/types/field'

/**
 * Whether this field holds a list rather than one value — the single seam every layer reads.
 *
 * Cardinality is a property of the **field**, not its type: two SELECT fields on one table may
 * disagree. That is why the type-keyed registries are consulted through a resolver taking an
 * `IField` (`sqlFor`, `inputFor`, `filterFor`, `summaryFor`, `filterShapeFor`).
 *
 * The `MULTI_VALUE_BY_TYPE` guard stops a stale or crafted `options.multiple` on a type with no
 * list behaviour from reaching the schema or the SQL.
 */
export function isMultiValue(field: IField): boolean {
  return MULTI_VALUE_BY_TYPE[field.type] && field.options?.multiple === true
}
