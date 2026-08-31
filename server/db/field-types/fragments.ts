import { Prisma } from '#server/generated/prisma/client'
import { isMultiValue } from '#shared/field-types/cardinality'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import { isListFilterValue, isRangeFilterValue, isScalarFilterValue } from '#shared/utils/filter'
import type { TFilterSql } from '#server/db/field-types/types'

/**
 * The SQL fragments the per-type modules are assembled from. Prisma cannot order by a JSON
 * path, so the record list is composed as SQL. Field keys are slugified to `^[a-z0-9_]+$` and
 * validated against the table's own metadata before reaching this module, and both keys and
 * values are bound as parameters — never interpolated. The `::text` cast on the key
 * disambiguates Postgres' `->>` overloads.
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
 * The same, but guaranteed to be an array. **Load-bearing:** `jsonb_array_elements_text`
 * raises `cannot extract elements from a scalar` on anything else, and that error takes down
 * the whole list query rather than skipping one row. A field flipped to multi migrates its
 * data, but a row written between the two is a scalar, and so is `null` — both must degrade
 * to "no elements", not to a 500.
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
 * Any of several values, which is what a list-shaped filter means — picking two choices
 * matches either. `IN (…)` carries its own parentheses, so unlike the OR group in
 * `buildRecordSearch` this cannot bind to a sibling range's last bound.
 */
export const matchesAny: TFilterSql = (expr, value) =>
  isListFilterValue(value) && value.length > 0
    ? Prisma.sql`${expr} IN (${Prisma.join(value)})`
    : null

/**
 * The multi-value counterpart: the *stored* value is now the list, so the question is whether
 * it holds any of the filtered ones.
 *
 * **The `?|` operator, never the `jsonb_exists_any` function that means the same thing.**
 * PostgreSQL matches *operators* to index operator classes and never matches the equivalent
 * function call, so the function form cannot be served by a GIN index in any form — and it
 * additionally leaves the planner with no selectivity statistics, so it estimates a blind third
 * of the table. A row estimate that wrong propagates into join and sort choices elsewhere in the
 * same query, which is why this matters before any index exists. `docs/decisions.md` carries the
 * measurement and the `@>` fallback.
 *
 * Wrapped in its own parentheses, so like `IN (…)` and unlike `withinRange` it cannot bind to a
 * sibling's last term — operator precedence would already save it, but the invariant is worth
 * seeing in the SQL rather than inferring from a precedence table. It also answers correctly for
 * a bare scalar, which is what keeps a row written before a field's migration from disappearing
 * from its own filter.
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
 * A relation stores an id, which is meaningless to sort by, so its column orders on the
 * target record's label instead — the key of that label field travels in the relation's own
 * options, so no extra metadata has to be fetched. A missing key (its field was deleted)
 * yields NULL for every row, which the `NULLS LAST` suffix already handles.
 *
 * A multi-value relation orders by its **first** link, for the same reason a multi SELECT
 * does: a list has no order of its own, and the first value is the one the user can see
 * without opening anything.
 *
 * The outer `data` is qualified because the subquery's own alias would otherwise shadow it.
 */
export function targetLabel(field: IField): Prisma.Sql {
  const labelFieldKey = field.options?.labelFieldKey
  const storedId = isMultiValue(field)
    ? Prisma.sql`"Record".data -> ${field.key}::text ->> 0`
    : Prisma.sql`"Record".data ->> ${field.key}::text`

  if (labelFieldKey === undefined) return storedId

  return Prisma.sql`(
    SELECT target.data ->> ${labelFieldKey}::text FROM "Record" AS target
    WHERE target.id = ${storedId}
  )`
}

/**
 * How a multi-value column orders: by its first value. A list has no intrinsic order, so any
 * rule here is a choice — this one is the value already visible in the cell, which makes the
 * ordering explicable from what is on screen rather than from what is stored.
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
 * `["Won","Lost"]` text instead would "work" and would also let a term of `","` or `[` match,
 * which is a lie rather than a near miss. `EXISTS (…)` is self-parenthesising, so it is safe
 * beside a bare range bound in the same `AND` chain.
 */
export function matchesAnyElement(key: string, pattern: string): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(${jsonArrayElements(key)}) AS element
    WHERE element ILIKE ${pattern}
  )`
}
