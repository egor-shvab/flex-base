import { Prisma } from '#server/generated/prisma/client'
import { isMultiValue } from '#shared/field-types/cardinality'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import { isListFilterValue, isRangeFilterValue, isScalarFilterValue } from '#shared/utils/filter'
import type { IJoinedSort, TFilterSql } from '#server/db/field-types/types'

/** The `::text` cast on the key disambiguates PostgreSQL's `->>` overloads. */
export function jsonText(key: string): Prisma.Sql {
  return Prisma.sql`data ->> ${key}::text`
}

export function jsonArray(key: string): Prisma.Sql {
  return Prisma.sql`data -> ${key}::text`
}

/**
 * `jsonb_array_elements_text` raises on a scalar, taking down the whole query — and a row written
 * mid-migration is a scalar, as is `null`.
 */
function jsonArrayElements(key: string): Prisma.Sql {
  return Prisma.sql`CASE WHEN jsonb_typeof(${jsonArray(key)}) = 'array'
    THEN ${jsonArray(key)} ELSE '[]'::jsonb END`
}

export function toContainsPattern(value: TFilterValue): string {
  return `%${String(value ?? '').replace(/[\\%_]/g, (character) => `\\${character}`)}%`
}

export const matchesPartially: TFilterSql = (expr, value) =>
  isScalarFilterValue(value) ? Prisma.sql`${expr} ILIKE ${toContainsPattern(value)}` : null

export const matchesExactly: TFilterSql = (expr, value) =>
  isScalarFilterValue(value) ? Prisma.sql`${expr} = ${value}` : null

export const matchesAny: TFilterSql = (expr, value) =>
  isListFilterValue(value) && value.length > 0
    ? Prisma.sql`${expr} IN (${Prisma.join(value)})`
    : null

/**
 * The `?|` operator, never `jsonb_exists_any`: only an operator can use a GIN index or get
 * selectivity statistics. Parenthesised so it cannot bind to a sibling's last term.
 */
export const containsAny: TFilterSql = (expr, value) =>
  isListFilterValue(value) && value.length > 0
    ? Prisma.sql`(${expr} ?| ARRAY[${Prisma.join(value)}]::text[])`
    : null

export const withinRange: TFilterSql = (expr, value) => {
  if (!isRangeFilterValue(value)) return null

  const bounds: Prisma.Sql[] = []
  if (value.from !== null) bounds.push(Prisma.sql`${expr} >= ${value.from}`)
  if (value.to !== null) bounds.push(Prisma.sql`${expr} <= ${value.to}`)

  return bounds.length > 0 ? Prisma.join(bounds, ' AND ') : null
}

/**
 * A derived table with renamed columns, not a plain `LEFT JOIN "Record"`: that self-join would make
 * every unqualified `data`, `id` and `"tableId"` in the surrounding query ambiguous.
 */
export function targetLabelJoin(field: IField, alias: string): IJoinedSort {
  const storedId = isMultiValue(field)
    ? Prisma.sql`data -> ${field.key}::text ->> 0`
    : Prisma.sql`data ->> ${field.key}::text`

  const labelFieldKey = field.options?.labelFieldKey
  const targetTableId = field.options?.targetTableId

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

export function firstElement(field: IField): Prisma.Sql {
  return Prisma.sql`${jsonArray(field.key)} ->> 0`
}

export function matchesText(key: string, pattern: string): Prisma.Sql {
  return Prisma.sql`${jsonText(key)} ILIKE ${pattern}`
}

export const notSearchable = (): null => null

export function matchesAnyElement(key: string, pattern: string): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(${jsonArrayElements(key)}) AS element
    WHERE element ILIKE ${pattern}
  )`
}
