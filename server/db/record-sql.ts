import { Prisma } from '#server/generated/prisma/client'
import { jsonText, toContainsPattern } from '#server/db/field-types/fragments'
import { sqlFor } from '#server/db/field-types/registry'
import type { IField } from '#shared/types/field'
import {
  CREATED_AT_KEY,
  DEFAULT_SORT_KEY,
  RECORD_NUMBER_KEY,
  UPDATED_AT_KEY,
} from '#shared/constants/filter'
import type { IRecordSort, TRecordFilterValues } from '#shared/types/filter'
import { queryColumns } from '#shared/utils/filter'

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
  return RECORD_COLUMN_SQL[field.key]?.expr ?? sqlFor(field).expr(field.key)
}

function sortExpr(field: IField): Prisma.Sql {
  const column = RECORD_COLUMN_SQL[field.key]
  if (column) return column.sortExpr

  const rules = sqlFor(field)

  return rules.sortExpr ? rules.sortExpr(field) : rules.expr(field.key)
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
 *
 * The record's own columns hold one value each, so they build their predicate here rather
 * than declaring one; nothing about them can be multi-valued.
 */
function searchPredicate(field: IField, pattern: string): Prisma.Sql | null {
  const column = RECORD_COLUMN_SQL[field.key]

  if (column) {
    return field.key === RECORD_NUMBER_KEY ? Prisma.sql`${column.expr} ILIKE ${pattern}` : null
  }

  return sqlFor(field).searchPredicate(field.key, pattern)
}

/**
 * The indexed half of a search: the whole row flattened to one text blob, matched against a
 * trigram GIN (`Record_search_trgm_idx`).
 *
 * **This expression must stay byte-identical to the one the index was built on** — the planner
 * matches an expression index structurally, so a stray cast or a renamed argument silently
 * costs the index and leaves a query that is merely slow rather than wrong.
 *
 * It is a **pre-filter, never the comparison.** `record_search_text` is deliberately
 * over-inclusive — it flattens every stored value, including the booleans and relation ids no
 * field type considers searchable — so the exact per-type OR group below still decides. What it
 * may never do is miss a value some type *does* search; that superset property is what the
 * whole arrangement rests on, and it has its own test.
 */
function buildSearchPrefilter(pattern: string): Prisma.Sql {
  return Prisma.sql`record_search_text(data, "number") ILIKE ${pattern}`
}

/**
 * The indexed pre-filter, ANDed with one parenthesised OR group matching `search` across every
 * searchable column. Two terms in an `AND` chain, so it composes with the filters exactly as a
 * single condition would.
 *
 * **The parentheses around the OR group are load-bearing.** `buildRecordWhere` joins its
 * conditions with `AND`, and `withinRange` returns a bare two-bound `a >= x AND a <= y` with
 * none of its own — safe only while every sibling is also `AND`. An unparenthesised OR here
 * would bind to the last bound of a range filter and silently widen it.
 */
function buildRecordSearch(fields: IField[], search: string): Prisma.Sql | null {
  if (search === '') return null

  const pattern = toContainsPattern(search)
  const arms: Prisma.Sql[] = []

  for (const field of queryColumns(fields)) {
    const predicate = searchPredicate(field, pattern)
    if (predicate) arms.push(predicate)
  }

  if (arms.length === 0) return null

  return Prisma.sql`${buildSearchPrefilter(pattern)} AND (${Prisma.join(arms, ' OR ')})`
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

  for (const field of queryColumns(fields)) {
    const value = filters[field.key]
    if (value === undefined) continue

    const condition = sqlFor(field).filter(valueExpr(field), value)
    if (condition) conditions.push(condition)
  }

  const searchGroup = buildRecordSearch(fields, search)
  if (searchGroup) conditions.push(searchGroup)

  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
}

/**
 * How the rows are ordered, and what the query needs in scope to order them that way.
 *
 * The two travel together because they belong to different clauses: an ordering is `ORDER BY` and
 * a join is `FROM`, and only the caller knows where its `FROM` is — the list has two query shapes
 * (§8) and the join has to land in whichever one is running.
 */
export interface IRecordOrder {
  orderBy: Prisma.Sql
  /** What the ordering has to bring into the query, or `Prisma.empty` when it is self-contained. */
  join: Prisma.Sql
}

/**
 * The alias a joined ordering is given. One fixed name is enough: a query orders by exactly one
 * column, so there is never a second join to collide with.
 */
const SORT_JOIN_ALIAS = 'sort_target'

export function buildRecordOrderBy(fields: IField[], sort: IRecordSort): IRecordOrder {
  const direction = sort.direction === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`
  const field =
    sort.key === DEFAULT_SORT_KEY ? undefined : queryColumns(fields).find((f) => f.key === sort.key)

  if (!field) {
    return { orderBy: Prisma.sql`"createdAt" ${direction}`, join: Prisma.empty }
  }

  // A record column never joins — it is already in the row (§5)
  const joined = RECORD_COLUMN_SQL[field.key]
    ? null
    : (sqlFor(field).sortJoin?.(field, SORT_JOIN_ALIAS) ?? null)

  // Blanks always sort last; ties break newest-first, matching the default order, and the
  // tie-break is what keeps paging stable
  return {
    orderBy: Prisma.sql`${joined?.expr ?? sortExpr(field)} ${direction} NULLS LAST, "createdAt" DESC`,
    join: joined?.join ?? Prisma.empty,
  }
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
