import { createError } from 'h3'
import { Prisma } from '#server/generated/prisma/client'
import { prisma } from '#server/db/prisma'
import { RECORD_COUNT_CAP } from '#shared/constants/record'
import { toHttpError } from '#server/utils/http-errors'
import { recordSelect, toJsonData, toSharedRecord, type TRecordRow } from '#server/db/records'
import { buildRecordOrderBy, buildRecordWhere } from '#server/db/record-sql'
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
 * The rows of one page.
 *
 * **Two shapes, and which one is used turns on whether a search is running.** Searching narrows
 * hard and its predicate is index-served, so the hits are materialised first and sorted after;
 * left to itself the planner instead walks the `ORDER BY` index and filters, which reads the
 * whole table to fill one page. Without a search there is nothing to narrow by, and
 * materialising would mean building every matching row before taking fifty — so the plain query
 * keeps its index scan.
 *
 * The CTE is aliased back to `"Record"` because a RELATION sort's correlated subquery qualifies
 * the outer row by that name (`targetLabel`), and the alias is what keeps it in scope.
 */
function selectPage(where: Prisma.Sql, orderBy: Prisma.Sql, query: IRecordQuery) {
  const { page, pageSize, search } = query
  const offset = (page - 1) * pageSize
  const columns = Prisma.sql`id, "number", data, "createdAt", "updatedAt"`

  if (search === '') {
    return prisma.$queryRaw<TRecordRow[]>`
      SELECT ${columns} FROM "Record"
      ${where}
      ORDER BY ${orderBy}
      LIMIT ${pageSize} OFFSET ${offset}
    `
  }

  return prisma.$queryRaw<TRecordRow[]>`
    WITH hits AS MATERIALIZED (SELECT ${columns} FROM "Record" ${where})
    SELECT ${columns} FROM hits AS "Record"
    ORDER BY ${orderBy}
    LIMIT ${pageSize} OFFSET ${offset}
  `
}

/**
 * How many rows match, counted no further than the cap. `LIMIT cap + 1` is what separates
 * "exactly the cap" from "more than the cap" — one extra row is the whole difference.
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
  const where = buildRecordWhere(tableId, fields, filters, search)
  const orderBy = buildRecordOrderBy(fields, sort)

  const [rows, counts] = await prisma.$transaction([
    selectPage(where, orderBy, query),
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
 * One record with everything needed to render it away from its own table: the relation that
 * points at it knows only an id, so the table and its fields travel with the row. The labels
 * come from the same resolver the list uses, which is what lets a relation inside the dialog
 * read as a label and link on again.
 */
async function getRecordDetail(
  table: Pick<ITable, 'id' | 'name'>,
  fields: IField[],
  recordId: string,
): Promise<IRecordDetail> {
  const row = await prisma.record.findUnique({
    where: { id: recordId, tableId: table.id },
    select: recordSelect,
  })

  // A record of another user's table is already unreachable — the table was scoped by owner —
  // so this is the ordinary "deleted since the link was rendered" case
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
 * The record's number is allocated from its table's counter in the same transaction as the
 * insert: the atomic increment takes the row lock, so two concurrent creates queue rather
 * than racing for the same number, and no retry loop is needed. Because the counter is a
 * high-water mark rather than a count, deleting a record never frees its number for reuse.
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
  recordId: string,
  data: TRecordData,
): Promise<IRecord> {
  await RelationService.assertRelationTargets(fields, data)

  try {
    const record = await prisma.record.update({
      where: { id: recordId, tableId },
      data: { data: toJsonData(data) },
      select: recordSelect,
    })
    return toSharedRecord(record)
  } catch (error) {
    throw toHttpError(error, recordErrors)
  }
}

async function deleteRecord(tableId: string, recordId: string) {
  try {
    await prisma.record.delete({ where: { id: recordId, tableId } })
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
