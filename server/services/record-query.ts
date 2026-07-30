import { Prisma } from '#server/generated/prisma/client'
import type { IField, TFieldType } from '#shared/types/field'
import {
  CREATED_AT_KEY,
  DEFAULT_SORT_KEY,
  RECORD_NUMBER_KEY,
  UPDATED_AT_KEY,
} from '#shared/constants/filter'
import type { IRecordSort, TFilterValue, TRecordFilterValues } from '#shared/types/filter'
import { isRangeFilterValue, queryFields } from '#shared/utils/filter'

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

/**
 * A relation stores an id, which is meaningless to sort by, so its column orders on the
 * target record's label instead — the key of that label field travels in the relation's own
 * options, so no extra metadata has to be fetched. A missing key (its field was deleted)
 * yields NULL for every row, which the `NULLS LAST` suffix already handles.
 */
function targetLabel(field: IField): Prisma.Sql {
  const labelFieldKey = field.options?.labelFieldKey

  if (labelFieldKey === undefined) return jsonText(field.key)

  // The outer `data` is qualified because the subquery's own alias would otherwise shadow it
  return Prisma.sql`(
    SELECT target.data ->> ${labelFieldKey}::text FROM "Record" AS target
    WHERE target.id = "Record".data ->> ${field.key}::text
  )`
}

interface IFieldSqlSpec {
  /** Projects the stored JSONB value to a comparable expression — what a filter compares against. */
  expr: (key: string) => Prisma.Sql
  /** How the column orders, for a type that reads as something other than the value it stores. */
  sortExpr?: (field: IField) => Prisma.Sql
  /** Compares this type's filter value against that expression. */
  filter: TFilterSql
}

/**
 * The single per-field-type branch point for SQL. Total, so a new field type must declare how
 * it projects and how it compares. There is no operator to look up: the field type says how it
 * compares, and the value's shape says with how many bounds.
 */
const FIELD_SQL_BY_TYPE: Record<TFieldType, IFieldSqlSpec> = {
  TEXT: { expr: jsonText, filter: matchesPartially },
  // Without the cast, `"10" < "9"` would compare as text
  NUMBER: { expr: (key) => Prisma.sql`(${jsonText(key)})::numeric`, filter: withinRange },
  BOOLEAN: { expr: (key) => Prisma.sql`(${jsonText(key)})::boolean`, filter: matchesExactly },
  // Stored as `YYYY-MM-DD`, so text comparison is already chronological
  DATE: { expr: jsonText, filter: withinRange },
  SELECT: { expr: jsonText, filter: matchesExactly },
  // Filters on the stored id — the picker's own value — but reads and orders by its label
  RELATION: { expr: jsonText, sortExpr: targetLabel, filter: matchesExactly },
}

/**
 * The columns of `Record` itself that a query treats as fields. Consulted before the type
 * registry, because these live outside `data` and no JSON path can reach them. Every one
 * declares both halves for the same reason RELATION does — how a column compares is not how
 * it orders:
 *
 * - the number **filters as text** (`4` matches `#4`, `#14`, `#42`) but **orders as an integer**
 *   (`#9` before `#10`);
 * - a timestamp **filters as a date**, so an inclusive `to` bound covers that whole day rather
 *   than stopping at its midnight, but **orders as a timestamp**, so two records made on one
 *   day still order by time.
 */
const RECORD_COLUMN_SQL: Record<string, { expr: Prisma.Sql; sortExpr: Prisma.Sql }> = {
  [RECORD_NUMBER_KEY]: { expr: Prisma.sql`"number"::text`, sortExpr: Prisma.sql`"number"` },
  [CREATED_AT_KEY]: { expr: Prisma.sql`"createdAt"::date`, sortExpr: Prisma.sql`"createdAt"` },
  [UPDATED_AT_KEY]: { expr: Prisma.sql`"updatedAt"::date`, sortExpr: Prisma.sql`"updatedAt"` },
}

function valueExpr(field: IField): Prisma.Sql {
  return RECORD_COLUMN_SQL[field.key]?.expr ?? FIELD_SQL_BY_TYPE[field.type].expr(field.key)
}

function sortExpr(field: IField): Prisma.Sql {
  const column = RECORD_COLUMN_SQL[field.key]
  if (column) return column.sortExpr

  const spec = FIELD_SQL_BY_TYPE[field.type]

  return spec.sortExpr ? spec.sortExpr(field) : spec.expr(field.key)
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

  for (const field of queryFields(fields)) {
    const value = filters[field.key]
    if (value === undefined) continue

    const condition = FIELD_SQL_BY_TYPE[field.type].filter(valueExpr(field), value)
    if (condition) conditions.push(condition)
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
}

export function buildRecordOrderBy(fields: IField[], sort: IRecordSort): Prisma.Sql {
  const direction = sort.dir === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`
  const field =
    sort.key === DEFAULT_SORT_KEY ? undefined : queryFields(fields).find((f) => f.key === sort.key)

  if (!field) {
    return Prisma.sql`"createdAt" ${direction}`
  }

  // Blanks always sort last; ties break newest-first, matching the default order, and the
  // tie-break is what keeps paging stable
  return Prisma.sql`${sortExpr(field)} ${direction} NULLS LAST, "createdAt" DESC`
}

/**
 * How a relation picker's candidates are ordered — alphabetically by the label the user will
 * read, with the same blanks-last, newest-first tie-break as every other list.
 */
export function buildRecordLabelOrderBy(labelFieldKey?: string): Prisma.Sql {
  if (labelFieldKey === undefined) return Prisma.sql`"createdAt" DESC`

  return Prisma.sql`${jsonText(labelFieldKey)} ASC NULLS LAST, "createdAt" DESC`
}
