import { Prisma } from '#server/generated/prisma/client'
import type { IField, TFieldType } from '#shared/types/field'
import {
  CREATED_AT_KEY,
  DEFAULT_SORT_KEY,
  RECORD_NUMBER_KEY,
  UPDATED_AT_KEY,
} from '#shared/constants/filter'
import type { IRecordSort, TFilterValue, TRecordFilterValues } from '#shared/types/filter'
import { isMultiValue } from '#shared/utils/field'
import {
  isListFilterValue,
  isRangeFilterValue,
  isScalarFilterValue,
  queryColumns,
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

/**
 * The stored value as JSONB rather than as text — what a multi-value field projects to, since
 * `->>` on an array yields the literal `["a","b"]` and would match a filter on `[` or `","`.
 */
function jsonArray(key: string): Prisma.Sql {
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

/**
 * The multi-value counterpart: the *stored* value is now the list, so the question is whether
 * it holds any of the filtered ones. `jsonb_exists_any` is the function form of the `?|`
 * operator, chosen because a literal `?` in raw SQL is the placeholder token on Prisma's other
 * drivers and has a long history of being mangled — the functions are unambiguous everywhere.
 *
 * It carries its own parentheses, so like `IN (…)` and unlike `withinRange` it cannot bind to
 * a sibling's last term. It also answers correctly for a bare scalar, which is what keeps a
 * row written before a field's migration from disappearing from its own filter.
 *
 * Unlike every other comparison here this one is GIN-indexable, so it is the one filter whose
 * cost is not pinned to the unindexed JSONB ceiling the rest of the layer accepts.
 */
const containsAny: TFilterSql = (expr, value) =>
  isListFilterValue(value) && value.length > 0
    ? Prisma.sql`jsonb_exists_any(${expr}, ARRAY[${Prisma.join(value)}]::text[])`
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
 *
 * A multi-value relation orders by its **first** link, for the same reason a multi SELECT
 * does: a list has no order of its own, and the first value is the one the user can see
 * without opening anything.
 *
 * The outer `data` is qualified because the subquery's own alias would otherwise shadow it.
 */
function targetLabel(field: IField): Prisma.Sql {
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
function firstElement(field: IField): Prisma.Sql {
  return Prisma.sql`${jsonArray(field.key)} ->> 0`
}

/** How free-text search matches a plain text projection — the shape five types share. */
function matchesText(key: string, pattern: string): Prisma.Sql {
  return Prisma.sql`${jsonText(key)} ILIKE ${pattern}`
}

/**
 * The multi-value counterpart: any one element matching is a hit. Matching the raw
 * `["Won","Lost"]` text instead would "work" and would also let a term of `","` or `[` match,
 * which is a lie rather than a near miss. `EXISTS (…)` is self-parenthesising, so it is safe
 * beside a bare range bound in the same `AND` chain.
 */
function matchesAnyElement(key: string, pattern: string): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(${jsonArrayElements(key)}) AS element
    WHERE element ILIKE ${pattern}
  )`
}

interface IFieldSqlRules {
  /** Projects the stored JSONB value to a comparable expression — what a filter compares against. */
  expr: (key: string) => Prisma.Sql
  /** How the column orders, for a type that reads as something other than the value it stores. */
  sortExpr?: (field: IField) => Prisma.Sql
  /**
   * How free-text search matches this type, as a whole **predicate**, or `null` to exclude it.
   * Separate from `expr` because two types cannot be searched the way they are filtered:
   * NUMBER and BOOLEAN cast, and neither `numeric` nor `boolean` has an `ILIKE` operator.
   *
   * A predicate rather than an expression the caller appends `ILIKE` to, because a multi-value
   * column cannot be matched by comparing one expression — it has to ask whether *any element*
   * matches, which is a shape no projection can express.
   */
  searchPredicate: (key: string, pattern: string) => Prisma.Sql | null
  /** Compares this type's filter value against that expression. */
  filter: TFilterSql
}

/**
 * The single per-field-type branch point for SQL. Total, so a new field type must declare how
 * it projects, how it compares and whether it is searchable. There is no operator to look up:
 * the field type says how it compares, and the value's shape says with how many bounds.
 */
const FIELD_SQL_BY_TYPE: Record<TFieldType, IFieldSqlRules> = {
  TEXT: { expr: jsonText, searchPredicate: matchesText, filter: matchesPartially },
  // Without the cast, `"10" < "9"` would compare as text — but search matches the un-cast
  // text, so typing `100` also finds `1000`, which is what a substring search should do
  NUMBER: {
    expr: (key) => Prisma.sql`(${jsonText(key)})::numeric`,
    searchPredicate: matchesText,
    filter: withinRange,
  },
  // Not searchable: the stored text is `true`/`false`, so searching `e` would match every
  // record that has the value `false`
  BOOLEAN: {
    expr: (key) => Prisma.sql`(${jsonText(key)})::boolean`,
    searchPredicate: () => null,
    filter: matchesExactly,
  },
  // Stored as `YYYY-MM-DD`, so text comparison is already chronological — and searching
  // `2026-07` naturally matches a month
  DATE: { expr: jsonText, searchPredicate: matchesText, filter: withinRange },
  // Several choices at once, ORed — the only list-shaped *filter* a single-value field has.
  // Search still matches the stored text, which is the choice's own label.
  SELECT: { expr: jsonText, searchPredicate: matchesText, filter: matchesAny },
  // Filters on the stored id — the picker's own value — but reads and orders by its label.
  // Not searchable: the stored value is a cuid, and matching the label instead would mean
  // `targetLabel`'s correlated subquery per row — two detoasts, a PK descent and a random
  // heap read — against every row, since the count query has no LIMIT.
  RELATION: {
    expr: jsonText,
    searchPredicate: () => null,
    sortExpr: targetLabel,
    filter: matchesExactly,
  },
}

/**
 * How a field behaves when it holds **several** values instead of one — the same lifting the
 * validation layer applies, expressed in SQL. Consulted before `FIELD_SQL_BY_TYPE` for a field
 * whose `options.multiple` is set, and total for the same reason that map is: a new field type
 * must state whether it has a list form rather than inheriting silence.
 *
 * `null` means the type has no multi form, which `MULTI_VALUE_BY_TYPE` already refuses to
 * configure — the two agree by construction, and this one is where that agreement is spent.
 */
const MULTI_SQL: Record<TFieldType, IFieldSqlRules | null> = {
  TEXT: null,
  NUMBER: null,
  BOOLEAN: null,
  DATE: null,
  // The stored list is compared for overlap with the filtered one, and searched element-wise
  SELECT: {
    expr: jsonArray,
    sortExpr: firstElement,
    searchPredicate: matchesAnyElement,
    filter: containsAny,
  },
  // Same comparison over ids; still not searchable, for the reason above — which the array
  // only strengthens, since matching labels would mean the subquery once per link per row
  RELATION: {
    expr: jsonArray,
    sortExpr: targetLabel,
    searchPredicate: () => null,
    filter: containsAny,
  },
}

/**
 * The one place a field's cardinality is resolved into SQL behaviour. Every projection,
 * comparison and ordering below goes through it, so no builder branches on `multiple` itself.
 */
function sqlFor(field: IField): IFieldSqlRules {
  return (isMultiValue(field) ? MULTI_SQL[field.type] : null) ?? FIELD_SQL_BY_TYPE[field.type]
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

  for (const field of queryColumns(fields)) {
    const predicate = searchPredicate(field, pattern)
    if (predicate) arms.push(predicate)
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

export function buildRecordOrderBy(fields: IField[], sort: IRecordSort): Prisma.Sql {
  const direction = sort.dir === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`
  const field =
    sort.key === DEFAULT_SORT_KEY ? undefined : queryColumns(fields).find((f) => f.key === sort.key)

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
