import { Prisma } from '#server/generated/prisma/client'
import type { IField, TFieldType } from '#shared/types/field'
import { DEFAULT_SORT_KEY } from '#shared/constants/filter'
import type { IRecordSort, TFilterValue, TRecordFilterValues } from '#shared/types/filter'
import { isRangeFilterValue } from '#shared/utils/filter'

/**
 * Prisma cannot order by a JSON path, so the record list is composed as SQL. Field keys
 * are slugified to `^[a-z0-9_]+$` and validated against the table's own metadata before
 * reaching this module, and both keys and values are bound as parameters — never
 * interpolated. The `::text` cast on the key disambiguates Postgres' `->>` overloads.
 */
function jsonText(key: string): Prisma.Sql {
  return Prisma.sql`data ->> ${key}::text`
}

/** Escapes the wildcards a user may legitimately type into a search box. */
function toContainsPattern(value: TFilterValue): string {
  return `%${String(value ?? '').replace(/[\\%_]/g, (character) => `\\${character}`)}%`
}

/**
 * How a filter value compares against a field's projected expression. Each builder narrows
 * the value by shape and yields no condition when it does not match — validation guarantees
 * the shape, so that branch is a guard rather than behaviour.
 */
type TFilterSql = (expr: Prisma.Sql, value: TFilterValue) => Prisma.Sql | null

const matchesPartially: TFilterSql = (expr, value) =>
  isRangeFilterValue(value) ? null : Prisma.sql`${expr} ILIKE ${toContainsPattern(value)}`

const matchesExactly: TFilterSql = (expr, value) =>
  isRangeFilterValue(value) ? null : Prisma.sql`${expr} = ${value}`

const withinRange: TFilterSql = (expr, value) => {
  if (!isRangeFilterValue(value)) return null

  // Bounds are inclusive — the UI presents them as "From" / "To" — and either may be absent
  const bounds: Prisma.Sql[] = []
  if (value.from !== null) bounds.push(Prisma.sql`${expr} >= ${value.from}`)
  if (value.to !== null) bounds.push(Prisma.sql`${expr} <= ${value.to}`)

  return bounds.length > 0 ? Prisma.join(bounds, ' AND ') : null
}

interface IFieldSqlSpec {
  /** Projects the stored JSONB value to a comparable expression. */
  expr: (key: string) => Prisma.Sql
  /** Compares this type's filter value against that expression. */
  filter: TFilterSql
}

/**
 * The single per-field-type branch point for SQL. Total, so a new field type must declare
 * both halves. There is no operator to look up: the field type says how it compares, and
 * the value's shape says with how many bounds.
 */
const FIELD_SQL_BY_TYPE: Record<TFieldType, IFieldSqlSpec> = {
  TEXT: { expr: jsonText, filter: matchesPartially },
  // Without the cast, `"10" < "9"` would compare as text
  NUMBER: { expr: (key) => Prisma.sql`(${jsonText(key)})::numeric`, filter: withinRange },
  BOOLEAN: { expr: (key) => Prisma.sql`(${jsonText(key)})::boolean`, filter: matchesExactly },
  // Stored as `YYYY-MM-DD`, so text comparison is already chronological
  DATE: { expr: jsonText, filter: withinRange },
  SELECT: { expr: jsonText, filter: matchesExactly },
  RELATION: { expr: jsonText, filter: matchesExactly },
}

function valueExpr(field: IField): Prisma.Sql {
  return FIELD_SQL_BY_TYPE[field.type].expr(field.key)
}

/**
 * The one WHERE fragment, shared by the rows query and the count so they cannot disagree.
 * Walks the table's fields rather than the filter map, so a key the table does not own has
 * nothing to compare against; every filter is ANDed.
 */
export function buildRecordWhere(
  tableId: string,
  fields: IField[],
  filters: TRecordFilterValues,
): Prisma.Sql {
  const conditions = [Prisma.sql`"tableId" = ${tableId}`]

  for (const field of fields) {
    const value = filters[field.key]
    if (value === undefined) continue

    const condition = FIELD_SQL_BY_TYPE[field.type].filter(valueExpr(field), value)
    if (condition) conditions.push(condition)
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
