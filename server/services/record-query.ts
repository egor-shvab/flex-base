import { Prisma } from '#server/generated/prisma/client'
import type { IField, TFieldType } from '#shared/types/field'
import {
  CREATED_AT_KEY,
  DEFAULT_SORT_KEY,
  RECORD_NUMBER_KEY,
  UPDATED_AT_KEY,
} from '#shared/constants/filter'
import type { IRecordSort, TFilterValue, TRecordFilterValues } from '#shared/types/filter'
import {
  isListFilterValue,
  isRangeFilterValue,
  isScalarFilterValue,
  queryFields,
} from '#shared/utils/filter'

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
  isScalarFilterValue(value) ? Prisma.sql`${expr} ILIKE ${toContainsPattern(value)}` : null

const matchesExactly: TFilterSql = (expr, value) =>
  isScalarFilterValue(value) ? Prisma.sql`${expr} = ${value}` : null

/**
 * Any of several values, which is what a list-shaped filter means — picking two choices
 * matches either. `IN (…)` carries its own parentheses, so unlike the OR group in
 * `buildRecordSearch` this cannot bind to a sibling range's last bound.
 */
const matchesAny: TFilterSql = (expr, value) =>
  isListFilterValue(value) && value.length > 0
    ? Prisma.sql`${expr} IN (${Prisma.join(value)})`
    : null

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
  /**
   * How free-text search matches this type, or `null` to exclude it. Separate from `expr`
   * because two types cannot be searched the way they are filtered: NUMBER and BOOLEAN cast,
   * and neither `numeric` nor `boolean` has an `ILIKE` operator.
   */
  searchExpr: (key: string) => Prisma.Sql | null
  /** Compares this type's filter value against that expression. */
  filter: TFilterSql
}

/**
 * The single per-field-type branch point for SQL. Total, so a new field type must declare how
 * it projects, how it compares and whether it is searchable. There is no operator to look up:
 * the field type says how it compares, and the value's shape says with how many bounds.
 */
const FIELD_SQL_BY_TYPE: Record<TFieldType, IFieldSqlSpec> = {
  TEXT: { expr: jsonText, searchExpr: jsonText, filter: matchesPartially },
  // Without the cast, `"10" < "9"` would compare as text — but search matches the un-cast
  // text, so typing `100` also finds `1000`, which is what a substring search should do
  NUMBER: {
    expr: (key) => Prisma.sql`(${jsonText(key)})::numeric`,
    searchExpr: jsonText,
    filter: withinRange,
  },
  // Not searchable: the stored text is `true`/`false`, so searching `e` would match every
  // record that has the value `false`
  BOOLEAN: {
    expr: (key) => Prisma.sql`(${jsonText(key)})::boolean`,
    searchExpr: () => null,
    filter: matchesExactly,
  },
  // Stored as `YYYY-MM-DD`, so text comparison is already chronological — and searching
  // `2026-07` naturally matches a month
  DATE: { expr: jsonText, searchExpr: jsonText, filter: withinRange },
  // Several choices at once, ORed — the only list-shaped filter. Search still matches the
  // stored text, which is the choice's own label.
  SELECT: { expr: jsonText, searchExpr: jsonText, filter: matchesAny },
  // Filters on the stored id — the picker's own value — but reads and orders by its label.
  // Not searchable: the stored value is a cuid, and matching the label instead would mean
  // `targetLabel`'s correlated subquery per row — two detoasts, a PK descent and a random
  // heap read — against every row, since the count query has no LIMIT.
  RELATION: {
    expr: jsonText,
    searchExpr: () => null,
    sortExpr: targetLabel,
    filter: matchesExactly,
  },
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
 * How a column takes part in free-text search, or `null` to sit it out. Follows the same
 * key-before-type precedence as `valueExpr`, since these columns live outside `data`:
 *
 * - `recordNumber` already projects to `"number"::text`, which is exactly what a text match
 *   wants — typing `4` finds `#4`, `#14`, `#42`, as its filter already does;
 * - the timestamps project to `::date`, and `date ILIKE text` has no operator. Rather than
 *   add a cast that would let `2026` match every record made this year, they stay
 *   filter-only — the two range controls are the precise tool for a date.
 */
function searchExpr(field: IField): Prisma.Sql | null {
  const column = RECORD_COLUMN_SQL[field.key]
  if (column) return field.key === RECORD_NUMBER_KEY ? column.expr : null

  return FIELD_SQL_BY_TYPE[field.type].searchExpr(field.key)
}

/**
 * One parenthesised OR group matching `search` across every searchable column.
 *
 * **The parentheses are load-bearing.** `buildRecordWhere` joins its conditions with `AND`,
 * and `withinRange` returns a bare two-bound `a >= x AND a <= y` with none of its own — safe
 * only while every sibling is also `AND`. An unparenthesised OR here would bind to the last
 * bound of a range filter and silently widen it.
 */
function buildRecordSearch(fields: IField[], search: string): Prisma.Sql | null {
  if (search === '') return null

  const pattern = toContainsPattern(search)
  const arms: Prisma.Sql[] = []

  for (const field of queryFields(fields)) {
    const expr = searchExpr(field)
    if (expr) arms.push(Prisma.sql`${expr} ILIKE ${pattern}`)
  }

  return arms.length > 0 ? Prisma.sql`(${Prisma.join(arms, ' OR ')})` : null
}

/**
 * The one WHERE fragment, shared by the rows query and the count so they cannot disagree.
 * Walks the table's fields rather than the filter map, so a key the table does not own has
 * nothing to compare against; every filter is ANDed, and a search is ANDed with them as one
 * parenthesised OR group.
 */
export function buildRecordWhere(
  tableId: string,
  fields: IField[],
  filters: TRecordFilterValues,
  search = '',
): Prisma.Sql {
  const conditions = [Prisma.sql`"tableId" = ${tableId}`]

  for (const field of queryFields(fields)) {
    const value = filters[field.key]
    if (value === undefined) continue

    const condition = FIELD_SQL_BY_TYPE[field.type].filter(valueExpr(field), value)
    if (condition) conditions.push(condition)
  }

  const searchGroup = buildRecordSearch(fields, search)
  if (searchGroup) conditions.push(searchGroup)

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

/**
 * How a relation picker's candidates are narrowed by a typed term: the label field the
 * options are built from, plus the `#number` that `buildRecordLabel` falls back to when that
 * field is blank — so a record reading as `#42` is found by typing `42`, exactly as the
 * `recordNumber` filter already behaves.
 *
 * Parenthesised on its own for the same reason `buildRecordSearch` is: an OR group must
 * never be able to bind to a sibling condition's last term.
 */
export function buildRecordLabelSearch(
  labelFieldKey: string | undefined,
  search: string,
): Prisma.Sql | null {
  if (search === '') return null

  const pattern = toContainsPattern(search)
  const arms: Prisma.Sql[] = [Prisma.sql`('#' || "number"::text) ILIKE ${pattern}`]

  if (labelFieldKey !== undefined) {
    arms.push(Prisma.sql`${jsonText(labelFieldKey)} ILIKE ${pattern}`)
  }

  return Prisma.sql`(${Prisma.join(arms, ' OR ')})`
}
