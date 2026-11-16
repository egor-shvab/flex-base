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
import type { TRecordScope } from '#shared/types/workspace'
import type { TRecordData } from '#shared/types/record'
import { parseAddressNumber } from '#shared/utils/address'
import { buildQueryColumns } from '#shared/utils/filter'

const RECORD_COLUMN_SQL: Record<string, { expr: Prisma.Sql; sortExpr: Prisma.Sql }> = {
  [RECORD_NUMBER_KEY]: { expr: Prisma.sql`"number"::text`, sortExpr: Prisma.sql`"number"` },
  [CREATED_AT_KEY]: { expr: Prisma.sql`"createdAt"::date`, sortExpr: Prisma.sql`"createdAt"` },
  [UPDATED_AT_KEY]: { expr: Prisma.sql`"updatedAt"::date`, sortExpr: Prisma.sql`"updatedAt"` },
}

function toValueExpr(field: IField): Prisma.Sql {
  return RECORD_COLUMN_SQL[field.key]?.expr ?? sqlFor(field).expr(field.key)
}

function toSortExpr(field: IField): Prisma.Sql {
  const column = RECORD_COLUMN_SQL[field.key]
  if (column) return column.sortExpr

  const rules = sqlFor(field)

  return rules.sortExpr ? rules.sortExpr(field) : rules.expr(field.key)
}

function toSearchPredicate(field: IField, pattern: string): Prisma.Sql | null {
  const column = RECORD_COLUMN_SQL[field.key]

  if (column) {
    return field.key === RECORD_NUMBER_KEY ? Prisma.sql`${column.expr} ILIKE ${pattern}` : null
  }

  return sqlFor(field).searchPredicate(field.key, pattern)
}

/**
 * Must stay byte-identical to `Record_search_trgm_idx`'s expression, or the index is silently
 * unused. A deliberately over-inclusive pre-filter; the per-type OR group decides.
 */
function buildSearchPrefilter(pattern: string): Prisma.Sql {
  return Prisma.sql`record_search_text(data, "number") ILIKE ${pattern}`
}

/**
 * The OR group's parentheses are load-bearing: `withinRange` returns a bare `a >= x AND a <= y`,
 * which an unparenthesised OR would bind to and silently widen.
 */
function buildRecordSearch(fields: IField[], search: string): Prisma.Sql | null {
  if (search === '') return null

  const pattern = toContainsPattern(search)
  const arms: Prisma.Sql[] = []

  for (const field of buildQueryColumns(fields)) {
    const predicate = toSearchPredicate(field, pattern)
    if (predicate) arms.push(predicate)
  }

  if (arms.length === 0) return null

  return Prisma.sql`${buildSearchPrefilter(pattern)} AND (${Prisma.join(arms, ' OR ')})`
}

/** Whose records of a table a query reads: `buildRecordScopeWhere`'s rule, in SQL. */
export interface IRecordReader {
  tableId: string
  readScope: TRecordScope
  userId: string
}

function buildScopeCondition(scope: TRecordScope, userId: string): Prisma.Sql | null {
  if (scope === 'ALL') return null
  if (scope === 'OWN') return Prisma.sql`"createdById" = ${userId}`
  return Prisma.sql`FALSE`
}

export function buildRecordWhere(
  reader: IRecordReader,
  fields: IField[],
  filters: TRecordFilterValues,
  search = '',
): Prisma.Sql {
  const conditions = [Prisma.sql`"tableId" = ${reader.tableId}`]

  const scopeCondition = buildScopeCondition(reader.readScope, reader.userId)
  if (scopeCondition) conditions.push(scopeCondition)

  for (const field of buildQueryColumns(fields)) {
    const value = filters[field.key]
    if (value === undefined) continue

    const condition = sqlFor(field).filter(toValueExpr(field), value)
    if (condition) conditions.push(condition)
  }

  const searchGroup = buildRecordSearch(fields, search)
  if (searchGroup) conditions.push(searchGroup)

  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
}

export interface IRecordOrder {
  orderBy: Prisma.Sql
  join: Prisma.Sql
}

const SORT_JOIN_ALIAS = 'sort_target'

/**
 * Every ordering ends on `"number"`, unique within a table: rows tied on the sort value and on
 * `"createdAt"` would otherwise come back in any order, and OFFSET paging would repeat or skip them.
 */
const TIE_BREAK = Prisma.sql`"createdAt" DESC, "number" DESC`

export function buildRecordOrderBy(fields: IField[], sort: IRecordSort): IRecordOrder {
  const direction = sort.direction === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`
  const field =
    sort.key === DEFAULT_SORT_KEY
      ? undefined
      : buildQueryColumns(fields).find((f) => f.key === sort.key)

  if (!field) {
    return {
      orderBy: Prisma.sql`"createdAt" ${direction}, "number" ${direction}`,
      join: Prisma.empty,
    }
  }

  const joined = RECORD_COLUMN_SQL[field.key]
    ? null
    : (sqlFor(field).sortJoin?.(field, SORT_JOIN_ALIAS) ?? null)

  return {
    orderBy: Prisma.sql`${joined?.expr ?? toSortExpr(field)} ${direction} NULLS LAST, ${TIE_BREAK}`,
    join: joined?.join ?? Prisma.empty,
  }
}

export function buildRecordLabelOrderBy(labelFieldKey?: string): Prisma.Sql {
  if (labelFieldKey === undefined) return TIE_BREAK

  return Prisma.sql`${jsonText(labelFieldKey)} ASC NULLS LAST, ${TIE_BREAK}`
}

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

export interface IRecordMerge {
  tableId: string
  address: string
  patch: TRecordData
  userId: string
  updateScope: TRecordScope
  expectedUpdatedAt?: Date
  now: Date
}

/** Prisma sends a `Date` as `timestamptz`; the column has no zone, and holds UTC. */
function toTimestamp(date: Date): Prisma.Sql {
  return Prisma.sql`${date.toISOString()}::timestamp(3)`
}

/**
 * Merges `patch` over the stored data, so a key the caller may not write keeps its value, and
 * returns the row — or none when the record, the caller's update scope or the version missed.
 * `"updatedAt"` is set here: only the Prisma client fills `@updatedAt`. The returned value is the
 * column's own, rounded to milliseconds, so it is the version a later `If-Match` must send.
 */
export function buildRecordMergeUpdate(merge: IRecordMerge): Prisma.Sql {
  const number = parseAddressNumber(merge.address)
  const conditions = [
    Prisma.sql`"tableId" = ${merge.tableId}`,
    number === 0 ? Prisma.sql`id = ${merge.address}` : Prisma.sql`"number" = ${number}`,
  ]

  const scopeCondition = buildScopeCondition(merge.updateScope, merge.userId)
  if (scopeCondition) conditions.push(scopeCondition)
  if (merge.expectedUpdatedAt) {
    conditions.push(Prisma.sql`"updatedAt" = ${toTimestamp(merge.expectedUpdatedAt)}`)
  }

  return Prisma.sql`
    UPDATE "Record"
    SET data = COALESCE(data, '{}'::jsonb) || ${JSON.stringify(merge.patch)}::jsonb,
        "updatedAt" = ${toTimestamp(merge.now)},
        "updatedById" = ${merge.userId}
    WHERE ${Prisma.join(conditions, ' AND ')}
    RETURNING id, "number", "createdById", data, "createdAt", "updatedAt"
  `
}
