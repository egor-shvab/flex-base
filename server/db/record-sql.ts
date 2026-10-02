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

function searchPredicate(field: IField, pattern: string): Prisma.Sql | null {
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

  for (const field of queryColumns(fields)) {
    const predicate = searchPredicate(field, pattern)
    if (predicate) arms.push(predicate)
  }

  if (arms.length === 0) return null

  return Prisma.sql`${buildSearchPrefilter(pattern)} AND (${Prisma.join(arms, ' OR ')})`
}

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

export interface IRecordOrder {
  orderBy: Prisma.Sql
  join: Prisma.Sql
}

const SORT_JOIN_ALIAS = 'sort_target'

export function buildRecordOrderBy(fields: IField[], sort: IRecordSort): IRecordOrder {
  const direction = sort.direction === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`
  const field =
    sort.key === DEFAULT_SORT_KEY ? undefined : queryColumns(fields).find((f) => f.key === sort.key)

  if (!field) {
    return { orderBy: Prisma.sql`"createdAt" ${direction}`, join: Prisma.empty }
  }

  const joined = RECORD_COLUMN_SQL[field.key]
    ? null
    : (sqlFor(field).sortJoin?.(field, SORT_JOIN_ALIAS) ?? null)

  return {
    orderBy: Prisma.sql`${joined?.expr ?? sortExpr(field)} ${direction} NULLS LAST, "createdAt" DESC`,
    join: joined?.join ?? Prisma.empty,
  }
}

export function buildRecordLabelOrderBy(labelFieldKey?: string): Prisma.Sql {
  if (labelFieldKey === undefined) return Prisma.sql`"createdAt" DESC`

  return Prisma.sql`${jsonText(labelFieldKey)} ASC NULLS LAST, "createdAt" DESC`
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
