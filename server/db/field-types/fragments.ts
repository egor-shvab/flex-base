import { Prisma } from '#server/generated/prisma/client'
import { isMultiValue } from '#shared/field-types/cardinality'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import { isListFilterValue, isRangeFilterValue, isScalarFilterValue } from '#shared/utils/filter'
import type { IJoinedSort, TFilterSql } from '#server/db/field-types/types'

/**
 * The SQL fragments the per-type modules are assembled from — Prisma cannot order by a JSON
 * path, so the record list is composed as SQL. Keys and values are bound as parameters, never
 * interpolated; the `::text` cast on the key disambiguates Postgres' `->>` overloads.
 */
export function jsonText(key: string): Prisma.Sql {
  return Prisma.sql`data ->> ${key}::text`
}

/**
 * The stored value as JSONB rather than as text — what a multi-value field projects to, since
 * `->>` on an array yields the literal `["a","b"]` and would match a filter on `[` or `","`.
 */
export function jsonArray(key: string): Prisma.Sql {
  return Prisma.sql`data -> ${key}::text`
}

/**
 * The same, guaranteed to be an array. **Load-bearing:** `jsonb_array_elements_text` raises
 * `cannot extract elements from a scalar` on anything else, taking down the whole list query
 * rather than skipping a row — and a row written mid-migration is a scalar, as is `null`.
 */
function jsonArrayElements(key: string): Prisma.Sql {
  return Prisma.sql`CASE WHEN jsonb_typeof(${jsonArray(key)}) = 'array'
    THEN ${jsonArray(key)} ELSE '[]'::jsonb END`
}

/** Escapes the wildcards a user may legitimately type into a search box. */
export function toContainsPattern(value: TFilterValue): string {
  return `%${String(value ?? '').replace(/[\\%_]/g, (character) => `\\${character}`)}%`
}

export const matchesPartially: TFilterSql = (expr, value) =>
  isScalarFilterValue(value) ? Prisma.sql`${expr} ILIKE ${toContainsPattern(value)}` : null

export const matchesExactly: TFilterSql = (expr, value) =>
  isScalarFilterValue(value) ? Prisma.sql`${expr} = ${value}` : null

/**
 * Any of several values, which is what a list-shaped filter means. `IN (…)` carries its own
 * parentheses, so unlike `buildRecordSearch`'s OR group it cannot bind to a sibling's bound.
 */
export const matchesAny: TFilterSql = (expr, value) =>
  isListFilterValue(value) && value.length > 0
    ? Prisma.sql`${expr} IN (${Prisma.join(value)})`
    : null

/**
 * The multi-value counterpart: the *stored* value is the list, so the question is whether it
 * holds any of the filtered ones.
 *
 * **The `?|` operator, never the `jsonb_exists_any` function that means the same thing.**
 * PostgreSQL matches *operators* to index operator classes and never the equivalent function
 * call, so the function form can never use a GIN index — and it leaves the planner with no
 * selectivity statistics, estimating a blind third of the table, which propagates into join and
 * sort choices elsewhere in the same query. `docs/decisions.md` carries the measurement and the
 * `@>` fallback.
 *
 * Parenthesised so it cannot bind to a sibling's last term, and correct for a bare scalar —
 * which keeps a row written before a field's migration inside its own filter.
 */
export const containsAny: TFilterSql = (expr, value) =>
  isListFilterValue(value) && value.length > 0
    ? Prisma.sql`(${expr} ?| ARRAY[${Prisma.join(value)}]::text[])`
    : null

export const withinRange: TFilterSql = (expr, value) => {
  if (!isRangeFilterValue(value)) return null

  // Bounds are inclusive — the UI presents them as "From" / "To" — and either may be absent
  const bounds: Prisma.Sql[] = []
  if (value.from !== null) bounds.push(Prisma.sql`${expr} >= ${value.from}`)
  if (value.to !== null) bounds.push(Prisma.sql`${expr} <= ${value.to}`)

  return bounds.length > 0 ? Prisma.join(bounds, ' AND ') : null
}

/**
 * A relation stores an id, which is meaningless to sort by, so its column orders on the target
 * record's label — whose key travels in the relation's own options, so nothing extra is fetched.
 * A missing key or an unresolved link yields NULL, which `NULLS LAST` already handles. A
 * multi-value relation orders by its **first** link, as a multi SELECT does.
 *
 * **The joined relation is a derived table exposing two renamed columns, and that is
 * load-bearing.** A plain `LEFT JOIN "Record"` is a self-join, and every column reference in the
 * surrounding query is unqualified, so `data`, `id` and `"tableId"` become ambiguous and the
 * statement will not compile.
 *
 * It also narrows to the target table, so the hash is built from one table rather than every
 * record — and a link pointing outside its target sorts last rather than resolving to a
 * foreign row.
 */
export function targetLabelJoin(field: IField, alias: string): IJoinedSort {
  const storedId = isMultiValue(field)
    ? Prisma.sql`data -> ${field.key}::text ->> 0`
    : Prisma.sql`data ->> ${field.key}::text`

  const labelFieldKey = field.options?.labelFieldKey
  const targetTableId = field.options?.targetTableId

  // Nothing to join to: with no label field or no target, the stored id is all there is
  if (labelFieldKey === undefined || targetTableId === undefined) {
    return { join: Prisma.empty, expr: storedId }
  }

  const joined = Prisma.raw(`"${alias}"`)

  return {
    join: Prisma.sql`LEFT JOIN (
      SELECT id AS target_id, data ->> ${labelFieldKey}::text AS target_label
      FROM "Record" WHERE "tableId" = ${targetTableId}
    ) AS ${joined} ON ${joined}.target_id = ${storedId}`,
    expr: Prisma.sql`${joined}.target_label`,
  }
}

/**
 * How a multi-value column orders: by its first value. A list has no intrinsic order, so any
 * rule is a choice; this one is the value already visible in the cell.
 */
export function firstElement(field: IField): Prisma.Sql {
  return Prisma.sql`${jsonArray(field.key)} ->> 0`
}

/** How free-text search matches a plain text projection — the shape five types share. */
export function matchesText(key: string, pattern: string): Prisma.Sql {
  return Prisma.sql`${jsonText(key)} ILIKE ${pattern}`
}

/** A type that opts out of free-text search entirely. */
export const notSearchable = (): null => null

/**
 * The multi-value counterpart: any one element matching is a hit. Matching the raw
 * `["Won","Lost"]` text would also let a term of `","` or `[` match. `EXISTS (…)` is
 * self-parenthesising, so it is safe beside a bare range bound in the same `AND` chain.
 */
export function matchesAnyElement(key: string, pattern: string): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(${jsonArrayElements(key)}) AS element
    WHERE element ILIKE ${pattern}
  )`
}
