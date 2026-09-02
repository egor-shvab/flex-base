import { createError } from 'h3'
import { Prisma } from '#server/generated/prisma/client'
import { prisma } from '#server/db/prisma'
import { RECORD_COUNT_CAP } from '#shared/constants/record'
import { toHttpError } from '#server/utils/http-errors'
import {
  recordSelect,
  recordWhere,
  toJsonData,
  toSharedRecord,
  type TRecordRow,
} from '#server/db/records'
import { buildRecordOrderBy, buildRecordWhere, type IRecordOrder } from '#server/db/record-sql'
import { RelationService } from '#server/services/relations'
import type { IField } from '#shared/types/field'
import type {
  IRecord,
  IRecordDetail,
  IRecordPage,
  IRecordQuery,
  TRecordData,
} from '#shared/types/record'
import type { ITable } from '#shared/types/table'

const recordErrors = { notFound: 'Record not found' }

/**
 * The rows of one page — **one shape, searching or not**.
 *
 * No `WITH hits AS MATERIALIZED (…)`: that hint builds every matching row, full JSONB included,
 * before the `LIMIT` can discard any, so at 600k rows a common term cost **7.4 s** against
 * **2.7 ms** without it. The planner picks a bitmap scan for a selective term and the ordering
 * index for a common one, correctly, given the trigram index's estimate (`docs/decisions.md`).
 *
 * **An ordering may bring a join with it** (`IRecordOrder`), composed here because only this
 * knows what the `FROM` is.
 */
function selectPage(where: Prisma.Sql, order: IRecordOrder, query: IRecordQuery) {
  const { page, pageSize } = query
  const offset = (page - 1) * pageSize
  const columns = Prisma.sql`id, "number", data, "createdAt", "updatedAt"`

  return prisma.$queryRaw<TRecordRow[]>`
    SELECT ${columns} FROM "Record"
    ${order.join}
    ${where}
    ORDER BY ${order.orderBy}
    LIMIT ${pageSize} OFFSET ${offset}
  `
}

/**
 * How many rows match, counted no further than the cap. `LIMIT cap + 1` is what separates
 * "exactly the cap" from "more than the cap".
 */
function selectCount(where: Prisma.Sql) {
  // COUNT(*) is a bigint, which would arrive as a string without the cast
  return prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM (SELECT 1 FROM "Record" ${where} LIMIT ${RECORD_COUNT_CAP + 1}) AS capped
  `
}

/**
 * Always paginated — a table's record set grows with user data and is never returned whole.
 * Raw SQL because Prisma cannot order by a JSON path; the WHERE fragment is shared with the
 * count so both legs of the transaction see the same rows.
 */
async function listRecords(
  tableId: string,
  fields: IField[],
  query: IRecordQuery,
): Promise<IRecordPage> {
  const { page, pageSize, sort, filters, search } = query
  // A relation filter arrives as the target's *address* where the column stores ids.
  // Substituted here so both legs of the transaction build from one resolved map, and above the
  // builder, so the SQL and its indexes never learn there were two forms.
  const where = buildRecordWhere(
    tableId,
    fields,
    await RelationService.resolveFilterTargets(fields, filters),
    search,
  )
  const order = buildRecordOrderBy(fields, sort)

  const [rows, counts] = await prisma.$transaction([
    selectPage(where, order, query),
    selectCount(where),
  ])

  const records = rows.map(toSharedRecord)
  const counted = counts[0]?.count ?? 0

  return {
    records,
    total: Math.min(counted, RECORD_COUNT_CAP),
    totalCapped: counted > RECORD_COUNT_CAP,
    page,
    pageSize,
    // Resolved for the ids on this page alone, in one query per target table
    linkedRecords: await RelationService.resolveLinkedRecords(fields, records),
  }
}

/**
 * One record with everything needed to render it away from its own table, since the relation
 * pointing at it knows only an id. The labels come from the same resolver the list uses, which
 * is what lets a relation inside the dialog read as a label and link on again.
 */
async function getRecordDetail(
  table: Pick<ITable, 'id' | 'number' | 'name'>,
  fields: IField[],
  address: string,
): Promise<IRecordDetail> {
  const row = await prisma.record.findUnique({
    where: recordWhere(table.id, address),
    select: recordSelect,
  })

  // Another user's record is already unreachable (the table was scoped by owner), so this is
  // the ordinary "deleted since the link was rendered" case
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: recordErrors.notFound })
  }

  const record = toSharedRecord(row)

  return {
    table,
    fields,
    record,
    linkedRecords: await RelationService.resolveLinkedRecords(fields, [record]),
  }
}

/**
 * The number is allocated from its table's counter in the same transaction as the insert: the
 * atomic increment takes the row lock, so concurrent creates queue rather than race and no retry
 * loop is needed. The counter is a high-water mark, so a delete never frees a number for reuse.
 */
async function createRecord(
  tableId: string,
  fields: IField[],
  data: TRecordData,
): Promise<IRecord> {
  await RelationService.assertRelationTargets(fields, data)

  try {
    const record = await prisma.$transaction(async (tx) => {
      const { recordCounter } = await tx.table.update({
        where: { id: tableId },
        data: { recordCounter: { increment: 1 } },
        select: { recordCounter: true },
      })

      return tx.record.create({
        data: { tableId, number: recordCounter, data: toJsonData(data) },
        select: recordSelect,
      })
    })

    return toSharedRecord(record)
  } catch (error) {
    throw toHttpError(error, recordErrors)
  }
}

/** The form always submits every field, so `data` is replaced wholesale rather than merged. */
async function updateRecord(
  tableId: string,
  fields: IField[],
  address: string,
  data: TRecordData,
): Promise<IRecord> {
  await RelationService.assertRelationTargets(fields, data)

  try {
    const record = await prisma.record.update({
      where: recordWhere(tableId, address),
      data: { data: toJsonData(data) },
      select: recordSelect,
    })
    return toSharedRecord(record)
  } catch (error) {
    throw toHttpError(error, recordErrors)
  }
}

async function deleteRecord(tableId: string, address: string) {
  try {
    await prisma.record.delete({ where: recordWhere(tableId, address) })
  } catch (error) {
    throw toHttpError(error, recordErrors)
  }
}

export const RecordService = {
  listRecords,
  getRecordDetail,
  createRecord,
  updateRecord,
  deleteRecord,
}
