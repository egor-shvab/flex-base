import { Prisma } from '#server/generated/prisma/client'
import type { IField, TFieldType } from '#shared/types/field'
import { DEFAULT_SORT_KEY } from '#shared/types/filter'
import type { IRecordFilter, IRecordSort, TFilterOperator } from '#shared/types/filter'
import type { TRecordValue } from '#shared/types/record'

/**
 * Prisma cannot order by a JSON path, so the record list is composed as SQL. Field keys
 * are slugified to `^[a-z0-9_]+$` and validated against the table's own metadata before
 * reaching this module, and both keys and values are bound as parameters — never
 * interpolated. The `::text` cast on the key disambiguates Postgres' `->>` overloads.
 */
function jsonText(key: string): Prisma.Sql {
  return Prisma.sql`data ->> ${key}::text`
}

/**
 * The single per-field-type branch point for SQL: how a stored value is projected to a
 * comparable expression. Total, so a new field type must declare its projection.
 */
const VALUE_EXPR_BY_TYPE: Record<TFieldType, (key: string) => Prisma.Sql> = {
  TEXT: (key) => jsonText(key),
  // Without the cast, `"10" < "9"` would compare as text
  NUMBER: (key) => Prisma.sql`(${jsonText(key)})::numeric`,
  BOOLEAN: (key) => Prisma.sql`(${jsonText(key)})::boolean`,
  // Stored as `YYYY-MM-DD`, so text comparison is already chronological
  DATE: (key) => jsonText(key),
  SELECT: (key) => jsonText(key),
  RELATION: (key) => jsonText(key),
}

/** Escapes the wildcards a user may legitimately type into a "contains" box. */
function toContainsPattern(value: TRecordValue): string {
  return `%${String(value ?? '').replace(/[\\%_]/g, (character) => `\\${character}`)}%`
}

const OPERATOR_SQL: Record<TFilterOperator, (expr: Prisma.Sql, value: TRecordValue) => Prisma.Sql> =
  {
    eq: (expr, value) => Prisma.sql`${expr} = ${value}`,
    contains: (expr, value) => Prisma.sql`${expr} ILIKE ${toContainsPattern(value)}`,
    // Range bounds are inclusive — the UI presents them as "From" / "To"
    gte: (expr, value) => Prisma.sql`${expr} >= ${value}`,
    lte: (expr, value) => Prisma.sql`${expr} <= ${value}`,
  }

function valueExpr(field: IField): Prisma.Sql {
  return VALUE_EXPR_BY_TYPE[field.type](field.key)
}

/**
 * The one WHERE fragment, shared by the rows query and the count so they cannot disagree.
 * Every condition is ANDed, so a field contributing two of them (a `gte`/`lte` range)
 * needs no special handling here.
 */
export function buildRecordWhere(
  tableId: string,
  fields: IField[],
  filters: IRecordFilter[],
): Prisma.Sql {
  const conditions = [Prisma.sql`"tableId" = ${tableId}`]

  for (const filter of filters) {
    const field = fields.find((candidate) => candidate.key === filter.key)
    if (field) conditions.push(OPERATOR_SQL[filter.op](valueExpr(field), filter.value))
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
}

export function buildRecordOrderBy(fields: IField[], sort: IRecordSort): Prisma.Sql {
  const direction = sort.dir === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`
  const field = sort.key === DEFAULT_SORT_KEY ? undefined : fields.find((f) => f.key === sort.key)

  if (!field) {
    return Prisma.sql`"createdAt" ${direction}`
  }

  // Blanks always sort last, and creation order breaks ties so paging stays stable
  return Prisma.sql`${valueExpr(field)} ${direction} NULLS LAST, "createdAt" ASC`
}
